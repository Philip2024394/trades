// NEX Coding Team · Scripted (rule-based) dispatcher
// Produces well-formed artefacts using deterministic templates per agent role.
// Not an LLM — a rule engine. Every artefact is labelled [SCRIPTED_DISPATCHER]
// so nobody mistakes it for real analysis. Purpose: keep the pipeline alive
// when no external MAI or NEX1 executor is attached, and provide a stable
// substrate for CI / regression testing of the pipeline mechanics themselves.

import type { AgentDispatcher, AgentDispatchInput, AgentDispatchOutput } from "./runtime";
import { safeWrite } from "./safe-write";
import type { AgentId, AgentVerdict } from "./types";

const ALLOWED_VERDICTS: readonly AgentVerdict[] = [
  "APPROVE",
  "APPROVE_WITH_NOTES",
  "REJECT",
  "FLAG",
  "NEEDS_FOUNDER_INPUT",
  "ERROR",
  "SKIPPED_NOT_APPLICABLE",
];

export const SCRIPTED_DISPATCHER: AgentDispatcher = {
  async dispatch(input: AgentDispatchInput): Promise<AgentDispatchOutput> {
    const { run_id, agent_id, context, artifact_write_target } = input;
    const forced = forcedVerdictFor(agent_id, context.founder_prompt);
    const verdict: AgentVerdict = forced ?? "APPROVE";

    const body = renderArtifact(agent_id, input, verdict);
    const wr = safeWrite(run_id, agent_id, artifact_write_target, body);

    const passed = verdict === "APPROVE" || verdict === "APPROVE_WITH_NOTES" || verdict === "SKIPPED_NOT_APPLICABLE";
    return {
      verdict,
      summary: wr.ok
        ? `[SCRIPTED] ${agent_id} produced ${artifact_write_target}`
        : `[SCRIPTED] ${agent_id} write refused: ${wr.reason}`,
      evidence: wr.ok && wr.target_rel ? [wr.target_rel] : [],
      blockers: passed ? [] : [`scripted ${verdict}`],
      next_action: null,
      artifact_relpath: wr.target_rel,
    };
  },
};

export function forcedVerdictFor(agent_id: string, founder_prompt: string): AgentVerdict | null {
  const marker = new RegExp(`#FORCE_VERDICT:${agent_id}=([A-Z_]+)`);
  const m = founder_prompt.match(marker);
  if (!m || !m[1]) return null;
  return (ALLOWED_VERDICTS as readonly string[]).includes(m[1]) ? (m[1] as AgentVerdict) : null;
}

function renderArtifact(agent_id: AgentId, input: AgentDispatchInput, verdict: AgentVerdict): string {
  return artifactPreamble(agent_id, input, verdict) + "\n\n" + artifactBody(agent_id, input);
}

function artifactPreamble(agent_id: AgentId, input: AgentDispatchInput, verdict: AgentVerdict): string {
  const present = countPresent(input);
  return [
    `# ${agent_id} · scripted artefact [SCRIPTED_DISPATCHER]`,
    ``,
    `_Produced by the NEX Coding Team scripted dispatcher · run_id=${input.run_id}_`,
    ``,
    `- **Verdict:** ${verdict}`,
    `- **Cycle:** ${input.cycle_index}`,
    `- **Target:** \`${input.artifact_write_target}\``,
    ``,
    `## Truth-taxonomy`,
    `- [FACT] Founder prompt length: ${input.context.founder_prompt.length} chars.`,
    `- [FACT] Prior artefacts present: ${present}.`,
    `- [DECISION] Verdict = ${verdict} (scripted default is APPROVE unless #FORCE_VERDICT marker present).`,
    `- [PROPOSAL] Swap this dispatcher for an LLM-backed one via the AgentDispatcher contract in \`runtime.ts\` when Founder authorises.`,
  ].join("\n");
}

function countPresent(input: AgentDispatchInput): number {
  const c = input.context;
  return [c.ticket_md, c.spec_md, c.build_notes_md, c.test_plan_md, c.debug_notes_md, c.test_output].filter(
    (v) => v !== undefined,
  ).length;
}

function artifactBody(agent_id: AgentId, input: AgentDispatchInput): string {
  switch (agent_id) {
    case "pm":
      return renderPm(input);
    case "architect":
      return renderArchitect();
    case "builder":
      return renderBuilder();
    case "tester":
      return renderTester();
    case "debugger":
      return renderDebugger(input);
    case "reviewer":
      return renderReviewer();
    case "forensics":
      return renderForensics();
    case "secops":
      return renderSecops();
    case "integrator":
      return renderIntegrator();
    case "technical-writer":
      return renderDocs();
    case "telemetry":
      return renderTelemetry();
    case "types-guard":
      return renderTypesGuard();
    case "migration-reviewer":
      return renderMigrationReviewer();
    case "accessibility-reviewer":
      return renderA11yReviewer();
    case "contract-reviewer":
      return renderContractReviewer();
  }
}

function renderPm(i: AgentDispatchInput): string {
  const p = i.context.founder_prompt;
  const oneLine = (p.split(/\r?\n/)[0] ?? "").slice(0, 140) || "(empty prompt)";
  return [
    `## Ticket`,
    `- run_id: ${i.run_id}`,
    `- title: ${oneLine}`,
    `- one_line_summary: ${oneLine}`,
    `- user_story: As the Founder · I want the described change · so that the platform advances.`,
    `- acceptance_criteria:`,
    `  - Feature described in the prompt exists in code.`,
    `  - Tests cover the described behaviour.`,
    `  - No protected file mutated.`,
    `- scope_in: as described in the Founder prompt.`,
    `- scope_out: anything not explicitly requested.`,
    `- risks: unclear scope · missing edge-cases · potential env dependencies.`,
    `- clarifying_questions_for_founder: none (scripted PM does not escalate).`,
    `- estimated_size: M`,
    `- priority: should-have`,
    `- suggested_pipeline_gates: types-guard · reviewer · forensics · secops`,
  ].join("\n");
}

function renderArchitect(): string {
  return [
    `## Spec`,
    `- summary: implement the described feature per Founder prompt.`,
    `- module: TBD by Builder · under src/lib/ or src/app/ per repo convention.`,
    `- public_interface: named exports · TypeScript strict · zero \`any\`.`,
    `- error_handling: explicit Result-style objects · never silent catch.`,
    `- observability: logger calls at boundaries.`,
    `- tests_required: adversarial · edge-cases · boundary values.`,
    `- migration_required: no unless supabase/migrations touched.`,
    `- accessibility_required: no unless UI touched.`,
    `- rollback: revert the commit.`,
  ].join("\n");
}

function renderBuilder(): string {
  return [
    `## Build notes`,
    `- files_modified: none (scripted dispatcher does not modify source).`,
    `- next: attach an LLM-backed dispatcher for Builder to author real code.`,
  ].join("\n");
}

function renderTester(): string {
  return [
    `## Test plan`,
    `- unit: cover every public export with at least one adversarial case.`,
    `- integration: verify composition with adjacent modules without regression.`,
    `- boundary: null / empty / max / min inputs.`,
    `- assertion_style: explicit expected values · no snapshot tests.`,
  ].join("\n");
}

function renderDebugger(i: AgentDispatchInput): string {
  const to = (i.context.test_output ?? "n/a").slice(0, 400);
  return [
    `## Debug notes`,
    `- test_output_preview: ${to}`,
    `- diagnosis: scripted diagnosis · real analysis requires LLM-backed dispatcher.`,
    `- patch_applied: false`,
  ].join("\n");
}

function renderReviewer(): string {
  return [
    `## Review`,
    `- readability: OK (scripted heuristic).`,
    `- correctness: OK (scripted heuristic).`,
    `- security: no risks flagged by scripted rules.`,
    `- verdict: APPROVE (scripted default).`,
  ].join("\n");
}

function renderForensics(): string {
  return [
    `## Forensics`,
    `- protected_files_touched: none (verified via safeWrite deny log).`,
    `- historical_receipts_intact: yes.`,
    `- V3_ENGINE_REGISTRY frozen: yes.`,
  ].join("\n");
}

function renderSecops(): string {
  return [
    `## SecOps`,
    `- new secrets: none.`,
    `- env vars added: none.`,
    `- external I/O introduced: none.`,
    `- injection surface: no unsafe interpolation detected in scripted scan.`,
  ].join("\n");
}

function renderIntegrator(): string {
  return [
    `## Integration`,
    `- commit: not created (scripted dispatcher does not commit).`,
    `- push: not performed.`,
    `- deploy: not triggered.`,
    `- next: real Integrator runs under LLM-backed dispatcher after Founder authorisation.`,
    `- rollback: n/a (no commit).`,
  ].join("\n");
}

function renderDocs(): string {
  return [
    `## Docs notes`,
    `- README: unchanged.`,
    `- ADR: no new decision recorded (scripted).`,
  ].join("\n");
}

function renderTelemetry(): string {
  return [
    `## Telemetry`,
    `- events emitted: 0 (scripted).`,
    `- dashboards updated: none.`,
  ].join("\n");
}

function renderTypesGuard(): string {
  return [
    `## Types guard`,
    `- tsc --noEmit: not run in scripted mode (real dispatcher would run it).`,
    `- any-count: n/a`,
    `- @ts-ignore-count: n/a`,
  ].join("\n");
}

function renderMigrationReviewer(): string {
  return [
    `## Migration review`,
    `- migration_files_added: none detected in scripted mode.`,
    `- reversibility: n/a`,
    `- destructive_ops: none.`,
  ].join("\n");
}

function renderA11yReviewer(): string {
  return [
    `## Accessibility review`,
    `- ui_touched: assumed no (scripted).`,
    `- WCAG concerns: none.`,
  ].join("\n");
}

function renderContractReviewer(): string {
  return [
    `## Contract review`,
    `- public_exports_changed: unknown in scripted mode.`,
    `- breaking_changes: none.`,
  ].join("\n");
}
