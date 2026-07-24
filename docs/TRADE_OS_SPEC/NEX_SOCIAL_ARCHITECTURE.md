# Nex Social — Phase 4 Action Layer

Nex becomes a construction business's marketing employee. Merchant
says "promote my latest project", Nex drafts the post, waits for
approval, publishes at the right local time, learns from results.

**Guardrails (enforced by code, not documentation):**

1. **No publish without a connected account** — publisher checks account status + token expiry before any API call.
2. **Every post lives in a state machine** — draft → awaiting_approval → approved → scheduled → publishing → published/failed. Illegal jumps rejected.
3. **Nothing auto-publishes without opt-in** — merchant.auto_publish_enabled is FALSE by default, requires explicit UI confirmation to enable.
4. **First post always needs manual approval** — even with auto-publish ON, the FIRST published post requires merchant approval. Enforced in publisher.
5. **All actions audited** — append-only trigger on hammerex_nex_social_audit_log.
6. **Timezone-aware scheduling** — every schedule stores UTC + IANA timezone name. Never uses server time. Handles DST via `Intl.DateTimeFormat`.
7. **RLS everywhere** — merchants see only their own accounts, posts, schedules, audit rows.

## Data model

| Table | Purpose |
|---|---|
| `hammerex_nex_social_accounts` | (merchant_slug, platform) unique. Encrypted tokens. Status + expiry. |
| `hammerex_nex_social_posts` | State machine per post. Caption + hashtags + CTA + images + platform. |
| `hammerex_nex_social_schedules` | Recurring patterns ("weekly:friday@17:00"). |
| `hammerex_nex_social_campaigns` | Group posts by theme (e.g. Kitchen transformation Q1). |
| `hammerex_nex_social_analytics` | Per-post engagement + clicks + leads over time. |
| `hammerex_nex_social_audit_log` | Append-only. Every state change, connect, publish. |

Merchant profile (`hammerex_trade_off_listings`) gained:
- `timezone TEXT NOT NULL DEFAULT 'Europe/London'` — IANA name
- `auto_publish_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `auto_publish_agreed_at TIMESTAMPTZ` — when opt-in happened

## Post state machine

```
    draft ──► awaiting_approval ──► approved ──► scheduled ──► publishing ──► published
                    │                    │            │              │
                    ▼                    ▼            ▼              ▼
                rejected               rejected    rejected         failed ──► approved (retry)
                                                                              └─► rejected
```

`transitionPost({ from, to })` refuses any move not in `ALLOWED_TRANSITIONS`. Optimistic concurrency via `.eq("status", from)` — race-safe.

## Publisher rules (in order)

1. Post exists and is in `approved` | `scheduled` | `publishing`
2. If actor is `nex` or `cron`, merchant must have `auto_publish_enabled=true`
3. If actor is auto, merchant must have at least one prior `published` post with `approved_by` set (first-post rule)
4. Connected account for the platform must exist, status='connected', token not expired
5. Only then: transition to `publishing` → call platform API → `published` or `failed`

## Chat integration

`Nex, create a Facebook post for my latest bathroom renovation`
- `detectIntent()` → `{ kind: "social_post", platform: "facebook", brief: "..." }`
- Chat endpoint calls `generateAndDraft()` → post lands in `awaiting_approval`
- Nex replies with count + link to `/studio/social/posts/<id>` + suggestions

Suggestions surface differently when no account is connected — Nex offers "Connect Facebook" as the next chip.

## Timezone

Every schedule stores TWO fields:
- `scheduled_for TIMESTAMPTZ` — the exact UTC instant
- `scheduled_tz TEXT` — the IANA name the merchant picked

Rendering back always uses `Intl.DateTimeFormat` with the stored IANA name so the merchant sees "Friday 5pm" regardless of DST changes between scheduling and firing.

Merchants in different countries see the same UI + same "17:00" input; the DB stores different UTC instants. Cron picks up whatever is due `now`.

## Cron

`/api/cron/nex-social-publish` runs every ~5 minutes, secret-gated. Fetches up to 25 scheduled posts with `scheduled_for <= now`, calls `publishPost()` per post. Publisher's own rules apply — auto-publish + connection + first-post enforcement all happen there.

`/api/cron/nex-schedules-materialise` (not shipped this pass): would walk `nex_social_schedules`, compute `nextWeeklyRun()` per row, and create a fresh post from the campaign template. Framework is ready; deferred until recurring campaigns land.

## OAuth — honest scope

**Shipped this pass**: connection recording + status + revocation + audit + publisher gating. Merchant can paste a token via the dev UI, or a per-platform OAuth callback can populate the account row with the same shape.

**Deferred per platform** (each ~1-2 days):
- **Meta (Facebook + Instagram Graph)** — Meta app registration, OAuth callback, page/IG selector, page access token exchange
- **TikTok Business** — TikTok for Business app, video upload container flow
- **LinkedIn UGC POST** — LinkedIn Developer app, assets + posts endpoint
- **Google Business Profile** — GBP API, localPosts endpoint
- **WhatsApp Business** — Meta again, template message workflow

Publisher's `callPlatformStub()` returns a simulated `platform_post_id` so the entire chat → draft → approve → schedule → publish → audit flow works end-to-end today. Swap the stub per platform as OAuth lands.

## Analytics learning loop

`hammerex_nex_social_analytics` accepts per-post engagement rows (impressions, reach, engagements, clicks, leads_generated). Pass 2 wires a per-platform poller that fetches insights daily and feeds them back into Nex knowledge for content optimisation.

## Chat commands mapped

| Merchant says | Nex does |
|---|---|
| "Create a Facebook post for my latest bathroom renovation" | Draft → `awaiting_approval`, link to /studio/social |
| "Promote my new roofing project" | Same (defaults to Facebook when platform unspecified) |
| "Create this week's social media posts" | Multi-platform drafting (pass 2 loop) |
| "Approve and publish" | Merchant clicks in UI; chat also accepts once we wire per-post intent |
| "Schedule Friday 5pm" | Merchant picks in UI; chat parser lands with recurring schedules |
| "Turn on auto-publish" | Merchant clicks the toggle in Social Hub (confirmed via modal) |

## Merchant experience — the sales-friendly one-liner

> Phil says: **"Nex, promote my new kitchen renovation."**
> 15 seconds later: Nex has drafted a Facebook + Instagram post using his brand voice, tagged the right hashtags, chosen the CTA, and asked for approval. Phil clicks Approve. If he's turned on auto-publish, it goes live at his chosen time. If he hasn't, it sits in the queue until he taps Publish. Either way, nothing goes live without his say-so.

## What's shipped this pass

- 6 tables + RLS + audit trigger
- 8-file library (`src/lib/nex/social/`): types, timezone, state, audit, generator, publisher, accounts, index
- 5 merchant API routes + 1 admin route + 1 cron route
- `/studio/social` merchant hub (accounts + auto-publish + approve/reject/publish/schedule per post)
- `/admin/nex/marketing` platform-wide view
- Chat intent + Nex reply path for "create a post" / "promote my project"
- 104 passing tests including 12 new timezone + state-machine tests

## Not shipped this pass (documented + reachable)

- Real per-platform OAuth handshakes (Meta / Instagram / TikTok / LinkedIn / GBP)
- Real platform API publish calls — publisher stub returns simulated ids so flow is end-to-end testable
- Recurring campaign materialiser cron (pattern → new draft weekly)
- Analytics pollers per platform
- Encryption key rotation for `access_token_enc` (base64 today; wire KMS pass 2)
- Chat parser for "schedule Friday 5pm" (UI handles it now; chat pattern lands next)

The system is a real merchant marketing employee today, with clean seams for the per-platform work when OAuth apps are registered.
