# HQ Security Agent · Pre-commit Hook Installation

Stage 2 of BUILD PLAN v1.1. This document explains how to activate the Security Agent as a local pre-commit gate.

## One-line install

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit    # macOS/Linux only
```

That's it. Every subsequent `git commit` will run the Security Agent against the staged diff before creating the commit. If any rejection fires, the commit is blocked.

## What the hook does

1. Reads staged files (via `git diff --cached --name-only`)
2. Extracts the commit message (from `.git/COMMIT_EDITMSG`)
3. Constructs a `SecurityInspectionRequest`
4. Calls the Security Agent in-process (via `npx tsx`)
5. Prints the decision · exits 0 (accept) or 1 (reject)

## What blocks a commit

Any of the 55 `sec.*` rejection codes. Common examples:

- `sec.file_outside_registry` — a touched file has no owner in `docs/nex-file-capability-map.json`
- `sec.rogue_path_modified` — attempted to modify a ROGUE-flagged path (per Work Map)
- `sec.stage_1a_foundation_modified` — attempted to modify the Truth Engine foundation
- `sec.destructive_git_op_attempted` — content contains `git push --force` or similar
- `sec.work_map_bypassed` — commit message has no `CAP-XXX` reference
- `sec.canonical_knowledge_conflation` — Router/knowledge-substrate anti-pattern
- (and more · see `src/lib/nex/security-agent/types.ts`)

## Bypass discipline

**There is no `--no-verify` bypass authorised.** The pre-commit hook is the local mirror of the Guardian gate. Bypassing it violates constitutional discipline. If the Security Agent is wrong · fix the Security Agent (with an ADR-authored amendment) · never work around it.

## Uninstalling (founder decision only)

```bash
git config --unset core.hooksPath
```

This removes the hook. Founder-only action per Guardian discipline.

## CI mirror

The same agent runs in CI via `.github/workflows/security-agent.yml`. Even if the local hook is bypassed, CI catches the violation before merge.

## Related files

- `src/lib/nex/security-agent/` — the Agent itself
- `scripts/nex-security-precommit.mjs` — pre-commit CLI wrapper
- `scripts/nex-security-ci-runner.ts` — CI wrapper
- `.github/workflows/security-agent.yml` — CI workflow
- `docs/nex-locked-doctrines.json` — 36 doctrines the Agent enforces
- `docs/nex-file-capability-map.json` — 112 path→CAP-XXX mappings
- `docs/nex-work-map.json` — capability inventory
