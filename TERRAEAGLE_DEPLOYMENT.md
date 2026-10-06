# Terraeagle CRM deployment

## Access

- CRM: https://crm.terraeagle.com
- API health: https://api.crm.terraeagle.com/health
- Sign-in: Terraeagle Microsoft 365 accounts.
- Reporting currency: INR.
- Company research: Context free tier.
- Agent model: `content-engine-gpt-5-mini` on Azure OpenAI.

## Azure

- Resource group: `rg-terraeagle-crm-prod`.
- VM: `vm-terraeagle-crm-prod`, `Standard_B2ms`, in Central India.
- Public IP: `20.198.76.27`.
- Backup vault: `rsv-terraeagle-crm-prod`.
- Backup policy: `DefaultPolicy` with daily VM backups and 30-day retention.
- Backup storage: locally redundant.
- First recovery point: `1430923428010069`, completed on 6 October 2026.
- Inbound network rules allow ports 80 and 443. SSH and PostgreSQL are closed.

## VM services

- Checkout: `/opt/terraeagle-crm`.
- Environment: `/opt/terraeagle-crm/.env`, readable only by the VM administrator.
- PostgreSQL: Docker container `terraeagle-crm-postgres`, bound to loopback.
- API: `terraeagle-crm-api.service` on loopback port 3001.
- App: `terraeagle-crm-app.service` on loopback port 3000.
- Agent: `terraeagle-crm-agent.service` on loopback port 2000.
- HTTPS: `caddy.service`.
- Scheduled jobs: `/etc/cron.d/terraeagle-crm`.
- Database dumps: `/etc/cron.d/terraeagle-crm-backup`.
- Local dumps: `/var/backups/terraeagle-crm`.

## Checks

Use Azure VM Run Command to access the VM. The network security group closes SSH.

```sh
systemctl is-active terraeagle-crm-api terraeagle-crm-app terraeagle-crm-agent caddy cron
curl -fsS http://127.0.0.1:3001/health
for dump in /var/backups/terraeagle-crm/*.dump; do pg_restore -l "$dump" > /dev/null || exit 1; done
```

The mailbox job checks Microsoft 365 every five minutes. The rates job runs daily.
Tracking retention and archive pruning also run daily. PostgreSQL dumps run daily.

## Sales setup

The workspace website is `https://terraeagle.com`. The first mailbox is connected.
The CRM starts with no prospect companies, contacts, or deals.
Use deal names that begin with `Cybersecurity`, `AI`, or `FinOps` until the CRM has a service field.
Invite each rep through Members. Each rep connects their Microsoft 365 mailbox.
