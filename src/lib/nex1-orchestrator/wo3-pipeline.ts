// WO-WORKSTATION-03 · end-to-end pipeline + WO-02 authorization binding
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Orchestrates the eight-stage authoring pipeline:
//
//   ProjectModel → FilePlan → Generate → SyntaxValidate → Diff →
//   Challenge → Authorise (via WO-02) → produce AuthorisedDiffBundle
//
// The final stage (Controlled Write) is deferred to WO-04 by design.
// This function only produces the bundle; WO-04 will consume it.
//
// Failure at any stage returns a PipelineResult with a specific
// reason_code so audit records exactly WHY the pipeline stopped.
// Failed generation, failed syntax, failed challenge, and failed
// authorization are all normal outcomes — none is an exception.

import { randomUUID } from "node:crypto";
import path from "node:path";
import { generate, validateSyntax, computeDiff } from "./wo3-generator";
import { challenge } from "./wo3-challenger";
import { verifyAuthorizationForAction } from "./wo2-authorization";
import type { FounderAuthorization } from "./wo2-authorization";
import type { FounderKeyManifest } from "./wo2-founder-keys";
import type {
  FilePlan,
  AuthorisedDiffBundle,
  PipelineResult,
} from "./wo3-types";

/** The specific action string a FounderAuthorization must include to
 *  admit a diff into WO-04. Callers signing a WO-02 auth for this
 *  purpose must put this in `authorised_actions`. */
export const WO3_APPLY_DIFF_ACTION = "wo3.apply_diff" as const;

export interface RunPipelineInput {
  readonly plan: FilePlan;
  readonly workspace_root: string;
  readonly authorization: FounderAuthorization;
  readonly founder_key_manifest: FounderKeyManifest;
  /** Test hook. Defaults to now(). */
  readonly atTime?: Date;
}

/**
 * Run the full WO-03 pipeline. Returns either an AuthorisedDiffBundle
 * ready for WO-04 to consume, or a specific failure result. Never
 * writes to disk. Never throws for expected-domain errors.
 */
export async function runCodeGenerationPipeline(input: RunPipelineInput): Promise<PipelineResult> {
  // 0. Workspace-root safety — must be absolute + inside the sanctioned
  //    workspace directory (data/nex-agent-workspaces/{trace_id}/...)
  //    OR a caller-declared test root. Enforced to prevent a mis-configured
  //    caller from writing anywhere on disk.
  const wsRootResolved = path.resolve(input.workspace_root);
  const wsRootOk = isWorkspaceRootAcceptable(wsRootResolved);
  if (!wsRootOk.ok) {
    return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: wsRootOk.reason };
  }

  // 1. Authorization (crypto + action scope)
  const authResult = verifyAuthorizationForAction({
    authorization: input.authorization,
    manifest: input.founder_key_manifest,
    requested_action: WO3_APPLY_DIFF_ACTION,
    atTime: input.atTime,
  });
  if (!authResult.ok) {
    const code = "reason_code" in authResult && authResult.reason_code === "ACTION_NOT_AUTHORISED"
      ? "AUTHORIZATION_MISSING_ACTION"
      : "AUTHORIZATION_INVALID";
    return { ok: false, reason_code: code, reason: authResult.reason };
  }

  // 1b. Cross-check: authorization must be for the SAME trace_id as the plan
  if (input.authorization.trace_id !== input.plan.trace_id) {
    return {
      ok: false,
      reason_code: "AUTHORIZATION_INVALID",
      reason: `authorization is for trace_id ${input.authorization.trace_id} but plan is for trace_id ${input.plan.trace_id}`,
    };
  }

  // 2. Generate
  const genResult = generate(input.plan);
  if (!genResult.ok) {
    return { ok: false, reason_code: "GENERATION_FAILED", reason: genResult.reason, failed_path: genResult.failed_path };
  }

  // 3. Syntax validate every candidate before further work
  for (const candidate of genResult.candidates) {
    const syn = validateSyntax(candidate);
    if (!syn.ok) {
      return { ok: false, reason_code: "SYNTAX_INVALID", reason: syn.reason, failed_path: syn.path };
    }
  }

  // 4. Diff against current workspace state (read-only)
  const diff = await computeDiff({
    plan: input.plan,
    candidates: genResult.candidates,
    workspace_root: wsRootResolved,
  });

  // 5. Challenge (deterministic rules)
  const challengeResult = challenge({
    plan: input.plan,
    candidates: genResult.candidates,
  });
  if (!challengeResult.ok) {
    return {
      ok: false,
      reason_code: "CHALLENGE_FAILED",
      reason: `challenger raised ${challengeResult.findings.length} finding(s): ${challengeResult.findings.map((f) => f.code).join(", ")}`,
      findings: challengeResult.findings,
    };
  }

  // 6. Mint the AuthorisedDiffBundle
  const bundle: AuthorisedDiffBundle = {
    record_type: "NEX1_AUTHORISED_DIFF_BUNDLE",
    bundle_id: `wo3-bundle-${randomUUID()}`,
    project_id: input.plan.project_id,
    trace_id: input.plan.trace_id,
    diff,
    candidate_files: genResult.candidates,
    authorization_id: input.authorization.authorization_id,
    founder_key_id: input.authorization.founder_key_id,
    authorised_action: WO3_APPLY_DIFF_ACTION,
    created_at: new Date().toISOString(),
  };
  return { ok: true, bundle };
}

// ── Workspace-root safety ──────────────────────────────────────────────

/**
 * Workspace roots must live under the sanctioned NEX agent workspace
 * directory OR under a designated test-only path. This prevents a
 * caller supplying `workspace_root: "/"` and having the diff
 * reference paths anywhere on disk.
 *
 * Accepted:
 *   {cwd}/data/nex-agent-workspaces/**   (production)
 *   {os tmp}/**                          (tests)
 *   any path containing 'wo3-test-workspace-'  (explicit test opt-in)
 */
function isWorkspaceRootAcceptable(resolved: string): { ok: true } | { ok: false; reason: string } {
  const sanctioned = path.resolve(process.cwd(), "data", "nex-agent-workspaces");
  const normalisedResolved = resolved.replace(/\\/g, "/");
  const normalisedSanctioned = sanctioned.replace(/\\/g, "/");
  if (normalisedResolved === normalisedSanctioned || normalisedResolved.startsWith(normalisedSanctioned + "/")) {
    return { ok: true };
  }
  // Test path allowance
  const tmpdir = (process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? "/tmp").replace(/\\/g, "/");
  if (normalisedResolved.startsWith(tmpdir + "/") || normalisedResolved === tmpdir) {
    return { ok: true };
  }
  if (normalisedResolved.includes("/wo3-test-workspace-")) {
    return { ok: true };
  }
  return { ok: false, reason: `workspace_root ${resolved} is not under sanctioned directory ${sanctioned}` };
}
