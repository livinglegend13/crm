ALTER TYPE "GtmServiceLine" ADD VALUE IF NOT EXISTS 'CUSTOM';

CREATE TABLE "gtmService" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "qualificationGuidance" TEXT NOT NULL DEFAULT '',
    "marketCountryCodes" TEXT[] NOT NULL DEFAULT ARRAY['IN']::TEXT[],
    "legacyLine" "GtmServiceLine",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gtmService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gtmService_slug_key" ON "gtmService"("slug");

ALTER TABLE "gtmCampaign" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "gtmCampaign" ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "proposalKnowledge" ADD COLUMN "serviceId" TEXT;

INSERT INTO "gtmService" ("id", "slug", "name", "description", "qualificationGuidance", "marketCountryCodes", "legacyLine") VALUES
('terraeagle-filo-storage', 'filo-storage', 'Filo storage', 'Storage optimization through Filo.', 'Verify average stored capacity of at least 1 PB across a defined 12-month period.', ARRAY['IN']::TEXT[], 'FILO_STORAGE'),
('terraeagle-finops', 'finops', 'FinOps', 'Cloud financial operations services.', 'Verify cloud spend, cost ownership, billing access, and optimization goals.', ARRAY['IN']::TEXT[], 'FINOPS'),
('terraeagle-ai', 'ai', 'AI services', 'AI advisory and implementation services.', 'Verify the business use case, data readiness, decision owner, and governance requirements.', ARRAY['IN']::TEXT[], 'AI'),
('terraeagle-cybersecurity', 'cybersecurity', 'Cybersecurity', 'Cybersecurity advisory and delivery services.', 'Verify the security need, existing controls, decision owner, and target timeline.', ARRAY['IN']::TEXT[], 'CYBERSECURITY'),
('terraeagle-vapt', 'vapt', 'VAPT', 'Vulnerability assessment and penetration testing.', 'Verify assessment scope, asset ownership, authorization, and required delivery date.', ARRAY['IN']::TEXT[], NULL),
('terraeagle-soc', 'soc', 'SOC', 'Security operations center services.', 'Verify monitoring scope, current coverage, alert volume, and response ownership.', ARRAY['IN']::TEXT[], NULL),
('terraeagle-red-teaming', 'red-teaming', 'Red Teaming', 'Adversary simulation and security exercises.', 'Verify goals, authorized scope, stakeholders, and rules of engagement.', ARRAY['IN']::TEXT[], NULL),
('terraeagle-dfir', 'dfir', 'DFIR', 'Digital forensics and incident response.', 'Verify response need, incident status, authorization, and evidence preservation requirements.', ARRAY['IN']::TEXT[], NULL),
('terraeagle-tabletop', 'tabletop-exercises', 'Tabletop exercises', 'Scenario-based incident response exercises.', 'Verify participants, scenario goals, current response plan, and desired outcomes.', ARRAY['IN']::TEXT[], NULL);

UPDATE "gtmCampaign" SET "serviceId" = CASE "serviceLine"
    WHEN 'FILO_STORAGE' THEN 'terraeagle-filo-storage'
    WHEN 'FINOPS' THEN 'terraeagle-finops'
    WHEN 'AI' THEN 'terraeagle-ai'
    WHEN 'CYBERSECURITY' THEN 'terraeagle-cybersecurity'
    ELSE NULL END;

UPDATE "proposalKnowledge" SET "serviceId" = CASE "serviceLine"
    WHEN 'FILO_STORAGE' THEN 'terraeagle-filo-storage'
    WHEN 'FINOPS' THEN 'terraeagle-finops'
    WHEN 'AI' THEN 'terraeagle-ai'
    WHEN 'CYBERSECURITY' THEN 'terraeagle-cybersecurity'
    ELSE NULL END;

CREATE INDEX "gtmCampaign_serviceId_marketCountryCode_idx" ON "gtmCampaign"("serviceId", "marketCountryCode");
ALTER TABLE "gtmCampaign" ADD CONSTRAINT "gtmCampaign_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "gtmService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proposalKnowledge" ADD CONSTRAINT "proposalKnowledge_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "gtmService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
