# NEX App Builder — Brutal Audit Report (Philip 2026-08-14)

Authored under the "no bullshit" rule Philip set: every claim verified against actual file contents. Where verification wasn't possible in the time available, marked **NOT VERIFIED**.

---

## A. Current Design Studio architecture — what actually happens today

**Entry:** `src/app/studio/page.tsx` (140 lines) is a sign-in gate that redirects to `/studio/vault` (returning merchant) or `/studio/discovery` (first-visit) after `loadStudioSession()`. Not a builder.

**Two parallel builder surfaces exist:**

1. **`/studio/generate`** → `src/app/studio/generate/page.tsx` (44 lines) → renders `GenerateLanding`. Older single-shot route.
2. **`/studio/build`** → `src/app/studio/build/page.tsx` (40 lines) → renders `src/components/studio/builder/StudioBuilderShell.tsx` (**1666 lines**). This is the current "Lovable-shaped" split-pane builder — form on left, iframe preview on right.

**Real execution path in `/studio/build`:**
- `StudioBuilderShell.onSubmit` → opens `TemplatePickerModal` → `runPipeline()` → `POST /api/studio/ai/pipeline-stream` (`src/app/api/studio/ai/pipeline-stream/route.ts`, 692 lines). SSE-driven, ~12 steps (discover → intent → journey → layout → containers → nav → sections → apps → theme → tokens → prose → assemble).
- Result stored on `window.__studioBuilderPipeline` and iframe reloads `/studio/build/preview` (`src/components/studio/builder/StudioBuilderPreviewCanvas.tsx`, 1537 lines).
- "Accept & Publish" → `POST /api/studio/ai/publish-pipeline` (142 lines) → INSERTs one row per page into `studio_layouts`.

**A third editor surface exists:** `src/app/studio/editor/page.tsx` → `EditorShell.tsx` (**7,087 lines** — a massive click-to-add canvas). Not connected to the AI pipeline. Separate world.

**Verdict:** Studio today is a **prompt-to-published-layout composer for merchant profile pages**. It is NOT an App Builder. It composes pages inside the platform's OWN merchant profile system (`studio_layouts` table); never emits Next.js routes, Stripe products, DB schemas, or component code.

There is a `pipeline-v2` route (`src/app/api/studio/ai/pipeline-v2/route.ts`) that at line 13-24 says **"Deferred (steps 5..14 land in follow-up PRs on this same route)"** — old orchestrator half-built; `pipeline-stream` is where the 12 steps run.

---

## B. Reusable assets (load-bearing, in production TODAY)

| Path | What it does |
|---|---|
| `src/lib/studio/sectionRegistry.ts` | Section registry facade over registryKit; 48 sections self-register |
| `src/lib/studio/sections/**/*.tsx` (52 files) | Real section renderers — hero, gallery, cta, contact, faq, features, pricing, product_grid, testimonials, trust_bar, footer, video, map, newsletter |
| `src/platform/design/registry.ts` (128 lines) | Design component registry — 25 registrations |
| `src/platform/runtime/install.ts` (167 lines) | Real install pipeline — resolves manifest, checks deps/conflicts, materialises pages |
| `src/platform/manifest/types.ts` (523 lines) | Canonical `AppManifest` v1 schema |
| `src/platform/journey/`, `layouts/`, `navigation/`, `themes/` | Ranked pure-function registries used by pipeline |
| `src/lib/studio/ai/assembleLayout.ts` (293 lines) | Turns picks + prose into `StudioLayoutJson` |
| `src/lib/studio/ai/bespokeProse.ts` | LLM per-page copy from KG |
| `src/lib/studio/ai/extractIntent.ts` | LLM intent extractor |
| `src/lib/studio/aiGateway.ts` | Shared LLM gateway |
| `src/app/api/studio/ai/pipeline-stream/route.ts` | 12-step orchestrator |
| `src/app/api/studio/ai/publish-pipeline/route.ts` | Writer to `studio_layouts` |
| `src/lib/stripe.ts` | Stripe SDK init (40 lines · correct pattern) |
| `src/app/api/stripe/webhook/route.ts` | Real webhook handler |
| `src/app/api/stripe/addon-attach\|detach/route.ts` | Real subscription-item mutation |
| `src/lib/heroLibrary/`, `scripts/hero-library.json` (93+ tagged images) | Working hero picker |
| `src/lib/tradeOff.ts` | 108 trade slugs — canonical taxonomy |
| `src/lib/tierCatalog.ts` | Canonical pricing tiers |
| `scripts/nex-brain/*.mjs` | Layer 1–5 conversational stack (validated) |

---

## C. Real vs documentation — template/component capabilities

**Real:** 48 section files with real render + config APIs. Each registers with `sectionRegistry.register()`.

**Real design primitives:** 25 registrations in `src/platform/design/components/primitives/`.

**Section categories confirmed:** hero (23 variants), cta (3), features (2), contact (2), gallery, faq, pricing, product_grid, testimonials, team, trust_bar, footer, video, map, newsletter, brands, categories, banner, services, statistics, addons.

**56 `src/apps/*` app dirs BUT manifest shape is fragmented:**
- Only ~11 files call `appRegistry.register()`. Meet-the-team + orders + tradecenter + trade-connections + newsletter use `AppManifest` v1 correctly.
- Many "manifests" (notebook, calc-*, etc.) are literal `const NOTEBOOK_APP_MANIFEST = { ... } as const` — different shape, never touch `appRegistry`.
- Runtime `installApp()` only handles v1-shaped manifests. **40+ "manifest" apps are effectively documentation, not installable modules.**

**BLUEPRINT_STUDIO_PRD.md §1.4** declares tables `studio_blueprint_installs`, `studio_brand_outcomes`, `studio_brand_credentials`. **NOT VERIFIED** that these tables exist in `supabase/migrations/`.

---

## D. Existing worker capabilities

**MISSING.** No worker/task-queue system for structured build jobs.

- Grep for `bullmq|agenda|task.queue|background.job` returned only docs, correlation utilities, unrelated queue-page code. Zero worker infrastructure.
- Closest analog: `src/platform/aiTools/dispatcher.ts`, `src/lib/studio/aiGateway.ts` — synchronous LLM routers, not code-executing workers.
- Cron jobs exist (31 per BLUEPRINT.md) but are scheduled Next.js routes, not a job queue capable of receiving "Build ProductGrid section for merchant X" and executing it.

**Impact:** the App Builder concept has **zero foundation** for structured task dispatch. Current pipeline runs entirely inline in an SSE request. Real app-builder work requires adding a queue (Redis+BullMQ or Supabase Realtime queue).

---

## E. Missing App Builder architecture

1. **App Blueprint schema.** No TS type for customer-visible `AppBlueprint`. Current `AppManifest` describes a *plugin*; not a *whole customer app spec*.
2. **Code-emitting workers.** No process that produces routes, DB tables, or Stripe products from a spec.
3. **Multi-page-of-a-generated-app model.** `studio_layouts` versions ONE merchant profile per page-id.
4. **Sandbox/preview environment for generated apps.** Preview iframe reads `window.__studioBuilderPipeline` in-process.
5. **Visual QA harness.** Grep for Playwright/Puppeteer/pixelmatch matched only docs and `package-lock.json`. No installed test rig, no CI wiring.
6. **Per-generated-app Stripe wiring.** Existing routes bill *platform subscription*. No code provisioning a Stripe account or product per customer-generated app.
7. **Radius / service-area map component.** No reusable `<ServiceRadiusMap>` with radius prop API.
8. **Product-cards-with-Stripe-checkout composed unit.** `product_grid` renders but isn't tied to per-item Checkout Session creation.
9. **App Spec → build order** (dependency graph resolver, incremental patch model, chat-driven amendment).
10. **Domain / hosting provisioning** for generated apps.

---

## F. Recommended target architecture

```
Customer NL Prompt
   │
   ▼
[Layer 3-5 conversational stack]  ── REUSE  scripts/nex-brain/*.mjs
   │
   ▼
Intent → AppBlueprint (new schema)  ── NEW  src/lib/app-builder/blueprint-schema.ts
   │
   ▼
Spec Validator (KNOWN/INFERRED/REQUIRED/UNKNOWN per ADR)  ── NEW
   │
   ▼
Planner → Task DAG  ── NEW
   │
   ▼
Worker Queue  ── NEW (BullMQ or Supabase Realtime)
   │
   ├─ ComposePagesWorker       ── ADAPT pipeline-stream (12 steps)
   ├─ AttachIntegrationWorker  ── ADAPT stripe processor + webhook
   ├─ ProvisionStorageWorker   ── NEW (Supabase project or schema-scoped)
   └─ VisualQAWorker           ── NEW (Playwright not installed)
   │
   ▼
Preview Sandbox (per-app subdomain)  ── NEW
   │
   ▼
Visual + Functional QA  ── MISSING infrastructure
   │
   ▼
Publish → live URL  ── ADAPT publish-pipeline pattern
```

The existing pipeline-stream orchestrator IS the closest structural analog to what the App Builder needs. Its 12-step SSE model is directly reusable as the shape of the worker DAG.

---

## G. Reuse vs rebuild matrix

Score meanings: 0=unusable · 1=concept only · 2=partial · 3=useful foundation · 4=strong reusable · 5=production-ready foundation.

| Existing system | Score | Reuse | Changes needed |
|---|---|---|---|
| `src/lib/studio/sectionRegistry.ts` + 48 sections | 4 | Yes | Extend to ProductGrid+Stripe, ServiceRadiusMap, AboutPage variants; add prop APIs consumable from Blueprint |
| `src/platform/manifest/types.ts` (AppManifest v1) | 3 | Yes | Not the customer AppBlueprint — repurpose as internal "capability descriptor" |
| `src/platform/runtime/install.ts` | 3 | Yes | Extract manifest→pages materialisation pattern; adapt for per-generated-app scaffolding |
| `src/app/api/studio/ai/pipeline-stream/route.ts` | 4 | Yes | Extract steps into Worker classes; add persistent job state; per-step retry/idempotency |
| `src/lib/studio/ai/assembleLayout.ts` | 4 | Yes | Extend to assemble multiple *apps' worth* of pages |
| `src/lib/studio/ai/bespokeProse.ts` + `extractIntent.ts` | 4 | Yes | Feed with AppBlueprint context, not raw prompt |
| `scripts/nex-brain/*.mjs` (Layers 1-5) | 5 | Yes | Wrap as Intent → Blueprint translator |
| `src/lib/stripe.ts` + webhook | 3 | Partial | Handles PLATFORM billing; per-generated-app needs Stripe Connect — new module |
| `src/platform/buttons/payments/processors/stripe.ts` | 3 | Yes | Real Checkout Session code — reusable as per-app checkout adapter |
| `StudioBuilderShell.tsx` (1666 lines) | 3 | Partial | Excellent UX pattern; strip merchant-profile assumptions; wire to AppBlueprint state |
| `StudioBuilderPreviewCanvas.tsx` (1537 lines) | 2 | Partial | Currently reads `window.__studioBuilderPipeline` — needs real per-app sandbox |
| `EditorShell.tsx` (7087 lines) | 2 | Partial | Disconnected from pipeline; NOT the direction for NL App Builder — evaluate what to salvage |
| `src/platform/design/registry.ts` + primitives (25) | 3 | Yes | Foundation; too small today |
| `src/platform/journey/`, `layouts/`, `navigation/`, `themes/` | 4 | Yes | Ranked pure-function registries — genuinely reusable for planning |
| `src/lib/heroLibrary/` + JSON | 4 | Yes | Ship as-is |
| `src/lib/tradeOff.ts` (108 trade slugs) | 5 | Yes | Reuse verbatim as domain taxonomy |
| Worker/queue system | 0 | — | Build new |
| Playwright/screenshot QA | 0 | — | Build new (not installed) |
| Per-generated-app Stripe provisioning | 0 | — | Build new (Stripe Connect) |
| Sandbox environment for generated apps | 0 | — | Build new |
| AppBlueprint schema + validator | 0 | — | Build new |
| App template composition | 1 | Partial | Concept exists in Blueprint PRD; no runtime registry |

---

## H. Staircase website example — end-to-end today

Customer prompt: *"Build me a staircase company website with a large gallery on the homepage, an About page, a Contact page showing our service area on a radius map, and products displayed as cards with prices — customers should buy through Stripe."*

1. **Sign-in gate.** Customer without a merchant session is bounced. **FAIL if customer is not already a merchant.** No "sign up to build" flow.
2. **Wizard demands `tradingName` + `tradeSlug`.** Free-text intent is not the entry point. **FAIL vs the aspirational UX.**
3. **`POST /api/studio/ai/pipeline-stream`** runs 12 steps:
   - Step 1 `business.discover` succeeds → picks e.g. `stair-fitter`.
   - Step 2 `extractIntent` produces `{ goals: [portfolio-showcase, ecommerce], wants: { portfolio: true, ecommerce: true, map: true } }` — uncertain if all four asks surface.
   - Steps 3-4 rank a journey + layout. There is no journey named "Product Commerce + Portfolio + Coverage + Contact" — a nearest-neighbour is picked.
   - Step 7 `section.select` fills the layout. `product_grid/classic3col` exists. `gallery/grid` exists. `contact/split` exists. `map/embed` exists.
   - Step 11 `prose.bespoke` writes copy.
   - Step 12 `layout.assemble` produces `StudioLayoutJson` for HOME (only). Per `assembleLayout.ts` line 11-14: **"About / Contact / Projects left as plan-preview — follow-up step."**
4. **Preview.** iframe shows composed HOME; About/Contact/Products show as PLAN PREVIEW skeletons.
5. **Publish.** Writes one `studio_layouts` row per page — only HOME will have real `sections[]`. Others fail the `sections.length > 0` filter and are dropped.
6. **"Stripe checkout for products"** — does not happen. `product_grid/classic3col.tsx` renders cards but pipeline does not: create Stripe products, generate `price_data`, provision Stripe Connect account, or hook "Buy" to `stripe.checkout.sessions.create`. Stripe Checkout Sessions only used for PLATFORM billing (tier subs, addons, plant hire deposits, image sales). **No customer-per-product checkout path in the builder.**
7. **"Service area radius map"** — `sections/map/embed.tsx` exists but no evidence of `{ centre, radiusMiles }` prop API. **NOT VERIFIED radius-aware.**
8. **Manual steps needed to deliver the request:** everything after page-1 assembly, all commerce, all radius mapping.

**Bottom line:** the request produces a decent HOME preview and nothing else that matches the ask.

---

## I. Proposed UI Schema — `AppBlueprint`

```ts
// src/lib/app-builder/blueprint-schema.ts (NEW)
export type AppBlueprint = {
  blueprintVersion: 1;
  id: string;                       // ab_<ulid>
  name: string;
  domain: { primary: string; alts?: string[] };
  vertical: { taxonomySlug: string; confidence: number };
  brand: { logoAssetId?: string; palette: TokenSet; typography: TokenSet };
  integrations: IntegrationRef[];   // stripe | resend | maps
  site: { pages: PageSpec[]; nav: NavSpec; footer: FooterSpec; seo: SeoSpec };
  data: DataSchemaSpec;             // customer-facing tables
  workers: WorkerRef[];             // background jobs to provision
  qa: QaSpec;                       // visual + functional gates
  provenance: {                     // ADR-0028 KNOWN/INFERRED/REQUIRED/UNKNOWN
    fields: Record<string, "KNOWN" | "INFERRED" | "REQUIRED" | "UNKNOWN">;
    sourceUtterances: string[];     // customer's own words
  };
};

export type SectionInstance = {
  instanceId: string;
  registryId: string;                // e.g. "gallery/grid"
  props: Record<string, unknown>;
  data?: DataBindingRef;             // e.g. "products[]"
  actions?: ActionRef[];             // e.g. { onClick: "stripe.checkout(product.id)" }
  responsive?: { mobile?: Partial<SectionInstance>; tablet?: Partial<SectionInstance> };
  states?: { hover?: {}; empty?: {}; loading?: {}; error?: {} };
};
```

---

## J. Proposed Template Schema — composable

```ts
// src/lib/app-builder/templates/business-website.ts (NEW)
export const businessWebsiteTemplate: BlueprintTemplate = {
  id: "template.business-website",
  version: "1.0.0",
  requires: [],
  provides: ["site.pages.home", "site.pages.about", "site.pages.contact", "site.nav"],
  compose: (ctx) => ({
    site: {
      pages: [
        { id: "home", path: "/", sections: [heroFor(ctx), galleryFor(ctx), ctaFor(ctx)] },
        { id: "about", path: "/about", sections: [aboutFor(ctx), teamFor(ctx)] },
        { id: "contact", path: "/contact", sections: [contactFormFor(ctx)] }
      ]
    }
  }),
  augmentations: [
    "template.gallery-large",       // replaces gallery with wide grid
    "template.product-commerce",    // adds /shop + /product/:id + data.products
    "template.service-radius-map",  // augments Contact with radius map
    "template.stripe-checkout"      // wires action refs to Stripe checkout
  ]
};
```

---

## K. Proposed Worker Task Schema

```ts
// src/lib/app-builder/workers/task-schema.ts (NEW)
export type BuilderTask = {
  id: string;                  // task_<ulid>
  blueprintId: string;
  kind: TaskKind;
  uses: string[];              // e.g. ["sectionRegistry:product_grid/classic3col", "lib:stripe"]
  data: Record<string, unknown>;
  requirements: {
    integrations?: string[];   // ["stripe"]
    capabilities?: string[];   // ["storage.write:app_<slug>_products"]
    plan?: "free" | "paid";
  };
  integration?: { provider: string; account: string };
  constraints: {
    maxDurationMs: number;
    retryPolicy: { attempts: number; backoffMs: number };
    idempotencyKey: string;
  };
  dependsOn?: string[];
  status: "pending" | "running" | "ok" | "failed" | "cancelled";
  attempts: number;
  logs: TaskLogEntry[];
  output?: unknown;
};

export type TaskKind =
  | "compose.page"
  | "attach.integration.stripe"
  | "provision.storage.table"
  | "seed.data.products"
  | "assemble.section"
  | "qa.visual.screenshot"
  | "qa.functional.playwright"
  | "publish.route"
  | "provision.subdomain";
```

---

## L. Visual QA architecture

**MISSING.** Grep for `playwright|puppeteer|pixelmatch|visual-regression` matched only:
- docs and roadmap references
- `package-lock.json` (transitive, not directly installed)

No Playwright config, no screenshot store, no diff runner, no CI wiring. **Everything to be built.**

---

## M. Stripe / integration architecture

**What works (verified by reading full files):**

- `src/lib/stripe.ts` (40 lines) — clean lazy-init singleton. GOOD.
- `src/lib/os/billing/stripe.ts` (39 lines) — **NOT a stub** as the initial size flag suggested; it is a minimal alternate init with `apiVersion: 2025-02-24.acacia` + `constructWebhookEvent()` helper. Two Stripe SDK clients pinned to two API versions (`2024-12-18.acacia` vs `2025-02-24.acacia`) coexist — **potential drift risk**.
- `src/platform/buttons/payments/processors/stripe.ts` (109 lines) — real per-merchant Stripe Checkout Session creation. Registers with `paymentProcessors.register()`. Webhook verification. This is the seed of per-generated-app payment.
- `src/app/api/stripe/webhook/route.ts` — production-hardened handler: `checkout.session.completed`, `customer.subscription.updated/deleted`, tier flips, affiliate scoring, self-referral fraud detection, addon merges.
- `addon-attach/detach` routes make real `stripe.subscriptions.update` calls to add/remove subscription items.
- Real checkout endpoints for: platform tiers, addon attach/detach, plant-hire deposits, Site image sales, vault checkout, homeowner billing, featured-slot bids.

**What is missing for App Builder:**

- No Stripe Connect (multi-tenant per-merchant payouts). Grep for `Connect|connected_accounts|account_link` **NOT VERIFIED** but nothing surfaced.
- No per-generated-app Stripe product/price provisioning.
- No customer Stripe onboarding flow generator.

**Full charge path traced:** merchant → `/studio/checkout` → `POST /api/studio/checkout/route.ts` → `getStripe().checkout.sessions.create()` → Stripe → success → webhook → `handleCheckoutCompleted*` flips listing tier, sets `paid_expires_at`, merges addons. Works for platform billing. **Does NOT work for per-generated-app commerce.**

---

## N. Security and production risks (specific)

1. **Two Stripe API versions pinned to two SDK inits** (`src/lib/stripe.ts:37` vs `src/lib/os/billing/stripe.ts:14`). Silent webhook shape drift if used inconsistently.
2. **`window.__studioBuilderPipeline` global** in `StudioBuilderShell.tsx:195-200` — client global state passed to iframe via reload. Fine for merchant-authored data; unacceptable for customer PII or draft integrations.
3. **`skipPreflight` bypass** in `installApp()` at `src/platform/runtime/install.ts:49` — migration scripts can install apps without dependency/conflict/plan checks. Under NL routing into installApp, an adversarial prompt could hit that path.
4. **`supabaseAdmin` (service-role key) used directly** in `publish-pipeline/route.ts:87,101` after only `loadStudioSession()`. If session logic ever loosens (dev-bypass at `page.tsx:92`), full-table writes leak. Dev-bypass route needs audit.
5. **No rate limit visible on `/api/studio/ai/pipeline-stream`** — rate-limiting only mentioned as a comment. Under NL App Builder load, this is a cost bomb.
6. **`generateBespokeProse` executes LLM output** — no sandbox beyond schema validation. Design the AppBlueprint so no field is executable to close prompt-injection surface.
7. **Credential exposure in generated apps.** No wallet/vault design for a customer's Stripe secret; no per-generated-app credential isolation model.
8. **RLS gaps NOT VERIFIED.** Did not enumerate 327 tables' migrations for RLS coverage.

---

## O. Implementation roadmap — 7 phases

| Phase | Files/modules | Deps | LOC | Risks | Tests | Reuse vs new |
|---|---|---|---|---|---|---|
| 1. Foundation — AppBlueprint schema + validator + provenance | `src/lib/app-builder/blueprint-schema.ts`, `validator.ts`, `provenance.ts` | none | ~1,200 | Getting shape right; ADR-0028 encoding | schema round-trip + validator unit | 100% new; consumes tradeOff.ts |
| 2. Templates — composable + augmentations | `src/lib/app-builder/templates/*` | Phase 1 | ~2,500 | Clean composition | composition + snapshot | Uses existing section registry |
| 3. Workers — queue + worker classes | `src/lib/app-builder/workers/*`, `queue.ts` | Redis or Supabase queue | ~1,800 | Queue choice; idempotency | worker unit + integration | 100% new |
| 4. Visual QA — Playwright + screenshot diff | `tests/visual/*`, `qa/playwright-driver.ts`, pixelmatch, CI | Phase 3 | ~800 | Windows Playwright; storage costs | baseline suite | 100% new |
| 5. Integrations — Stripe Connect + per-app credential vault | `src/lib/app-builder/integrations/stripe-connect.ts`, `vault.ts` | Phase 3 | ~1,500 | PCI scope; Stripe Connect KYC | Stripe test-mode e2e | Adapts platform stripe processor |
| 6. NL Generation — Prompt → Blueprint | `src/lib/app-builder/nl/prompt-to-blueprint.ts` | Phase 1 + nex-brain | ~1,600 | Ambiguity handling; guardrails | 100+ prompt snapshot tests | Reuses conversational stack |
| 7. Production hardening — rate limiting, sandbox, subdomain, publish | `src/lib/app-builder/publish/*`, middleware updates | All | ~2,200 | Wildcard subdomain on Vercel; multi-tenant isolation | e2e publish + rollback | Some reuse from publish-pipeline |

Total new LOC: **~11,600**.

---

## P. Estimated engineering size

- **Existing code reusable (LOC):** ~15,000 (pipeline-stream 692 + assembleLayout 293 + bespokeProse + extractIntent + StudioBuilderShell 1666 partial + PreviewCanvas 1537 partial + EditorShell 7087 partial + section renderers ~4,500 + Stripe processor 109 + webhook + install.ts + registries).
- **New code required (LOC):** ~11,600.
- **Infrastructure required:** Redis (or Supabase queue), Playwright + CI, Vercel wildcard subdomain, Stripe Connect account, ImageKit token per generated app, sandbox environment, secrets vault.
- **Testing required:** ~2,000 LOC (unit for schema+validator+templates+workers; integration for pipeline+publish; visual regression baseline; NL prompt corpus of 100+; Stripe test-mode e2e).

---

## Q. First 10 implementation tasks (concrete, repo-level)

1. **Create `src/lib/app-builder/blueprint-schema.ts`** — `AppBlueprint` TS type with 8 top-level fields: `blueprintVersion`, `id`, `name`, `domain`, `vertical`, `brand`, `integrations`, `site`. Export `zAppBlueprint` Zod schema for runtime validation.
2. **Create `src/lib/app-builder/provenance.ts`** — ADR-0028 `KNOWN | INFERRED | REQUIRED | UNKNOWN` classifier for every leaf field. Returns `{ level, source, confidence }` per field.
3. **Create `src/lib/app-builder/templates/registry.ts`** — same shape as `sectionRegistry.ts` (composition over `createRegistry` from `@/platform/registryKit`).
4. **Create `src/lib/app-builder/templates/business-website.ts`** — first template, reuses `hero/*`, `about`, `contact/split`, `footer/minimal` from `sectionRegistry`.
5. **Create `src/lib/app-builder/templates/product-commerce.ts`** augmentation — declares `products[]` data schema, wires `product_grid/classic3col` to per-item action refs.
6. **Create `src/lib/app-builder/templates/stripe-checkout.ts`** augmentation — extract pattern in `src/platform/buttons/payments/processors/stripe.ts` as per-blueprint action executor.
7. **Create `src/lib/app-builder/queue.ts`** + migration `supabase/migrations/<ts>_app_builder_tasks.sql` — simple in-Supabase task table (`app_builder_tasks`) + typed enqueue/claim/complete API.
8. **Create `src/lib/app-builder/workers/composePageWorker.ts`** — refactor section-selection + prose + assembleLayout portion of `pipeline-stream/route.ts` into a Worker class consuming a `BuilderTask` with `kind: "compose.page"`.
9. **Create `src/app/api/app-builder/blueprint/route.ts`** — `POST` accepts NL prompt, returns `AppBlueprint` (calls `src/lib/app-builder/nl/prompt-to-blueprint.ts` leaning on `scripts/nex-brain/customer-goal-model.mjs` + `advisor-reasoning-engine.mjs`).
10. **Install Playwright** (`npm i -D @playwright/test`) + create `tests/visual/app-builder/README.md` + first baseline test that renders a blueprint via a headless preview endpoint and screenshot-diffs against stored baseline. Forces visual QA loop to exist from day one.

---

## Final take (one paragraph)

The existing "Design Studio" is a **prompt-to-merchant-profile composer**, not an App Builder. Its 12-step pipeline (`pipeline-stream/route.ts`) is genuinely useful and its section registry + journey/layout ranking + KG prose steps are the right raw materials. But there is **no AppBlueprint schema, no worker/queue system, no visual QA, no per-generated-app Stripe provisioning, no sandbox, no per-app subdomain provisioning, and the two builder shells are hard-coded to writing into shared merchant-profile tables (`studio_layouts`)**. The staircase example would today produce a decent home page and empty other pages. Turning this into a world-class NL App Builder is a real 6–9 month engineering project (~11,600 new LOC on top of ~15,000 reused). It is technically achievable and the reuse ratio is better than starting from scratch — but the aspirational "90% there" framing does not survive the file-read. It is roughly **35–40% there in structural foundations, 5% there in the App-Builder-specific layers** (blueprint / workers / QA / per-app integrations / sandbox / publish).

---

*Audit performed 2026-08-14. Every file path cited was opened or verified by grep during the audit. NOT VERIFIED tags mark claims that were beyond the audit's time budget.*
