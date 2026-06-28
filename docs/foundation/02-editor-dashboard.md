# Tradesperson Editor & Dashboard — Foundation Reference

> Every feature a logged-in tradesperson can configure on their own profile.
>
> Scope: signup -> magic-link edit dashboard -> all sub-pages and components under
> `src/app/trade-off/` and `src/components/trade-off/`. Anchored to file paths.
> Labels: **[fact]** = read directly from source, **[obs]** = inferred from
> surrounding code/comments.

---

## 1. Auth model

**File anchor**: `src/app/trade-off/edit/[slug]/page.tsx:33-54`

- **[fact]** No Supabase Auth, no password, no session cookie. Authentication
  is a per-listing **`edit_token`** string stored on
  `hammerex_trade_off_listings.edit_token`.
- **[fact]** Every dashboard sub-page is a Next.js server component that:
  1. Reads `searchParams.token` from the URL,
  2. Looks up the listing by `slug`,
  3. Compares `row.data.edit_token !== token` — bad/missing token renders
     `<InvalidLink reason="..." />` with a WhatsApp escape hatch
     (`src/app/trade-off/edit/[slug]/page.tsx:579-612`).
- **[fact]** `src/app/api/trade-off/update/route.ts:24-29` uses
  `crypto.timingSafeEqual` for constant-time token compare on writes.
- **[fact]** Token is created server-side at signup (Supabase default,
  presumably gen_random_uuid or column default — never minted in JS) and
  returned in the `create` response body
  (`src/app/api/trade-off/create/route.ts:177-179`,
  `src/app/api/trade-off/create/route.ts:235-245`).
- **[fact]** "Magic link" = `https://xratedtrade.com/trade-off/edit/<slug>?token=<edit_token>`.
  Surfaced once on the `/trade-off/signup/done` page
  (`src/app/trade-off/signup/done/page.tsx:158-186`) with copy-to-clipboard.
  The done page tells the user: "We don't email you a password. This link is
  the only way back into your profile. Bookmark it." (line 163-167).
- **[obs]** State: client form state is local React state in `TradeOffForm`
  and `PremiumCustomisationPanel`. Server state lives in
  `hammerex_trade_off_listings`. Each save is a full POST — no optimistic
  client cache.

---

## 2. Signup flow

### Routes
- `src/app/trade-off/signup/page.tsx` — public hero + intro copy
  (line 27-44), then mounts `<TradeOffForm mode={{ kind: "create" }} />`.
- `src/app/trade-off/signup/done/page.tsx` — post-submit confirmation, shows
  share URL (line 121-156), edit link (line 158-186), QR download
  (line 146-153), optional Welcome Knife voucher popup (line 78-84).

### Form fields (single-screen vertical, not a stepper)

File: `src/app/trade-off/signup/TradeOffForm.tsx`

Field list with type / behaviour (one-line per field):

- `primary_trade` — `<select>` from `TRADE_OFF_TRADES`, REQUIRED (TradeOffForm.tsx:647-668).
- `slug` — vanity URL via `<SlugAvailabilityField>`; debounced live availability check (TradeOffForm.tsx:669-687).
- `display_name` — text, REQUIRED; mirrored to `trading_name` on save (TradeOffForm.tsx:372-376).
- `avatar_url` — image upload via `/api/trade-off/upload-photo`, rendered with sample Trust Score ring preview at 85/100 (TradeOffForm.tsx:716-820).
- `custom_app_hero_url` — banner upload, 16:9 sample image watermarked "SAMPLE IMAGE" when empty (TradeOffForm.tsx:823-900).
- `city` — text, REQUIRED.
- `country` — text, defaults "United Kingdom" (TradeOffForm.tsx:139).
- `postcode_prefix` — optional, max 16 chars.
- `service_radius_km` — chip picker 10/15/.../50 km plus "All areas" plus custom number (TradeOffForm.tsx:936-992); empty string sends `null` on save.
- `whatsapp` — REQUIRED, via `<PhoneCountryInput>` (auto-detects country via `/api/geo`, PhoneCountryInput.tsx:7-15); requires >=7 digits.
- `phone` — optional, same widget; blank hides Business Card phone row.
- `email` — REQUIRED, regex `/.+@.+\..+/` (TradeOffForm.tsx:204-207).
- `website`, `instagram`, `facebook`, `tiktok`, `youtube`, `twitter`, `snapchat`, `reddit`, `google` — 9 social URLs as a coloured chip grid via `TRADE_SOCIAL_FIELDS` (TradeOffForm.tsx:1039-1070).
- `bio` — textarea, REQUIRED, min 60 chars, max 1200 (TradeOffForm.tsx:1074-1083).
- `years_in_trade` — number, optional (start_year removed per design, TradeOffForm.tsx:1094-1096).
- `video_url` — 30 MB / 60 s MP4/MOV/WebM upload via `<VideoUploadInput>` (only renders in `edit` mode, signup tells them to come back later, TradeOffForm.tsx:1108-1130).
- `photos` — gallery 1-6 images. Each promotes-to-cover (TradeOffForm.tsx:326-334), reorder via `movePhoto` (TradeOffForm.tsx:308-316). REQUIRED >= 1.
- `starter_products[]` (merchant-grade trades only) — 4 starter slots, each with name / cover / 3 gallery / price / description / multi-buy tiers x2 / variant axis (size/colour/model/material/custom) + up to 5 rows / per-product FAQ x3.
- `retail_shipping_mode` / `retail_shipping_uk_pounds` / `retail_shipping_international[]` — merchant shop delivery picks (TradeOffForm.tsx:106-128, 422-454).

### Validation rules

- `TRADE_OFF_REQUIRED_FIELDS` enumerated in `@/lib/tradeOff` and re-checked
  client-side in `TradeOffForm.tsx:214-225` AND server-side in
  `src/app/api/trade-off/create/route.ts:103-108`.
- Completeness banner shows missing fields and the count
  (TradeOffForm.tsx:622-638). When all fields pass, banner self-hides — the
  Submit button becomes the only signal.
- Server demands `display_name`, `city`, `email`, `whatsapp` even for drafts
  (create/route.ts:111-131).

### What gets created in Supabase on submit

- **[fact]** `hammerex_trade_off_listings` row (create/route.ts:175-179).
  Status auto = `live` if `missing.length === 0`; else `draft`
  (create/route.ts:133).
- **[fact]** `bio` placeholder `"(draft)"` written when blank because the
  column is NOT NULL (create/route.ts:156).
- **[fact]** `primary_trade` falls back to `"general-builder"` when not set
  (create/route.ts:157).
- **[fact]** Geocoding via `geocodeListing()` — best-effort, swallowed on
  failure (create/route.ts:135-150).
- **[fact]** Slug collision retry: up to 5 attempts; first try uses the
  vanity slug, retries use `buildListingSlug + shortSuffix`
  (create/route.ts:161-174).
- **[fact]** `startTrialFor(listing.id)` auto-starts the 30-day Xrated App
  trial (create/route.ts:185-190).
- **[fact]** `recomputeHammerexStandard(listing.id)` auto-runs to match the
  listing against historical quote requests (create/route.ts:192-197).
- **[fact]** Welcome Knife voucher: `hammerex_xrated_vouchers` row inserted
  only when listing goes live on first submit, retried up to 3x on unique
  collision (create/route.ts:199-233).
- **[fact]** Merchant trades trigger two extra POSTs **after** the listing
  creation: `postShopDelivery()` to `/api/trade-off/listings/retail-shipping`
  (TradeOffForm.tsx:422-454) and `postStarterProducts()` to
  `/api/trade-off/products/upsert` per product (TradeOffForm.tsx:461-547).

### Trade pre-selection from `?trade=` query

- **[obs]** Not found in `signup/page.tsx` — the page mounts the form with
  empty initial state. Trade pre-selection from a URL param does not appear
  to be wired through to `TradeOffForm` props. The slug-picker honours
  whatever was set in state already; if `?trade=...` deep-linking is wanted,
  it would need to be added.

### Tier pre-selection from `?tier=` query

- **[obs]** Not present in the signup page. Tier is set server-side: every
  new listing gets `app_trial` for 30 days via `startTrialFor`
  (create/route.ts:184-190). The Upgrade route (`/trade-off/upgrade`) is a
  separate flow.

---

## 3. Edit dashboard layout

### File: `src/app/trade-off/edit/[slug]/page.tsx`

- **[fact]** This is the **Profile dashboard** — the canonical landing for
  the edit_token magic link.
- **[fact]** Server-side flow: validate token (line 45-54) -> lazy-expire
  tier with `maybeExpireListingTier` (line 57) -> compute `effectiveTier`
  (line 65-68) -> fetch latest voucher (line 74-83) -> map row -> render.
- Layout, top to bottom:
  1. `<XratedHeader />` (shared marketing nav, line 194).
  2. `<DashboardDrawer slug={slug} token={token} current="profile" />` — the
     burger nav (line 195).
  3. Step pill + `<h1>App Details</h1>` + status banner if status != live
     (line 196-223).
  4. `<PremiumCustomisationPanel />` if tier is `app_trial`/`app_paid`,
     otherwise an upgrade CTA card (line 256-400).
  5. `<TradeOffForm mode={{ kind: "edit", slug, editToken, listingId }} />`
     as the bottom-of-page save action (line 407-417).
  6. `<XratedFooter />`.

### Top-level sections / tabs

The drawer (`DashboardDrawer.tsx:51-89`) is the global nav. Five items plus
"View live profile":

| Drawer item | Route | Purpose |
| --- | --- | --- |
| Profile dashboard | `/trade-off/edit/<slug>` | Identity / trust / services / hours / FAQ |
| App Studio | `/trade-off/edit/<slug>/app-studio` | Theme + hero anims |
| Add-ons | `/trade-off/edit/<slug>/add-ons` | Sell products, custom domain, alerts |
| Sharing | `/trade-off/edit/<slug>/sharing` | Business card + Lead Alerts |
| Insights | `/trade-off/edit/<slug>/insights` | Trust Score gauge, tier, voucher |
| View live profile | `/<slug>` (external tab) | Customer view |

### Auto-save behaviour

- **[fact]** `PremiumCustomisationPanel` does NOT auto-save — it has a busy
  state and an explicit Save (PremiumCustomisationPanel.tsx:180-181).
- **[fact]** `AppStudioPanel` auto-saves. On every successful save it
  dispatches a `window` `appstudio:saved` CustomEvent
  (`LivePreviewIframe.tsx:22-27`); the iframe bumps a revision counter and
  reloads with a `?_studio=<n>` cache-buster (LivePreviewIframe.tsx:34).
- **[fact]** `RetailShippingEditor` uses a 250 ms per-field debounce
  (`RetailShippingEditor.tsx:5-12`).
- **[obs]** Most sub-page editors (Downloads, FAQ, Job Diary, Materials
  Network, Custom Domain) save on explicit user action; drag-reorder fires
  immediately to the `*/reorder` route.

### Live preview iframe

- File: `src/components/trade-off/LivePreviewIframe.tsx`
- **[fact]** Only mounted on the App Studio sub-page
  (`app-studio/page.tsx:86-87` two-column grid).
- **[fact]** Hidden under the `lg` breakpoint (`hidden lg:block`,
  LivePreviewIframe.tsx:37).
- **[fact]** Refreshes on `appstudio:saved` events fired by `AppStudioPanel`.

### Preview mode bar

- File: `src/components/trade-off/PreviewModeBar.tsx`
- **[fact]** Sticky top bar shown ONLY when the public profile is loaded
  with `?preview=standard` (PreviewModeBar.tsx:8-25). Used as a trial-tail
  loss-aversion mechanic — a trial user can see what they lose.

---

## 4. Editor surfaces — one per component

All files live under `src/components/trade-off/`. Listed roughly in usage
order from main dashboard down to sub-pages.

### `PreviewModeBar.tsx`
- Sticky banner rendered on `/trade/<slug>?preview=standard` (line 8-25).
- **[fact]** Pure server render, no state.
- **[obs]** Used by trial expiry mechanics — also referenced by
  `LossAversionPreview.tsx` for the day-25 banner.

### `DashboardDrawer.tsx`
- Burger-menu nav drawer mounted on every edit sub-page.
- **[fact]** Token-bound — drawer items carry `?token=` (line 50-89).
- **[fact]** Locks body scroll while open (line 36-48).

### `FirstRunChecklist.tsx`
- 8-item progress card.
- **[fact]** Self-hides once all items done (per header comment, line 1-9).
- **[fact]** Scoring rules: bio>=50 chars, has avatar, photos>=3, services>=1,
  has hours, faq>=1, hero text set, trust signal earned (FirstRunChecklist.tsx:40-52).
- **[obs]** Not currently mounted on the main edit page — code comment at
  `src/app/trade-off/edit/[slug]/page.tsx:229-235` says checklist + Yard nav
  + Operating Hours card were removed from the main page because "they don't
  belong on a focused data-input page".

### `TradeOffForm.tsx`
- The signup + edit form. ~1500 lines of single-screen vertical UI.
- **[fact]** Updates `hammerex_trade_off_listings` columns directly via
  `/api/trade-off/create` or `/api/trade-off/update` (line 549-614).
- **[fact]** Merchant trades get inline starter-products + retail shipping
  posted to dedicated routes after listing save (line 422-547).
- **[fact]** Photos: 6-cap with promote-to-cover (line 326-334).
- **[fact]** Avatar preview hard-codes Trust Score "85" sample (line 766-790)
  — comment says "sample value 85 here for preview; on the live profile the
  real score drives it".

### `PremiumCustomisationPanel.tsx`
- Server-gated panel (only `app_trial`/`app_paid`). Edits:
  theme_color, button_text_color, cta_button_effect, hero_text_line1/2/tagline,
  hero_text_effect, avatar_frame_style, profile_placement, running_marquee,
  promo_text, accepting_jobs, phone_calls_enabled, services_offered[],
  priced_services[] (name/image/before-image/price/unit/description),
  faq_items[], operating_hours{day}, contact_form_enabled, visit_us_enabled,
  availability (Trades On Standby), headline_rate{amount,unit,currency},
  trust columns (is_insured, insurance_cover_gbp, qualifications[],
  trade_memberships[], dbs_checked, has_own_transport, has_own_tools,
  minimum_job_gbp, free_site_visits, quote_availability, quote_turnaround_hours,
  current_status_note, ready_date), and recommendations[] (Trusted Trades, capped 12).
- **[fact]** Progressive disclosure: `essentialsComplete` toggles advanced
  sections collapsed/open (PremiumCustomisationPanel.tsx:128-133).
- **[fact]** Merchant trades hide service-only sections and surface a
  "Manage products" CTA (line 120-126).
- **[fact]** Insurance + pricing unit use a sentinel-driven curated dropdown
  + "Other" custom input pattern (line 137-179).

### `AppStudioPanel.tsx` (under `src/app/trade-off/edit/[slug]/app-studio/`)
- Visual-only customisation; auto-saves; emits `appstudio:saved` events.
- **[fact]** Brand section (theme color, body text color, font_family,
  font_scale) applies to BOTH service and product templates via CSS
  variables (AppStudioPanel.tsx:7-13).
- **[fact]** Uses `<EffectTilePickers>` — animated live-preview tiles instead
  of text labels (EffectTilePickers.tsx:5-13).

### `EffectTilePickers.tsx`
- Animated tile pickers for CTA / Hero / Avatar effects. Keyframes mirror the
  production components — `XratedCtaButton`, `HeroTextOverlay`, `AvatarFrame`
  (EffectTilePickers.tsx:9-13 — comment: "Keep them in sync — these tiles are
  the contract").

### `LivePreviewIframe.tsx`
- Side-by-side live preview on `lg+` only. Cache-buster query bump on save.

### `ProjectManager.tsx`
- Verified Work Gallery editor on `/edit/<slug>/projects`.
- **[fact]** CRUD on `hammerex_trade_off_projects` via
  `/api/trade-off/projects/{create,update,delete,upload}`.
- **[fact]** Before/During/After photo uploads.
- **[fact]** Admin-only `verified` flag — public grid hides "pending" pill
  (ProjectManager.tsx:8-10).

### `ProjectGalleryGrid.tsx`
- Public render of the project gallery on `/trade/<slug>`. Per-card stage
  toggle is client state for accessibility (line 1-13).

### `ShopModeEditor.tsx`
- Product CRUD on `hammerex_xrated_products` for merchant tier. Reused by
  `/edit/<slug>/services-prices` with `kind='service'` so labour pricing
  re-uses the same surface.
- **[fact]** Drag-reorder via dnd-kit (PointerSensor + 250ms TouchSensor
  delay to avoid mobile mis-fires) (ShopModeEditor.tsx:38-55).
- **[fact]** Single-axis variants (size OR colour); axis locks once first
  row exists (ShopModeEditor.tsx:13-15).
- **[fact]** Size chart upload tied to enum of 5 units (ShopModeEditor.tsx:11-13).

### `ShippingZonesEditor.tsx`
- Per-country air/sea pricing for Shop Mode. Curated 30-country list, plus
  free 2-letter ISO entry (ShippingZonesEditor.tsx:35-66, server enforces
  `/^[A-Z]{2}$/`).

### `RetailShippingEditor.tsx`
- UK retail config (Free / Flat / Per-area) + international list-builder.
- **[fact]** 250 ms per-field debounce, full-replace save semantics
  (`RetailShippingEditor.tsx:5-11`).

### `WholesaleModeEditor.tsx` / `WholesaleZonesEditor.tsx` / `YardOriginEditor.tsx`
- Wholesale Mode shell stacks 4 sections: yard origin, delivery zones, bulk
  tiers per product, tip strip to Shop Mode (WholesaleModeEditor.tsx:1-13).
- **[fact]** `YardOriginEditor` calls `/api/trade-off/postcode-lookup`
  (postcodes.io proxy) for lat/lng; renders inline `<YardMapPreview>`
  static-SVG map (YardOriginEditor.tsx:5-10).
- **[fact]** Only the FIRST zone is editable in v1 even though the table
  is multi-row-capable (WholesaleZonesEditor.tsx:7-11).

### `BulkTiersPanel.tsx`
- Per-product bulk-pricing tier editor. Tiers: `[{ min_qty, max_qty?, price_pence }]`;
  last tier may omit `max_qty` ("50+ each") (BulkTiersPanel.tsx:5-9).
- **[fact]** Saves via the same `/api/trade-off/products/upsert` route Shop
  Mode uses (BulkTiersPanel.tsx:7-9).

### `MerchantFulfilmentPanel.tsx`
- Materials Network merchant side: commission config + Pending/Fulfilled/
  Declined tabs.
- **[fact]** Commission is computed server-side at fulfilment time using the
  CURRENT rate — a later rate change can't retro-shift booked earnings
  (MerchantFulfilmentPanel.tsx:10-13).
- **[fact]** Only rendered when listing has `wholesale_mode` on
  (MerchantFulfilmentPanel.tsx:14-17).

### `MaterialsNetworkEditor.tsx`
- Tradesperson-side merchant picker + earnings ledger.
- **[fact]** Privacy boundary: customer name / wa / postcode NEVER reach the
  tradie ledger; server strips them (MaterialsNetworkEditor.tsx:8-12).
- **[fact]** dnd-kit reorder, MAX_PICKS=12 (line 32).

### `FaqPageEditor.tsx`
- FAQ Page add-on CRUD on `hammerex_xrated_faq_items` + `_faq_images`.
- **[fact]** Ref code auto FAQ-001 on first save, must match
  `^FAQ-[0-9]{3,4}$` (FaqPageEditor.tsx:10-15, 67).
- **[fact]** Categories enum: general/pricing/process/materials/trust/warranty/aftercare (line 47-65).
- **[fact]** Caps: MAX_LIVE=50, WARN_AT=45, 3 images per FAQ, q 5-200 chars, a 5-2000 chars (line 68-75).
- **[fact]** Privacy disclaimer ack REQUIRED before save (line 16-17).

### `JobDiaryEditor.tsx`
- Job Diary CRUD with 4 modes: list, start, post, close.
- **[fact]** Reopen is a single-button action — no modal (JobDiaryEditor.tsx:14-16).
- **[fact]** Image client-side compression: createImageBitmap + canvas, max
  1600px edge, JPEG quality 0.72 (line 19-21, 56-79).
- **[fact]** HEIC/HEIF fallthrough to raw bytes (line 78 catch block).
- **[fact]** Caps: 20 live projects, 30 updates per project, 4 images per
  update, 280-char note, 500-char summary (line 31-37).

### `JobDiaryStatusPicker.tsx`
- 8-chip status row; horizontally scrollable on mobile (line 1-6).

### `DownloadsEditor.tsx` + `DownloadsLeadsTable.tsx`
- Downloads add-on. Two tabs: Files | Captured emails.
- **[fact]** Categories: brochure/form/compliance/catalogue/qualification/other
  (DownloadsEditor.tsx:34-50).
- **[fact]** Accept exts: .pdf .doc .docx .xls .xlsx .jpg .jpeg .png; 10 MB
  cap server-side; MAX_LIVE=20, WARN_AT=17 (line 52-54).
- **[fact]** `requires_email` flag gates downloads behind a capture form;
  leads land on the captured-emails tab with CSV export
  (DownloadsLeadsTable.tsx:3-7).

### `CustomDomainEditor.tsx`
- 4-state state machine driven by `custom_domain_status`: empty / pending /
  live / failure (CustomDomainEditor.tsx:1-13).
- **[fact]** Auto-polls `/status` every 30s for up to 30 min while pending
  (line 7-8).
- **[fact]** Per-registrar DNS guides via `REGISTRAR_GUIDES`
  (CustomDomainEditor.tsx:19-23).

### `LeadAlertsSetupCard.tsx`
- Web Push subscription manager with 3 states (iOS-non-standalone, denied,
  ready). Vibration presets, mute toggles, quiet hours
  (LeadAlertsSetupCard.tsx:1-15).

### `OperatingHoursEditor.tsx`
- Standalone Mon-Sun open/close editor. Saves directly to
  `/api/trade-off/update` with only `operating_hours`
  (OperatingHoursEditor.tsx:6-9).
- **[fact]** Available to EVERY tier (line 10-14) — even free profiles get
  real "Back online at 7:00 AM" copy from these hours.

### `YardComposer.tsx`
- The Yard post composer at `/edit/<slug>/yard`. Kinds: available, needed,
  product, chat (YardComposer.tsx:35-38).
- **[fact]** "Pick from my shop" drawer is only shown when `canSellProducts`
  (line 53-56).
- **[fact]** Reloads page on success rather than mutating local state (line 7-11).

### `BusinessCardPanel.tsx`
- Server-rendered share card preview. Calls `/api/trade-off/card-image?slug=`
  for thumbnail (line 1-12).

### `TrustScorePanel.tsx`
- Insights gauge. Server component, pure render from listing record.
- **[fact]** `tier="free"` drops the denominator to the free-tier max so
  "32/32" reads as maxed, not failed (line 18-28).

### `SlugAvailabilityField.tsx`
- Vanity slug picker. Live-prefixed `xratedtrade.com/`, debounced
  availability check, statuses idle/checking/available/taken/invalid
  (SlugAvailabilityField.tsx:18-19).

### `SecondaryTradesPicker.tsx`
- 3-max combobox; allows custom free-text trades stored as plain strings
  (line 1-13).
- **[obs]** Secondary trades field actually REMOVED from the form per
  TradeOffForm.tsx:380-382 — payload always sends `[]`. Component still
  exists but is unused on signup/edit.

### `InlinePhotoInput.tsx`
- Service / product image upload tile; posts to `/api/trade-off/upload-photo`,
  returns URL via `onChange` (line 1-12).

### `PhoneCountryInput.tsx`
- Phone + dial-code combo. Fetches `/api/geo` on mount for default country
  (line 1-8).

### `VideoUploadInput.tsx`
- Tradesperson intro video. 30 MB / 60 s cap, mp4/quicktime/webm.
- **[fact]** 4-step direct-to-Supabase-Storage flow (signed PUT URL) to
  bypass Vercel's 4.5 MB API body limit (VideoUploadInput.tsx:1-14).

### `ItemSpecsForm.tsx`
- Item Specifics renderer driven by `productCategories.ts`. Splits into
  Required / Recommended / Optional grids; writes to `specs` JSONB on
  `hammerex_xrated_products` (line 1-12).

### `HelpInfoButton.tsx`
- Inline "(i)" popup; ESC-to-close + focus trap (line 1-9).

### `TradeMobileActionBar.tsx`
- Sticky bottom WhatsApp/Call/Email bar on public profile (line 1-5).

### `WhatsappLeadsNudge.tsx`
- Celebratory modal for trial tradies with >=3 WhatsApp clicks. Gated
  server-side; this is just the shell (line 4-11).

### `LossAversionPreview.tsx`
- Day-25 trial-tail banner listing features that pause when trial expires
  (line 1-7).

### `XratedViewTracker.tsx`
- Page-view beacon. Posts to `/api/trade-off/track-view` on mount,
  `track-view-end` via `navigator.sendBeacon` on hide/unload. Session id
  in sessionStorage (line 1-15).

### `WhatsappClickTracker.tsx`
- Click instrumentation wrapper for `wa.me/...` anchors. Beacon fires before
  navigation; left-click only — right-click, mid-click, "Open in new tab"
  fall through (line 1-12).

### `TradeReportButton.tsx`
- Public "Report this profile" modal with 5-reason enum; posts to
  `/api/trade-off/report` (line 5-11).

### `TradeProfileUrlChip.tsx`
- Copyable "xratedtrade.com/<slug>" chip on the public hero (line 1-7).

### `TradeAreaMap.tsx`
- OpenStreetMap leaflet map at lat/lng with 5km circle. Dynamic imports
  because react-leaflet touches `window` (line 1-9).

### `TradePhotoGallery.tsx`
- Public photo lightbox; ESC/Arrow keys (line 1-6).

### `InstantQuoteForm.tsx`
- Public quote form on `/trade/<slug>`. Posts photos to
  `/api/trade-off/quote-upload`, assembles a wa.me link (line 1-10).

### `TemplatesGallery.tsx` + `TemplatesHeroCopy.tsx`
- Public templates page UI (line 1-9 for both). Not a tradesperson editor —
  prospective signups browse here.

### `TradeSocialIcons.tsx`
- Public social-icons strip on profile pages. Exports `socialIconFor()` for
  the signup/edit form to reuse the same chip glyphs (line 22-25).

---

## 5. API routes the editor uses

Every file under `src/app/api/trade-off/`. Token-bound writes verify
`edit_token` via `timingSafeEqual` on each route.

| Route | File | Purpose |
| --- | --- | --- |
| `POST /create` | create/route.ts | Signup insert + trial start + voucher issue |
| `POST /update` | update/route.ts | Token-bound field updates on listing |
| `POST /upload-photo` | upload-photo/route.ts | 5 MB image -> Supabase `product-images/trade-off/<uuid>.<ext>` |
| `POST /slug-available` | slug-available/route.ts | Live availability check for SlugAvailabilityField |
| `POST /report` | report/route.ts | Public report-listing form |
| `POST /track-view` | track-view/route.ts | View-start beacon |
| `POST /track-view-end` | track-view-end/route.ts | View-end beacon |
| `POST /track-whatsapp-click` | track-whatsapp-click/route.ts | WA-click beacon |
| `POST /start-trial` | start-trial/route.ts | Manual trial start (admin/dev?) |
| `POST /request-upgrade` | request-upgrade/route.ts | WhatsApp-handoff upgrade request |
| `POST /dismiss-upgrade-nudge` | dismiss-upgrade-nudge/route.ts | Set `upgrade_nudge_dismissed_at` |
| `POST /verified-waitlist` | verified-waitlist/route.ts | Verified-waitlist signup |
| `POST /quote-upload` | quote-upload/route.ts | Public InstantQuoteForm photo upload |
| `POST /addons/toggle` | addons/toggle/route.ts | AddOnsHub on/off |
| `POST /addons/pdp-toggle` | addons/pdp-toggle/route.ts | Per-product PDP add-on toggle |
| `POST /video-upload-url` | video-upload-url/route.ts | Signed PUT URL for direct video upload |
| `POST /video-save` | video-save/route.ts | Persist saved video URL |
| `POST /projects/create` | projects/create/route.ts | Verified work — create |
| `POST /projects/update` | projects/update/route.ts | Verified work — update |
| `POST /projects/delete` | projects/delete/route.ts | Verified work — delete |
| `POST /projects/upload` | projects/upload/route.ts | Verified work — before/during/after upload |
| `POST /projects/upsert` | projects/upsert/route.ts | Job Diary upsert |
| `GET /projects/list` | projects/list/route.ts | Job Diary list |
| `POST /projects/close` | projects/close/route.ts | Job Diary close |
| `POST /projects/reopen` | projects/reopen/route.ts | Job Diary reopen |
| `POST /projects/request-removal` | projects/request-removal/route.ts | Job Diary deletion request |
| `POST /project-updates/post` | project-updates/post/route.ts | Job Diary update post |
| `GET /project-updates/list` | project-updates/list/route.ts | Job Diary updates |
| `POST /project-updates/upload` | project-updates/upload/route.ts | Update image upload |
| `POST /project-beacon/send` | project-beacon/send/route.ts | Diary share beacon |
| `POST /products/upsert` | products/upsert/route.ts | Shop Mode + Services Prices CRUD |
| `POST /products/delete` | products/delete/route.ts | Product archive |
| `GET /products/list` | products/list/route.ts | Product list |
| `POST /products/reorder` | products/reorder/route.ts | Drag-reorder |
| `GET /products/siblings` | products/siblings/route.ts | Compare-with sibling lookup |
| `GET /products/search` | products/search/route.ts | Catalogue search |
| `POST /shipping-zones/upsert` | shipping-zones/upsert/route.ts | Zone CRUD |
| `GET /shipping-zones/list` | shipping-zones/list/route.ts | Zone list |
| `POST /shipping-zones/delete` | shipping-zones/delete/route.ts | Zone delete |
| `GET /reviews` | reviews/route.ts | Public reviews list |
| `GET /reviews/product-stats` | reviews/product-stats/route.ts | PDP stats |
| `POST /downloads/upload` | downloads/upload/route.ts | 10 MB file upload (MIME+ext sniff) |
| `POST /downloads/upsert` | downloads/upsert/route.ts | File metadata CRUD |
| `POST /downloads/delete` | downloads/delete/route.ts | Archive |
| `GET /downloads/list` | downloads/list/route.ts | File list |
| `POST /downloads/reorder` | downloads/reorder/route.ts | Drag-reorder |
| `POST /downloads/track-download` | downloads/track-download/route.ts | Counted download |
| `GET /downloads/leads` | downloads/leads/route.ts | Captured-emails table |
| `POST /faq-items/upsert` | faq-items/upsert/route.ts | FAQ CRUD |
| `GET /faq-items/list` | faq-items/list/route.ts | FAQ list |
| `POST /faq-items/delete` | faq-items/delete/route.ts | FAQ delete |
| `POST /faq-items/reorder` | faq-items/reorder/route.ts | FAQ drag-reorder |
| `POST /faq-items/track-view` | faq-items/track-view/route.ts | FAQ view beacon |
| `POST /faq-images/upsert` | faq-images/upsert/route.ts | FAQ images upsert |
| `POST /faq-images/delete` | faq-images/delete/route.ts | FAQ image delete |
| `POST /faq-images/reorder` | faq-images/reorder/route.ts | FAQ image reorder |
| `POST /wholesale-zones/upsert` | wholesale-zones/upsert/route.ts | Banded km pricing CRUD |
| `GET /wholesale-zones/list` | wholesale-zones/list/route.ts | Zone list |
| `POST /wholesale-zones/delete` | wholesale-zones/delete/route.ts | Zone delete |
| `POST /wholesale-origin/upsert` | wholesale-origin/upsert/route.ts | Yard origin lat/lng/fudge/VAT |
| `POST /wholesale-quote` | wholesale-quote/route.ts | Public quote calculator |
| `GET /postcode-lookup` | postcode-lookup/route.ts | postcodes.io proxy (UK only) |
| `GET /materials-network/picks/list` | materials-network/picks/list/route.ts | Tradie merchant picks |
| `POST /materials-network/picks/upsert` | materials-network/picks/upsert/route.ts | Add/edit pick |
| `POST /materials-network/picks/delete` | materials-network/picks/delete/route.ts | Remove pick |
| `POST /materials-network/picks/reorder` | materials-network/picks/reorder/route.ts | Drag-reorder |
| `GET /materials-network/picks/suggestions` | materials-network/picks/suggestions/route.ts | Search merchants |
| `POST /materials-network/referrals/create` | materials-network/referrals/create/route.ts | Customer-side referral |
| `GET /materials-network/referrals/list` | materials-network/referrals/list/route.ts | Ledger (privacy-stripped for tradies) |
| `POST /materials-network/referrals/decline` | materials-network/referrals/decline/route.ts | Merchant decline w/ reason |
| `POST /materials-network/referrals/fulfil` | materials-network/referrals/fulfil/route.ts | Merchant fulfil + commission compute |
| `POST /materials-network/commission/upsert` | materials-network/commission/upsert/route.ts | Merchant rate config |
| `POST /push-subscriptions/subscribe` | push-subscriptions/subscribe/route.ts | Lead Alerts subscribe |
| `POST /push-subscriptions/unsubscribe` | push-subscriptions/unsubscribe/route.ts | Lead Alerts unsubscribe |
| `GET /push-subscriptions/list` | push-subscriptions/list/route.ts | Devices |
| `POST /push-subscriptions/test` | push-subscriptions/test/route.ts | Send test notification |
| `POST /push-subscriptions/update-settings` | push-subscriptions/update-settings/route.ts | Vibration / quiet hours |
| `POST /push-subscriptions/refresh` | push-subscriptions/refresh/route.ts | Subscription refresh |
| `POST /custom-domain/attach` | custom-domain/attach/route.ts | Attach domain via Vercel API |
| `POST /custom-domain/verify` | custom-domain/verify/route.ts | DNS verify |
| `POST /custom-domain/disconnect` | custom-domain/disconnect/route.ts | Detach |
| `GET /custom-domain/status` | custom-domain/status/route.ts | Polled status |
| `GET /card-image` | card-image/route.tsx | Business card OG-style PNG |
| `GET /product-og` | product-og/route.tsx | Product OG-image |
| `GET /payment-methods` | payment-methods/route.ts | Methods list |
| `POST /listings/legal-links` | listings/legal-links/route.ts | terms_url / privacy_url / returns_url / about_url |
| `POST /listings/retail-shipping` | listings/retail-shipping/route.ts | Retail shipping config |
| `GET/POST /yard/posts` | yard/posts/route.ts | Yard list + create |
| `*/yard/posts/[id]` | yard/posts/[id]/route.ts | Yard post detail/delete |
| `POST /yard/posts/[id]/reactions` | yard/posts/[id]/reactions/route.ts | Reactions |
| `POST /yard/posts/[id]/contact` | yard/posts/[id]/contact/route.ts | Contact-author tracking |
| `GET /yard/my-products` | yard/my-products/route.ts | "Pick from my shop" drawer feed |
| `GET/POST /quotes` | quotes/route.ts | Quote requests |
| `*/quotes/[id]` | quotes/[id]/route.ts | Quote detail |
| `GET /lead-photos` | lead-photos/route.ts | Lead-photo lookup |
| `GET /messages` | messages/route.ts | Messages thread |
| `POST /jobs/create` | jobs/create/route.ts | Customer job-post create |
| `POST /jobs/upload-photo` | jobs/upload-photo/route.ts | Job photo upload |
| `POST /jobs/report` | jobs/report/route.ts | Job report |

---

## 6. Image upload pipeline

- **[fact]** Bucket: `product-images` (shared across Hammerex + Trade Off).
  Trade Off photos land under `trade-off/<uuid>.<ext>` prefix
  (`upload-photo/route.ts:15,51`).
- **[fact]** Public URL pattern from `supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)`
  -> `https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/trade-off/<uuid>.<ext>`
  (matches the SIGNUP_HERO constant at `signup/page.tsx:18-19`).
- **[fact]** Caps: 5 MB per image, `image/*` MIME only (upload-photo/route.ts:16,40-48).
- **[fact]** Allowed extensions resolved by MIME: jpg / png / webp / heic /
  heif / gif (upload-photo/route.ts:18-26).
- **[fact]** Video pipeline is direct-to-Storage with a signed PUT URL —
  bypasses Vercel's 4.5 MB API body limit (VideoUploadInput.tsx:9-14).
  Two-call flow: `/video-upload-url` -> XHR PUT to Storage -> `/video-save`.
- **[fact]** Job Diary updates compress client-side BEFORE upload
  (JobDiaryEditor.tsx:56-79).
- **[obs]** No migration path to ImageKit was found in the trade-off
  pipeline. The starter-product placeholder image in `TradeOffForm.tsx:1184`
  references an `ik.imagekit.io` sample asset, but that's a static editor
  thumbnail, not user-uploaded content. (Compare the Hammerex auto-migrate
  rule from user memory — that lives in `hammer/`, not this repo.)

---

## 7. First-run checklist

- **File**: `src/components/trade-off/FirstRunChecklist.tsx`
- **What it nudges**: 8 outcome-led items: bio, avatar, photos x3, services
  (>=1), hours, faq (>=1), hero text, trust signal (FirstRunChecklist.tsx:54-153).
- **[fact]** Each row leads with the OUTCOME ("more contacts, fewer abandons")
  not the control name (line 3-5).
- **[fact]** Self-hides once every item is done (line 8-9).
- **[obs]** Code comment in `src/app/trade-off/edit/[slug]/page.tsx:229-235`
  states the checklist is currently NOT mounted on the main edit page — it
  was removed in favour of a "focused data-input page". The component is
  still exported and available; it's just dark on the dashboard surface.
  Worth confirming with the owner whether it should live somewhere else
  (Insights? Onboarding?).

---

## 8. Known gaps and tech debt

1. **FirstRunChecklist is orphaned on the main edit page**
   (`src/app/trade-off/edit/[slug]/page.tsx:229-235`). Comment removed it
   "per design" but the component still exists — either delete or remount on
   Insights.

2. **Trust Score sample value hard-coded to 85** in the signup avatar
   preview (`TradeOffForm.tsx:766-790`). Comment acknowledges this is a
   placeholder ("Sample value 85 here for preview"). On edit-mode rendering
   the form still uses 85 instead of the real score — easy fix is to thread
   `getTrustScore(listing)` through to the form for editmode.

3. **Service radius custom input fights the chip picker**
   (`TradeOffForm.tsx:975-991`). The custom number input clears itself the
   moment its value matches one of the chip presets (10/15/20/...), which is
   non-obvious behaviour for a user typing "20".

4. **Secondary trades picker is orphaned**. `SecondaryTradesPicker.tsx`
   exists but `TradeOffForm.tsx:380-382` hard-codes `secondary_trades: []`
   on save, with a comment "secondary trades field removed from the form per
   design". Dead component.

5. **Slug change warning is text-only**
   (`TradeOffForm.tsx:681-685`). Saving a new slug doesn't migrate the live
   profile's QR codes or shared business cards. No old-slug redirect was
   found in this scan — needs verification at `src/app/[slug]` or
   middleware.

6. **`bio` placeholder `"(draft)"` is a magic string**
   (`create/route.ts:156`). The edit page strips it
   (`edit/[slug]/page.tsx:146` — `row.data.bio === "(draft)" ? "" : ...`) but
   any other code path that reads `bio` will see that literal.

7. **WelcomeKnifeCard is exported but unused** in the dashboard
   (`edit/[slug]/page.tsx:508-577`). Comment block at line 237-242 says
   "Score widgets, upsell nudges, tier-status cards and the
   notification-subscribe card were removed from this page in favour of a
   focused 'edit your app data' experience." — the function is still
   defined in the file. Dead code at this point.

8. **`TierStatusCard` is also exported but unused**
   (`edit/[slug]/page.tsx:423-506`). Same story — moved to Insights but the
   function body is still here.

9. **`PreviewModeBar` is defined but the scan didn't find its render site**
   in `src/app/[slug]` or the profile components — confirm whether the
   `?preview=standard` param actually mounts the bar in production. If it
   doesn't, the trial-tail loss-aversion mechanic is half-wired.

10. **No old-slug-redirect mechanism in the trade-off API tree**. If a
    tradie changes their `slug`, every shared QR / business-card PNG breaks
    silently. Recommend tracking slug history in a separate table with a
    middleware-level 301.

11. **Magic-link `edit_token` is never rotatable from the UI**. If the
    tradie's bookmark leaks (forwarded WhatsApp, screenshot), there is no
    "reset edit token" surface anywhere in the editor. Currently only an
    admin write-path could do it.

12. **`shop-mode/page.tsx:48-50` SELECTs a long literal column list**.
    Schema drift between the select string and the codepath that consumes
    `row.data.*` will silently 500. A `select("*")` (used elsewhere) would
    be cheaper to maintain.

13. **`addons/toggle` optimistic UI rollback path**
    (`AddOnsHub.tsx:55-60`) re-merges the server's `addons_enabled` map
    if the server returns one. If the API ever returns a partial map the
    UI silently drops other add-ons' toggle states.

14. **`update/route.ts` whitelist `UPDATABLE_STRING_FIELDS`** (line 49-95)
    must stay in sync with every editor's payload. A new editor that POSTS
    a field not in this list is silently dropped, not error-flagged.
