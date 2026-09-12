# ADR-0304 — NEX Lab · Autonomous Research + Data-Building Lab

**Founder brief (2026-09-10):**
> "Create our own lab fully orchestrated by Master AI Engineer controlling a list of agents that research, test and evaluate user demands, update the lab system with file structure and facts, propose builds for release into NEX, monetise where proven, and collect new businesses across Indonesia. All agents work INDEPENDENT of Claude or paid internet AI. Ultimate world operations only."

**Status:** DESIGN LOCKED · execution requires 3 founder authorizations (§10)
**Author:** Master AI Engineer
**Depends on:** ADR-0300 (own-storage migration), ADR-0301 (image storage), ADR-0302 (pgvector), ADR-0303 (file safety), and existing agent-runtime.

---

## 1. Mission

The Lab is an **isolated research environment** where Master AI Engineer autonomously proposes, prototypes, and validates new NEX capabilities BEFORE they touch production. It runs on the same Victus machine, uses local-only compute, and every promotion to production requires a founder-signed event.

**Core loop:**
```
demands  →  concepts  →  harvest  →  verify  →  UI mock  →  monetise  →  founder brief  →  APPROVE  →  promotion event  →  main NEX
```

## 2. Isolation invariants

The Lab MUST NEVER contaminate production:

| Boundary | Main NEX | Lab |
|---|---|---|
| Postgres schema | `nex.*` | `nex_lab.*` (new, mirror shape) |
| File paths | `data/master-ai/`, `data/nex-agent-runtime/` | `data/nex-lab/`, `data/nex-lab-runtime/` |
| Agent registry | current 11 | `lab_*` prefix, separate registry file |
| Founder stop override | existing | `data/nex-lab-runtime/lab-stop-override.json` (independent) |
| Windows Scheduled Task | 4 existing | new: `NEX-Lab-Cycle` (60 min) |
| Env flag | (none) | `NEX_LAB_MODE=1` |
| Internet access | as-is | blocked · lab agents cannot reach external LLM APIs |

Lab agents cannot read `nex.*` without a signed promotion event. Enforced at Postgres role level (new role `nex_lab_worker` GRANT SELECT only on `nex_lab.*`).

## 3. The 11-agent Lab workforce

All are **read-only observers OR local-compute producers** — never external API callers. All follow the existing agent-runtime pattern (heartbeat, watchdog, founder-stop-override).

### Discovery + planning agents (2)

| Agent | Path | Cadence | Reads | Writes |
|---|---|---|---|---|
| `lab_demand_observer` | `src/lib/nex/lab/demand-observer.ts` | 6 h | `nex.knowledge_gap`, `nex.conversation_message` | `data/nex-lab/demands/demands-ranked-YYYY-MM-DD.jsonl` |
| `lab_concept_prototyper` | `src/lib/nex/lab/concept-prototyper.ts` | 4 h | demand rankings | `data/nex-lab/concepts/{id}/spec.json` + `spec.md` |

### Data-harvester agents (5 · one per domain)

| Agent | Cadence | Source | Target |
|---|---|---|---|
| `lab_harvest_accommodation` | 2 h | OSM Overpass (existing daemon, extend to 101 cities) | `nex_lab.accommodation_business_raw` |
| `lab_harvest_food` | 2 h | OSM + Kemenparekraf endpoints | `nex_lab.food_business_raw` |
| `lab_harvest_transport` | 4 h | OSM + BMKG (schedules) + government transit registries | `nex_lab.transport_raw` |
| `lab_harvest_business` | 4 h | Wikidata SPARQL + provincial MSME registries | `nex_lab.business_raw` |
| `lab_harvest_activities_rentals` | 6 h | OSM + local tourism board sitemaps | `nex_lab.activity_raw`, `nex_lab.rental_raw` |

### Quality + presentation agents (3)

| Agent | Cadence | Purpose |
|---|---|---|
| `lab_fact_verifier` | 8 h | Cross-checks every harvested fact against ≥2 independent sources. Assigns confidence 0-1. Rejects <0.85. Writes `nex_lab.*_verified` + evidence chain. |
| `lab_ui_prototyper` | on-demand | For each concept with ≥75% verified data: mocks chat card + example flow. Writes `data/nex-lab/prototypes/{id}/`. |
| `lab_monetization_modeller` | on-demand | Projects revenue across 6 doctrine-safe models (subscription, per-lookup licence, verified badge, data licence, white-label, custom vertical). Labels ALL projections `ASSUMPTION` not `FACT`. |

### Founder-facing agent (1)

| Agent | Cadence | Output |
|---|---|---|
| `lab_founder_report_composer` | Weekly + on-demand | `data/nex-lab/reports/weekly-YYYY-WW-brief.md` + `founder-questions.json` (3 must-answer items) |

**Total: 11 Lab agents.** All spawn via existing `control-plane.ts` with `lab_*` prefix. All obey the same watchdog + heartbeat + founder-stop as production agents.

## 4. Data acquisition streams (Indonesia · zero paid API)

Ranked by readiness:

1. **OSM Overpass** — LIVE (extend from 5 to 101 cities · ~1 day)
2. **Wikidata SPARQL** — LIVE (`wikidata-provider.ts` already integrated)
3. **Wikipedia dump** — need Infobox parser + monthly refresh cron (~2 days)
4. **Kemenparekraf** — need REST endpoint discovery + parser (~3 days)
5. **BMKG (Meteorology)** — need JSON feed integration (~1 day)
6. **Bank of Indonesia** — need CSV parser for rates/statistics (~1 day)
7. **Provincial MSME registries** — variable per province · manual sitemap discovery (~7 days)
8. **News RSS (Kompas, Detik, Antara)** — need feed discovery + text extraction (~3 days)
9. **City tourism board sitemaps** — recursive parser (~2 days)

**Total buildout: ~20 days of harvester work.** All licences: public government data, OSM (ODbL), Wikidata (CC0), Wikipedia (CC-BY-SA). Zero third-party API keys.

## 5. Promotion flow (Lab → Main NEX)

1. Lab agent identifies a proven improvement (fact volume × demand signal × verification rate all pass threshold)
2. `lab_concept_prototyper` drafts 16-field spec
3. `lab_fact_verifier` proves data at 2+ sources
4. `lab_ui_prototyper` mocks chat surface
5. `lab_monetization_modeller` projects revenue (labelled ASSUMPTION)
6. `lab_founder_report_composer` writes brief with 3 must-answer questions
7. **Founder reads brief at `/nexapp/lab`** — clicks APPROVE or REJECT
8. If APPROVED: **immutable promotion event fires**:
   - HMAC-SHA256 signed with `founder_user_id + brief_id + timestamp`
   - Copies `nex_lab.*_verified` rows → `nex.*`
   - Merges lab UI mocks into main UI registry
   - Logs to `nex_lab.promotion_events` (never deleted)
   - Rollback SQL saved to `data/nex-lab/promotions/rollback-{id}.sql`

**No auto-promotion. Ever.** Every fact reaching production carries a founder signature.

## 6. Monetization streams (6 doctrine-safe, ranked by ROI × achievability)

Complies with ADR-0003 (never sell leads, never take commission). Every stream: direct payment from user / merchant / third party / government.

| # | Stream | Weekly setup | Year-1 revenue potential |
|---|---|---|---|
| 1 | **Merchant Verification Express** (Rp 99k / £5 one-time · 24 h turnaround vs 30-day free lane) | 2-3 weeks | £8k-12k |
| 2 | **Traveller Subscription** (Rp 49k / £2.50 / month · verified accommodation + food + AI trip planner) | 4-6 weeks | £12k-20k |
| 3 | **Government Data Licence** (Kemenparekraf, provincial tourism boards) | 8-12 weeks | £30k-60k |
| 4 | **White-Label Tourism Chat** (Bali board, Yogyakarta board, per Rp 200k/month) | 3-4 weeks | £4k-8k |
| 5 | **Hosted Merchant Page Premium** (custom domain + menu uploader) | 2-3 weeks | £6k-10k |
| 6 | **Developer API (ODbL export)** (Rp 500k / £25 / month per key) | 6-8 weeks | £18k-30k |

**Total Year-1 potential: £78k-140k.** Every stream tested in Lab first via demand-signal parsing + measured pilot.

**Explicitly banned** (doctrine violation): commission per booking, warm lead resale, preferential lead routing for paid tier, sponsored placement that alters rank.

## 7. Local-only compute (no third-party AI)

| Capability | Local implementation |
|---|---|
| LLM | Ollama (Qwen2.5:3B, 4GB VRAM, 5s cold) |
| Embeddings | sentence-transformers via ONNX Runtime (local models cached in `data/nex-lab/models/`) |
| Vector DB | pgvector (pending install per ADR-0302) |
| Search | SearXNG self-hosted (aggregator, no leakage) |
| Geocoding | Nominatim (already used by OSM harvester) |
| Object storage | MinIO (shipped in Item 5) |
| Postgres | localhost:5433/nex_dev (cutover complete) |

**Zero external LLM calls.** Middleware `src/lib/nex/lab/internet-gate.ts` blocks any Lab agent from reaching Anthropic, OpenAI, Groq, or other external LLM endpoints. If a Lab agent needs external data, it writes a request to `data/nex-lab/pending-external.jsonl` for founder review — never auto-executes.

## 8. Kill switch (60-second SLA)

`POST /api/nexapp/lab/stop-all` sets `data/nex-lab-runtime/lab-stop-override.json` `active=true`. Watchdog checks on 5s tick — all lab agents halt within 60 seconds. Independent of main NEX stop-override, so founder can freeze the Lab without touching production.

Founder-facing UI at `/nexapp/lab` shows: agent health, pending briefs, kill-switch button, live metrics.

## 9. File structure

```
data/nex-lab/
├── demands/           · ranked user asks (from nex.knowledge_gap + conversation ledger)
├── concepts/          · 16-field spec + markdown per prototype idea
├── harvest/           · raw per-domain incoming data (5 subdirs)
├── verified/          · facts that passed 2+ source check
├── prototypes/        · UI mockups per concept
├── reports/           · weekly + on-demand founder briefs
├── promotions/        · signed promotion events + rollback SQL
├── models/            · cached ONNX embedding models
└── pending-external/  · external API requests awaiting founder approval

data/nex-lab-runtime/
├── positions.json         · lab agent registry
├── lab-stop-override.json · kill switch
└── heartbeat-lab_*.json   · one per lab agent
```

## 10. Founder authorizations required (before ANY code writes)

**Must decide these 3 before Lab build starts:**

1. **Conversation ledger access.** `lab_demand_observer` needs to read chat history to rank user asks. Currently `nex.conversation_message` exists but no unified snapshot mechanism. Grant:
   - `nex_lab_worker` role gets SELECT on `nex.knowledge_gap` + `nex.conversation_message` (read-only)
   - OR export nightly snapshot to `data/nex-lab/snapshots/conversation-YYYY-MM-DD.jsonl`

2. **Enrichment table writes.** `lab_fact_verifier` writes to `nex_lab.accommodation_business_verified` — needs the parallel Postgres schema created. Requires:
   - `db/migrations/nex_lab_schema.sql` execution
   - `nex_lab_worker` role provisioned with INSERT/UPDATE on `nex_lab.*` only

3. **pgvector install.** Required for semantic clustering of demands + concept dedup. Per ADR-0302 — manual Visual Studio build required (~30 min operator time).

## 11. Timeline

- **Week 1:** Ship schema migration + agent-runtime lab_ prefix support + `/nexapp/lab` dashboard skeleton
- **Week 2:** Ship 5 harvester agents (accommodation extension + food + transport + business + activities/rentals)
- **Week 3:** Ship demand-observer + concept-prototyper + fact-verifier
- **Week 4:** Ship UI-prototyper + monetization-modeller + founder-report-composer
- **Week 5:** First founder brief · pilot promotion event · monetization stream #1 (Merchant Verification Express) live

**Lab v0 operational by 2026-10-15.** First monetized revenue by end October.

## 12. Success criteria (measurable at Week 5)

- ≥ 3 Lab agents running with fresh heartbeats
- ≥ 500 new verified accommodation rows in `nex_lab.*` (beyond OSM baseline)
- ≥ 5 demand signals parsed from conversation ledger
- ≥ 1 founder brief delivered with founder-signed decision
- Kill switch tested end-to-end within 60s
- Zero external LLM calls in Lab audit log
- Merchant Verification Express: ≥ 3 real merchants paid + verified

## 13. Files to build (Week 1 scaffold · shippable now)

Immediate (this session):
- `docs/DECISIONS/0304-nex-lab-autonomous-research-lab.md` ← this ADR
- `data/nex-lab/README.md`
- `db/migrations/nex_lab_schema.sql` (parallel schema stub)
- `src/lib/nex/lab/internet-gate.ts` (block external LLM in lab mode)
- `src/lib/nex/lab/types.ts` (Lab-specific TypeScript types)

Week 1 (~1,200 LOC):
- `scripts/nex-lab-cycle.mjs` (orchestrator, Windows Task target)
- `src/lib/nex/lab/orchestrator.ts` (state machine)
- `src/lib/nex/lab/promotions.ts` (HMAC signature + audit)
- `src/app/api/nexapp/lab/status/route.ts` (dashboard data)
- `src/app/api/nexapp/lab/promote/route.ts` (founder approval)
- `src/app/api/nexapp/lab/stop-all/route.ts` (kill switch)

## 14. Verdict

**GO** with founder authorization on §10 (3 gates).
**DEFER** any Lab agent execution until authorizations clear + Week 1 scaffold verified.
**HARD STOP** if Lab ever attempts external LLM call — evidence in `pending-external.jsonl` and audit trail.

This Lab makes NEX the "super AI of the future" not by copying other models, but by **building a moat other models structurally cannot match**: verifiable local knowledge, doctrine-signed promotions, founder-controlled monetization, zero third-party dependency.
