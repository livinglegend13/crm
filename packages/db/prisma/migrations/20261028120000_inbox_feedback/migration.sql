ALTER TABLE "emailFollowUp" ADD COLUMN "relevance" TEXT NOT NULL DEFAULT 'RELEVANT';

CREATE TABLE "emailThreadFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "emailThreadFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "emailThreadFeedback_userId_threadId_key" ON "emailThreadFeedback"("userId","threadId");
CREATE INDEX "emailThreadFeedback_userId_senderEmail_label_idx" ON "emailThreadFeedback"("userId","senderEmail","label");
ALTER TABLE "emailThreadFeedback" ADD CONSTRAINT "emailThreadFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emailThreadFeedback" ADD CONSTRAINT "emailThreadFeedback_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "emailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
