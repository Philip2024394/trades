// WO-WORKSTATION-11 · first complete real 3-page app end-to-end
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// The acceptance test for the entire WO-01..WO-09 chain. Given a founder
// request for a 3-page application, prove:
//   - real Ed25519 authorization signs a real WO-03 pipeline invocation
//   - real files land on real disk (WO-04 through the existing Broker)
//   - `node --check server.js` passes (WO-05 real build)
//   - `node server.js` binds a real port and answers real HTTP (WO-06)
//   - each of the 3 routes returns the intended body over the wire
//   - node-syntax specialist reports PASSED (WO-07)
//   - every report persists to real GB storage (WO-08)
//   - WO-09 diagnoseHistory reports no failures on the successful cycle
// No mocks. No fixture PASS. Zero-dependency template so the whole
// pipeline finishes in seconds.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as http from "node:http";
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
import { persistCycle, listEngineeringHistoryForTrace } from "../wo8-persist";
import { diagnoseHistory } from "../wo9-diagnoser";
import { buildThreePageAppProjectModel, buildThreePageAppFilePlan } from "../wo11-three-page-app";

const REPO_ROOT = process.cwd();

// ── Helpers ────────────────────────────────────────────────────────────

async function makeWorkspace(): Promise<string> {
  const dir = path.join(process.cwd(), "data", "nex-agent-workspaces", `wo11-test-workspace-${randomUUID()}`);
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
function httpGet(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method: "GET" }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

// Clean the WO-08 storage collections between runs so tests are isolated
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

// ── Suite ───────────────────────────────────────────────────────────────

describe("WO-WORKSTATION-11 · first real 3-page app end-to-end", () => {
  const cleanups: string[] = [];
  afterEach(async () => {
    while (cleanups.length) {
      const d = cleanups.pop();
      if (d) await cleanWorkspace(d);
    }
  });

  // ── 1 · The acceptance test itself · full chain, single test ─────────

  it(
    "founder request → authorised diff → real files → real build → real runtime → real HTTP → specialist PASSED → evidence persisted → WO-09 diagnoses no failures",
    async () => {
      await cleanWo8Collections();

      // ── Setup: founder identity, workspace, port ────────────────────
      const kp = generateKeyPair("founder-wo11-acceptance");
      const manifest: FounderKeyManifest = {
        version: "wo2.v0.1",
        keys: [buildFounderKeyRecordForTest(kp, { validFrom: "2020-01-01T00:00:00.000Z" })],
      };
      const trace_id = `wo11-trace-${Date.now()}-${randomUUID()}`;
      const project_id = "wo11-three-page-project";
      const workspace = await makeWorkspace();
      cleanups.push(workspace);
      const port = await pickFreePort();

      // ── WO-11 fixture: 3-page app plan ──────────────────────────────
      const model = buildThreePageAppProjectModel({
        project_id,
        trace_id,
        project_name: "First Three Page App",
        port,
      });
      const plan = buildThreePageAppFilePlan({
        model,
        port_env_var: "PORT",
        default_port: port,
      });

      // ── WO-02: real Ed25519 authorization ───────────────────────────
      const auth = signAuthorization({
        trace_id,
        work_order_id: "wo-workstation-11-acceptance",
        founder_key: kp,
        authorised_actions: [WO3_APPLY_DIFF_ACTION],
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        previous_authorization_hash: null,
      });

      // ── WO-03: pipeline produces AuthorisedDiffBundle ───────────────
      const wo3 = await runCodeGenerationPipeline({
        plan,
        workspace_root: workspace,
        authorization: auth,
        founder_key_manifest: manifest,
      });
      expect(wo3.ok).toBe(true);
      if (!wo3.ok) return;
      expect(wo3.bundle.candidate_files).toHaveLength(2);   // server.js + README.md
      expect(wo3.bundle.candidate_files.some((c) => c.path === "server.js")).toBe(true);

      // ── WO-04: Controlled Hands writes to real disk ─────────────────
      const wo4 = await executeAuthorisedDiffBundle({
        bundle: wo3.bundle,
        workspace_root: workspace,
        repo_root: REPO_ROOT,
        authorization: auth,
        founder_key_manifest: manifest,
        nex1_execution_instance_id: "wo11-instance",
      });
      expect(wo4.ok).toBe(true);
      if (!wo4.ok) return;
      // Verify real files on real disk with real content
      const serverAbs = path.join(workspace, "server.js");
      const readmeAbs = path.join(workspace, "README.md");
      const serverBytes = await fs.readFile(serverAbs);
      await fs.readFile(readmeAbs);
      const serverContentHash = createHash("sha256").update(serverBytes).digest("hex");
      const serverCandidate = wo3.bundle.candidate_files.find((c) => c.path === "server.js")!;
      expect(serverContentHash).toBe(serverCandidate.content_hash);

      // ── WO-05: real `node --check server.js` build ───────────────────
      const buildResult = await executeBuild({
        spec: {
          record_type: "NEX1_BUILD_SPEC",
          build_id: `wo11-build-${randomUUID()}`,
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
      expect(buildResult.ok).toBe(true);
      if (!buildResult.ok) return;
      expect(buildResult.report.exit_code).toBe(0);

      // ── WO-06: real runtime + real HTTP health check ────────────────
      const runtimeResult = await executeRuntime({
        spec: {
          record_type: "NEX1_RUNTIME_SPEC",
          run_id: `wo11-run-${randomUUID()}`,
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
      expect(runtimeResult.ok).toBe(true);
      if (!runtimeResult.ok) return;
      expect(runtimeResult.report.health?.response_status).toBe(200);
      expect(runtimeResult.report.health?.response_body_first_1kb).toContain("Welcome home");

      // ── WO-06 depth: also hit /about and /contact while runtime is
      //     available via a second start. WO-06 terminates the child at
      //     the end of each executeRuntime call, so we spin the runtime
      //     back up briefly to prove the other two routes work too.
      const port2 = await pickFreePort();
      const runtimeResult2 = await executeRuntime({
        spec: {
          record_type: "NEX1_RUNTIME_SPEC",
          run_id: `wo11-run-verify-${randomUUID()}`,
          trace_id, work_order_id: auth.work_order_id, project_id,
          executable_ref: "node",
          args: ["server.js"],
          working_directory_rel: "",
          port: port2,
          health_path: "/about",
          startup_timeout_ms: 8_000,
          startup_poll_interval_ms: 100,
          expected_status: 200,
          expected_body_substring: "About us",
          termination_grace_ms: 2_000,
          env_forward: { PORT: String(port2) },
        },
        workspace_root: workspace,
      });
      expect(runtimeResult2.ok).toBe(true);
      if (!runtimeResult2.ok) return;

      const port3 = await pickFreePort();
      const runtimeResult3 = await executeRuntime({
        spec: {
          record_type: "NEX1_RUNTIME_SPEC",
          run_id: `wo11-run-contact-${randomUUID()}`,
          trace_id, work_order_id: auth.work_order_id, project_id,
          executable_ref: "node",
          args: ["server.js"],
          working_directory_rel: "",
          port: port3,
          health_path: "/contact",
          startup_timeout_ms: 8_000,
          startup_poll_interval_ms: 100,
          expected_status: 200,
          expected_body_substring: "Get in touch",
          termination_grace_ms: 2_000,
          env_forward: { PORT: String(port3) },
        },
        workspace_root: workspace,
      });
      expect(runtimeResult3.ok).toBe(true);

      // ── WO-07: node-syntax specialist against server.js ─────────────
      const specialistResult = await runSpecialist({
        record_type: "NEX1_SPECIALIST_INVOCATION",
        invocation_id: `wo11-inv-${randomUUID()}`,
        trace_id, work_order_id: auth.work_order_id, project_id,
        kind: "node-syntax",
        workspace_root: workspace,
        targets: ["server.js"],
        timeout_ms: 15_000,
      });
      expect(specialistResult.ok).toBe(true);
      if (!specialistResult.ok) return;
      expect(specialistResult.result.status).toBe("PASSED");
      expect(specialistResult.result.tool.kind).toBe("node-syntax");

      // ── WO-08: persist every report to real GB storage ──────────────
      const persist = await persistCycle({
        execution_report: wo4.report,
        build_reports: [buildResult.report],
        runtime_reports: [runtimeResult.report, runtimeResult2.report, runtimeResult3.report],
        specialist_results: [specialistResult.result],
      });
      expect(persist.any_failed).toBe(false);

      // Verify durable persistence -- rebuild history from disk
      const history = await listEngineeringHistoryForTrace(trace_id);
      expect(history.length).toBeGreaterThanOrEqual(6);   // 1 execution + 1 build + 3 runtime + 1 specialist
      expect(history.some((e) => e.kind === "execution")).toBe(true);
      expect(history.some((e) => e.kind === "build")).toBe(true);
      expect(history.some((e) => e.kind === "runtime")).toBe(true);
      expect(history.some((e) => e.kind === "specialist")).toBe(true);

      // ── WO-09: diagnose the cycle from the persisted history ────────
      const diagnosis = diagnoseHistory({ trace_id, history });
      expect(diagnosis.has_failures).toBe(false);
      expect(diagnosis.failures).toHaveLength(0);

      // ── Final acceptance assertion ──────────────────────────────────
      // Every acceptance criterion from ADR-0319 §16 that does NOT
      // require Phase 9 (visual verification) has been satisfied by
      // real evidence written to real disk.
    },
    120_000,   // 2 min timeout for the whole chain (real runtime startup + 3 HTTP round-trips)
  );

  // ── 2 · Sanity: the 3-page-app fixture builder produces a well-shaped plan ──

  it("buildThreePageAppFilePlan produces a plan with 2 create ops and the intended template refs", () => {
    const model = buildThreePageAppProjectModel({
      project_id: "sanity",
      trace_id: "sanity-trace",
      project_name: "Sanity",
      port: 3000,
    });
    const plan = buildThreePageAppFilePlan({ model });
    expect(plan.ops).toHaveLength(2);
    expect(plan.ops[0].path).toBe("server.js");
    expect(plan.ops[0].template_ref).toBe("plain-node-server.v1");
    expect(plan.ops[1].path).toBe("README.md");
    expect(plan.ops[1].template_ref).toBe("readme.v1");
    expect(plan.trace_id).toBe("sanity-trace");
    expect(plan.project_id).toBe("sanity");
  });
});
