ALTER TABLE "outreachDraft" ADD COLUMN "sentConversationId" TEXT;
ALTER TABLE "outreachDraft" ADD COLUMN "sentRfcMessageId" TEXT;
CREATE INDEX "outreachDraft_senderEmail_sentConversationId_idx" ON "outreachDraft"("senderEmail", "sentConversationId");
CREATE INDEX "outreachDraft_senderEmail_sentRfcMessageId_idx" ON "outreachDraft"("senderEmail", "sentRfcMessageId");
