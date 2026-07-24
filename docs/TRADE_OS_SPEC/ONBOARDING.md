# Trade OS onboarding — your first day

Your Monday-morning kit. Everything you need to open a laptop, run the
platform locally, and ship your first Studio by end of day.

> If this doc leaves you stuck, that's a bug. Log it at the bottom of
> this file under "Onboarding friction log" so the next hire lands
> softer than you did.

---

## What is this?

**Trade OS** is the branding operating system inside **The Networkers**
platform (`C:\Users\Victus\trades`, Next.js 16, port 3008). It turns a
merchant's **Brand DNA** (colours, typography, positioning) into every
piece of branding they'll ever need: van wraps, business cards,
workwear, websites, marketing. Each production surface is a **Studio**.

You are not building the platform. You are building one Studio.

### The shape of a Studio

```
Merchant clicks "Generate"
         ↓
Studio's buildIR() turns Brand DNA into an intent  ─────┐
         ↓                                              │
Compiler (14 deterministic stages)                     ← everything below
         ↓                                              │  is inherited
Router picks backend (gpt-image-1 / ideogram / recraft) │  from
         ↓                                              │  createStudio()
Image model fires                                       │
         ↓                                              │
Design Critic scores 12 axes (vision + reasoning)      │
         ↓                                              │
Auto-regenerate if below 92 (max 3 attempts)           │
         ↓                                              │
Persist recipe + emit event + log cost                 │
         ↓                                              │
Merchant sees the result ───────────────────────────────┘
```

**Master Rule: save the recipe, not the image.** The recipe (compiled
prompt + IR + score) is the durable artefact. Images are re-renderable.

---

## Day-one environment checklist

- [ ] Clone: `cd C:\Users\Victus\trades` (already done for you if the
      machine is set up)
- [ ] Install: `npm install --legacy-peer-deps`
- [ ] Environment: copy `.env.example` (ask if missing) to `.env.local`.
      Minimum vars you need: `NEXT_PUBLIC_SUPABASE_URL`,
      `SUPABASE_SERVICE_ROLE_KEY`. Talk to Philip for keys. Everything
      AI-related (`OPENAI_API_KEY`, `IDEOGRAM_API_KEY`, `RECRAFT_API_KEY`)
      is optional in dev — the compiler runs without keys and the
      generator returns a clean `openai_unavailable` result.
- [ ] Dev server: `npm run dev` → http://localhost:3008
- [ ] Typecheck: `npm run typecheck`
- [ ] Tests: `npm run test`
- [ ] Supabase: we use hosted Supabase (`msdonkkechxzgagyguoe`), not
      local Docker. Migrations apply via
      `node scripts/apply-migrations.mjs supabase/migrations/<file>.sql`.
      Env var it reads: `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`
      in `.env.tools.local`. Ask Philip for the token.

---

## Glossary — read this before the how-to

| Term | Meaning |
|---|---|
| **Trade OS** | The branding-OS layer inside The Networkers |
| **Studio** | One production surface (Van Wrap, Logo, Business Card, ...). Manifest + generator + persist |
| **Brand DNA** | A merchant's authoritative brand data. Zod-validated `BrandRecord`. Table: `hammerex_brand_identity` |
| **Brand Snapshot** | Immutable point-in-time copy of Brand DNA. Table: `hammerex_brand_snapshots` |
| **IR (DesignIR)** | Intermediate representation the compiler consumes. Deterministic. Zod-validated |
| **Compiler** | 14 deterministic stages that turn IR + Brand DNA into a `CompiledPrompt`. Never calls AI |
| **CompiledPrompt** | Output of the compiler. Contains `.model`, `.userPrompt`, `.qualityProfile`, `.explainability` |
| **Router** | `chooseBackend(ir)` — picks `gpt-image-1` / `ideogram-v3` / `recraft-v3` by surface |
| **Backend Dispatch** | `dispatchBackend(compiled)` — actually calls the chosen model |
| **Critic** | Reviews generated pixels on 12 axes. Score >= 92 approves. < 85 escalates. Between = regenerate |
| **Regenerate loop** | Max 3 attempts. Critic's feedback threads into the next compile |
| **Event Bus** | Append-only. Publishes `Brand.Updated.v1` / `Identity.ColourChanged.v1` / `Asset.Generated.v1`. Subscribers cascade |
| **Studio Template** | `createStudio({ manifest, buildIR, runBackend, persist })` factory. Everything above happens inside it |
| **Capability Registry** | `capabilityRegistry.execute(id, input)` — where API routes call your Studio |
| **Nex** | The AI persona inside the Studio interface. Renamed from Mate |
| **Master Rule** | Save the recipe, not the image |
| **Merchant vs Homeowner** | Merchants are trades (plumbers, roofers). Homeowners are their customers. Studios are merchant-facing |

---

## Before you write a single file — scope your Studio

The doc will happily let you build a Studio that shouldn't exist.
Before Step 1 of `HOW_TO_ADD_A_STUDIO.md`, answer these five questions:

### 1. Whose brand does it use?

- **Merchant's Brand DNA?** → Standard Studio. Follow the how-to as
  written. Examples: Van Wrap, Logo, Business Card.
- **Customer's inputs (photos, dimensions, preferences)?** → You need
  a new customer-input table + a hybrid IR. **Talk to Philip first**;
  no reference implementation yet.
- **Both?** → Same as above.

### 2. Does an existing `surface` fit?

- Look at the Reference sheet in `HOW_TO_ADD_A_STUDIO.md`.
- If yes → use it, router routes automatically.
- If no → **stop.** Adding a surface is a kernel change (edits
  `SurfaceSchema` in `src/lib/design/compiler/ir.ts`). Talk to Philip.
  New surfaces need router rules too.

### 3. Does an existing `studio` category fit?

- Same rule as above. Categories: `Brand | Vehicle | Website | Print
  | Marketing | Photography | Documents | Social | Office | Growth`.
- If nothing fits, don't invent — talk to Philip.

### 4. Does the merchant get a physical artefact?

- Yes (van wrap, workwear, business card, signage) → set surface to a
  print-family value, print rules auto-apply (CMYK, bleed, DPI).
- No (website hero, social ad) → digital surface, WCAG rules auto-apply.

### 5. What backend does the router pick?

- Vehicle / workwear / social / website / email-signature → **gpt-image-1**
- Logo / business-card → **ideogram-v3** (typography wins)
- Signage / print / invoice / letterhead → **recraft-v3** (vector wins)
- Not sure? Override with `intent.model_hint` in your `buildIR`.

If all five answers are clean, proceed to `HOW_TO_ADD_A_STUDIO.md`.
If any answer is "I don't know," pause — 30 minutes of scoping saves
a day of rework.

---

## Kernel vs Studio — what you can and can't touch

| File | Rule |
|---|---|
| `src/apps/<your-slug>/**` | Yours — anything goes |
| `src/lib/design/trade-os/manifest.ts` (registry line only) | **One-line edit** to add your import to the modules array. Not a "kernel change" — it's config. See Step 4 of how-to |
| `src/lib/design/trade-os/studio-template.ts` | **Kernel — do not edit.** If you need behaviour it doesn't provide, talk to Philip |
| `src/lib/design/compiler/**` | Kernel — do not edit |
| `src/lib/design/critic/**` | Kernel — do not edit |
| `src/lib/design/brand/schema.ts` | Adding a field to `BrandRecord` is a **coordinated change** — affects Discovery agent, every Studio, every migration. Talk to Philip |
| `supabase/migrations/*.sql` | Add new. Never edit landed migrations |
| `docs/TRADE_OS_SPEC/**` | Improve any time |

---

## Debugging your Studio

- **The compiler didn't fail but the model wasn't called** → check
  `OPENAI_API_KEY` / `IDEOGRAM_API_KEY` / `RECRAFT_API_KEY` env. All
  backends return `null` cleanly on missing keys. Look for
  `[ideogram] transport error` / `[recraft] api error` / etc in stdout.
- **Compile failed** → the error has a JSON path (e.g. `layout.info_groups_max: Required`). Zod paths are literal. Fix the IR.
- **Critic never approves** → set `OPENAI_API_KEY` (critic uses gpt-4o).
  Without it, critic returns null and the loop surfaces the first output.
- **Persist silently fails** → check stdout for `[<studio>] persist failed`.
  Studio still returns success; persistence is best-effort.
- **Event not firing** → `eventBus.publish` is inside the template.
  Check `ensureSubscribersLoaded()` was called. Look at `hammerex_trade_os_events` for the row.
- **Inspect the compiled prompt** → the generator returns `prompt_used`
  in its result. Log it. It's the deterministic full compilation.

---

## Wiring a Studio into the UI

The how-to stops at "your Studio is callable." Merchants can't see it
yet. To make it merchant-facing:

1. **API route**: `src/app/api/studio/generate/<slug>/route.ts`
   — see `src/app/api/studio/generate/van-wrap/route.ts` for the pattern.
   It's ~30 lines: load session, load Brand DNA, `capabilityRegistry.execute("your-id", input)`.
2. **Merchant page**: `src/app/studio/studios/<slug>/page.tsx` +
   `src/components/studio/studios/<Slug>Studio.tsx`. See `VanWrapStudio.tsx` for the reference.
3. **Vault tile**: `src/components/studio/vault/BrandVaultHome.tsx` —
   add an entry to the My Assets grid so merchants find it.

---

## Cost + performance

- Every generation logs one row to `hammerex_generation_costs`.
- Query the view `v_generation_margin_by_day` for daily margin per Studio.
- Latency budget: aim for < 60 seconds end-to-end. Generation dominates.
- Merchant charge: pull from your manifest's `pricing.price` and the
  bundle table (`src/lib/design/pricing/bundles.ts`).
- Rule of thumb: **AI cost < 5% of the charge.** If your Studio breaks
  that, tell Philip — pricing or model choice needs review.

---

## Ship-a-Studio-in-a-day timebox

- 09:00 — read this doc + `HOW_TO_ADD_A_STUDIO.md` (30 min)
- 09:30 — scope the five questions above (30 min)
- 10:00 — Step 1-3: files (2 hours)
- 12:00 — Step 4-5: registration + migration (30 min)
- 12:30 — Step 6: test (30 min)
- 13:00 — lunch
- 14:00 — UI wiring per section above (2 hours)
- 16:00 — smoke test end-to-end in dev, iterate (1 hour)
- 17:00 — PR

If you're behind by more than 90 minutes at any checkpoint, you're
either hitting a doc gap (log it below) or your Studio doesn't fit the
pattern (talk to Philip).

---

## Onboarding friction log

Append here every time you hit a wall. Format:

```
YYYY-MM-DD | <your name> | <what confused you> | <what you wish the doc had said>
```

- 2026-07-22 | Alex (simulated) | `manifest.studio` has 10 enum values, none of them "Kitchen". Doc didn't say what to do when nothing fits. | Added "Before you write a single file" scoping section above.
- 2026-07-22 | Alex (simulated) | Contradiction: doc opener says "zero kernel changes" but Step 4 edits `manifest.ts`. | Added "Kernel vs Studio" table clarifying registry line is config, not kernel.
- 2026-07-22 | Alex (simulated) | No idea if tests hit real OpenAI. | Added debug section — compiler runs without keys, backends return null cleanly.
- 2026-07-22 | Alex (simulated) | Where does a merchant actually find my Studio? | Added "Wiring a Studio into the UI" section.
