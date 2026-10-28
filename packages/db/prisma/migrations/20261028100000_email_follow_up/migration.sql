CREATE TABLE "emailFollowUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "assessedMessageId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceQuote" TEXT,
    "dueAt" TIMESTAMP(3),
    "dueSource" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "emailFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "emailFollowUp_userId_threadId_key" ON "emailFollowUp"("userId","threadId");
CREATE INDEX "emailFollowUp_userId_owner_dueAt_idx" ON "emailFollowUp"("userId","owner","dueAt");
ALTER TABLE "emailFollowUp" ADD CONSTRAINT "emailFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emailFollowUp" ADD CONSTRAINT "emailFollowUp_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "emailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
