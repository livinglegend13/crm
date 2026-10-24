ALTER TABLE "gtmCampaign" ADD COLUMN "closelyCampaignName" TEXT;
ALTER TABLE "gtmCampaign" ADD COLUMN "linkedinSequence" JSONB NOT NULL DEFAULT '[]';
