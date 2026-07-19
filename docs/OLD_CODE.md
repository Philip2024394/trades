# Old / Legacy Code Inventory — Thenetworkers

**Purpose.** Honest inventory of code that's kept for backward-compat but that a new dev might otherwise think is current. Explains WHY the legacy naming/paths stay, and marks anything genuinely deprecated.

**Update rule.** When you retire code, move it from "kept for compat" to "deleted YYYY-MM-DD" with a note.

---

## Legacy brand naming (kept intentionally)

The platform's earlier names — **Xrated Trades**, **Construction Notebook**, **Hammerex Trades** — were superseded by **The Network** on 2026-07-09 (per `project_thenetwork_domain_option.md`). Rule: user-visible strings get "The Network"; internal identifiers stay put (per `feedback_strip_xrated_branding.md`).

### Kept-for-compat internal identifiers

- **`hammerex_*` DB table prefix** — 334 tables. Renaming would require touching 232 migrations + every route + every merchant's data-in-flight. Cost >> benefit.
- **`hammerex_edit_token` cookie** — merchant session cookie. Renaming forces every existing merchant to re-login. Deferred.
- **`xrated_affiliate_ref` cookie** — third-party affiliate cookie. Same rationale as above.
- **`src/app/trade-off/*` route tree** — 108 marketing pages + all merchant dashboard live here. Rename = 301-redirect storm in Google's index. Deferred until we have real ranking value at risk.
- **`XRATED_BRAND`, `XRATED_PRICING`** constants in `src/lib/xratedTrades.ts` — central config. Rename is safe but not free.
- **File naming `xrated_*` / `Xrated*`** — components like `XratedHeader`, `XratedFooter`, `XratedViewTracker` etc. Rename is mechanical.

### User-visible copy — MUST use "The Network"

Per the standing rule: every touched file replaces user-visible `"Xrated"` / `"Xrated Trades"` / `"Construction Notebook"` / `"Hammerex Trades"` with `"The Network"`. Ongoing sweep — do it in every PR that touches a page.

**Emerging category name:** merchant's live surface is called a **"Tradesite"**. Platform = **"Thenetworkers"**. Never write "Tradesite website" (per `project_tradesite_emerging_brand.md`).

---

## Superseded architectural patterns

Kept in tree for reference but new work should not follow.

### Add-on wrapper pattern (superseded 2026-07-11)
- **Old:** Add-ons registered as thin wrappers around specific canteen sections.
- **New:** Manifest-first apps at `src/apps/<slug>/manifest.ts` (per ADR-0001).
- **Old memory:** `feedback_studio_addon_wrapper_pattern.md` — **deleted 2026-07-17** (was marked SUPERSEDED, 0 refs, removed after safe-to-delete scan).
- **New memory:** `feedback_platform_apps_manifest_first.md`.

### `/canteen/*` parallel routes (deleted 2026-07-12)
- **Old:** `/canteen/[slug]` and `/canteen/*` — duplicated the /trade-off/yard/canteens/* tree.
- **New:** Canonical URL is `/trade-off/yard/canteens/*`. Old parallel deleted same day.
- **Memory:** `project_canteens_public_viewing.md`.

### Cloudflare Pages hosting for Indocity (rescinded 2026-06-02)
- **Old:** Cloudflare Pages was the target platform for the Indocity codebase.
- **New:** Vercel-first. Wrangler files kept as fallback until Vercel stable, then deleted.
- **Note:** This is Indocity-only, not Thenetworkers — but Philip's cross-project pattern.

### Trial language on tier pricing (retired 2026-07-10)
- **Old:** "Free trial" copy on tier upsells.
- **New:** "Free for life" — freemium-forever is what actually ships (per `feedback_diamond_standard_no_lies.md`).
- **Files:** Anything with `TRIAL_DAYS` copy on public pages — grep before adding new copy.

### KTP/passport verification on Indocity (removed 2026-05-29)
- **Old:** KTP upload + `not_verified` gate on dashboards.
- **New:** Removed — "app belongs to the user". Not Thenetworkers, but crosses over into shared Indocity workspace patterns.

---

## Duplicate / parallel systems (intentional, but confusing without context)

### Two affiliate/referral systems in parallel

| System | Cookie | Query param | Reward | Column | Admin |
|---|---|---|---|---|---|
| **Third-party affiliates** | `xrated_affiliate_ref` (int) | `?ref=<int>` | £10 cash per paid upgrade | `affiliate_referrer_id` | `/admin/(authed)/affiliates/*` |
| **Merchant-to-merchant referrals** | `tn_mref` (string) | `?mref=<slug>` | 50+200 washers in-kind | `merchant_referrer_slug` | (not built) |

**Why both:** Different audiences. Third-party = commercial affiliate managers with landing pages + API tokens + payouts. Merchant-to-merchant = one trade tells another trade, in-kind bonus. Same visitor can carry both cookies. Different columns.

**Watch for:** Don't confuse — see `project_merchant_referral_loop.md`.

### Two Supabase-shared codebases

- **`C:\Users\Victus\trades\`** (this repo) — Thenetworkers. All tables prefixed `hammerex_*`, `app_*`, or `os_*`.
- **`C:\Users\Victus\hammer\`** — Hammerex product site. Uses the same Supabase project `msdonkkechxzgagyguoe`. Every Hammerex table also prefixed `hammerex_*`.

**Consequence:** Some `hammerex_*` tables in the schema map are owned by the OTHER repo. Before altering a `hammerex_*` table, grep BOTH repos.

### Two hero/image libraries

- **`scripts/hero-library.json`** — 203+ curated hero images with 14 fields each (fuzzy keyword matching). Powers merchant hero picker + inspiration search.
- **`hammerex_feed_tile_library` DB table** — curated store-eligible images with `trade_slugs` array (exact match) + `tier 1..4` + brand/banner flags. Powers Site Interest store + feed.

**Why both:** JSON is the merchant-side "generate-me-a-hero" library (fuzzy match tolerated). DB is the store-side "this exact image is for sale" (exact tagging required). Never merge — different use cases.

---

## Deprecated files / functions (candidates for deletion)

To be surveyed properly. Known suspects:
- **`src/components/xrated/*Legacy*.tsx`** — grep for `Legacy` in component names
- **`src/lib/*_old.ts`** or `*_v1.ts` — grep for `_old` / `_v1` / `_deprecated` suffixes
- **`supabase/migrations/*_wip_*.sql`** — any WIP migrations still in tree

Recommend running: `grep -rn "@deprecated\|// DEPRECATED\|// LEGACY\|// TODO: remove" C:/Users/Victus/trades/src/` and adding results here.

---

## Cookie inventory (with legacy notes)

| Cookie | Purpose | Legacy? |
|---|---|---|
| `hammerex_edit_token` | Merchant session (HMAC-signed) | Named for legacy brand — kept for compat |
| `homeowner_session` | Homeowner session (HMAC) | Current name, keep |
| `admin_session` | Admin session (HMAC) | Current name, keep |
| `si-member` | Store customer session (HMAC) | Current name, keep |
| `xrated_affiliate_ref` | 3rd-party affiliate ref (numeric, 30d) | Named for legacy brand — kept for compat |
| `tn_mref` | Merchant-to-merchant referral (slug, 30d) | Current name (Thenetworkers convention) |

**Migration cost of renaming legacy cookies:** every existing user gets logged out. Value: low. Never do it for aesthetics; do it if privacy/GDPR forces it.

---

## Environment variables — legacy vs current

| Var | Purpose | Notes |
|---|---|---|
| `NEXT_PUBLIC_CANONICAL_ORIGIN` | Site origin (default `https://thenetworkers.app`) | Current, use everywhere |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase | Current |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side | Current |
| `SUPABASE_ACCESS_TOKEN` | Management API DDL access | In `.env.tools.local` — never `.env.local` |
| `SUPABASE_PROJECT_REF` | `msdonkkechxzgagyguoe` | Shared with Hammerex |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe live | LIVE mode |
| `STRIPE_STORE_WEBHOOK_SECRET` | Store webhook signature | Separate from main webhook |
| `RESEND_API_KEY` | Transactional email | Best-effort — no-op if unset |
| `HAMMEREX_TRADE_FROM_EMAIL`, `RESEND_FROM_EMAIL` | Email `from` fallbacks | Layered — first defined wins |
| `WATERMARK_URL_BASE` | Base for stego URL payload | Currently defaults to `https://thenetworkers.app/i` |
| `COMPANIES_HOUSE_API_KEY` | UK company verification | LIVE |

---

## What we can safely delete this session (safe cleanup candidates)

Not confirmed by grep — flag for review:
- Any `*.wip.md` in `docs/` (WIP markdown drafts)
- Old planning docs like `docs/canteens-backend-deploy.md` if the deploy is done and log serves no future reference
- Duplicate migration SQL committed as `.sql.bak` or `.sql.old` (there shouldn't be any, but grep to confirm)
- Old email templates in `src/lib/email/` that aren't referenced anywhere

**Rule:** Never delete without a grep for references first. Old code sometimes gets `import`ed from surprise places.

---

## Recommended deprecation sweep (future session)

When Philip decides the rebrand cutover is total:
1. Rename `xrated_affiliate_ref` → `tn_affiliate_ref` (forces every affiliate to re-login — coordinate)
2. Rename `hammerex_edit_token` → `tn_edit_token` (forces every merchant to magic-link recover — coordinate)
3. Rename `XratedHeader` → `PlatformHeader`, `XratedFooter` → `PlatformFooter` (mechanical)
4. Introduce a table prefix `tn_` for new tables; keep `hammerex_*` for existing ones forever (or run a coordinated ALTER TABLE ... RENAME batch when we have a maintenance window)

**Do NOT do these piecemeal.** Half-done rebrands are worse than either state.
