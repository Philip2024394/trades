# How to add a new Trade OS Studio

**New to the codebase?** Read [ONBOARDING.md](./ONBOARDING.md) first.
It has your day-one env setup, the glossary, and a five-question
scoping checklist that will save you a day of rework.

Every Studio inherits the seven-step generator pipeline from
`createStudio()`. Adding one is three files plus a manifest.
Everything else — Brand DNA parse, compile, critic loop, persistence,
event publish — is inherited.

**Time budget: ~10 minutes once the pattern is second nature.**
**Kernel changes required: zero.**

If any step below requires reading files outside this document,
**that's a documentation bug** — please file a note in the doc so the
next reader can rebuild without leaving this page.

---

## Reference sheet — everything you need at a glance

### `manifest.studio` — allowed values

`"Brand" | "Vehicle" | "Website" | "Print" | "Marketing" | "Photography" | "Documents" | "Social" | "Office" | "Growth"`

### `manifest.id` format

`^[a-z0-9-]+\.[a-z0-9-]+$` — must be `domain.slug`. Examples:
`brand.logo-primary`, `vehicle.van-wrap`, `print.business-card`,
`workwear.polo`, `signage.yard-board`.

### `DesignIR.intent.surface` — allowed values

`"vehicle" | "logo" | "website" | "business-card" | "workwear" | "signage" | "social" | "print" | "invoice" | "letterhead" | "email-signature"`

Router auto-picks the best backend from surface:
- `vehicle`, `workwear`, `social`, `website`, `email-signature` → **gpt-image-1**
- `logo`, `business-card` → **ideogram-v3** (typography wins)
- `signage`, `print`, `invoice`, `letterhead` → **recraft-v3** (vector wins)

Override with `intent.model_hint` if you need a specific backend.

### `DesignIR.outputs[].kind` — allowed values

`"side" | "front" | "rear" | "board" | "spread"`

Use `"spread"` for anything that's not vehicle-panel-specific.

### `DesignIR.outputs[].quality` — allowed values

`"low" | "medium" | "high" | "hd"` — defaults to `"medium"`.

### `BrandRecord` shape — what your buildIR reads

```ts
brand.name           string
brand.tagline        string
brand.industry       string
brand.positioning    string
brand.personality    string[]
brand.audience       string
brand.colour.primary   string  // #hex
brand.colour.secondary string
brand.colour.accent    string
brand.typography.primary   string  // font family
brand.typography.secondary string
brand.logo.lockups   Array<{ slug; url; vector_url? }>
brand.imagery.portfolio  Array<{ url; role; quality_passed }>
brand.voice.tone     string
brand.voice.keywords string[]
brand.services       Array<{...}>
brand.rules.max_colours  number
brand.rules.hero_images  number
```

Any other property = **undefined**. TypeScript will tell you.

### `PersistArgs` shape — what your persist callback receives

```ts
args.merchantSlug     string | null
args.brandSnapshotId  string | null   // FK for lineage
args.sessionId        string | null
args.compiled         CompiledPrompt  // .model, .userPrompt, .qualityProfile
args.ir               DesignIR        // full IR (persist as sds_json)
args.userPrompt       string | null
args.imageUrls        string[]
args.usdCost          number
args.latencyMs        number
args.qualityScore     number | null
args.scoreBreakdown   Record<string, unknown> | null
```

Return `{ generationId: string | null }`.

### DesignIR required vs optional fields

**Required**: `schema_version`, `intent.surface`, `trade`,
`brand_snapshot_id`, `layout.info_groups_max`, `photography`
(can be empty), `typography.*`, `colour.*`, `outputs[0]`.

**Optional**: `intent.style`, `intent.hints`, `intent.model_hint`,
`vehicle` (vehicle surface only), `layout.hero_pct`,
`layout.negative_space_pct`, `layout.style_anchor`,
`layout.diagonal_deg`, `memory_hints`, `business` (any field).

Zod will reject a missing required field with a clear path error.

---

## Step 1 — Create the folder

```
src/apps/<studio-slug>/
├── manifest.ts       # Studio metadata + AI/QA/pricing config
├── index.ts          # createStudio({ manifest, buildIR, runBackend, persist })
├── index.test.ts     # smoke tests (see Step 6 for template)
└── README.md         # one-liner + link to this doc
```

Naming: `<domain>-<artefact>` lowercase kebab. Examples:
`van-wrap` (reference), `logo-primary`, `business-card`, `workwear-polo`,
`signage-yard-board`.

**README.md template**:

```markdown
# <Studio Name>

<one-line purpose>. Built on the Trade OS studio-template — see
[HOW_TO_ADD_A_STUDIO.md](../../../docs/TRADE_OS_SPEC/HOW_TO_ADD_A_STUDIO.md).
```

## Step 2 — Write the manifest

Every field is validated by `StudioAppManifestSchema` (Zod). Missing or
malformed fields refuse installation at boot with a clear path error.

```ts
// src/apps/logo-primary/manifest.ts
import type { StudioAppManifest } from "@/lib/design/trade-os/manifest";

export const manifest: StudioAppManifest = {
  id:          "brand.logo-primary",         // domain.slug per format rule
  name:        "Primary Logo Studio",
  version:     "1.0.0",                      // semver
  studio:      "Brand",                      // from Reference sheet enum
  category:    "identity",
  description: "Generate the merchant's primary logo lock-up.",
  icon:        "Palette",                    // any Lucide icon name
  status:      "enabled",                    // "enabled" | "disabled" | "beta"

  dependencies:        [],
  requiredBrandFields: [                     // paths into BrandRecord
    { path: "name",               required: true },
    { path: "colour.primary",     required: true },
    { path: "typography.primary", required: true }
  ],
  outputs: [
    { type: "logo-primary", mime: "image/png", resolution: "1024x1024", editable: false }
  ],
  permissions:  [{ role: "Owner", action: "generate" }],
  subscriptions: [],

  generator: { type: "image", compiler: "1.0.0", workflow: "single-shot" },
  storage:   { bucket: "logos", retention: "forever", versioned: true, cache: true },
  exporters: [{ type: "png", enabled: true }, { type: "svg", enabled: false }],

  pricing: { plan: "one_time", price: 4.99, credits: 0 },
  ai: {
    reasoningModel: "gpt-5",
    imageModel:     "ideogram-v3",
    criticModel:    "gpt-4o",
    maxAttempts:    3,
    temperature:    0.3
  },
  qa: {
    minimumScore:  92,
    rules:         ["no_gradients", "svg_export_clean"],
    autoFix:       true,
    humanApproval: false
  }
};
```

## Step 3 — Write the Studio index

Three functions. Nothing else.

```ts
// src/apps/logo-primary/index.ts
import { manifest } from "./manifest";
import { createStudio, type PersistArgs } from "@/lib/design/trade-os/studio-template";
import { dispatchBackend } from "@/lib/design/trade-os/backend-dispatch";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DesignIR } from "@/lib/design/compiler";

const { module } = createStudio({
  manifest,

  // 1. Turn Brand DNA + merchant input into a DesignIR.
  //    Only step where you write Studio-specific translation.
  //    See Reference sheet for BrandRecord fields + DesignIR required
  //    fields. Zod refuses invalid IRs at compile-time.
  buildIR: ({ brand, input }): DesignIR => ({
    schema_version: "1.0.0",
    intent: {
      surface: "logo",              // pick from Reference sheet enum
      hints:   []
    },
    trade:             brand.industry || "trade",
    brand_snapshot_id: input.correlation_id,
    layout: {
      style_anchor:    "Modern Wordmark",  // free-form label, informs assembler
      info_groups_max: 1                    // required
    },
    photography: { photo_urls: [], overlay: false, grain: false },
    typography:  {
      aesthetic:        "modern",          // "luxury" | "industrial" | "traditional" | "modern"
      primary_family:   brand.typography.primary,
      secondary_family: brand.typography.secondary
    },
    colour: {
      primary:   brand.colour.primary,
      secondary: brand.colour.secondary,
      accent:    brand.colour.accent,
      split_pct: { body: 60, graphics: 30, accent: 10 }
    },
    constraints: [],                         // resolver adds universal + trade + accessibility + print rules
    outputs: [
      { kind: "spread", width_px: 1024, height_px: 1024, quality: "high" }
    ],
    memory_hints: [],
    business: {
      name:     brand.name,
      tagline:  brand.tagline,
      phone:    "",
      website:  "",
      services: brand.services.slice(0, 6)
    }
  }),

  // 2. Fire the image model. Backend chosen by the router from surface.
  //    Never call generateImage/Ideogram/Recraft directly — always
  //    dispatchBackend so the router stays authoritative.
  runBackend: async ({ compiled }) => dispatchBackend(compiled),

  // 3. Persist the recipe. Optional — omit if ephemeral.
  //    Cost analytics still record automatically via
  //    hammerex_generation_costs.
  persist: async (args: PersistArgs) => {
    const { data } = await supabaseAdmin
      .from("hammerex_logo_generations")
      .insert({
        merchant_slug:    args.merchantSlug,
        brand_snapshot_id: args.brandSnapshotId,
        prompt_text:      args.compiled.userPrompt,
        sds_json:         args.ir as unknown as Record<string, unknown>,
        image_urls:       args.imageUrls,
        model_used:       args.compiled.model,
        usd_cost:         args.usdCost,
        latency_ms:       args.latencyMs,
        quality_score:    args.qualityScore,
        score_breakdown:  args.scoreBreakdown
      })
      .select("id")
      .single();
    return { generationId: data?.id ?? null };
  }
});

export default module;
```

## Step 4 — Register the Studio

Edit `src/lib/design/trade-os/manifest.ts` and add the module to
`ensureAppsLoaded()`:

```ts
const modules: StudioAppModule[] = [
  (await import("@/apps/van-wrap")).default,
  (await import("@/apps/logo-primary")).default    // ← add this line
];
```

That's it. The Capability Registry validates the manifest at install
time; a malformed manifest refuses to load with a clear error message.

## Step 5 — Migration for the persistence table

Copy this template. Change the table name + any bespoke columns.
RLS + owner policy are mandatory per the checklist.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_<studio>_generations.sql

CREATE TABLE IF NOT EXISTS public.hammerex_<studio>_generations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug      TEXT,
  brand_snapshot_id  UUID REFERENCES public.hammerex_brand_snapshots(id) ON DELETE SET NULL,
  prompt_text        TEXT NOT NULL,
  sds_json           JSONB NOT NULL,
  image_urls         JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_used         TEXT,
  usd_cost           NUMERIC(6,4),
  latency_ms         INTEGER,
  quality_score      INTEGER,
  score_breakdown    JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_<studio>_merchant
  ON public.hammerex_<studio>_generations (merchant_slug, created_at DESC)
  WHERE merchant_slug IS NOT NULL;

ALTER TABLE public.hammerex_<studio>_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS <studio>_owner_read ON public.hammerex_<studio>_generations;
CREATE POLICY <studio>_owner_read
  ON public.hammerex_<studio>_generations
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'merchant_slug') IS NOT NULL
    AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
  );
```

Apply with `node scripts/apply-migrations.mjs supabase/migrations/<file>.sql`.

If the Studio doesn't need storage (ephemeral preview generator etc),
omit the `persist` callback entirely. `hammerex_generation_costs` still
records cost analytics automatically.

## Step 6 — Test it

Copy this template. Change the imports + module import path.

```ts
// src/apps/<studio-slug>/index.test.ts
import { describe, it, expect } from "vitest";
import { StudioAppManifestSchema } from "@/lib/design/trade-os/manifest";
import { compile } from "@/lib/design/compiler";
import { chooseBackend } from "@/lib/design/compiler/backends/router";
import { manifest } from "./manifest";
import studioModule from "./index";

describe("<Studio Name>", () => {
  it("manifest passes StudioAppManifestSchema", () => {
    expect(() => StudioAppManifestSchema.parse(manifest)).not.toThrow();
  });

  it("module exports a generator function", () => {
    expect(typeof studioModule.generator).toBe("function");
  });

  it("router picks the expected backend for this surface", () => {
    const ir = {
      schema_version: "1.0.0",
      intent: { surface: "logo", hints: [] },
      // ...minimal valid IR (see Step 3 example)
    };
    const decision = chooseBackend(ir as any);
    expect(decision.backend).toBe("ideogram-v3");
  });
});
```

Run with `npx vitest run src/apps/<studio-slug>`.

## What you inherit for free

Every Studio built via `createStudio()` gets:

- Zod-hard Brand DNA validation
- Deterministic 14-stage compiler pipeline
- SHA-256 recipe caching
- 12-axis Design Critic scoring (metadata + vision path when key set)
- 3-attempt auto-regenerate loop with feedback threading
- Best-effort persistence via your `persist` callback
- `hammerex_generation_costs` analytics row (always, even without persist)
- `Asset.Generated.v1` event publish
- Cascade subscribers (colour/typography change → asset flagged stale)
- Export ZIP inclusion (recipes automatically bundled)
- RLS defence in depth on the persistence tables
- Automatic backend routing (gpt-image-1 / ideogram-v3 / recraft-v3)

## What you're never allowed to do

- Bypass the compiler. Direct AI calls violate Brand DNA enforcement.
- Skip the critic loop. Merchants must never see sub-92 output.
- Write to `hammerex_brand_identity` from a Studio. Studios read Brand
  DNA, they never mutate it. Use `PATCH /api/studio/brand/update` instead.
- Emit events without `envelope()`. Raw publishes lose envelope
  metadata and break replay.

## Checklist before shipping a Studio

- [ ] Manifest passes `StudioAppManifestSchema.parse()`
- [ ] `buildIR` returns valid `DesignIR` (Zod-parsed by compiler at runtime)
- [ ] `runBackend` returns via `dispatchBackend(compiled)`
- [ ] `persist` writes to a table with RLS enabled + owner policy
- [ ] Migration applied successfully
- [ ] Registry entry added in `manifest.ts`
- [ ] At least one Vitest test covers manifest + generator + router
- [ ] `npm run typecheck` clean on your Studio files
- [ ] README.md links back to this doc

## Common friction (and how to avoid it)

- **"Which surface value?"** → See Reference sheet enum. Pick the one
  closest to your artefact. Router routes from it.
- **"Do I need `layout.hero_pct`?"** → No. It's optional. See Reference
  sheet required-vs-optional list.
- **"What fields exist on `brand`?"** → See Reference sheet BrandRecord
  shape. Everything else is undefined.
- **"How do I know if my manifest is valid?"** → Import
  `StudioAppManifestSchema` and call `.parse(manifest)` in a test.
  Zod tells you exactly which path is wrong.
- **"The destructured `const { module }` shadows Node's global."** →
  Correct. It's an ES module scope so harmless. Alias if your linter
  complains: `const { module: studioModule } = createStudio(...)`.
