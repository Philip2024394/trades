---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-31
type: apprenticeship_lesson_template
status: layer_1_evidence_authoring_template
intended_use: canonical authoring template · each future NEX image / drawing / specification / question is curated into an apprenticeship lesson using this shape · one lesson per artefact · hand-authored under Rule B · never auto-generated
rule_a_compliance: template enforces separation of OBSERVATION · IDENTIFICATION · RELATIONSHIP · UNDERSTANDING · CANNOT-KNOW · every section names its own honest register
rule_b_compliance: authored template by named expert · not AI-authored · Claude may draft lesson content on Philip's explicit request per lesson · Claude may never independently populate the template
rule_c_compliance: every completed lesson traceable to the named expert who authored it
rule_new_compliance: NO ENTRY UNCONFIRMED · every section requires evidence · silent-skip banned
template_version: v1.2
version_history:
  v1.0:
    date: 2026-07-31
    change: initial template authored by Philip after Gatekeeper refused runtime image-learning build
  v1.1:
    date: 2026-07-31
    change: added TEMPTATION-FLAGGING discipline to Section 6 (WHAT CAN I NOT KNOW?) · earned through USE from Lesson 004 review · per Philip's principle "Reality may reveal improvements through use"
    approved_by: Philip O'Farrell
    approval_context: "Lesson 004 four-test-gate review · Gate 2 verdict: PASS + TEMPLATE REFINEMENT APPROVED"
  v1.2:
    date: 2026-07-31
    change: added IMAGE PROVENANCE WORKFLOW GATE · lesson status cannot advance to layer_1_evidence until image is registered in the canonical manifest · earned through USE from ADR-0024 audit
    approved_by: Philip O'Farrell
    approval_context: "post-audit Decision 2 · 'The lesson and the image are one evidence unit'"
    scope_constraint: "staircase-only per Philip 2026-07-31 · no swimming pools · no timber sheds · only staircase and stairparts"
    grandfather_status: "Lessons 001-004 authored BEFORE v1.2 · currently reference unregistered ImageKit URLs · disposition pending Philip's decision (grandfather · retroactive backfill · or halt promotion)"
constitutional_principles_enforced:
  - Image Understanding Principle (three-tier truthfulness · I CANNOT KNOW · I MAY UNDERSTAND · I KNOW · I OBSERVE ABSENT)
  - Layer Voice Discipline (each section speaks in its own honest register · never claims beyond its layer)
  - Rule A (anti-fabrication)
  - Rule B (authored by named expert · not AI-invented)
  - Relationship Principle (APPEARS IN · NORMALLY BESIDE · NEVER BESIDE · authored counts)
  - Absence-is-Information (WHAT CAN I NOT KNOW is first-class content)
  - Stopping Principle (TEACH ends with STOP)
  - Understanding Principle (understand before teaching)
  - Forgetting-refined-to-Relevance (prioritisation happens at teaching time · not in the record)
  - TEMPTATION-FLAGGING (v1.1 · Section 6 · name the temptation before refusing it · Philip 2026-07-31)
  - IMAGE PROVENANCE WORKFLOW GATE (v1.2 · frontmatter block · lesson status cannot advance until image is registered in canonical manifest · Philip 2026-07-31)
  - Staircase-only scope (v1.2 · Philip 2026-07-31 · staircase-and-stairparts only · no swimming pools · no timber sheds · no other domains)
domain_agnostic: true
  # per Philip 2026-07-31 preservation: "there is no such thing as a Staircase Apprenticeship Lesson · only Apprenticeship Lesson"
  # this template applies to any future domain (Architecture · Medicine · Cars · Music · Cooking · Engineering)
  # the subject matter of the LESSON changes · the TEMPLATE does not
what_this_template_is_not:
  - "NOT a runtime pipeline"
  - "NOT auto-populated by algorithm"
  - "NOT a JSON schema for indexing"
  - "NOT a Learning Engine (banned by Master Constitutional Prompt v1.0)"
  - "NOT a Vision runtime capability"
  - "NOT a fact list"
  - "NOT an image catalogue entry"
  - "NOT a substitute for the reference image itself (the artefact remains separate)"
gatekeeper_provenance: |
  Authorisation trail for this template file:
  · Philip 2026-07-31 asked Claude to "confirm to build" the ultimate image vision system.
  · Claude (Gatekeeper) refused the runtime build (Master Constitutional Prompt v1.0 · Author-Driven Rule · Four-Stage Growth Model · Image Understanding Principle · Constitutional Immunity from Creators).
  · Philip re-framed the ask as an AUTHORING TEMPLATE (not a runtime pipeline) and confirmed "That is the foundation Claude should engineer."
  · Template shape authored verbatim by Philip in the same turn.
  · Claude wrote this file · Rule B compliant (drafting on explicit request · not inventing trade content).
---

# Apprenticeship Lesson Template

*Every future NEX apprenticeship lesson — image · drawing · specification · question · future modality — is curated by copying this template and hand-authoring each section. One lesson per artefact. No auto-population. No algorithmic extraction. Every section names both its question and the honest register in which it may speak.*

*The image (or other artefact) is the experience. This lesson is the learning. NEX memory stores the completed lessons — the relationships they contain — never the artefact itself.*

---

## Frontmatter (copy this block into every lesson)

```yaml
---
author: [named expert]
role: [expert role]
captured_at: [YYYY-MM-DD]
type: apprenticeship_lesson
lesson_number: [NNN]
subject_domain: [e.g. staircase · door · window · future domain]
subject: [short subject label · e.g. "enclosed straight flight with half wall"]
artefact_type: [image · drawing · specification · question · text · pdf · video · data]
artefact_reference: [URL · path · citation · never fetched by Claude · always source-of-truth]
# ── Image Provenance Workflow Gate (v1.2 · required before status advances to layer_1_evidence) ──
image_provenance:
  image_source_identified: [true/false + one-line source statement]
  image_registered_in_canonical_manifest: [true/false · file path to manifest OR Supabase table reference]
  manifest_id: [the manifest key / row id / URL used as the primary key in the canonical manifest]
  image_relationship_preserved: [one-line note on how the lesson↔image relationship is recorded]
  evidence_status_assigned: [layer_1 · layer_2 · draft · deferred]
  staircase_scope_verified: [true/false · Philip 2026-07-31 scope constraint: staircase-and-stairparts only]
# ── End Image Provenance Workflow Gate ──
status: layer_1_evidence
rule_a_compliance: [statement of anti-fabrication compliance]
rule_b_compliance: [statement of named-expert authorship]
rule_c_compliance: [statement of traceability]
---
```

## Image Provenance Workflow Gate (v1.2 · Philip 2026-07-31)

**The lesson and the image are ONE evidence unit** (Philip's Decision 2 · post-audit).

**BEFORE LESSON STATUS CAN ADVANCE from `draft_pending_expert_confirmation` to `layer_1_evidence`:**

- [ ] Image source identified (ImageKit URL · Supabase asset · local file path · other)
- [ ] Image registered in canonical manifest (`data/nex-image-manifest.json` OR authoritative Supabase table)
- [ ] Manifest ID (URL key · row id · asset id) recorded in this lesson's `image_provenance.manifest_id` field
- [ ] Image-to-lesson relationship preserved (both the lesson references the image AND the manifest record references or is discoverable by this lesson)
- [ ] Evidence status assigned in the manifest record
- [ ] Staircase-only scope verified (Philip 2026-07-31: *"we require only staircase images and stairparts · not swimming pools · not timber sheds"*)

**The Evidence Package model (Philip verbatim · post-audit):**

```
Lesson
   |
Evidence Package
   |
 ┌──────────────┐
 │ Text         │
 │ Image        │
 │ Provenance   │
 │ Relationships│
 └──────────────┘
```

**Rationale (Philip verbatim):** *"A less disciplined system would say: 'We processed 981 images, therefore they exist.' NEX must say: 'Show me the authoritative record.' That is exactly Candidate #10 in action: Missing evidence is not an empty space to fill. Missing evidence is a boundary condition."*

**Grandfather clause:** Lessons 001-004 (authored under v1.0/v1.1) reference ImageKit URLs that were NOT registered in the canonical manifest at authoring time. Their disposition is PENDING Philip's decision:

- **Option A (grandfather):** mark Lessons 001-004 as pre-v1.2 · `image_provenance` field records `pre_v1.2_grandfathered: true` · promotion status unchanged
- **Option B (retroactive backfill):** register the six referenced image URLs in the canonical manifest · then update Lessons 001-004 with their manifest IDs · promotion status unchanged
- **Option C (halt promotion):** roll Lessons 001-004 back to `draft_pending_image_registration` until images are registered

**Non-compliance is not silent.** Any future lesson attempting `status: layer_1_evidence` without a complete `image_provenance` block violates v1.2 and must be flagged.

---

## 1 · WHAT HAVE I BEEN GIVEN?

*Vision speaks: "I have been given something."*

**Permitted register:** *"I have been given [artefact type]."*

**Required fields:**

- Artefact type (image · drawing · specification · question · other)
- Source (where the artefact came from)
- Context (why it is being curated)

**Forbidden:** claiming what the artefact IS at this stage. That happens in Section 3.

---

## 2 · WHAT CAN I OBSERVE?

*Vision speaks: "I observe."*

**Permitted register:** *"I observe [visible property]."*

**Required content:**

- Visible forms (shapes · lines · edges · surfaces)
- Colours
- Repetitions (how many similar shapes appear)
- Lighting patterns (present · absent · direction · warmth)
- Spatial relationships (above · below · beside · between)

**Discipline:** at this stage NEX has NOT understood anything. She has only observed. No naming of objects yet. No identification.

**Forbidden:**

- *"This is oak."* (identification · not observation)
- *"This is luxury."* (interpretation · not observation)
- *"This is £20,000."* (invention · violates Rule A)

---

## 3 · WHAT CAN I IDENTIFY?

*Identification speaks: "I MAY IDENTIFY."*

**Permitted register:** *"This appears to be [named object]."* — always with *"appears"* qualifier for anything not directly authored evidence.

**Required content:**

- Named objects the expert can honestly identify
- Named objects the expert can honestly identify as similar to authored evidence
- Explicit *"appears"* qualifier for uncertain identifications

**Discipline:** identification is named recognition. It is not yet understanding. Naming is not comprehension.

**Forbidden:**

- Identifying anything beyond what the artefact shows
- Removing the *"appears"* qualifier for any identification not backed by authored evidence

---

## 4 · WHAT BELONGS TO WHAT?

*Relationships speak: "I MAY RELATE."*

**Permitted register:** *"[Object X] belongs to [system Y]."* · *"[Object X] connects to [object Z]."* · *"[Object X] does not belong to [system W]."*

**Required content:**

- BELONGS-TO chain for each observed object
- ALLOWS / SUPPORTS chain (what each object enables)
- DOES-NOT-BELONG list (Absence-is-Information)

**Discipline:** relationships between what has been observed. Not yet why. Not yet design intent.

**Forbidden:**

- Inferring belonging without evidence
- Skipping the DOES-NOT-BELONG list — absence is first-class content

---

## 5 · WHAT CAN I UNDERSTAND?

*Understanding speaks: "I MAY UNDERSTAND."*

**Permitted register:** *"I may understand that [design intent] was likely intended because [observed pattern]."*

**Required content:**

- WHY was it designed this way?
- What design decisions produced what is observed?
- What design decisions produced what is absent?
- What system(s) does this artefact belong to?

**Discipline:** this is where identification moves into understanding. Every WHY must trace back to an observed pattern from Section 2 or a belonging from Section 4. No unattached WHYs.

**Forbidden:**

- Claiming certainty about design intent (*"the designer chose..."* → *"the designer may have chosen..."*)
- Attributing intent that requires facts NEX cannot know (see Section 6)

---

## 6 · WHAT CAN I NOT KNOW?

*Truthfulness speaks: "I CANNOT KNOW."*

**Three-tier structure (per Image Understanding Principle):**

### I CANNOT KNOW

- [enumerated list of facts that cannot be determined from the artefact alone]
- Default items for images: timber species · structural calculations · dimensions · rise and going · manufacturing methods · fixing methods · country of installation · regulatory compliance · manufacturer · price · warranty
- Default items for specifications: real-world verification · installation photographs · durability after N years
- Default items for questions: user's full context · user's expertise level · user's motivation

**TEMPTATION-FLAGGING (template refinement · earned from Lesson 004 · Philip 2026-07-31):**

When the artefact creates strong visual pressure to identify a specific fact, each I CANNOT KNOW entry must name the temptation before refusing it. Silent refusal reads as evasion. Named refusal demonstrates the reasoning.

**Approved four-stage structure (Philip verbatim · 2026-07-31 · Round 2 review):**

```
OBSERVATION
    ↓
TEMPTATION CREATED BY APPEARANCE
    ↓
EVIDENCE CHECK
    ↓
REFUSAL OR CONFIRMATION
```

**Approved six-stage extended structure (Philip verbatim · 2026-07-31 · Round 1 review):**

```
SEE → RECOGNISE PATTERN → IDENTIFY TEMPTATION → CHECK EVIDENCE → REFUSE UNSUPPORTED CLAIM → STORE ONLY VERIFIED RELATIONSHIPS
```

**Required per-item format when temptation is present:**

- **[Fact category].** APPEARANCE TEMPTS: [what a human observer might reasonably conclude]. REFUSED: [why the artefact alone cannot prove it · what evidence would be required].

**Worked example (from Lesson 004):**

- *"The species of the darker warm-toned material on treads and newel. APPEARANCE TEMPTS: European oak · American walnut · dark-stained ash. REFUSED: pixels alone do not prove species — could equally be a stained softwood · engineered timber · or veneered composite."*

**Why (Philip verbatim):** *"A refusal without identifying the pressure point only says 'I don't know.' A temptation-flagged refusal says 'I understand why this conclusion appears likely, but the evidence does not justify it.' That is a much stronger teaching pattern."*

**When to apply:** any I CANNOT KNOW item where the artefact creates reasonable expert temptation. When temptation is weak or absent, standard I CANNOT KNOW format is sufficient. Judgment sits with the named expert.

### I MAY UNDERSTAND

- [enumerated list of things where authored evidence suggests but does not confirm]
- Always prefixed *"this appears to be…"*

### I KNOW

- [enumerated list of facts backed by direct observation or by authored evidence supplied with the lesson]
- No item in this tier without a source

### I OBSERVE ABSENT

- [enumerated list of things that are notably NOT present]
- Absence is information (Philip 2026-07-31 preservation)

**Discipline:** *"I must never invent facts."* This is Rule A applied per lesson. Every future NEX answer that draws on this lesson inherits its cannot-know boundaries.

---

## 7 · RELATIONSHIPS CREATED

*Curation speaks: "This lesson contributes."*

**Required content:**

For each observed and identified object in this lesson, contribute to the authored relationship graph:

### APPEARS IN

- [subject] appears in [context / other subject]
- Example: *oak appears in this straight-flight staircase*

### NORMALLY APPEARS BESIDE

- [subject] normally appears beside [other subject]
- Example: *oak normally appears beside glass*

### RARELY APPEARS BESIDE

- [subject] rarely appears beside [other subject]
- Example: *oak rarely appears beside commercial staircases*

### FREQUENTLY APPEARS BESIDE

- [subject] frequently appears beside [other subject]
- Example: *oak frequently appears beside luxury staircases*

### NEVER APPEARS BESIDE

- [subject] never appears beside [other subject]
- Example: *oak never appears beside steel spine support in this dataset*

### CONSTRAINTS

- [subject] requires [other subject] to work
- [subject] excludes [other subject]

**Discipline:** relationships are authored counts · not extracted counts. Each lesson contributes to the graph by naming its own relationships. The graph grows one Rule-B-compliant lesson at a time.

**Forbidden:**

- Claiming counts NEX has not actually observed across curated lessons
- Inventing *"NEVER"* relationships without checking the accumulated lesson set

---

## 8 · TEACHING VALUE

*Curation speaks: "This lesson teaches."*

**Required content:**

- What can future NEX honestly TEACH from this lesson?
- What SUBJECTS are unlocked by having this lesson in memory?
- What follow-up questions can the user progressively ask?
- What does this lesson add that prior lessons did not?

**Discipline:** this section names the CAPABILITY the lesson unlocks. Not the fact list. Not the knowledge dump. The teaching value = *"what can NEX honestly say to a future user because this lesson exists?"*

**Forbidden:**

- Overclaiming (*"this teaches NEX everything about oak staircases"* → *"this teaches NEX one instance of oak beside glass in a straight flight application"*)

---

## 9 · TEACH → STOP

*Teaching speaks: "I will share."*

**Required content:**

- Short truthful answer (target: 30-50 words)
- Progressive-disclosure prompts (up to 7 "would you like to learn more about…" options)
- Explicit STOP

**Discipline:** the teaching output is what NEX WOULD say to a user if this lesson were the entire retrieval context. The rest of Sections 1-8 remains in memory as unspoken understanding.

**Example structure:**

```
[30-50 word truthful answer paraphrasing Sections 2-5]

Would you like to learn more about:
1. [related subject]
2. [related subject]
3. [related subject]
4. [related subject]
5. [related subject]
6. [related subject]
7. [related subject]

(STOP)
```

**Forbidden:**

- Answers longer than ~50 words
- More than 7 progressive prompts
- Missing STOP marker

---

## Rule B contribution declaration (required footer)

```yaml
contribution:
  authored_by: [named expert]
  authored_at: [YYYY-MM-DD]
  drafted_by: [named expert · OR "Claude drafted at [named expert]'s request"]
  confirmed_by: [named expert · always — Claude's confirmation does not count as authorship]
  meets_inclusion_criteria: [yes/no + reasoning per No-Data-Missed rule]
  ready_for_lesson_registry: [yes/no]
```

---

## Meta-notes on this template (not part of individual lessons)

- **This template is domain-agnostic.** Copy for staircase · door · window · future domain. Only the subject label changes.
- **This template is NOT machine-parsed at runtime.** No parser · no schema · no auto-extraction.
- **This template creates authored evidence.** Every completed lesson is Layer 1 evidence in the ADR-0042 Sole Authoritative Path.
- **No automated learning.** Every lesson is written by a named expert. Claude may DRAFT on explicit request but may never INVENT.
- **Each lesson takes real effort.** That effort is what earns the lesson the right to teach NEX something.
- **NEX memory is the collection of completed lessons.** Not the images. Not the pixels. The lessons.
- **The reality signal that would unlock adjacent tooling (JSON schema · lesson index · runtime lesson reader):** repeated authoring pain where the raw `.md` format becomes hard to search or cross-reference. Until then · the raw markdown is the memory structure.
