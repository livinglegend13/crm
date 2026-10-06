ALTER TYPE "OutreachDraftStatus" ADD VALUE 'SENDING';
ALTER TYPE "OutreachDraftStatus" ADD VALUE 'SENT';
ALTER TYPE "OutreachDraftStatus" ADD VALUE 'SEND_UNKNOWN';

ALTER TABLE "outreachDraft"
ADD COLUMN "senderEmail" TEXT,
ADD COLUMN "sendStartedAt" TIMESTAMP(3),
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "sendError" TEXT;
