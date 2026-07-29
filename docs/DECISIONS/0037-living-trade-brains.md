# ADR-0037 · Living Trade Brains

**Status:** Accepted 2026-07-28 · Phase 1 of the Nex World-Class Intelligence Platform
**Supersedes:** none · Extends ADR-0017 (Trade Brain Contract) · ADR-0018 (Twin Event Log)

## The Living Brain Principle

> **A Trade Brain is never the AI model itself. A Trade Brain is a governed body of expert knowledge that evolves independently of any underlying language model. Language models may change over time, but the Brain remains stable, versioned, explainable, reviewable, and owned by human experts.**

This principle defines the entire architecture. Foundation models (OpenAI · Anthropic · Google · future) are dependencies of the Nex Runtime. The Living Brain Platform is the intellectual property Nex accumulates over time. Trade Brains are the accumulating value competitors cannot replicate by switching to the same LLM.

The stack:

```
OpenAI / Anthropic / Google  ← swappable dependencies
         │
         ▼
Nex Runtime                  ← thin orchestration layer
         │
         ▼
Living Brain Platform        ← Nex's intellectual property (this ADR)
         │
         ▼
Trade Brains                 ← governed expert knowledge
         │
         ▼
Projects                     ← real-world work
         │
         ▼
Trades                       ← the practitioners
         │
         ▼
Clients                      ← the end users
```

## What NEX Will Not Build

The following are explicitly out of scope, permanently:

- **No autonomous learning.** No self-tuning, no self-editing, no fine-tuning on user data, no automatic knowledge acquisition.
- **No automatic model learning from end users.** Runtime feedback never edits knowledge. Feedback creates suggestions the certified author reviews. Author decides.
- **No hidden updates to production.** Every published change is version-controlled, reviewable, rollback-capable, and traceable to a certified author + reviewer + timestamp + rationale.
- **No black-box brains.** Every answer carries the Explainability envelope. Every mutation writes to `hammerex_nex_events`.

The competitive advantage is not that Nex changes itself. The competitive advantage is that **expert-authored knowledge is trusted**. Humans stay in the approval loop.

## Context

Trade Brains today are static knowledge repositories loaded from filesystem JSON packs. The V1 loader (`src/lib/nex/brains/_loader.ts`) validates a Brain pack against a 10-module Zod schema at boot. There is no versioning, no draft workflow, no review queue, no rollback, no audit trail, no runtime feedback capture, and no explainability contract on the answer payload. As Nex evolves into the world's first Trade Intelligence Platform, Trade Brains must become **living, versioned, expert-authored intelligence systems** — continuously improved while remaining fully controlled by expert authors.

## Decision

Nex adopts a **Living Trade Brain** architecture with **Supabase as the canonical source of truth** and JSON packs as an import/export surface only. Every Brain-mutating operation is recorded in a **generic event log** that other Nex domains (Projects · CRM · Marketplace · Digital Twin · Memory) can also write to. Every published answer carries an **explainability payload** from day one. **Field outcome tracking schema is laid now**, even though the learning logic ships in a later phase.

### Architectural adjustments approved 2026-07-28

Six adjustments to the initial file-first proposal, plus two additions:

1. **Supabase = canonical storage.** JSON packs are import/export/deployment snapshots only. Flow: `File Packs → Author edits → Supabase Versions → Published → Runtime Cache → Users`.
2. **Generic event log** — one `hammerex_nex_events` table used by every future domain (Trade Brains · Projects · CRM · Marketplace · Digital Twin · Memory).
3. **First-class Brain Registry** — every Brain has metadata (slug · industry · owner · current version · status · coverage · quality score · confidence · languages · supported countries · dependencies · last review · review frequency · maintainers).
4. **Brain Dependencies** — brains can reference each other (`Roofing → Building Code, Weather, Material`).
5. **Explainability from day one** — every answer carries `{ answer · evidence · trade_rule · reason · confidence · brain_version }`.
6. **Field outcome schema now, learning logic later** — `hammerex_nex_brain_answers` + `hammerex_nex_brain_field_outcomes` tables exist from Phase 1 even though outcome writers ship in Phase 2.
7. **Brain Certification** (NEW) — every Brain has a certified author identity (name · credentials · years · certified_by · review cadence). Trust through named expertise.
8. **Brain Readiness Score** (NEW) — 6-axis composite (Knowledge · Coverage · Testing · Author Review · Freshness · Confidence · Overall) so anyone knows at a glance if a Brain is production-ready.

### Further adjustments · 2026-07-28 second pass

9. **Rename registry table** — `hammerex_nex_brain_registry` → `hammerex_nex_brains`. Shorter, cleaner, matches first-class status.
10. **Product Lifecycle Stage** — separate axis from workflow status. Values: `draft · internal · beta · production · deprecated · archived`. A brain can be `status: published` AND `lifecycle_stage: beta` at the same time.
11. **Capability flags** — structured JSON on every brain: `supports_chat · supports_vision · supports_voice · supports_estimates · supports_projects · supports_marketplace · supports_memory · supports_simulation`. UI + runtime gate features from these flags. New capabilities can be added without a schema change.
12. **Expanded permanent identity** — `namespace` (globally-unique · `nex-official/staircase` · `australia-guild/staircase-au`) · `display_name` · `description` · `trade` · `primary_country` · `primary_language` · `origin_org` · `certification_level` · `maintainers[]` · `primary_author_*` — everything a registry card needs is on the brain row itself.

### Compatibility Matrix · 2026-07-28 third pass · future insurance

Three fields on every `hammerex_nex_brain_versions` row that will save Nex from painful breaking changes years from now. Modelled after how Kubernetes, Android, npm, and Chrome extensions handle backward compatibility.

- **`brain_api_version`** — declares which Brain API contract this version follows. Example: `"1.0"` · `"2.0"` · `"3.0"`. When the runtime evolves, old brains keep working because they explicitly declare `brain_api_version = 1` and the runtime dispatches to the v1 handler.
- **`minimum_runtime_version`** — declares the minimum Nex Runtime this brain needs. `Australian Staircase Brain requires Runtime 4.0` means installation on Runtime 2 refuses cleanly rather than crashing.
- **`current_runtime_version`** — historical record of the Nex Runtime that PUBLISHED this brain version. Provenance for debugging + compatibility audits.

Together with the Brain Package portability metadata, these three fields make the install / activation flow professional:

```
Brain · Package · Runtime · Language · Country · Status
```

Every installation result becomes one of:
- **Compatible** — all requirements met, ready to run.
- **Needs Upgrade** — brain requires a newer runtime than what's installed.
- **Unsupported** — brain is for a different country, language, or category not enabled.

### Brain Packages · portability infrastructure · 2026-07-28

Every Trade Brain must eventually be **portable — signed, exported, imported, verified, installed** like software. Not built today; schema laid now.

- **`hammerex_nex_brains.package_id`** — if a brain was installed from an external package, this is the source package's globally-unique id.
- **`hammerex_nex_brains.installed_from_source`** — URL / registry entry.
- **`hammerex_nex_brains.exportable`** — whether this brain can be exported.
- **`hammerex_nex_brain_versions.package_checksum`** — sha256 of canonicalised version content.
- **`hammerex_nex_brain_versions.package_signature`** — detached signature bytes.
- **`hammerex_nex_brain_versions.package_public_key_ref`** — public-key identifier for signature verification.
- **`hammerex_nex_brain_versions.package_manifest_json`** — portable manifest (dependencies · capabilities · requirements · issuer · license · issued_at · valid_until) so packages can be verified without hitting the origin server.
- **`hammerex_nex_brain_versions.portable`** — whether this version can be exported.
- **`hammerex_nex_brain_versions.imported_from_package_id`** — if this version came from an external package.

Future flow (post-Phase 1): `Install Australian Staircase Brain` · `Install UK Electrical Brain` · `Install Canadian Plumbing Brain` — Nex becomes a **platform, not just an application**.

### Scale-first guiding principle · 2026-07-28

Every schema decision is evaluated against this requirement:

> **The Living Brain architecture must support thousands of Trade Brains, multiple countries, multiple languages, multiple authors, and package-based distribution — without requiring future database redesign.**

This is not the Staircase Brain being built. This is the **operating platform** every future Trade Brain will run on.

## Canonical data model

### Nine new Supabase tables

| Table | Role |
|---|---|
| `hammerex_nex_brains` | One row per Brain. First-class metadata + `current_version_id` pointer + certification + readiness score + lifecycle stage + capability flags + Brain Package portability fields. |
| `hammerex_nex_brain_versions` | Immutable version history. One row per published version. Full manifest + modules JSON. Never mutated. |
| `hammerex_nex_brain_drafts` | Mutable per-brain-per-author working copy. One row per (brain_slug · author_id). Discarded on publish. |
| `hammerex_nex_brain_certifications` | Author credentials per Brain. Named expertise. Review cadence. |
| `hammerex_nex_brain_dependencies` | DAG edges. `parent_brain_slug` depends on `child_brain_slug`. |
| `hammerex_nex_brain_answers` | Runtime answer log. Every response carries the explainability payload. Written by public `/api/nex/brains/[slug]/ask` route. |
| `hammerex_nex_brain_field_outcomes` | Schema-only in Phase 1. Ties actual outcomes back to `brain_answers.id`. Learning logic ships Phase 2. |
| `hammerex_nex_events` | Generic append-only event log. Reusable across every Nex domain. |

### File pack shape (export/import only)

```
data/brains/<slug>/
  versions/
    1.0.0.json      # exported snapshot of the published version
    1.1.0.json
  draft.json        # optional — locally-authored draft before push to Supabase
  pointer.json      # optional — records which version is current for local runs
```

**Filesystem is NOT the source of truth.** Filesystem exists so:
- Local dev can boot without hitting Supabase (fallback loader)
- Brains can be exported for backup / deployment / audit
- Content can be imported into a fresh Supabase from JSON

## Explainability contract

Every answer served by any Brain surface (chat · ask · retrieve) MUST return the following envelope:

```typescript
type BrainAnswer = {
  answer:         string;                  // the human-facing answer
  evidence:       Array<{                  // sources cited in the answer
    kind:         "brain_module" | "url" | "regulation" | "material_spec";
    ref:          string;
    excerpt?:     string;
  }>;
  trade_rule:     string | null;           // the rule of the trade being applied
  reason:         string;                  // WHY this answer, in one sentence
  confidence:     number;                  // 0..1 · below 0.85 flags to feedback
  brain_slug:     string;
  brain_version:  string;                  // e.g. "2.3.1"
  brain_version_id: string;                // FK into hammerex_nex_brain_versions
  answered_at:    string;                  // ISO
};
```

Every answer is logged to `hammerex_nex_brain_answers`. When Phase 2 wires outcome tracking, each answer becomes joinable to its actual result via `hammerex_nex_brain_field_outcomes.brain_answer_id`.

## Workflow

```
Author (certified)
  ↓  edits
Draft (hammerex_nex_brain_drafts)
  ↓  submit_for_review
Review Queue
  ↓  approve  (+ regression harness green)
Publish (creates hammerex_nex_brain_versions row · updates registry.current_version_id)
  ↓
Runtime Cache (in-memory · warmed from Supabase on boot + on version change)
  ↓
Users query /api/nex/brains/<slug>/ask
  ↓
Every answer logged to hammerex_nex_brain_answers with explainability payload
  ↓
Low-confidence + "I don't know" queries surface to author feedback queue
  ↓
Author reviews · creates new draft edits
  ↓
(cycle continues)
```

## Rollback

`POST /api/admin/brains/[slug]/rollback` with `{ target_version_id }`:
- Updates `hammerex_nex_brain_registry.current_version_id = target_version_id`
- Warms the runtime cache with the target version
- Appends `{ event_type: "brain_rolled_back", entity_type: "brain", entity_id: <slug>, before: <old_version_id>, after: <target_version_id> }` to `hammerex_nex_events`
- Draft is preserved (never destroyed by rollback)

## Never-delete rule

Every mutation writes an event to `hammerex_nex_events`. Nothing is truly deleted:
- `brain_drafts` — replaced on save · previous state event-logged
- `brain_versions` — immutable · never mutated · retired via `retired_at` timestamp
- `brain_registry` — mutated for pointer + score updates · every mutation event-logged
- `brain_certifications` — updated on renewal · every change event-logged
- `brain_dependencies` — added / removed · every edge change event-logged

Rejected drafts, expired certifications, and retired versions are all preserved as history.

## Registry-visible readiness score

Every Brain shows a **Readiness Score** on the registry, computed nightly (or on-demand):

| Axis | 0-100 | Source |
|---|---|---|
| Knowledge | | % of the 10-module schema authored (V1 required · V2 optional) |
| Coverage | | % of expected topics answered above confidence 0.85 (from feedback data) |
| Testing | | % of regression scenarios passing on the current version |
| Author Review | | days since last certified author review vs review_frequency_days |
| Freshness | | days since last version bump vs domain expectation |
| Confidence | | mean confidence of last N runtime answers |
| **Overall** | | Weighted mean of the six axes |

A Brain scoring under 70 Overall is flagged as **not production-ready** on the registry.

## Reuse (no duplication)

- **Manifest schema loader** (`src/lib/nex/brains/_schema/*`) — reused; extended with optional versioning fields
- **`withManifestWrite` mutex + atomic + backup pattern** (`src/lib/nex/images/manifestWriter.ts`) — parallel `withBrainWrite` for filesystem exports
- **Knowledge engine RAG tables** (`hammerex_knowledge_*`) — remain in place; Living Brains sit above them
- **Admin health dashboards** (`/admin/brain-health` · `/admin/nex/health`) — extended with per-Brain lens, not replaced
- **NEX Tag UI shell** (`/admin/nex-tag` built 2026-07-27) — pattern reused for the Brain draft editor UI
- **Image tagger quality gate** (ADR-0033 · score ≥70) — same threshold applied to Brain publish gate (Overall Readiness ≥70)
- **Knowledge bands** (ADR-0035) — same 7-band model reused for Brain readiness banding

## Composes with

- **ADR-0017** (Trade Brain Contract) — 10-module schema stands; Living Brains add the workflow layer around it
- **ADR-0018** (Twin Event Log) — `hammerex_nex_events` supersedes the twin-specific event table proposal by generalising it
- **ADR-0021** (Memory Privacy Architecture) — RLS pattern reused for Brain draft ownership (author sees own drafts only)
- **ADR-0033** (Quality Over Quantity + Brain Isolation) — Living Brains isolation is enforced at the Supabase level (one row per brain_slug in the registry)
- **ADR-0035** (Two Laws · Classify Never Reject) — Never-delete rule reinforced (rejected drafts + retired versions all preserved)

## Future extension points

Every future phase plugs into this foundation without a rewrite:

- **Phase 2 (Knowledge Graph)** — dependency table is the graph edges; queries traverse via SQL recursive CTEs
- **Phase 3 (Decision Engine)** — outcome data (`brain_field_outcomes`) drives confidence adjustment; the schema exists in Phase 1
- **Phase 4 (Digital Twin)** — twin events write to `hammerex_nex_events` with `entity_type: "twin_project"`
- **Phase 5 (Trust Ledger)** — every certification + review action is an event; the ledger is a query over `hammerex_nex_events`

## Trigger of decision (verbatim)

Master Implementation Prompt · Philip 2026-07-28 · "Phase 1 — Living Trade Brains" with 8 approved architectural adjustments (Supabase canonical · generic event log · first-class registry · brain dependencies · explainability from day one · outcome schema now · brain certification · brain readiness score).
