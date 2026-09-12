// WO-WORKSTATION-07 · real specialist adapter acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Every test invokes a REAL underlying tool via WO-05's executeBuild
// (real child_process.spawn). No mocks. No fixture PASS. Availability
// discipline is checked explicitly — if a tool is not installed in the
// target workspace, the adapter MUST return UNAVAILABLE, not PASSED.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runSpecialist, _wo7_writeTestFile } from "../wo7-run-specialist";
import type { SpecialistInvocation, SpecialistKind } from "../wo7-types";

async function makeWorkspace(): Promise<string> {
  const dir = path.join(process.cwd(), "data", "nex-agent-workspaces", `wo7-test-workspace-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
async function cleanWorkspace(dir: string): Promise<void> {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ok */ }
}

let COUNTER = 0;
function baseInvocation(workspace: string, kind: SpecialistKind, targets: readonly string[] = [], timeout_ms = 30_000): SpecialistInvocation {
  COUNTER++;
  return {
    record_type: "NEX1_SPECIALIST_INVOCATION",
    invocation_id: `wo7-inv-${COUNTER}-${Date.now()}`,
    trace_id: `wo7-trace-${COUNTER}`,
    work_order_id: "wo-workstation-07",
    project_id: `wo7-project-${COUNTER}`,
    kind,
    workspace_root: workspace,
    targets,
    timeout_ms,
  };
}

describe("WO-WORKSTATION-07 · real specialist adapters", () => {
  const cleanups: string[] = [];
  afterEach(async () => {
    while (cleanups.length) {
      const d = cleanups.pop();
      if (d) await cleanWorkspace(d);
    }
  });

  // ── 1 · Runner-level validation ──────────────────────────────────────

  it("UNKNOWN_KIND when kind is not registered", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const inv = { ...baseInvocation(ws, "node-syntax"), kind: "not-a-real-tool" as unknown as SpecialistKind };
    const result = await runSpecialist(inv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("UNKNOWN_KIND");
  });

  it("INVOCATION_INVALID when timeout_ms is invalid", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const inv = baseInvocation(ws, "node-syntax", ["x.js"], 0);
    const result = await runSpecialist(inv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("INVOCATION_INVALID");
  });

  // ── 2 · node-syntax adapter (always available; happy path) ───────────

  it("node-syntax PASSED on a valid .js file", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await _wo7_writeTestFile(ws, "hello.js", "const x = 1; module.exports = x;\n");
    const outcome = await runSpecialist(baseInvocation(ws, "node-syntax", ["hello.js"]));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.status).toBe("PASSED");
    expect(outcome.result.exit_code).toBe(0);
    expect(outcome.result.findings).toHaveLength(0);
    expect(outcome.result.tool.kind).toBe("node-syntax");
    expect(outcome.result.tool.resolved_version).toBe(process.version);
    expect(outcome.result.evidence_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("node-syntax FAILED on a broken .js file with a parsed finding", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await _wo7_writeTestFile(ws, "broken.js", "const x = ;\n");
    const outcome = await runSpecialist(baseInvocation(ws, "node-syntax", ["broken.js"]));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.status).toBe("FAILED");
    expect(outcome.result.exit_code).not.toBe(0);
    expect(outcome.result.findings.length).toBeGreaterThan(0);
    const first = outcome.result.findings[0];
    expect(first.severity).toBe("error");
    expect(first.rule).toBe("syntax-error");
    expect(first.message).toMatch(/Unexpected|SyntaxError/i);
    expect(first.path).toBe("broken.js");
  });

  it("node-syntax DENIED when no targets are supplied", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const outcome = await runSpecialist(baseInvocation(ws, "node-syntax", []));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.status).toBe("DENIED");
    expect(outcome.result.exit_code).toBeNull();
    expect(outcome.result.non_execution_reason).toContain("no --check target");
  });

  it("node-syntax runs multiple files and any failure fails the batch", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await _wo7_writeTestFile(ws, "ok.js", "const a = 1;\n");
    await _wo7_writeTestFile(ws, "bad.js", "const b = ;\n");
    const outcome = await runSpecialist(baseInvocation(ws, "node-syntax", ["ok.js", "bad.js"]));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.status).toBe("FAILED");
    // A finding should identify the bad file
    expect(outcome.result.findings.some((f) => f.path === "bad.js")).toBe(true);
  });

  // ── 3 · UNAVAILABLE discipline (the ADR-0319 §13 must-never-lie rule) ─

  it("tsc UNAVAILABLE in a workspace with no TypeScript installed — NOT PASSED", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    // Empty workspace — no package.json, no node_modules. Definitely no tsc.
    const outcome = await runSpecialist(baseInvocation(ws, "tsc", []));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The critical assertion: the adapter DID NOT return PASSED
    expect(outcome.result.status).not.toBe("PASSED");
    // Legitimate outcomes when tsc isn't installed:
    // UNAVAILABLE (npx --no-install exited non-zero on probe) OR
    // TIMED_OUT (unlikely at 30s but possible on a slow first probe)
    expect(["UNAVAILABLE", "TIMED_OUT"]).toContain(outcome.result.status);
    expect(outcome.result.tool.kind).toBe("tsc");
  });

  it("eslint UNAVAILABLE in an empty workspace — NOT PASSED", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const outcome = await runSpecialist(baseInvocation(ws, "eslint", []));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.status).not.toBe("PASSED");
    expect(["UNAVAILABLE", "TIMED_OUT"]).toContain(outcome.result.status);
  });

  it("vitest UNAVAILABLE in an empty workspace — NOT PASSED", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const outcome = await runSpecialist(baseInvocation(ws, "vitest", []));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.status).not.toBe("PASSED");
    expect(["UNAVAILABLE", "TIMED_OUT"]).toContain(outcome.result.status);
  });

  // ── 4 · Never convert UNAVAILABLE into PASSED · explicit contract ────

  it("adapter contract: UNAVAILABLE result never carries findings or a zero exit_code presented as PASSED", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    // Force UNAVAILABLE for tsc (empty workspace)
    const outcome = await runSpecialist(baseInvocation(ws, "tsc", []));
    if (!outcome.ok) throw new Error("runner should still succeed even for unavailable tool");
    if (outcome.result.status === "UNAVAILABLE") {
      // The status is honest: UNAVAILABLE, not PASSED
      expect(outcome.result.status).toBe("UNAVAILABLE");
      // non_execution_reason must be populated
      expect(outcome.result.non_execution_reason).toBeTruthy();
      // findings must be empty when the tool never ran
      expect(outcome.result.findings).toHaveLength(0);
    }
    // If instead it timed out, the status must not be PASSED either
    expect(outcome.result.status).not.toBe("PASSED");
  });

  // ── 5 · Tool identity + evidence hash ────────────────────────────────

  it("every SpecialistResult includes tool identity and a real evidence_hash", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await _wo7_writeTestFile(ws, "hello.js", "const x = 1;\n");
    const outcome = await runSpecialist(baseInvocation(ws, "node-syntax", ["hello.js"]));
    if (!outcome.ok) throw new Error("expected happy path");
    expect(outcome.result.tool.display_name).toContain("Node syntax check");
    expect(outcome.result.tool.command).toContain("node --check");
    expect(outcome.result.tool.resolved_version).toBe(process.version);
    expect(outcome.result.evidence_hash).toMatch(/^[0-9a-f]{64}$/);
    // Same invocation → different result_id (uuid) but the evidence_hash
    // depends only on {kind, command, exit_code, status, stdout, stderr,
    // findings} — with deterministic tool output the hash is stable
    const outcome2 = await runSpecialist(baseInvocation(ws, "node-syntax", ["hello.js"]));
    if (!outcome2.ok) throw new Error("expected happy path");
    expect(outcome2.result.evidence_hash).toBe(outcome.result.evidence_hash);
  });

  it("carries trace_id / work_order_id / project_id / invocation_id in the result", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await _wo7_writeTestFile(ws, "hello.js", "const x = 1;\n");
    const inv = {
      ...baseInvocation(ws, "node-syntax", ["hello.js"]),
      trace_id: "trace-t7",
      work_order_id: "wo-t7",
      project_id: "proj-t7",
      invocation_id: "inv-t7",
    };
    const outcome = await runSpecialist(inv);
    if (!outcome.ok) throw new Error("expected happy path");
    expect(outcome.result.trace_id).toBe("trace-t7");
    expect(outcome.result.work_order_id).toBe("wo-t7");
    expect(outcome.result.project_id).toBe("proj-t7");
    expect(outcome.result.invocation_id).toBe("inv-t7");
  });

  // ── 6 · Duration + timestamps captured ───────────────────────────────

  it("duration_ms and started_at / completed_at are populated", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await _wo7_writeTestFile(ws, "hello.js", "const x = 1;\n");
    const outcome = await runSpecialist(baseInvocation(ws, "node-syntax", ["hello.js"]));
    if (!outcome.ok) throw new Error("expected happy path");
    expect(outcome.result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(new Date(outcome.result.started_at).getTime()).toBeGreaterThan(0);
    expect(new Date(outcome.result.completed_at).getTime()).toBeGreaterThanOrEqual(new Date(outcome.result.started_at).getTime());
  });
});
