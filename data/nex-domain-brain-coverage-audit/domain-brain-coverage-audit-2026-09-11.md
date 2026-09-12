# NEX Domain Brain Coverage Audit · 2026-09-11

**Status:** READ-ONLY audit artifact · zero substrate mutation · zero rename · zero migration · zero code change · Gate 3 remains CLOSED
**Founder:** Philip · authorised 2026-09-11 · verbatim: *"Do not create anything. Do not migrate anything. Do not rename anything. Do not open Gate 3. Audit only."*
**Method:** repository code survey (Explore agent) + read-only substrate probe (`scripts/nex-adr-0314a2s-domain-brain-coverage-audit.mjs`)
**Artefacts:**
- Structured JSON: `data/nex-domain-brain-coverage-audit/audit-2026-09-10T20-48-39-869Z.json`
- Stdout report: `data/nex-domain-brain-coverage-audit/audit-stdout-2026-09-11.txt` (338 lines)
- Repo survey: Explore agent report embedded in ADR-0314a.2.s conversation trail
**Fields reported per row:** Domain · Brain exists? · Canonical knowledge location · Supporting data location · Which Lab feeds it · Tables/store · Records · Verified · Knowledge Router reach · Truth Engine governance · NEX Chat use · NEX1 use

---

## 1 · Substrate scope

**nex_dev Postgres (localhost) · 283 tables in scope:**
- schema `nex` · 257 tables
- schema `nex_lab` · 5 tables (rooms · growth_history · innovation_ideas · promotion_events · promotion_rows)
- schema `nex_lab_accommodation` · 2 tables (harvest_raw · verified)
- schema `nex_lab_activities` · 2 tables
- schema `nex_lab_business` · 3 tables (adds gov_source_raw)
- schema `nex_lab_chat` · 2 tables
- schema `nex_lab_food` · 2 tables
- schema `nex_lab_image` · 2 tables
- schema `nex_lab_monetization` · 2 tables
- schema `nex_lab_news` · 2 tables
- schema `nex_lab_transport` · 2 tables
- schema `nex_lab_voice` · 2 tables
- No `nex_lab_marketing` schema physically materialised (log files exist but schema does not)

**Supabase (public schema) · brain-adjacent tables:**
- `knowledge_records` · 3,627 rows (verified in §7.1 · reconfirmed)
- `knowledge_feedback` · 402 rows
- `knowledge_feedback_topics` · not present or no access
- `hammerex_nex_brains` · not present or no access (all 8 `hammerex_nex_brain_*` tables returned null)

---

## 2 · Per-Domain / Per-Lab coverage rows

### 2.1 · ACCOMMODATION Domain

| Field | Value |
|---|---|
| Domain | **accommodation** (established · 4-way concurrence per §7.3: domain-classifier · AgentId · NexVertical · Lab room) |
| Brain exists? | ✅ Yes · specialist substrate + adapter + worker + classifier |
| Canonical knowledge location | `nex.accommodation_business` (nex_dev Postgres) |
| Supporting data location | Field provenance: `nex.accommodation_business_field_provenance` · immutable JSONB snapshot: `nex.accommodation_business_source_snapshot` · enrichment evidence: `nex.accommodation_enrichment_evidence` · prices: `nex.brain_accommodation_prices` |
| Which Lab feeds it | `nex_lab_accommodation` (2 tables · `lab_harvest_accommodation` agent) |
| Tables/store · records | `nex.accommodation_business` **9,230 rows** · `nex.accommodation_business_field_provenance` **46,306 rows** · `nex.accommodation_business_source_snapshot` **9,203 rows** · `nex.accommodation_enrichment_evidence` **0 rows** · `nex.brain_accommodation_prices` **0 rows** · `nex.entity_index` **877 rows** (claimed subset per prior memory) · Lab: `nex_lab_accommodation.harvest_raw` **14,894 rows** · `nex_lab_accommodation.verified` **4,796 rows** |
| Verified | 4,796 rows in Lab verified pool (32.2% of 14,894 raw). Main table 9,230 rows carry field-level provenance (46,306 provenance rows ≈ 5 fields per business tracked with source_reference + trust_layer per prior memory). |
| Knowledge Router reach | ✅ `src/lib/nex/brain/world-adapters/accommodation-postgres.ts` (intelligence-grid Postgres adapter) · `src/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres.ts` |
| Truth Engine governance | Partial · deterministic frame-scope gate in `src/lib/nex/brain/frame-scope-intelligence.ts` · no formal per-object-type authorisation policy yet (deferred to ADR-0314a.2.a per Tier 5 of ADR-0314a.2.s companion order) |
| NEX Chat use | ✅ `src/lib/nex/live-chat-completion/adapters/accommodation-adapter.ts` · wired in `src/app/api/nex-conv/chat/route.ts` |
| NEX1 use | ✅ `src/lib/nex/agent-runtime/worker-accommodation.ts` |

### 2.2 · FOOD Domain (§7.2 locked · food canonical · food-beverage alias)

| Field | Value |
|---|---|
| Domain | **food** (established · 4-way concurrence per §7.3) |
| Brain exists? | ✅ Yes · specialist substrate + adapter + worker + classifier |
| Canonical knowledge location | `nex.food_business` (nex_dev Postgres) |
| Supporting data location | Field provenance: `nex.food_business_field_provenance` · snapshot: `nex.food_business_source_snapshot` · enrichment evidence: `nex.food_enrichment_evidence` · promotion: `nex.food_business_promotion` (+ audit + decision) · outreach: `nex.food_outreach_*` · HQ rules: `nex.food_hq_rule` · next actions: `nex.food_business_next_action` |
| Which Lab feeds it | `nex_lab_food` (2 tables · `lab_harvest_food` agent) |
| Tables/store · records | `nex.food_business` **22,757 rows** · `nex.food_business_field_provenance` **105,320 rows** · `nex.food_business_source_snapshot` **12,986 rows** · `nex.food_enrichment_evidence` **1,450 rows** · `nex.food_business_promotion` **636 rows** · `nex.food_business_promotion_audit` **729 rows** · `nex.food_business_promotion_decision` **1 row** · `nex.food_business_next_action` **806 rows** · `nex.food_hq_rule` **10 rows** · `nex.food_outreach_attempt` **5 rows** (dry_run 2, rate_limited 1, queued 1, opted_out 1) · Lab: `nex_lab_food.harvest_raw` **3,397 rows** · `nex_lab_food.verified` **896 rows** |
| Verified | Lab: 896 verified (26.4% of 3,397 raw) · main table 22,757 rows tracked with 105,320 provenance rows |
| Knowledge Router reach | ✅ `src/lib/nex/brain/world-adapters/food-postgres.ts` |
| Truth Engine governance | Partial · same pattern as accommodation · deferred to ADR-0314a.2.a per Tier 5 |
| NEX Chat use | ✅ `src/lib/nex/live-chat-completion/adapters/food-adapter.ts` · wired in chat route |
| NEX1 use | ✅ `src/lib/nex/agent-runtime/worker-food.ts` |

### 2.3 · TRANSPORT Domain

| Field | Value |
|---|---|
| Domain | **transport** (established · classifier + AgentId + Lab room) |
| Brain exists? | 🟡 Partial · adapter + worker exist · specialist table is `nex.transport_acquisition_*` (acquisition-shaped · not full brain table pattern) |
| Canonical knowledge location | `nex.transport_acquisition_record` (nex_dev Postgres) · plus `nex.brain_transport` **0 rows** (empty · schema-ready but unpopulated) |
| Supporting data location | Snapshots: `nex.transport_acquisition_source_snapshot` · outreach: `nex.transport_acquisition_outreach` (0 rows) |
| Which Lab feeds it | `nex_lab_transport` (2 tables · `lab_harvest_transport` agent · sources OSM+BMKG+gov_transit · target 5,000) |
| Tables/store · records | `nex.transport_acquisition_record` **107 rows** · `nex.transport_acquisition_source_snapshot` **603 rows** · `nex.transport_acquisition_outreach` **0 rows** · `nex.brain_transport` **0 rows** · Lab: `nex_lab_transport.harvest_raw` **1,734 rows** · `nex_lab_transport.verified` **129 rows** |
| Verified | 129 verified in Lab (7.4% of 1,734 raw) · brain table empty · acquisition table 107 rows |
| Knowledge Router reach | 🟡 no dedicated world-adapter for transport (no `transport-postgres.ts`) |
| Truth Engine governance | Not yet |
| NEX Chat use | ✅ `src/lib/nex/live-chat-completion/adapters/transport-adapter.ts` (thin) · wired in chat route |
| NEX1 use | ✅ `src/lib/nex/agent-runtime/worker-transport.ts` |

### 2.4 · BUSINESS Domain

| Field | Value |
|---|---|
| Domain | **business** (established · classifier + AgentId + Lab room) |
| Brain exists? | 🟡 Partial · adapter + worker exist · specialist substrate is **business_lead_directory** (very sparse · 2 rows) · richer business_knowledge table exists (1,258 rows) |
| Canonical knowledge location | `nex.business_lead_directory` (specialist per business-lead-executor routing) + `nex.business_knowledge` (adjacent · 1,258 rows) |
| Supporting data location | Provenance: `nex.business_lead_directory_field_provenance` · images: `nex.business_image` · opt-out: `nex.business_lead_opt_out` · calling config: `nex.business_calling_config` |
| Which Lab feeds it | `nex_lab_business` (3 tables · adds `gov_source_raw`) |
| Tables/store · records | `nex.business_lead_directory` **2 rows** (status=listed · verified=false) · `nex.business_lead_directory_field_provenance` **21 rows** · `nex.business_lead_opt_out` **0 rows** · `nex.business_image` **660 rows** · `nex.business_knowledge` **1,258 rows** · Lab: `nex_lab_business.harvest_raw` **4,016 rows** · `nex_lab_business.verified` **1,192 rows** · `nex_lab_business.gov_source_raw` **29 rows** |
| Verified | 1,192 Lab verified (29.7% of 4,016 raw). Main directory only 2 rows (verification pipeline running · promotion not yet performed) |
| Knowledge Router reach | 🟡 no dedicated world-adapter |
| Truth Engine governance | Partial · business-market-gate deterministic boundary logic in chat route |
| NEX Chat use | ✅ `src/lib/nex/live-chat-completion/adapters/business-adapter.ts` (thin) · wired |
| NEX1 use | ✅ `src/lib/nex/agent-runtime/worker-business.ts` (dedicated worker) |

### 2.5 · TRAVEL Domain

| Field | Value |
|---|---|
| Domain | **travel** (established · classifier + AgentId · no Lab · no NexVertical) |
| Brain exists? | ❌ No specialist substrate yet · adapter and worker exist but no `nex.travel_*` tables |
| Canonical knowledge location | None |
| Supporting data location | None |
| Which Lab feeds it | None (no `nex_lab_travel`) |
| Tables/store · records | 0 rows in any travel-scoped table |
| Verified | Not applicable |
| Knowledge Router reach | ❌ no dedicated world-adapter |
| Truth Engine governance | Not applicable |
| NEX Chat use | ✅ `src/lib/nex/live-chat-completion/adapters/travel-adapter.ts` (thin · classifier-only routing) · wired |
| NEX1 use | ✅ `src/lib/nex/agent-runtime/worker-travel.ts` |

### 2.6 · ATTRACTIONS Domain

| Field | Value |
|---|---|
| Domain | **attractions** (established in domain-classifier · not AgentId · not Lab room · but activities Lab promotes into brain_attractions) |
| Brain exists? | 🟡 Partial · brain table exists but very sparse (32 rows) · no dedicated adapter · no worker |
| Canonical knowledge location | `nex.brain_attractions` (nex_dev · 12-value attraction_kind CHECK · target of activities-executor) |
| Supporting data location | None (no separate provenance/snapshot tables · this is the smallest properly-shaped Domain) |
| Which Lab feeds it | `nex_lab_activities` (paired display "Activities & Rentals Lab") via `src/lib/nex/lab/executors/activities-executor.ts` |
| Tables/store · records | `nex.brain_attractions` **32 rows** · Lab source: `nex_lab_activities.harvest_raw` **2,342 rows** · `nex_lab_activities.verified` **780 rows** |
| Verified | 780 verified in Lab (33.3% of 2,342 raw) · only 32 promoted to brain_attractions (1.4% of raw) — **large gap: 748 verified rows not yet promoted** |
| Knowledge Router reach | ❌ no dedicated world-adapter |
| Truth Engine governance | Not yet |
| NEX Chat use | ✅ `src/lib/nex/live-chat-completion/adapters/attractions-adapter.ts` (thin · classifier-only routing) · wired |
| NEX1 use | ❌ no worker-attractions (candidate for future) |

### 2.7 · MARKETS Domain (⚠️ CHAT ROUTE UNREACHABLE)

| Field | Value |
|---|---|
| Domain | **markets** (classifier only · not AgentId · not Lab · not NexVertical · not specialist substrate) |
| Brain exists? | ❌ No |
| Canonical knowledge location | None |
| Supporting data location | None |
| Which Lab feeds it | None |
| Tables/store · records | 0 rows in any markets-scoped table |
| Verified | Not applicable |
| Knowledge Router reach | ❌ no dedicated world-adapter |
| Truth Engine governance | Not applicable |
| NEX Chat use | 🟡 **Classifier routes to `markets` but adapter is NOT MOUNTED in the chat route adapters map** (per repo survey · `src/lib/nex/live-chat-completion/adapters/markets-adapter.ts` exists but missing from route.ts lines 202-218). **Dead path.** |
| NEX1 use | ❌ |

### 2.8 · CODE Domain (⚠️ CHAT ROUTE INTENTIONALLY UNMOUNTED · NEX1-owned)

| Field | Value |
|---|---|
| Domain | **code** (classifier · `programmer` AgentId · NEX1-scoped per ADR-0308) |
| Brain exists? | 🟡 Partial · `nex.concepts` + `nex.concept_senses` cover programming as Layer-1 domain (44 concepts + 51 senses total across all domains) · code-intent-registry as intent layer |
| Canonical knowledge location | `nex.concepts` + `nex.concept_senses` (shared language substrate · code is a Domain WITHIN it per ADR-0308) |
| Supporting data location | `nex.contexts` **224 rows** · `nex.evidence` **173 rows** · `nex.questions` **60 authoritative** · `nex.answers` **62 authoritative** |
| Which Lab feeds it | None (no `nex_lab_code`) · code substrate is authored deliberately not harvested |
| Tables/store · records | `nex.concepts` **44 rows** (authoritative) · `nex.concept_senses` **51 rows** (authoritative) · `nex.contexts` **224 rows** · `nex.evidence` **173 rows** · `nex.questions` **60 rows** (authoritative) · `nex.answers` **62 rows** (authoritative) · `nex.relationships` **0 rows** (schema-ready) · `nex.code_execution` **12 rows** (execution log) |
| Verified | All 44 concepts + 51 senses + 60 questions + 62 answers carry status=authoritative |
| Knowledge Router reach | ✅ via language engine (`src/lib/nex/language/*` · concept-resolver · guardian · normaliser · intent-parser) |
| Truth Engine governance | Partial · language-engine verification via code-intent-registry + Guardian |
| NEX Chat use | 🟡 `src/lib/nex/live-chat-completion/adapters/code-adapter.ts` exists but **NOT MOUNTED** in chat route (intentional per ADR-0308 · code is NEX1's Domain · not LCC's) |
| NEX1 use | ✅ **Primary owner** · `src/lib/nex-agent/*` · `src/lib/nex/agent-runtime/worker-programmer.ts` · `src/app/api/nex/agent/submit/route.ts` |

### 2.9 · RENTALS

| Field | Value |
|---|---|
| Domain | **rentals** (NexVertical only · not classifier · not AgentId · not Lab room · paired with activities in Lab display name) |
| Brain exists? | ❌ No |
| Canonical knowledge location | `nex.bike_rental_listing` **9 rows** (active) · `nex.bike_model` **50 rows** — partial specialist substrate for bike rentals only |
| Supporting data location | None dedicated |
| Which Lab feeds it | None (rentals is paired with `activities` in `nex_lab_activities` display name but not separately in seed) |
| Tables/store · records | `nex.bike_rental_listing` **9 rows** · `nex.bike_model` **50 rows** |
| Verified | 9 active bike listings (100% active) |
| Knowledge Router reach | ❌ no dedicated world-adapter |
| Truth Engine governance | Not applicable |
| NEX Chat use | ❌ no rentals adapter |
| NEX1 use | ❌ no worker-rentals |

### 2.10 · ATTRACTIONS ↔ ACTIVITIES ↔ RENTALS (§7.4-adjacent · deferred to attractions reconciliation ADR)

Cross-referencing: attractions Domain (Chat only · 32 brain rows), activities (Lab operational · 780 verified · promotes to brain_attractions), rentals (partial bike-specific substrate · paired with activities in Lab display). All three await reconciliation in future founder-authorised ADR.

### 2.11 · TRADE KNOWLEDGE (Supabase · pattern A + B categories)

| Field | Value |
|---|---|
| Domain | Multiple candidate Domains: `staircase` · `door` · `kitchen` · `flooring` · `bathroom` · `interior` · `timber` · `tools` · `lighting` · `roofing` (from ADR-0033 brains list · reflected in Supabase category values) |
| Brain exists? | 🟡 On Supabase only · knowledge_records carry these as `category` values (pattern A + hierarchical pattern B) · no specialist Postgres table for any trade brain |
| Canonical knowledge location | Supabase `public.knowledge_records` **3,627 rows** (per §7.1 evidence) |
| Supporting data location | Supabase `public.knowledge_feedback` **402 rows** |
| Which Lab feeds it | None (Supabase knowledge_records is authored not harvested · Pattern A rows carry subcategory="auto-extracted (mock adapter)" indicating a mock ingest pipeline · Pattern B rows are hand-authored) |
| Tables/store · records | Supabase `knowledge_records` **3,627 rows** total: pattern A (bare subject-matter · 3,215 rows / 88.7%) + pattern B (hierarchical dotted paths · 66 distinct values / ~400 rows) + pattern C (operational scopes · ~15 rows). Distribution among trade domains (§7.1 inventory): door 2,088 · flooring 620 · kitchen 458 · staircase 49 · timber (embedded in hierarchical B paths) · bathroom/interior/tools/lighting/roofing (embedded or absent) |
| Verified | Pattern A: 100% authorised_by=NULL · mostly DRAFT (86%) · some DEPRECATED · some UNDER_REVIEW · pattern B: mix of AUTHORITATIVE + UNDER_REVIEW + DEPRECATED · pattern C: mostly AUTHORITATIVE |
| Knowledge Router reach | 🟡 SupabaseStore adapter exists (`src/lib/nex/brain/adapters/supabase.ts`) · reads via `.from("knowledge_records")` · but Router doesn't distinguish trade Domain from trade Domain |
| Truth Engine governance | Partial · Guardian schema exists · no per-Domain policy · ~90 rows are AUTHORITATIVE with authorised_by=NULL (R-10 impact set from earlier consolidation) |
| NEX Chat use | Legacy path · Supabase records reached by legacy chat pipeline · not by domain-classifier LCC (which routes to accommodation/food/transport/business/travel/attractions/markets/code) |
| NEX1 use | ❌ NEX1 uses Postgres `nex.concepts` substrate · not Supabase trade knowledge |

### 2.12 · MARKETING (§7.3 · mixed case · operational)

| Field | Value |
|---|---|
| Domain | **marketing** (§7.3 mixed · operational path locked as Operational Scope · subject-matter Marketing Domain deferred to future ADR) |
| Brain exists? | ❌ No subject-matter brain substrate yet |
| Canonical knowledge location | Operational only · no subject-matter brain |
| Supporting data location | Contacts: `nex.marketing_contact` **197 rows** · Templates: `nex.marketing_template` **0 rows** · Campaigns: `nex.marketing_campaign` **0 rows** · Send queue: `nex.marketing_send_queue` **0 rows** · Send log: `nex.marketing_send_log` **0 rows** · Bounce log: `nex.marketing_bounce_log` **0 rows** · Opt-out: `nex.marketing_opt_out` **0 rows** · Segment: `nex.marketing_segment` **0 rows** · Campaign recipients: `nex.campaign_recipients` **216 rows** · Campaigns: `nex.campaigns` **13 rows** (archived 4 · draft 3 · completed 3 · sending 2 · scheduled 1) |
| Which Lab feeds it | No `nex_lab_marketing` schema exists (`data/nex-lab/marketing-import*.log` files exist but no physical schema · operational log-only activity) |
| Tables/store · records | See above |
| Verified | Operational data · no verification concept |
| Knowledge Router reach | ❌ not a Router-reachable Domain |
| Truth Engine governance | Guardian applies to marketing_contact writes (compliance events tracked in `nex.compliance_events` **14 rows**) |
| NEX Chat use | ❌ |
| NEX1 use | ❌ |

### 2.13 · OPERATIONAL SCOPES (§7.3 · IMAGE · NEWS · VOICE · CHAT · MONETIZATION)

Per §7.3-B1 lock: these are Operational Scope axis · NOT Domains. Reported for completeness.

**image (Operational Scope):**
- Lab: `nex_lab_image` · `harvest_raw` **234 rows** · `verified` **0 rows** (5,000-target Lab · barely started · never verified)
- Runtime: `nex.generated_image` **40 rows** · `nex.category_image_library` **0 rows** · `nex.business_image` **660 rows** (associated with businesses · not standalone image knowledge)
- Truth Engine: Guardian applies to `subject_domain` field per ADR-0024

**news (Operational Scope):**
- Lab: `nex_lab_news` · `harvest_raw` **25 rows** · `verified` **0 rows** (100K-target Lab · barely started)
- Runtime: no news-consumer tables in nex.*
- Truth Engine: citation-shaped verification via web-acquisition module

**voice (Operational Scope):**
- Lab: `nex_lab_voice` · `harvest_raw` **0 rows** · `verified` **0 rows** (10K-target Lab · unstarted)
- Runtime: `nex.voice_synthesis` **0 rows** · `nex.voice_transcript` **0 rows** (Phase 12 endpoints exist · substrate empty)
- Truth Engine: not applicable

**chat (Operational Scope):**
- Lab: `nex_lab_chat` · `harvest_raw` **0 rows** · `verified` **0 rows**
- Runtime: `nex.chat_message` **70 rows** · `nex.chat_message_archive` **20 rows** · `nex.chat_message_deletion` **20 rows** · plus rich conversation substrate: `nex.conv_edges` **4,970 rows** · `nex.conv_intents` **22 rows** · `nex.conv_knowledge_items` **890 rows** · `nex.conv_learning_candidate` **1,607 rows** (1,606 pending_review · 1 promoted) · `nex.conv_states` **303 rows** · `nex.conv_turns` **583 rows** · `nex.conversation_state` **1,428 rows** · `nex.turn_latency_event` **4,390 rows**
- Truth Engine: main verifier applies per turn

**monetization (Operational Scope):**
- Lab: `nex_lab_monetization` · `harvest_raw` **0 rows** · `verified` **0 rows** (0-target Lab · placeholder)
- Runtime: `nex.mp_*` (marketplace) · `nex.user_wallet` **65 rows** · `nex.wallet_transaction` **159 rows** · `nex.provider_wallet` **7 rows** · `nex.provider_wallet_transaction` **7 rows** · `nex.cost_budget` **4 rows` · `nex.llm_cost_config` **11 rows**
- Truth Engine: financial-boundary verification via marketplace commerce policy

### 2.14 · MARKETPLACE (`nex.mp_*`)

Not a Domain per R-DOMAIN-01 · marketplace is orthogonal per §7.2 A1 decision.

| Field | Value |
|---|---|
| Substrate | `nex.mp_category` **310 rows** · `nex.mp_product` **5 rows** · `nex.mp_product_image` **5 rows** · `nex.mp_product_option` **11 rows** · `nex.mp_product_option_value` **24 rows** · `nex.mp_product_variant` **15 rows** · `nex.mp_seller` **23,580 rows** (discovered 23,579 · active 1) · `nex.mp_commerce_policy` **1 row** |
| Note | 310 marketplace categories seeded (from `deploy/postgres/init/096_nex_marketplace_slice.sql` · 19 top-level + hierarchy · 310 total suggests active enrichment) · 23,580 sellers discovered mostly unclaimed · 5 real products |

### 2.15 · AGENT/RUNTIME IDENTITY axis (§7.3 · master_ai + AgentId cohort)

Per §7.3-B1 lock: Agent/Runtime Identity axis. Not Domains.

| AgentId | Worker file | Runtime status (per memory) |
|---|---|---|
| programmer | worker-programmer.ts | RUNNING (per memory · PID 29476 as of 2026-09-07) |
| accommodation | worker-accommodation.ts | RUNNING (per memory · PID 35932) |
| master_ai | worker-master-ai.ts | RUNNING (per memory · PID 29384) |
| speaking | worker-speaking.ts | Registered · not currently spawned |
| vision | worker-vision.ts | Registered · not currently spawned |
| travel | worker-travel.ts | Registered · not currently spawned |
| business | worker-business.ts | Registered · not currently spawned |
| food | worker-food.ts | Registered · not currently spawned |
| construction | worker-construction.ts | Registered · not currently spawned |
| healthcare | worker-healthcare.ts | Registered · not currently spawned |
| transport | worker-transport.ts | Registered · not currently spawned |

**Agent-related substrate:**
- `nex.worker_cycle_run` **44,178 rows** (completed 40,003 · failed 3,999 · aborted 148 · running 28)
- `nex.worker_heartbeat` **26,481 rows**
- `nex.work_item` **10,059 rows** (completed 10,008 · queued 49 · dead_letter 2)

### 2.16 · ENGLISH BRAIN Layer 1 (per project memory `project_nex_english_brain_v1_shipped_2026_09_11.md`)

| Field | Value |
|---|---|
| Domain | English Brain (Layer 1 language substrate · Foundation for concept-resolver + question-resolver) |
| Brain exists? | ✅ Yes · migration 006 applied · 7 tables live |
| Canonical knowledge location | `nex.concepts` · `nex.concept_senses` (nex_dev Postgres) |
| Supporting data location | `nex.contexts` · `nex.relationships` · `nex.questions` · `nex.answers` · `nex.evidence` |
| Which Lab feeds it | None (English Brain is authored via E1 worker · not harvested) |
| Tables/store · records | `nex.concepts` **44 rows** · `nex.concept_senses` **51 rows** · `nex.contexts` **224 rows** · `nex.relationships` **0 rows** · `nex.questions` **60 rows** · `nex.answers` **62 rows** · `nex.evidence` **173 rows** |
| Verified | 44 concepts · 51 senses · 60 questions · 62 answers all status=authoritative |
| Knowledge Router reach | ✅ via `src/lib/nex/language/concept-resolver.ts` · used in both `/api/nex-conv/chat` and `/api/nex/agent/submit` |
| Truth Engine governance | Guardian in language engine · 11 ADR-0308 rules enforced |
| NEX Chat use | ✅ concept-resolver wired into chat |
| NEX1 use | ✅ concept-resolver wired into nex-agent orchestrator |

**Note:** Prior memory recorded 21 seeded concepts. Actual count 44. Drift indicates additional authoring since 2026-09-11 morning. relationships table still 0 rows.

### 2.17 · SOCIAL (`nex.social_*`)

Rich substrate not classified in §7.x yet. Reported for audit completeness.

- `nex.social_tenants` **1,160 rows** (all active)
- `nex.social_brand_profiles` **715 rows**
- `nex.social_audit_events` **616 rows**
- `nex.social_content_drafts` **617 rows**
- `nex.social_content_templates` **556 rows** (all active)
- `nex.social_content_sources` **1,022 rows**
- `nex.social_dek_wraps` **846 rows** (all active)
- `nex.social_scheduled_posts` **110 rows** (79 published · 13 leased · 13 refused_at_recheck · 5 abandoned)
- `nex.social_publish_intents` **8 rows** (7 verified_published · 1 failed)
- `nex.social_accounts` **322 rows** (269 connected · 34 pending · 19 revoked)
- `nex.social_oauth_states` **356 rows**
- `nex.social_category_automation` **66 rows**
- `nex.social_validator_runs` **546 rows**

Not classified in §7.x. Likely an Operational Scope value (social media publishing infrastructure) · to be assessed in future §7.x work.

### 2.18 · DISCOVERY / RETRIEVAL infrastructure

- `nex.discovery_orchestrator_pick` **21,496 rows**
- `nex.discovery_rotation_state` **54,550 rows**
- `nex.retrieval_event` **3,062 rows**
- `nex.result_set` **510 rows**
- `nex.semantic_entity_index` **1,754 rows**
- `nex.semantic_question_index` **4,000 rows**
- `nex.question_variant` **25,456 rows** (variants of authored questions)
- `nex.category_candidate_score` **20,237 rows**

Not classified in §7.x. Operational Scope · retrieval + discovery pipelines.

### 2.19 · KNOWLEDGE GAP / KNOWLEDGE INBOX

- `nex.knowledge_gap` **6,335 rows** (identified but unfilled knowledge gaps · Gap Engine substrate per ADR-0304)
- `nex.knowledge_inbox` **279 rows** (111 processing · 96 waiting · 43 processed · 28 review · 1 shadow)
- `nex.knowledge_inbox_stats` **2 rows**
- `nex.knowledge_dump_jobs` **76 rows** (56 completed · 10 claimed · 8 queued · 2 failed)
- `nex.knowledge_records` **1 row** (UNDER_REVIEW · this is the nex_dev copy · Supabase carries 3,627)
- `nex.knowledge_feedback` **0 rows** (nex_dev copy · Supabase carries 402)

Note: Supabase carries the historical knowledge substrate (3,627 records + 402 feedback rows). nex_dev has effectively-empty mirror tables (1 record · 0 feedback rows). Reconciliation between the two substrates is a §7.5 concern deferred to future ADRs.

### 2.20 · TRUTH ENGINE / VERIFICATION substrate

- `nex.gate_kept_event` **2,300 rows** (Guardian gates that PERMITTED writes)
- `nex.gate_rejection_event` **368 rows** (Guardian gates that BLOCKED writes)
- `nex.confidence_scores` **0 rows** (schema-ready per R-11)
- `nex.contradictions` **0 rows** (schema-ready per R-20)
- `nex.fact_conflict` **0 rows**
- `nex.fact_lifecycle_event` **0 rows**
- `nex.deprecations` **0 rows**
- `nex.record_versions` **0 rows** (schema-ready per R-17)
- `nex.evidence` **173 rows** (English Brain evidence)

**Truth Engine substrate is largely schema-ready but empty.** 2,300+ Guardian permit events + 368 rejection events prove Guardian is active. R-11/R-17/R-18/R-20 substrate tables all empty pending verifier implementation (ADR-0314e · Tier 6 · Gate 3 CANDIDATE).

### 2.21 · OTHER · empty schema-ready brain tables

Full list of `nex.brain_*` tables with row counts:
- `nex.brain_accommodation_prices` — **0** (schema-ready)
- `nex.brain_activities` — **0** (schema-ready)
- `nex.brain_attractions` — **32** (populated · trickle-promotion from activities Lab)
- `nex.brain_did_you_know_indonesia` — **39**
- `nex.brain_english_grammar` — **0**
- `nex.brain_english_lesson` — **0**
- `nex.brain_english_practice` — **0**
- `nex.brain_english_progress` — **0**
- `nex.brain_english_vocabulary` — **30**
- `nex.brain_local_guide` — **0**
- `nex.brain_location` — **0**
- `nex.brain_memories` — **0**
- `nex.brain_seasons` — **0**
- `nex.brain_transport` — **0**
- `nex.brain_traveler_rating` — **0**
- `nex.brain_user_saved_facts` — **1**

**14 of 16 brain_* tables are empty or nearly empty.** Schema is broadly wired for future domains but data is concentrated in accommodation + food + business_knowledge + social + conversation infrastructure.

---

## 3 · Key findings

### 3.1 · Data-rich Domains (populated substrate)

Only three Domains have substantial populated substrate:

| Domain | Rows | Provenance | Lab Verified | Ratio to Domain-substrate |
|---|---:|---:|---:|---|
| food | 22,757 | 105,320 provenance rows | 896 | 100% (all specialists Postgres · Lab supplemental) |
| accommodation | 9,230 | 46,306 provenance rows | 4,796 | 100% (all specialists Postgres) |
| business (via business_knowledge + Lab) | 1,258 + 1,192 verified | 21 provenance | 1,192 | Mixed · business_lead_directory only 2 rows |

Also populated but at smaller scale:
- brain_attractions (32) · from activities Lab (780 verified · 748 not yet promoted)
- English Brain (44 concepts · 51 senses · 60 questions · 62 answers · 224 contexts · 173 evidence)
- social infrastructure (1,160 tenants · 715 brand profiles · 617 drafts · 556 templates)
- Supabase knowledge_records (3,627 trade knowledge · pattern A + B + C)

### 3.2 · Domains with adapter/worker but empty specialist substrate

- **travel** — adapter + worker exist · zero specialist tables
- **rentals** — no adapter/worker · partial bike-specific substrate (9 listings · 50 models)
- **construction · healthcare · vision · speaking** — workers registered · no specialist knowledge substrate at all

### 3.3 · Dead paths (Chat route unreachable)

- **markets** — classifier routes but adapter not mounted in chat route.ts
- **code** — classifier routes but adapter not mounted (intentional per ADR-0308 · NEX1-owned)

### 3.4 · Under-utilised Lab rooms

Lab room verification progress by row-count:
- accommodation: 14,894 raw → 4,796 verified (32.2%) — most active
- business: 4,016 raw → 1,192 verified (29.7%)
- food: 3,397 raw → 896 verified (26.4%)
- activities: 2,342 raw → 780 verified (33.3%) — **748 verified not yet promoted to brain_attractions (32 rows)**
- transport: 1,734 raw → 129 verified (7.4%)
- image: 234 raw → 0 verified — barely started · 500K target
- news: 25 raw → 0 verified — barely started · 100K target
- monetization: 0 raw · 0 verified — never started · 0 target (placeholder Lab)
- voice: 0 raw · 0 verified — never started · 10K target
- chat: 0 raw · 0 verified — never started · 100K target

**5 of 10 Lab rooms have never harvested any data.** Rooms voice · chat · monetization are effectively placeholders. news + image barely started. Only the 5 subject-matter rooms (accommodation · food · transport · business · activities) are producing knowledge.

### 3.5 · Substrate gap: Supabase vs nex_dev knowledge_records

- **Supabase**: 3,627 rows in `knowledge_records` · authored + auto-extracted · trade-vertical scoped
- **nex_dev**: 1 row in `nex.knowledge_records` · 0 rows in `nex.knowledge_feedback`

The `knowledge_records` legacy substrate is entirely on Supabase; the nex_dev mirror is effectively empty. Migration between the two is not yet performed. This aligns with §7.1 evidence and defers to §7.8 (NEX prefix) + eventual retrospective audit ADRs.

### 3.6 · Truth Engine implementation gap

Truth Engine substrate is schema-ready across R-11 · R-17 · R-18 · R-20 tables (all 0 rows). Guardian is active (2,300 permit events · 368 rejections). Verifier implementation (ADR-0314e) is Tier 6 · not yet authored · Gate 3 CANDIDATE.

The Rule Book (12 R-resolutions + R-DOMAIN-01 + §7.2 A1 + §7.3 B1) is locked in doctrine. The verifier is not yet built.

### 3.7 · Conversation/turn substrate is the most-populated live pathway

- 583 conv_turns · 1,428 conversation_state · 4,970 conv_edges · 890 conv_knowledge_items · 1,607 conv_learning_candidate (1,606 pending review) · 4,390 turn_latency_event
- This is the live chat path. Rich substrate. But the conv_learning_candidate showing 1,606 pending_review vs only 1 promoted indicates a **large learning backlog** waiting for review pipeline.

### 3.8 · Marketplace substrate is more populated than expected

- 23,580 mp_seller (mostly discovered · 1 active)
- 310 mp_category
- 5 real products
- Confirms §7.2 A1 orthogonality: marketplace is a genuinely-orthogonal substrate to Intelligence Domains.

---

## 4 · Domains that need founder attention (audit-surfaced only · no resolution proposed)

- **travel** — has adapter + worker but zero specialist substrate · no clear Lab
- **rentals** — has NexVertical + partial bike substrate but no adapter/worker/Lab
- **markets** — classifier dead path · no substrate
- **construction · healthcare · vision · speaking** — registered as agents but no substrate at all · are these truly Domains (need brain tables) or Agent/Runtime Identities without knowledge scope?
- **attractions** — substrate exists (32 rows) but 748 Lab-verified rows not yet promoted · large gap
- **social** — 1,000+ rows of social publishing substrate · not classified in §7.x yet (candidate Operational Scope · to be assessed)
- **Trade Knowledge (Supabase 3,627 rows)** — living on legacy substrate · no migration plan yet · deferred to §7.5/§7.8

---

## 5 · What this audit did NOT do

- ❌ No creation of any table · schema · column · row · Guardian rule · migration · CHECK constraint · index
- ❌ No renaming
- ❌ No promotion of any row to AUTHORITATIVE
- ❌ No demotion / deprecation
- ❌ No taxonomy value invented
- ❌ No canonical classification locked
- ❌ Gate 3 NOT opened
- ❌ No modification to §7.1 · §7.2 · §7.3 evidence
- ❌ No resolution of §7.4 or any subsequent §7.x

Freeze holds. Substrates frozen. Gate 3 CLOSED.

---

**End of Domain Brain Coverage Audit · 2026-09-11.**

**Artefact files (all read-only · audit trail preserved):**
- `data/nex-domain-brain-coverage-audit/audit-stdout-2026-09-11.txt` (338 lines · raw substrate output)
- `data/nex-domain-brain-coverage-audit/audit-2026-09-10T20-48-39-869Z.json` (structured JSON)
- `data/nex-domain-brain-coverage-audit/domain-brain-coverage-audit-2026-09-11.md` (this file · summary report)
- `scripts/nex-adr-0314a2s-domain-brain-coverage-audit.mjs` (SELECT-only script)
