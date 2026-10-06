CREATE TYPE "OutreachReplyAlertStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'UNKNOWN');

CREATE TABLE "outreachReplyAlert" (
    "messageId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "OutreachReplyAlertStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outreachReplyAlert_pkey" PRIMARY KEY ("messageId")
);

CREATE INDEX "outreachReplyAlert_userId_status_createdAt_idx" ON "outreachReplyAlert"("userId", "status", "createdAt");
