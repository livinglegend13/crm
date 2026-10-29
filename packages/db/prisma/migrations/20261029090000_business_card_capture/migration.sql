CREATE TABLE "businessCardCapture" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT,
    "userId" TEXT NOT NULL,
    "extraction" JSONB NOT NULL,
    "meetingNote" TEXT,
    "recentlyMet" BOOLEAN NOT NULL DEFAULT false,
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'REVIEW',
    "contactId" TEXT,
    "campaignId" TEXT,
    "senderEmail" TEXT,
    "recipientEmail" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "sendStartedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "businessCardCapture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "businessCardCapture_submissionId_key" ON "businessCardCapture"("submissionId");
CREATE INDEX "businessCardCapture_userId_createdAt_idx" ON "businessCardCapture"("userId", "createdAt");
CREATE INDEX "businessCardCapture_status_createdAt_idx" ON "businessCardCapture"("status", "createdAt");

ALTER TABLE "businessCardCapture" ADD CONSTRAINT "businessCardCapture_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "agentConversationSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "businessCardCapture" ADD CONSTRAINT "businessCardCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "businessCardCapture" ADD CONSTRAINT "businessCardCapture_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "businessCardCapture" ADD CONSTRAINT "businessCardCapture_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "gtmCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
