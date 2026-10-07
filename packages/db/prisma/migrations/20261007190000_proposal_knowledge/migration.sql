CREATE TYPE "ProposalKnowledgeStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');
ALTER TABLE "gtmCampaign" ADD COLUMN "workflowAgentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "proposalKnowledge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceLine" "GtmServiceLine" NOT NULL,
    "sourceFileName" TEXT,
    "content" TEXT NOT NULL,
    "status" "ProposalKnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "proposalKnowledge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proposalKnowledge_status_serviceLine_approvedAt_idx" ON "proposalKnowledge"("status", "serviceLine", "approvedAt");

ALTER TABLE "proposalKnowledge" ADD CONSTRAINT "proposalKnowledge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proposalKnowledge" ADD CONSTRAINT "proposalKnowledge_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
