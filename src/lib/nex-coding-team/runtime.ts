// NEX Coding Team · Runtime executor
// Reads a manifest, walks the pipeline stages, dispatches agents (either to
// Claude Code sub-agents via the API layer OR to NEX1's autonomous runtime),
// records each verdict to the manifest + AGENT_STATE.json + audit log.
//
// The runtime is DELIBERATELY thin. It does NOT call the Anthropic API or any
// external LLM directly — dispatch is delegated. This keeps the runtime testable
// and lets us swap executors (Claude Code today, NEX1 tomorrow) without changing
// the pipeline shape.

import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import {
  createRun,
  saveManifest,
  loadManifest,
  planPipeline,
  computeRelevantGates,
  aggregateStageVerdict,
  transitionStatus as transitionManifestStatus,
} from "./orchestrator";
import { initState, appendEvent, recordAgentFinish, transitionStatus } from "./state";
import { log, logGovernanceCheck } from "./logger";
import { isAborted, readAbort } from "./interrupt";
import { PROTECTED_FILES } from "./types";
import { releaseCodingTeamRun } from "@/lib/nex-code-brain/integrations/coding-team-bridge";
import { extractLessonFromRun } from "@/lib/nex-code-brain/integrations/lesson-extractor";
import type {
  AgentId,
  AgentResult,
  CodingRunManifest,
  PipelineStatus,
} from "./types";

const REPO_ROOT = process.cwd(); // Next.js runs from repo root

/**
 * External executor contract. The runtime does NOT call an LLM directly —
 * it delegates to a Dispatcher supplied by the caller. This lets us plug in:
 *   · Claude Code sub-agents (in-session, MAI supervision) · today
 *   · NEX1 autonomous runtime (WO-NEX-RUNTIME-* process) · tomorrow
 *   · A test harness that returns canned outputs (regression testing the pipeline) · always
 */
export interface AgentDispatcher {
  dispatch(input: AgentDispatchInput): Promise<AgentDispatchOutput>;
}

export interface AgentDispatchInput {
  readonly run_id: string;
  readonly agent_id: AgentId;
  readonly cycle_index: number;
  readonly system_prompt: string; // loaded from src/lib/nex-coding-team/agents/<n>-<agent>.md
  readonly context: {
    readonly founder_prompt: string;
    readonly ticket_md?: string;
    readonly spec_md?: string;
    readonly build_notes_md?: string;
    readonly test_plan_md?: string;
    readonly debug_notes_md?: string;
    readonly test_output?: string;
    readonly prior_verdicts: Readonly<Partial<Record<AgentId, AgentResult>>>;
  };
  readonly artifact_write_target: string; // repo-relative path this agent should populate
}

export interface AgentDispatchOutput {
  readonly verdict: AgentResult["verdict"];
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly blockers: readonly string[];
  readonly next_action: string | null;
  readonly artifact_relpath: string | null; // what the agent actually wrote
}

// --- Runtime entry points ---

export interface StartRunOptions {
  readonly founder_prompt: string;
  readonly dispatcher: AgentDispatcher;
  readonly dry_run?: boolean;
}

/**
 * Create a new manifest + state file + audit-log entry WITHOUT executing.
 * Callers that want fire-and-forget background execution can use this to get
 * the run_id synchronously, then call `runPipeline(run_id, ...)` without await.
 */
export function initRun(founder_prompt: string): CodingRunManifest {
  const manifest = createRun(founder_prompt);
  initState(manifest.run_id);
  log(manifest.run_id, {
    kind: "stage_transition",
    agent_id: "orchestrator",
    summary: "run created",
    detail: { founder_prompt },
  });
  logGovernanceCheck(manifest.run_id, "v3_registry_frozen", true, "runtime invariant");
  logGovernanceCheck(manifest.run_id, "historical_receipts_intact", true, "runtime invariant");
  return manifest;
}

/** Execute the pipeline for a pre-created run. */
export async function runPipeline(
  run_id: string,
  dispatcher: AgentDispatcher,
  dry_run: boolean = false,
): Promise<CodingRunManifest> {
  return executePipeline(run_id, dispatcher, dry_run);
}

/** Create a new run AND execute the pipeline end-to-end. Sync path (await this). */
export async function startRun(opts: StartRunOptions): Promise<CodingRunManifest> {
  const m = initRun(opts.founder_prompt);
  return runPipeline(m.run_id, opts.dispatcher, opts.dry_run === true);
}

/** Resume a paused run (e.g. after Founder input). */
export async function resumeRun(run_id: string, dispatcher: AgentDispatcher): Promise<CodingRunManifest> {
  const m = loadManifest(run_id);
  if (!m) throw new Error(`no manifest for run_id=${run_id}`);
  return runPipeline(run_id, dispatcher, false);
}

async function executePipeline(
  run_id: string,
  dispatcher: AgentDispatcher,
  dry_run: boolean,
): Promise<CodingRunManifest> {
  // Compute pipeline plan lazily — needs spec.md (once written) to know which gates apply.
  // Stage 1 & 2 always run: PM + Architect. After spec.md exists, compute relevant gates.
  let manifest = loadManifest(run_id);
  if (!manifest) throw new Error("manifest missing");

  // Founder interrupt gate · check before every stage.
  {
    const aborted = maybeAbort(manifest);
    if (aborted) return aborted;
  }

  // Stage 1 · PM
  manifest = await runSingle(manifest, "pm", "1-ingest", dispatcher, "ticket.md");
  {
    // Abort check FIRST · if the Founder pressed STOP mid-dispatch, the queue
    // dispatcher may have returned ERROR because of the abort. We want status
    // = aborted, not halted_error, in that case.
    const aborted = maybeAbort(manifest);
    if (aborted) return aborted;
    const halted = maybeHalt(manifest, ["pm"]);
    if (halted) return halted;
  }

  if (dry_run) {
    return finaliseDryRun(manifest.run_id, "PM-only dry run complete");
  }

  // Stage 2 · Architect
  manifest = await runSingle(manifest, "architect", "2-design", dispatcher, "spec.md");
  {
    const aborted = maybeAbort(manifest);
    if (aborted) return aborted;
    const halted = maybeHalt(manifest, ["architect"]);
    if (halted) return halted;
  }

  // Compute gate relevance from the actual spec.
  const specPath = path.join(REPO_ROOT, manifest.artifacts_dir, "spec.md");
  const specText = existsSync(specPath) ? readFileSync(specPath, "utf8") : "";
  const gates = computeRelevantGates(specText);
  const plan = planPipeline(gates);

  // Skip stages 1-2 in the plan since we've done them.
  for (const stage of plan.slice(2)) {
    {
      const aborted = maybeAbort(manifest);
      if (aborted) return aborted;
    }
    manifest = await runStage(manifest, stage.stage_name, stage.agents, dispatcher);
    // Abort check BEFORE stage-verdict aggregation so a mid-stage STOP still
    // produces status=aborted, not halted_error.
    {
      const aborted = maybeAbort(manifest);
      if (aborted) return aborted;
    }
    const stage_results = stage.agents.map((a) => manifest.agent_results[a]).filter((r): r is AgentResult => r !== null);
    const verdict = aggregateStageVerdict(stage_results);
    if (verdict === "REJECT") return markHalted(manifest.run_id, "halted_error");
    if (verdict === "NEEDS_FOUNDER_INPUT") return markHalted(manifest.run_id, "halted_needs_founder");
  }

  // Completed all stages.
  manifest = transitionManifestStatus(manifest, "completed_merged");
  transitionStatus(manifest.run_id, "completed_merged", null, "done", "Pipeline complete.");
  releaseAndOptionallyLearn(manifest.run_id, "completed");
  return manifest;
}

/**
 * F3 wire · called at every terminal transition of a coding-team run.
 * Safely no-ops for legacy runs that never went through the Code Brain
 * (releaseCodingTeamRun returns NOT_APPLICABLE when no side-car exists).
 * On a completed run, also distils a KnowledgeEntry. All bridge failures
 * are swallowed here so a brain misconfiguration can never crash the runtime.
 */
function releaseAndOptionallyLearn(run_id: string, outcome: "completed" | "abandoned"): void {
  let releasedReal = false;
  try {
    const r = releaseCodingTeamRun(run_id, outcome);
    releasedReal = r.ok && "stage_classification" in r && r.stage_classification === "REAL";
    log(run_id, {
      kind: "governance_check",
      agent_id: "orchestrator",
      summary: `brain lease release · outcome=${outcome} · ok=${r.ok}`,
      detail: { classification: "stage_classification" in r ? r.stage_classification : "unknown" },
    });
  } catch (err) {
    log(run_id, {
      kind: "escalation",
      agent_id: "orchestrator",
      summary: `brain release threw (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  if (releasedReal && outcome === "completed") {
    try {
      const lesson = extractLessonFromRun({ run_id, contributed_by_lane: "nex-coding-primary" });
      log(run_id, {
        kind: "governance_check",
        agent_id: "orchestrator",
        summary: `brain lesson extraction · ok=${lesson.ok}`,
        detail: lesson.ok ? { entry_id: lesson.entry_id, partial: lesson.partial } : { reason: lesson.reason },
      });
    } catch (err) {
      log(run_id, {
        kind: "escalation",
        agent_id: "orchestrator",
        summary: `brain lesson extraction threw (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}

// --- Stage helpers ---

async function runSingle(
  manifest: CodingRunManifest,
  agent_id: AgentId,
  stage_name: string,
  dispatcher: AgentDispatcher,
  artifact_name: string,
): Promise<CodingRunManifest> {
  transitionStatus(manifest.run_id, stageToStatus(stage_name), agent_id, stage_name, `stage ${stage_name} started`);
  const started_at = new Date().toISOString();
  log(manifest.run_id, {
    kind: "agent_started",
    agent_id,
    summary: `${agent_id} starting stage ${stage_name}`,
  });

  const system_prompt = readAgentPrompt(agent_id);
  const ctx = buildContext(manifest);
  const artifact_target = path.posix.join(manifest.artifacts_dir, artifact_name);

  const out = await dispatcher.dispatch({
    run_id: manifest.run_id,
    agent_id,
    cycle_index: 0,
    system_prompt,
    context: ctx,
    artifact_write_target: artifact_target,
  });

  const finished_at = new Date().toISOString();
  const result: AgentResult = {
    agent_id,
    verdict: out.verdict,
    started_at,
    finished_at,
    duration_ms: Date.parse(finished_at) - Date.parse(started_at),
    artifact_path: out.artifact_relpath,
    summary: out.summary,
    evidence: out.evidence,
    blockers: out.blockers,
    next_action: out.next_action,
    cycle_index: 0,
  };

  const updated: CodingRunManifest = {
    ...manifest,
    agent_results: { ...manifest.agent_results, [agent_id]: result },
  };
  saveManifest(updated);
  recordAgentFinish(updated.run_id, result);
  log(updated.run_id, {
    kind: "agent_finished",
    agent_id,
    summary: `${agent_id} → ${out.verdict}`,
    detail: { blockers: out.blockers.length, evidence: out.evidence.length },
  });
  return updated;
}

async function runStage(
  manifest: CodingRunManifest,
  stage_name: string,
  agents: readonly AgentId[],
  dispatcher: AgentDispatcher,
): Promise<CodingRunManifest> {
  // Sequential dispatch within one stage. The manifest is a single JSON file
  // on disk · true parallel dispatch here would race on saveManifest and
  // silently drop earlier agents' results (last-write-wins). Sequential
  // preserves every agent's result. If parallel dispatch becomes necessary,
  // introduce per-agent result files and merge at stage-end.
  transitionStatus(manifest.run_id, stageToStatus(stage_name), agents[0] ?? null, stage_name, `stage ${stage_name} started`);
  let cur = manifest;
  for (const a of agents) {
    cur = await runSingle(cur, a, stage_name, dispatcher, agentDefaultArtifact(a));
  }
  return cur;
}

function agentDefaultArtifact(a: AgentId): string {
  switch (a) {
    case "pm": return "ticket.md";
    case "architect": return "spec.md";
    case "builder": return "build-notes.md";
    case "tester": return "test-plan.md";
    case "debugger": return "debug-notes.md";
    case "reviewer": return "review.md";
    case "forensics": return "forensics.md";
    case "secops": return "secops.md";
    case "integrator": return "integration.md";
    case "technical-writer": return "docs-notes.md";
    case "telemetry": return "telemetry-report.md";
    case "types-guard": return "types.md";
    case "migration-reviewer": return "migration-review.md";
    case "accessibility-reviewer": return "a11y-review.md";
    case "contract-reviewer": return "contract-review.md";
  }
}

function stageToStatus(stage_name: string): PipelineStatus {
  if (stage_name.startsWith("1-")) return "pm_running";
  if (stage_name.startsWith("2-")) return "architect_running";
  if (stage_name.startsWith("3")) return "build_and_test_running";
  if (stage_name.startsWith("4")) return "gates_running";
  if (stage_name.startsWith("5")) return "gates_running";
  if (stage_name.startsWith("6")) return "gates_running";
  if (stage_name.startsWith("7")) return "integrating";
  if (stage_name.startsWith("8")) return "post_deploy_watching";
  return "gates_running";
}

function buildContext(manifest: CodingRunManifest): AgentDispatchInput["context"] {
  const dir = path.join(REPO_ROOT, manifest.artifacts_dir);
  const readIfExists = (fname: string): string | undefined => {
    const p = path.join(dir, fname);
    return existsSync(p) ? readFileSync(p, "utf8") : undefined;
  };
  return {
    founder_prompt: manifest.founder_prompt,
    ticket_md: readIfExists("ticket.md"),
    spec_md: readIfExists("spec.md"),
    build_notes_md: readIfExists("build-notes.md"),
    test_plan_md: readIfExists("test-plan.md"),
    debug_notes_md: readIfExists("debug-notes.md"),
    test_output: readIfExists("test-output.txt"),
    prior_verdicts: manifest.agent_results,
  };
}

/** Load the agent's system-prompt Markdown from `src/lib/nex-coding-team/agents/<n>-<id>.md`. */
export function readAgentPrompt(agent_id: AgentId): string {
  // Agents are numbered 01..15; scan the directory for the matching file.
  const dir = path.join(REPO_ROOT, "src", "lib", "nex-coding-team", "agents");
  const attempts: string[] = [];
  for (let i = 1; i <= 15; i++) {
    const n = String(i).padStart(2, "0");
    const candidate = path.join(dir, `${n}-${agent_id}.md`);
    attempts.push(candidate);
    if (existsSync(candidate)) return readFileSync(candidate, "utf8");
  }
  throw new Error(`agent prompt not found for ${agent_id} (looked in ${attempts.length} paths)`);
}

function maybeAbort(m: CodingRunManifest): CodingRunManifest | null {
  if (!isAborted(m.run_id)) return null;
  const rec = readAbort(m.run_id);
  log(m.run_id, {
    kind: "escalation",
    agent_id: "orchestrator",
    summary: `pipeline aborted by Founder interrupt · strategy=${rec?.strategy ?? "abort"}`,
    detail: rec ?? undefined,
  });
  return markHalted(m.run_id, "aborted");
}

function maybeHalt(m: CodingRunManifest, agents: readonly AgentId[]): CodingRunManifest | null {
  for (const agent of agents) {
    const r = m.agent_results[agent];
    if (!r) continue;
    if (r.verdict === "NEEDS_FOUNDER_INPUT") {
      return markHalted(m.run_id, "halted_needs_founder");
    }
    if (r.verdict === "REJECT" || r.verdict === "ERROR") {
      return markHalted(m.run_id, "halted_error");
    }
  }
  return null;
}

function markHalted(run_id: string, status: PipelineStatus): CodingRunManifest {
  const m = loadManifest(run_id);
  if (!m) throw new Error(`no manifest for run_id=${run_id}`);
  const next: CodingRunManifest = { ...m, status };
  saveManifest(next);
  appendEvent(run_id, {
    ts: new Date().toISOString(),
    agent_id: "orchestrator",
    verdict: status.toUpperCase(),
    summary: `pipeline halted: ${status}`,
    artifact_path: null,
  });
  // F3 wire · release the brain lease at every halt path (aborted / halted_error / halted_needs_founder).
  releaseAndOptionallyLearn(run_id, "abandoned");
  return next;
}

function finaliseDryRun(run_id: string, note: string): CodingRunManifest {
  const m = loadManifest(run_id);
  if (!m) throw new Error(`no manifest for run_id=${run_id}`);
  const next: CodingRunManifest = { ...m, status: "completed_no_merge" };
  saveManifest(next);
  appendEvent(run_id, {
    ts: new Date().toISOString(),
    agent_id: "orchestrator",
    verdict: "DRY_RUN_COMPLETE",
    summary: note,
    artifact_path: null,
  });
  // F3 wire · dry-run runs are not "completed" in the learning sense · release only.
  releaseAndOptionallyLearn(run_id, "abandoned");
  return next;
}

/** Governance check: no protected file has been touched during this run. */
export function verifyProtectedFilesUntouched(run_id: string): boolean {
  // A cheap check: consult the audit log for any file_write to a protected path.
  const logPath = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id, "logs", "run.jsonl");
  if (!existsSync(logPath)) return true;
  const lines = readFileSync(logPath, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as { kind?: string; detail?: { target_path?: string } };
      const tp = entry?.detail?.target_path;
      if (entry.kind === "file_write" && tp) {
        for (const pf of PROTECTED_FILES) {
          if (tp === pf || tp.startsWith(pf + "/")) {
            logGovernanceCheck(run_id, "protected_files_untouched", false, tp);
            return false;
          }
        }
      }
    } catch {
      /* skip malformed line */
    }
  }
  logGovernanceCheck(run_id, "protected_files_untouched", true, "audit log clean");
  return true;
}
