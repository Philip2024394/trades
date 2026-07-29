# Version Control Guidance · Reference Brain Semver

**Purpose:** A single, unambiguous rule for choosing the version bump on every draft. Semver (`major.minor.patch`) is the shape carried by `hammerex_nex_brain_versions.version_semver`. Consumers of the brain — runtime, admin dashboards, dependent brains, external installers — infer risk from the bump alone. Under-declaring a bump silently harms downstream consumers; over-declaring a bump wastes reviewer attention. This document settles the choice.

**Related:** `module_author_template.md` (Section 4) · `approval_workflow.md` (Stage 7) · `hammerex_nex_brain_versions` schema in `_living_types.ts`.

**Non-negotiable rule:** if unsure between two levels, choose the higher bump. Consumers can absorb an unnecessary bump; they cannot absorb an under-declared one.

---

## Semver in Reference Brain terms

| Segment | Bumped when | Consumer impact |
|---|---|---|
| **major** | Guidance changes in a way that could contradict what a previous version told a professional | Consumers must re-review any dependency they built on the prior version |
| **minor** | Guidance grows — new entries, new sub-topics, new modules — without contradicting prior versions | Consumers gain new capability; existing usage unaffected |
| **patch** | Guidance is corrected in a way that does not change its meaning — typos, formatting, citation reformatting, clarifying wording | Consumers can adopt transparently |

The definition is written in terms of the reader (a professional consuming the brain), not the codebase. A change may be trivial in text and still be a major bump if it flips a recommendation.

---

## Patch — meaning-preserving change

Bump the patch segment when the reader's understanding does not change. The reader who quoted the previous version can continue quoting it verbatim without being wrong.

Examples that are patches:
- Fix a typo in an entry body
- Correct a citation format to comply with `citation_requirements.md`
- Reformat wording without changing meaning ("baluster count" → "baluster count per step")
- Add a synonym to the terminology module without altering existing definitions
- Refresh a URL that redirected to a new location while pointing to the same source
- Update a `url_captured_on` after re-verifying the URL is live and unchanged
- Fix a broken cross-reference (`related_modules` pointing at a renamed entry)

Never patches:
- Any change to what the reader is being told to do
- Any change to the origin classification of an entry
- Any change to the source_reference itself (that is a minor at minimum, because the evidence chain moved)
- Any change to a confidence band
- Any change to `known_gaps` or `known_limits`

---

## Minor — additive growth without contradiction

Bump the minor segment when the module grows in coverage but does not change prior guidance.

Examples that are minors:
- Add a new entry that covers a topic no prior entry addressed
- Add a new sub-topic (a coherent group of entries) to an existing module
- Add a new module to the manifest (e.g. `estimating` becomes populated for the first time)
- Add a new origin (e.g. new named expert co-signs a field observation, upgrading E to F)
- Add a new jurisdiction to `jurisdiction_scope` on an entry where the guidance turns out to apply more broadly
- Add adversarial-question coverage to entries that previously had none
- Broaden `material_scope` after new interview material confirms wider applicability

Never minors:
- Changing an existing recommendation
- Removing an entry that consumers may still be citing
- Restructuring the shape of `modules_json` in a way that changes machine-parseability
- Retiring a sub-topic that the previous version explicitly covered

---

## Major — contradiction, structural change, or retirement

Bump the major segment when a professional acting on the prior version could now give a wrong answer.

Examples that are majors:
- Guidance in an entry changes to contradict prior guidance (e.g. previous version recommended 12 mm string housing depth; new evidence establishes 15 mm — that is a contradiction)
- A regulation citation is corrected and the corrected clause supports different guidance
- A hard rule is added, removed, or narrowed
- A confidence band drops from `high` to `uncertain` (readers should re-evaluate their reliance)
- An entry is retired — consumers may be citing the retired entry_id
- The entry structure changes in a way that breaks downstream parsing (e.g. `related_modules` field renamed)
- A module is removed from the manifest
- The `mission`, `principles`, or `promise` of the brain itself changes
- The set of `jurisdiction_scope` values narrows on an existing entry (previously implied applicability is withdrawn)

If a major bump involves retirement, the retiring entry keeps its `entry_id` reserved forever (never reused). See "Retirement" below.

---

## Boundary examples (the hard cases)

### "We added a warning to an existing entry"

- If the warning restates something the entry already implied, PATCH.
- If the warning changes what the reader should do, MAJOR.
- If the warning adds a caveat but the primary guidance is unchanged and the reader who ignored the caveat would still be broadly correct, MINOR.

### "We rewrote the body for clarity"

- If the rewrite preserves meaning word for word (in professional interpretation), PATCH.
- If the rewrite reveals a nuance the old body obscured, MINOR.
- If the rewrite changes what a reasonable reader would take away, MAJOR.

### "We updated a citation to a newer regulation edition"

- If the new edition says the same thing on the cited clause, PATCH.
- If the new edition adds nuance or scope, MINOR.
- If the new edition contradicts the old, MAJOR.

### "We added five new entries to `fault_finding`"

- If no existing entry needs to change to accommodate them, MINOR.
- If existing entries need to be rewritten because the new entries create ambiguity, MAJOR (or split into a MINOR that adds carefully-worded entries and a follow-up MAJOR that reworks the affected existing entries).

### "The named expert withdrew consent on three entries"

- The affected entries move to quarantine (per `citation_requirements.md` failure modes) and are removed from the version's user-facing surface. This is a MAJOR — consumers must know that content they may have been relying on is no longer supported.

---

## Retirement — when to retire a version vs simply supersede

Two vocabulary items on `hammerex_nex_brain_versions`:

- `superseded_by` — populated when a newer version replaces this one
- `retired_at` + `retire_reason` — populated when this version should NOT be used, even historically, for reasons that go beyond mere supersession

### When to simply supersede

The default. A newer version was published. The prior version is retained (immutable) and continues to be a valid historical citation. Downstream consumers who read the prior version's content are still reading correct guidance for the moment they consumed it.

### When to retire a version (in addition to supersession)

Retire a version when there is a reason a reader should NOT use it, even for historical reference. Examples:

- The version contained a safety-critical error that could cause harm if applied today
- The version cited a regulation that has been withdrawn without a suitable successor (the guidance is no longer defensible)
- The version was published under a certification that has since been revoked, and the reviewer has determined the affected content cannot be defended by another certified author
- The version's core citations rest on an expert whose consent was withdrawn AND whose contribution cannot be re-attributed to another source

Retirement writes:
- `retired_at` = now
- `retire_reason` = one paragraph explaining why the version should not be used at all
- A `brain_version_retired` event with the reason on `after_json`

A retired version is NEVER hard-deleted (per the Never-delete rule). It remains queryable for audit and provenance — but it is filtered out of user-facing answers, dependency resolution, and package export.

### Retirement without a successor

Rare but possible. If a version must be retired without a successor being published:
- `hammerex_nex_brains.current_version_id` rolls back to the most recent non-retired version (`rollback` per approval_workflow.md Stage 11)
- If no earlier non-retired version exists, the brain drops to `status: draft` and becomes unqueryable
- An `admin_intervention_required` event is written, and the brain enters manual triage

---

## Draft-side implications

`hammerex_nex_brain_drafts.proposed_semver` MUST be set before the draft can be submitted for review. It is not auto-computed — the author declares it and the reviewer verifies it (see `approval_workflow.md` Stage 5). This ensures the version discipline is a conscious act, not a byproduct of tooling.

If the reviewer disagrees with the proposed bump, the reviewer requests changes (Stage 6b) with a note specifying the correct bump. The author revises `proposed_semver` and resubmits. This keeps the semver decision in the author-reviewer loop rather than in a separate admin decision.

---

## Backwards-compatibility fields

Every published version also declares (per `_living_types.ts` `BrainVersionRow`):

- `brain_api_version` — the contract this version speaks to the runtime. Only changes on a MAJOR brain-API-level break.
- `minimum_runtime_version` — the earliest runtime this version can run on. Rises when the version relies on runtime features added since the prior version.
- `current_runtime_version` — a provenance field recording the runtime that published the version.

These fields interact with semver but do not replace it. Semver describes the reader-facing change. The three compatibility fields describe the machine-facing constraints.

---

## Anti-patterns (never do)

- Publishing a MAJOR silently as a MINOR because "the change was small" (small in text is not small in meaning)
- Publishing a PATCH that also happens to change a citation (that is a MINOR at minimum)
- Retiring a version to hide an embarrassing entry (retirement carries a reason; hiding is not permitted)
- Reusing a retired entry_id in a later version (the entry_id is reserved forever, even if the topic is re-authored under a fresh id)
- Bumping the version without an event on `hammerex_nex_events` (impossible under the workflow, but must never be worked around)
