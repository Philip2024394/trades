// WO-WORKSTATION-12 · real failure-driven correction cycle demonstration
//
// Founder-authorised 2026-09-13 per WO-12 specification.
//
// This test proves the single capability that WO-01..WO-11 did NOT yet
// demonstrate: a real subprocess failure driven back to a verified green
// state by the actual NEX correction machinery.
//
// The rules for this test are strict:
//   - The test harness may INJECT the failure (delete a planned file).
//   - The test harness may NOT repair the failure.
//   - Every diagnosis, correction, mutation, rebuild, runtime and
//     validation must be performed by the real WO-04..WO-09 code paths.
//   - No mocks. No synthetic reports. No hardcoded PASS.
//   - No LLM.
//
// If any of the above is violated the test is invalid.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { generateKeyPair } from "@/lib/nex-controlled-hands/ed25519";
import { buildFounderKeyRecordForTest, type FounderKeyManifest } from "../wo2-founder-keys";
import { signAuthorization } from "../wo2-authorization";
import { runCodeGenerationPipeline, WO3_APPLY_DIFF_ACTION } from "../wo3-pipeline";
import { executeAuthorisedDiffBundle } from "../wo4-executor";
import { executeBuild } from "../wo5-executor";
import { executeRuntime } from "../wo6-runtime-executor";
import { runSpecialist } from "../wo7-run-specialist";
import {
  persistCycle,
  listEngineeringHistoryForTrace,
  listBuildReportsForTrace,
  listSpecialistResultsForTrace,
} from "../wo8-persist";
import { diagnoseHistory } from "../wo9-diagnoser";
import { proposeCorrection, initialCorrectionCycleState, advanceCycleState } from "../wo9-corrector";
import { buildThreePageAppProjectModel, buildThreePageAppFilePlan } from "../wo11-three-page-app";

const REPO_ROOT = process.cwd();

async function makeWorkspace(): Promise<string> {
  const dir = path.join(process.cwd(), "data", "nex-agent-workspaces", `wo12-test-workspace-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
async function cleanWorkspace(dir: string): Promise<void> {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ok */ }
}
async function pickFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("could not determine port")));
      }
    });
  });
}
const STORAGE_ROOT = path.join(process.cwd(), "data", "nex-storage");
async function cleanWo8Collections(): Promise<void> {
  const files = [
    "nex1_execution_reports.jsonl",
    "nex1_build_reports.jsonl",
    "nex1_runtime_reports.jsonl",
    "nex1_specialist_results.jsonl",
  ];
  for (const f of files) {
    try { await fs.unlink(path.join(STORAGE_ROOT, f)); } catch { /* ok */ }
  }
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

describe("WO-WORKSTATION-12 · real failure-driven correction cycle", () => {
  const cleanups: string[] = [];
  afterEach(async () => {
    while (cleanups.length) {
      const d = cleanups.pop();
      if (d) await cleanWorkspace(d);
    }
  });

  it(
    "REAL FAILURE (deleted file) → REAL DIAGNOSIS → REAL CORRECTION → REAL REBUILD → REAL RUNTIME → REAL GREEN",
    async () => {
      await cleanWo8Collections();

      // ── SETUP ─────────────────────────────────────────────────────────
      const kp = generateKeyPair("founder-wo12-cycle");
      const manifest: FounderKeyManifest = {
        version: "wo2.v0.1",
        keys: [buildFounderKeyRecordForTest(kp, { validFrom: "2020-01-01T00:00:00.000Z" })],
      };
      const trace_id = `wo12-trace-${Date.now()}-${randomUUID()}`;
      const project_id = "wo12-three-page-project";
      const workspace = await makeWorkspace();
      cleanups.push(workspace);
      const port = await pickFreePort();

      // 3-page app plan (same shape as WO-11 acceptance test)
      const model = buildThreePageAppProjectModel({
        project_id, trace_id,
        project_name: "WO-12 Correction Cycle Demo",
        port,
      });
      const originalPlan = buildThreePageAppFilePlan({
        model, port_env_var: "PORT", default_port: port,
      });

      // Real Ed25519 authorization — same envelope used for BOTH cycles.
      // The re-authorisation happens because verifyAuthorizationForAction
      // is called by runCodeGenerationPipeline on EVERY invocation.
      const auth = signAuthorization({
        trace_id,
        work_order_id: "wo-workstation-12",
        founder_key: kp,
        authorised_actions: [WO3_APPLY_DIFF_ACTION],
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        previous_authorization_hash: null,
      });

      // ═════════════════════════════════════════════════════════════════
      // CYCLE 0 · initial authoring → files land → fault injected
      // ═════════════════════════════════════════════════════════════════
      const cycleState0 = initialCorrectionCycleState({ trace_id });
      expect(cycleState0.attempts).toBe(0);

      const wo3Cycle0 = await runCodeGenerationPipeline({
        plan: originalPlan,
        workspace_root: workspace,
        authorization: auth,
        founder_key_manifest: manifest,
      });
      expect(wo3Cycle0.ok).toBe(true);
      if (!wo3Cycle0.ok) return;

      const wo4Cycle0 = await executeAuthorisedDiffBundle({
        bundle: wo3Cycle0.bundle,
        workspace_root: workspace,
        repo_root: REPO_ROOT,
        authorization: auth,
        founder_key_manifest: manifest,
        nex1_execution_instance_id: "wo12-cycle0",
      });
      expect(wo4Cycle0.ok).toBe(true);
      if (!wo4Cycle0.ok) return;

      const serverAbs = path.join(workspace, "server.js");
      const readmeAbs = path.join(workspace, "README.md");
      expect(await fileExists(serverAbs)).toBe(true);
      expect(await fileExists(readmeAbs)).toBe(true);

      // Capture the intended content hash so we can prove NEX (not the
      // test harness) restores the file with the same content later.
      const serverContentBeforeDeletion = await fs.readFile(serverAbs);
      const intendedContentHash = createHash("sha256").update(serverContentBeforeDeletion).digest("hex");

      // ── TEST-HARNESS FAULT INJECTION ─────────────────────────────────
      // This is the ONLY test-harness intervention allowed. Every other
      // step is real NEX code.
      await fs.unlink(serverAbs);
      expect(await fileExists(serverAbs)).toBe(false);
      expect(await fileExists(readmeAbs)).toBe(true);   // adjacent file untouched — proves the deletion was scoped

      // ═════════════════════════════════════════════════════════════════
      // CYCLE 0 continued · attempt to build/validate the broken workspace
      // ═════════════════════════════════════════════════════════════════

      // Real WO-05 build — MUST fail via real subprocess
      const failedBuild = await executeBuild({
        spec: {
          record_type: "NEX1_BUILD_SPEC",
          build_id: `wo12-build-cycle0-${randomUUID()}`,
          trace_id, work_order_id: auth.work_order_id, project_id,
          executable_ref: "node",
          args: ["--check", "server.js"],
          working_directory_rel: "",
          timeout_ms: 10_000,
          env_forward: {},
          expected_exit_code: 0,
        },
        workspace_root: workspace,
      });
      // Assert the failure is real
      expect(failedBuild.ok).toBe(false);
      if (failedBuild.ok) return;
      expect(failedBuild.reason_code).toBe("EXIT_CODE_NONZERO");
      expect(failedBuild.report).toBeDefined();
      expect(failedBuild.report!.exit_code).not.toBe(0);
      // The subprocess emitted the ENOENT / "Cannot find module" pattern
      expect(failedBuild.report!.stderr).toMatch(/Cannot find module|ENOENT|no such file or directory/i);

      // Real WO-07 specialist — MUST fail via real subprocess
      const failedSpecialist = await runSpecialist({
        record_type: "NEX1_SPECIALIST_INVOCATION",
        invocation_id: `wo12-spec-cycle0-${randomUUID()}`,
        trace_id, work_order_id: auth.work_order_id, project_id,
        kind: "node-syntax",
        workspace_root: workspace,
        targets: ["server.js"],
        timeout_ms: 15_000,
      });
      expect(failedSpecialist.ok).toBe(true);           // runner ran
      if (!failedSpecialist.ok) return;
      expect(failedSpecialist.result.status).toBe("FAILED");   // specialist reports failure
      expect(failedSpecialist.result.status).not.toBe("PASSED");   // UNAVAILABLE≠PASSED discipline explicit assertion
      // The finding must carry a file-not-found signal via the (extended
      // in this WO-12 commit) parseNodeSyntaxError parser
      expect(failedSpecialist.result.findings.length).toBeGreaterThan(0);
      const finding = failedSpecialist.result.findings[0];
      expect(finding.rule).toBe("file-not-found");
      expect(finding.message).toMatch(/ENOENT|no such file/i);

      // Persist real failure evidence — WO-08 through the actual GB storage
      const persist0 = await persistCycle({
        execution_report: wo4Cycle0.report,
        build_reports: [failedBuild.report!],
        runtime_reports: [],                    // no runtime attempted (build failed first)
        specialist_results: [failedSpecialist.result],
      });
      expect(persist0.any_failed).toBe(false);

      // Real WO-09 diagnosis — must classify the failures we just persisted
      const history0 = await listEngineeringHistoryForTrace(trace_id);
      const diagnosis0 = diagnoseHistory({ trace_id, history: history0 });
      expect(diagnosis0.has_failures).toBe(true);

      // Both build and specialist failures should be present
      const kinds0 = diagnosis0.failures.map((f) => f.kind).sort();
      expect(kinds0).toContain("build_failed");
      expect(kinds0).toContain("specialist_failed");

      // Both should carry missing_target_file signals — build from stderr,
      // specialist from the parsed finding
      const buildFailure = diagnosis0.failures.find((f) => f.kind === "build_failed");
      const specFailure = diagnosis0.failures.find((f) => f.kind === "specialist_failed");
      expect(buildFailure).toBeDefined();
      expect(specFailure).toBeDefined();
      if (buildFailure?.kind !== "build_failed") return;
      if (specFailure?.kind !== "specialist_failed") return;
      expect(buildFailure.signals.some((s) => s.kind === "missing_target_file")).toBe(true);
      expect(specFailure.signals.some((s) => s.kind === "missing_target_file")).toBe(true);

      // Real correction proposal — deterministic rule must fire
      const proposal = proposeCorrection({
        diagnosis: diagnosis0,
        previous_plan: originalPlan,
        cycle_state: cycleState0,
      });
      expect(proposal.ok).toBe(true);
      if (!proposal.ok) return;
      expect(proposal.kind).toBe("reinvoke_plan_missing_files");
      expect(proposal.rules_applied).toContain("REINVOKE_PLAN_MISSING_FILES");

      // ── P-Q ASSERTIONS · authority preservation ──────────────────────
      // The corrective plan must preserve trace identity + not expand the
      // authorised path set.
      const nextPlan = proposal.next_plan;
      expect(nextPlan.trace_id).toBe(originalPlan.trace_id);
      expect(nextPlan.project_id).toBe(originalPlan.project_id);
      expect(nextPlan.plan_id).not.toBe(originalPlan.plan_id);          // fresh plan_id
      // Same op paths — no expansion, no new files
      const originalPaths = originalPlan.ops.map((op) => op.path).sort();
      const correctivePaths = nextPlan.ops.map((op) => op.path).sort();
      expect(correctivePaths).toEqual(originalPaths);
      // Same template refs — no new capabilities
      const originalTemplates = originalPlan.ops.map((op) => op.template_ref).sort();
      const correctiveTemplates = nextPlan.ops.map((op) => op.template_ref).sort();
      expect(correctiveTemplates).toEqual(originalTemplates);

      const cycleState1 = advanceCycleState(cycleState0, proposal.rules_applied);
      expect(cycleState1.attempts).toBe(1);
      expect(cycleState1.rule_history).toContain("REINVOKE_PLAN_MISSING_FILES");

      // ═════════════════════════════════════════════════════════════════
      // CYCLE 1 · corrective execution via the SAME NEX code paths
      // ═════════════════════════════════════════════════════════════════

      // ── RE-AUTHORIZATION ────────────────────────────────────────────
      // runCodeGenerationPipeline calls verifyAuthorizationForAction on
      // EVERY invocation. So passing the corrective plan through it is a
      // real re-authorisation event — the crypto verification, the
      // action-scope check, and the trace_id match check ALL run again.
      const wo3Cycle1 = await runCodeGenerationPipeline({
        plan: nextPlan,
        workspace_root: workspace,
        authorization: auth,                  // same signed envelope; re-verified now
        founder_key_manifest: manifest,
      });
      expect(wo3Cycle1.ok).toBe(true);
      if (!wo3Cycle1.ok) return;
      // The bundle from the corrective pipeline is DIFFERENT from cycle 0
      // (fresh bundle_id, fresh diff, new digest) but for the SAME trace
      expect(wo3Cycle1.bundle.bundle_id).not.toBe(wo3Cycle0.bundle.bundle_id);
      expect(wo3Cycle1.bundle.trace_id).toBe(trace_id);

      // Real repair via NEX authoring/write — NOT via the test harness
      const wo4Cycle1 = await executeAuthorisedDiffBundle({
        bundle: wo3Cycle1.bundle,
        workspace_root: workspace,
        repo_root: REPO_ROOT,
        authorization: auth,
        founder_key_manifest: manifest,
        nex1_execution_instance_id: "wo12-cycle1",
      });
      expect(wo4Cycle1.ok).toBe(true);
      if (!wo4Cycle1.ok) return;

      // Server.js is back on disk. Verify the content hash matches the
      // originally-intended content — proves NEX (not the test harness)
      // restored the file, and that the restored content is byte-identical
      // to what was originally authored.
      expect(await fileExists(serverAbs)).toBe(true);
      const serverContentAfterRestoration = await fs.readFile(serverAbs);
      const restoredHash = createHash("sha256").update(serverContentAfterRestoration).digest("hex");
      expect(restoredHash).toBe(intendedContentHash);

      // Real WO-05 rebuild — must succeed now
      const successBuild = await executeBuild({
        spec: {
          record_type: "NEX1_BUILD_SPEC",
          build_id: `wo12-build-cycle1-${randomUUID()}`,
          trace_id, work_order_id: auth.work_order_id, project_id,
          executable_ref: "node",
          args: ["--check", "server.js"],
          working_directory_rel: "",
          timeout_ms: 10_000,
          env_forward: {},
          expected_exit_code: 0,
        },
        workspace_root: workspace,
      });
      expect(successBuild.ok).toBe(true);
      if (!successBuild.ok) return;
      expect(successBuild.report.exit_code).toBe(0);

      // Real WO-06 runtime + HTTP verification
      const successRuntime = await executeRuntime({
        spec: {
          record_type: "NEX1_RUNTIME_SPEC",
          run_id: `wo12-run-cycle1-${randomUUID()}`,
          trace_id, work_order_id: auth.work_order_id, project_id,
          executable_ref: "node",
          args: ["server.js"],
          working_directory_rel: "",
          port,
          health_path: "/",
          startup_timeout_ms: 8_000,
          startup_poll_interval_ms: 100,
          expected_status: 200,
          expected_body_substring: "Welcome home",
          termination_grace_ms: 2_000,
          env_forward: { PORT: String(port) },
        },
        workspace_root: workspace,
      });
      expect(successRuntime.ok).toBe(true);
      if (!successRuntime.ok) return;
      expect(successRuntime.report.health?.response_status).toBe(200);

      // Real WO-07 specialist re-run — must PASS now
      const successSpecialist = await runSpecialist({
        record_type: "NEX1_SPECIALIST_INVOCATION",
        invocation_id: `wo12-spec-cycle1-${randomUUID()}`,
        trace_id, work_order_id: auth.work_order_id, project_id,
        kind: "node-syntax",
        workspace_root: workspace,
        targets: ["server.js"],
        timeout_ms: 15_000,
      });
      expect(successSpecialist.ok).toBe(true);
      if (!successSpecialist.ok) return;
      expect(successSpecialist.result.status).toBe("PASSED");

      // Persist successful cycle
      const persist1 = await persistCycle({
        execution_report: wo4Cycle1.report,
        build_reports: [successBuild.report],
        runtime_reports: [successRuntime.report],
        specialist_results: [successSpecialist.result],
      });
      expect(persist1.any_failed).toBe(false);

      // ═════════════════════════════════════════════════════════════════
      // FINAL VERIFICATION · history contains BOTH cycles, latest is green
      // ═════════════════════════════════════════════════════════════════

      const fullHistory = await listEngineeringHistoryForTrace(trace_id);
      // At least: 2 execution + 2 build + 1 runtime + 2 specialist = 7 entries
      expect(fullHistory.length).toBeGreaterThanOrEqual(7);

      const allBuilds = await listBuildReportsForTrace(trace_id);
      const failedBuilds = allBuilds.filter((b) => b.exit_code !== 0);
      const passedBuilds = allBuilds.filter((b) => b.exit_code === 0);
      expect(failedBuilds.length).toBe(1);
      expect(passedBuilds.length).toBe(1);

      const allSpecialists = await listSpecialistResultsForTrace(trace_id);
      const failedSpecs = allSpecialists.filter((s) => s.status === "FAILED");
      const passedSpecs = allSpecialists.filter((s) => s.status === "PASSED");
      expect(failedSpecs.length).toBe(1);
      expect(passedSpecs.length).toBe(1);

      // Diagnose just the CYCLE 1 entries — must be clean
      const cycle1Entries = fullHistory.filter((entry) => {
        const t = entry.kind === "specialist" ? entry.started_at : entry.started_at;
        return t >= wo4Cycle1.report.started_at;
      });
      const cycle1Diagnosis = diagnoseHistory({ trace_id, history: cycle1Entries });
      expect(cycle1Diagnosis.has_failures).toBe(false);

      // Bounds discipline · attempt count did not run away
      expect(cycleState1.attempts).toBeLessThan(cycleState1.max_attempts);
    },
    120_000,   // 2 min timeout for the whole 2-cycle chain
  );

  // ─────────────────────────────────────────────────────────────────────
  // WO-12-PQ-AUTHORITY-PRESERVATION · adversarial check
  //
  // A hand-crafted "corrective" plan that tries to expand authority
  // (adds a path outside the sanctioned workspace via .. traversal)
  // must be REJECTED at the WO-03 challenger stage. This proves that
  // even if the corrector were compromised or a malicious actor forged
  // a next_plan, the substrate's independent checks catch it.
  // ─────────────────────────────────────────────────────────────────────
  it(
    "PQ · a corrective plan attempting to expand authority is REJECTED (not silently allowed)",
    async () => {
      await cleanWo8Collections();

      const kp = generateKeyPair("founder-wo12-pq");
      const manifest: FounderKeyManifest = {
        version: "wo2.v0.1",
        keys: [buildFounderKeyRecordForTest(kp, { validFrom: "2020-01-01T00:00:00.000Z" })],
      };
      const trace_id = `wo12-pq-trace-${Date.now()}-${randomUUID()}`;
      const workspace = await makeWorkspace();
      cleanups.push(workspace);
      const port = await pickFreePort();

      const model = buildThreePageAppProjectModel({
        project_id: "wo12-pq-project", trace_id,
        project_name: "PQ",
        port,
      });
      const originalPlan = buildThreePageAppFilePlan({ model, port_env_var: "PORT", default_port: port });

      const auth = signAuthorization({
        trace_id,
        work_order_id: "wo-workstation-12-pq",
        founder_key: kp,
        authorised_actions: [WO3_APPLY_DIFF_ACTION],
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        previous_authorization_hash: null,
      });

      // Hand-craft a "corrective" plan that adds an out-of-scope path.
      // This is what a compromised corrector or malicious actor might try.
      const maliciousPlan = {
        ...originalPlan,
        plan_id: `wo12-pq-malicious-${randomUUID()}`,
        ops: [
          ...originalPlan.ops,
          {
            kind: "create" as const,
            path: "../escape-outside-workspace.txt",  // <- ADD an out-of-scope path
            template_ref: "plain-text.v1",
            template_params: { body: "if this file lands, authority was expanded" },
            reason: "malicious authority expansion attempt",
          },
        ],
        created_at: new Date().toISOString(),
      };

      // Submit through the actual authorisation + challenger path
      const result = await runCodeGenerationPipeline({
        plan: maliciousPlan,
        workspace_root: workspace,
        authorization: auth,           // valid auth for wo3.apply_diff
        founder_key_manifest: manifest,
      });

      // The substrate MUST reject this — the auth is valid but the
      // challenger enforces path-scope independently.
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason_code).toBe("CHALLENGE_FAILED");
      // The specific finding should call out the path escape
      expect(result.findings?.some((f) => f.code === "PATH_ESCAPES_WORKSPACE")).toBe(true);

      // Prove that the escape file was NEVER created on disk
      const escapeAbs = path.join(path.dirname(workspace), "escape-outside-workspace.txt");
      expect(await fileExists(escapeAbs)).toBe(false);
    },
    30_000,
  );
});
