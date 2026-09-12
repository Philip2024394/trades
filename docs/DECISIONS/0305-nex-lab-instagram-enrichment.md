# ADR-0305 · NEX Lab · Instagram Enrichment via Meta Graph API

**Status:** proposed · awaiting founder-side Meta app registration
**Author:** Master AI Engineer (2026-09-10)
**Depends on:** ADR-0304 (NEX Lab Autonomous Research Lab)

## Context

Website→email enrichment (ADR-0304 · shipped 2026-09-10) yielded ~20% real
emails from crawled websites. The other 80% of Indonesian SMBs don't put
email on their website — they route contact through Instagram or WhatsApp.
The single richest un-tapped legitimate source of Indonesian SMB contact
info is Instagram Business/Creator public bios.

Two paths were considered:

1. **Public scraping** (grey zone) — fast to build, violates Meta ToS,
   risk of app-wide IG account bans, no compliance path.
2. **Meta Graph API `business_discovery` edge** (legit) — Meta explicitly
   licenses public business bio data for this endpoint, ToS-clean, rate-
   limited to 200 calls/hour. Requires app review.

Founder decision 2026-09-10: **path 2 (legit)**.

## Decision

Ship the enricher code + database wiring today, gated on env vars
`META_IG_USER_ID` + `META_GRAPH_ACCESS_TOKEN`. The script exits cleanly
when the vars are unset (no false-error noise in the log). Founder
completes the Meta app registration + app review on their own timeline.

## Founder-side setup checklist

**Estimated total time: 3-14 days (Meta app review latency dominates)**

### Step 1 — Create a Facebook App
1. Go to https://developers.facebook.com/apps/
2. Create App → type: **Business**
3. App name: `NEX Lab Enrichment` (any name)
4. Business Manager: create or link one under your Meta Business Suite

### Step 2 — Link Instagram Business/Creator account
The `business_discovery` edge requires an IG Business account that
belongs to a Facebook Page you administer. This is the "requester" IG
account — it queries data about OTHER IG business accounts.

1. Convert (or use existing) an Instagram account to Business/Creator
2. In FB Business Suite → Accounts → Instagram accounts → link it to a
   Facebook Page you own
3. Note the Instagram Business Account ID (starts with `17841...`)
   - Find via: `GET https://graph.facebook.com/v20.0/me/accounts?access_token=<user-token>`
     then for the page: `GET /{page-id}?fields=instagram_business_account`

### Step 3 — Generate long-lived Page Access Token
1. Get short-lived user token from Graph API Explorer (developers.facebook.com/tools/explorer)
   with permissions: `instagram_basic`, `pages_show_list`, `pages_read_engagement`,
   `business_management`
2. Exchange for long-lived (60-day) token:
   ```
   GET https://graph.facebook.com/v20.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &fb_exchange_token={short-lived-token}
   ```
3. Exchange for permanent Page Access Token:
   ```
   GET https://graph.facebook.com/v20.0/{page-id}?fields=access_token&access_token={long-lived-user-token}
   ```

### Step 4 — App Review submission
`business_discovery` is a public API but needs your app to be in Live
mode with permissions approved. Submit for review:

| Permission              | Justification (paste in review form)                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `instagram_basic`       | Query public bio/website/contact of Indonesian SMB Instagram accounts for our tourism business directory                          |
| `pages_show_list`       | List Pages that our IG Business account is linked to (required for auth)                                                          |
| `pages_read_engagement` | Read Page metadata to verify IG Business account linkage                                                                          |
| `business_management`   | Access Business Manager context for IG Business account operations                                                                |

Include a screencast: launch NEX Lab dashboard → show `/nexapp/lab/business` → explain that discovered IG handles get enriched via business_discovery to build a directory of Indonesian tourism-related businesses that can opt in to NEX listings. Do NOT claim any Instagram automation — this is read-only public data.

**Meta app-review latency: typically 3-10 business days.**

### Step 5 — Set env vars + verify

Add to `.env.local`:
```
META_IG_USER_ID=17841XXXXXXXXXXXX
META_GRAPH_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Verify:
```
node scripts/nex-lab-instagram-enricher.mjs --limit 5 --room business
```

Expected output on success:
```
[2026-09-10T...] start · rooms=business · limit/room=5 · igUserId=17841X…
[2026-09-10T...]   business: 3 candidates with IG handle
[2026-09-10T...]   ✓ business · @somekopi · followers=1247 · emails=1
```

## Contract

The enricher stores results in `nex_lab_*.harvest_raw.payload.ig_bio_data`:

```jsonc
{
  "handle": "somekopi",
  "name": "Kopi Kenangan",
  "biography": "Cafe · order via wa.me/6281234567890 · info@somekopi.co.id",
  "website": "https://somekopi.co.id",
  "followers": 1247,
  "follows": 89,
  "media_count": 342,
  "profile_picture_url": "https://...",
  "bio_emails": ["info@somekopi.co.id"],
  "bio_whatsapp": "6281234567890",
  "fetched_at": "2026-09-10T10:15:00.000Z",
  "source": "meta_graph_business_discovery"
}
```

Emails discovered in bio are ALSO merged into `payload.enriched_contacts.emails[]` with `source: "instagram_bio"` and `confidence: "medium"` so the promotion executor picks them up uniformly with website-enricher emails.

## Rate limits + operational notes

- Meta limits business_discovery to **200 calls/hour per IG user**
- Script sleeps 500ms between calls (safe: 7,200 calls/hour theoretical max)
- On HTTP 429 the script pauses 60s and continues
- Access token expires every 60 days — set a calendar reminder to refresh, or automate via long-lived refresh flow
- No personal data (UU PDP 27/2022): `business_discovery` returns ONLY Business/Creator accounts, which are public commercial profiles by definition — not personal profiles

## Rollback

If Meta revokes app permissions or ToS changes:
1. Unset `META_GRAPH_ACCESS_TOKEN` in `.env.local`
2. Script exits cleanly at next scheduled run (no data corruption)
3. Existing `payload.ig_bio_data` remains for reference but no new enrichment happens

Emails already merged into `enriched_contacts` stay valid — they were public bio content at the time of harvest, licence-compatible with our aggregation.
