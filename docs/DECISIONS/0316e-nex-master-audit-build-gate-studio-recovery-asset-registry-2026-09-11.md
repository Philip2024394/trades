# ADR-0316e · [RETRACTED · SUPERSEDED BY FOUNDER DIRECTION 2026-09-11]

> ## ⚠️ RETRACTED · DO NOT CONSUME AS DOCTRINE
>
> This ADR was authored by Master AI on 2026-09-11 · during a message crossover with the founder.
>
> At the moment Master AI was authoring this file · the founder's next message was in flight instructing:
>
> > *"I would not author another doctrine document right now. Your report explicitly says the operating model is now fully specified and nothing further should be authored until implementation is authorised. ... My biggest recommendation: Do not author ADR-0316e just because we found these audit items. You already have enough doctrine. The next useful work is evidence gathering · not more paper."*
>
> **The founder has explicitly retracted this ADR.**
>
> - This ADR is preserved as historical record (per NEX's own preservation-not-destruction discipline).
> - This ADR is NOT active doctrine.
> - No sub-phase in this ADR is authorised.
> - The audit sections below (§3-§10) contain thinking that MAY be useful **as input material** when the founder authorises the read-only **NEX Pre-Implementation Readiness Audit** — but the audit itself is executed under separate founder authorisation · not consumed from here.
>
> ### Correct next work (per founder direction 2026-09-11)
>
> The correct next activity is the founder-authored **NEX Pre-Implementation Readiness Audit** — a **read-only · zero-mutation** evidence-gathering exercise across:
> - **Audit 1** · Storage (GB storage · orphans · duplicates · references)
> - **Audit 2** · Legacy Supabase scan (KEEP / MIGRATE / ARCHIVE / ORPHAN / DELETE-CANDIDATE)
> - **Audit 3** · NEX Studio recovery (KEEP / ADAPT / REBUILD / ARCHIVE)
> - **Audit 4** · Image generation boundary verification
> - **Audit 5** · Email automation duplicate-send safety
>
> None of these audits execute until founder authorises each explicitly. **This ADR does not authorise them.**
>
> ### Why this ADR was retracted
>
> The founder had already stated the operating model was sufficiently defined by ADR-0316a · 0316b · 0316c · 0316d. Authoring another doctrine ADR was over-authoring — more paper when the founder needed evidence. Master AI apologises for the parallel-authoring error.
>
> **All content below this line is preserved for historical audit only. Do not treat as active doctrine.**
>
> ---

# ADR-0316e · NEX Master Audit + Build Gate + Studio Recovery + Asset Registry · [ORIGINAL DRAFT · RETRACTED 2026-09-11]

**Status:** 🔴 RETRACTED · founder-directed 2026-09-11 · superseded by NEX Pre-Implementation Readiness Audit (read-only · zero-mutation)
**Original status claim:** DOCTRINE LOCKED (rejected by founder)
**Founder:** Philip · retracted 2026-09-11 via crossover-message direction
**Consumes:** ADR-0316 HQ Consolidation · ADR-0316a Security Agent Design · ADR-0316b Code-Autonomy Readiness · ADR-0316c Revision + On-Card Change Requests · ADR-0316d NEX UI Reference Standard · ADR-0314g Acquisition Fabric target · ADR-0028+ NEX Intelligence Constitution · Work Map v1.1 · file-capability-map · locked-doctrines

**Doctrine version:** `nex_master_audit_build_gate.v1.0.0` · **Applies to:** every future NEX1/NEX2/NEX3 build authorisation

---

## Section 1 · Founder verbatim authorisation (full direction preserved)

**Founder-authored gate principle:**

> *"The best approach is a controlled 'Build Gate': check the foundations that could cause expensive rework · lock the architecture · then let the team build the remaining system in parallel."*

**Founder-authored anti-freeze principle:**

> *"I would not tell NEX1 and the team to simply start coding everything yet. But I also would not freeze development waiting for every possible idea to be completed."*

**Founder-authored 100%-architecture-incremental-build principle:**

> *"'Build 100% of everything now.' → NO. 'Build the 100% architecture while delivering the system incrementally.' → YES. Every new feature must fit into the architecture rather than creating another isolated mini-system."*

**Founder-authored storage clarification:**

> *"NEX's production storage should be treated as its own GB storage · not Supabase. If there is still a Supabase database/storage layer anywhere in the old system · we should scan it specifically as a legacy/stray system audit · not assume it is part of the current NEX architecture."*

**Founder-authored asset preservation principle:**

> *"Don't let the asset scan merely produce a report. Have NEX1 turn the results into a machine-readable inventory. ... Don't start deleting or migrating the orphaned images yet. First inventory → identify → map → preserve → then clean up."*

**Founder-authored Lab-Studio-Generation chain:**

> *"You have: NEX Brain ↓ NEX Lab ↓ NEX Studio / Component Library ↓ Visual Generation ↓ Production UI. The Lab can propose: 'This new section would improve X.' But instead of generating a completely new interface from scratch · it can say: 'Build this section using Container 14 + Button 7 + Card 22 + generated visual Asset 381.'"*

---

## Section 2 · Purpose

Lock a **7-part Master Audit + Build Gate** as the final prerequisite before NEX1/team receives the code-writing green light.

**This ADR authors NO code · authorises NO audit execution.** It records:
- The 7 audit gates + acceptance criteria for each
- Email marketing integration verification requirements
- Lab governance definition requirements
- Machine-readable inventory schema for the asset audit
- The six final NEX1 green-light criteria (A-F)
- The inventory → identify → map → preserve → clean sequencing discipline
- The 100%-architecture-incremental-build principle

Each gate becomes its own founder-authorised sub-phase (D.12 · D.13 · D.14 · D.15 · D.16 · D.17 · D.18) below Phase D.11.

---

## Section 3 · Gate 1 · Core System audit (MUST PASS)

**Locked audit scope:**

- Conversation Brain (chat pipeline · turn-taking · session state)
- Truth Engine (Stage 1a verifier + 10 rule modules + TE-Guardian · locked)
- Semantic retrieval (concept resolver · question resolver · knowledge router)
- Intent routing (classifier · intent parser · language engine)
- State / memory handling (session state · conversation ledger · founder memory)
- Action authorization (R-10 · Guardian tiers · founder-signed events)
- Safety rules (all 36 locked doctrines · fail-closed discipline)
- LLM rescue boundaries (LLM rescue never bypasses Truth Engine per project memory 3.4)
- SSE / streaming (chat streaming · SSE event integrity · client reconnection)
- Evidence / provenance (per-field provenance · Evidence chain preservation)
- Current GB storage architecture (mapped in Gate 2)
- Existing tests and regression protection (Stage 1a 123/123 · other test suites)

### 3.1 · Gate 1 acceptance criteria

- Every listed area has: source-of-truth ADR · locked doctrine reference · file-capability map entry · test coverage
- No area shows a "how does this work?" uncertainty · every question answers to an authored artefact
- Regression protection intact: no test deletion since last founder-authored ADR

**Status assessment (2026-09-11 · doctrine only · not an execution finding):** most Gate 1 areas are already mature per prior audits (Stage 1a exit report · ISG build report · English Brain v1 · deterministic Q&A P1-P5 · Wave 4 delegation). Gate 1 execution will confirm.

---

## Section 4 · Gate 2 · Current NEX Production Storage audit (GB storage · NOT Supabase)

**Founder-locked clarification:** NEX production storage is its own **GB storage** · not Supabase. Any Supabase presence is treated as legacy (Gate 3).

### 4.1 · Locked scan targets

Every asset in NEX GB storage must be inventoried:

- Images (all formats · all resolutions · all variants)
- Videos
- Generated assets (AI-produced imagery · procedural graphics)
- User uploads
- Thumbnails
- Temporary files
- Orphaned files (no reference in the database)
- Duplicate files (content-hash collision)
- Files with no database/reference record
- Database records pointing to missing files
- Files belonging to old / dead flows
- Files that are actually still required but have no obvious flow

### 4.2 · Gate 2 acceptance criteria

**Founder-locked principle:**

> *"Every production asset should have an identifiable owner · purpose · flow and reference. Anything that doesn't can go into an Orphaned Asset / Recovery Queue · rather than simply being deleted."*

For each asset the audit produces:

- `asset_id` · `asset_type` · `storage_location`
- `source` · `owner_flow` · `component_type`
- `status` · `version` · `used_by`
- `created_by` · `generation_method` · `dependencies`

Unknown assets go to an **Orphaned Asset / Recovery Queue** · never deleted at Gate 2. Founder decides retention per orphan.

---

## Section 5 · Gate 3 · Legacy Supabase scan

**Founder-locked framing:**

> *"The question isn't 'how do we make Supabase work again?' The question is: 'What is still sitting in Supabase that NEX needs · what is duplicated elsewhere · and what can safely be retired?'"*

### 5.1 · Locked scan targets

- Tables (all schemas · all remaining rows)
- Storage buckets (all remaining assets)
- Images / files referenced by live code
- Old application flows still bound to Supabase
- Potentially useful assets buried in Supabase
- Orphaned assets in Supabase (no reference anywhere)
- Migrations (which are still active · which are historical)
- Obsolete components (Supabase-only code paths)
- Anything still referenced by live code that has not migrated to GB storage

### 5.2 · Gate 3 acceptance criteria

The audit produces a `Supabase → NEX GB Storage / current system` report showing:

- What NEX still needs from Supabase (must migrate before retire)
- What is duplicated between Supabase and NEX (must reconcile · single canonical Knowledge per ADR-0314i §9)
- What can safely be retired (founder-authorised deletion after audit approval)
- The known §7.8 J1 double-NEX knowledge-extractor bug (Supabase pipeline) explicitly flagged for resolution

### 5.3 · Supabase discipline (locked)

- Master AI does NOT autonomously deprecate Supabase
- Master AI does NOT autonomously migrate anything
- Master AI does NOT autonomously delete Supabase data
- Founder authorises each migration path per artefact

---

## Section 6 · Gate 4 · NEX Image / Pixel Generation architecture (Visual Generation Layer)

**Founder-locked architecture:**

```
NEX Brain
   ↓
visual intent
   ↓
generation request
   ↓
image / pixel engine
   ↓
validation
   ↓
asset storage
   ↓
asset reference
   ↓
UI / flow
```

### 6.1 · Locked Visual Generation Layer scope

- Image generation (from prompt · from reference · from combination)
- Image editing (crop · resize · re-colour · replace-with-preserve-geometry per ADR-0028 Rule 13)
- Transparent assets (PNG with alpha · SVG · vector)
- UI graphics (icons · buttons · containers · backgrounds)
- Product imagery
- Diagrams
- Animations
- Pixel-level assets
- Different resolutions (mobile · tablet · desktop · retina · 4K)
- Aspect ratios
- Variants (light · dark · seasonal · founder-authored)
- Asset versions (immutable per version · new version for each edit)

### 6.2 · Gate 4 acceptance criteria

**Founder-locked identity principle:**

> *"So it isn't: 'NEX made an image.' It becomes: NEX generated Asset #XXXXX → used by Flow #XXX → Version #2 → stored in GB storage → displayed in Section #XXX. That's much more powerful."*

Every generated asset MUST carry a full identity chain:

- `nex_asset_id` (permanent identity)
- `generation_flow_id` (which flow requested it)
- `version_n` (versioned · immutable per version)
- `storage_reference` (GB storage location)
- `display_context` (which section / flow / capability uses it)
- `input_evidence` (what prompt / reference / parameters produced it)
- `validation_status` (Truth-Engine-compatible where applicable · e.g. no fabricated data in generated diagrams)

Integrates with:
- Image manifest per ADR-0024
- CAP-061 Visual Intelligence (Work Map)
- NEX UI Reference Standard (ADR-0316d)

---

## Section 7 · Gate 5 · NEX Studio recovery

**Founder-locked:**

> *"The old NEX Studio material should be treated as existing intellectual property / design infrastructure · not forgotten legacy files."*

### 7.1 · Locked recovery scope

Every Studio asset must be located · inventoried · classified:

- Containers
- Shapes
- Buttons
- UI elements
- Reusable files
- Visual components
- Design tokens (embedded in files · to be extracted)
- Historical experiments

### 7.2 · Locked classification vocabulary

Every recovered asset receives one classification:

| Classification | Meaning |
|---|---|
| **KEEP** | Still useful · architecturally compatible with current NEX · enters Component & Asset Registry unchanged |
| **ADAPT** | Good design/component · needs conversion to current NEX architecture (theme tokens · file format · framework) |
| **REBUILD** | Concept is useful · implementation is obsolete · new implementation authored by NEX1 preserving the concept |
| **ARCHIVE** | Interesting historical material · never enters production · retained for audit / IP preservation |
| **ORPHAN** | No known purpose / reference · investigate before disposal · founder authorises final disposition |

### 7.3 · Gate 5 acceptance criteria

- Every Studio asset classified with exactly one label
- Every KEEP + ADAPT asset receives a NEX Asset ID (integrates with Gate 6 Component & Asset Registry)
- Every REBUILD concept receives an ADR authorising the new implementation
- Every ARCHIVE asset receives a `retained_at` timestamp + `retention_reason`
- Every ORPHAN asset queued for founder decision · never auto-deleted

**Founder-locked non-destruction rule:**

> *"Don't start deleting or migrating the orphaned images yet. First inventory → identify → map → preserve → then clean up."*

Master AI + NEX1 never delete Studio assets at Gate 5. Founder authorises disposition per ORPHAN after review.

---

## Section 8 · Gate 6 · NEX Component & Asset Registry

**Founder-locked structure:**

```
NEX Component Registry

Containers
 ├─ Container A
 ├─ Container B
 └─ Container C

Buttons
 ├─ Primary
 ├─ Secondary
 ├─ Action
 └─ AI Action

Shapes
 ├─ Card
 ├─ Panel
 ├─ Badge
 └─ Section

Visual Assets
 ├─ Generated
 ├─ Uploaded
 ├─ Product
 ├─ Background
 └─ Animation

Templates
 ├─ Profile
 ├─ Product
 ├─ Section
 └─ AI-generated section
```

### 8.1 · Locked registry discipline

- One canonical registry file: `docs/nex-component-and-asset-registry.json` (authored under Gate 6 sub-phase · not by this ADR)
- Every registry entry has: `component_id` · `category` · `subcategory` · `variants[]` · `usage_rules` · `visual_reference` · `code_location` · `test_coverage` · `accessibility_notes`
- Registry is READ-ONLY for Master AI + NEX1 (like Work Map · file-capability-map · locked-doctrines · UI reference library)
- Additions require founder-authored ADR amendment
- Deprecation not deletion (historical audit preserved)

### 8.2 · Gate 6 acceptance criteria

**Founder-locked reuse principle:**

> *"Then NEX1 can reuse the vocabulary rather than reinventing the UI every time."*

Every future NEX1 UI build MUST:

- Consult the Component & Asset Registry BEFORE authoring new components
- Cite `component_id` values in the change request for founder review
- Justify any new component authored (why isn't an existing component sufficient?)
- Additions to the registry follow the founder-ADR-amendment path

### 8.3 · Integration with existing doctrines

- **ADR-0316d NEX UI Reference Standard** — provides the visual DNA · registry provides the reusable component vocabulary within that DNA
- **CAP cards** — the NEX UI STANDARD section on each CAP card links to both the reference library AND the component registry
- **Phase D.3.b theme linter** — enforces registry usage (`sec.component_reuse_violation` when a new component is invented where an existing one fits)

---

## Section 9 · Gate 7 · Lab ↔ Studio ↔ Generation integration

**Founder-locked chain:**

```
NEX Brain
   ↓
NEX Lab           (proposes: "this new section would improve X")
   ↓
NEX Studio        (Component & Asset Registry)
   ↓
Visual Generation (produces new assets when registry insufficient)
   ↓
Production UI     (via section-build lifecycle per ADR-0316b/c)
```

### 9.1 · Locked Lab governance definition (per founder's prior direction)

Before Lab is authorised to propose freely · establish:

- **What the Lab is allowed to propose** — capability additions · UI changes · new sections · experiment ideas
- **What requires founder approval** — every production-touching proposal · no auto-implementation
- **What NEX can automatically implement** — nothing without founder click at Activate Live (per ADR-0316b)
- **Experiment / version control** — every Lab proposal produces a CAP-XXX candidate · revision-versioned per ADR-0316c
- **Rollback** — Emergency Revert authority always at founder click
- **Scoring** — Lab proposals ranked by measurable NEX-growth impact
- **Evidence requirements** — every proposal must cite the gap it closes (Work Map · Knowledge Gap Registry)
- **Duplicate idea detection** — Lab consults Work Map + do-not-repeat register before proposing
- **Relationship between Lab ideas and production roadmap** — Lab is proposal-tier · Work Map is authorisation-tier

### 9.2 · Locked Lab-Studio integration principle

**Founder-locked example:**

> *"The Lab can propose: 'This new section would improve X.' But instead of generating a completely new interface from scratch · it can say: 'Build this section using Container 14 + Button 7 + Card 22 + generated visual Asset 381.'"*

Lab proposals reference existing registry components + only request generation for gaps. Guarantees:

- Visual consistency (recognition test per ADR-0316d passes)
- Reduced generation cost (fewer AI-generated assets)
- Reusable design language (registry compounds over time)
- Faster preview (existing components rendered instantly)

### 9.3 · Gate 7 acceptance criteria

- Lab governance ADR authored (separate sub-phase after Gate 5-6 · doctrine only)
- Lab code paths (existing 26 `scripts/nex-lab-*.mjs`) audited for compliance with Lab governance
- Lab proposals now emit **structured component references** · not free-form design specs
- Integration test: a Lab proposal produces a valid Section-Build lifecycle entry per ADR-0316b/c

---

## Section 10 · Email Marketing integration verification (must pass before NEX1 code-writing)

**Founder-locked acceptance:**

> *"You don't need to finish the entire marketing system before coding continues. But verify..."*

### 10.1 · Locked verification checklist

- ✅ Contacts are genuinely sendable (deliverability confirmed on active contacts)
- ✅ Blocklist works (unsubscribed + bounced + suppression list honoured)
- ✅ Categories work (segmentation applied · not just labelled)
- ✅ Unsubscribe / suppression works (SPAM-Act / GDPR compliant)
- ✅ Templates work (variables interpolate · assets load · fallback text renders)
- ✅ Automatic email triggers are defined (event → email mapping explicit · never implicit)
- ✅ Failed sends / retries are handled (retry with exponential backoff · giveup + log)
- ✅ Email events are recorded (sent · delivered · opened · clicked · bounced · unsubscribed · complained)
- ✅ NEX can tell what email was sent and why (provenance chain preserved · founder auditable)
- ✅ No duplicate automatic emails (idempotency on triggers · dedup at send time)
- ✅ Marketing actions cannot bypass authorization (R-10 gate when live · Guardian at candidate tier)

### 10.2 · Gate acceptance criteria

- All 11 checkboxes pass with evidence (test output · database query · manual verification)
- The 47 sendable contacts across 5 categories (per founder's prior note) validated as still deliverable at gate execution time
- Any failing checkbox blocks NEX1 green light for anything touching Email Marketing capability
- Non-Email-Marketing capabilities may proceed at NEX1 green light independently

---

## Section 11 · Machine-readable inventory schema (locked)

**Founder-locked schema requirement:**

> *"Every discovered asset should eventually have something equivalent to: asset_id · asset_type · storage_location · source · owner_flow · component_type · status · version · used_by · created_by · generation_method · dependencies."*

### 11.1 · Locked asset record shape

```json
{
  "asset_id": "nex_asset_<uuid>",
  "asset_type": "image | video | icon | container | button | shape | template | animation | audio | document",
  "storage_location": {
    "system": "gb_storage | legacy_supabase | file_system | remote_url",
    "path": "..."
  },
  "source": {
    "provenance": "founder_uploaded | founder_generated | nex_generated | user_uploaded | third_party | unknown",
    "original_reference": "..."
  },
  "owner_flow": "CAP-XXX | flow_id | UNKNOWN",
  "component_type": "canonical_reference | registry_entry | production_asset | orphan | recovery_queue",
  "status": "KEEP | ADAPT | REBUILD | ARCHIVE | ORPHAN | LIVE | DEPRECATED",
  "version": "v1.0.0 | v1.N.N",
  "used_by": ["CAP-XXX", "flow_id", "section_id"],
  "created_by": "founder | master_ai | nex1 | user | legacy",
  "created_at": "ISO-8601",
  "generation_method": "uploaded | ai_generated | procedural | photographed | designed",
  "dependencies": ["asset_id_of_parent_or_reference"],
  "audit_notes": "...",
  "founder_decision_pending": true | false
}
```

### 11.2 · Storage of inventory

- Canonical text: this ADR + future Gate-execution ADRs
- Machine-readable: `docs/nex-asset-inventory.json` (authored under Gate 2/3/5 sub-phases · not by this ADR)
- Read-only for Master AI + NEX1 · additions/updates via founder-authored amendment
- Never deleted · deprecation carries `deprecated_at` timestamp

### 11.3 · The four states an asset can occupy

- **Registered** — has a NEX Asset ID · appears in the machine-readable inventory · owner_flow known
- **Recovery Queue** — appears in inventory but owner_flow=UNKNOWN or status=ORPHAN · awaiting founder disposition
- **Adaptation Queue** — status=ADAPT · awaiting NEX1 conversion authored under separate CAP-XXX
- **Archived** — status=ARCHIVE · never enters production but retained for IP/audit

---

## Section 12 · The final NEX1 green-light criteria · six questions (locked)

**Founder-locked six questions** — all must return GREEN before NEX1 receives code-writing green light:

| Question | Green condition |
|---|---|
| **A. Is there anything in the existing architecture that would force a rewrite?** | No · every capability in Work Map v1.1 has a compatible architecture · any incompatibility resolved by founder-authored ADR |
| **B. Is email automation production-safe?** | Yes · all 11 §10.1 checkboxes pass · founder-signed verification |
| **C. Is the Lab's role clearly defined?** | Yes · Lab governance ADR locked (§9.1) · proposals emit structured component references |
| **D. Are the new innovative sections compatible with the existing architecture?** | Yes · every proposed new CAP fits the Acquisition Fabric + 4-way Guardian + Work Map model without exception |
| **E. Does every new component have tests · observability · authorization and rollback?** | Yes · Phase D.3 Security Agent · D.7 test framework · D.8 observability · D.10 rollback via revision history all designed |
| **F. Is the master roadmap updated so the system remains one coherent 100% architecture?** | Yes · Work Map + this ADR + ADR-0316b/c/d + all Phase D sub-phase plans capture the coherent target |

### 12.1 · Green-light discipline

- If any question is RED · NEX1 green light is BLOCKED for the affected area
- Green lights are per-capability · not universal (e.g. Email Marketing can be RED while Truth Engine is GREEN)
- NEX1 may proceed to build the areas that are GREEN · not the areas that are RED
- Founder authorises each green-light transition explicitly

### 12.2 · Anti-freeze principle (locked · founder-authored)

> *"I would NOT tell NEX1: 'Build 100% of everything now.' I'd tell them: 'Build the 100% architecture while delivering the system incrementally.' Every new feature must fit into the architecture rather than creating another isolated mini-system."*

The Build Gate does NOT require the entire NEX vision to be complete. It requires the **foundation that could cause expensive rework** to be locked. Once the six questions are GREEN for a capability's foundation area · NEX1 builds vertically within that capability.

---

## Section 13 · Sequencing discipline (locked · founder-authored)

**Founder-locked order (NEVER skip):**

```
inventory
   ↓
identify
   ↓
map
   ↓
preserve
   ↓
(later) clean up
```

### 13.1 · What each step means

- **Inventory** — every asset · every file · every table · every URL scanned + recorded in the machine-readable inventory
- **Identify** — for each entry: what is this? · who owns it? · what flow uses it?
- **Map** — connect each asset to its capability (CAP-XXX) · flow · component
- **Preserve** — assets remain accessible even when marked ORPHAN or ARCHIVE · no destructive action
- **Clean up** — only after founder authorises · per-asset · never bulk

### 13.2 · The forbidden shortcut

Master AI + NEX1 must NEVER:

- Skip inventory
- Delete unmapped assets ("no reference · so delete")
- Assume "if it's not in the map · it doesn't matter"
- Migrate assets without inventory
- Retire Supabase without founder-authorised migration path

Any shortcut violates the founder's preservation principle and is REJECTED by the Security Agent as `sec.asset_preservation_shortcut`.

---

## Section 14 · Sub-phase plan (each own founder authorisation)

Extension of ADR-0316b §10 sub-phase plan · adds seven Master Audit gates:

| Sub-phase | Deliverable | Substrate impact | Depends on |
|---|---|---|---|
| **D.12 · Gate 1** | Core System audit report (Brain · Truth Engine · Storage · Safety · Streaming · Retrieval · Tests) | doctrine only · reads existing state | ADR-0316e |
| **D.13 · Gate 2** | Current NEX GB Storage inventory (`docs/nex-asset-inventory.json` seed) | reads GB storage · writes JSON inventory | D.12 |
| **D.14 · Gate 3** | Legacy Supabase scan report | reads Supabase · writes report | D.12 |
| **D.15 · Gate 4** | Visual Generation Layer architecture ADR | doctrine only | D.13 · D.14 |
| **D.16 · Gate 5** | NEX Studio recovery + classification | reads Studio files · classifies each · updates inventory | D.13 |
| **D.17 · Gate 6** | Component & Asset Registry (`docs/nex-component-and-asset-registry.json`) | writes registry JSON | D.15 · D.16 |
| **D.18 · Gate 7** | Lab governance ADR + Lab-Studio-Generation integration | doctrine + registry updates | D.17 |
| **D.19 · Email verification** | 11-checkbox verification run | reads email system · produces verification report | independent · can run in parallel |
| **D.20 · Six-question green light** | Founder-authored per-capability green light | ADR authoring | D.12-D.19 |
| **D.21 · NEX1 code-writing begins** | First authorised NEX1 code proposals against green-lit capabilities | code changes via Section-Build lifecycle | D.20 + D.3 + D.4 |

**None of these sub-phases execute until founder authorises each explicitly.**

---

## Section 15 · Preservation of prior architecture (locked)

This ADR does NOT change:

- ADR-0316 through 0316d locked doctrines
- Stage 1a foundation (verifier · rules · Guardian · fixtures · runner)
- Phase B Guardian split
- Phase C Acquisition Fabric target
- Stage 1b Wiring + Founder Decisions (parallel · nex.evidence collision unresolved)
- Work Map v1.1
- File-capability-map v1.0.0
- Locked-doctrines v1.0.0
- NEX UI Reference Standard (ADR-0316d)
- CLAUDE.md UI theme rules
- All 13+ feedback memory principles

### 15.1 · Anti-cascade rule

Authorising D.12-D.18 (Master Audit gates) does NOT authorise:

- Phase D.3 Security Agent implementation (still BLOCKED)
- Stage 1b resumption (still BLOCKED · nex.evidence collision unresolved)
- Any autonomous NEX1 code writing (Phase A observation-only preserved)

Each Phase D sub-phase authorisation is atomic. No cascade.

---

## Section 16 · What this ADR did NOT do

- ❌ No code authored
- ❌ No audit executed
- ❌ No storage scanned
- ❌ No Supabase queried
- ❌ No Studio files touched
- ❌ No Component Registry created
- ❌ No Visual Generation Layer built
- ❌ No email system tested
- ❌ No Lab governance ADR authored
- ❌ No `docs/nex-asset-inventory.json` created
- ❌ No `docs/nex-component-and-asset-registry.json` created
- ❌ No Work Map JSON modification
- ❌ No file-capability-map modification
- ❌ No locked-doctrines modification
- ❌ No Stage 1a foundation modified
- ❌ No Stage 1b resumption
- ❌ No nex.evidence collision resolution
- ❌ No asset deleted · migrated · or reclassified
- ❌ No orphan investigation started
- ❌ No NEX1 green light issued
- ❌ No Phase D.3 authorisation implied

---

## Section 17 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | 7-part NEX Master Audit + Build Gate locked as final prerequisite before NEX1 code-writing green light. Gates: Core System · GB Storage · Legacy Supabase · Visual Generation · Studio Recovery · Component & Asset Registry · Lab-Studio-Generation integration. Plus Email Marketing 11-checkbox verification + Lab governance ADR. Machine-readable asset inventory schema locked (12 fields). Six green-light questions locked (A-F). Sequencing discipline: inventory → identify → map → preserve → clean (never skip). 100%-architecture-incremental-build principle (NEX1 builds vertically within green-lit foundation · never all-or-nothing). Studio classification vocabulary: KEEP · ADAPT · REBUILD · ARCHIVE · ORPHAN. Founder-locked non-destruction: no asset deletion until inventory complete + founder authorisation. Supabase treated as legacy · not fixed. GB storage is NEX production storage. |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0316e · this file · consumed by D.12-D.21 sub-phase ADRs · every future NEX1 green-light authorisation |
| **Effective from** | `nex_master_audit_build_gate.v1.0.0` |
| **Supersedes** | none · extends the Phase D sub-phase plan from D.11 to D.21 |
| **Reason** | Founder verbatim: prevent expensive rework by locking foundation before NEX1 codes · prevent unnecessary re-audits by inventorying what exists first · prevent asset loss by preserving before cleanup · prevent Supabase confusion by scanning it as legacy not core · prevent NEX Studio being forgotten by classifying every asset · prevent visual drift by binding Lab proposals to registry components · prevent NEX1 from freezing waiting for 100% completion by using per-capability green lights · prevent scattered mini-systems by requiring every new feature to fit the coherent 100% architecture. |

---

## Section 18 · Cross-references

**Consumed by (future ADRs):**
- D.12 through D.21 sub-phase ADRs (each own founder authorisation)
- Every future NEX1 green-light authorisation ADR
- Every future Studio-asset disposition ADR (per ORPHAN founder decision)
- Every future Supabase migration ADR (per §5.3 discipline)
- Every future Component & Asset Registry amendment ADR

**Consumes:**
- ADR-0316 HQ Consolidation Target
- ADR-0316a HQ Security Agent Design (4-way Guardian split)
- ADR-0316b Code-Autonomy Readiness + Section-Build Lifecycle
- ADR-0316c Section-Build Revision Model + On-Card Change Requests
- ADR-0316d NEX UI Reference Standard / Visual Design Constitution
- ADR-0314g Acquisition Fabric target architecture
- ADR-0314i Stage 1b Founder Decisions (§9 anti-competing-substrate applies to inventory + registry)
- ADR-0028 NEX Intelligence Constitution · ADR-0029 Image Tagger Directive · ADR-0030 Intelligence Layers · ADR-0033 Quality Over Quantity
- ADR-0024 Image Manifest
- Work Map v1.1
- File-capability-map v1.0.0
- Locked-doctrines v1.0.0
- CLAUDE.md UI theme rules
- Feedback memories: `feedback_nex_ui_reference_standard_visual_dna.md` · `feedback_one_canonical_knowledge_substrate.md` · `feedback_observation_is_not_constitutional_authority.md` · `feedback_calendar_time_is_not_constitutional_authority.md`

**Referenced by future candidate slots:**
- ADR-0316e.1 · Lab governance charter (D.18 sub-phase output)
- ADR-0316e.2 · Visual Generation Layer specification (D.15 sub-phase output)
- ADR-0316e.3 · Studio classification results (D.16 sub-phase output)

---

## Section 19 · Master AI STOPS · Phase D.3 remains BLOCKED · Master Audit gates D.12-D.21 also BLOCKED

**Master AI does NOT autonomously proceed to any sub-phase.** Founder-locked separation of doctrine from implementation.

**Master AI does NOT autonomously resume Stage 1b.** The nex.evidence collision remains parallel unresolved (task #161).

**Master AI does NOT autonomously begin any Gate audit.** Each gate audit requires separate founder authorisation.

**Current position after ADR-0316e:**

- Phase A · Stage 1a · 🟢 COMPLETE
- Phase B · Guardian reconciliation (3-way) · 🟢 LOCKED
- Phase C · Acquisition Fabric · 🟢 LOCKED
- Stage 1b Wiring + Founder Decisions · 🟢 LOCKED · apply halted at nex.evidence collision
- Work Map v1.1 · 🟢 ACTIVE
- Phase D.1 · HQ Consolidation Target · 🟢 LOCKED (ADR-0316)
- Phase D.1 · Security Agent Design (4-way) · 🟢 LOCKED (ADR-0316a)
- Phase D.2 · registries authored · 🟢 SHIPPED
- Phase D.1 · Code-Autonomy + Lifecycle · 🟢 LOCKED (ADR-0316b)
- Phase D.1 · Revision + On-Card + Preview · 🟢 LOCKED (ADR-0316c)
- Phase D.1 · NEX UI Reference Standard · 🟢 LOCKED (ADR-0316d)
- **Phase D.1 · NEX Master Audit + Build Gate + Studio Recovery + Asset Registry · 🟢 LOCKED (this ADR · ADR-0316e)**
- Phase D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11 · D.12 · D.13 · D.14 · D.15 · D.16 · D.17 · D.18 · D.19 · D.20 · D.21 · 🔴 BLOCKED pending own founder authorisation

**Substrate posture:** unchanged · everything frozen · Gate 3 remains OPEN · Stage 1a foundation preserved · nex.evidence collision preserved.

**Founder decision points now open:**

1. Approve ADR-0316e as locked doctrine (this ADR complete)
2. Direct nex.evidence collision resolution (separate track · task #161)
3. Authorise Phase D.3 (Security Agent implementation) — first code-authoring sub-phase
4. Authorise D.12-D.19 Master Audit gates (in any order · each own authorisation)
5. Upload old NEX Studio files / screenshots / URLs for the audit team to structure the inventory
6. Provide additional NEX UI reference URLs (extends ADR-0316d library to v1.1.0)

Master AI does not choose the order. Founder authorises explicitly.

---

**End of ADR-0316e · NEX Master Audit + Build Gate + Studio Recovery + Asset Registry · doctrine locked · every sub-phase implementation remains BLOCKED pending founder authorisation.**
