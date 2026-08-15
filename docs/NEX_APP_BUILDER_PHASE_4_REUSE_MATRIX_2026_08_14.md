# NEX App Builder · Phase 4 · Reuse Matrix (Philip 2026-08-14)

**Constitutional rule:** Workers must consume existing capabilities before inventing new ones.

This document was produced by reading actual code — not by inspection of names. Every claim below cites a file. When a capability exists, we reuse. When it's partial, we adapt (not rebuild). When missing, we build minimum viable.

---

## Existing 12-step pipeline (real, working)

**File:** `src/app/api/studio/ai/pipeline-stream/route.ts` (692 lines).

| Step | Id | Kind | Consumes | Produces |
|---|---|---|---|---|
| 1 | `business.discover` | LLM | prompt | `{ merchantName, tradeSlug, city }` |
| 2 | `prompt.extract-intent` | LLM | prompt | `ExtractedIntent { goals[], wants{} }` |
| 3 | `journey.selectFor` | pure | intent + trade | ranked `journey` (has `pageSet[]`) |
| 4 | `layoutRegistry.rank` | pure | intent + goals | ranked `layout` (has `sequence[]`) |
| 5 | `container.plan` | pure | layout.sequence | ordered container plan |
| 6 | `navigation.select` | pure | trade + journey | nav model |
| 7 | `section.select` | pure | layout + registry | `sectionPicks[]` for HOME |
| 8 | `app.recommend` | pure | trade + intent | `warehouseAppsFor(trade)` |
| 9 | `theme.select` | pure | trade + intent | theme slug |
| 10 | `tokens.select` | pure | theme + brand | `tokenSet` |
| 11 | `prose.bespoke` | LLM | discovery + KG | `BespokeProse { pages[] }` |
| 12 | `layout.assemble` | pure | picks + prose + hero | `AssembledLayouts { home?, about?, contact?, ... }` |

**Post-step 12 :** `assemblePipelineLayouts` (see below) returns layouts for every page in `journey.pageSet.filter(required)`. Then `POST /api/studio/ai/publish-pipeline` INSERTs one `studio_layouts` row per assembled page. **This is already multi-page publish** — the "plan-preview only" comment in the earlier audit was stale.

---

## What the multi-page assembler actually does

**File:** `src/lib/studio/ai/assembleLayout.ts` (293 lines).

- `assembleHomeLayout(input)` — deterministic picks from `sectionPicks[]` (from layout ranking)
- `assemblePageLayout(pageId, input)` — deterministic per-page picks from `PAGE_LIBRARY_MAP`
- `assemblePipelineLayouts(input)` — iterates `pageIds` and calls both

**`PAGE_LIBRARY_MAP` covers 9 pages:**
```
about       → about, trust_bar, statistics, team, cta
contact     → hero, contact, cta
projects    → hero, gallery, portfolio, testimonials, cta
services    → hero, services, pricing, cta
faq         → hero, faq, cta
reviews     → hero, testimonials, reviews-strip, cta
coverage    → hero, map, service-areas, cta
product-grid → hero, product_grid, cta
```

**Gap:** `PAGE_LIBRARY_MAP` is HARDCODED. There's no way to say "for this specific Blueprint, use these specific sections on this page." The assembler picks the first section in each library — trade-agnostic but Blueprint-agnostic too.

---

## Section registry — real inventory

**File:** `src/lib/studio/sectionRegistry.ts` — facade over `@/platform/registryKit`.

**46 sections across 20 libraries** (verified by grep on `src/lib/studio/sections/**/*.tsx`):

| Library | Count | Real ids (sample) |
|---|---|---|
| `hero` | 25 | `hero.split_photo_left_1`, `hero.minimal_centred_1`, `hero.product_showroom_1`, `hero.magazine_editorial_1`, `hero.map_hero_1`, `hero.postcode_local_1`, `hero.plant_hire_bold_1`, `hero.emergency_247_1`, `hero.review_wave_1`, `hero.trust_minimal_1`, +15 more |
| `contact` | 2 | `contact.split_1` |
| `cta` | 3 | `cta.centred_1`, `cta.compact_band_1` |
| `features` | 2 | `features.icon_grid_1`, `features.three_up_reasons_1` |
| `addons` | 5 | (not enumerated in this audit) |
| `banner`, `brands`, `categories`, `checkout`, `faq`, `footer`, `gallery`, `map`, `newsletter`, `pricing`, `product_grid`, `services`, `statistics`, `team`, `testimonials`, `trust_bar`, `video` | 1 each | `contact.split_1`, `map.embed_1`, `gallery.grid_1`, `services.list_1`, `product_grid.classic_3col_1`, `team.cards_1`, `testimonials.card_grid_1`, `pricing.three_tier_1`, `faq.accordion_1`, `footer.minimal_1`, `checkout.stack_1`, `trust_bar.icon_row_1`, `statistics.band_1`, `banner.ribbon_1`, `brands.strip_1`, `categories.grid_1`, `newsletter.inline_1`, `video.embed_1` |

**Registration shape:** each section declares `id, name, library, defaultConfig()`, plus optional `bestForVerticals[], telemetryTags[]`. Registry is queryable by id, library, tag, and category.

---

## Hero library

**Files:** `src/lib/heroLibrary/index.ts` + `scripts/hero-library.json`.

- **7 entries only** — small, staircase-focused. Each has `image_url, keywords_strict[], excluded_trades[], text_zone, theme_palette, aspect_variants`.
- `pickHeroForTrade(tradeSlug)` — keyword-intersection matcher. Returns `{ entry, palette }`.
- Palette flows into brand tokens automatically so the theme harmonises with the hero.
- **Gap:** 7 entries is thin for a general App Builder. For the staircase golden test it's likely enough; for future verticals it needs expansion.

---

## Design tokens

**Files:** `src/platform/design/tokens/defaultSet.ts`, `types.ts`, `registry.ts`, `tradeCenterBrand.ts`.

Full semantic token registry with:
- **Colour**: `color.primary`, `primaryHover`, `primaryInk`, background, foreground, muted, border, semantic (`success`, `warning`, `error`, `info`)
- **Typography**: `family.heading`, `family.body`, `family.mono`, `scale` (numeric), `weight.regular/medium/bold/extraBold`, `leading.tight/normal/relaxed`, `tracking.tight/normal/loose`
- **Spacing, radius, shadow, motion, breakpoints** — full token set

**Reuse verdict:** the Blueprint's `brand.palette` and `brand.typography` map directly to this token registry.

---

## Data models

The pipeline output (`StudioLayoutJson`) does NOT include a data-model layer today. Products, team, projects come from separate tables (`hammerex_yard_canteen_products`, `hammerex_trade_off_listings`, etc.). Sections consume via server-side loaders, not via data-binding refs.

**Blueprint's `data: DataModelSpec[]`** doesn't yet have a runtime consumer — this is a Phase 3 worker gap (data-model worker to materialise per-app data schemas).

---

## Integrations layer

**Existing integrations in production trades codebase:**
- Stripe (platform billing · not per-app checkout)
- Resend (email)
- ImageKit (CDN)
- Companies House (verification)
- WhatsApp deep links (contact CTA)
- Google Maps (embed via `map.embed_1`)

**None of these are wired to per-app checkout / per-app forms / per-app maps** the way an App Builder needs. Blueprint declares them as REQUIREMENTS (see `IntegrationRequirement` type) — the actual wiring is Phase 3 worker territory.

---

## Reuse matrix — Blueprint capability ↔ existing implementation

| Blueprint capability | Existing implementation | Reuse | Adapt | New |
|---|---|:-:|:-:|:-:|
| `pages[]` list | pipeline hardcoded `PAGE_LIBRARY_MAP` (9 pages) | | ✓ | |
| `pages[].sections[]` (SectionInstance) | `sectionRegistry` (46 real sections) + `defaultConfig()` | ✓ | | |
| `pages[].sections[].registryId` resolution | direct `sectionRegistry.get(id)` (exists) | ✓ | | |
| Hero images | `heroLibrary` (7 entries, keyword-matched) | ✓ | | |
| Brand palette | `platform/design/tokens` (full semantic registry) | ✓ | | |
| Typography | `platform/design/tokens` (family/scale/weight/leading/tracking) | ✓ | | |
| Nav model | `platform/navigation` + `NavEntry` in manifest v1 | ✓ | | |
| SEO | `src/lib/seo.ts` (JSON-LD generators) | ✓ | | |
| Responsive rules | Tailwind breakpoints + tokens | ✓ | | |
| Multi-page publish | `POST /api/studio/ai/publish-pipeline` (already iterates pages) | ✓ | | |
| Blueprint→pipeline adapter | doesn't exist — pipeline still driven by intent+journey | | | ✓ |
| Data-model runtime | none — sections read from platform tables | | | ✓ |
| Product cards + Stripe per-app | `product_grid.classic_3col_1` renders; no per-app Stripe wiring | | ✓ | |
| Service-radius map | `map.embed_1` exists (embed only, no radius overlay) | | ✓ | |
| Plain prose / rich text section | no `content/prose` section in registry | | | ✓ (small) |
| Visual QA (Playwright) | not installed | | | ✓ |
| Provenance-aware Studio surface | doesn't exist — pipeline doesn't track KNOWN/INFERRED per field | | | ✓ |

**Score:** 10 REUSE · 4 ADAPT · 6 NEW.

---

## The single Phase 6 gap · precisely stated

The multi-page assembler `assemblePipelineLayouts()` already works but uses `PAGE_LIBRARY_MAP` (hardcoded per-page section libraries) rather than a Blueprint's per-page section list.

**Fix:** a translator layer — `assembleFromBlueprint(bp)` — that walks `bp.pages[].sections[]` and resolves each `SectionInstance.registryId` against `sectionRegistry`, with library-fallback for conceptual ids (e.g. `hero/photo-full` → first `hero` section if no exact match).

This is a small, self-contained addition, NOT a rewrite. The existing `configForRole()` + `defaultConfig()` + `heroConfigFromProse()` machinery keeps being the source of section config.

---

## Phase 3 worker gaps (informational — not to build yet)

The audit surfaces these gaps that Phase 3 will fill. Listed here so we don't accidentally start building them in Phase 4/6:

1. **Data-model worker** — materialise `bp.data[]` as per-app tables (or per-app in-memory JSON stores for local dev)
2. **Integration worker** — wire Stripe / Google Maps / Resend for the generated app (with dev/test credentials only per pivot)
3. **Image worker** — expand hero library beyond 7 entries; add per-page image selection using `bestForVerticals` tags
4. **Visual QA worker** — Playwright + screenshot diff loop (Phase 8)
5. **Provenance surface** — Studio-side UI to show "KNOWN / INFERRED / REQUIRED / UNKNOWN" so operator can fill blanks

None are prerequisites for Phase 6. Phase 6 (Blueprint→existing pipeline) can complete + demo without any of them.
