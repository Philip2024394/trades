# NEX_BRAIN_REFERENCE_BUILD_REPORT_V1

**Date:** 2026-07-28
**Author:** Chief Reference Brain Engineer
**Scope:** Staircase Reference Brain preparation layer · post 7-agent knowledge expansion deployment
**Governance:** All outputs are PREPARATION INFRASTRUCTURE only. Zero content has entered the Reference Brain. Content only enters after: named expert authors → sources attached → review → admin approval → version created.

---

## 1 · Current knowledge coverage

Measured across the 66 topics in the V1 Master Knowledge Map (Levels 1-4). Source: `knowledge_gap_matrix.json`.

| Status | Count | % |
|---|---:|---:|
| Captured (has authored content) | 15 | 23% |
| Partial (touched but incomplete) | 16 | 24% |
| Absent (no captured content) | 35 | 53% |
| **Weighted coverage** | | **~24%** |

By level:

| Level | Captured | Partial | Absent | Notes |
|---|---:|---:|---:|---|
| Level 1 (Foundation · 68 sub-topics) | Materials + Construction strongest | Regulations partial (Doc K only) | 10/10 Installation contexts absent · 9/11 Construction variants absent | Terminology 5% (implicit only) |
| Level 2 (Professional) | none strong | Estimating blocked by no-prices | Fault-finding, Repairs, Maintenance absent | |
| Level 3 (Expert) | none | Timber science partial (locked American White Oak values) | Historic, Structural, Commercial, Manufacturing business all absent | |
| Level 4 (Reference) | none | none | All 5 libraries near-zero | Case, Mistake, Decision, Manufacturer, Regulation-history all await construction |

## 2 · Verified sources found

25 UK-focused authoritative sources catalogued (source: `source_catalogue.json`).

- **Verified via WebSearch (5):** Approved Document K · BS 5395-1 · BWF Stair Scheme Design Guides 1 & 2 · Scottish Technical Handbook (April 2026 edition) · TRADA
- **Requires manual verification (20):** all URLs left `null` when not confidently known; entries retained because the source is a widely-recognised trade reference but not machine-verified in this pass
- **Coverage by relevance area:** 5 England Approved Docs (K/B-V1/B-V2/M/E) · 3 devolved-nation regs (Scotland/NI/Republic of Ireland) · 5 British Standards (BS 5395-1/-2/-3, BS EN 14076, BS 585-1) · 2 TRADA · 2 BWF · 3 heritage (Historic England, HES, SPAB) · 2 training (City & Guilds, NVQ) · 2 datasheet categories (EN 204 adhesives, EN 14592 fixings) · 1 HSE
- **Notable caveat:** BM TRADA publishing arm closed 2024-12-31 — back catalogue remains accessible but new publications routed elsewhere

## 3 · Knowledge gaps

- **35 topics absent** → require net-new authoring by a certified expert
- **16 topics partial** → require completion + expert review
- **Total topics needing expert work: 51 of 66 (77%)**

Top gap clusters (from gap matrix):
1. All 10 Installation contexts absent
2. 9 of 11 Construction variants absent (cut/mono/steel/glass/floating/curved/spiral/helical)
3. All 5 Level-4 libraries near-zero (case, mistake, decision, manufacturer, regulation-history)
4. Level 3 structural engineering fully absent
5. Level 2 estimating **blocked** by no-prices HARD LAW (needs Philip's directive to unblock via methodology-only reframe)

## 4 · Topics requiring expert authors

**All 66 topics** ultimately require named-expert approval per Rule B (no AI-authored trade knowledge). Of these:

- **51 need net-new authoring** (35 absent + 16 partial)
- **15 need expert review/certification only** (captured content already exists via Philip's briefings; needs expert re-approval trace under Rule C)

Expert types required (rough allocation from gap matrix):
- **Certified UK joiner** — terminology, most construction, installation, fault-finding, repairs, maintenance
- **Certified staircase manufacturer** — manufacturing processes, factory QA, packing, transport, business workflow
- **Named regulatory authority** — regulations across 6 jurisdictions, listed-building rules
- **Named timber scientist** — Level 3 timber science (movement, humidity, glue chemistry)
- **Named structural engineer** — Level 3 structural (loads, deflection, connections, steel calcs)
- **Named heritage joiner** — historic staircase construction across periods

## 5 · Test corpus expansion count

- **v0.1:** 45 seed questions (9 mixed-difficulty categories)
- **v0.2:** 245 questions (all v0.1 preserved as "Legacy Seed" block · +100 Level 1 · +100 Level 2)
- **Deferred to next batch:** Level 3 (Specialist) and Level 4 (Mastery) — scope hints filed in the corpus for future expansion
- **Distribution v0.2:** Terminology 30 · Materials 25 · Construction 25 · Manufacturing 20 · Regulations 25 · Installation 20 · Fault-finding 25 · Repairs 15 · Estimating methodology 15 (no £ figures) · Legacy Seed 45
- **Quality gate:** every question is open-form, embeds no fabricated premises, includes at least one peer-level ("joiner-to-joiner") question per topic

## 6 · Terminology issues

34 findings across 6 categories (source: `terminology_audit.json`). No findings resolved — every finding carries 3-4 resolution options for an expert to choose from, with `expert_decision_required: true`.

| Category | Count |
|---|---:|
| Duplicate terms | 10 |
| Inconsistent naming | 10 |
| Ambiguity | 6 |
| Conflicting terminology | 5 |
| Regional variation | 2 |
| Undefined terms | 1 |

**Top 5 highest-impact terminology decisions awaiting expert:**

1. **string vs stringer** — schema-level drift affecting every downstream doc
2. **baluster vs spindle** — country rule contradicts UK canonical usage; retrieval code indexes both plus "banister" for the same object
3. **step vs tread** — used interchangeably in construction memories; boundary never captured
4. **closed string vs housed string** — canonical construction type is "housed string" but catalogue names it "closed string"; retrieval keyword lists index one but not the other
5. **mortice / tenon / haunched / housing / dado** — load-bearing terms used everywhere but terminology module marked `not_yet_authored`

## 7 · Contradictions requiring resolution

38 findings (source: `contradiction_report.json`). No resolutions attempted — every finding cites exact conflicting quotes with file:line references.

| Type | Count | Severity mix |
|---|---:|---|
| Conflicting statement | 22 | 4 high · 15 medium · 3 low |
| Missing citation | 10 | 1 high · 6 medium · 3 low |
| Unclear ownership | 4 | 0 high · 3 medium · 1 low |
| Outdated info | 2 | 1 high · 0 medium · 1 low |

**Highest-severity issues (safety-critical, must resolve before any regulations content publishes):**

1. **con-001** — Doc K balustrade sphere rule captured as both 90mm and 100mm across sources
2. **con-002** — Doc K minimum stair width: two accounts (600mm permitted vs "no legal minimum since 2010")
3. **con-003** — Approved Doc K amendment years captured three different ways (2015 · 2020 · none)
4. **con-010** — Handrail height "at least 900mm" in one source, "900-1000mm range" in another; all Doc K clause references marked TBC
5. **con-022** — Five safety-critical Doc K values in the plan-sizes JSON carried with `"clause": "TBC"` — verification note admits Doc K PDF wasn't machine-readable and one commercial third-party source was cited (violating the memory rule against commercial-web citations for regulatory facts)

**Pattern observed:** All 5 highest-severity items cluster around Doc K numeric values that were captured as fact somewhere without ever being read against Doc K's exact clause text. **This entire cluster must be resolved before publishing any Regulations module.**

## 8 · Recommended Phase 2 authoring order

Ordered by trust-multiplier per the four filters (Prime Sentence · Five-Filter Rule · Trust Question · Five Qualities · Professional Test). Cross-referenced against the authoring backlog v0.1.

### Wave 1 — foundational unblockers (do in order)

1. **Terminology module** — 20 core terms. Small effort, every other module cites it, unlocks explainability everywhere. Certified joiner authors. Resolves 5+ terminology audit findings by decision.
2. **Doc K regulatory reconciliation** — resolve con-001, 002, 003, 010, 022 by reading Approved Doc K's exact clauses. Certified expert or regulatory authority MUST do this before any regulations content ships. Unlocks Wave 3.
3. **Fault-finding module** — 6 primary failure modes (tread split · wedge failure · squeaks · riser detachment · newel movement · finish cracking). Certified joiner authors. Unlocks the installer/repair audience — highest peer-recommendation impact.

### Wave 2 — coverage expansion (parallel with Wave 1)

4. **Materials humidity + behaviour** — species-level movement + finish compatibility. Timber scientist authors. Unlocks Timber Movement adversarial category (25 questions ready to test against).
5. **Construction cut-string + curved wreath + winders** — closes 3 major construction-variant gaps. Certified joiner authors.
6. **Installation site-sequence + snag handling** — unlocks Site Problems adversarial category (25 questions ready). Certified installer authors.

### Wave 3 — completeness push (after Wave 1 unlocks it)

7. **Regulations Doc B / M / E intersections + devolved jurisdictions** — after Wave 1 item 2 resolves the Doc K citation problem. Regulatory authority authors.
8. **Historic construction + listed-building rules** — expands to heritage audience. Heritage joiner authors.
9. **Design traditional-property guidance** — corrects contemporary bias in captured design system prompt.

### Wave 4 — professional-workflow depth

10. **Maintenance re-oil/re-lacquer schedules** — highest-frequency post-install question. Certified joiner + finish specialist.
11. **Safety module** — dust management, tool safety, finish cure. Certified joiner.
12. **Estimating methodology reframe** — requires **Philip's directive** to unblock the no-prices HARD LAW; content shape is "methodology, complexity multipliers, cost drivers" not figures.

### Wave 5 — advanced modules

13. **Manufacturing tolerances** — makers rate other makers on tolerances more than any single output. Staircase manufacturer authors.
14. **Structural engineering module** — loads, deflection, connections. Structural engineer authors.
15. **Tools site-first list** — installer-facing. Certified installer.

### Level 4 libraries (continuous — never a single wave)

16. **Real case library** — grows one case at a time via expert interviews using `interview_template.md`
17. **Mistake library** — grows from field observations
18. **Decision library** — grows from documented judgment calls

---

## Files delivered (preparation layer only · zero brain content)

All under `data/nex-reference-brains/staircase-preparation/`:

| File | Purpose | Size |
|---|---|---|
| `source_catalogue.json` | 25 UK sources cited by an expert | 354 lines |
| `knowledge_gap_matrix.json` | 66-topic gap scoring | 159 lines |
| `expert_review_checklists.json` | 680 yes/no completeness questions (Level 1) | 1098 lines |
| `terminology_audit.json` | 34 terminology findings | 812 lines |
| `contradiction_report.json` | 38 contradiction/citation findings | 720 lines |
| `expert_author_pipeline/interview_template.md` | Expert interview script | 192 lines |
| `expert_author_pipeline/module_author_template.md` | Module structure standard | 152 lines |
| `expert_author_pipeline/citation_requirements.md` | Rule C origin format | 213 lines |
| `expert_author_pipeline/approval_workflow.md` | End-to-end publish workflow | 201 lines |
| `expert_author_pipeline/version_control_guidance.md` | Semver decision rules | 119 lines |
| `expert_author_pipeline/three_rule_author_reminder.md` | 1-page identity reminder for authors | 63 lines |
| `docs/brains/staircase-adversarial-corpus.md` (updated) | v0.2 test harness · 245 questions | 349 lines |

## Next batch (deferred to future runs)

- Expert review checklists for Level 2, 3, 4 topics (~200 more topics × 10 questions)
- Adversarial corpus Level 3 & 4 expansion (~250 more questions)
- Source catalogue international expansion (Australian NCC · US IRC/IBC · Canadian NBC)
- Manual verification pass for the 20 sources marked `requires_manual_verification`

## Governance confirmation (repeated for the record)

The output of these agents does NOT enter the NEX Reference Brain.

The output is preparation infrastructure that certified experts use to:
- Know which sources to cite (source catalogue)
- Know what to author (gap matrix + authoring backlog)
- Know how to check their own work (review checklists)
- Know what to test their brain against (adversarial corpus)
- Know how to resolve terminology conflicts (terminology audit)
- Know which contradictions must be reconciled (contradiction report)
- Know how to author correctly (expert author pipeline templates)

Content enters the Reference Brain only after:
1. Named expert authors content using `module_author_template.md`
2. Sources attached per `citation_requirements.md`
3. Independent reviewer approves per `approval_workflow.md` (separation of duties — Finding F6 fix required in code)
4. Admin publishes an immutable version
5. Rule C origin trace populated

**The Chief Reference Brain Engineer role has produced the workspace. The next move belongs to certified experts.**
