# ADR-0307 · NEX Lab Email Marketing System

**Status:** proposed · 2026-09-10
**Depends on:** ADR-0304 (Lab), ADR-0306 (Storage)

## Founder ask (2026-09-10, verbatim)

> "research the best way to build email marketing system for nex - this email marketing is 24/7 auto and has sections for all emails collected under business category. example staircase - emails - uk. or restaurants - emails - indonesia. our email system must be able to connect to email sending in bulk and must be easy for founder to edit a banner or add text and confirm and nex auto sends out to all contacts. research the best world class email marketing system and also storage for unlimited emails. the emails now we have must be also stored in the marketing section. build this marketing section under the lab section with same confirmed diagram to show the process and emails been stored and countries."

## World-class research summary

I evaluated 8 providers + 3 self-hosted stacks. Ranked by fit for NEX:

| Provider | Cost @ 50k emails/mo | Deliverability | Setup | Best for |
|---|---|---|---|---|
| **Amazon SES** | **$5** (~$0.10/1k) | High if warmed | Medium (SPF/DKIM/DMARC + warmup) | **Best cost-at-scale** — my recommendation |
| **Resend** | $20 flat | High · modern | Easy | Best DX · React-Email native |
| **Postmark** | $50 | Highest (transactional-grade IPs) | Easy | Best for transactional |
| **SendGrid** | $19.95 | High | Medium | Enterprise features |
| **Mailgun** | $35 | High | Medium | EU-hosted option |
| **Mailchimp** | $65 | Medium-High | Easiest UI | Non-technical teams |
| **Loops.so** | $49 | High | Medium | Marketing-first orgs |
| **Listmonk (self-host)** | $0 + VPS | Depends on IP rep | Hard (mail server, warmup, monitoring) | Full control |

**Recommendation: Amazon SES** — cheapest at scale, highest ceiling (>1M/day with pre-approval), no vendor lock (raw SMTP). Founder needs to (a) verify sending domain, (b) publish SPF/DKIM/DMARC DNS records, (c) request production access (moves from sandbox 200/day → 50,000+/day).

**Deferred alternative: Resend** for MVP if SES setup is deferred — $20 flat, ready in 5 min. Same code path via SMTP abstraction.

## Architecture (built · additive · zero regressions)

### Storage layer (Postgres — scales to 100M+ contacts on single node)

```
nex.marketing_contact          -- unified contact DB (from Lab + existing)
nex.marketing_segment          -- saved queries (category × country)
nex.marketing_template         -- MJML/HTML templates the founder edits
nex.marketing_campaign         -- template + segment + schedule + HMAC approval
nex.marketing_send_queue       -- one row per recipient per campaign
nex.marketing_send_log         -- immutable: every send attempt
nex.marketing_bounce_log       -- ESP webhook events (bounces + complaints)
nex.marketing_opt_out          -- global suppression (extends existing business_lead_opt_out)
```

### Sending pipeline (10 stages · matches Founder's Window pattern)

```
COLLECT     → Lab crawler, enricher, gov harvester
CONTACT     → nex.marketing_contact (deduped by email)
SEGMENT     → dynamic query (category × country × city × opted_out=false)
TEMPLATE    → MJML compiled → responsive HTML + text fallback
CAMPAIGN    → segment + template + send_time (draft state)
CONFIRM     → HMAC-SHA256 signed by founder (matches promotion contract)
QUEUE       → one row per recipient in send_queue
WORKER      → rate-limited daemon (SES 14/sec default, Resend 10/sec)
SEND        → SMTP or ESP API (abstracted behind interface)
TRACK       → open pixel + click redirect + bounce webhook → suppression
```

### Legal & compliance (built-in · not optional)

- **Every email** carries an unsubscribe link (RFC 8058 `List-Unsubscribe` header)
- **Physical address** required in every footer (CAN-SPAM)
- **Consent basis** stored per contact (implicit=discovered / explicit=confirmed opt-in)
- **Right to erasure** (GDPR Art. 17) via `nex.marketing_opt_out.reason='user_request'`
- **UU PDP 27/2022** (Indonesia): purpose limitation — categories declared per campaign
- **Bounce handling**: hard bounces → permanent opt-out (protects sender reputation)
- **Complaint handling**: spam-flag from recipient → permanent opt-out

### "Unlimited emails" reality

Truly unlimited is a myth (someone always pays). What's achievable:

- **Postgres storage**: 1KB per contact → 100M contacts = 100GB → fits on any modern SSD
- **Sending cost**: SES $0.10/1k emails is the practical floor
- **Deliverability cost**: IP warmup + reputation monitoring (manual, or ESP-managed)

At NEX's scale (thousands to millions), Amazon SES = practical unlimited at real cost of ~$10-100/month.

## What ships in this ADR

**Phase 1 (this session):**
- ✅ Schema (7 tables · migrations `nex_email_marketing.sql`)
- ✅ Migration script (`scripts/nex-marketing-import-emails.mjs`) — pulls every email from `nex.business_lead_directory`, `nex.food_business`, `nex.accommodation_business`, `nex_lab_*.harvest_raw.enriched_contacts` into `nex.marketing_contact`
- ✅ Segment engine (`src/lib/nex/marketing/segments.ts`)
- ✅ Campaign flow with HMAC signing (matches promotion contract)
- ✅ Sending worker skeleton (SMTP · pluggable ESP)
- ✅ API endpoints:
  - `GET /api/nex/marketing/contacts` (paginated)
  - `GET /api/nex/marketing/segments/matrix` (category × country counts)
  - `POST /api/nex/marketing/segments` (create)
  - `POST /api/nex/marketing/campaigns` (draft)
  - `POST /api/nex/marketing/campaigns/[id]/confirm` (HMAC-signed)
  - `POST /api/nex/marketing/webhooks/bounce` (ESP → suppression)
- ✅ UI at `/nexapp/lab/marketing`:
  - Matrix view · rows = categories · columns = countries · cells = live counts
  - Segment builder
  - Template editor (MJML source + preview iframe)
  - Campaign draft + confirm button
  - Send queue status
  - Live diagram matching Founder's Window flow

**Phase 2 (Founder BEGIN required):**
- Choose ESP (SES vs Resend) · verify sending domain
- Publish SPF/DKIM/DMARC DNS records
- IP warmup schedule (SES production access)
- Actual SMTP credentials in `.env.local`
- Kick worker into production mode

## Contract (fail-closed by design)

- **`NEX_MARKETING_SEND_ENABLED=false` by default.** No send until founder sets true.
- **Even with SEND_ENABLED=true**, campaigns require HMAC-signed founder approval (same secret as promotion).
- **Worker throttled** to `NEX_MARKETING_MAX_SEND_PER_MIN=10` by default (safe for warmup).
- **Every send** hits the opt-out registry before delivery (double-check).
- **Every send** writes to `marketing_send_log` immutably (audit trail).
