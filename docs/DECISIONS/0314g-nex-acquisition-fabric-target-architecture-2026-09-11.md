# ADR-0314g · NEX Acquisition Fabric · Target Architecture · 🔒 DOCTRINE LOCKED · Phase C (design only)

**Status:** 🔒 DOCTRINE LOCKED · founder-authorised Phase C 2026-09-11 · design only · zero code · zero substrate mutation · zero implementation mandate · Stage 1b remains BLOCKED
**Founder:** Philip · authorised via verbatim "AUTHORISE PHASE C" 2026-09-11
**Consumes:** ADR-0314a.2.s Stage 1a Exit Report · ADR-0314a.2.s NEX Lab / Crawler / Scraper / Acquisition Architecture Audit · ADR-0314f Guardian Responsibility Reconciliation · ADR-0314e Truth Engine Verifier · ADR-0314c Cross-Substrate Contradiction Detection · §7.3-B1 · §7.6.5 G4 · §7.7 H1 · §7.10 M1 · R-DOMAIN-01 · project memory `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md` · feedback memories `feedback_no_crawler_zoo_acquisition_fabric_target.md` · `feedback_entity_resolution_location_first_class.md` · `feedback_knowledge_gap_driven_acquisition.md` · `feedback_guardian_duality_lab_te_r10.md`

**Doctrine version:** `nex_acquisition_fabric.v1.0.0` · **Applies to:** every future acquisition / crawler / scraper / API / document / feed / conversation-capture ADR

---

## Section 1 · Founder verbatim authorisation

> *"Author the NEX Acquisition Fabric Target Architecture ADR only. Design/doctrine only. No code. No migrations. No schema changes. No substrate mutation. No crawler changes. No Lab restructuring. No Guardian changes. No Stage 1b. No R-10. No Category taxonomy population. No Entity Resolution implementation. No Location implementation. No English Brain expansion. The ADR must define the target world-class NEX Acquisition Fabric as shared infrastructure, explicitly avoiding a crawler/domain zoo."*
>
> — Philip · 2026-09-11 · Phase C authorisation

> *"Preserve the existing substrates and existing crawler/Lab machinery as-is. This ADR is a target architecture and reconciliation map, not an implementation mandate. Explicitly identify what existing machinery fits, what is duplicated, what is incomplete, and what must eventually be consolidated. The architecture must support knowledge-gap-driven acquisition rather than only scheduled crawling. The architecture must support millions of entities and continuous acquisition without creating a separate crawler brain for every Domain, trade, category or country."*
>
> — Philip · 2026-09-11 · Phase C constraints

---

## Section 2 · Design goals

Six non-negotiable design goals · locked as constitutional invariants:

1. **World-class shared infrastructure** · not a crawler zoo. New Domains · trades · Categories · countries become configuration + source-adapters + extraction policies · never new crawler brains.
2. **Knowledge-gap-driven acquisition** · NEX asks *"what does NEX lack, and what sources close the gap?"* · not *"what URLs can I scrape?"*.
3. **Distinct object types** · a scraped page is not a candidate is not an entity is not a claim is not evidence is not a verified knowledge object. **Never collapse.**
4. **Millions-of-entities scale** · continuous acquisition · queue-based · horizontally scalable · idempotent · stateless workers.
5. **Country/language expansion without architectural redesign** · adding UK · USA · Australia · Ireland · Japan · Morocco etc. must NOT require touching the fabric's core. Country-scope is configuration on the Source Registry + Location hierarchy.
6. **Preservation of Stage 1a foundation** · verifier · rule modules · TE-Guardian · fixtures · runner are constitutional and NOT rewritten. This ADR maps around them · not on top of them.

---

## Section 3 · Object model · nine distinct types (never collapsed)

The most-common architectural failure in acquisition systems is treating "a scraped page" and "a canonical knowledge object" as the same thing. NEX Acquisition Fabric locks nine distinct object types. Each has its own identity · lifecycle · substrate.

| # | Object type | Definition | Distinct from |
|---:|---|---|---|
| 1 | **Source** | A well-known origin of data (Wikidata · OSM · a government portal · an RSS feed · a business's website · an uploaded document · a user conversation). NOT a page · NOT a URL. The wider entity that produces many items over time. | Not an entity · not a claim · not a knowledge object. Has its own characteristics (per §3.3 below). |
| 2 | **Acquisition Request** | An instance of retrieval from a Source (a specific URL fetched at a specific time · a specific API call · a specific document parsed · a specific conversation captured). Carries policies (rate limits · robots · politeness) · retries · timestamps · outcome. | Not a Raw Capture · not a Candidate. Even a failed request has an Acquisition Request record. |
| 3 | **Raw Capture** | The byte payload retrieved by an Acquisition Request. Immutable · provenance-carrying · content-hashed. Preserves the exact bytes NEX saw · not a "normalised version". | Not a Candidate · not a Claim. The raw truth of what the Source said at a moment in time. |
| 4 | **Candidate** | A normalised proposed row extracted from a Raw Capture. Not yet an Entity · not yet a Claim. Just *"here's something that looks like it might be an accommodation / restaurant / person / product"*. | Not an Entity (identity not resolved yet) · not a Claim (attributes not asserted yet). |
| 5 | **Entity** | A canonical referent (a specific hotel · a specific person · a specific product). One Entity may be evidenced by many Candidates from many Sources. Entity Resolution reconciles which Candidates refer to the same Entity. | Not a Candidate (Candidates propose · Entity is canonical) · not a Claim (Entity is the subject · Claims are about the Entity). |
| 6 | **Classification** | The assigned Domain · Category · Activity/Offering · Location (and eventually LAM Object Type · Operational Scope · Agent/Runtime Identity per §7.3-B1) for an Entity. Multi-axis. | Not the Entity itself. Not immutable — Classifications can update as evidence accumulates. |
| 7 | **Claim** | A specific attribute-assertion about an Entity (*"Hotel X has 45 rooms"* · *"Restaurant Y is open Monday-Friday 08:00-22:00"*). Every Claim has an Evidence chain. | Not the Entity · not the Evidence itself · not a Verification verdict. A Claim can be UNVERIFIED · VERIFIED · CONTRADICTED · WITHDRAWN. |
| 8 | **Evidence** | The trace linking a Claim back to a Raw Capture from a Source at a time. Immutable. **Every Claim carries evidence or is fail-closed.** Evidence records: source_id · raw_capture_id · timestamp · extraction_method · confidence-of-extraction. | Not the Claim itself · not the Raw Capture (Evidence points at the Raw Capture). |
| 9 | **Knowledge** | A Claim that has passed Fact Verification + Lab-Guardian + Truth Engine + TE-Guardian + R-10 authorisation · and is AUTHORITATIVE in NEX Storage. This is the endpoint of the pipeline. | Not a Claim (Claims are proposed · Knowledge is authorised) · not a Verification verdict (Verification is a decision · Knowledge is the persisted result). |

### 3.1 · Object-type invariants (locked)

- **Sources have machine-readable characteristics** (§3.3 below) · not just URLs.
- **Acquisition Requests are retained** whether or not they succeeded. Failed requests inform source-quality assessment.
- **Raw Captures are immutable** · content-hashed for dedup · never overwritten · retention policy per source.
- **Candidates do NOT enter the constitutional pipeline** until Lab-Guardian ACCEPTS them.
- **Entities have canonical identity** · Entity Resolution reconciles cross-Source evidence.
- **Classifications MUST be multi-axis** per §7.3-B1 five-axis · never single-axis · never Domain-only.
- **Claims MUST carry Evidence** · no evidence → Claim fails-closed at extraction time · does not enter verification.
- **Evidence points backward** to Raw Captures · Claims point forward to Verification verdicts.
- **Knowledge is the ONLY object type that is AUTHORITATIVE.** Every other type is a stage in the pipeline · not truth.

### 3.2 · Boundary rules (locked)

- **Never treat a Raw Capture as truth.** Raw Captures record what a Source said · not what is true.
- **Never treat a Claim as Knowledge.** Claims are proposed. Knowledge is verified · authorised · persisted.
- **Never treat an Entity as its Classification.** An Entity exists independently of how NEX classifies it. Classification changes do NOT change Entity identity.
- **Never collapse Evidence into Claims.** Losing the Evidence-to-Raw-Capture link destroys audit trail.
- **Never treat a Source as a Claim.** A Source produces Claims · it is not itself a Claim.

### 3.3 · Machine-readable Source characteristics

Every Source in the Source Registry (§4.1) carries at minimum:

- `source_id` · `source_name` · `source_type` (web · api · document · feed · conversation · upload)
- `source_organisation` · `country` · `language` · `authority_class` (per R-05 registry when populated)
- `url_patterns` · `robots_policy` · `crawl_frequency_policy` · `politeness_delay_ms`
- `freshness_class` (real-time · daily · weekly · monthly · annual · one-shot)
- `change_frequency_observed` (measured over time · not just declared)
- `historical_reliability_score` (per source · updated by verification outcomes over time · founder-authored initial values only)
- `extraction_method` (structured-data · semi-structured · unstructured · vision · audio · human-annotated)
- `structured_data_availability` · `api_availability` · `document_availability`
- `entity_coverage` (which entity types this Source produces) · `claim_coverage` (which attributes this Source asserts)
- `geographic_coverage` (Country · Region · City-level)
- `duplicate_relationships` (which Sources overlap · e.g. Nominatim ≈ OSM · Wikidata ≈ Wikipedia)
- `source_disappearance_policy` (what happens if Source becomes unavailable · per §7.1)
- `source_replacement_map` (candidate replacement Sources when primary disappears)
- `evidence_quality_baseline` · `provenance_licence` · `provenance_terms`

NEX learns · over time · which Sources change daily vs annually · which are reliable · which contradict each other. This intelligence sits IN the Source Registry · not in per-domain crawlers.

---

## Section 4 · Layer architecture · six layers + cross-cutting concerns

The Acquisition Fabric consists of six layers plus five cross-cutting concerns. Each layer has a well-defined input/output contract. Layers scale horizontally · idempotent workers · stateless where possible.

### 4.1 · Layer A · Sources (outside the fabric)

The outside world · not code NEX writes. But every Source is REGISTERED in NEX's Source Registry (§3.3 characteristics).

**Source Registry** · a first-class NEX substrate that holds one row per Source with the characteristics above. Sources are registered · not discovered by URL. New Sources are added deliberately · via a Source Registration ADR sub-process (to be authored when Phase C moves toward implementation).

### 4.2 · Layer B · Acquisition (Discovery + Crawl + Fetch)

**B1 · Discovery Orchestrator**
- Reads the Knowledge Gap Registry (§4.7 Layer F) and the Source Registry
- Decides *"for this gap · which Sources will produce a Candidate that closes it?"*
- Emits Acquisition Plans (which Sources · what queries · what priority · what freshness target)
- Does NOT itself fetch. Delegates to the Crawl/Fetch Queues.

**B2 · Crawl Queue** (for scheduled/observed sources · long-running work)
- Reads Acquisition Plans
- Applies per-Source rate-limits · robots-policy · politeness-delay · crawl-frequency-policy
- Emits Crawl Requests to fetch workers

**B3 · Fetch Queue** (for on-demand acquisition · shorter-lived work)
- Reads Acquisition Plans for on-demand tasks
- Applies retry · timeout · backoff (per source-quality signals)
- Emits Fetch Requests

**B4 · Fetch Workers** (stateless · horizontally scalable)
- Executes Crawl/Fetch Requests against Sources
- Handles authentication · session · pagination · politeness
- Produces Raw Captures with full provenance (source_id · timestamp · request_headers · response_headers · status · latency · content_hash · payload_size)

**B5 · Raw Capture Store**
- Immutable content-addressed store
- Content-hash + provenance retained forever (or per source-retention-policy)
- Never overwritten · always append

**B6 · Acquisition Ledger**
- Every Acquisition Request logged · successful and failed
- Enables source-quality assessment over time
- Enables replay: any downstream decision can be replayed from Raw Capture

### 4.3 · Layer C · Processing (Normalise → Dedup → Change Detect → Entity Resolution → Classification → Claim Extraction)

**C1 · Normaliser**
- Converts Raw Captures into a common intermediate representation
- Format-specific parsers (HTML · JSON · XML · PDF · CSV · GeoJSON · audio · image)
- Emits Normalised Candidates
- Does NOT decide Entity · does NOT decide Domain · does NOT extract Claims (that's later)

**C2 · Content Hash + Deduplicator**
- Hashes the normalised content (not the raw bytes · which are hashed at B5)
- Detects: this Candidate is identical to a Candidate we already processed → mark as duplicate · do not re-run downstream
- Retains dedup pointers so audit can find the original processing

**C3 · Change Detector** · four cases (per `feedback_knowledge_gap_driven_acquisition.md` founder lock)
- **UNCHANGED** (identical hash to previous capture) → do almost nothing · update `last_seen` on existing state · skip downstream
- **CHANGED** → identify changed section · identify affected Claims · re-verify ONLY affected knowledge · not the whole entity
- **SOURCE DISAPPEARED** → mark evidence unavailable · **do NOT automatically delete truth** · Truth Engine holds the truth · sources come and go
- **CONTRADICTION** → route through Truth Engine's R-20 · investigate · downgrade · unknown (per R-20 doctrine · never silent)

**C4 · Entity Resolution / Identity Graph** · first-class shared infrastructure per `feedback_entity_resolution_location_first_class.md`
- Reconciles: which Candidates refer to the same Entity?
- Uses: name normalisation · geospatial proximity · attribute-similarity · cross-Source identifiers · Bridge (ADR-0312) relations
- Emits an Entity ID for each Candidate (existing Entity or new)
- **NOT per-Domain** · one Entity Resolution service across all Domains
- **NOT inside the English Brain** · English Brain consumes the identity graph · does not implement it
- Consumes: Bridge substrate (nex.relationships currently 0 rows · Phase C implementation will populate deliberately)

**C5 · Classifier** · applies §7.3-B1 five-axis classification
- Domain axis (9 locked per §7.10 M1)
- Category axis (per-Domain enums · pending founder authoring per ADR-0314a.2.k)
- Activity/Offering axis (per §7.6.5 G4 · cross-Domain applicable_domains registry · pending per ADR-0314a.2.v)
- Location axis (first-class · see C6 below)
- LAM Object Type · Operational Scope · Agent/Runtime Identity where applicable
- Classifier ADR-0314a.2.k values consumed here (not authored here)

**C6 · Location Intelligence** · first-class shared infrastructure per `feedback_entity_resolution_location_first_class.md`
- Hierarchy: Country → Region → City → District → Neighbourhood → Place/Coordinate → Entity
- Precision + provenance at every level (a Claim of "in Yogyakarta city" is different from "at latitude/longitude X/Y with ±10m accuracy")
- **NOT per-Domain** · one Location service across all Domains
- Consumes: geospatial libraries · gazetteers · country/region/city registries
- Emits: canonical Location record for each Entity

**C7 · Claim Extractor**
- Extracts specific attribute-assertions from Normalised Candidates (per Domain + Category context)
- Every Claim carries: subject Entity ID · attribute · value · unit (where applicable) · Evidence pointer
- Emits Claims into the Claim Queue for verification

**C8 · Evidence Recorder**
- For every Claim · records: source_id · raw_capture_id · normalisation step · extraction method · extraction confidence · timestamp
- Evidence rows are immutable · append-only
- Downstream Verification consumes Evidence · never re-invents it

### 4.4 · Layer D · Verification + Governance (Lab-Guardian → Truth Engine → TE-Guardian → R-10)

**D1 · Lab-Guardian** (per ADR-0314f · Phase B lock)
- Answers: *"Is this candidate well-formed and safe to enter the NEX knowledge pipeline?"*
- Structural/safety checks: required fields present · Evidence pointer valid · source provenance recorded · encoding sane · no obviously-malicious payload
- Rejection prefix: `lab.`
- Existing substrate (`nex.gate_kept_event` · `nex.gate_rejection_event`) preserved as Lab-Guardian's ledger

**D2 · Fact Verification** (the Truth Engine · Stage 1a shipped)
- 10 rule modules per Stage 1a: R-01 plausibility · R-03 voice · R-05 authority · R-07 connection · R-11 confidence · R-12 classification · R-13 relationship · R-17 versioning · R-18 verifier envelope · R-20 contradiction
- Produces a `VerdictEnvelope` per Claim (or per Entity's Claim-set for cross-rule interactions)
- 5 rules currently populated · 5 pending founder policy · pending rules return UNKNOWN with canonical fail-closed reason

**D3 · TE-Guardian** (per ADR-0314f · Phase B lock)
- Answers: *"Does this object satisfy NEX's constitutional truth/promotion requirements?"*
- R-18 envelope integrity · §7.7 H1 named-reason discipline · aggregate integrity · anti-substitution
- Rejection prefix: `te.`
- Substrate: Stage 1a isolated (`nex_test.gate_kept_event` · `nex_test.gate_rejection_event`) · Stage 1b production substrate authored by Stage 1b wiring ADR

**D4 · R-10 Authorisation** (Stage 2 · not yet built)
- Answers: *"Is this particular object type authorised to become AUTHORITATIVE under founder policy?"*
- Per-LAM-Object-Type · per-Domain · per-substrate policies (pending Stage 2 authoring)
- Rejection prefix: `r10.`
- Consumes an envelope that has already been TE-Guardian-accepted

**D5 · Contradiction Handler** (per ADR-0314c · framework locked · specific rules pending R-20 · ADR-0314a.2.r)
- When R-20 detects a contradiction · Contradiction Handler decides: downgrade one · downgrade both · route to human review · route to further evidence acquisition (→ feeds back into Knowledge Gap Registry)
- Contradiction detection NEVER silently converts UNKNOWN or missing-information into a CONTRADICTION verdict (per §7.7 H1 · R-20 doctrine)

### 4.5 · Layer E · Storage + Distribution

**E1 · NEX Storage** (specialist tables · already populated)
- `nex.accommodation_business` (9,230 rows) · `nex.food_business` (22,757 rows) · `nex.service_business` (3,922 rows) · `nex.brain_attractions` · `nex.mp_seller` · `nex.mp_product` · `nex.knowledge_records` · `nex.concepts` · `nex.concept_senses` · etc.
- Existing tables · preserved untouched by this ADR
- Consolidation happens under separate future ADRs (Phase C implementation)

**E2 · Knowledge Router** (partial · per Stage 1a exit report)
- 5 world adapters (accommodation · food · commerce · service · transport)
- Missing: attractions · code · places · travel
- Routes query intents to the right substrate + attaches AUTHORITATIVE knowledge

**E3 · Provenance / Source Graph**
- Every AUTHORITATIVE Knowledge object carries its full Evidence + Source chain
- Query time: *"where did this fact come from?"* answered by walking the Source Graph
- Enables replay · audit · source-quality assessment · contradiction investigation

### 4.6 · Layer F · Feedback loop (Knowledge-gap-driven acquisition · founder-locked)

**F1 · Knowledge Gap Registry**
- Machine-readable registry of *"what NEX currently lacks"*
- Populated by: gap-detection over the specialist tables · unanswered queries in Knowledge Router · founder-authored priority gaps · Truth-Engine UNKNOWN outcomes that need more evidence · Contradiction Handler requesting more evidence
- Consumed by: Discovery Orchestrator (§4.2 B1)

**F2 · Gap-Detection Workers**
- Continuously scan specialist tables for empty attributes · missing entities in known regions · low-coverage Categories
- Emit Gap Records with: entity_scope · attribute_scope · location_scope · priority · confidence-of-gap

**F3 · Reacquisition Trigger**
- When: a Gap Record is created · a Source Change is detected · a Contradiction requires more evidence · a Freshness deadline expires
- Emits: an Acquisition Plan back to Layer B Discovery Orchestrator
- Loop: gap → sources → plan → acquire → extract → verify → TE → store → gap-closed? → NO: acquire again · YES: NEX grows

**F4 · Freshness Monitor**
- Per-Source · per-attribute · per-Domain freshness policies
- Detects: *"we haven't checked business opening hours from this source in 30 days · re-fetch"*
- Emits Acquisition Plans for stale-but-needed data

**F5 · Source-Quality Feedback**
- Verification outcomes flow back to update `historical_reliability_score` on the Source Registry
- Sources that consistently produce Truth-Engine-verified Claims accrue reliability
- Sources that consistently produce contradictions or Guardian-rejections lose reliability
- **Reliability scores are updated by observation · but constitutional threshold values remain founder-authored** (per `feedback_thresholds_are_founder_policy_not_ai_statistics.md` + `feedback_observation_is_not_constitutional_authority.md`)

### 4.7 · Cross-cutting concerns

**X1 · Observability**
- Every stage in every Layer emits telemetry (structured events · not free-text logs)
- Metrics: throughput · latency · error rate · dedup rate · Guardian-reject rate · verification-verdict distribution
- Traces: an Acquisition Request has a trace_id that follows the Candidate → Entity → Claim → Verification → Knowledge chain
- Dashboards: source-level · Domain-level · gap-level · country-level

**X2 · Audit + Replay**
- Every decision at every Layer is reproducible from the persisted state
- Given a Knowledge object, the audit trail returns: which Raw Capture(s) · which Evidence · which Verifier verdict · which Guardian decisions · which R-10 policy · which timestamps
- Given a state change, the replay path re-runs the pipeline byte-identical (deterministic clock inputs · fixed seeds where applicable · idempotent workers)

**X3 · Country/language configuration**
- Country expansion (UK · USA · Australia · Ireland · Japan · Morocco etc.) is achieved by:
  - Registering new Sources in the Source Registry
  - Adding country-scoped Location hierarchy
  - Adding country-scoped policy overrides (per R-01 country thresholds · R-05 authority registry country entries · R-12 Category enum country variants where founder authors)
- Country expansion does NOT require: new crawler code · new specialist table per country · new brain
- Language: normaliser + extractor consume language configuration (per Source characteristics)

**X4 · Idempotency + horizontal scaling**
- Every worker is stateless · reads from queue · writes to queue · does not hold session state
- Queues are content-addressable (dedup by content-hash + trace_id)
- Re-running a Fetch/Normalise/Verify step produces the same result (given same inputs)
- Scaling: add worker instances · queue depth drops · no coordination required

**X5 · Backpressure + rate-limit sharing**
- Per-Source rate-limit budgets held centrally (not per-worker)
- Fetch Queue applies backpressure when Source budget exhausted
- Verifier + Guardian back-pressure to Fetch Queue when downstream stages saturated

---

## Section 5 · Knowledge-gap-driven acquisition loop (founder-locked shape)

The loop shape is founder-authored (from `feedback_knowledge_gap_driven_acquisition.md`):

```
KNOWLEDGE GAP
  ↓
WHAT INFORMATION IS MISSING?
  ↓
WHAT ENTITY / DOMAIN / LOCATION?
  ↓
WHAT SOURCE TYPES COULD ANSWER IT?
  ↓
SOURCE DISCOVERY
  ↓
SOURCE QUALITY ASSESSMENT
  ↓
ACQUISITION PLAN
  ↓
CRAWL / API / DOCUMENT / FEED
  ↓
EXTRACT CLAIMS
  ↓
VERIFY (Fact Verification + Lab-Guardian + Truth Engine + TE-Guardian)
  ↓
R-10 (Stage 2)
  ↓
STORE (AUTHORITATIVE)
  ↓
GAP CLOSED?
  │
  ├── NO → acquire again (loop back)
  └── YES → NEX grows
```

This loop consumes the Layer F Knowledge Gap Registry and emits Acquisition Plans into Layer B Discovery Orchestrator. It is NOT scheduled crawling · although scheduled acquisition (freshness monitoring · X4) is a SUBSET of gap-driven acquisition (freshness-gap is a kind of gap).

---

## Section 6 · Existing machinery · fit map

This ADR does NOT modify any existing code or substrate. It maps the existing machinery to the target layers.

### 6.1 · Existing machinery that FITS the target

| Existing | Maps to | Notes |
|---|---|---|
| `scripts/nex-lab-harvest-nominatim.mjs` | Layer B4 · Fetch Worker (Nominatim source-adapter) | Preserve · reclassify as source-adapter · not per-Domain crawler |
| `scripts/nex-lab-harvest-wikidata.mjs` + `nex-lab-wikidata.mjs` | Layer B4 · Fetch Worker (Wikidata) | Consolidate 3× duplication (see §6.2) |
| `scripts/nex-lab-gov-harvester.mjs` | Layer B4 · Fetch Worker (Government sources) | Preserve · reclassify |
| `scripts/nex-lab-news-harvester.mjs` | Layer B4 · Fetch Worker (RSS/News) | Preserve · reclassify |
| `scripts/nex-lab-image-fetcher.mjs` | Layer B4 · Fetch Worker (Image sources) | Preserve · reclassify · consolidate 3× duplication |
| `scripts/nex-lab-directory-crawler.mjs` | Layer B4 · Fetch Worker (Directory sites) | Preserve |
| `scripts/nex-lab-instagram-enricher.mjs` | Layer B4 · Fetch Worker (Social profile enrichment) | Preserve |
| `src/lib/nex/live-chat-completion/web-acquisition/*` (6 providers) | Layer B4 · Fetch Workers (on-demand chat providers) | Preserve · distinguish from batch acquisition |
| `src/lib/nex/lab/promotions.ts` + executors (accommodation · food · business-lead · activities) | Layer D3-E1 · post-Verification promotion routing | Reroute through Lab-Guardian → Truth Engine → TE-Guardian → R-10 rather than directly to specialist tables |
| `nex.gate_kept_event` (2,300 rows) + `nex.gate_rejection_event` (368 rows) | Layer D1 · Lab-Guardian ledger | **Preserved untouched** per ADR-0314f |
| `src/lib/nex/truth-engine/verifier/*` (Stage 1a shipped) | Layer D2 · Fact Verification | **Preserved untouched** · constitutional foundation |
| `src/lib/nex/truth-engine/guardian/*` (Stage 1a shipped) | Layer D3 · TE-Guardian | **Preserved untouched** · constitutional foundation |
| `src/lib/nex/brain/world-adapters/*` (5 adapters) | Layer E2 · Knowledge Router | Preserve · complete missing 4 adapters over time |
| `nex.accommodation_business` · `nex.food_business` · `nex.service_business` · specialist tables | Layer E1 · NEX Storage | **Preserved untouched** · well-populated |
| `nex.concepts` · `nex.concept_senses` · `nex.contexts` etc. (English Brain substrate) | Layer E1 · NEX Storage (semantic substrate for future English Brain) | Preserved · English Brain consumes · does not reimplement |
| `nex_lab.growth_history` (940 rows) | Layer X1 · Observability (per-Lab growth) | Preserved · continues to accumulate |
| `nex_lab.promotion_events` (27 rows) · `nex_lab.promotion_rows` (618 rows) | Layer X2 · Audit + Replay | Preserved |

### 6.2 · Duplicated machinery (consolidation candidates · not Phase C implementation)

| Duplication | Where | Consolidation target |
|---|---|---|
| Wikidata connector × 3 | `nex-lab-wikidata.mjs` · `nex-lab-harvest-wikidata.mjs` · `web-acquisition/wikidata-provider.ts` | Single Wikidata source-adapter with two invocation modes (batch · on-demand) |
| Image acquisition × 3 | `nex-lab-image-fetcher.mjs` · `nex-lab-harvest-image.mjs` · Master AI `image-analyst.ts` | Split into: (a) Image source-adapter (Layer B4) · (b) Image intelligence worker (Layer C · optional analysis) |
| Knowledge extraction × 2 | `knowledge-extractor.ts` (Supabase pipeline · has §7.8 J1 double-NEX bug) + Master AI research-engine | Single Claim Extractor (Layer C7) · resolve the J1 bug in the reconciliation |
| Verification × 2+ | `nex-lab-verify.mjs` + `quality-checker.ts` brain worker + Stage 1a Truth Engine | Lab-verification is Lab-Guardian (Layer D1) · quality-checker becomes deprecated once Truth Engine is production-wired · single Fact Verification path |

### 6.3 · Incomplete machinery

| Incomplete | Notes | Where in fabric |
|---|---|---|
| Transport Lab has 133 verified rows · no promotion executor | Blocked | Layer D3-E1 · needs executor OR reclassification |
| Image Lab · News Lab have data but no verification pipeline | Layer D2 pipeline missing | Needs Fact Verification wiring |
| Voice · Chat · Monetization Labs entirely idle | Reclassify per §6.4 | Not Labs · Operational Scopes / Multimodal (per Lab Audit) |
| 748 activities-verified rows stranded (attraction_kind 12-value CHECK vs 87 activity slugs) | Blocked by ADR-0314a.2.v activity registry authoring | Layer C5 Classifier · pending policy |
| Bridge relations (nex.relationships) · 0 rows | Layer C4 Entity Resolution needs this populated | Phase C implementation |
| Location as first-class axis | Currently row-metadata · not a proper axis | Layer C6 · Phase C implementation |
| Knowledge Router world adapters for attractions · code · places · travel | Layer E2 gaps | Add over time · not per-Domain crawlers |
| Country-scoped acquisition (beyond Indonesia) | Not yet supported | Layer X3 configuration · pattern locked here · registration ADRs per country when founder authors |

### 6.4 · Machinery that MUST eventually be consolidated

**These are candidates for consolidation ADRs · NOT authored by this Phase C ADR.** Founder authors specific consolidation ADRs when ready:

1. **Voice / Chat / Monetization Labs** → reclassify. Voice + Chat = Multimodal (Layer B4 source-adapters + Layer C claim-extraction). Monetization = Operational Scope (per §7.3-B1 · not a Lab · not a Domain).
2. **Image / News Labs** → reclassify as Layer B4 source-adapters (not per-Domain Labs). Attach Fact Verification (Layer D2).
3. **Business Lab** → reclassify as cross-Domain Classifier + Router (Layer C5 · not a Business-Domain-specific Lab).
4. **Activities Lab** → decompose into Layer C5 Activity classification + Layer C7 Claim Extraction for attractions. Activity is a cross-Domain classification, not a Lab.
5. **Wikidata connector duplication** → single source-adapter (§6.2).
6. **Image acquisition duplication** → split source-adapter vs intelligence-worker (§6.2).
7. **Knowledge extraction duplication + §7.8 J1 double-NEX bug** → single Claim Extractor with the J1 bug resolved.
8. **Verification path duplication** → Lab-Guardian for candidate acceptance · Truth Engine for constitutional truth (§6.2).

---

## Section 7 · Country/language expansion pattern (locked)

Adding a new country (say · UK) MUST NOT require:

- ❌ New crawler brain
- ❌ New specialist table per country (`uk_accommodation_business`)
- ❌ New Lab room per country
- ❌ New Guardian per country
- ❌ New Truth Engine per country

Adding a new country DOES require:

- ✅ Registration of new Sources in the Source Registry (UK OSM · UK gov portals · UK RSS feeds · UK Wikidata subset)
- ✅ Country-scoped Location hierarchy (UK → England → London → Camden → …)
- ✅ Country-scoped policy overrides where FOUNDER authors them (per-country R-01 thresholds · R-05 authority entries · R-12 Category enum country variants)
- ✅ Language configuration on Sources (en-GB · en-US · id-ID etc.)

**All existing Fetch Workers · Normaliser · Dedup · Change Detector · Entity Resolution · Classifier · Location Intelligence · Claim Extractor · Lab-Guardian · Truth Engine · TE-Guardian · R-10 · NEX Storage · Knowledge Router work UNCHANGED across countries.** Country is a first-class axis on Source · Entity · Location · Policy · not on infrastructure.

---

## Section 8 · Scale posture (millions of entities · continuous acquisition)

The fabric supports millions of entities without per-Domain brains because:

- **Sources are registered · not enumerated inline.** Adding a Source is a Source Registry write · not a code change.
- **Fetch Workers are stateless.** N workers process N requests concurrently. Scaling = add workers.
- **Queue-based Layer B + C.** No worker holds session state. Idempotent re-runs.
- **Entity Resolution is one service.** Bridge relations grow · service stays constant.
- **Classifier is one service.** Per-Domain enums live in Category taxonomy · not in per-Domain code.
- **Location Intelligence is one service.** Country/Region/City/District hierarchy scales · not code.
- **Lab-Guardian + Truth Engine + TE-Guardian + R-10 are one pipeline.** Ledger rows grow · code stays constant.
- **Knowledge Gap Registry drives priority.** As NEX grows · gap-closure focus shifts · infrastructure doesn't restructure.
- **Storage is specialist tables.** Existing scale patterns work.

**No crawler zoo · no per-domain brain · no per-country codebase.**

---

## Section 9 · Boundaries with Stage 1a foundation (preserved · not touched)

Stage 1a shipped:
- Truth Engine verifier (`src/lib/nex/truth-engine/verifier/*`)
- 10 rule modules (`src/lib/nex/truth-engine/verifier/rules/*`)
- TE-Guardian (`src/lib/nex/truth-engine/guardian/*`)
- 33 fixtures in `nex_test.*`
- Deterministic fixture runner (`scripts/nex-truth-engine-fixture-runner.ts`)

**None of these are modified by Phase C.** The Acquisition Fabric target architecture MAPS AROUND them:

- Fact Verification (Layer D2) = the existing Truth Engine verifier · unchanged
- TE-Guardian (Layer D3) = the existing Guardian class · unchanged
- Rule modules (R-01 … R-20) = unchanged · consumed by verifier at D2
- Fixture-based reproducibility = unchanged · continues to prove determinism

Phase C implementation (post-founder-authorisation · post-Stage-1b) BUILDS the layers around these · never on top of them.

---

## Section 10 · What Phase C does NOT do

- ❌ No code authored
- ❌ No migrations authored
- ❌ No schema changes
- ❌ No `nex.*` substrate modified
- ❌ No `nex_test.*` substrate modified
- ❌ No `nex_lab_*` substrate modified
- ❌ No Supabase modified
- ❌ No crawler code modified
- ❌ No Lab restructuring
- ❌ No Guardian implementation changed
- ❌ No verifier or rule module changed
- ❌ No fixture change
- ❌ No Stage 1b wiring commenced
- ❌ No R-10 authored
- ❌ No Category taxonomy population
- ❌ No Entity Resolution implementation
- ❌ No Location axis implementation
- ❌ No English Brain expansion
- ❌ No consolidation execution (§6.4 lists candidates · each requires its own founder-authored ADR)
- ❌ No new Domain (nine locked per §7.10 M1)
- ❌ No Constitutional layer modification
- ❌ No autonomous operation authorised
- ❌ No Source Registry populated (registration is a separate future sub-process)

---

## Section 11 · Enforcement implications (doctrine · not implemented)

Once Phase C is founder-approved · future ADRs enforce these invariants:

- **Every acquisition/crawler/scraper/API/document/feed ADR MUST map its rules to Layer B4 (Fetch Worker) + associated source-adapter · not to a new "per-Domain crawler brain".**
- **Every classification ADR MUST route through Layer C5 (Classifier) using multi-axis §7.3-B1 · not create a per-Domain classification path.**
- **Every extraction ADR MUST emit Claims with Evidence pointers (never Claim-without-Evidence).**
- **Every verification ADR MUST use the Layer D pipeline (Lab-Guardian → Truth Engine → TE-Guardian → R-10) · not bypass gates.**
- **Every entity-identity decision MUST use Layer C4 (Entity Resolution) · not per-Domain identity logic.**
- **Every location-scoped decision MUST use Layer C6 (Location Intelligence) · not per-Domain location string.**
- **Every country expansion MUST use Layer X3 configuration pattern · not new per-country code.**
- **Every source-quality signal MUST feed back to Source Registry (Layer F5) · not autonomously modify constitutional thresholds.**
- **Every Guardian rule addition MUST specify which of the three gates it belongs to (per ADR-0314f).**

---

## Section 12 · Reconciliation with the Lab Audit (2026-09-11)

The Lab Audit (`docs/DECISIONS/0314a.2.s-nex-lab-crawler-scraper-acquisition-audit-2026-09-11.md` · Section 9 · proposed 16-19 rooms across 4 layers) is CONSUMED by this ADR but SUBORDINATE to it. Where the Audit's proposed topology conflicts with this ADR's target architecture · this ADR is authoritative.

Specifically:
- The Audit's Layer A (Source Adapters) becomes Layer B4 Fetch Workers + Source Registry (§4.2) in this ADR.
- The Audit's Layer B (Intelligence Processing) becomes Layer C (Processing) in this ADR · with the same components (Domain Discovery · Entity Resolution · Classification · Location · Concept/Semantic Intelligence).
- The Audit's Layer C (Verification + Governance) becomes Layer D in this ADR · reconciled with ADR-0314f Guardian responsibility split.
- The Audit's Layer D (Multimodal) becomes source-adapters in Layer B4 + optional Layer C intelligence workers · not standalone Labs.
- The Audit's proposed "16-19 rooms" is superseded by this ADR's layered fabric with pluggable source-adapters and pluggable processing workers · which is more general.

The Audit remains a valuable inventory of what exists today · this ADR is the target architecture toward which the existing machinery reconciles over time.

---

## Section 13 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | NEX Acquisition Fabric locked as target architecture: 9-distinct-object-types (Source · Acquisition Request · Raw Capture · Candidate · Entity · Classification · Claim · Evidence · Knowledge · never collapsed) · 6-layer + 5-cross-cutting fabric (Sources · Acquisition · Processing · Verification+Governance · Storage+Distribution · Feedback Loop · plus Observability · Audit+Replay · Country/Language · Idempotency · Backpressure) · knowledge-gap-driven acquisition loop · country expansion as configuration not code · existing crawler/Lab machinery preserved and mapped to the fabric · consolidation candidates identified but not executed · Stage 1a foundation preserved untouched · Phase C is a target architecture and reconciliation map · NOT an implementation mandate · Stage 1b remains BLOCKED |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0314g · this file · consumed by future Stage 1b wiring ADR · Layer implementation ADRs · consolidation ADRs · country expansion ADRs · Source registration ADRs |
| **Effective from** | `nex_acquisition_fabric.v1.0.0` |
| **Supersedes** | none · superior to (but does not delete) ADR-0314a.2.s Lab Audit's proposed topology |
| **Reason** | Founder verbatim (Phase C authorisation + Phase C constraints · 2026-09-11): world-class general-purpose fabric · not crawler zoo · knowledge-gap-driven · supports millions of entities · country expansion without redesign · nine distinct object types never collapsed · Stage 1b decision made from complete architectural picture · not from discovering acquisition problems after production wiring. |

---

## Section 14 · Cross-references

**Consumed by (future ADRs):**
- Stage 1b wiring ADR (post-Phase-C · pending founder authorisation)
- Layer B4 source-adapter registration ADRs (per Source · founder authors each)
- Layer C4 Entity Resolution implementation ADR (Phase C implementation)
- Layer C6 Location Intelligence implementation ADR (Phase C implementation)
- Layer F Knowledge Gap Registry implementation ADR (Phase C implementation)
- Consolidation ADRs (Wikidata × 3 · Image × 3 · Knowledge extraction × 2 · Verification path × 2 · Voice/Chat/Monetization reclassification · Image/News reclassification · Business Lab reclassification · Activities Lab decomposition)
- Country expansion ADRs (UK · USA · Australia · Ireland · Japan · Morocco etc. · founder authors each)
- Category taxonomy population ADRs (ADR-0314a.2.k values · pending founder)
- Activity registry population ADR (ADR-0314a.2.v · pending founder)
- R-10 policy ADRs (Stage 2)

**Consumes:**
- ADR-0314a.2.s Stage 1a Exit Report (2026-09-11) — Stage 1a completion
- ADR-0314a.2.s NEX Lab / Crawler / Scraper / Acquisition Architecture Audit (2026-09-11) — inventory input
- ADR-0314f Guardian Responsibility Reconciliation (2026-09-11) — Layer D boundaries
- ADR-0314e Truth Engine Verifier Implementation (D-Impl) — Layer D2 mapping
- ADR-0314c Cross-Substrate Contradiction Detection framework — Layer D5 handling
- ADR-0314a.1 Reference Fixture Set (D-Fix) — verification baseline preserved in Layer D2
- ADR-0314a.2.j (D-11 confidence) · ADR-0314a.2.l (R-13 relationship baseline) · ADR-0314a.2.m (D-17 versioning) · ADR-0314a.2.n (D-01-values plausibility) — populated rule policies consumed at Layer D2
- ADR-0314a.2.k · ADR-0314a.2.p · ADR-0314a.2.q · ADR-0314a.2.r · ADR-0317 — pending rule policies · consumed at Layer D2 when founder authors values
- ADR-0312 Bridge relations — Layer C4 substrate
- §7.3-B1 five-axis · §7.6.5 G4 Activity ≠ Domain · §7.7 H1 other ≠ unknown · §7.10 M1 Domain axis closed at 9 · R-DOMAIN-01 anti-substitution · R-10 gate-model
- Project memory `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md`
- Feedback memories: `feedback_no_crawler_zoo_acquisition_fabric_target.md` · `feedback_guardian_duality_lab_te_r10.md` · `feedback_entity_resolution_location_first_class.md` · `feedback_knowledge_gap_driven_acquisition.md` · `feedback_thresholds_are_founder_policy_not_ai_statistics.md` · `feedback_observation_is_not_constitutional_authority.md`

---

## Section 15 · Master AI STOPS · awaiting founder review

**Master AI does NOT autonomously proceed to Stage 1b wiring · Layer implementation ADRs · consolidation ADRs · country expansion · Category population · Entity Resolution build · Location axis implementation · English Brain expansion · or any other work.**

Each subsequent step requires a separate founder authorisation.

**Current position after Phase C:**

- Phase A · Stage 1a · 🟢 COMPLETE (ADR-0314a.2.s Stage 1a Exit Report)
- Phase B · Guardian Responsibility Reconciliation · 🟢 LOCKED (ADR-0314f)
- Phase C · NEX Acquisition Fabric target architecture · 🟢 LOCKED (**this ADR** · ADR-0314g)
- Stage 1b · production wiring · 🔴 BLOCKED pending: (a) founder review of Phase C · (b) Stage 1b wiring ADR authored (post founder authorisation) · (c) explicit founder "AUTHORISE STAGE 1b"
- Stage 2 · R-10 promotion gate + LAM policies · 🔴 BLOCKED pending Stage 1b + Stage 2 authoring
- Category taxonomy per-Domain enums · 🔴 BLOCKED pending founder authoring (ADR-0314a.2.k values)
- Pending policy population (R-03 · R-05 · R-07 · R-12 · R-20) · 🔴 BLOCKED pending founder authoring
- Layer implementation ADRs (Entity Resolution · Location · Source Registry · Knowledge Gap Registry) · 🔴 BLOCKED pending Stage 1b + explicit founder authorisation per Layer
- Consolidation ADRs · 🔴 BLOCKED pending founder authoring per consolidation
- Country expansion ADRs · 🔴 BLOCKED pending founder authoring per country
- English Brain expansion · 🔴 waits for proper substrate (Category · Entity Resolution · Location · Knowledge Gap)

**Substrate posture:**

- Production `nex.*` · 💾 FROZEN · zero writes
- `nex_lab_*` · 💾 FROZEN · zero writes
- Supabase · 💾 FROZEN · zero writes
- `nex_test.*` · 💾 stable at post-1a.7 counts · no writes by this ADR
- Gate 3 · 🟢 OPEN (unchanged since 2026-09-11 opening)

**Phase A + B + C are now locked before Stage 1b · exactly as founder requested.** Stage 1b decision can now be made from a complete architectural picture.

---

**End of ADR-0314g · NEX Acquisition Fabric Target Architecture · Phase C doctrine locked · Stage 1b awaits separate founder authorisation.**
