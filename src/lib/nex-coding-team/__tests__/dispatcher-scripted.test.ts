// Scripted-dispatcher unit tests · every agent produces a well-formed artefact
// that satisfies its role's minimum contract, and #FORCE_VERDICT markers work.

import { describe, it, expect, afterAll } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import * as path from "node:path";
import { SCRIPTED_DISPATCHER, forcedVerdictFor } from "../dispatcher-scripted";
import { ALL_AGENT_IDS } from "../types";
import type { AgentDispatchInput } from "../runtime";

const REPO_ROOT = process.cwd();
const RUN_ID = `test-scripted-${Date.now()}`;
const RUN_DIR = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", RUN_ID);

if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true });

afterAll(() => {
  if (existsSync(RUN_DIR)) rmSync(RUN_DIR, { recursive: true, force: true });
});

function makeInput(agent_id: AgentDispatchInput["agent_id"], founder_prompt = "build a thing"): AgentDispatchInput {
  return {
    run_id: RUN_ID,
    agent_id,
    cycle_index: 0,
    system_prompt: "TEST",
    context: {
      founder_prompt,
      prior_verdicts: {},
    },
    artifact_write_target: `data/nex-coding-team/runs/${RUN_ID}/${agent_id}.md`,
  };
}

describe("dispatcher-scripted · produces artefacts for every agent", () => {
  it.each(ALL_AGENT_IDS.map((a) => [a] as const))(
    "produces an artefact for %s with APPROVE verdict by default",
    async (agent_id) => {
      const out = await SCRIPTED_DISPATCHER.dispatch(makeInput(agent_id));
      expect(out.verdict).toBe("APPROVE");
      expect(out.blockers.length).toBe(0);
      expect(out.artifact_relpath).toBeTruthy();
      const abs = path.join(REPO_ROOT, out.artifact_relpath as string);
      expect(existsSync(abs)).toBe(true);
      const body = readFileSync(abs, "utf8");
      expect(body).toContain("[SCRIPTED_DISPATCHER]");
      expect(body).toContain("## Truth-taxonomy");
    },
    10_000,
  );
});

describe("dispatcher-scripted · forcedVerdictFor", () => {
  it("returns null when no marker present", () => {
    expect(forcedVerdictFor("pm", "no markers here")).toBe(null);
  });

  it("returns REJECT when the marker is present", () => {
    expect(forcedVerdictFor("reviewer", "#FORCE_VERDICT:reviewer=REJECT after context")).toBe("REJECT");
  });

  it("returns null for unknown verdict tokens", () => {
    expect(forcedVerdictFor("reviewer", "#FORCE_VERDICT:reviewer=SUPER_BAD")).toBe(null);
  });

  it("only matches the named agent", () => {
    expect(forcedVerdictFor("pm", "#FORCE_VERDICT:reviewer=REJECT")).toBe(null);
  });
});

describe("dispatcher-scripted · verdict propagation", () => {
  it("dispatches with a forced REJECT verdict when marker present", async () => {
    const input = makeInput("reviewer", "make a thing #FORCE_VERDICT:reviewer=REJECT");
    const out = await SCRIPTED_DISPATCHER.dispatch(input);
    expect(out.verdict).toBe("REJECT");
    expect(out.blockers.length).toBe(1);
  });
});
