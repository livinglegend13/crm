CREATE TABLE "closelyEvent" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "email" TEXT,
    "linkedinUrl" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "campaignNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "contactId" TEXT,
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "closelyEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "closelyEvent_fingerprint_key" ON "closelyEvent"("fingerprint");
CREATE INDEX "closelyEvent_receivedAt_idx" ON "closelyEvent"("receivedAt");
CREATE INDEX "closelyEvent_contactId_receivedAt_idx" ON "closelyEvent"("contactId", "receivedAt");
ALTER TABLE "closelyEvent" ADD CONSTRAINT "closelyEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "emailVerification" (
    "contactId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" INTEGER,
    "safe" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emailVerification_pkey" PRIMARY KEY ("contactId")
);

CREATE INDEX "emailVerification_email_checkedAt_idx" ON "emailVerification"("email", "checkedAt");
ALTER TABLE "emailVerification" ADD CONSTRAINT "emailVerification_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appSetting" ADD COLUMN "closelyEmailEnabled" BOOLEAN NOT NULL DEFAULT false;
