# Gate 2 · Supabase Audit Report

**Date:** 2026-09-11
**Mode:** READ-ONLY (network-level queries only · zero writes to Supabase or `nex_dev`)
**Founder authorization:** Gate 2 open (2026-09-11) · Gate 3 remains CLOSED
**Depends on:** `reconciliation-2026-09-11.md`
**Amends:** ADR-0309 (amendment appended in same file)

---

## Access attempts

| Project | URL | Access method | Result |
|---|---|---|---|
| NEX-dedicated | `ijvqdvsvwtwxzcqmoqit.supabase.co` | REST `/rest/v1/` with `NEX_SUPABASE_SERVICE_ROLE_KEY` | ✅ 200 · 19 tables enumerated |
| Main | `msdonkkechxzgagyguoe.supabase.co` | REST `/rest/v1/` with `SUPABASE_SERVICE_ROLE_KEY` (service role) | ❌ Network-level `fetch failed` |
| Main | same | REST `/rest/v1/` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon) | ❌ Network-level `fetch failed` |
| Main | same | `/` (host root · plain GET) | ❌ Network-level `fetch failed` |
| Main | same | `/auth/v1/health` | ❌ Network-level `fetch failed` |

**Main project verdict:** INACCESSIBLE via any legitimate read-only path present in `.env.local`. Failure is at the network layer, not authentication. No credential hunting attempted per founder rule.

**Side-finding:** the commented `NEX_POSTGRES_URL_SUPABASE_ROLLBACK` in `.env.local` points at the NEX-dedicated project (`ijvqdvsvwtwxzcqmoqit`), not the main project. So "rollback" was already the dedicated project. Interpretation: the main project (`msdonkkechxzgagyguoe`) appears to have been retired earlier · consistent with ADR-0300 (migration off Supabase).

## NEX-dedicated project · complete table inventory (19)

Row counts as of 2026-09-11. All counts obtained via `Prefer: count=exact` header · zero data mutation.

### Canonical / substrate tables

| Table | Rows | Classification | Notes |
|---|---:|---|---|
| **`knowledge_records`** | **3,627** | 🟢 CANONICAL DOMAIN KNOWLEDGE SUBSTRATE (founder-qualified: substrate-level canonical; individual record authority determined by `status` field) | Markdown records with full governance ladder |
| `sources` | 3,625 | 🟢 CANONICAL · provenance | Likely 1:1 with knowledge_records |
| `graph_edges` | 4,308 | 🟢 CANONICAL · relationships | Between records |
| `confidence_scores` | 4,228 | 🟢 CANONICAL · trust metadata | |
| `record_versions` | 22 | 🟢 CANONICAL · version history | |
| **`knowledge_feedback`** | **402** | 🟢 FOUNDER-AUTHORED GOVERNANCE | Philip's judgments · `feedback_source=philip` |
| **`contradictions`** | **8** | 🟢 TRUTH ENGINE PRIMITIVE · ACTIVE | Real detections by `quality-checker@677` |

### Runtime / operational tables

| Table | Rows | Classification |
|---|---:|---|
| `audit_log` | 20,224 | 🔷 OPERATIONAL · audit trail |
| `worker_results` | 19,140 | 🔷 OPERATIONAL · worker artefacts |
| `worker_jobs` | 19,167 | 🔷 OPERATIONAL · job queue |
| `worker_heartbeats` | 50 | 🔷 OPERATIONAL · health |
| `directory_seeds` | 1,227 | 🔷 OPERATIONAL · seed data |
| `nex_collection_url_queue` | 301 | 🔷 OPERATIONAL · crawl queue |
| `nex_collection_fetch_errors` | 170 | 🔷 OPERATIONAL · fetch errors |

### Schema-ready / empty

| Table | Rows | Classification |
|---|---:|---|
| `deprecations` | 0 | ⏸ RESERVED |
| `claim_requests` | 0 | ⏸ RESERVED |
| `llm_retry_queue` | 0 | ⏸ RESERVED |

### Cross-app / other

| Table | Rows | Notes |
|---|---:|---|
| `hammerex_nex_users` | 2 | Cross-app user records (Hammerex integration) |

## Sample content · substrate tables

### `knowledge_records` sample (1 of 3,627)

```
record_id: business_nex_business_brain_v1
record_version: 1.0.0
status: AUTHORITATIVE
canonical_owner: NEX Product · AI Engine team
authored_by: Research Claude
authorised_by: Philip
reviewed_by: Research Claude session 2026-08-06 · Philip authorised · self-review pass inline during authoring
title: NEX Business Brain
category: NEX Business Operating System · Platform Knowledge
subcategory: AI · Learning · Memory · Business Intelligence
summary: Every NEX business account maintains its own private Business Brain — a per-account AI accumulation that learns products, customers, suppliers, pricing, and writing style over years. Learning is opt-in, user-confirmed for permanent business rules, and privately scoped...
body_markdown: <full Markdown record>
```

### `contradictions` samples (3 of 8)

```
record_a_id / record_b_id: staircase_industry_ontology_v1
summary: "claims 100,000+ concepts and 1M relationships for staircase domain — wildly inflated for a single trade"
detected_by: quality-checker@677
detected_at: 2026-08-06T04:21:48

record_a_id / record_b_id: stair_rods_kits_and_accessories_v1
summary: "Record claims manufacturer audience but content addresses end customers (measuring guides for 'customers', finish samples to 'match existing décor', 'placing an order')"

record_a_id / record_b_id: stair_rods_kits_and_accessories_v1
summary: "Corporate catalog tone contradicts NEX warm/cheeky/down-to-earth voice mandate"
```

### `knowledge_feedback` samples (3 of 402)

```
domain: NEX door · record_id: mock_door_generic_msh9661t
feedback_kind: rejection · severity: moderate · feedback_source: philip
context: { source: review-ui · new_status: DEPRECATED · previous_status: DRAFT }
applied_to_prompts: true

domain: NEX door · record_id: mock_door_oak_msh5884g
feedback_kind: rejection · severity: moderate · feedback_source: philip
context: { source: review-ui · new_status: DEPRECATED · previous_status: DRAFT }

domain: NEX flooring · record_id: mock_flooring_oak_msh587vl
feedback_kind: rejection · <mock records rejected>
```

## Architectural test

Founder-set test: **"Does Supabase contain knowledge that changes NEX's understanding of what its English Brain is?"**

| Aspect | Supabase impact |
|---|---|
| Language layer (words · POS · CEFR · pronunciation) | ❌ Zero. |
| Semantic layer (concepts · senses · contexts · relationships) | ❌ Zero. |
| People-Say layer | ❌ Zero. |
| Domain Knowledge layer | ✅ **MASSIVE**. `knowledge_records` IS the pre-existing Domain Knowledge substrate. |
| Truth Engine primitives | ✅ **CONFIRMED LIVE** · contradictions detection running. |
| Founder-authored governance | ✅ **402 rows of Philip's judgments** parallel to repo JSON orphans. |

**Answer:** The English Brain architecture (Language + Semantic + People-Say) is not changed by Supabase. The broader canonical Knowledge Architecture IS. The scope has shifted from *"how do we build the English Brain?"* to *"how does the English Brain become one layer of the larger NEX knowledge architecture that already exists?"*

## Freeze status

- No Supabase writes performed.
- No `nex_dev` writes performed.
- No credentials modified.
- No project configuration touched.
- No source files altered.
- Gate 3 remains CLOSED.

## Confidence updates

| Dimension | Before Gate 2 | After Gate 2 |
|---|---:|---:|
| Postgres nex_dev inventory | 99% | 99% |
| Repo file inventory | 90% | 90% |
| Supabase NEX-dedicated | 0% | **90%** (surface + samples · deeper row-level analysis deferred) |
| Supabase Main project | 0% | 0% · **INACCESSIBLE · marked unknown** |
| Two-schema comparison | 95% | 95% |
| Row-level overlap | 95% | 95% for Postgres/repo · UNKNOWN for Supabase↔nex_dev cross-substrate |
| Founder-authored inventory | 95% | **97%** (added 402 knowledge_feedback rows) |
| Target architecture | 75% | **80%** (Supabase confirms a Domain Knowledge substrate exists · logical-authority model still TBD) |

**Overall confidence in reconciliation (post-Gate-2):** **88%** · limited only by the inaccessible main project.

---

**End of Gate 2 report.**
