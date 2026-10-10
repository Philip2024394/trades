# NEX1 · X-01 · Provenance and Audit Record

**Audit identifier:** X-01
**Contract version:** X-01-v1
**Audit date:** 2026-09-19
**Founder authorisation:** 2026-09-19 (X-01 reconstruction authorisation gate)
**NEX capability:** `src/lib/nex-agent/code-engine/capability-git-archaeologist.ts`

This document is the NEX governance/audit record for the six reconstructed
git-archaeology behaviours (R-01..R-06). External study material is recorded
here as evidence for licensing and provenance review. NEX code itself carries
only NEX identity and is self-contained at runtime.

**No legal determination is made in this document.**

---

## 1 · Scope of the audited contract

Six read-only behaviours over a tracked file in a local git working tree:

| ID | Behaviour | Contract clause |
|----|-----------|-----------------|
| R-01 | History hash enumeration | B-07 |
| R-02 | Commit metadata extraction | B-08 (+ B-09, B-10, B-11 via delegation) |
| R-03 | Changed file + rename extraction | B-11 |
| R-04 | Per-line authorship (blame) | B-12 |
| R-05 | Historical path / rename-alias reconstruction | B-14 |
| R-06 | Co-change analysis | B-15 |

Nothing else in the external material was reconstructed. Everything outside
R-01..R-06 remains a separately gated decision.

---

## 2 · External study material recorded for governance review

The following identifiers describe the external material studied to define
the behaviour contract. They are recorded here for licensing/provenance
review and are **not** part of NEX runtime identity, NEX branding, or NEX
source-file headers.

| Field | Value |
|-------|-------|
| External repository (owner/name) | `Shubhamsaboo/awesome-llm-apps` |
| Declared external license | `Apache-2.0` |
| Source path within external repository | `agent_skills/commit-archaeologist/scripts/archaeologist.py` |
| Audited branch | `main` |
| Audited commit SHA | `0c499421ea483a45202c75c31b8bbc1a32447b9c` |
| Author date at audited SHA (ISO-8601 UTC) | `2026-07-19T19:09:46Z` |

**Recorded status:** these identifiers must not appear in NEX runtime source
files. They exist to enable independent licensing/provenance review of the
X-01 audit history. Any distribution decision must include a separate
licensing/provenance review that consumes this record.

---

## 3 · Twenty-two source-observable behaviours (B-01..B-22)

The X-01 audit produced a 22-clause source-observable behaviour contract.
The NEX capability implements only the six enumerated in §1. The remaining
clauses (input validation, timeout defaults, error-code semantics, path
resolution, subprocess argument shape, etc.) are preserved as gap items
G-02..G-14 documented in §5 below.

---

## 4 · Design decisions (DD-01..DD-10)

The NEX capability implements the behaviours behaviourally, not
structurally. Ten design decisions govern the reconstruction:

| ID | Decision | Rationale |
|----|----------|-----------|
| DD-01 | `execFileSync("git", args, { cwd, encoding: "utf8", stdio, maxBuffer, timeout: 30_000 })` list-form subprocess pattern | Matches the primitive proven in `capability-project-state-detector.ts`. Preserves S-08 (no shell). Adds explicit timeout matching contract B-18. |
| DD-02 | Refuse `workspace_root` args whose basename begins with `-` | Stricter than the external material; eliminates the observed risk surface entirely (S-01). |
| DD-03 | Use `path.resolve` (abspath), not `fs.realpathSync` (realpath) | Preserves audited behaviour. The capability reads only through `git` subprocess; filesystem-level symlink escape is not a reachable read path (S-03). |
| DD-04 | Default timeout 30_000 ms · configurable per call | Matches contract default (S-07) while permitting NEX-side tuning. |
| DD-05 | UTF-8 with Node's default replacement produces `�` for undecodable bytes | Matches contract errors-replace semantics (S-11). |
| DD-06 | Preserve exact classifier vocabulary and intent-signal regexes as fixed by the audit contract | Convention-dependent (G-11) but contracted. |
| DD-07 | `git show HEAD:<path>` output split by `\n` inherits contract behaviour on binary files | Documented limitation (G-06). |
| DD-08 | `--line-porcelain` parse: state machine over `author ` / `author-mail ` (strip `<>`) / `\t`-prefixed content-line | Contract state machine; not a design invention. |
| DD-09 | Co-change threshold `Math.max(2, Math.floor((n + 2) / 3))` | Exact contract formula (B-15). |
| DD-10 | Return NEX Result-union `{ ok: true, … } \| { ok: false, reason_code, reason }` instead of exception class | NEX-idiomatic (matches Save/Run/Export/Project-Registry patterns). Behavioural equivalence via failure-code enumeration. |

---

## 5 · Open gaps (G-01..G-14) — not silently invented

| ID | Gap | Status |
|----|-----|--------|
| G-01 | (subsumed into DD-04) | resolved by DD-04 |
| G-02 | Bare repositories | not exercised; contract untested |
| G-03 | Shallow clones | not exercised |
| G-04 | Detached HEAD | not exercised |
| G-05 | Submodules | not exercised |
| G-06 | Binary files at HEAD | inherited limitation (see DD-07) |
| G-07 | Minimum git version | undocumented |
| G-08 | `core.autocrlf` interaction | undocumented |
| G-09 | Rename detection edge cases (`-M` heuristics) | contracted behaviour only |
| G-10 | Regex ReDoS surface on adversarial commit messages | not modelled |
| G-11 | Commit-classifier vocabulary is English-convention-specific | documented; not extended |
| G-12 | Narrative / interpretation layer | explicitly out of scope |
| G-13 | Windows path/CRLF edge cases | not tested |
| G-14 | Empty-log edge (all-null log output) | contract fails with `NO_COMMITS_FOUND_FOR_PATH` |

Each unresolved gap requires a founder decision before it is closed.

---

## 6 · Boundaries preserved in the NEX capability

- read-only · no `fs` writes · no `git` write commands
- offline · no network calls
- no LLM · no model API · no prompt · no narrative layer
- no shell · `execFileSync` list-form only
- bounded · per-call timeout (default 30 s)
- deterministic · explicit sort keys · contracted formulas
- path-constrained · workspace_root + relative + inside-repo check
- self-contained · imports only `node:child_process`, `node:fs`, `node:path`
- NEX-native identity · no external repository / company / product name in source

---

## 7 · What this record explicitly does not do

- It does not make a legal or licensing conclusion. Licensing/provenance
  review is a separate step, whose input is this record.
- It does not authorise verification, wiring, endpoint creation, fixture
  creation, UI change, agent registration, or distribution.
- It does not modify the historical X-01 audit findings — those remain
  frozen; this document is the durable ledger for them.

---

## 8 · Governance summary

The behaviour contract R-01..R-06 has been independently implemented in
TypeScript inside the NEX capability. External study material is recorded
here for governance and licensing review only. NEX source carries no
external repository name, no external company brand, no external URL, no
hidden link, no external service identity, and no LLM dependency. The
capability is self-contained and can be reviewed as pure NEX code.

Provenance is preserved. Brand identity is separated.
