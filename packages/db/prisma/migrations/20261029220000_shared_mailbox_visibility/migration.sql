ALTER TABLE "emailMessage" ADD COLUMN "mailboxAddress" TEXT;

UPDATE "emailMessage"
SET "mailboxAddress" = lower("fromEmail")
WHERE lower("fromEmail") LIKE '%@mailx.terraeagle.com'
   OR lower("fromEmail") LIKE '%@maily.terraeagle.com';

UPDATE "emailMessage" AS message
SET "mailboxAddress" = (
  SELECT lower(recipient.value->>'email') AS address
  FROM jsonb_array_elements(message.recipients::jsonb) AS recipient(value)
  WHERE lower(recipient.value->>'email') LIKE '%@mailx.terraeagle.com'
     OR lower(recipient.value->>'email') LIKE '%@maily.terraeagle.com'
  LIMIT 1
)
WHERE message."mailboxAddress" IS NULL;

CREATE INDEX "emailMessage_mailboxAddress_idx" ON "emailMessage"("mailboxAddress");
