CREATE TYPE "FiloProspectDecision" AS ENUM ('EVIDENCE_NEEDED', 'MEETS_GATE', 'BELOW_GATE');
CREATE TYPE "GtmCampaignStatus" AS ENUM ('DRAFT', 'READY', 'PAUSED');

CREATE TABLE "filoProspectReview" (
    "companyId" TEXT NOT NULL,
    "decision" "FiloProspectDecision" NOT NULL DEFAULT 'EVIDENCE_NEEDED',
    "averageCapacityPb" DOUBLE PRECISION,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "evidenceSource" TEXT,
    "evidenceNote" TEXT,
    "buyerContactId" TEXT,
    "reviewedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "filoProspectReview_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE "gtmCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "GtmCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "marketCountryCode" TEXT NOT NULL DEFAULT 'IN',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "sendDays" INTEGER[] DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
    "startMinute" INTEGER NOT NULL DEFAULT 540,
    "endMinute" INTEGER NOT NULL DEFAULT 1020,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gtmCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gtmCampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "subjectPrompt" TEXT NOT NULL,
    "bodyPrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gtmCampaignStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gtmCampaignTarget" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gtmCampaignTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "filoProspectReview_decision_updatedAt_idx" ON "filoProspectReview"("decision", "updatedAt");
CREATE INDEX "gtmCampaign_ownerId_createdAt_idx" ON "gtmCampaign"("ownerId", "createdAt");
CREATE UNIQUE INDEX "gtmCampaignStep_campaignId_position_key" ON "gtmCampaignStep"("campaignId", "position");
CREATE UNIQUE INDEX "gtmCampaignTarget_campaignId_companyId_key" ON "gtmCampaignTarget"("campaignId", "companyId");
CREATE INDEX "gtmCampaignTarget_companyId_idx" ON "gtmCampaignTarget"("companyId");

ALTER TABLE "filoProspectReview" ADD CONSTRAINT "filoProspectReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "filoProspectReview" ADD CONSTRAINT "filoProspectReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gtmCampaign" ADD CONSTRAINT "gtmCampaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gtmCampaignStep" ADD CONSTRAINT "gtmCampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "gtmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gtmCampaignTarget" ADD CONSTRAINT "gtmCampaignTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "gtmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gtmCampaignTarget" ADD CONSTRAINT "gtmCampaignTarget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gtmCampaignTarget" ADD CONSTRAINT "gtmCampaignTarget_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
