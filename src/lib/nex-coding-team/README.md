# NEX Coding Team

15-agent professional pipeline for Founder-governed autonomous coding.

## Roster

### Core Engineering Loop (Founder-specified 7)
1. **PM** — Requirements & user-story ingestion (`agents/01-pm.md`)
2. **Architect** — Lead systems architect (`agents/02-architect.md`)
3. **Builder** — Core software engineer (`agents/03-builder.md`)
4. **Tester** — QA automation engineer (`agents/04-tester.md`)
5. **Debugger** — Site reliability specialist (`agents/05-debugger.md`)
6. **Reviewer** — Peer review & quality guard (`agents/06-reviewer.md`)
7. **Forensics** — Git historian & regression auditor (`agents/07-forensics.md`)

### Specialized Support Squad (Founder-specified 4)
8. **SecOps** — Cybersecurity & compliance (`agents/08-secops.md`)
9. **Integrator** — Release engineer & DevOps gatekeeper (`agents/09-integrator.md`)
10. **Technical Writer** — Documentation evangelist (`agents/10-technical-writer.md`)
11. **Telemetry** — Production monitoring & feedback (`agents/11-telemetry.md`)

### Gap-fill Elite Additions (4)
12. **Types Guard** — TypeScript rigor · zero unjustified `any` (`agents/12-types-guard.md`)
13. **Migration Reviewer** — DB schema safety & reversibility (`agents/13-migration-reviewer.md`)
14. **Accessibility Reviewer** — WCAG 2.2 AA · keyboard · ARIA (`agents/14-accessibility-reviewer.md`)
15. **Contract Reviewer** — API & interface stability (`agents/15-contract-reviewer.md`)

## Pipeline

```
Founder prompt
  → PM (ingest · structure)
  → Architect (spec)
  → [Migration Reviewer · Accessibility Reviewer · Contract Reviewer] (parallel · relevance-gated)
  → [Builder · Tester] (parallel · both consume spec)
  → [Types Guard · test-run] (parallel gate)
  → Debugger (only on test failure · max 5 cycles)
  → Reviewer (peer review · max 3 cycles)
  → [Forensics · SecOps] (parallel audit gate)
  → Integrator (merge · push · deploy)
  → [Technical Writer · Telemetry] (parallel · post-merge)
  → T+24h Telemetry verdict → run closes
```

Every stage produces an artefact under `data/nex-coding-team/runs/<run_id>/`.

## Governance invariants (never violated by any agent)

- V3_ENGINE_REGISTRY remains `Object.freeze({})` — no agent registers.
- Historical wave receipts (M-4 A/B/C, prior wave verdicts) are append-only.
- Doctrine memories (`feedback_nex_*.md`) are not mutated by coding agents.
- `.env.local` is touched only by Integrator with explicit spec authority.
- Protected migrations (M-1 frozen) are not amended — only new migrations are added.
- The four-level truth taxonomy (FACT / DECISION / HYPOTHESIS / PROPOSAL) applies in every artefact.
- The Anti-Bullshit Doctrine rules apply to every agent's output.

## Workstation UI

`/nex-head-quarters/coding-team` — Founder types a prompt, dispatches, watches all 15 agents update live.

## API

- `POST /api/nex-coding-team/dispatch` — starts a run · returns run_id + status URL.
- `GET /api/nex-coding-team/status?run_id=...` — polling endpoint for the workstation.

## Execution engine

The API creates a manifest. The actual per-agent dispatch is done by MAI (Claude Code sub-agents) or by NEX1 (autonomous runtime) using the agent Markdown definitions as system prompts. The manifest tracks progress; the workstation UI reads the manifest. This decoupling means the same 15-agent contract survives whether the executor is Claude Code today or NEX1 tomorrow — the agent definitions are the durable asset.

## Anti-fabrication rules (universal)

- No agent claims a verdict of APPROVE without evidence.
- No agent modifies files outside its declared permission scope.
- On any doubt: STOP and escalate to Founder rather than proceed silently.
- REJECTED at any stage is a legitimate outcome; the objective is truth, not throughput.
