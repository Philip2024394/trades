# ADR Index — Thenetworkers

_Read this to understand every architectural decision without opening 15 files. When you disagree with a decision, read the full ADR before questioning — the reasoning is there._

**Status legend:** Accepted · Superseded · Deprecated

---

## 0001 · Manifest-first apps — Accepted

**Context:** Parallel feature systems (canteen, marketplace, notebook, etc.) risked producing a monolithic runtime where any change could break unrelated features.
**Decision:** Every feature is an "App" declared via `src/apps/{slug}/manifest.ts`; the platform runtime composes navigation, storage, tier gating and routing from manifests alone.
**Consequences:** New feature = new folder + manifest with zero core changes and per-app tables, but the runtime is now load-bearing across the whole platform.

Full ADR: [`0001-manifest-first-apps.md`](0001-manifest-first-apps.md)

---

## 0002 · Single domain — thenetworkers.app — Accepted

**Context:** Multiple accumulated brand domains and a paid/free URL split fragmented brand recognition and made tier boundaries hostile to merchants.
**Decision:** Every merchant lives on `thenetworkers.app/{slug}` regardless of tier; tier is a visible badge, never a URL demotion, and old brand domains 301 to the canonical one.
**Consequences:** One brand and stable URLs across tier changes at the cost of losing the "URL upgrade" reward (compensated by the Verified badge on Ultimate).

Full ADR: [`0002-single-domain-thenetworkers.md`](0002-single-domain-thenetworkers.md)

---

## 0003 · Never sell leads — Accepted

**Context:** UK trade platforms monetise by selling leads or taking commission, which merchants universally resent and which misaligns platform incentives.
**Decision:** Thenetworkers never sells leads and never takes commission — flat subscription only, matches are free, and money flows direct from customer to merchant via Stripe Connect / PayPal / Coinbase.
**Consequences:** Strong anti-Checkatrade positioning and zero regulated-activity exposure, at the cost of slower initial monetisation and heavier sales education for lead-model-trained merchants.

Full ADR: [`0003-never-sell-leads.md`](0003-never-sell-leads.md)

---

## 0004 · 30-day free-tier slug expiry policy — Accepted

**Context:** Free-tier signup opens the door to slug squatting on generic terms, degrading the pool of usable URLs for real merchants.
**Decision:** Free slugs are kept as long as the merchant logs in every 30 days (with warning emails at 15/25/29); after that the slug is archived, plus a ~225-word blocklist prevents the worst squatting at signup.
**Consequences:** Active free merchants keep slugs indefinitely and squatters flush automatically, but genuinely absent merchants (holidays, seasonal work) risk losing slugs and it requires a daily cron.

Full ADR: [`0004-free-slug-expiry-policy.md`](0004-free-slug-expiry-policy.md)

---

## 0005 · Non-destructive canteen restore — Accepted

**Context:** Merchant mistakes (deleting a portfolio, wiping products) had no undo path beyond manual DB backups, which does not scale.
**Decision:** Every canteen state snapshots to `hammerex_canteen_snapshots` on save + daily 3am cron; admin restore is gated by 4 safety layers and always captures a `pre_restore` snapshot so restores themselves are undoable.
**Consequences:** No support ticket ends with "sorry, that's gone forever" and every restore is audit-logged, at the cost of growing storage (capped at 30 auto snapshots per canteen) and JSONB shape drift over time.

Full ADR: [`0005-non-destructive-canteen-restore.md`](0005-non-destructive-canteen-restore.md)

---

## 0006 · Vehicle metaphor for pricing tiers — Accepted

**Context:** The 4-tier pricing ladder needed instantly-scannable identity without corporate SaaS icons or the banned AI-star / Sparkles set.
**Decision:** Each tier is a vehicle — Free = push bike, Canteen = motor bike, Marketplace = van, The Works = jeep — with matching copy ("Load up. Get selling.") and 1–4 filled yellow stars.
**Consequences:** Trades-native memorable ladder that differentiates the pricing page, but any new mid-tier requires the vehicle line-up to expand cleanly (e.g. a "Pickup" between Van and Jeep).

Full ADR: [`0006-vehicle-metaphor-pricing.md`](0006-vehicle-metaphor-pricing.md)

---

## 0007 · No editorial image rules — Accepted

**Context:** Enforcing editorial rules (white backgrounds, resolution minimums, single-subject) cuts supply from phone-camera trades, emptying the marketplace to keep the grid clean.
**Decision:** Any valid image under the size cap ships to production — only file-hygiene gates (MIME, non-zero, size cap) apply; the market self-corrects via click-through, not editorial policy.
**Consequences:** Day-one listing liquidity and zero moderation queue, but a visually inconsistent browse grid — with AI background-removal preserved as an upgrade lever for The Works tier.

Full ADR: [`0007-no-editorial-image-rules.md`](0007-no-editorial-image-rules.md)

---

## 0008 · Per-product surface flags — Accepted

**Context:** A single merchant-wide `send_to_trade_center` toggle was too coarse — merchants could not keep bespoke or discounted lines canteen-exclusive without duplicating inventory.
**Decision:** Every canteen product row carries three independent boolean flags (`show_in_canteen_products`, `show_in_trending`, `show_in_trade_center`) all defaulting true, with the merchant-wide TC toggle preserved as a master switch.
**Consequences:** True one-upload-many-surfaces workflow with per-product upsell moments, at the cost of three columns and three filters that must stay perfectly in sync at every read path.

Full ADR: [`0008-per-product-surface-flags.md`](0008-per-product-surface-flags.md)

---

## 0009 · eBay-parity fields + category-driven Item Specifics — Accepted

**Context:** A gap-scan against eBay's ~90 listing fields revealed missing category taxonomy, per-category aspects, and critical fields like condition/MPN/GTIN/dimensions before Trade Center could open to real buyers.
**Decision:** Extend `productCategories.ts` to 21 leaf categories with typed `SpecField[]` aspects, persist `category_slug` + `category_aspects jsonb` on products, and add condition ladder / identifiers / dimensions / returns / compatibility / age fields to the commerce block.
**Consequences:** Trade Center browse can now filter by category and facet by aspects and buyers see trust signals, at the cost of ~55 new form fields (mitigated by collapse + stacked layout) and a small manual re-pick for existing "refurbished" rows.

Full ADR: [`0009-ebay-parity-category-aspects.md`](0009-ebay-parity-category-aspects.md)

---

## 0010 · Every paid feature clears Stripe margin, both directions — Accepted

**Context:** With no commission and no lead sales (ADR-0003), every paid feature must self-fund — and Stripe's fixed £0.20 fee crushes margin at low price points.
**Decision:** Minimum add-on price is £4.99, all pack prices end in `.99`, every price is validated to net ≥95% after Stripe fees at money-in, and Safe Trade will never add a take-rate on top of Stripe.
**Consequences:** Every add-on is intrinsically profitable and pricing stays transparent, but we cannot offer "free video"-style growth hooks and any subscription tier change requires re-validating every add-on's margin math.

Full ADR: [`0010-stripe-margin-safe-pricing.md`](0010-stripe-margin-safe-pricing.md)

---

## 0011 · Per-variant SKU / photo / price via override map — Accepted

**Context:** The original variants shape shared a single price/image/SKU across all combinations, blocking real variant selling (different price per size, different photo per colour, per-combo SKUs and stock).
**Decision:** Extend the `variants` JSONB with an `overrides` map keyed by stable combo strings, each carrying a partial of `{ sku, imageUrl, priceGbp, stock, mpn, gtin }` that falls back to base product values when missing.
**Consequences:** Real variant selling unblocked with zero migration and tiny storage cost, but JSONB queries for variant-level stock facets are awkward and the consumer picker was explicitly deferred to a follow-up.

Full ADR: [`0011-per-variant-overrides.md`](0011-per-variant-overrides.md)

---

## 0012 · Consumer-side variant picker (shared, mobile-first) — Accepted

**Context:** ADR-0011 captured every variant override but buyers never saw them — product surfaces still rendered the base price and image regardless of variant selection.
**Decision:** Ship a shared `CanteenVariantPicker` (mobile-first chip rows, 44px tap targets, colour swatches, default-first selection, WhatsApp + `?v=` URL propagation) consumed by `ProductQuickView` and `CanteenTrendingSwipeSheet`.
**Consequences:** All variant data is now visible and WhatsApp messages carry the exact variant, at the cost of default-first selection possibly being misread as a "recommendation" and out-of-stock chips staying tappable for enquiry.

Full ADR: [`0012-consumer-variant-picker.md`](0012-consumer-variant-picker.md)

---

## 0013 · Object-contain everywhere + optional pre-upload pan/zoom crop editor — Accepted

**Context:** Three card surfaces used `object-cover` and were decapitating phone-shot merchant images, violating the global no-crop rule.
**Decision:** Switch the three surfaces to `object-contain` with a soft grey fallback, and ship an optional pre-upload `ImageCropSheet` (drag-to-pan + zoom slider, canvas-exports a 1600×1200 JPEG) for merchants who want a tight frame.
**Consequences:** Zero forced cropping with an opt-in mobile-friendly editor and no third-party lib, at the cost of soft-grey padding on non-4:3 images and the editor not yet covering gallery/per-variant uploads.

Full ADR: [`0013-object-contain-and-crop-editor.md`](0013-object-contain-and-crop-editor.md)

---

## 0014 · Direct-manipulation edit pattern — Accepted

**Context:** Merchant-owned domain objects had two competing UI paradigms — shadow admin dashboards and edit-in-place — and left unchecked would drift into N different admin paradigms for N surfaces.
**Decision:** Direct manipulation is canonical — object actions live on a 3-dots menu on the card, surface actions live in an Edit-mode tile carousel, a single AppShell chip toggles Edit mode, and shadow `/manage` pages retire as sections are ported.
**Consequences:** Merchants learn one paradigm across the platform and fewer pages to maintain, but bulk-editing is harder without a list-view and each of the 33 `/edit/{slug}/**` sub-features still needs a per-feature port plan.

Full ADR: [`0014-direct-manipulation-edit-pattern.md`](0014-direct-manipulation-edit-pattern.md)

---

## 0015 · Canteen page and mobile-app template are decoupled surfaces — Accepted

**Context:** Templates-picker style columns (theme_mode, feed_tile_color, palette intensity) were bleeding into the public canteen page renderer, violating the golden-rule off-white `#FBF6EC` background.
**Decision:** `/trade-off/yard/canteens/[slug]` renders two branches keyed by `?embed=1` — the canteen page uses fixed platform defaults and reads only data, while the embed view is the sole consumer of merchant style columns.
**Consequences:** Merchants can no longer break the canteen page design via templates and every future style property has one obvious home, at the cost of two branches through one URL that reviewers must always remember.

Full ADR: [`0015-canteen-app-template-split.md`](0015-canteen-app-template-split.md)

---

---

## 0016 · Memory Engine Privacy Architecture — Draft

**Context:** Phase 26 Memory V0 shipped owner-scoped memory. V1 unlocks cross-tenant rollups that give merchants regional peer benchmarks · but flat K=5 is de-anonymisable for pricing in small trades × small regions, and consent framework needs concrete implementation to be lawful across UK/IE/AU jurisdictions.
**Decision:** Tiered K-anonymity thresholds (K≥5 demand · K≥10 pricing · K≥20 margin · never PII crosses) · consent-first opt-in per memory-type category · regional granularity capped at ONS-region/state/province · "your data helped" transparency dashboard · full GDPR portability + right-to-be-forgotten workflows.
**Consequences:** Defensible under adversarial de-anonymisation · legally sound across jurisdictions · turns compliance into trust advantage · but rollup density in low-K regions takes months to accumulate · Y1 revenue projections should not depend heavily on cross-tenant reads.

Full ADR: [`0016-memory-privacy-architecture.md`](0016-memory-privacy-architecture.md)

---

## 0017 · Trade Brain Contract — Draft

**Context:** Phase 27 upgrades Phase 24's thin trade-agent stubs into Trade Expert Brains authored by human master tradespeople. If the module schema is not locked before authoring begins, every subsequent Brain requires schema migrations and wastes contracted author time.
**Decision:** 10-module Brain schema with 6 modules required at V1 (craft · regulations · materials · workflow · defects · pricing_model) and 4 deferred to V2 (tools · business_tone · sub_specialisations · regional_variants) · JSON pack file format under `src/lib/nex/brains/<slug>/` · named human author with authoritative editorial control · correction chain via `hammerex_nex_brain_corrections` · semver + rollback pathway.
**Consequences:** Contract locked before authoring · 6-module V1 achievable in author capacity · trust earned via named authors · but 4 modules deferred means known depth gaps at V1 · author recruitment is Y1's biggest hidden bottleneck.

**Amendment 2026-07-23 (§8 Field Learning Loop):** every Brain must support 6 loop mechanisms (Author-authored baseline · verified corrections · field outcome capture · prediction-vs-actual delta tracking · confidence updates · version history). Data flow: Brain prediction → Twin outcome → K-anonymised rollup → Author quarterly review → learning-loop version bump. New tables: `hammerex_nex_brain_field_outcomes` + `hammerex_nex_brain_learning_signals`. Author contract extended to include quarterly outcome-pattern review (retainer-funded).

Full ADR: [`0017-trade-brain-contract.md`](0017-trade-brain-contract.md)

---

## 0018 · Twin Event Log Schema — Draft

**Context:** Phase 29 Digital Twin creates a persistent replica of every project · every future Twin behaviour derives from the event log schema and getting it wrong later is not a rollback but a migration of every historical event ever written.
**Decision:** Append-only event log (`hammerex_nex_twin_events`) partitioned by month · versioned Zod schemas per event kind · approval-state field for medium-confidence Vision events · V0 ships 2 perspectives only (Merchant + Homeowner) not full Brain-perspective engine · V0 ships WITHOUT BIM ingest · weekly snapshot cache for perf · 24-month hot retention + cold archival.
**Consequences:** Time-travel + correction transparency + perspective folding become free capabilities · event log grows to millions of events per year at merchant density · partitioning + archival mandatory from day one · BIM ingest deferral means enterprise merchants can't use Twin V0 for BIM workflows.

Full ADR: [`0018-twin-event-log-schema.md`](0018-twin-event-log-schema.md)

---

## 0019 · Workforce Trust Ladder — Draft

**Context:** Phase 32 Workforce ships 5-25 AI agents that act for the merchant · original 7-level trust ladder was too complex for merchants to distinguish (per ES-01 correction #8) · every action must be safe by construction not by careful design of individual features.
**Decision:** 4-level ladder (Observe · Draft · Prepare · Auto-Execute) with Level 5 Emergency Stop as non-negotiable safety valve · default Level 2 for every new agent · Level 4 auto-execute opt-in per action class with hard caps · Level 4 whitelist strictly limited to non-external-facing actions · downgrade triggers on ≥85% approval-rate breach · immutable audit log per level.
**Consequences:** Levels distinguishable by non-technical merchants · default Level 2 means no agent surprises at onboarding · Emergency Stop non-negotiable creates fundamental safety guarantee · approval fatigue at Level 2 remains a risk addressed by weekly digest (Validation Report C-5) · some "obviously safe" automations require Level 3 approval even at scale.

Full ADR: [`0019-workforce-trust-ladder.md`](0019-workforce-trust-ladder.md)

---

## 0020 · Workforce Economy Honesty Framework — Draft

**Context:** Phase 33 Workforce Economy uses employment language (hire, retire, promote) as strategic asset · one incident of fabricated review, faked credential, or human-impersonation ends the category-shift narrative and creates significant legal exposure · trust is one-shot.
**Decision:** AI always disclosed as AI in external communications · zero fabrication enforced at schema level (reviews · credentials · portfolio · aggregate statistics) · verification badges earned not granted (Registered · Insured · Certified · Trusted · Master) · warm-professional voice never fake emotion · approval-required for every external send regardless of agent level · terms of use disclaim personhood + legal capacity · verified retention framework on retirement.
**Consequences:** Every merchant-facing surface passes honesty audit by construction · category-shift framing survives regulatory scrutiny · verified badges become genuine trust signals · but some competitive marketing tactics (fake urgency, generated testimonials) forbidden · verification cron adds ongoing ops cost per merchant.

Full ADR: [`0020-workforce-economy-honesty-framework.md`](0020-workforce-economy-honesty-framework.md)

---

---

## 0021 · Intelligence Domain Separation — Draft

**Context:** As Nex intelligence grows (40+ Trade Brains authored over years · Memory rollups compounding · Business Brains formalising) the temptation to build "universal search over all construction knowledge" grows with it · that approach degrades AI quality (unrelated retrieval · bloated LLM context · higher hallucination · specialist authorship dilutes · latency degrades). Phase 24 mesh and ADR-0017 already practice domain separation at file/schema level · this codifies as a first-class enforcement rule before Phase 1 Substrate begins.
**Decision:** Nex intelligence organised into 5 domain categories (Trade Brains · Business Brains · Memory Layers · Regulatory Knowledge · Product Knowledge) · every domain enforces separation at 5 levels (namespace · schema · storage · retrieval · ownership) · every AI query follows domain-scoped routing · cross-domain retrieval requires explicit multi-domain listing (default deny · no wildcards) · Supabase Storage bucket paths always domain-prefixed · CI enforcement via ESLint rule + retrieval function contracts.
**Consequences:** Retrieval scoped to relevant domain (faster · cheaper · fewer hallucinations) · Author authority preserved · adding new Brain is additive · but legitimate compound queries require explicit multi-domain routing · cross-Brain analogical reasoning requires explicit adjacency edges not implicit search · onboarding engineers must learn domain boundaries.

Full ADR: [`0021-intelligence-domain-separation.md`](0021-intelligence-domain-separation.md)

---

_ADRs 16-21 are Draft (awaiting signoff) · all 15 prior ADRs remain Accepted · none currently Superseded or Deprecated._
