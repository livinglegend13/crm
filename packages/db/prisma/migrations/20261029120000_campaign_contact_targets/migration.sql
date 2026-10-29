DROP INDEX IF EXISTS "gtmCampaignTarget_campaignId_companyId_key";
CREATE UNIQUE INDEX "gtmCampaignTarget_campaignId_contactId_key" ON "gtmCampaignTarget"("campaignId", "contactId");
CREATE UNIQUE INDEX "gtmCampaignTarget_campaignId_companyId_unassigned_key" ON "gtmCampaignTarget"("campaignId", "companyId") WHERE "contactId" IS NULL;
ALTER TABLE "businessCardCapture" ADD COLUMN "matchCandidates" JSONB NOT NULL DEFAULT '[]';
INSERT INTO "gtmCampaignTarget" ("id", "campaignId", "companyId", "contactId", "createdAt")
SELECT 'bcc_' || md5(c."campaignId" || ':' || c."contactId"), c."campaignId", p."companyId", c."contactId", MIN(c."createdAt")
FROM "businessCardCapture" c
JOIN "contact" p ON p."id" = c."contactId"
WHERE c."campaignId" IS NOT NULL AND c."contactId" IS NOT NULL AND p."companyId" IS NOT NULL
GROUP BY c."campaignId", c."contactId", p."companyId"
ON CONFLICT DO NOTHING;
