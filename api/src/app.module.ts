import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthController, AuthService, JwtAuthGuard } from './auth';
import { StoriesController, StoriesService } from './stories';
import { ProfileController, ProfileService } from './profile';
import { AuctionCronController, IdeasController, IdeasService, PaymentsController, PaymentsService } from './ideas';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({})],
  controllers: [AuthController, StoriesController, ProfileController, IdeasController, PaymentsController, AuctionCronController],
  providers: [PrismaService, AuthService, ProfileService, StoriesService, JwtAuthGuard, IdeasService, PaymentsService],
})
export class AppModule {}

