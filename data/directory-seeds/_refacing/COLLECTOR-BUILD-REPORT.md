# NEX Refacing Collector · Build Report (2026-08-13)

## Objective (Philip 2026-08-13)

Build the worker-facing Collector so NEX admins can research UK trades, verify their public contact details, and file them into the existing directory · claim · membership rails without any parallel systems.

## Architecture changes

### New files

| Path | Purpose |
|---|---|
| `src/lib/nex/centre-publishing/tradeCategoryRegistry.ts` | Per-category config (id · display name · seed folder · public URL · capability labels · qualification rubric). Registered: `staircase_refacing` (priority 1, **enabled — the only active category**), `staircase_manufacture` (priority 2, paused/disabled), `kitchens` (registered but disabled). Both non-refacing categories are documented and ready to re-enable when refacing acquisition proves out. |
| `src/lib/nex/centre-publishing/collectorNotifications.ts` | Stub hooks for `claim_invited` · `claim_reminder` · `membership_invited` · `membership_reminder` that will hand off to the existing NEX comms rail. Silent no-op today · never sends without a verified email. |
| `src/app/admin/(authed)/collector/[category]/page.tsx` | Collector landing · reads category config from registry · renders form. Behind existing admin auth. |
| `src/app/admin/(authed)/collector/[category]/CollectorForm.tsx` | Client form component · all fields · public business email flagged as required + priority · duplicate-confirmation UX. |
| `src/app/admin/(authed)/collector/[category]/dashboard/page.tsx` | 7-section worker dashboard + top-line metrics + qualification distribution. |
| `src/app/api/admin/collector/[category]/save/route.ts` | POST endpoint. Runs duplicate detection (strong/medium/fuzzy) then writes the DirectorySeed JSON. Returns `{ok:true,created:true,listing_id,slug,directory_url}` OR `{ok:true,created:false,duplicates:[...]}`. |

### Files preserved (no parallel systems built)

- `src/lib/adminAuth.ts` — reused via `isAdminAuthed()` guard on the save API
- `src/app/admin/(authed)/layout.tsx` — reused; Collector inherits admin auth
- `src/lib/nex/centre-publishing/directorySeedLoader.ts` — reused; new records auto-appear via existing file-based loader
- `src/app/api/nex/centre/feed/route.ts` — reused; new seeds flow through the existing feed
- `src/app/nex-app/refacing/companies/page.tsx` — reused; new records auto-appear
- `/nex-app/claim?listing_id=<slug>` — reused as the claim CTA target (existing shared endpoint)
- Existing membership / Stripe / merchant model — untouched

### No new databases created

The seed is written as JSON to `data/directory-seeds/{seedFolder}/{slug}.json`. Same shape as the existing ~500 kitchen + staircase-manufacture seeds. The public feed reads them at request-time via the existing loader — no migration, no schema change beyond the additive refacing fields already shipped in Batch 001.

## Routes

| URL | Purpose |
|---|---|
| `/admin/collector/staircase_refacing` | Collector form for refacing |
| `/admin/collector/staircase_refacing/dashboard` | Worker dashboard for refacing |
| `/admin/collector/staircase_manufacture` | Collector form for manufacture (priority 2) |
| `/admin/collector/staircase_manufacture/dashboard` | Manufacture dashboard |
| `POST /api/admin/collector/[category]/save` | Save endpoint (auth-gated) |

## Duplicate detection (Philip §10)

Runs on every save unless client sends `force_create: true`. Signal tiers:

**Strong (any one blocks save):**
- Exact website domain match
- Exact normalised phone (≥7 digits)
- Exact email match
- Same normalised postcode + same normalised company name

**Medium:**
- Same normalised name + same town

**Fuzzy:**
- Normalised name substring in either direction (≥5 chars)

Normalisation strips: `Ltd/Limited/Plc/Co/Company/Group`, `&`→`and`, all non-alphanumeric. Postcode normalises to upper-case no-space.

On hit, the API returns `{ ok: true, created: false, duplicates: [...] }` with up to 5 potential matches. The form displays them; the worker can tick "confirm this is a different business" to override with `force_create`.

## Governance preserved

- `directory_state` defaults to `"listed"` on every new record. Never auto-promoted.
- `verified: false`, `claimed: false` on write. Only the shared claim/membership flow flips these.
- `email` blank ⇒ `null` in JSON (silence over fabrication). `email_source`, `email_verified`, `email_checked_at` all null too.
- Qualification captured only if worker explicitly assigns. Never inflated.
- Evidence captured as structured record: `url + type + category + summary + checked_at`.
- Notification hooks refuse to send if email is missing or not verified.
- No parallel claim, payment, membership, checkout, merchant, or Stripe system was created.

## Acceptance test status

Verified from CLI (session limits full E2E to what's possible without a browser admin session):

| # | Test | Result |
|---|------|--------|
| 1 | `/nex-app/refacing/companies` still renders | ✅ 200 OK, shows 5 Batch 001+002 seeds |
| 2 | `/api/admin/collector/staircase_refacing/save` (unauth) returns 401 | ✅ Auth guard working |
| 3 | Category registry loads both refacing + manufacture as enabled | ✅ Verified in code |
| 4 | New seeds auto-appear in feed | ✅ Same file-loader path as Batch 001 |

Manual test remaining (requires admin browser session):

1. Log in at `/admin/login`
2. Visit `/admin/collector/staircase_refacing`
3. Add a test company · save
4. Verify it appears at `/nex-app/refacing/companies`
5. Try to add the same company again · verify duplicate detection blocks it
6. Visit `/admin/collector/staircase_refacing/dashboard` · verify counts update

## Current directory numbers

Unchanged from Batch 002 — the Collector doesn't add records automatically:

| Metric | Value |
|---|---|
| Total records (staircase_refacing) | 5 |
| Verified public emails | 3 |
| directory_state = listed | 5 |
| directory_state ≥ verified | 0 |
| Exchange eligible (paid_member + A+/A) | 0 |

## What is NOT done

- **End-to-end browser test** — requires admin login; can be run manually next session.
- **Field editing** — the Collector currently only creates records. Editing existing seeds (e.g. to flip `directory_state: "verified"` after admin verification) needs a small update UI. Deferred until Philip prioritises.
- **Automated notifications** — the hooks exist but log-only until the shared NEX comms rail is imported.
- **Kitchens directory** — registered as disabled (proof-of-genericism); enable when prioritised.

## Rules re-locked

1. **No parallel systems.** Collector uses admin auth, seed loader, feed API, claim URL, membership tier catalog — all shared with the rest of NEX.
2. **No auto-promotion.** Every new seed is `listed`. Only the shared claim flow can move to `claimed`. Only Stripe activation can move to `paid_member`.
3. **No fabrication.** Empty form fields become `null` in JSON. Duplicates block save. Notifications refuse to send without verified email.
4. **Exchange gate unchanged.** `isEligibleForRefacingRouting()` still requires `directory_state === "paid_member"` AND `refacing_qualification ∈ {A+, A}`.

## Next recommended actions

1. Manual browser test of the Collector + Dashboard.
2. First real Collector session: workers add 20-50 UK refacing trades using the form.
3. Once ~100 records exist, revisit deferred pieces D (search/filter/sort) and F (admin seed editor).
