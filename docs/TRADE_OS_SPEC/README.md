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

### 🟡 V2 — Merchant Experience (in flight)
The application layer.

- **[V2 Part 5 — Brand Vault (Merchant Home Screen)](./V2_PART_5_BRAND_VAULT.md)** — six-zone home screen: Hero + Brand Health + Quick Actions + My Brand + My Assets + Recent Activity + AI Recommendations
- **[V2 Part 6 — Version UX](./V2_PART_6_VERSION_UX.md)** — preview + approval + rollback flow, Brand Impact Map, three regeneration modes
- **[V2 Part 7 — Capability Store](./V2_PART_7_CAPABILITY_STORE.md)** — 12 Studios, business-outcome bundles, Business Roadmap
- **[V2 Part 8 — Build Order](./V2_PART_8_BUILD_ORDER.md)** — dependency-first construction, revenue-first surfacing, Asset Library Studio

Remaining V2 parts: Pricing (Q9) · Export (Q10).

### 🟡 V3 — AI Intelligence + Extended Knowledge

- **[V3 Extended — Additional Knowledge Areas 18-32](./V3_ADDITIONAL_KNOWLEDGE.md)** — Design Language System · Trade Intelligence · Vehicle Intelligence · Print Intelligence · Layout Grammar Engine · Merchant Psychology · Conversion Intelligence · AI Cost Optimiser · Brand Evolution · Competitive Intelligence · Prompt Analytics · AI Model Router · Creative Director Knowledge Base · Design Pattern Library · Knowledge Graph. Closing rule elevated to PRINCIPLES.md Principle 12.

Remaining V3 parts: Memory (Q11) · Design Critic (Q12) · Prompt Compiler (Q13) · DIL v2 (Q14) · Design Token Engine (Q15) · Multi-Agent Orchestration (Q16).

### ⏳ V4 — Future Vision (pending, review-only)
Adobe 2030 strategic doc.

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
