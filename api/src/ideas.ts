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

function getWeekStart(value = new Date()) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date;
}

function getWeekEnd(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return weekEnd;
}

function momentumScore(bidTotalCents: number, upvotes: number, clicks: number, maxBid: number, maxUpvotes: number, maxClicks: number) {
  return (maxBid ? bidTotalCents / maxBid : 0) * 0.5
    + (maxUpvotes ? upvotes / maxUpvotes : 0) * 0.25
    + (maxClicks ? clicks / maxClicks : 0) * 0.25;
}

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

  private async ensureWeeklyEntry(ideaId: string, weekStart = getWeekStart()) {
    return this.db.weeklyEntry.upsert({
      where: { ideaId_weekStartDate: { ideaId, weekStartDate: weekStart } },
      create: { ideaId, weekStartDate: weekStart, weekEndDate: getWeekEnd(weekStart) },
      update: {},
    });
  }

  private include = {
    author: { select: { name: true, username: true, avatarUrl: true } },
    _count: { select: { upvotes: true } },
  };

  async list(page = 1, pageSize = 10, category?: string, sort = 'top') {
    const safePage = Math.max(1, Number.isFinite(page) ? page : 1),
      safePageSize = Math.min(Math.max(1, Number.isFinite(pageSize) ? pageSize : 10), 50);
    const where = { status: 'PUBLISHED' as const, ...(category ? { category } : {}) };
    const weekStart = getWeekStart();
    const [allIdeas, total] = await this.db.$transaction([
      this.db.idea.findMany({
        where,
        include: { ...this.include, weeklyEntries: { where: { weekStartDate: weekStart } } },
      }),
      this.db.idea.count({ where }),
    ]);
    const maxByCategory = new Map<string, { bid: number; upvotes: number; clicks: number }>();
    for (const idea of allIdeas) {
      const entry = idea.weeklyEntries[0];
      const current = maxByCategory.get(idea.category) || { bid: 0, upvotes: 0, clicks: 0 };
      current.bid = Math.max(current.bid, entry?.bidTotalCents || idea.currentBidCents);
      current.upvotes = Math.max(current.upvotes, entry?.upvotesThisWeek || idea.upvoteCount);
      current.clicks = Math.max(current.clicks, entry?.investorClicksThisWeek || 0);
      maxByCategory.set(idea.category, current);
    }
    const ranked = allIdeas.map((idea) => {
      const entry = idea.weeklyEntries[0];
      const max = maxByCategory.get(idea.category)!;
      const score = momentumScore(entry?.bidTotalCents || idea.currentBidCents, entry?.upvotesThisWeek || idea.upvoteCount, entry?.investorClicksThisWeek || 0, max.bid, max.upvotes, max.clicks);
      return { ...idea, weeklyMomentumScore: score };
    }).sort((left, right) => {
      if (sort === 'recent') return right.createdAt.getTime() - left.createdAt.getTime();
      if (sort === 'upvoted') return (right.weeklyEntries[0]?.upvotesThisWeek || 0) - (left.weeklyEntries[0]?.upvotesThisWeek || 0);
      return right.weeklyMomentumScore - left.weeklyMomentumScore;
    });
    const data = ranked.slice((safePage - 1) * safePageSize, safePage * safePageSize);
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
        currentBidCents: 0,
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
      const weekStart = getWeekStart();
      await this.ensureWeeklyEntry(id, weekStart);
      await this.db.$transaction([
        this.db.ideaUpvote.create({ data: { ideaId: id, userId } }),
        this.db.idea.update({
          where: { id },
          data: { upvoteCount: { increment: 1 } },
        }),
        this.db.weeklyEntry.update({
          where: { ideaId_weekStartDate: { ideaId: id, weekStartDate: weekStart } },
          data: { upvotesThisWeek: { increment: 1 } },
        }),
      ]);
      return { upvoted: true };
    } catch {
      return { upvoted: false };
    }
  }

  async resetWeeklyAuction() {
    const weekStart = getWeekStart();
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
    const nextWeekEnd = getWeekEnd(nextWeekStart);
    const ideas = await this.db.idea.findMany({
      where: { status: 'PUBLISHED' },
      include: { weeklyEntries: { where: { weekStartDate: weekStart } } },
    });
    const maxByCategory = new Map<string, { bid: number; upvotes: number; clicks: number }>();
    for (const idea of ideas) {
      const entry = idea.weeklyEntries[0];
      const max = maxByCategory.get(idea.category) || { bid: 0, upvotes: 0, clicks: 0 };
      max.bid = Math.max(max.bid, entry?.bidTotalCents || 0);
      max.upvotes = Math.max(max.upvotes, entry?.upvotesThisWeek || 0);
      max.clicks = Math.max(max.clicks, entry?.investorClicksThisWeek || 0);
      maxByCategory.set(idea.category, max);
    }
    const ranked = ideas.map((idea) => {
      const entry = idea.weeklyEntries[0];
      const max = maxByCategory.get(idea.category)!;
      return { idea, entry, score: momentumScore(entry?.bidTotalCents || 0, entry?.upvotesThisWeek || 0, entry?.investorClicksThisWeek || 0, max.bid, max.upvotes, max.clicks) };
    }).sort((left, right) => right.score - left.score);
    const categoryRanks = new Map<string, number>();
    const ranks = new Map<string, number>();
    for (const item of ranked) {
      const rank = (categoryRanks.get(item.idea.category) || 0) + 1;
      categoryRanks.set(item.idea.category, rank);
      ranks.set(`${item.idea.category}:${item.idea.id}`, rank);
    }
    await this.db.$transaction(async (tx) => {
      for (const item of ranked) {
        if (item.entry) {
          await tx.weeklyHistory.upsert({
            where: { ideaId_weekStartDate: { ideaId: item.idea.id, weekStartDate: weekStart } },
            create: {
              ideaId: item.idea.id,
              weekStartDate: weekStart,
              weekEndDate: getWeekEnd(weekStart),
              finalRank: ranks.get(`${item.idea.category}:${item.idea.id}`),
              finalBidTotalCents: item.entry.bidTotalCents,
              finalUpvotes: item.entry.upvotesThisWeek,
              finalInvestorClicks: item.entry.investorClicksThisWeek,
            },
            update: {},
          });
        }
        await tx.weeklyEntry.upsert({
          where: { ideaId_weekStartDate: { ideaId: item.idea.id, weekStartDate: nextWeekStart } },
          create: { ideaId: item.idea.id, weekStartDate: nextWeekStart, weekEndDate: nextWeekEnd },
          update: {},
        });
      }
    });
    return { reset: true, archivedWeek: weekStart.toISOString(), nextWeek: nextWeekStart.toISOString(), ideas: ranked.length };
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
    const weekStart = getWeekStart();
    let ideaId = d.ideaId;

    if (!ideaId) {
      const idea = await this.db.idea.create({
        data: {
          authorId: userId,
          title: d.title,
          description: d.description,
          category: d.category,
          mvpDetails: d.mvp,
          currentBidCents: 0,
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
    await this.db.weeklyEntry.upsert({
      where: { ideaId_weekStartDate: { ideaId, weekStartDate: weekStart } },
      create: { ideaId, weekStartDate: weekStart, weekEndDate: getWeekEnd(weekStart) },
      update: {},
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
        metadata: {
          ideaBidId: bid.id,
          ideaId,
          userId,
          weekStartDate: weekStart.toISOString(),
          idea_id: ideaId,
          user_id: userId,
          week_start_date: weekStart.toISOString(),
        },
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
      metadata?: { ideaBidId?: string; ideaId?: string; idea_id?: string; weekStartDate?: string; week_start_date?: string };
      data?: {
        metadata?: { ideaBidId?: string; ideaId?: string; idea_id?: string; weekStartDate?: string; week_start_date?: string };
        payment_id?: string;
        paymentId?: string;
      };
    };

    await this.db.paymentWebhookEvent.create({
      data: { id, type: event.type || 'unknown' },
    });

    const successEvents = new Set(['payment.succeeded', 'payment.completed']);
    const metadata = event.data?.metadata || event.metadata;
    const ideaBidId = metadata?.ideaBidId;
    const paymentId = event.data?.payment_id || event.data?.paymentId;
    if (successEvents.has(event.type || '') && ideaBidId) {
      const paid = await this.db.ideaBid.update({
        where: { id: ideaBidId },
        data: { status: 'PAID', ...(paymentId ? { dodoPaymentId: paymentId } : {}) },
      });
      await this.db.idea.update({
        where: { id: paid.ideaId },
        data: { status: 'PUBLISHED', currentBidCents: { increment: paid.amountCents } },
      });
      const weekStart = metadata?.weekStartDate || metadata?.week_start_date;
      const entryStart = weekStart ? new Date(weekStart) : getWeekStart();
      await this.db.weeklyEntry.upsert({
        where: { ideaId_weekStartDate: { ideaId: paid.ideaId, weekStartDate: entryStart } },
        create: {
          ideaId: paid.ideaId,
          weekStartDate: entryStart,
          weekEndDate: getWeekEnd(entryStart),
          bidTotalCents: paid.amountCents,
        },
        update: { bidTotalCents: { increment: paid.amountCents } },
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

@Controller('v1/cron')
export class AuctionCronController {
  constructor(private ideas: IdeasService) {}

  @Post('weekly-reset')
  reset(@Headers('x-cron-secret') secret?: string) {
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET)
      throw new UnauthorizedException('Invalid cron secret');
    return this.ideas.resetWeeklyAuction();
  }
}
