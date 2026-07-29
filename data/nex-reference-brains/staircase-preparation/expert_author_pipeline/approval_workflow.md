# Approval Workflow · Expert Draft to Published Version

**Purpose:** The end-to-end flow from a certified expert's first keystroke in the Draft Workspace to an immutable published version being served by the runtime. Composes the platform primitives already defined in ADR-0037 (Living Trade Brains) with the discipline additions from ADR-0039, ADR-0040, and ADR-0041.

**Non-negotiable properties:**
- Separation of duties (Finding F6) — the reviewer must never be the author
- Every state transition writes to `hammerex_nex_events`
- The published version is immutable
- Rollback is always available and never destroys draft state

**Related files:**
- `interview_template.md` — how source material is captured (upstream of this workflow)
- `module_author_template.md` — the shape the author produces
- `citation_requirements.md` — the format each citation must take
- `version_control_guidance.md` — how the version bump is chosen
- `three_rule_author_reminder.md` — the identity/discipline reminder the author reads before starting

---

## Stage map

```
[0] Certification check
       ↓
[1] Author opens Draft Workspace           ← creates hammerex_nex_brain_drafts row
       ↓
[2] Author fills modules using             ← uses module_author_template.md
    module_author_template.md
       ↓
[3] Author self-audits with the            ← Expert Review Checklist (produced by another agent)
    Expert Review Checklist
       ↓
[4] Author submits for review              ← status = submitted_for_review
       ↓
[5] Independent reviewer validates         ← reviewer_id ≠ author_id (Finding F6)
       ↓
[6a] Reviewer approves    → [7]
[6b] Reviewer requests changes → back to [2]
[6c] Reviewer rejects     → draft closed as rejected
       ↓
[7] Admin publishes                        ← creates immutable hammerex_nex_brain_versions row
       ↓
[8] Runtime cache warmed                   ← version pointer flips
       ↓
[9] Explainability envelope + Rule C       ← every subsequent answer carries this
    origin trace populated on every answer
       ↓
[10] Observability                         ← unknowns/low-confidence feed back to [1]
       ↓
[11] Rollback (if required)                ← non-destructive; draft is preserved
```

Every arrow above is an event on `hammerex_nex_events`. Nothing happens off the record.

---

## Stage 0 · Certification check (precondition to all authoring)

Before the author can even open a Draft Workspace on this brain:

- The author's `hammerex_nex_brain_certifications` row for this brain_slug must exist AND be in `status: active`
- The certification must not be past `expires_at`
- The certification's `is_primary` or role must permit editing this module topic
- If the author's cert is `expired` or `revoked`, the Draft Workspace refuses to open

Events written:
- `brain_certification_expired` (nightly cron detection)
- `brain_certification_revoked` (admin action)

---

## Stage 1 · Author opens Draft Workspace

Action: `POST /api/admin/brains/{slug}/drafts` with `{ author_id, based_on_version_id }`.

Result:
- A `hammerex_nex_brain_drafts` row is upserted for `(brain_slug, author_id)` — one draft per author per brain at any time.
- If a draft already exists for this author on this brain, the existing draft is opened (no duplicate).
- The workspace loads the previous published version as a starting point (`based_on_version_id`) OR an empty scaffold if the brain is founding.

Event written:
- `brain_draft_saved` with `before_json: null` and `after_json: { draft_id, based_on_version_id }`.

---

## Stage 2 · Author fills modules using module_author_template

The author works entry-by-entry per `module_author_template.md`. Each save is autosaved to `hammerex_nex_brain_drafts.modules_json`. The Draft Workspace enforces:

- Every entry has all mandatory fields populated (see module_author_template.md Section 2)
- Every entry carries a `source_type` and a `source_reference` matching `citation_requirements.md`
- Every entry's `origin_classification` block is filled
- The author cannot mark an entry as ready if Rule C Section 3 checklist is not passable

Each save writes a `brain_draft_saved` event with `before_json` and `after_json` shrunk to the diff.

The Draft Workspace surfaces THREE live indicators for the author:
- Citation coverage % (entries with valid citations / total entries)
- Rule C origin coverage % (entries passing origin checklist / total entries)
- Publish-readiness % (Section 5 of module_author_template)

---

## Stage 3 · Author self-audits with the Expert Review Checklist

Before submitting, the author runs the **Expert Review Checklist** (a companion artefact produced by a separate agent — the Reviewer Discipline Agent). The checklist covers:

- Every entry meets Rule A (no fabrication) — the author cross-checks their own body copy against captured interview material
- Every entry meets Rule B (no AI-authored content) — the author confirms no LLM-generated technical claims are present in body copy
- Every entry meets Rule C (attributable origin) — the author walks Section 3 of module_author_template.md
- Every entry improves at least one of the Five Qualities (Accuracy · Consistency · Explainability · Completeness · Honesty)
- The module passes the Trust Question ("does this increase trust tomorrow vs today?")
- The module passes the Professional Test ("would a master tradesperson recommend this to a peer?")
- The version_bump_type is consistent with the changes present in this draft

If the self-audit fails on any item, the author returns to Stage 2. Submissions attempted without a completed self-audit are refused by the workflow (the submit button is disabled until every checklist item is confirmed).

---

## Stage 4 · Author submits for review

Action: `POST /api/admin/brains/{slug}/drafts/{draft_id}/submit`.

Effect:
- `hammerex_nex_brain_drafts.status` → `submitted_for_review`
- `hammerex_nex_brain_drafts.submitted_at` → now
- The draft becomes read-only to the author until the review completes

Event written:
- `brain_submitted_for_review` with `after_json: { draft_id, submitted_at }`

The draft appears in the Review Queue for eligible reviewers. Automated regression harness executes in parallel; its output attaches to the draft as `regression_result_json` on the eventual published version.

---

## Stage 5 · Independent reviewer validates

**Separation of duties (Finding F6) — HARD LAW.** The review workflow refuses to assign the draft to `reviewer_id == author_id`. Any attempt to self-approve returns a 403 and writes a `brain_review_action_rejected_self_assignment` event.

An eligible reviewer is any account with:
- A valid `hammerex_nex_brain_certifications` row for this brain in `status: active`
- Reviewer_role permitted to review (typically `advisory_panel`, `peer_author`, `admin`)
- Not the author of this draft

The reviewer runs the same **Expert Review Checklist** the author ran in Stage 3, PLUS the Reviewer-only overlay:

- Origin classifications are defensible (Section 6 of interview records + Section 3 of module authored entries)
- Citation coverage is 100% — every entry has a resolvable `source_reference`
- Adversarial-question coverage is present per module topic (with the Chief Reference Brain Engineer's adversarial catalogue)
- The module improves at least one of the Five Qualities without harming the others
- The version bump is correctly declared per `version_control_guidance.md`
- No entry contradicts a still-published entry elsewhere without an explicit `supersedes` note

---

## Stage 6 · Reviewer decision

### 6a · Approve

Action: `POST /api/admin/brains/{slug}/drafts/{draft_id}/approve` with optional `notes`.

Effect:
- `hammerex_nex_brain_drafts.status` → `approved`
- `hammerex_nex_brain_drafts.reviewed_at`, `reviewed_by`, `review_notes` populated
- A `hammerex_nex_brain_review_actions` row is inserted with `action: approve`

Event written:
- `brain_approved` with `after_json: { draft_id, reviewer_id, notes }`

Approval does NOT publish. Publish is a separate admin action (Stage 7) — this preserves the audit trail between review and go-live and allows batching or scheduled release.

### 6b · Request changes

Effect:
- `hammerex_nex_brain_drafts.status` → `changes_requested`
- `review_notes` populated with the specific items to fix
- The draft becomes editable again by the author
- The author returns to Stage 2

Event written:
- `brain_changes_requested` with `after_json: { draft_id, reviewer_id, notes }`

### 6c · Reject

Effect:
- `hammerex_nex_brain_drafts.status` → `rejected`
- `review_notes` populated with the reason
- Draft is closed and archived (never deleted per Never-delete rule)

Event written:
- `brain_rejected` with `after_json: { draft_id, reviewer_id, notes }`

---

## Stage 7 · Admin publishes new immutable version

Action: `POST /api/admin/brains/{slug}/versions/publish` with `{ draft_id }`.

Precondition:
- Draft must be in `status: approved`
- Automated regression harness must be green (`regression_result_json.pass == true`)
- Overall Readiness Score must be ≥ 70 (or admin override with a documented reason event)

Effect:
- A new `hammerex_nex_brain_versions` row is inserted:
  - `version_semver` = draft's `proposed_semver`
  - `manifest_json`, `modules_json` copied from draft (frozen)
  - `authored_by`, `authored_at` from the draft
  - `published_at`, `published_by` set to now / admin
  - `brain_api_version`, `minimum_runtime_version` recorded
  - `readiness_score_json`, `regression_result_json` snapshotted
- `hammerex_nex_brains.current_version_id` flipped to the new version id
- Draft is retained (never destroyed) with `status: approved` and `published_at` timestamp

Events written:
- `brain_version_published`
- `brain_readiness_recomputed` (immediately, so the registry reflects the new score)

---

## Stage 8 · Runtime cache warmed

Runtime warms in-memory cache for the new `current_version_id`:
- The old version continues serving until the swap completes atomically
- Cache warm event written to `hammerex_nex_events` with `event_type: brain_cache_warmed`
- Multi-node deployments broadcast the swap via the standard cache-invalidation channel

Consumers receive the new version on their next `POST /api/nex/brains/{slug}/ask` call. No user sees a partial state.

---

## Stage 9 · Explainability envelope + Rule C origin trace on every answer

Every runtime answer post-publish carries:
- `answer`, `evidence[]`, `trade_rule`, `reason`, `confidence` per the `BrainAnswerEnvelope` type in `_living_types.ts`
- `brain_version` and `brain_version_id` pointing at the newly published version
- Each entry in `evidence[]` is derived from the entry's `source_reference` per `citation_requirements.md`

Every answer is logged to `hammerex_nex_brain_answers`. Answers with `confidence < 0.85` also emit `brain_answer_low_confidence` — feeding directly into the Lifetime Loop (ADR-0039) via the Unknown / Low-Confidence queue.

---

## Stage 10 · Observability feeds the next cycle

The unknowns, low-confidence answers, and any `hammerex_nex_brain_field_outcomes` posted against this version surface in the author's Unknown Queue. That queue drives:
- New interviews scheduled (using `interview_template.md`)
- New entries authored in the next draft
- The Lifetime Loop turns

---

## Stage 11 · Rollback (non-destructive)

Action: `POST /api/admin/brains/{slug}/rollback` with `{ target_version_id }`.

Effect:
- `hammerex_nex_brains.current_version_id` → `target_version_id`
- Runtime cache re-warmed with the target version
- The rolled-back-from version is NOT deleted — it stays in `hammerex_nex_brain_versions` as `superseded_by: null` (or the target) and `retired_at` populated
- Draft state is preserved untouched

Event written:
- `brain_rolled_back` with `before_json: { previous_current_version_id }`, `after_json: { current_version_id }`

Rollback triggers include:
- Regression detected by field outcomes
- Regulatory citation invalidated
- Named expert withdrawal of consent (see citation_requirements.md failure modes)

---

## The workflow's guarantees

- No content enters `hammerex_nex_brain_versions.modules_json` without a certified author, a separate certified reviewer, and green regression
- No published answer can be produced without an Explainability envelope tied back to a specific version and its citations
- No state transition happens without an event on `hammerex_nex_events`
- No draft, version, review action, or certification is ever hard-deleted
- The author can never approve their own work
- The runtime never serves a version below the readiness gate unless an admin explicitly overrode with a documented reason event

Every one of these guarantees is what a professional peer will look for before recommending the brain to another professional. That is the Professional Test made operational.
