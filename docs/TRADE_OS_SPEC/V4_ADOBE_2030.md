# Trade Operating System · Volume 4
## Adobe 2030 — Chief Architect Review

**Audience:** Senior AI + Platform Engineering Team
**Source:** ChatGPT design-brief architecture series, V4 strategic review (fresh-context reviewer).
**Status:** Strategic review doc. Not blocking implementation. Validates the architecture we already shipped in V1-V3.

---

## Executive Summary

> **Trade OS is not a prompt app. It is a brand compiler.**

The core abstraction:

1. Brand DNA (source of truth)
2. Deterministic Compiler
3. Model Orchestrator
4. Design Critic + Policy Engine
5. Portable Brand Package

**AI becomes a stateless manufacturing service. The merchant's business identity lives in deterministic data.**

That single decision solves trust, maintainability, portability, auditing, and vendor independence.

> **Validation of our direction:** ChatGPT's Adobe-2030 architect explicitly states our current direction (Brand DNA → deterministic compiler → AI generation → critic → export) is *"already unusually close to what I would expect from a greenfield Adobe architecture."* V1-V3 hold up.

---

## 1. Deterministic vs AI vs Human

| Responsibility | Owner |
|-|-|
| Brand DNA schema | **Code** |
| Colour conversions (HEX/RGB/CMYK/Pantone) | **Code** |
| Vehicle dimensions / printable safe areas | **Code** |
| Export packaging / ZIP manifests | **Code** |
| Eligibility rules (Gas Safe, NICEIC) | **Code** |
| Prompt planning / layout intent | **AI Reasoning** |
| Tone-of-voice adaptation | **AI Reasoning** |
| Asset rendering (van, workwear, signage) | **Image Generation** |
| Photoreal mockups | **Image Generation** |
| Final publish / print approval | **Human** |

### Never let AI own facts

- "This merchant is Gas Safe registered."
- "The van is a 2024 Ford Transit L3H2."
- "Primary colour is Hammerex Yellow."
- "Minimum logo width is 38mm."

**These are database facts. AI may suggest; it must not become the authority.**

---

## 2. AI-Native Architecture (not "AI wrappers")

### 2030 Reference Architecture

```
Client (Web / iOS / Android / Desktop)
        ↓
Edge Runtime (Cloudflare / Fastly Compute)
- Auth · Session · Feature flags · Token hydration · Low-latency previews
        ↓
API Gateway (gRPC + GraphQL)
        │
 ┌──────┴──────────────────────────────────────┐
 ▼                                              ▼
Brand Core                                Event Bus
(Postgres + pgvector)                     (Kafka / Redpanda)
- BrandDNA                                - AssetRequested
- Tokens                                  - AssetGenerated
- Assets                                  - CriticPassed
- Snapshots                               - ExportCompleted
- Permissions                             - CertificationUpdated
        ↓
Prompt Compiler (deterministic)
- Intent IR · Layout grammar · Trade constraints · Vehicle geometry · Print specs
        ↓
Model Orchestrator (provider-agnostic)
- Reasoning pool · Image pool · OCR/vision pool · Speech pool
        ↓
Design Critic Ensemble
- Visual critic · Brand critic · Print critic · Regulatory critic
        ↓
Asset Registry (immutable)
- SVG · PDF/X-4 · PNG · WebP · AI metadata · SHA256
        ↓
Export Providers
- Print package · Canva · Figma · Shopify · WordPress · BIM/CAD
```

**Every artifact reproducible from Brand DNA + compiler version + model manifest.**

The compiler sits **between** the merchant and the models.

---

## 3. Canonical Data Model

### Brand DNA
```json
{
  "brandId": "uuid",
  "version": "8.2",
  "trade": "electrician",
  "positioning": "Domestic & commercial electrical",
  "palette": {
    "primary":   "#F5B400",
    "secondary": "#111111",
    "accent":    "#FFFFFF"
  },
  "typography": {
    "heading": "Inter Tight",
    "body":    "Inter"
  },
  "vehicleRules": {
    "minLogoWidthMm":    380,
    "avoidPanelGaps":    true,
    "reflectiveAllowed": true
  },
  "tone": ["professional", "local", "trustworthy"]
}
```

### Asset Manifest
```json
{
  "assetId":  "uuid",
  "brandId":  "uuid",
  "type":     "van-wrap",
  "source": {
    "brandVersion":    "8.2",
    "compilerVersion": "7.4",
    "criticVersion":   "3.2",
    "modelManifest": {
      "reasoning": "gpt-5.5",
      "image":     "image-v4"
    }
  },
  "checksum": "sha256:..."
}
```

**Forensic reproducibility.** If a merchant says "the logo moved after regeneration," you can prove exactly which compiler and model versions produced each asset.

---

## 4. Event-Driven vs Synchronous

### Synchronous (under 500ms)
Login · Load Brand Vault · Colour/token lookup · Template selection · Simple previews · Permission checks

### Event-Driven (seconds to minutes)
Van generation · Multi-asset campaigns · Website regeneration · Seasonal marketing packs · Background brand health scans · Export packaging · Certification re-validation

**Our shipped append-only Event Bus + DLQ is exactly the right foundation** (validated).

### Recommended event shape
```json
{
  "eventId":       "uuid",
  "type":          "AssetRequested",
  "merchantId":    "uuid",
  "correlationId": "uuid",
  "payload": {
    "assetType": "van-wrap",
    "vehicle":   "ford-transit-l3h2"
  },
  "occurredAt":    "2026-07-22T10:00:00Z"
}
```

Everything downstream becomes replayable.

---

## 5. Edge vs Server

| Edge | Server |
|-|-|
| Auth/session | Brand DNA storage |
| Feature flags | Vector memory |
| Cached tokens | Prompt compilation |
| Thumbnail previews | Image generation |
| Offline editing | Critic ensemble |
| Touch/pen interactions | Export packaging |

**Rule of thumb:**
- Business record → **server**
- Latency + interaction → **edge**

---

## 6. Scalability — 100 → 1,000,000 merchants

### Storage
- **Postgres** (primary) — tenants, brands, permissions
- **Object storage** (S3/R2) — binaries
- **pgvector** — semantic memory

### Throughput assumptions
- Peak asset generations: **10k / min**
- Average render time: **8s**
- Concurrent jobs: **~1,333**

**Queueing problem, not web-server problem.**

Use: Redpanda/Kafka · KEDA autoscaling · GPU worker pools · Idempotent consumers · Per-merchant concurrency limits.

---

## 7. Cost Optimisation ⭐ (where most AI startups die)

### Target economics
- Brand Foundation £19.99 → target AI cost £0.50–1.50
- Vehicle Branding £29.99 → target AI cost £1–3
- Complete Brand OS £99–149 → target AI cost £5–15

### How

**Compile once, render many.** One reasoning pass generates Layout IR:
```json
{
  "heroLogo":  { "x": 0.18, "y": 0.42 },
  "phone":     { "x": 0.82, "y": 0.12 },
  "services":  ["rewires", "consumer units", "EV chargers"]
}
```

Then produce Transit wrap, Vivaro wrap, Business card, Hoodie, Facebook cover **without another expensive reasoning call.**

**Cache aggressively.** Hash = `BrandDNA + Intent + CompilerVersion`. If another electrician asks for the same "clean domestic van" composition, reuse planning artifacts.

**Use small models by default.** Large model for brand synthesis, medium for campaign copy, small for tone rewrites / alt text / caption variants.

---

## 8. Vendor Lock-In — Define Capabilities, Not Providers

```ts
interface ImageProvider {
  generate(req: ImageRequest):  Promise<ImageResult>;
  edit(req: EditRequest):        Promise<ImageResult>;
  supports(masking: boolean):    boolean;
}
```

Then implement: OpenAI · Google · Anthropic · Black Forest · Future local models.

**The compiler emits provider-neutral intent.**

---

## 9. Trust & Regulatory

### Trust — Provenance Card per asset

```
Provenance

Based on Brand DNA v8.2
Generated 22 Jul 2026
Passed 14 design checks
Print-safe (300 DPI / CMYK / bleed)
Vehicle-safe for Ford Transit L3H2
```

**"AI made this" vs "this is production-ready" is the difference.**

### UK compliance

**GDPR** — Tenant-isolated data · Regional storage (UK/EU) · Right to erasure · Data processing records · No model training on merchant assets by default.

**ASA** — Deterministic rules: No unverifiable superlatives · No fabricated reviews · No "approved by" claims without evidence · Medical/financial-style claim checking.

**DVLA / vehicle graphics** — Curated geometry library: Door handles · Fuel caps · Sensor zones · Registration visibility · Reflective material constraints. **CAD constraints, not AI prompts.**

**Gas Safe / NICEIC** — Store only merchant-supplied credentials · Never infer certification · Require: Registration number · Expiry date · Optional API verification · Audit log.

---

## Top 3 Architectural Bets (build in 2026)

### 1. Brand DNA as a typed graph
Everything references the graph. Never store design decisions only inside prompts.

### 2. Deterministic Prompt Compiler
Make prompts a compiled artifact with versions, tests, and reproducibility.

### 3. Immutable Asset Registry
Every generated file gets a checksum, lineage, and export manifest. **This becomes your enterprise moat.**

---

## Top 3 Anti-Patterns

### 1. AI owns business facts
Never let the model become the source of truth for certifications, dimensions, colours, or legal claims.

### 2. Prompt strings in UI components
Prompts must be compiled from structured intent, not hand-written in React/Vue pages.

### 3. Synchronous image generation
Never block the user on a GPU call. Queue it, stream progress, keep the interface interactive.

---

## 2030 Merchant Experience — Minute by Minute

**0:00** — First login. *"What trade are you?"* → Electrician.

**0:15** — Business capture. Upload existing van photo, logo (optional), website (optional).

**0:45** — AI analysis. Vision extracts colours, typography, vehicle model, service categories. **System asks for confirmation instead of silently deciding.**

**1:15** — Brand DNA created. Complete brand profile generated and versioned.

**1:30** — Van generation requested. Merchant taps "Generate my van". Event emitted. UI stays responsive.

**1:31–1:40** — Background rendering. Compiler builds Layout IR → image provider renders → critics evaluate brand, print, regulatory constraints.

**1:41** — Ready. Three approved options appear with real panel geometry, bleed, material recommendations.

**2:00** — Export. Merchant taps "Send to printer". Printer receives only production-safe PDF/X-4 package and installation notes.

**The merchant never sees "prompt", "seed", "CFG", or "model". They experience a creative department.**

---

## The One Recommendation

> **Treat Brand DNA as source code.**
>
> Everything else — prompts, images, websites, print files, social posts, even future AI interactions — is a **compiled artifact.**
>
> Models will change every 6 months. Providers will change. Image quality will become commoditised.
>
> **The thing that compounds for 10 years is the merchant's structured business identity.**
>
> The export specification ("leave with everything") already hints at this philosophy. Make that the technical centre of the platform, not just a marketing promise.
>
> That is the architectural decision that turns Trade OS from "another AI design tool" into **infrastructure for a trades business.**

---

## Networkers-specific validation notes

Every architectural principle in this V4 review is **already captured** in the earlier volumes:

| V4 Recommendation | Where It Lives |
|-|-|
| Brand DNA as source of truth | PRINCIPLES.md Principle 1 · V1 Part 2 |
| Deterministic compiler | V3 Q13 Prompt Compiler |
| Model provider abstraction | V3 Extended Q29 AI Model Router |
| Immutable Asset Registry | V1 Part 1 Version Service · Master Rule "save recipe not image" |
| Design Critic ensemble | V3 Q12 Design Critic |
| Event-driven asynchronous | V1 Part 4 Event Bus (shipped as code) |
| Provenance card | Aligned with V3 Q13 explainability metadata |
| Export as first-class capability | V2 Q10 Export |
| Anti-lock-in | PRINCIPLES.md Principle 9 |
| Compile once render many | Extends V3 Q13 Prompt Recipes |
| Vector geometry as CAD not AI | V3 Extended Q20 Vehicle Intelligence |
| Regulatory hard-coded | V3 Q14 DIL "AI never owns facts" |
| Trust via provenance | PRINCIPLES.md Principle 6 reasoning trace |

**Nothing in V4 contradicts V1-V3. Every point reinforces the architecture we already have.**

The one architectural bet worth highlighting from V4 that we haven't strongly formalised yet:

- **"Compile once, render many"** — one reasoning pass produces a Layout IR that generates Transit + Vivaro + Business Card + Hoodie + Facebook cover without more reasoning calls. This should be a first-class code pattern in `src/lib/design/compiler/` — the IR outputs a **layout** that multiple **renderers** consume. Aligns with the Recipe layer from Q13. Explicitly bake as `SharedLayoutIR` type in the compiler.

The V4 architect's closing line is worth quoting to every future engineer:

> **"Treat Brand DNA as source code."**

---

## Status

**V4 filed.** Trade OS spec is now 100% complete across all four volumes. Every architectural question from the ChatGPT series has an answer in the brain.

Next work is pure implementation. No more spec questions blocking.
