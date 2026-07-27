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

## 0022 · Merchant images — no third-party copy on import — Accepted

**Context:** NEX can technically auto-import imagery from Google Business Profile · Facebook · Instagram at scale to make free-tier listings look full on day one — but the copyright licence never transfers with the pixels, staleness becomes NEX's maintenance burden forever, and pre-filling removes the merchant's motivation to claim their listing.
**Decision:** Free listings import ONLY publicly-available business text (name · address · phone · website · category · service area · hours · map location) · never logos · gallery · covers · products · video. Once claimed, only merchant-provided or merchant-authorised media is displayed. Linking to a merchant's official website or Google Business Profile is fine · copying/hosting third-party imagery is never allowed at any tier.
**Consequences:** Legally cleaner across UK/IE/AU/US · zero third-party rot to maintain · empty gallery becomes a claim incentive that drives claim rate up · at the cost of visually thinner free-tier listings and less impressive marketing screenshots from unclaimed grids.

Full ADR: [`0022-merchant-images-no-third-party-copy.md`](0022-merchant-images-no-third-party-copy.md)

---

## 0023 · Directory import rules & process for seed listings — Accepted

**Context:** NEX needs a populated UK merchant directory on day one to be discoverable, but scraping merchant accounts (with images, fabricated data, or verified badges) creates legal and trust problems. Publicly-available business text can be imported as SEED LISTINGS — public directory entries that let customers discover local businesses before those businesses have engaged with NEX — provided the import contract is strict.
**Decision:** Seed listings store TEXT ONLY (name · category · address · postcode · phone · website · email if public · hours · description · services · Google rating · Google review count · maps URL · lat/lng) · never invent data · never create login credentials · never mark verified · every record starts `status=listed · claimed=false · verified=false · visibility=public` · no images (ADR-0022) · reviews are a separate manual pipeline preserving verbatim text · claim path ATTACHES to existing listing (never duplicates, preserves URL/reviews/ranking/history) · 20-metro geographic priority (London → Belfast) not national sweep · processing model is one-business-at-a-time with returned listing ID · no batching unless instructed.
**Consequences:** Directory looks active from day one with zero copyright risk · empty images become the claim incentive · reviews stay authentic (never AI-summarised) · at the cost of slower manual paste-per-business (deliberate) and sparser visual grids than scraping competitors.

Full ADR: [`0023-directory-import-rules-and-process.md`](0023-directory-import-rules-and-process.md)

---

## 0024 · Every image asset carries its generation prompt / capture context — Accepted

**Context:** Building the NEX directory revealed 82 ChatGPT-generated staircase images on `ik.imagekit.io/5vv5pw26q/` had no record of what any of them depicts — the generation prompt was lost at upload time and filenames like "ChatGPT Image Jul 25, 2026, 12_15_57 PM.png" carry zero subject signal. Without a manifest, automated image-to-usecase matching (directory cards, brain answers, banners) is impossible and A+ curation requires visual inspection of every file.
**Decision:** Every image added to NEX (AI-generated · uploaded · screenshot · 3D render · photo) MUST be recorded in `data/nex-image-manifest.json` at creation time with URL · source · original_prompt (if AI) · description · tags[] · a_plus · subject_domain · created_at · created_by. No image lands in ImageKit / Supabase Storage / public/ without a manifest row. Components/scripts read the manifest by tag intersection rather than hardcoding URLs. Retroactive backfill for the 82 pre-rule images via one-shot admin tool at `/admin/image-tagger`.
**Consequences:** Directory cards + brain illustrations + banners + hero art can all auto-select best match by tag · provenance is captured (enforces ADR-0022 by construction) · every design decision becomes auditable ("why is this image here?" → the manifest row) · at the cost of a ~30-second manual step on every new image generation and updating a handful of legacy upload scripts.

Full ADR: [`0024-image-manifest-rule.md`](0024-image-manifest-rule.md)

---

## 0025 · Tiered thresholds for the NEX image matcher — Accepted

**Context:** Once the image manifest has enough tagged rows, NEX surfaces images across many surfaces (directory cards, brain chat, marketing hero art, banners, workshop diagrams) each with a very different acceptable quality bar. A single global similarity threshold either produces silence on low-stakes surfaces or embarrassing mismatches on high-stakes surfaces. Neither is honest — mid-confidence matches deserve a caveat, low-confidence matches deserve a clarifying question, not a guess.
**Decision:** Per-surface confident-floor thresholds + universal three-band response model (Confident ≥0.85 = no caveat · Soft-caveat 0.70-0.85 = "closest match, tell me more" · Clarify <0.70 = NEX asks a targeted follow-up like "felted or torch-on roof?" instead of surfacing anything). Score formula = 0.4 tag intersection + 0.4 description keyword overlap + 0.2 structured field agreement. Floors: directory cards 0.65 · brain chat 0.80 · marketing hero 0.90 · banner recs 0.75 · workshop diagrams 0.85 · search grid 0.60. Thresholds tighten as manifest grows (>100 rows +0.05, >500 rows +0.10). Every match writes telemetry so tuning is evidence-based.
**Consequences:** Each surface gets the right precision/recall trade-off · the Clarify band turns "we don't know" into smart conversation · corpus-size scaling means early shipping without silence · at the cost of more per-surface code + a follow-up-tracker on the event stream + threshold-per-surface test surface area.

Full ADR: [`0025-image-matcher-tiered-thresholds.md`](0025-image-matcher-tiered-thresholds.md)

---

## 0026 · NEX Image Knowledge System — parser-derived structured knowledge — Accepted

**Context:** ADR-0024 gave the manifest; ADR-0025 gave the matcher. But saving 3,000-word MASTER IMAGE DESCRIPTIONs alongside a handful of scalar fields leaves NEX with two systemic problems at scale — every query pays the cost of parsing 150M words across 50k images, and there's no structured intelligence for "show me the next stage" · "make it blue" (locked?) · "show me similar images."
**Decision:** Two-input authoring (`master_description` ~3000 words + `master_ai_prompt` ~500 words). Everything else parser-derived at save time: nested IMAGE DNA (STYLE/CAMERA/MATERIALS/LIGHTING/QUALITY/SETTING) with confidence SCORE + 32-bit deterministic HASH · AI INTENT (purpose/role/collection/use_cases) · LOCKED ATTRIBUTES (must_keep/editable/never_change) · MATERIAL JOURNEY (id/stage/total_stages/prev/next) · OBJECTS · TAGS. Retrieval hierarchy DNA→MasterPrompt→MasterDescription escalates only when needed. DNA HASH enables similarity search without text parsing. Optional review button for parser corrections.
**Consequences:** Authoring stays sustainable at 50k images · ~60× token cost reduction on common queries · similarity search becomes first-class · material journey navigable as a graph · at the cost of parser being load-bearing (mitigated by DNA SCORE surfacing low-confidence extractions).

Full ADR: [`0026-image-knowledge-system.md`](0026-image-knowledge-system.md)

---

## 0027 · NEX Golden Rules — the immutable constitution of the image knowledge system — **Accepted · IMMUTABLE**

**Context:** ADRs 0024-0026 established the plumbing. Plumbing without philosophy drifts — different sessions of Claude and different domains subtly re-interpret what a "description" is for, when to flag, when to escalate. Six months on, the manifest would be internally inconsistent.
**Decision:** NEX is Architectural Historian + Manufacturing Expert + Art Director + Memory Engine — never a captioning AI. 10 Golden Rules govern every image (never paragraphs when structured knowledge is possible · every image belongs to collection+purpose+DNA+confidence+journey+relationships · DNA is primary memory, MasterPrompt secondary, MasterDescription tertiary fallback · <85% confidence flags for review · images inherit collection intelligence · future-proof for AIs in 10 years · 12-step thinking order mandatory · final question: "what would another AI need to recreate this with 95-100% accuracy in 10 years?"). Immutable preamble sits above every Claude prompt for image work.
**Consequences:** Every image ends up recreation-ready · manifest can be trusted at scale · 90% of queries pay ~50 tokens not ~3000 · collection inheritance turns 300 tagged images into a moat · zero drift between sessions · at the cost of higher-effort early tagging (mitigated by parser doing the heavy lifting). This ADR is marked IMMUTABLE — cannot be superseded, only extended.

Full ADR: [`0027-nex-golden-rules-constitution.md`](0027-nex-golden-rules-constitution.md)

---

## 0028 · NEX Intelligence Constitution — **Accepted · IMMUTABLE · TOP-LEVEL · LOADED FIRST**

**Context:** ADRs 0024-0027 built the manifest · matcher · knowledge schema · Golden Rules 1-11. Missing the philosophical foundation from which every other rule descends. Different sessions and different domains subtly drift on the philosophy of what NEX IS — a captioner? tagger? library? — and that ambiguity compounds into inconsistent implementations across surfaces.
**Decision:** NEX is the world's most intelligent **AI Creative Memory System** — NEVER a captioning · tagging · generation · library service. Constitution has 14 pillars: primary objective (preserve knowledge, not describe) · philosophy shift (IMAGE → KNOWLEDGE → MEMORY → RELATIONSHIPS → INTELLIGENCE → PROMPT → IMAGE → NEW KNOWLEDGE → SAVE → LEARN → REPEAT FOREVER) · NEX ALWAYS asks structured questions (What is this / purpose / collection / can_become / can_change / must_never_change / relationships / material_journey / 10-year recreation test) · every image creates 14 required structured fields · family tree (children inherit parent intelligence, "show me all versions" = 0.02s lookup) · geometry preservation (95% preserved, change only what's requested — Rule #13) · learning (never lose knowledge, `learning_signals[]` per row, collections aggregate — Rule #12) · confidence bands (<85% flags for review) · optimisation directive (NEVER save tokens, ALWAYS preserve intelligence). Immutable Rule: NEX is NEVER building an image library — always building the world's greatest AI Creative Memory System. Cannot be overridden by any downstream ADR.
**Consequences:** Every Claude session loads this first → zero drift on the philosophy · every image write goes through parser + validation gate enforcing Rules #1-14 · family tree turns "show me all versions" into a lookup not a search · geometry preservation stops AIs from generating new images when users asked for modifications · learning signals + collection aggregation make the system smarter every day · at the cost of larger manifest rows (mitigated by 3-layer retrieval hierarchy from ADR-0026) and higher-effort authoring in year 1 (compounds into 10x productivity by year 3 via collection inheritance).

Full ADR: [`0028-nex-intelligence-constitution.md`](0028-nex-intelligence-constitution.md)

---

## 0029 · NEX Image Tagger Directive — **Accepted · IMMUTABLE**

**Context:** ADRs 0024-0028 established the WHAT (manifest · matcher · schema · Golden Rules · Intelligence Constitution). Missing the HOW — the operational law for the tagger. The primary risk: Claude drifting into "process 982 images and stop" thinking, which produces 982 hand-crafted rows and zero architecture for image 983 through image 500,000.
**Decision:** Optimisation permission preamble at top ("200 well-structured words > 3000 poor-relationship words"). 500,000 mindset — build the intelligence layer, not process a batch. Mandatory 8-counter header (Total · Completed · Remaining · Flagged · Collections Updated · Material Journeys Created · Cover Images Applied · Admin Reviews Required) always visible. Flagged images NEVER skipped — leave OPEN in editor with specific reason + suggested values + Accept/Edit/Reject actions. Auto-flag triggers: DNA <85% · geometry unclear · collection undetermined · purpose undetermined · materials undetermined · relationships unclear · master AI prompt generation fails · any Rule #4/#11 field missing. Collection inheritance is automatic (Collection DNA + aggregate A+ image DNA + aggregate learning signals). Trade Centre + Pinterest auto-cover priority: Collection → Hero → Marketing → Educational → Website Banner → Transparent → Leave Blank + flag "admin image required". NEVER fake · NEVER guess · NEVER silent placeholder.
**Consequences:** Tagger operationally consistent every session · flagged images can't accumulate as silent debt · Trade Centre auto-populates from library the moment a match exists · at the cost of larger tagger header + flagged-row UI + priority matcher call per card on every feed load (mitigated by caching).

Full ADR: [`0029-nex-image-tagger-directive.md`](0029-nex-image-tagger-directive.md)

---

## 0030 · Intelligence Layers Before Admin — **Accepted · IMMUTABLE**

**Context:** The validator was flagging any row missing MASTER AI PROMPT for admin review — short-circuiting the entire intelligence stack (collection inheritance, DNA extraction, relationships) that ADRs 0024-0028 built. Philip's directive: admin is the LAST option, never the first. "If collection intelligence can determine the answer with 95% confidence, SAVE AUTOMATICALLY."
**Decision:** 6-level intelligence stack, mandatory order: (1) Collection Intelligence — aggregate DNA across ≥3 A+ collection rows, inherit fields ≥85% confidence · (2) Image Intelligence — base parser · (3) Relationship Intelligence — family_tree parent/siblings (deferred) · (4) MASTER AI PROMPT auto-generator — compose real inherited+inferred fields (not fabrication) · (5) Vision Intelligence — pixel inspection (deferred build) · (6) Admin Review — LAST resort, only fires when overall_confidence <85%. Confidence formula weights inheritance at 30%. Bootstrap: needs 3+ A+ rows per collection to activate Level 1. Amends ADR-0027 Rule #6 (band applies to overall_confidence, not base DNA) + Rule #10 (auto-generated prompts pass at ≥85%). "You have permission to think" preamble loaded above every image task.
**Consequences:** Admin intervention target drops from every unfamiliar image to <5% · collections compound (each A+ row lifts confidence for every subsequent row in that collection) · MASTER AI PROMPT auto-generation from inherited DNA means recreation-ready without manual authoring · at the cost of a real bootstrap requirement (≥3 A+ per collection to enable Level 1) and Level 5 vision still being deferred build.

Full ADR: [`0030-intelligence-layers-before-admin.md`](0030-intelligence-layers-before-admin.md)

---

## 0031 · Global Intelligence Bootstrap + Golden Rule of NEX — **Accepted · IMMUTABLE**

**Context:** ADR-0030's "≥3 A+ rows bootstrap" clause was too strict — collections need seeds before intelligence can help. Philip's insight: every image contributes to intelligence, even one. And the whole model of per-image processing is wrong.
**Decision:** THE GOLDEN RULE OF NEX — "NEX MUST NEVER ASK ADMIN A QUESTION WHICH CAN BE ANSWERED BY ANOTHER IMAGE." 7-pass Global Intelligence Pipeline runs across ALL images before saving anything: (1) Collections · (2) Relationships · (3) Material Journeys · (4) DNA + cross-collection patterns · (5) Master AI Prompts · (6) Confidence · (7) atomic SAVE. Nothing persists before Pass 7. Every image benefits from every other image. Removes ADR-0030's bootstrap floor — sample size affects confidence but no image is excluded from teaching NEX.
**Consequences:** Global intelligence emerges from collective evidence · no chicken-egg bootstrap · library becomes a graph not a pile · at the cost of complex 7-pass orchestrator + atomic-only writes + per-pass audit logs.

Full ADR: [`0031-global-intelligence-bootstrap.md`](0031-global-intelligence-bootstrap.md)

---

## 0032 · NEX Chief Intelligence Officer — **Accepted · IMMUTABLE · CAPSTONE**

**Context:** ADRs 0022-0031 built the full stack. Missing: the ROLE framing that gives NEX (and Claude working as NEX) a coherent job title and measurement.
**Decision:** Claude working with NEX images = **NEX Chief Intelligence Officer**, not tagger. 5 Masters (Image · Collection · Creative · Intelligence · Knowledge). MASTER IMAGE SCORE 100 pts across 5 × 20-pt axes (Image · Collection · Relationship · Future · Creative). Success = INTELLIGENCE created, not images processed. Measurement is collections discovered · relationships · journeys · Master AI Prompts · admin required. One image belongs to 14 collections via Knowledge Master. **CAPSTONE — no further ADR expansion in image domain without Philip's explicit request.**
**Consequences:** Mental model shift from tagger to CIO · 5 Masters give clean functional decomposition · MASTER SCORE makes quality measurable per-row · reports focus on intelligence not counts · at the cost of one more preamble block per session and slightly more per-row parsing work.

Full ADR: [`0032-nex-chief-intelligence-officer.md`](0032-nex-chief-intelligence-officer.md)

---

## 0033 · Quality Over Quantity + Brain Isolation — **Accepted · IMMUTABLE**

**Context:** ADR-0031's Pass-7 atomic write saved 981 rows including 856 <50 (poor) and 113 with 50-69 (marginal). Those rows pollute the intelligence layer. Philip: "NEX must be DIFFICULT to teach. If easy, it becomes inaccurate over time."
**Decision:** 7 Golden Quality Rules: never guess · quality over quantity (250 correct > 950 partial) · poor images do NOT enter intelligence (SAVE DISABLED or SAVE AS DRAFT ONLY) · brains are ISOLATED (staircase / door / interior / kitchen / bathroom / tools / timber / flooring / lighting / roofing / marketing — no cross-contamination) · NO general brain · multi-collection but single `primary_brain` · save REFUSES low quality. Score gate: ≥70 clean save · 50-69 draft only (filtered from all intelligence reads) · <50 SAVE FAILED with missing-fields list. `primary_brain: null` = SAVE FAILED regardless. Overrides ADR-0031 Pass-7 save-everything for below-threshold rows.
**Consequences:** Manifest becomes trusted knowledge base · brains stay pure · library shrinks before it grows but everything in it is real intelligence · long-term accuracy protected · at the cost of sharply lower auto-completion counter in Y1 and higher admin workload upfront.

Full ADR: [`0033-nex-quality-over-quantity-and-brain-isolation.md`](0033-nex-quality-over-quantity-and-brain-isolation.md)

---

## 0034 · NEX Knowledge Engine + THE GOLD STANDARD OF NEX — **Accepted · IMMUTABLE · IDENTITY REFRAMING**

**Context:** ADRs 0022-0033 built the machinery framed as an "image cataloguing system that also does intelligence." Philip's clarification: that framing is wrong. NEX is not an image system. NEX is an Architectural Knowledge Engine. Images are the input, knowledge is the output. Users don't care if image #437 exists — they care whether NEX understands their request.
**Decision:** Claude's identity everywhere becomes "MASTER KNOWLEDGE ENGINE OF NEX" — replaces all prior variants. NEX must never learn an image; it must learn materials · styles · relationships · collections · manufacturing · architecture · installation · construction · designer/future/search/AI-generation/user intelligence. If an image contains 500 pieces of knowledge, discover all 500. THE GOLD STANDARD (highest rule): if a user asks for something that has never existed before, NEX MUST STILL UNDERSTAND WHAT THEY WANT. `"0 results found"` is BANNED — every zero-image search decomposes the query into knowledge fragments, returns per-fragment understanding + derived paths (references · similar designs · renders · plans · install guides · AI-generated concepts). Understanding intent > finding perfect image.
**Consequences:** 850 images become "N thousand relationships" · users trust NEX more because it always demonstrates understanding · every search endpoint needs Gold Standard wrapper that decomposes zero-result queries · adds Knowledge Extraction Yield as new success axis complementing MASTER IMAGE SCORE · at the cost of implementing Query Knowledge Decomposer (deferred build) and richer response payloads on every search surface. All 33 prior ADRs remain in force — this ADR reframes what NEX IS, not what it does.

Full ADR: [`0034-nex-knowledge-engine-and-gold-standard.md`](0034-nex-knowledge-engine-and-gold-standard.md)

---

_ADRs 16-21 are Draft (awaiting signoff) · all 15 prior ADRs remain Accepted · ADRs 0022-0026 Accepted · ADR-0027 v1.2 Accepted + IMMUTABLE · ADR-0028 Accepted + IMMUTABLE + TOP-LEVEL + LOADED FIRST · ADRs 0029-0033 Accepted + IMMUTABLE · ADR-0034 Accepted + IMMUTABLE + IDENTITY REFRAMING · none currently Superseded or Deprecated._
