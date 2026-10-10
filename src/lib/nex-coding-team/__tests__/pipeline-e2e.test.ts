// End-to-end pipeline integration test · exercises the complete 15-agent
// coding-team using the SCRIPTED_DISPATCHER. This is the load-bearing test
// that proves: orchestrator + permissions + safe-write + logger + state +
// runtime + dispatcher all compose correctly to produce a green run.
//
// Uses SCRIPTED_DISPATCHER (deterministic · no LLM) so the test is fast
// and reproducible in CI.

import { describe, it, expect, afterAll } from "vitest";
import { existsSync, readFileSync, rmSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { startRun } from "../runtime";
import { SCRIPTED_DISPATCHER } from "../dispatcher-scripted";
import { loadManifest } from "../orchestrator";
import { loadState } from "../state";
import { ALL_AGENT_IDS } from "../types";

const REPO_ROOT = process.cwd();
const CREATED_RUN_IDS: string[] = [];

afterAll(() => {
  for (const id of CREATED_RUN_IDS) {
    const p = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", id);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
});

describe("pipeline · end-to-end with SCRIPTED_DISPATCHER", () => {
  it("completes a green run through every stage", async () => {
    const prompt = `Add a small utility function to src/lib/foo/bar.ts and a matching test in src/lib/foo/__tests__/bar.test.ts. Keep it TypeScript-strict with an ES module named export. This exercises route.ts contract, so the contract reviewer should engage.`;
    const manifest = await startRun({ founder_prompt: prompt, dispatcher: SCRIPTED_DISPATCHER });
    CREATED_RUN_IDS.push(manifest.run_id);

    // Pipeline should end in either completed_merged (all approved) or a
    // completed_no_merge (dry run). Either way, no ERROR or halted status.
    expect(["completed_merged", "completed_no_merge"]).toContain(manifest.status);

    // Governance state is preserved.
    expect(manifest.governance_state.v3_registry_frozen).toBe(true);
    expect(manifest.governance_state.historical_receipts_intact).toBe(true);

    // Reload from disk to confirm persistence.
    const loaded = loadManifest(manifest.run_id);
    expect(loaded).not.toBeNull();
    expect(loaded?.status).toBe(manifest.status);

    // At minimum PM and Architect always run.
    expect(manifest.agent_results.pm).not.toBeNull();
    expect(manifest.agent_results.architect).not.toBeNull();
    expect(manifest.agent_results.pm?.verdict).toBe("APPROVE");
    expect(manifest.agent_results.architect?.verdict).toBe("APPROVE");

    // Post-merge stages always run for a completed_merged path.
    if (manifest.status === "completed_merged") {
      for (const a of ["reviewer", "forensics", "secops", "integrator", "technical-writer", "telemetry"] as const) {
        expect(manifest.agent_results[a], `${a} must have run`).not.toBeNull();
      }
    }

    // AGENT_STATE.json is written and reflects the final status.
    const stateFile = loadState(manifest.run_id);
    expect(stateFile?.status).toBe(manifest.status);
    expect(stateFile?.agent_events.length).toBeGreaterThan(0);
  }, 30_000);

  it("halts honestly when a mandatory gate is REJECTED", async () => {
    const prompt = `Test PM rejection path. #FORCE_VERDICT:pm=REJECT`;
    const manifest = await startRun({ founder_prompt: prompt, dispatcher: SCRIPTED_DISPATCHER });
    CREATED_RUN_IDS.push(manifest.run_id);

    // PM rejects → pipeline halts before Architect.
    expect(manifest.status).toBe("halted_error");
    expect(manifest.agent_results.pm?.verdict).toBe("REJECT");
    // Architect never ran.
    expect(manifest.agent_results.architect).toBeNull();
  }, 15_000);

  it("halts with needs_founder_input on NEEDS_FOUNDER_INPUT verdict", async () => {
    const prompt = `Test escalation path. #FORCE_VERDICT:pm=NEEDS_FOUNDER_INPUT`;
    const manifest = await startRun({ founder_prompt: prompt, dispatcher: SCRIPTED_DISPATCHER });
    CREATED_RUN_IDS.push(manifest.run_id);
    expect(manifest.status).toBe("halted_needs_founder");
  }, 15_000);

  it("produces audit-log entries for every stage transition", async () => {
    const prompt = `Simple prompt to exercise the pipeline.`;
    const manifest = await startRun({ founder_prompt: prompt, dispatcher: SCRIPTED_DISPATCHER });
    CREATED_RUN_IDS.push(manifest.run_id);

    const logPath = path.join(REPO_ROOT, manifest.artifacts_dir, "logs", "run.jsonl");
    expect(existsSync(logPath)).toBe(true);
    const lines = readFileSync(logPath, "utf8").split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(5);

    // Every line is valid JSON with expected shape.
    for (const line of lines) {
      const entry = JSON.parse(line) as { kind: string; ts: string; agent_id: string; summary: string };
      expect(entry.ts).toBeDefined();
      expect(entry.kind).toBeDefined();
      expect(entry.agent_id).toBeDefined();
      expect(entry.summary).toBeDefined();
    }
  }, 30_000);

  it("safeWrite governance check reports zero protected-file writes", async () => {
    const prompt = `Simple prompt for governance verification.`;
    const manifest = await startRun({ founder_prompt: prompt, dispatcher: SCRIPTED_DISPATCHER });
    CREATED_RUN_IDS.push(manifest.run_id);

    const logPath = path.join(REPO_ROOT, manifest.artifacts_dir, "logs", "run.jsonl");
    const lines = readFileSync(logPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      const entry = JSON.parse(line) as { kind?: string; detail?: { target_path?: string } };
      const tp = entry?.detail?.target_path;
      if (entry.kind === "file_write" && tp) {
        // No protected file should ever appear as a granted write.
        expect(tp).not.toMatch(/^\.env/);
        expect(tp).not.toMatch(/^CLAUDE\.md/);
        expect(tp).not.toMatch(/^src\/lib\/nex-v3\//);
      }
    }
  }, 30_000);
});
