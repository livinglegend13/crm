ALTER TYPE "OutreachDraftStatus" ADD VALUE 'BOUNCED';
ALTER TABLE "emailMessage" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'SENT';
CREATE INDEX "emailMessage_syncedByUserId_mailboxAddress_direction_sentAt_idx" ON "emailMessage"("syncedByUserId", "mailboxAddress", "direction", "sentAt");
