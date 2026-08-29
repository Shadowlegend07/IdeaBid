import { Body, Controller, Get, Injectable, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './auth';

export class ProfileCreateDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9_]{3,24}$/i) username?: string;
  @IsOptional() @IsString() @MinLength(1) bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) preferredGenres?: string[];
  @IsOptional() @IsString() preferredCreationType?: 'AUDIO' | 'TEXT';
}

@Injectable()
export class ProfileService {
  constructor(private db: PrismaService) {}

  async getMe(userId: string) {
    return this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatarUrl: true,
        preferredGenres: true,
        preferredCreationType: true,
        onboardingCompleted: true,
        subscriptionTier: true,
        bio: true,
        _count: { select: { stories: true } },
      },
    });
  }

  async createProfile(userId: string, dto: ProfileCreateDto) {
    if (!userId) throw new UnauthorizedException();

    if (dto.username) {
      const existing = await this.db.user.findFirst({
        where: {
          username: dto.username.trim(),
          NOT: { id: userId },
        },
      });

      if (existing) {
        throw new UnauthorizedException('Username is already in use');
      }
    }

    return this.db.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim() || undefined,
        username: dto.username?.trim() || undefined,
        bio: dto.bio?.trim() || null,
        avatarUrl: dto.avatarUrl || undefined,
        preferredGenres: dto.preferredGenres ?? undefined,
        preferredCreationType: dto.preferredCreationType ?? undefined,
        onboardingCompleted: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        preferredGenres: true,
        preferredCreationType: true,
        onboardingCompleted: true,
        subscriptionTier: true,
      },
    });
  }
}

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/profile')
export class ProfileController {
  constructor(private profile: ProfileService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.profile.getMe(req.user.sub);
  }

  @Post()
  create(@Req() req: any, @Body() dto: ProfileCreateDto) {
    return this.profile.createProfile(req.user.sub, dto);
  }

  @Post('me')
  updateCurrent(@Req() req: any, @Body() dto: ProfileCreateDto) {
    return this.profile.createProfile(req.user.sub, dto);
  }
}

