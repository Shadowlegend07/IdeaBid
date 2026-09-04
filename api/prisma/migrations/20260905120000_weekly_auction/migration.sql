CREATE TABLE "WeeklyEntry" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "weekStartDate" TIMESTAMP(3) NOT NULL,
  "weekEndDate" TIMESTAMP(3) NOT NULL,
  "bidTotalCents" INTEGER NOT NULL DEFAULT 0,
  "upvotesThisWeek" INTEGER NOT NULL DEFAULT 0,
  "investorClicksThisWeek" INTEGER NOT NULL DEFAULT 0,
  "momentumScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rankInCategory" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeeklyHistory" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "weekStartDate" TIMESTAMP(3) NOT NULL,
  "weekEndDate" TIMESTAMP(3) NOT NULL,
  "finalRank" INTEGER,
  "finalBidTotalCents" INTEGER NOT NULL,
  "finalUpvotes" INTEGER NOT NULL,
  "finalInvestorClicks" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyEntry_ideaId_weekStartDate_key" ON "WeeklyEntry"("ideaId", "weekStartDate");
CREATE INDEX "WeeklyEntry_weekStartDate_momentumScore_idx" ON "WeeklyEntry"("weekStartDate", "momentumScore");
CREATE UNIQUE INDEX "WeeklyHistory_ideaId_weekStartDate_key" ON "WeeklyHistory"("ideaId", "weekStartDate");
CREATE INDEX "WeeklyHistory_weekStartDate_idx" ON "WeeklyHistory"("weekStartDate");

ALTER TABLE "WeeklyEntry" ADD CONSTRAINT "WeeklyEntry_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyHistory" ADD CONSTRAINT "WeeklyHistory_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
