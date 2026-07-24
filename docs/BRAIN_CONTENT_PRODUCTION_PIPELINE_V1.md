# Brain Content Production Pipeline · V1

**Operational runbook · 2026-07-23**
**Purpose:** the end-to-end walk-through for producing one Trade Brain, from picking the trade to shipping the published Brain. Binds nine existing documents into a single ops process. Not architecture — process.

**Working principle:** every step below already has an authoritative owner document. This runbook does not restate the content of those documents · it names the ACTION, the ROLE, the HANDOFF criterion, and the SLA per step. Read it like a Kanban board, not a spec.

**When this runbook applies:** every V1 Trade Brain produced by Nex. First candidate is Staircase or Electrician (per Author Recruitment Package §2 priority order). Same pipeline runs for Brain #2, #3, ...

---

## The 9 pipeline steps at a glance

```
1. Select Trade
     ↓ (Program Lead pick + CEO signoff)
2. Assign Expert
     ↓ (Recruitment + Contract signature)
3. Capture Knowledge  ·  primary: Author clicks Teach Nex
     ↓ (raw paste → structured candidates)
4. AI Structures Content  ·  Approach C committed · see §12
     ↓
5. Author Review  ·  per-candidate Accept / Reject / Edit
     ↓ (Author-accepted → Draft Brain content)
6. Admin Review  ·  per-candidate Approve / Reject / Request Changes / Merge / Send Back
     ↓ (Admin-approved → eligible for Runtime pack)
7. Publish Brain  ·  TWO gates: Admin per-node AND Panel per-version
     ↓ (both gates pass → Runtime available)
8. Monitor Performance
     ↓ (Field Learning Loop feed)
9. Improve Brain
     ↓ (Version bump → back to step 5 for delta)
```

---

## Step 1 · Select Trade

**Role:** Program Lead + CEO signoff.

**Action:** pick which trade goes next per Recruitment Package §2 priority order. Verify against Master Architecture critical path.

**Handoff criterion:** trade name written into `hammerex_nex_brains` registry as `status: draft` with placeholder Author fields. CEO signs off in a brief memo captured in `docs/DECISIONS/` if the trade deviates from the priority order.

**SLA:** ≤ 1 week from proposal to signoff.

**Authoritative document:** `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md` §2.

---

## Step 2 · Assign Expert

**Role:** Program Lead runs recruitment. Legal Counsel reviews contract. Author signs.

**Actions:**
- Sourcing per Recruitment Package §3 (trade unions, FMB, Federation of Master Builders, colleges, Nex merchant advisory panel referrals)
- 4-stage interview (Application review → Trade authenticity interview → Sample authoring task → Contract negotiation)
- Contract instantiated from `TRADE_BRAIN_AUTHOR_CONTRACT_TEMPLATE_V0.md` · all `«PLACEHOLDER»` fields filled · every 🛑 clause resolved by Legal Counsel
- Author onboarding (Week 1) per Recruitment §7

**Handoff criterion:** signed contract on file · Author account provisioned in Author Tooling · Author has completed onboarding session and passed the schema-training checkpoint.

**SLA:** 4-6 weeks per Author.

**Authoritative documents:** `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md` + `TRADE_BRAIN_AUTHOR_CONTRACT_TEMPLATE_V0.md` + `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md` §Onboarding.

---

## Step 3 · Capture Knowledge · via Extraction (Primary)

**Role:** Author (primary). Program Lead (mentor/checkpoint).

**Action:** Author navigates to `/authors/brains/[slug]/extract` and pastes raw knowledge — notes, transcripts of voice memos, written expertise. This is the primary knowledge-capture surface. The Extraction Pipeline (per §12 below · Approach C committed) turns the raw input into structured candidate items keyed to Brain module schemas.

Manual module editors at `/authors/brains/[slug]/edit` remain available as the **refinement** surface — Author uses them AFTER extraction lands candidates in the drafts, to polish wording, add missing citations, or add facts that didn't emerge from any paste.

**Handoff criterion:** M2 milestone reached — Craft + Regulations modules populated (from either extraction Accept flow or direct authoring) and submitted for review (per Author Contract §2).

**SLA:** ~4-6 weeks of Author elapsed time to reach M2. Extraction Pipeline compresses drafting time significantly for Authors who work naturally from written or spoken notes; direct-authoring remains available for Authors who prefer typing into structured forms.

**Authoritative documents:** `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md` (manual editors) · Extraction Pipeline shipped code at `src/lib/nex/brains/_studio/_extraction/` · UI at `src/apps/author-studio/components/extract/`.

---

## Step 4 · AI Structures Content · APPROACH C COMMITTED (Interview mode)

**Status:** RESOLVED as of 2026-07-23. Approach C (Interview mode) has been implemented and is the primary Step 3 workflow — this step and Step 3 are now unified. Approach A (Author-drafts-first via manual editors) remains available as the refinement path.

**Role:** Author (writes raw knowledge). Extraction Pipeline (produces candidates). Author (Accepts / Rejects / Edits each candidate).

**Action:** Author pastes raw input into `/authors/brains/[slug]/extract`. LLM (Anthropic Opus-4-7 via existing `@/lib/llm/anthropic`) produces candidates keyed to Brain module schemas. Every candidate carries either a verbatim `source_span` from the input or is flagged `needs_author_source: true`. Author reviews per-candidate and Accepts (merges to draft), Rejects (archived with reason), or Edits (adds citation, then Accepts).

**Zero-fabrication guarantee** enforced at multiple layers:
- Prompt hard-refuses invented citations
- Post-processing sets `needs_author_source: true` when `source_span` is null even if LLM claimed otherwise
- Confirm endpoint refuses Accept for `needs_author_source: true` candidates unless Author supplies citation via Edit
- Merge refuses non-Accepted status
- Every candidate carries immutable provenance (llm_model · proposed_at · prompt_version · input_hash)

**Handoff criterion:** Author has processed one extraction run to completion (every candidate has an accept / reject / edit decision). Accepted candidates have merged into the corresponding module draft.

**SLA:** ~30-60 minutes per extraction run for a typical 500-2000 word paste. Extraction can be run repeatedly with different pastes as Author works through different subjects.

**Authoritative implementation:** `src/lib/nex/brains/_studio/_extraction/` (backend) + `src/app/api/authors/brains/[slug]/extract/*` (API) + `src/apps/author-studio/components/extract/*` (UI).

---

## Step 5 · Expert Review

**Role:** Author reviews their own draft against ADR-0017 §3 schema requirements (evidence + confidence per fact · applies_when + then + escalate_if per rule · steps + checkpoints per playbook). Author submits.

**Action:** author-signed submission through the Tooling · module status flips `draft` → `author_review`.

**Handoff criterion:** Author confirms in Tooling that the module meets the 6-question quality checklist (evidence cited · confidence set · regional scope stated · no fabrication · no regulated determination made · Author's real name attached).

**SLA:** ≤ 1 week per module for review + submission after content is drafted.

**Authoritative document:** ADR-0017 §3-§4 + `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md`.

---

## Step 6 · Validation Tests

**Role:** Nex CI (structural) + Merchant Advisory Panel (real-world utility).

**Action A — Structural CI:**
- Zod schemas per module validate on every write to Tooling.
- 100-scenario test suite (`src/lib/nex/brains/<slug>/__tests__/scenarios/`) runs against Brain content once Author has filled in `expected_answer` per scenario.
- Substrate boot audit refuses to load a Brain missing any V1 module.

**Action B — Merchant Advisory Panel Halfway Review:**
- At M2 milestone (Craft + Regulations submitted), Panel reviews per Charter §4 Meeting 1.
- Feedback captured; Author has 2 weeks to incorporate.

**Handoff criterion:** all 100 scenarios have Author-provided expected answers · CI green · Halfway Review outcome recorded.

**SLA:** Halfway Review ≤ 1 week from M2 submission.

**Authoritative documents:** `ES-05_TESTING_AND_AI_EVALUATION_V1.md` + `MERCHANT_ADVISORY_PANEL_CHARTER_V1.md` §4.

---

## Step 7 · Publish Brain · TWO gates (Admin per-node + Panel per-version)

Publishing has TWO independent gates. Both must pass. Neither publishes automatically.

### Step 7a · Administrator per-node review (continuous)

**Role:** Brain Administrator (Nex platform-side reviewer).

**Action:** Admin sits at `/admin-brains/queue?brain_slug=<slug>` and reviews every Author-accepted candidate individually. Available actions per candidate:
- **Approve** — candidate eligible for the published Runtime pack
- **Reject** — candidate never reaches Runtime · reason required
- **Request changes** — candidate returns to Author for revision · reason required
- **Merge with existing** — candidate combined with an existing published Knowledge Node · original archived
- **Send back to Author** — Author needs to do more work on this one

Every action appends an immutable `CandidateReviewEvent` to the candidate's `review_history` array. Actor + action + timestamp + reason + Brain version at review time are all captured. This is the audit trail that supports "every published node must be fully auditable and reversible."

**Admin publish gate:** the pack exporter refuses `published` mode as long as ANY Author-accepted candidate is still `unreviewed`, `sent_back`, or `changes_requested`. Every candidate must be Admin-Approved, Admin-Rejected, or Admin-Merged before the published pack can build.

**Authoritative implementation:** `src/lib/nex/brains/_admin/` (session) + `src/app/api/brain-admin/*` (API) + `src/app/admin-brains/*` (UI) + `_pack_exporter.ts` publish gate.

### Step 7b · Merchant Advisory Panel per-version review (milestone)

**Role:** Merchant Advisory Panel votes per `MERCHANT_ADVISORY_PANEL_CHARTER_V1.md` §5.

**Action:** at M5 (per Author Contract §2), Panel reviews the composed Brain — the Author-drafted + Admin-approved content in aggregate — and votes `approve_publish` / `approve_with_amendments` / `defer` / `reject`.

**Panel publish gate:** even if every candidate is Admin-approved, the Brain does not go to merchants until the Panel's Signoff Review vote passes.

**Authoritative document:** `MERCHANT_ADVISORY_PANEL_CHARTER_V1.md` §5.

### Combined handoff criterion

- Every candidate has a terminal Admin decision (approved / rejected / merged)
- Panel has voted `approve_publish` at Signoff Review
- Program Lead flips manifest status `advisory_panel` → `published` in `hammerex_nex_brains`
- Author paid M5 milestone
- Attribution surface publishes with Author name + credentials + Panel signoff line

**Reversibility:** the `review_history` array supports rollback. If a published Knowledge Node is later shown to be incorrect, Admin adds a `reject` event that supersedes the previous `approve`, causing subsequent pack exports to omit it.

**SLA:** Admin queue is continuous throughout Author authoring (Steps 3-6). Panel Signoff ≤ 1 week from Author submission at M5.

---

## Step 8 · Monitor Performance

**Role:** Nex platform (automatic) + Author (quarterly review).

**Action:**
- `/api/brain/learn` writes prediction-vs-actual rows to `hammerex_nex_brain_field_outcomes` per merchant use with consent per ADR-0016
- Weekly rollup cron aggregates deltas into `hammerex_nex_brain_learning_signals` with K-anonymity gate applied
- Quarterly Author review: Author receives the aggregated signals pack per Author Contract §5 and ADR-0017 §8

**Handoff criterion (per cycle):** quarterly review meeting held with Author · outcome recorded in `hammerex_nex_brain_learning_signals.author_action`.

**SLA:** quarterly, 90-day cycles.

**Authoritative documents:** ADR-0017 §8 + `NEX_BRAIN_PLATFORM_AND_ENGINE_V1.md` Gap 4 confidence math.

---

## Step 9 · Improve Brain

**Role:** Author (edits). Program Lead + Panel (approve at threshold).

**Action:** Author-approved amendments emerging from either merchant corrections (per ADR-0017 §5) or Learning Loop signals (per §8) become a Brain version bump. Semver applied. `change_kind` set to `correction_accepted`, `learning_loop`, or `regulation_update` per `hammerex_nex_brain_versions`.

Minor amendments (patch versions) ship without a new Panel review. Major amendments (minor version bump or above) trigger a Panel expedited review.

**Handoff criterion:** new Brain version published · `hammerex_nex_brain_versions` row inserted · Author attribution preserved on original content · learning-loop amendments credited as "field-informed update reviewed by `«AUTHOR NAME»`".

**SLA:** patch versions ≤ 2 weeks · minor versions ≤ 4 weeks · major versions treated as V1.next per full pipeline.

**Then loop back to Step 5** for the next iteration.

**Authoritative documents:** ADR-0017 §5 + §6 + §8.

---

## Cross-cutting: what does NOT belong in this pipeline

- **New architecture** — this pipeline runs against the substrate + ADRs + phases already shipped. If a step exposes a new architectural need, that need becomes a new ADR draft in `docs/DECISIONS/` before the pipeline continues.
- **New tables or migrations** — held in `pending-migrations/` per Approval Package until Gate 4 of `PHASE_0_UNLOCK_CONDITIONS_V1.md` closes.
- **Non-Author sources of Brain content** — Brain content comes from the named Author. Merchant corrections + Learning Loop signals are Author-reviewed inputs, not independent content sources. Manufacturer/supplier data is a separate Product Knowledge domain per ADR-0021 §5 categories — it does not enter Trade Brains.

---

## Handoff between pipelines (running multiple Brains in parallel)

Once first Author has walked Steps 1-7, second Author can start Step 1 in parallel while first Author enters the Monitor / Improve loop (Steps 8-9).

**Bottleneck to watch:**
- Advisory Panel meeting slots — Panel can support ~3-4 concurrent V1 Brains at Author authoring stage before Halfway/Signoff Reviews start blocking each other.
- Program Lead attention — realistic cap ~4 concurrent Author engagements.
- Nex CI + Author Tooling — scale with additional Brains without bottleneck.

Beyond 4 concurrent V1 Brains, add a second Program Lead or split the pipeline into Trade Groups (e.g. Regulated Trades vs Craft Trades) with separate Panels. Deferred until it becomes a real problem.

---

## §12 · AI-Structuring · APPROACH C COMMITTED (2026-07-23)

**Question (originally posed):** at Step 4, does Nex use AI to help the Author turn raw knowledge (audio, sketches, PDFs, whiteboarded processes) into structured module content, or does the Author write directly into the structured Tooling from scratch?

**Resolution (2026-07-23):** Approach C (Interview mode) is committed and implemented. Approach A (Author-drafts-first via manual editors) remains as the refinement surface. Approach B (AI-drafts-first without per-item Author confirmation) is explicitly rejected — incompatible with ADR-0020 zero fabrication.

The three original candidates are preserved below for the historical record and to make the reasoning traceable. The Approach C implementation is shipped code at `src/lib/nex/brains/_studio/_extraction/`.

### Approach A · Author-drafts-first (current default assumption)

Author writes directly into structured Tooling editors. No AI-structuring. Zero fabrication risk. Slowest end-to-end. Highest cognitive load on Author. Assumes Author is comfortable with structured editing GUIs.

**Fit:** matches current Author Tooling Spec + ADR-0017 §4 Author authority. Ship-ready today.

**Weakness:** slow. Author friction may push Author-facing quality down (Authors avoid the tedious sections).

### Approach B · AI-drafts-first

Author dumps unstructured knowledge (voice notes, PDFs of their own training material, sketched diagrams). Nex LLM produces a structured module draft. Author reviews and edits. Fastest to first draft. Highest fabrication risk — LLM may invent citations or plausible-sounding rules that were not in Author's input.

**Fit:** matches Nex's model-agnostic architecture (ES-01 §7). Would need new Author Tooling flow for upload → LLM draft.

**Weakness:** violates evidence-or-silence rule if LLM invents citations. Requires strong provenance tracking to detect LLM-inserted content vs Author-approved content. Risk profile is higher than Nex has accepted anywhere else in the platform.

### Approach C · Interview mode

Nex-facilitated conversational session with Author (voice or chat). LLM asks structured questions ("For staircase installation on Victorian properties, what's the typical duration deviation and what causes it?"). Author answers naturally. LLM extracts candidate structured facts, presenting each to Author for confirmation before it lands in the Brain. Slowest per fact, highest fidelity to Author intent.

**Fit:** matches ADR-0017 §4 Author authority + evidence-or-silence + ADR-0020 zero fabrication. Author never signs off on content they did not actually author. Preserves attribution integrity.

**Weakness:** slowest of the three. Requires substantial Interview Mode tooling that doesn't exist yet.

### Committed decision (2026-07-23)

**Approach C · Interview mode · IMPLEMENTED AND COMMITTED as the primary Step 3-4 workflow.**

Why C wins:
- Preserves ADR-0017 §4 Author authority (nothing enters Brain without Author Accept)
- Preserves ADR-0020 zero fabrication (LLM cannot invent citations · Accept refused for candidates without verifiable source)
- Preserves evidence-or-silence (every accepted candidate carries either a source_span from Author input or an Author-supplied citation)
- Matches Nex's model-agnostic architecture (uses existing `@/lib/llm/anthropic`)
- Compresses Author drafting time significantly for Authors who work from written or spoken notes
- Approach A (manual editors) remains as the refinement surface after extraction

Why B rejected:
- AI-drafts-first without per-item Author confirmation breaks the evidence chain
- Fabrication risk is unacceptable given Diamond Standard + zero fabrication rule
- Cannot be safely mitigated by post-review because merchants would see AI-generated content the moment Author signs off in bulk

Why A retained as refinement (not primary):
- Author must be able to add facts that didn't emerge from any paste
- Author must be able to polish wording after extraction candidates land
- Author must be able to author directly when working from scratch on a new subject
- BUT expecting Author to type every fact into structured forms is a friction wall

**Formalisation:** an ADR-0022 (Brain Content Capture Method) can be drafted at CTO discretion to codify Approach C at ADR level. Not urgent — the pipeline is implemented and running.

**Nothing in Step 3 or Step 4 blocks any further step. This section is retained as an architectural decision record only.**

---

## Pipeline metrics baseline (Gate 7 sub-checkbox)

The following metrics should be captured once first Author walks the pipeline end-to-end. They become the yardstick for Brain #2 and beyond.

- **Elapsed time per step** (Step 1 through Step 7)
- **Author hours per module** (Craft · Regulations · Materials · Workflow · Defects · Pricing Model)
- **Correction count in first 30 days post-publish** (merchant-submitted per ADR-0017 §5)
- **First Learning Loop signal count in first 90 days** (per ADR-0017 §8)
- **Advisory Panel meeting count + hours consumed**

**Where captured:** `docs/BRAIN_PIPELINE_METRICS_BASELINE.md` — a small file created after first Brain publishes. This runbook does not create that file preemptively.

---

## Cross-references

- `PHASE_0_UNLOCK_CONDITIONS_V1.md` Gate 7 (this pipeline is Gate 7's operational reality)
- `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md` (Step 1 + 2)
- `TRADE_BRAIN_AUTHOR_CONTRACT_TEMPLATE_V0.md` (Step 2)
- `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md` (Step 3 + 4 + 5)
- `MERCHANT_ADVISORY_PANEL_CHARTER_V1.md` (Step 6 + 7 + 9)
- `ES-05_TESTING_AND_AI_EVALUATION_V1.md` (Step 6)
- ADR-0017 §5 §6 §8 (Step 5 + 8 + 9)
- `NEX_BRAIN_PLATFORM_AND_ENGINE_V1.md` Part 5 (bigger-picture milestone context)

---

**End of Brain Content Production Pipeline V1.**
