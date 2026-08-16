# Trade Centre · International Readiness · Implementation Plan
_Read-only plan · 2026-08-16 · no code changes made · awaiting Philip's approval_

Companion to `TRADE-CENTRE-INTL-AUDIT-2026-08-16.md`. Every file:line reference here has been verified against the working tree today. This plan turns the audit's findings into ordered slices Philip can approve one at a time.

---

## 0. Scope & non-goals

### In scope (this plan)
- **P0 slices (unblock USA + Ireland today)**
  - Fix the silent-hide `verified_only` filter that removes all 425 non-UK rows
  - Add `country` (+ `region`) to the feed API and `CentreFeedItem` type
  - Build the polished CountryPicker panel per the pinned architecture
  - Wire the picker into the main Trade Centre and the Refacing surface
  - Switch the Refacing surface from `category="Staircase Refacing"` to a capability-based query so the 14 directly-evidenced US refacing rows appear
- **P1 slices (correctness + polish)**
  - Country-aware proximity handling — graceful null for non-UK, no false distances
  - Country-aware address renderer + kill the six literal `?? "UK"` fallbacks
  - Country-aware SEO metadata (remove hardcoded "UK staircase trade")
  - AskNex system prompt: inject the customer's selected country as context

### Explicitly OUT of scope (do not touch in this plan)
- M4 · NEX brain · conversation-learning pipeline · knowledge-inbox · claim-review UI
- M6 / M6.1 / M6.2 / M6.3+ · member conversion / Stripe / claim-flow evolution
- Discovery (paused) · no new agents · no touching the 896 production `directory_seeds` rows
- **No schema changes.** The audit confirms migration 053 already dropped the region CHECK; no P0/P1 slice below requires DDL. If any slice unexpectedly needs one, it is flagged BLOCKED-ON-PHILIP.
- `/tc/…` fixture app (`src/app/tc/…` uses `findTradeProfile` on fixture data, not `directory_seeds` — audit §2)
- xrated · trade-off · streetlocal surfaces (share UK regex assumptions but not on the Trade Centre path)
- Adding a `service_area_countries` column (audit §6 defers this; still deferred here)
- Currency/£ hardcodes on the price formatter — not blocking today because directory records have `price_pence=0` (audit §3e). Left alone in this pass; call it out in a future slice when real multi-country products with prices appear.

---

## 1. Slice-by-slice plan (execution order)

Order chosen so that:
1. The tiniest correctness fix ships first (P0-1) — literally one filter block.
2. Data-flow plumbing (P0-2) lands before any UI can consume `country`.
3. The picker (P0-3) is built as a pure component before it's mounted.
4. Wire-up (P0-4) is the visible flip — first moment a user can pick country.
5. Refacing correctness (P0-5) piggybacks on the same wiring.
6. P1 slices are pure polish + one honest ranking fix, sequenced by blast radius (proximity → addresses → SEO → AskNex).

### Slice P0-1 · Fix `verified_only` filter (silent hide → honest degrade)
- **Goal.** Stop the "Verified only" checkbox from silently deleting every US and Ireland record from the feed.
- **Files.**
  - `src/components/nex-app/centre/NexCentreLiveFeed.tsx:225-231` (the client-side `filters.verified_only` filter block · verified in this session).
- **Change.**
  - Keep the current filter semantics for UK rows.
  - When zero rows in the current filter set have `merchant_verification_level ∈ {"verified","partner"}`, do NOT return `[]`. Instead: leave the checkbox visible, but render an inline hint under the filter ("No verified records for this country yet — showing all listings.") and short-circuit the filter (return the input unchanged) so the user sees rows, not an accidental empty state.
  - Optional companion: disable the checkbox visually when the current country filter has zero verified rows (once Slice P0-4 is in, this becomes trivial — until then, use "current fetched page contains zero verified rows" as the trigger).
- **Data-flow / query changes.** None. Client-only filter change.
- **Acceptance criteria.**
  - With no country selected and `verified_only=true`: UK verified rows still render; hint does NOT appear.
  - With `country=USA` (once P0-4 lands) and `verified_only=true`: hint appears, all US rows still visible.
  - With `country=Ireland` and `verified_only=true`: hint appears, all IE rows still visible.
  - Zero regression to UK-only behaviour.
- **Risk & blast radius.** Small. Only touches one file. Only affects users who ticked the verified filter. Worst case: hint text reads oddly (cosmetic).
- **Rollback.** Revert the block at line 225-231.
- **Depends on.** Nothing (can ship standalone). Best paired with P0-4 so the message reads naturally per country.

### Slice P0-2 · `country` (+ `region`) on feed API + `CentreFeedItem` type
- **Goal.** Make the feed pipeline country-aware end-to-end without changing any UI behaviour yet. Additive only.
- **Files.**
  - `src/lib/nex/centre-publishing/types.ts:16-95` — add `merchant_country: string | null` and `merchant_region: string | null` to `CentreFeedItem`; add `country?: string` and `region?: string` to `CentreFeedFilters`.
  - `src/lib/nex/centre-publishing/directorySeedsDb.ts:23-84` — add a new `listDirectorySeedsByCountry({ country?, region?, category? })` variant (leave `listDirectorySeeds` and `listDirectorySeedsByCategory` unchanged for backwards compat).
  - `src/lib/nex/centre-publishing/directorySeedLoader.ts:419-479` (`seedToFeedItem`) — populate `merchant_country: seed.country` and `merchant_region: seed.region`. Also accept `country`/`region` in the loader options and forward to the DB layer.
  - `src/app/api/nex/centre/feed/route.ts:84-128` — accept `?country` and `?region` params, pass through `listCentreFeedItems` and `loadDirectorySeedsAsFeedItems`.
  - `src/lib/nex/centre-publishing/indexForSearch.ts:24-108` (`listCentreFeedItems`) — accept `country` filter, and (defensively) filter merchants by the joined `country` column when present. If real merchant listings don't yet carry country, this is a no-op — safe.
- **Data-flow / query changes.**
  - Supabase filter chain gains `.eq("country", filters.country)` when `filters.country` is provided (skip when omitted).
  - Feed API accepts new params but their omission returns everything (backward compatible).
  - API adds `country: "US" | "GB" | "IE" | undefined` as a new query param key. Value maps to canonical DB strings via a normaliser (see §2 country data model) — `"US"` → `"USA"`, `"GB"` / `"UK"` → `"United Kingdom"`, `"IE"` → `"Ireland"`.
- **Acceptance criteria.**
  - `GET /api/nex/centre/feed?country=US` returns exactly 375 rows (or fewer with additional filters).
  - `GET /api/nex/centre/feed?country=IE` returns exactly 50 rows.
  - `GET /api/nex/centre/feed?country=GB` returns exactly 471 rows.
  - `GET /api/nex/centre/feed` (no country) still returns 896 rows total (backward compatible).
  - Every returned `CentreFeedItem` carries `merchant_country` (non-null for directory seeds; existing merchant products may return null until they carry country themselves — acceptable).
- **Risk & blast radius.** Low. Additive only. Every existing consumer that ignores the new field keeps working. Type change is a superset. One caveat: any code doing `Object.keys(item).length` (rare) would notice. Manual audit found none in Trade Centre paths.
- **Rollback.** Revert types + loader + API changes; DB queries return to their current shape.
- **Depends on.** Nothing. Ships before P0-3.

### Slice P0-3 · `<CountryPicker />` component (spec + build, not yet mounted)
- **Goal.** Build the polished panel component per the locked architecture. Pure component + storybook-style page — no wiring yet.
- **Files (new).**
  - `src/lib/nex/geography/countries.ts` — new declarative country/region data (see §2).
  - `src/lib/nex/geography/countryStore.ts` — new SSR-safe read/write for selected country (localStorage first, cookie for SSR later).
  - `src/components/nex-app/centre/CountryPicker.tsx` — new component.
- **Files (unchanged in this slice).**
  - `NexCentreLiveFeed.tsx` and `refacing/companies/client.tsx` remain untouched until Slice P0-4.
- **Change.**
  - Component API:
    ```
    <CountryPicker
      value={selectedCode | "all"}
      onChange={(next) => void}
      counts={{ GB: 471, IE: 50, US: 375 }}  // optional; hides count chip if omitted
      variant="header" | "sheet"              // header = compact trigger; sheet = full panel
    />
    ```
  - Trigger button in header shows: flag emoji + country name + `▾` (or "All countries").
  - Opening the trigger renders a **panel** (not a `<select>`) grouped by region — see §2.
  - "All countries" pinned at the top of the panel.
  - "Change market" affordance = the trigger itself; always visible in the header slot on every mounted surface.
- **Data-flow / query changes.** None yet (state is component-local).
- **Acceptance criteria.**
  - Component renders standalone with UK/IE/USA active + "coming soon" markers per region group.
  - Keyboard nav: Tab to trigger, Enter/Space opens, Escape closes, Arrow keys move focus inside panel, Enter selects.
  - Mobile (< 640px): panel becomes a bottom sheet (full-width, `sheet` variant kicks in automatically via a `useMediaQuery`-ish helper or Tailwind breakpoint conditional).
  - Focus is trapped inside the open panel; focus returns to trigger on close.
  - `aria-expanded`, `aria-haspopup="dialog"`, and `role="dialog"` on the panel; each option `role="menuitemradio"` or `aria-checked` on the button.
  - Snapshot test (or Playwright) verifies rendered structure with 3 active + coming-soon markers.
- **Risk & blast radius.** Zero to production — component is not mounted anywhere.
- **Rollback.** Delete the three new files.
- **Depends on.** Nothing. Can ship in parallel with P0-1 / P0-2.

### Slice P0-4 · Wire CountryPicker into main Trade Centre + Refacing surfaces
- **Goal.** First moment a user can pick country and see the feed reshape.
- **Files.**
  - `src/components/nex-app/centre/NexCentreLiveFeed.tsx` — mount `<CountryPicker />` in the header slot; extend `filters` state to carry `country`; include `country` in the `qs` built for `/api/nex/centre/feed`; re-fetch on change.
  - `src/app/nex-app/refacing/companies/client.tsx:149-169` — mount `<CountryPicker />` in the hero header; add `country` to the `qs = new URLSearchParams({...})` block at line 153; refetch on change.
  - `src/lib/nex/geography/countryStore.ts` — used to persist selection across page reloads/visits.
- **Change.**
  - Initial default resolution (on first ever visit only): `resolveLocation({ ip_country })` at `src/lib/nex/world/location.ts:51-126` → normalise to `"GB" | "IE" | "US"` → store to `localStorage.nex_selected_country`. If IP resolves to any other country or "unknown", default to `"all"`.
  - Priority chain (documented in code): URL `?country=` → localStorage → IP default → `"all"`.
  - Persistence: `localStorage.nex_selected_country` (key locked). Cookie `nex_selected_country` set alongside for future SSR use (SSR reads not required for this slice).
  - "Change market" is always the picker itself in the header — no separate button needed.
- **Acceptance criteria.**
  - Land fresh (no localStorage), simulated US IP: default = USA, 375 rows.
  - Land fresh, simulated UK IP: default = GB, 471 rows.
  - Land fresh, simulated NL IP: default = `"all"`, 896 rows.
  - Change from USA to Ireland: URL unchanged (canonical stays `/nex-app/centre`), feed reflects 50 IE rows, choice persisted.
  - Reload page: previously-chosen country wins over IP default.
  - Refacing surface (`/nex-app/refacing/companies`) obeys the same selection.
  - P0-1 hint now reads correctly per country ("No verified USA records yet — showing all listings.").
- **Risk & blast radius.** Medium. This is the first visible behaviour change on both surfaces. If the initial default logic misfires, first-visit users see the wrong country's rows (they can fix in one click). The picker adds UI real estate to the header — if it collides with existing header elements on mobile it could look bad (mitigate with the sheet variant on mobile per P0-3).
- **Rollback.** Comment out the mount + revert filter state additions. `localStorage.nex_selected_country` is a benign string; leaving it in browsers does no harm.
- **Depends on.** P0-2 (API accepts `country`), P0-3 (component exists).

### Slice P0-5 · Refacing surface: category → capability query
- **Goal.** Include the 14 directly-evidenced USA refacing records (and any Ireland refacing rows) on `/nex-app/refacing/companies`, without falsely promoting the 58 unverified Stage-2 US refacing claims into `capabilities.refacing='yes'`.
- **Files.**
  - `src/app/nex-app/refacing/companies/client.tsx:153` — swap `qs = new URLSearchParams({ category: CATEGORY_STAIRCASE_REFACING, limit: "100" })` for a capability-based query.
  - `src/app/api/nex/centre/feed/route.ts:84-128` — accept a `capability` query param.
  - `src/lib/nex/centre-publishing/directorySeedsDb.ts` — new helper `listDirectorySeedsByCapability(capability: string, opts?: { country?, region?, category? })` that filters on the `capabilities` JSONB column: `WHERE capabilities->>'refacing' = 'yes'`. Supabase filter: `.eq("capabilities->>refacing", "yes")`.
  - `src/lib/nex/centre-publishing/directorySeedLoader.ts` — plumb `capability` through.
- **Change.**
  - Refacing surface now requests `?capability=refacing&country=<selected>&limit=100`.
  - Server-side query becomes: `capabilities->>'refacing' = 'yes'` OR (fallback for records tagged pre-capability-migration) `business_type IN ('REFACING_SERVICE_SPECIALIST', 'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER')` — union at the DB layer or via a small SQL `.or(...)`.
  - **Explicitly excluded:** any row that only has a Stage-2 `refacing_qualification.hint` (unverified claim). The 58 unverified US claims must NOT be promoted to `capabilities.refacing='yes'` in the DB — they stay where they are. The audit's Slice 3 note is honoured: change the FILTER, not the data.
- **Data-flow / query changes.**
  - Before: `directory_seeds WHERE category = 'Staircase Refacing'` — misses US rows imported under `Staircase`.
  - After: `directory_seeds WHERE (capabilities->>'refacing' = 'yes' OR business_type IN ('REFACING_SERVICE_SPECIALIST','REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER')) [AND country = ?]`.
- **Acceptance criteria.**
  - `/nex-app/refacing/companies` with country=USA shows the 14 directly-evidenced US refacing companies.
  - Same page with country=UK shows the existing UK refacing set (no regression — assert count is equal to or greater than today, never less).
  - Same page with country=Ireland shows any IE refacing rows (audit hinted these were imported under `Staircase Refacing`; verify no regression).
  - Same page with country="All countries" shows the union.
  - The 58 unverified Stage-2 US refacing claims do NOT appear on the customer surface (they lack `capabilities.refacing='yes'` and lack the two refacing business_types).
- **Risk & blast radius.** Medium. Changing the filter semantics is the exact moment where a subtle capability-schema mismatch could silently show or hide the wrong rows. Mitigation: before shipping, run the two SQL queries side-by-side against `directory_seeds` and diff the row-sets by country + verification-state. If the diff is unexpectedly large, hold and re-plan.
- **Rollback.** Restore the category=`Staircase Refacing` param on the client and drop the capability code path.
- **Depends on.** P0-2 (feed API accepts additional params).

### Slice P1-1 · Country-aware proximity (or graceful null for non-UK)
- **Goal.** Stop pretending UK postcode centroids can rank US ZIP or IE Eircode results. Make the honest, low-effort choice first.
- **Files.**
  - `src/lib/nex/centre-publishing/indexForSearch.ts:14, 106-108` — swap `import { centroidOf, haversineKm } from "@/lib/ukPostcodeCentroids"` for a country-aware resolver.
  - `src/lib/nex/geography/postcodeCentroid.ts` (new) — thin wrapper that consults `ukPostcodeCentroids` when `country="GB"`, returns `null` for everything else. Design so a future PR can plug US ZIP and IE Eircode datasets in without touching call-sites.
- **Change (recommended: option A — null-and-fall-back).**
  - For non-UK: `userCentroid = null` → `distance_km = null` → ranking falls back to `published_at DESC` (current implicit behaviour). No fake distances.
  - For UK: unchanged.
  - Postcode input on the Trade Centre header should be relabelled "Postcode / ZIP" when the selected country is not UK (small copy tweak in `NexCentreLiveFeed.tsx` FilterPanel).
- **Change NOT chosen (option B).** Import a full US ZIP centroid table and IE Eircode routing key lookup. Rejected here because (a) discovery is paused so we don't need it yet, (b) it's a data-vendoring decision Philip should make explicitly, and (c) the honest null degrade is the smaller change.
  - **Choose-one moment for Philip:** approve option A (null degrade, this slice) OR promote option B into a follow-up slice with a data source Philip approves.
- **Acceptance criteria.**
  - UK ZIP `"M20"` still returns UK-region-ranked results (regression snapshot: same top 10 as today).
  - US ZIP `"10001"` returns non-null items with `distance_km = null` on every card. Ranking = `published_at DESC` (or existing promoted rank).
  - IE Eircode `"D02 XY01"` behaves the same as US.
  - No "unknown location" error to the user.
- **Risk & blast radius.** Low. Touches ranking. Snapshot the current UK top-10 for one representative query before merging; regression-test after.
- **Rollback.** Revert `indexForSearch.ts` to import `centroidOf` directly.
- **Depends on.** P0-2 (country is on the filter).

### Slice P1-2 · Country-aware address renderer + kill `?? "UK"` fallbacks
- **Goal.** Six literal `?? "UK"` fallbacks stop rendering on non-UK cards; addresses format per country conventions.
- **Files (new).**
  - `src/lib/nex/geography/formatAddress.ts` — pure formatter, one function `formatMerchantLocation({ city, county, postcode_prefix, region, country })`.
- **Files (touched — every `?? "UK"` site from audit §3a).**
  - `src/lib/nex/centre-publishing/directorySeedLoader.ts:423` (`location = seed.town ?? ... ?? "UK"`)
  - `src/components/nex-app/centre/NexCentreLiveFeed.tsx:1005` (product-card location line)
  - `src/components/nex-app/centre/ProductDetailsSheet.tsx:55`
  - `src/components/nex-app/centre/MerchantProfileSheet.tsx:134`
  - `src/components/nex-app/refacing/TradeProfileSheet.tsx:46`
  - `src/app/nex-app/refacing/companies/client.tsx:391`
  - Plus the profile page: `src/app/nex-app/trade/[slug]/page.tsx:103` (`[town, county, postcode]` join)
  - And the claim page: `src/app/nex-app/claim/page.tsx` (`[town, postcode]` join — verify line)
- **Change.**
  - Central formatter:
    - `country="GB"` → `[city, county, postcode_prefix]` joined with `, ` (existing UK look preserved).
    - `country="IE"` → `[city, county, postcode_prefix]` joined with `, ` (Eircode routing key stays as-is; town+county de-dupe when equal, e.g. "Dublin, Dublin" → "Dublin").
    - `country="US"` → `[city, `${regionOrStateCode} ${postcode_prefix}`]` joined with `, ` (e.g. "Austin, TX 78701"). State comes from the `region` field, not `county`.
    - Fallback (country unknown or missing): `[city, postcode_prefix]` joined with `, ` — never the literal string "UK".
  - Small country flag chip next to the location line (SVG or emoji) so a user glancing at a US card sees a flag and doesn't have to parse an unfamiliar address format.
- **Data-flow / query changes.** None — formatter reads existing fields on `CentreFeedItem` + directly on `DirectorySeed` where the profile page reads the seed row.
- **Acceptance criteria.**
  - Zero occurrences of the literal string `"UK"` as a fallback rendered in any of the six touched files (grep the built bundle if paranoid).
  - US card renders "Austin, TX 78701" (given `region="TX"`, `town="Austin"`, `postcode="78701"`).
  - IE card renders "Cork, Co. Cork, T12 XY01" (or "Cork, T12 XY01" if county == town de-dupe kicks in).
  - UK card unchanged.
  - Card with country=null and no town or postcode: renders empty (renders nothing rather than "UK").
- **Risk & blast radius.** Medium. Touches ~7 call sites and one formatter. Keep the formatter pure + snapshot-tested. Worst case: one card renderer forgets to consume the formatter and still shows raw `[town, county, postcode]` — cosmetically OK but inconsistent.
- **Rollback.** Restore `?? "UK"` fallbacks; delete formatter.
- **Depends on.** P0-2 (fields exist on `CentreFeedItem`).

### Slice P1-3 · SEO metadata: country-aware (kill hardcoded "UK staircase trade")
- **Goal.** No US or IE trade-profile page has "UK staircase trade" in its meta description.
- **Files.**
  - `src/app/nex-app/trade/[slug]/page.tsx:84` — `const parts = [listing.business_name, listing.town, "UK staircase trade"]` → derive the last part from `listing.country`.
- **Change.**
  - New helper (co-located in `formatAddress.ts` or a `seoLabel.ts`): `staircaseTradeLabel(country) → "UK staircase trade" | "USA staircase trade" | "Ireland staircase trade" | "Staircase trade"` (fallback).
  - Metadata title stays business_name + "· NEX Trade Centre" (country-neutral).
  - Description: `${parts.join(" · ")}. Directory profile on NEX. Claim this business to take control of its NEX presence.` — with the last part now country-derived.
- **Acceptance criteria.**
  - View source on a US profile: `<meta name="description">` contains "USA staircase trade" (or the friendly variant), never "UK".
  - Same for IE and UK.
  - No other `generateMetadata` in Trade Centre paths hardcodes country (grep confirms).
- **Risk & blast radius.** Very low. Metadata only, one file.
- **Rollback.** Revert the one line.
- **Depends on.** Nothing hard — reads `listing.country` which is already selected in `loadListing`.

### Slice P1-4 · AskNex system prompt: inject customer's selected country
- **Goal.** A US customer asking AskNex is not told they're on a UK marketplace and doesn't get £ / UK-English framing they didn't ask for.
- **Files.**
  - `src/app/api/nex/centre-search/route.ts:35, 45` — SYSTEM prompt currently hardcodes "a UK marketplace" and "UK English throughout (colour, favour, tyre, £, mm, kg)".
- **Change.**
  - Accept a `country?: string` field on the POST body (client sends the selected country from the same store P0-4 introduced).
  - Convert `SYSTEM` from a constant string to a function `buildSystemPrompt({ country })` that swaps the "UK marketplace" line + spelling / currency guidance based on country:
    - `country="GB"` (default when omitted): current UK-English + £ prompt.
    - `country="US"`: "a marketplace where homeowners and trades find suppliers, products, services, projects and deals." + US English (color, favor, tire, $, in, lb) + no unit metric assumptions.
    - `country="IE"`: UK-English spelling but € currency and metric units.
    - `country="all"` or unknown: country-neutral wording; do not adopt any single country's spelling; use $ / £ / € examples sparingly.
  - Add a guardrail: never claim "this is a US-only marketplace" (or IE-only, or UK-only). The picker exists — never lie about it.
- **Acceptance criteria.**
  - POST `/api/nex/centre-search` with `{ query: "kitchen refacing near me", country: "US" }` → reply uses US spelling + no £.
  - Same with `country: "GB"` → reply uses UK spelling + £.
  - Same with `country: "IE"` → reply uses UK-spelling + €.
  - Same with `country: "all"` → reply is country-neutral, never introduces a country the user didn't mention.
  - Never contains the phrase "UK marketplace" for a non-UK country.
- **Risk & blast radius.** Medium. This is the closest thing in the plan to a NEX-brain touchpoint — but it's a Trade-Centre-owned route, not the conversational NEX brain, so it stays out of the M4 freeze scope. If Philip disagrees, this slice can be deferred with zero blocking impact on P0.
- **Rollback.** Revert the SYSTEM constant to the current string.
- **Depends on.** P0-4 (client has the country to send).

---

## 2. Country-picker design spec

### Component
- **Name:** `CountryPicker`
- **File:** `src/components/nex-app/centre/CountryPicker.tsx`
- **Data module:** `src/lib/nex/geography/countries.ts`
- **Store module:** `src/lib/nex/geography/countryStore.ts`

### Panel layout (open state)

```
┌───────────────────────────────────────────────┐
│ CHANGE MARKET                             [×] │
├───────────────────────────────────────────────┤
│ ⚪ All countries                       [896]  │  ← pinned
├───────────────────────────────────────────────┤
│  EUROPE                                       │
│  🇬🇧 United Kingdom                   [471]   │
│  🇮🇪 Ireland                           [50]   │
│  🇩🇪 Germany · coming soon                    │  ← disabled
│  🇫🇷 France · coming soon                     │
├───────────────────────────────────────────────┤
│  NORTH AMERICA                                │
│  🇺🇸 United States                    [375]   │
│  🇨🇦 Canada · coming soon                     │
├───────────────────────────────────────────────┤
│  APAC · MEA · SOUTH AMERICA · coming soon    │
└───────────────────────────────────────────────┘
```

- "All countries" pinned at top with the total count.
- Regions grouped with capitalised region headings.
- Active countries: flag + name + count chip.
- Coming-soon countries: flag + name + subtle "coming soon" · disabled + not focusable.
- Empty region groups (APAC, MEA, South America) collapsed into a single "coming soon" strip at the bottom so the picker still communicates the international shape from day one.

### Data model (`src/lib/nex/geography/countries.ts`)

```ts
export type CountryCode = "GB" | "IE" | "US" | "DE" | "FR" | "CA" /* future */;
export type RegionGroup = "Europe" | "North America" | "APAC" | "MEA" | "South America";

export type Country = {
  code: CountryCode;
  name: string;                    // "United Kingdom"
  short_name?: string;             // "UK" — used in dense chips
  db_value: string;                // canonical directory_seeds.country value: "United Kingdom" | "Ireland" | "USA"
  region_group: RegionGroup;
  region_label: string;            // shown on the panel row (usually same as region_group)
  currency: "GBP" | "EUR" | "USD" | "CAD";
  address_format: "GB" | "IE" | "US" | "CA";
  flag: string;                    // emoji or SVG key
  active: boolean;                 // true = selectable, false = coming soon
};

export const COUNTRIES: Country[] = [
  { code: "GB", name: "United Kingdom", short_name: "UK",
    db_value: "United Kingdom", region_group: "Europe", region_label: "Europe",
    currency: "GBP", address_format: "GB", flag: "🇬🇧", active: true },
  { code: "IE", name: "Ireland",
    db_value: "Ireland", region_group: "Europe", region_label: "Europe",
    currency: "EUR", address_format: "IE", flag: "🇮🇪", active: true },
  { code: "US", name: "United States", short_name: "USA",
    db_value: "USA", region_group: "North America", region_label: "North America",
    currency: "USD", address_format: "US", flag: "🇺🇸", active: true },
  // coming soon
  { code: "DE", name: "Germany", db_value: "Germany", region_group: "Europe",
    region_label: "Europe", currency: "EUR", address_format: "GB", flag: "🇩🇪", active: false },
  { code: "FR", name: "France", db_value: "France", region_group: "Europe",
    region_label: "Europe", currency: "EUR", address_format: "GB", flag: "🇫🇷", active: false },
  { code: "CA", name: "Canada", db_value: "Canada", region_group: "North America",
    region_label: "North America", currency: "CAD", address_format: "CA", flag: "🇨🇦", active: false },
];
```

Region groups (APAC, MEA, South America) rendered as a bottom "coming soon" strip if no country in the array carries them — cheaper than empty group headings.

### Persistence
- `localStorage.nex_selected_country` — key locked. Value = `CountryCode | "all"`.
- Cookie `nex_selected_country` set alongside — same value shape, for future SSR reads. **This plan does NOT rely on the cookie server-side**; it's set for later.
- Read priority chain (documented in `countryStore.ts`):
  1. URL `?country=<code>` (if valid) — one-tap deep link, does NOT persist unless the user actively picks.
  2. `localStorage.nex_selected_country`
  3. IP default via `resolveLocation({ ip_country })` → normalise to `CountryCode` → only kept if the IP resolves to a currently active country. Otherwise defaults to `"all"`.
  4. `"all"` (final fallback).

### IP default resolution flow
- Fired ONCE per browser (first visit only). Result persisted to localStorage.
- Uses existing `resolveLocation` at `src/lib/nex/world/location.ts:51-126` — reuses that chain, does not add a new IP dependency.
- **Never** a content restriction — once persisted, the user's choice wins forever until they change it.
- "Change market" affordance = the trigger button itself; always visible in the header on every mounted surface.

### Accessibility
- Trigger button: `aria-haspopup="dialog" aria-expanded={open}` + visible label.
- Panel: `role="dialog" aria-modal="true" aria-labelledby="country-picker-title"`.
- Each active option: `<button role="menuitemradio" aria-checked={selected===code}>` with proper focus ring.
- Disabled ("coming soon") entries: `aria-disabled="true"` + `tabIndex={-1}`.
- Escape closes; Enter/Space activates focused option; Arrow Up/Down moves focus within the panel; Tab moves focus but the panel captures Tab as focus-trap while open.
- Focus returns to the trigger button on close.

### Mobile behaviour
- Under 640px: panel becomes a bottom sheet occupying full width + 60vh, with a drag handle at the top for close.
- 640px+: panel is a dropdown anchored to the trigger, ~360px wide, ~500px max height with internal scroll.

---

## 3. Geography / location architecture

### Where country lives
- **URL:** country is NOT in the canonical URL. Optional `?country=<code>` as a hint (used by shared links / marketing campaigns). Not written to the URL by the picker itself.
- **State:** in component state on the Trade Centre surfaces (part of `filters`); read once at mount from `countryStore.get()`, written on change via `countryStore.set()`.
- **Persistence:** `localStorage.nex_selected_country` + cookie of the same name.

### Filter state shape (per surface, additive to today's)
```ts
type CentreFilters = {
  query?: string;
  category?: string;             // trade
  capability?: string;           // e.g. "refacing"
  postcode?: string;
  min_price_pence?: number;
  max_price_pence?: number;
  country?: CountryCode | "all"; // NEW
  region?: string;               // NEW (per-country region code)
  verified_only?: boolean;
  sort?: "featured" | "newest" | "distance";
  limit?: number;
  offset?: number;
};
```

Filter order (locked per architecture rule): `country → region → trade → capability → other`.

### API query shape (Supabase filter chain)
```ts
let q = supabaseAdmin.from("directory_seeds").select("*");
if (filters.country && filters.country !== "all") {
  q = q.eq("country", COUNTRIES.find(c => c.code === filters.country)!.db_value);
}
if (filters.region) q = q.eq("region", filters.region);
if (filters.category) q = q.eq("category", filters.category);
if (filters.capability) q = q.eq(`capabilities->>${filters.capability}`, "yes");
// … existing price / order / range …
```

### Proximity degradation for non-UK (recommended: option A)
- **Option A (recommended, this plan).** When `country !== "GB"`, set `userCentroid = null` and let `distance_km = null` on every card. Ranking falls back to `published_at DESC` (already the implicit fallback). Zero fake distances rendered.
- **Option B (deferred).** Vendor a US ZIP centroid dataset (~42,000 ZIPs → lat/lng, ~2MB compressed) and an IE Eircode routing key lookup (~139 keys). Wire into a single resolver. Not blocked by anything technical — blocked by "do we want to own that data yet?" — Philip's call.

### Address rendering
- Single pure formatter at `src/lib/nex/geography/formatAddress.ts`. Each call site imports and calls it once with the seed's country. See Slice P1-2 for the per-country rules.

---

## 4. Refacing fix

### Before (current query at `refacing/companies/client.tsx:153`)
```
GET /api/nex/centre/feed?category=Staircase Refacing&limit=100
→ directory_seeds WHERE category = 'Staircase Refacing'
```
This misses US refacing rows because the US import mapped refacing specialists under the plain `Staircase` category (per audit §3g note — verify with a spot query before shipping).

### After (Slice P0-5)
```
GET /api/nex/centre/feed?capability=refacing&country=<selected>&limit=100
→ directory_seeds
   WHERE (
     capabilities->>'refacing' = 'yes'
     OR business_type IN ('REFACING_SERVICE_SPECIALIST',
                          'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER')
   )
   [AND country = <db_value>]
```

### Ensuring the 14 US directly-evidenced refacing records appear
- Confirm they carry `capabilities.refacing='yes'` (they should — that's what "directly-evidenced" means in the audit's Stage-4 shape). If any don't, the fallback OR-clause on `business_type` catches them. No production data change required.

### Keeping the 58 unverified Stage-2 US refacing claims OUT of the public surface but visible in admin review
- **Do NOT** run a promotion script that flips their `capabilities.refacing` to `'yes'`. Leave the DB rows exactly as they are.
- The customer surface uses the query above — unverified Stage-2 hints (which live in `refacing_qualification.hint` or provenance notes rather than `capabilities.refacing='yes'`) never satisfy the WHERE clause.
- Admin surfaces (out of scope for this plan) can continue to query `refacing_qualification` / provenance to review unverified claims.

### What breaks if we get the capability query subtly wrong
- False positives: a staircase manufacturer with `capabilities.refacing='yes'` but no real refacing service surface unexpectedly. Mitigation: business_type filter narrows this — audit the diff between the two queries before shipping.
- False negatives: a UK refacing company that has `capabilities.refacing` unset but `category='Staircase Refacing'` disappears. Mitigation: run both queries and confirm the UK set from the new query is a superset of today's. If not, add `OR category='Staircase Refacing'` to the WHERE clause as a transitional safety net (document + plan to remove later).

---

## 5. Address rendering strategy

### Formatter table (`src/lib/nex/geography/formatAddress.ts`)

| Country | Compact card format | Full profile format | Notes |
|---------|---------------------|---------------------|-------|
| GB      | `Manchester, M20` (city or postcode-prefix) | `Manchester, Greater Manchester, M20 2AB` | Unchanged from today. |
| IE      | `Cork, T12` | `Cork, Co. Cork, T12 XY01` | Prefix county with "Co." when free-text county == town (Dublin/Dublin), de-dupe to a single label. |
| US      | `Austin, TX` | `Austin, TX 78701` | State comes from `region`, not `county`. County dropped entirely from card + profile display. |
| CA      | (coming soon) | (coming soon) | Same shape as US: `City, PROV POSTAL`. |
| unknown | `city` or `postcode_prefix` or "" | `[city, postcode_prefix]` joined | Never render literal "UK". Return empty string if both fields empty. |

### Where the formatter lives
- One file: `src/lib/nex/geography/formatAddress.ts`.
- Exported functions:
  - `formatCardLocation({ merchant_country, merchant_city, merchant_region, merchant_postcode_prefix })`
  - `formatProfileLocation({ country, city, county, region, postcode })`

### Migration path from the six literal `?? "UK"` sites
See Slice P1-2 for the file:line map. Every touched call site swaps the inline three-way `??` for a single `formatCardLocation(item)` or `formatProfileLocation(seed)` call. Snapshot tests per country per surface.

---

## 6. SEO / language fixes

### Metadata: static vs dynamic
- **Safe to leave static:** the site-wide `<title>` template, the top-level `/nex-app/centre` page metadata (it's a marketplace overview — country-neutral wording).
- **Must become dynamic:** every per-listing / per-profile metadata generator that mentions a country.
  - `src/app/nex-app/trade/[slug]/page.tsx:84` — the only site of the "UK staircase trade" literal, per audit.
- **Grep to run before merge:** any remaining `"UK "` or `" UK"` literal inside a `generateMetadata` function in the Trade Centre paths (should be zero after P1-3).

### AskNex prompt template (proposal for Slice P1-4)
```
buildSystemPrompt({ country }) => `
You are NEX, the search assistant for NEX Trade Centre — ${marketplacePhrase(country)}.

When a user asks a question, respond with a short helpful message (2-3 sentences maximum) that:
- Restates the intent in plain English so the user knows you understood
- If Brain matches are supplied below, refer to them naturally and note that a diagram is attached when relevant
- If no Brain matches, suggest 1-2 categories or filters to narrow the search (Products · Suppliers · Services · Projects · Deals)
- If the query is vague, ask ONE clarifying question

Rules:
- ${spellingRule(country)}
- ${currencyRule(country)}
- Never invent specific supplier names, prices, addresses or listings
- Never mention that you are an AI, LLM, model or system
- Warm workshop tone: direct, useful, no fluff
`;
```

Where `marketplacePhrase`, `spellingRule`, `currencyRule` are small pure helpers derived from `COUNTRIES[code]`. `"all"` → country-neutral wording.

### Guardrail
- Server-side assert: the resolved prompt for a US customer must NOT contain the exact substring "UK marketplace" (or "USA marketplace" for a UK customer). Add a one-line test.
- Never introduce a country the user did not select. When `country="all"`, the prompt must avoid all national qualifiers ("UK", "USA", "Ireland") entirely.

---

## 7. Testing & acceptance criteria

### Per-slice tests (summary — see each slice for detail)
| Slice | Manual test | Automated test |
|-------|-------------|-----------------|
| P0-1  | Tick "Verified only" as US user → rows still visible, hint shown | Unit: filter block returns input unchanged when zero verified rows |
| P0-2  | curl `/api/nex/centre/feed?country=US` → 375 rows | Vitest on directorySeedLoader with mocked db returning per-country counts |
| P0-3  | Storybook page renders picker; keyboard + focus trap OK | Playwright: open picker, arrow-key, select, close |
| P0-4  | First visit from US IP → USA default; change → persists; refresh → sticky | Playwright: mock IP, mount surface, assert selected + fetched rows |
| P0-5  | `/nex-app/refacing/companies` with country=USA → 14 rows (or more if IE refacing exists) | Vitest: capability query returns superset of current category query for UK |
| P1-1  | UK ZIP still ranks correctly; US ZIP shows null distance | Snapshot: top-10 UK results unchanged; distance_km null for non-UK |
| P1-2  | grep bundle for literal `"UK"` fallback — zero hits | Vitest snapshot per country per surface |
| P1-3  | View-source on US profile → no "UK staircase trade" | Vitest: staircaseTradeLabel per country |
| P1-4  | POST centre-search with country=US → response uses US spelling + $ | Vitest: buildSystemPrompt per country + guardrail assertion |

### End-of-plan smoke checklist
- [ ] Land on Trade Centre from a US IP (first visit) → USA default, US rows visible, correct address format ("Austin, TX 78701"), country picker shows "🇺🇸 United States".
- [ ] Change market to Ireland → IE rows visible, Eircode format ("Cork, Co. Cork, T12 XY01"), selection persisted after reload.
- [ ] Change market to "All countries" → 896 rows accessible via the feed, header trigger reads "All countries".
- [ ] Refacing surface with each country selection shows only that country's refacing companies; USA shows the 14 directly-evidenced records; UK shows current UK refacing set (no regression).
- [ ] `verified_only` no longer hides all non-UK rows — hint appears + rows remain visible.
- [ ] `Grep '?? "UK"'` in `src/**/*.{ts,tsx}` returns zero hits inside Trade Centre paths.
- [ ] AskNex greets a US user with US wording; a UK user with UK wording; an "all" user country-neutrally. Never contains "UK marketplace" for a non-UK country.
- [ ] View source on one US, one IE, one UK profile page: metadata description does not hardcode "UK staircase trade" for the non-UK two.
- [ ] All 896 rows still reachable exactly as before when the picker is set to "All countries".

---

## 8. Risks & things not to change

### Hard "do not touch"
- **Do NOT change the 896 production rows** in `directory_seeds`. Every slice fixes filters, UI, or types — never data.
- **Do NOT re-run discovery.** Discovery is paused.
- **Do NOT touch NEX brain / M4 / conversation-learning / knowledge-inbox / claim-review UI.**
- **Do NOT touch M6 (member conversion).** No claim-flow, Stripe, or member dashboard work in this plan. Wait for real claim traffic.
- **Do NOT create per-country routes.** `/uk`, `/usa`, `/ireland` are banned. The picker + filter is the ONLY country dimension.
- **Do NOT promote unclaimed rows to `verified=true`** to work around Slice P0-1. Fix the filter — never the data.
- **Do NOT touch the `/tc/…` fixture app** (`src/app/tc/…` uses `findTradeProfile` on `data/tc-fixtures.ts` — separate scope, out of this plan).
- **Do NOT change the currency formatter** in this pass — directory records have `price_pence=0` and the £ formatter doesn't render on any card as a result. Slate for a future slice when real multi-country priced products exist.
- **Do NOT add a `service_area_countries` column** in this pass. Get country visibility right first; multi-country service area is a Slice-8+ conversation.

### Soft "watch out for"
- Cookie / localStorage collision with any other future country-related storage. Lock the key `nex_selected_country` in `countryStore.ts` and document it.
- The IE de-dupe in the address formatter ("Dublin, Dublin" → "Dublin"): make sure it doesn't accidentally suppress "Cork, Co. Cork" (which reads correctly). Add snapshot test.
- The Refacing capability query in P0-5: if the fallback OR-clause is missing and a UK refacing row has `capabilities.refacing` unset, we regress UK visibility. Diff the two query results before shipping and hold if the delta looks wrong.
- The AskNex prompt in P1-4 is the closest thing here to a NEX-brain touchpoint. If Philip reads that slice as brain-adjacent, defer P1-4 with zero blocking impact on P0.

---

## 9. Rough effort shape

| Slice | Size | Notes |
|-------|------|-------|
| P0-1 | S  | Minutes. One filter block. |
| P0-2 | M  | Type + loader + API. Additive, but many files. |
| P0-3 | M  | New component + data module + a11y + mobile sheet. |
| P0-4 | M  | Wire-up on two surfaces + persistence + IP-default flow. First visible change. |
| P0-5 | S  | Query switch + one server helper. Guarded by a query diff before merge. |
| P1-1 | S  | Wrap `centroidOf`; null degrade for non-UK. |
| P1-2 | M  | Formatter is small; ~7 call sites to update. |
| P1-3 | XS | One line. |
| P1-4 | S  | Prompt refactor + guardrail. Deferrable if Philip flags brain-adjacency. |

- **Biggest visible impact per line of code:** P0-1 alone (one filter block) removes the "verified_only silently deletes 425 rows" trap immediately, even before the picker ships.
- **First moment USA is visibly reachable:** P0-2 + P0-4 combined. P0-1 helps but is invisible until the picker exists.
- **Pure cleanup once USA is visible:** P1-2, P1-3, P1-4 (all are correctness / language fixes with no new capability).

---

## 10. What Philip approves next

**Explicit single ask:** _Approve slices P0-1 through P0-5 for implementation, in order._

If Philip wants a smaller first bite: _Approve P0-1 (verified filter fix) as a same-session ship, then approve P0-2 through P0-5 as a follow-up._

Two moments in this plan where I picked one of two reasonable options and want Philip's steer:
1. **Slice P1-1 chose Option A (null distance for non-UK)** over Option B (vendor US ZIP + IE Eircode centroid tables). Recommend Option A for now; escalate to B only when Philip decides to own that data.
2. **Slice P0-5 uses `capabilities->>'refacing'='yes'` plus a `business_type` OR-clause fallback**, not the alternative of updating US seed rows to carry `category='Staircase Refacing'`. Recommend the filter-side fix; user memory locks "capability as first-class" so this stays consistent with the two-dimension schema rule.

P1-1 through P1-4 do not block P0 and can be approved in the same batch or held back for a later pass. P1-4 (AskNex prompt) is the only slice with any brain-adjacency; defer if in doubt.
