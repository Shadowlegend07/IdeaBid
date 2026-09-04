import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './auth';

const CATEGORIES = [
  'Climate',
  'AI & data',
  'Health',
  'Future of work',
  'Consumer',
  'Education',
] as const;

class CreateIdeaDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mvp?: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  bid!: number;
}

class CreateCheckoutDto extends CreateIdeaDto {
  @IsOptional()
  @IsString()
  ideaId?: string;
}

@Injectable()
export class IdeasService {
  constructor(private db: PrismaService) {}

  private include = {
    author: { select: { name: true, username: true, avatarUrl: true } },
    _count: { select: { upvotes: true } },
  };

  async list(page = 1, pageSize = 10, category?: string, sort = 'top') {
    const safePage = Math.max(1, Number.isFinite(page) ? page : 1),
      safePageSize = Math.min(Math.max(1, Number.isFinite(pageSize) ? pageSize : 10), 50);
    const where = { status: 'PUBLISHED' as const, ...(category ? { category } : {}) };
    const orderBy = sort === 'recent'
      ? [{ createdAt: 'desc' as const }]
      : sort === 'upvoted'
        ? [{ upvoteCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ currentBidCents: 'desc' as const }, { createdAt: 'desc' as const }];
    const [data, total] = await this.db.$transaction([
      this.db.idea.findMany({
        where,
        include: this.include,
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.db.idea.count({ where }),
    ]);
    return {
      data,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.ceil(total / safePageSize),
        hasNextPage: safePage * safePageSize < total,
        hasPreviousPage: safePage > 1,
      },
    };
  }

  async listMine(userId: string) {
    return this.db.idea.findMany({
      where: { authorId: userId },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateIdeaDto) {
    const idea = await this.db.idea.create({
      data: {
        authorId: userId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        mvpDetails: dto.mvp,
        currentBidCents: dto.bid * 100,
      },
    });
    return idea;
  }

  async upvote(id: string, userId: string) {
    const found = await this.db.idea.findFirst({
      where: { id, status: 'PUBLISHED' },
    });
    if (!found) throw new BadRequestException('Idea is not available to upvote');
    try {
      await this.db.$transaction([
        this.db.ideaUpvote.create({ data: { ideaId: id, userId } }),
        this.db.idea.update({
          where: { id },
          data: { upvoteCount: { increment: 1 } },
        }),
      ]);
      return { upvoted: true };
    } catch {
      return { upvoted: false };
    }
  }
}

@ApiTags('ideas')
@Controller('v1/ideas')
export class IdeasController {
  constructor(private ideas: IdeasService) {}

  @Get()
  list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('category') category?: string,
    @Query('sort') sort = 'top'
  ) {
    return this.ideas.list(Number(page), Number(pageSize), category, sort);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@Req() req: any) {
    return this.ideas.listMine(req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreateIdeaDto) {
    return this.ideas.create(req.user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/upvote')
  upvote(@Req() req: any, @Param('id') id: string) {
    return this.ideas.upvote(id, req.user.sub);
  }
}

@Injectable()
export class PaymentsService {
  constructor(private db: PrismaService) {}

  private get base() {
    return process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode'
      ? 'https://live.dodopayments.com'
      : 'https://test.dodopayments.com';
  }

  async ideaCheckout(userId: string, d: CreateCheckoutDto) {
    const amountCents = d.bid * 100;
    let ideaId = d.ideaId;

    if (!ideaId) {
      const idea = await this.db.idea.create({
        data: {
          authorId: userId,
          title: d.title,
          description: d.description,
          category: d.category,
          mvpDetails: d.mvp,
          currentBidCents: amountCents,
        },
      });
      ideaId = idea.id;
    }

    const idea = await this.db.idea.findFirst({
      where: { id: ideaId, authorId: userId, status: 'PENDING_PAYMENT' },
    });
    if (!idea) throw new BadRequestException('This idea cannot be checked out');

    const bid = await this.db.ideaBid.create({
      data: { ideaId, bidderId: userId, amountCents },
    });

    const apiKey = process.env.DODO_PAYMENTS_API_KEY,
      productId = process.env.DODO_IDEA_BID_PRODUCT_ID;

    if (!apiKey || !productId) {
      await this.db.ideaBid.delete({ where: { id: bid.id } });
      throw new ServiceUnavailableException(
        'Payments are not configured. Set DODO_PAYMENTS_API_KEY and DODO_IDEA_BID_PRODUCT_ID.'
      );
    }

    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const appUrl = process.env.WEB_ORIGIN?.split(',')[0] || 'http://localhost:8080';

    const response = await fetch(`${this.base}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: d.bid }],
        customer: { email: user.email, name: user.name },
        return_url: `${appUrl}/?checkout=success`,
        metadata: { ideaBidId: bid.id, ideaId },
      }),
    });

    const checkout = (await response.json()) as {
      session_id?: string;
      checkout_url?: string;
      message?: string;
    };

    if (!response.ok || !checkout.session_id || !checkout.checkout_url) {
      await this.db.ideaBid.update({
        where: { id: bid.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException(
        checkout.message || 'Dodo could not create a checkout session'
      );
    }

    await this.db.ideaBid.update({
      where: { id: bid.id },
      data: { dodoSessionId: checkout.session_id },
    });

    return { checkoutUrl: checkout.checkout_url, sessionId: checkout.session_id };
  }

  async webhook(raw: Buffer | undefined, h: Record<string, string | undefined>) {
    const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY,
      id = h['webhook-id'],
      ts = h['webhook-timestamp'],
      sig = h['webhook-signature'];

    if (!raw || !secret || !id || !ts || !sig)
      throw new UnauthorizedException('Invalid webhook request');

    const expected = createHmac('sha256', secret)
      .update(`${id}.${ts}.${raw.toString('utf8')}`)
      .digest('base64');

    const valid = sig
      .split(' ')
      .map((x) => x.replace(/^v1,/, ''))
      .some((x) => {
        try {
          return timingSafeEqual(Buffer.from(x), Buffer.from(expected));
        } catch {
          return false;
        }
      });

    if (!valid) throw new UnauthorizedException('Invalid webhook signature');

    if (await this.db.paymentWebhookEvent.findUnique({ where: { id } }))
      return { received: true, duplicate: true };

    const event = JSON.parse(raw.toString()) as {
      type?: string;
      data?: {
        metadata?: { ideaBidId?: string; ideaId?: string };
        payment_id?: string;
        paymentId?: string;
      };
    };

    await this.db.paymentWebhookEvent.create({
      data: { id, type: event.type || 'unknown' },
    });

    const successEvents = new Set(['payment.succeeded', 'payment.completed']);
    const ideaBidId = event.data?.metadata?.ideaBidId;
    const paymentId = event.data?.payment_id || event.data?.paymentId;
    if (successEvents.has(event.type || '') && ideaBidId) {
      const paid = await this.db.ideaBid.update({
        where: { id: ideaBidId },
        data: { status: 'PAID', ...(paymentId ? { dodoPaymentId: paymentId } : {}) },
      });
      await this.db.idea.update({
        where: { id: paid.ideaId },
        data: { status: 'PUBLISHED', currentBidCents: paid.amountCents },
      });
    }

    return { received: true };
  }
}

@ApiTags('payments')
@Controller('v1/payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('idea-checkout')
  checkout(@Req() req: any, @Body() dto: CreateCheckoutDto) {
    return this.payments.ideaCheckout(req.user.sub, dto);
  }

  @Post('dodo/webhook')
  webhook(
    @Req() req: any,
    @Headers() headers: Record<string, string | undefined>
  ) {
    return this.payments.webhook(req.rawBody, headers);
  }
}
