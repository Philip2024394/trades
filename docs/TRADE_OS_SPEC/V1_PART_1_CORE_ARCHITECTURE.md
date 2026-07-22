# Trade Operating System · Volume 1 · Part 1
## Brand OS Core Architecture v1.0

**Audience:** Senior Platform Engineers, AI Engineers, Solution Architects
**Source:** ChatGPT design-brief architecture series, Part 1 of 5.

---

## Philosophy

The biggest architectural mistake most AI products make is treating the AI model as the centre of the platform.

**It isn't.**

**The centre is Brand DNA.**

Everything else becomes a consumer.

```
                   Merchant
                       │
                Business Discovery
                       │
               Creates / Updates
                       │
                  BRAND DNA
             (Single Source of Truth)
                       │
      ┌───────────────┼────────────────┐
      │               │                │
      ▼               ▼                ▼
 Vehicle Studio   Print Studio   Website Studio
      │               │                │
      ▼               ▼                ▼
 Marketing      Workwear        Social Media
      │               │                │
      └───────────────┼────────────────┘
                      ▼
                Brand Vault
                      ▼
                 Export System
```

**Golden rule: Nothing owns design except Brand DNA.**

---

## Core Runtime

The platform itself is one runtime.

```
TradeOS Runtime
│
├── Identity Service
├── Merchant Service
├── Brand Service
├── Event Bus
├── AI Orchestrator
├── Prompt Compiler
├── Design Intelligence Layer
├── Memory Engine
├── Asset Service
├── Version Service
├── Export Service
├── Capability Runtime
└── Authentication
```

Think of it as Windows or macOS. Studios are applications.

---

## Runtime Responsibilities

### Identity Service
Login · Permissions · Teams · Organisation. Never knows anything about branding.

### Merchant Service
Merchant · Company · Staff · Subscription · Billing · Locations · Vehicles. Business information only.

### Brand Service
Brand DNA · Brand Versions · Brand Assets · Brand Rules · Brand Tokens · Brand Memory. **Nothing else can edit Brand DNA directly.** Every update goes through this service.

### Event Bus
Everything talks here. Never `Van App → Website App` direct. Always `Van App → BrandUpdated event → Event Bus → Website App`. Loose coupling.

### Prompt Compiler
Converts Merchant Request + Brand DNA + Trade Rules + Vehicle Rules + Capability Rules → Prompt. **Deterministic software. Not AI.**

### AI Orchestrator
Choosing Model · Retry · Parallel Jobs · Timeout · Memory Injection · Prompt Compilation · Quality Review. Never stores data.

### Asset Service
Stores PNG · SVG · PDF · PSD · DOCX · Images · Videos · Exports. Every asset references a Brand DNA Version.

### Version Service
Every mutation creates a version: Brand · Asset · Document · Prompt. **Git for branding.**

### Export Service
ZIP · Printer Pack · Designer Pack · Share Links · PDF Packs · SVG Packs.

---

## Layered Architecture

```
────────────────────────────────────
Presentation Layer
────────────────────────────────────
Merchant UI · Admin UI · API

────────────────────────────────────
Capability Layer
────────────────────────────────────
Vehicle Studio · Print Studio · Website Studio
Marketing Studio · Photography Studio · Social Studio

────────────────────────────────────
Business Layer
────────────────────────────────────
Brand Service · Merchant Service · Discovery Service
Export Service · Memory Service

────────────────────────────────────
AI Layer
────────────────────────────────────
Prompt Compiler · Design Intelligence Layer
AI Orchestrator · Design Critic

────────────────────────────────────
Infrastructure Layer
────────────────────────────────────
PostgreSQL · Object Storage · Redis · Queue
Search · Authentication · Monitoring
```

---

## Core Principles

### Principle 1 — Brand DNA owns everything
Logo → Generated → Stored → Can be deleted → Regenerated. **Brand DNA remains.**

### Principle 2 — Assets are disposable, Brand DNA isn't
Brand DNA → Generate → Delete PNG → Generate Again → **Same Brand.**

### Principle 3 — AI owns nothing
AI creates suggestions. **Database owns truth.**

### Principle 4 — Everything is event driven
Never `Van calls Website`. Always `Brand Updated → Event → Subscribers`.

---

## Dependency Graph

```
Brand DNA
│
├── Design Tokens
│      │
│      ├── Website
│      ├── App
│      ├── Print
│      └── Marketing
│
├── Brand Rules
├── Logo
├── Typography
├── Colour
└── Photography
```

Higher assets depend on lower assets. **Never reverse.**

---

## Generation Pipeline

```
Merchant
   ↓
Business Discovery
   ↓
Brand DNA
   ↓
Validation
   ↓
Prompt Compiler
   ↓
AI Model
   ↓
Design Critic
   ↓
QA
   ↓
Merchant Approval
   ↓
Asset Stored
   ↓
Brand Vault
```

---

## Regeneration Model

Merchant changes Primary Colour Gold → Navy.

System calculates Affected Assets: Van · Website · Invoice · Business Card · Email · Workwear · Sign · App.

**Nothing regenerates immediately.** Instead:

```
BrandUpdated Event
   ↓
Dependency Graph
   ↓
Affected Assets
   ↓
Preview Queue
   ↓
Merchant Approval
   ↓
Generate
   ↓
Publish
```

This prevents accidental overwrites.

---

## Permission Model

| Role | Access |
|-|-|
| **Owner** | Everything |
| **Admin** | Everything except billing |
| **Designer** | Can edit assets. Cannot publish Brand DNA. |
| **Staff** | Can request generation. Cannot approve. |
| **Viewer** | Read only |
| **Printer** | Download production files only |

---

## Version History

Everything is immutable. Never edit. Always create.

```
Brand v1 → v2 → v3
Van v1 → v2 → v3
Prompt 14 → 15 → 16
Memory Snapshot → Snapshot → Snapshot
```

Rollback simply changes which version is active.

---

## Core Runtime Interfaces

See `src/lib/design/trade-os/runtime.ts` for the canonical TypeScript interfaces.

---

## Final Architecture Rule

> Brand DNA is the only editable source of truth. Every image, document, website, app screen, vehicle wrap, and marketing asset is a derived artifact. No Studio owns data; every Studio subscribes to Brand DNA through the event bus and publishes new assets back into the Brand Vault.

That single principle keeps the platform modular, testable, and scalable as new Studios are added over time.

---

## Networkers-specific adaptation notes

The spec above is architecture-pure. Adapt the specific tech recommendations to our existing stack:

| Recommended | Our stack | Decision |
|-|-|-|
| React + Next.js | ✅ Next.js 16 | Adopt as-is |
| shadcn + Tailwind | ✅ Tailwind (custom components) | Adopt Tailwind, custom components stay |
| NestJS backend | Next.js API routes | Adapt — API routes serve as thin service handlers |
| PostgreSQL | ✅ via Supabase | Adopt as-is |
| Prisma ORM | Supabase client | Adapt — Supabase client covers our needs |
| Redis cache | Not present | Skip for now, add only if needed |
| S3 object storage | ✅ Supabase Storage | Adapt — Supabase Storage covers assets |
| NATS/Kafka event bus | Not present | Build — new event bus module (`src/lib/design/trade-os/event-bus.ts`) |
| BullMQ queue | Vercel Cron | Adapt — cron handles our scheduled jobs |
| OpenSearch | PostgreSQL FTS + pgvector | Adapt — already using pgvector for knowledge |
| Clerk/Auth0 | Custom cookie auth (`tn_homeowner_sid`, `xrated_admin_session`) | Adapt — existing auth stays |
| OpenTelemetry + Grafana | Not present | Defer |
| GPT-5.5 + GPT Image | ✅ Anthropic Claude (Mate) + OpenAI GPT Image | Adopt with Mate as reasoning brain |
| pgvector | ✅ already used | Adopt as-is |
