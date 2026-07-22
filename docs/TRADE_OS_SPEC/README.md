# Trade Operating System — Architecture Specification

Canonical architecture specification for the Trade OS, the platform layer that turns Mate + Studio + Brand DNA + AI models into a Design Operating System for UK trades.

Written as a multi-volume specification per the "Architecture Specification Series" approach — the ChatGPT-generated architecture is split into 4 volumes to avoid single-response context degradation.

## 🔒 Master Reference (read first)

- **[Engineering Principles](./PRINCIPLES.md)** — **CONFIDENTIAL · Trade Secret**. The Master Rule (*"save the recipe, not the image"*) + 11 governing principles. Read this before anything else. If any spec doc contradicts this file, this file wins.
- **[Studio Interface Spec](./UI_SPEC_STUDIO_INTERFACE.md)** — Internal. Three-panel shell + left navigation + 6-tab preview + signature features (Improve Design, Show 4 Ideas, Creative Director Panel, Command Palette, Brand Health). Applies across every Studio.

## Volume Index

### ✅ V1 — Core Platform (complete, 4 parts)
The kernel.

- **[V1 Part 1 — Core Architecture](./V1_PART_1_CORE_ARCHITECTURE.md)** — services, layered architecture, dependency graph, generation pipeline, regeneration model, permissions, TypeScript runtime interfaces, tech stack recommendations
- **[V1 Part 2 — Brand DNA Schema v2](./V1_PART_2_BRAND_DNA_SCHEMA.md)** — 12 sectioned Brand DNA, three-layer field model (authoritative / derived / learned), immutable versioning per-field + per-record, inheritance for franchises, v1 → v2 migration, Zod schemas
- **[V1 Part 3 — Studio App Manifest v2](./V1_PART_3_APP_MANIFEST.md)** — plugin contract for every Studio App, dependencies, brand fields, outputs, permissions, event subscriptions, generator, storage, exports, pricing, AI config, QA. Includes Van Wrap App reference implementation
- **[V1 Part 4 — Event Bus](./V1_PART_4_EVENT_BUS.md)** — central nervous system. Event envelope, 6 domains, subscriber registration, ordering per (merchant, brand), retry + DLQ, event store append-only, replay, versioning, correlation IDs

### ✅ V2 — Merchant Experience (complete)
The application layer.

- **[V2 Q9 — Pricing Architecture](./V2_Q9_PRICING.md)** — 8 bundles, subscription layer, sell outcomes not images, dynamic pricing, loyalty via Brand Completion
- **[V2 Q10 — Export (Anti-Lock-In)](./V2_Q10_EXPORT.md)** — complete ZIP structure, README template, per-role share links, AI folder with portable brand DNA
- **[V2 Part 5 — Brand Vault (Merchant Home Screen)](./V2_PART_5_BRAND_VAULT.md)** — six-zone home screen: Hero + Brand Health + Quick Actions + My Brand + My Assets + Recent Activity + AI Recommendations
- **[V2 Part 6 — Version UX](./V2_PART_6_VERSION_UX.md)** — preview + approval + rollback flow, Brand Impact Map, three regeneration modes
- **[V2 Part 7 — Capability Store](./V2_PART_7_CAPABILITY_STORE.md)** — 12 Studios, business-outcome bundles, Business Roadmap
- **[V2 Part 8 — Build Order](./V2_PART_8_BUILD_ORDER.md)** — dependency-first construction, revenue-first surfacing, Asset Library Studio

**V2 complete.**

### ✅ V3 — AI Intelligence (near-complete)

- **[V3 Q11 — AI Memory Architecture](./V3_Q11_AI_MEMORY.md)** — 5 memory types, confidence scoring, decay, cross-merchant learning, retrieval pattern
- **[V3 Q12 — AI Design Critic](./V3_Q12_DESIGN_CRITIC.md)** — 12 scoring categories, 92 threshold, auto-regenerate loop, surface-specific rubrics
- **[V3 Q13 — Prompt Compiler](./V3_Q13_PROMPT_COMPILER.md)** ⭐⭐⭐ — 14-stage pipeline, IR, sectioned assembly, model optimiser, prompt recipes. The heart of the platform.
- **[V3 Q14 — Design Intelligence Layer v2](./V3_Q14_DIL_V2.md)** — 12 knowledge modules, independent versioning, rule provenance
- **[V3 Q15 — Design Token Engine](./V3_Q15_DESIGN_TOKEN_ENGINE.md)** — universal brand translation to Web/iOS/Android/Print/Vehicle/Workwear/Signage
- **[V3 Q16 — Multi-Agent Orchestration](./V3_Q16_MULTI_AGENT_ORCHESTRATION.md)** — Workflow Engine, agent contract, checkpoints, parallel execution
- **[V3 Extended — Additional Knowledge Areas 18-32](./V3_ADDITIONAL_KNOWLEDGE.md)** — Design Language System · Trade Intelligence · Vehicle Intelligence · Print Intelligence · Layout Grammar Engine · Merchant Psychology · Conversion Intelligence · AI Cost Optimiser · Brand Evolution · Competitive Intelligence · Prompt Analytics · AI Model Router · Creative Director Knowledge Base · Design Pattern Library · Knowledge Graph

**V3 complete.** Closing rule elevated to PRINCIPLES.md Principle 12.

### ✅ V4 — Future Vision (complete)

- **[V4 Adobe 2030 — Chief Architect Review](./V4_ADOBE_2030.md)** — validates V1-V3 architecture, deterministic vs AI vs human ownership matrix, 2030 reference architecture, cost economics per bundle, top 3 architectural bets, top 3 anti-patterns, minute-by-minute 2030 merchant journey. **The one recommendation: "Treat Brand DNA as source code."**

**Trade OS spec 100% complete across all four volumes. Every architectural question has an answer in the brain. No more spec blocks implementation.**

## Reading order

Every engineer working in `src/lib/design/`, `src/apps/`, or `src/app/studio/` reads V1 before writing code. V2 + V3 before contributing to any surface that touches merchant data or generative output.

## Reference implementation

- Runtime TypeScript interfaces: `src/lib/design/trade-os/runtime.ts`
- Brand DNA sectioned schemas: `src/lib/design/brand/*` (to refactor in line with V1 Part 2)
- SDS schemas: `src/lib/design/sds/schema.ts`
- Brand fingerprint: `src/lib/design/brand/fingerprint.ts`
- Foundation migration: `supabase/migrations/20260722560000_design_os_foundation.sql`

## The rule that keeps the platform coherent

> Brand DNA is the only editable source of truth. Every image, document, website, app screen, vehicle wrap, and marketing asset is a derived artifact. No Studio owns data; every Studio subscribes to Brand DNA through the event bus and publishes new assets back into the Brand Vault.
