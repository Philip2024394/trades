// WO-WORKSTATION-05 · real build execution acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Real child processes, real exit codes, real stdout/stderr, real files.
// Uses `node -e` for speed (real process, ~50 ms each) rather than
// `next build` (5-10 min). Real `next build` is WO-11 acceptance territory.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { executeBuild, captureWorkspaceBaseline, STDOUT_CAP_BYTES } from "../wo5-executor";
import { resolveAllowedExecutable, listAllowedExecutableRefs, _wo5_resetAllowedExecutablesCache } from "../wo5-allowed-executables";
import type { BuildSpec } from "../wo5-types";

async function makeWorkspace(): Promise<string> {
  const dir = path.join(process.cwd(), "data", "nex-agent-workspaces", `wo5-test-workspace-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
async function cleanWorkspace(dir: string): Promise<void> {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ok */ }
}

let COUNTER = 0;
function baseSpec(overrides: Partial<BuildSpec> = {}): BuildSpec {
  COUNTER++;
  return {
    record_type: "NEX1_BUILD_SPEC",
    build_id: `wo5-build-${COUNTER}-${Date.now()}`,
    trace_id: `wo5-trace-${COUNTER}`,
    work_order_id: "wo-workstation-05",
    project_id: `wo5-project-${COUNTER}`,
    executable_ref: "node",
    args: ["--version"],
    working_directory_rel: "",
    timeout_ms: 10_000,
    env_forward: {},
    expected_exit_code: 0,
    ...overrides,
  };
}

describe("WO-WORKSTATION-05 · real build execution", () => {
  const cleanups: string[] = [];
  afterEach(async () => {
    while (cleanups.length) {
      const d = cleanups.pop();
      if (d) await cleanWorkspace(d);
    }
  });

  // ── 1 · Allowed-executables registry ─────────────────────────────────

  it("listAllowedExecutableRefs returns node, npm, npx", () => {
    const refs = listAllowedExecutableRefs();
    expect(refs).toContain("node");
    expect(refs).toContain("npm");
    expect(refs).toContain("npx");
  });

  it("resolveAllowedExecutable resolves 'node' to process.execPath", async () => {
    _wo5_resetAllowedExecutablesCache();
    const r = await resolveAllowedExecutable("node");
    expect(r.absolute_path).toBe(process.execPath);
  });

  // ── 2 · Happy path · real child process, real exit code ──────────────

  it("runs node --version and captures stdout + exit code 0", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({ spec: baseSpec({ args: ["--version"] }), workspace_root: ws });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.exit_code).toBe(0);
    expect(result.report.signal).toBeNull();
    expect(result.report.stdout).toMatch(/^v\d+\.\d+\.\d+/); // e.g. v24.18.0
    expect(result.report.stdout_truncated).toBe(false);
    expect(result.report.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.report.executable_absolute_path).toBe(process.execPath);
  });

  it("runs node -e 'console.log ok' and captures stdout exactly", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({ args: ["-e", "console.log('wo5-marker-abc')"] }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.stdout.trim()).toBe("wo5-marker-abc");
  });

  // ── 3 · Failure paths · every reason_code exercised ──────────────────

  it("rejects an unknown executable_ref", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      // Deliberately cast to bypass the type check for the runtime guard test
      spec: baseSpec({ executable_ref: "curl" as unknown as BuildSpec["executable_ref"] }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("EXECUTABLE_NOT_ALLOWED");
  });

  it("captures non-zero exit code + stderr on failure", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({ args: ["-e", "process.stderr.write('boom\\n'); process.exit(3);"] }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("EXIT_CODE_NONZERO");
    expect(result.report).toBeDefined();
    expect(result.report!.exit_code).toBe(3);
    expect(result.report!.stderr).toContain("boom");
  });

  it("detects EXIT_CODE_MISMATCH when expected != actual (both zero acceptable)", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({ args: ["-e", "process.exit(0)"], expected_exit_code: 42 }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Actual was 0, expected was 42 → EXIT_CODE_MISMATCH (not NONZERO because actual==0)
    expect(result.reason_code).toBe("EXIT_CODE_MISMATCH");
  });

  it("enforces timeout by killing the process", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({
        args: ["-e", "setTimeout(() => {}, 60_000)"],
        timeout_ms: 200,
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("TIMEOUT_EXPIRED");
    expect(result.report).toBeDefined();
    expect(result.report!.signal).toBe("SIGKILL");
    // Duration should be near the timeout, not the 60s the script would have taken
    expect(result.report!.duration_ms).toBeLessThan(5_000);
  });

  it("rejects an invalid timeout_ms", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const r1 = await executeBuild({ spec: baseSpec({ timeout_ms: 0 }), workspace_root: ws });
    expect(r1.ok).toBe(false);
    if (r1.ok) return;
    expect(r1.reason_code).toBe("INVALID_TIMEOUT");

    const r2 = await executeBuild({ spec: baseSpec({ timeout_ms: -1 }), workspace_root: ws });
    if (r2.ok) return;
    expect(r2.reason_code).toBe("INVALID_TIMEOUT");
  });

  it("rejects non-string args", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({ args: ["-e", 42 as unknown as string] }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("ARGS_INVALID");
  });

  // ── 4 · Workspace / cwd safety ───────────────────────────────────────

  it("rejects an absolute working_directory_rel", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({ working_directory_rel: process.cwd() }), // absolute
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("WORKING_DIRECTORY_ESCAPES_WORKSPACE");
  });

  it("rejects a working_directory_rel that escapes via ..", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({ working_directory_rel: "../outside" }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("WORKING_DIRECTORY_ESCAPES_WORKSPACE");
  });

  it("rejects a working_directory_rel that does not exist inside the workspace", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({ working_directory_rel: "does-not-exist" }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("WORKING_DIRECTORY_MISSING");
  });

  it("respects a subdirectory working_directory_rel", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await fs.mkdir(path.join(ws, "sub"), { recursive: true });
    const result = await executeBuild({
      spec: baseSpec({
        args: ["-e", "process.stdout.write(process.cwd())"],
        working_directory_rel: "sub",
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.stdout).toBe(path.join(ws, "sub"));
    expect(result.report.working_directory_absolute).toBe(path.join(ws, "sub"));
  });

  it("rejects a workspace_root outside the sanctioned area", async () => {
    // Use the trades repo root itself (definitely outside data/nex-agent-workspaces)
    const result = await executeBuild({
      spec: baseSpec(),
      workspace_root: path.resolve(process.cwd(), "src"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("WORKSPACE_ROOT_UNSAFE");
  });

  // ── 5 · Env restriction ──────────────────────────────────────────────

  it("strips arbitrary env vars — only PATH + forwarded vars visible to the child", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    // The parent has plenty of env vars. We forward NONE, then verify the
    // child sees PATH but not e.g. NEX_POSTGRES_URL (which is set in the
    // test session at .env.local via the earlier build verification).
    process.env.WO5_TEST_LEAK_VAR = "should-not-leak";
    const result = await executeBuild({
      spec: baseSpec({
        args: ["-e", "process.stdout.write(JSON.stringify({ path: !!process.env.PATH, leak: process.env.WO5_TEST_LEAK_VAR ?? 'ABSENT' }))"],
      }),
      workspace_root: ws,
    });
    delete process.env.WO5_TEST_LEAK_VAR;
    if (!result.ok) throw new Error(`expected happy path: ${result.reason}`);
    const parsed = JSON.parse(result.report.stdout);
    expect(parsed.path).toBe(true);
    expect(parsed.leak).toBe("ABSENT");
  });

  it("forwards explicitly-declared env vars", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeBuild({
      spec: baseSpec({
        args: ["-e", "process.stdout.write(process.env.WO5_FORWARDED ?? 'MISSING')"],
        env_forward: { WO5_FORWARDED: "hello-forwarded" },
      }),
      workspace_root: ws,
    });
    if (!result.ok) throw new Error(`expected happy path: ${result.reason}`);
    expect(result.report.stdout).toBe("hello-forwarded");
  });

  // ── 6 · Artefact detection · real file changes hashed ────────────────

  it("detects a file created by the build as 'created'", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const baseline = await captureWorkspaceBaseline(ws);
    // Have node write a file into the workspace
    const script = `require('fs').writeFileSync(require('path').join(process.cwd(), 'built.txt'), 'hello built world')`;
    const result = await executeBuild({
      spec: baseSpec({ args: ["-e", script], baseline_hashes: baseline }),
      workspace_root: ws,
    });
    if (!result.ok) throw new Error(`expected happy path: ${result.reason}`);
    const built = result.report.artefacts.find((a) => a.path === "built.txt");
    expect(built).toBeDefined();
    expect(built!.change).toBe("created");
    expect(built!.bytes).toBeGreaterThan(0);
    expect(built!.sha256_full).toMatch(/^[0-9a-f]{64}$/);
  });

  it("detects a file modified by the build as 'modified'", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await fs.writeFile(path.join(ws, "target.txt"), "before", "utf8");
    const baseline = await captureWorkspaceBaseline(ws);
    const script = `require('fs').writeFileSync(require('path').join(process.cwd(), 'target.txt'), 'AFTER')`;
    const result = await executeBuild({
      spec: baseSpec({ args: ["-e", script], baseline_hashes: baseline }),
      workspace_root: ws,
    });
    if (!result.ok) throw new Error("expected happy path");
    const rec = result.report.artefacts.find((a) => a.path === "target.txt");
    expect(rec).toBeDefined();
    expect(rec!.change).toBe("modified");
  });

  it("detects untouched files as 'unchanged' when baseline supplied", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await fs.writeFile(path.join(ws, "stable.txt"), "steady", "utf8");
    const baseline = await captureWorkspaceBaseline(ws);
    // Build script that touches nothing
    const result = await executeBuild({
      spec: baseSpec({ args: ["-e", "0"], baseline_hashes: baseline }),
      workspace_root: ws,
    });
    if (!result.ok) throw new Error("expected happy path");
    const rec = result.report.artefacts.find((a) => a.path === "stable.txt");
    expect(rec).toBeDefined();
    expect(rec!.change).toBe("unchanged");
  });

  // ── 7 · WO metadata carried through ──────────────────────────────────

  it("BuildReport carries trace_id / work_order_id / project_id / build_id", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const spec = baseSpec({ trace_id: "trace-xyz", work_order_id: "wo-42", project_id: "proj-42", build_id: "build-42" });
    const result = await executeBuild({ spec, workspace_root: ws });
    if (!result.ok) throw new Error("expected happy path");
    expect(result.report.trace_id).toBe("trace-xyz");
    expect(result.report.work_order_id).toBe("wo-42");
    expect(result.report.project_id).toBe("proj-42");
    expect(result.report.build_id).toBe("build-42");
  });

  // ── 8 · WO-04 → WO-05 chain · files then build them ──────────────────
  // The full WO-04 execute → WO-05 build chain is proven independently in
  // its own test file. Here we prove the shape: a workspace populated by
  // some prior mechanism can be node --check'd successfully.

  it("runs node --check on a file the workspace already contains", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await fs.writeFile(path.join(ws, "ok.js"), "const x = 1; module.exports = x;\n", "utf8");
    const result = await executeBuild({
      spec: baseSpec({ args: ["--check", "ok.js"] }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(true);
  });

  it("node --check catches a syntax error and reports EXIT_CODE_NONZERO", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    await fs.writeFile(path.join(ws, "broken.js"), "const x = ;\n", "utf8");
    const result = await executeBuild({
      spec: baseSpec({ args: ["--check", "broken.js"] }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("EXIT_CODE_NONZERO");
    expect(result.report!.stderr).toMatch(/SyntaxError/);
  });
});
