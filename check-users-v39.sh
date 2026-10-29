set -eu
cd /opt/terraeagle-crm-v39-inbox-access
sudo -u crmadmin /usr/local/bin/bun - <<'JS'
import { db } from "@crm/db";
const members = await db.member.findMany({ select: { user: { select: { email: true } } } });
const accounts = await db.account.findMany({ where: { providerId: "microsoft" }, select: { userId: true } });
const byId = new Set(accounts.map((row) => row.userId));
console.log(JSON.stringify({ workspaceMembers: members.length, microsoftConnections: byId.size, memberEmails: members.map((row) => row.user.email) }));
const shared = await db.emailMessage.count({ where: { mailboxAddress: { in: ["aisha.khan@maily.terraeagle.com", "anika.sinha@mailx.terraeagle.com"] }, direction: "INBOUND" } });
console.log(JSON.stringify({ sharedInboundMessagesInSampleMailboxes: shared }));
const syncs = await db.mailboxSync.findMany({ where: { source: { startsWith: "outlook" } }, select: { user: { select: { email: true } }, source: true, status: true, lastError: true } });
console.log(JSON.stringify(syncs.map((row) => ({ email: row.user.email, source: row.source, status: row.status, error: Boolean(row.lastError) }))));
await db.$disconnect();
JS
