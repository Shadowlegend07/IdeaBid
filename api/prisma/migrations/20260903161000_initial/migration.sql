CREATE TYPE "Role" AS ENUM ('USER', 'CREATOR', 'MODERATOR', 'ADMIN');
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'FOLLOWERS', 'PRIVATE', 'PREMIUM');
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'REMOVED');
CREATE TYPE "CreationType" AS ENUM ('AUDIO', 'TEXT');
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'CREATOR', 'PRO');
CREATE TYPE "IdeaStatus" AS ENUM ('PENDING_PAYMENT', 'PUBLISHED', 'ARCHIVED', 'REMOVED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "avatarUrl" TEXT,
  "bio" TEXT,
  "preferredGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "preferredCreationType" "CreationType",
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Story" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "audioUrl" TEXT,
  "coverUrl" TEXT,
  "summary" TEXT,
  "tags" TEXT[],
  "genre" TEXT,
  "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
  "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
  "premium" BOOLEAN NOT NULL DEFAULT false,
  "creationType" "CreationType" NOT NULL DEFAULT 'TEXT',
  "durationSeconds" INTEGER,
  "refinementStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "readCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Follow" (
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId", "followingId")
);

CREATE TABLE "Like" (
  "userId" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  CONSTRAINT "Like_pkey" PRIMARY KEY ("userId", "storyId")
);

CREATE TABLE "Bookmark" (
  "userId" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId", "storyId")
);

CREATE TABLE "Comment" (
  "id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Idea" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "mvpDetails" TEXT,
  "status" "IdeaStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "currentBidCents" INTEGER NOT NULL DEFAULT 100,
  "upvoteCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdeaUpvote" (
  "ideaId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaUpvote_pkey" PRIMARY KEY ("ideaId", "userId")
);

CREATE TABLE "IdeaBid" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "bidderId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "dodoSessionId" TEXT,
  "dodoPaymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdeaBid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "Idea_status_category_currentBidCents_idx" ON "Idea"("status", "category", "currentBidCents");
CREATE UNIQUE INDEX "IdeaBid_dodoSessionId_key" ON "IdeaBid"("dodoSessionId");
CREATE UNIQUE INDEX "IdeaBid_dodoPaymentId_key" ON "IdeaBid"("dodoPaymentId");
CREATE INDEX "IdeaBid_ideaId_status_amountCents_idx" ON "IdeaBid"("ideaId", "status", "amountCents");

ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Like" ADD CONSTRAINT "Like_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaUpvote" ADD CONSTRAINT "IdeaUpvote_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaUpvote" ADD CONSTRAINT "IdeaUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaBid" ADD CONSTRAINT "IdeaBid_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaBid" ADD CONSTRAINT "IdeaBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
