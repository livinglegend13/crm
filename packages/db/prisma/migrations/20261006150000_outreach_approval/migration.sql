CREATE TYPE "OutreachDraftStatus" AS ENUM ('DRAFT', 'APPROVED');

ALTER TABLE "outreachDraft"
ADD COLUMN "status" "OutreachDraftStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "approvedAt" TIMESTAMP(3);
