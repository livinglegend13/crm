ALTER TABLE "emailFollowUp" ALTER COLUMN "relevance" SET DEFAULT 'UNASSESSED';
UPDATE "emailFollowUp" SET "relevance" = 'UNASSESSED' WHERE "relevance" = 'RELEVANT';
