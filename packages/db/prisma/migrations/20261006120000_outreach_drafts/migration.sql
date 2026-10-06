CREATE TABLE "outreachDraft" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreachDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outreachDraft_runId_userId_key" ON "outreachDraft"("runId","userId");
CREATE INDEX "outreachDraft_userId_updatedAt_idx" ON "outreachDraft"("userId","updatedAt");

ALTER TABLE "outreachDraft" ADD CONSTRAINT "outreachDraft_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outreachDraft" ADD CONSTRAINT "outreachDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
