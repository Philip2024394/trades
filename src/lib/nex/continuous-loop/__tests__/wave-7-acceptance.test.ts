// src/lib/nex/continuous-loop/__tests__/wave-7-acceptance.test.ts
//
// UWI · Wave 7 · Acceptance suite
// Founder-authorised programme.
//
// Proves M27 (6-way trigger router) · M28 (4 typed stopping rules) ·
// M30 (runtime-loop purity contract with CI-style automated check).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TriggerRouter,
  UnhandledTriggerError,
  evaluateStoppingRules,
  runPurityContract,
  assertRuntimePurity,
  RuntimePurityViolationError,
  type TriggerEvent,
  type TriggerKind,
  type StoppingRuleInputs,
} from "..";

// ═══ M27 · 6-way trigger router ════════════════════════════════════
describe("M27 · Trigger router (6 classes)", () => {
  let router: TriggerRouter;
  beforeEach(() => { router = new TriggerRouter(); });

  it("dispatches to correct handler for each of 6 kinds", async () => {
    const seen: TriggerKind[] = [];
    const kinds: TriggerKind[] = ["scheduled", "event_triggered", "change_triggered", "user_triggered", "hypothesis_triggered", "failure_recovery_triggered"];
    for (const k of kinds) {
      router.register(k, async (ev) => { seen.push(ev.kind); });
    }
    for (const k of kinds) {
      await router.dispatch({ kind: k, at_iso: new Date().toISOString(), target_id: "opp-1", detail: {} });
    }
    expect(seen).toEqual(kinds);
    expect(router.totalDispatched()).toBe(6);
  });

  it("throws UnhandledTriggerError when no handler registered", async () => {
    const ev: TriggerEvent = { kind: "scheduled", at_iso: new Date().toISOString(), target_id: "opp-1", detail: {} };
    await expect(router.dispatch(ev)).rejects.toBeInstanceOf(UnhandledTriggerError);
  });

  it("rejects duplicate registration", () => {
    router.register("scheduled", async () => {});
    expect(() => router.register("scheduled", async () => {})).toThrow(/already registered/);
  });

  it("count-by-kind tracks each dispatch", async () => {
    router.register("event_triggered", async () => {});
    router.register("user_triggered", async () => {});
    for (let i = 0; i < 3; i++) await router.dispatch({ kind: "event_triggered", at_iso: "", target_id: "t", detail: {} });
    await router.dispatch({ kind: "user_triggered", at_iso: "", target_id: "t", detail: {} });
    const counts = router.countByKind();
    expect(counts.get("event_triggered")).toBe(3);
    expect(counts.get("user_triggered")).toBe(1);
  });

  it("registeredKinds enumerates active handlers", () => {
    router.register("scheduled", async () => {});
    router.register("event_triggered", async () => {});
    expect(new Set(router.registeredKinds())).toEqual(new Set(["scheduled", "event_triggered"]));
    router.unregister("scheduled");
    expect(router.registeredKinds()).toEqual(["event_triggered"]);
  });
});

// ═══ M28 · 4 typed stopping rules · priority order ══════════════════
describe("M28 · Stopping rules (4 + still_running · priority order)", () => {
  const base: StoppingRuleInputs = {
    independent_source_count: 0,
    confidence: 0,
    novelty_of_last_source: 1,
    contradicting_signal_count: 0,
    supporting_signal_count: 0,
    high_reliability_sources_disagreeing: 0,
    all_sources_fresh: false,
    time_since_last_supporting_ms: 0,
    decay_window_ms: null,
    cost_spent_units: 0,
    cost_cap_units: null,
  };

  it("still_running by default (no rule fires)", () => {
    const d = evaluateStoppingRules(base);
    expect(d.rule).toBe("still_running");
    expect(d.should_stop).toBe(false);
    expect(d.recommended_next_action).toBe("continue");
  });

  it("cost_cap wins highest priority", () => {
    // All conditions for other rules ALSO true — cost_cap must still win
    const d = evaluateStoppingRules({
      ...base,
      cost_spent_units: 100, cost_cap_units: 100,
      independent_source_count: 10, confidence: 0.9, novelty_of_last_source: 0.01,
      high_reliability_sources_disagreeing: 5, all_sources_fresh: true, contradicting_signal_count: 3,
      decay_window_ms: 1000, time_since_last_supporting_ms: 5000,
    });
    expect(d.rule).toBe("cost_cap");
    expect(d.should_stop).toBe(true);
    expect(d.recommended_next_action).toBe("cost_cap_review");
  });

  it("unresolvable_contradiction escalates to human", () => {
    const d = evaluateStoppingRules({
      ...base,
      high_reliability_sources_disagreeing: 3,
      all_sources_fresh: true,
      contradicting_signal_count: 2,
    });
    expect(d.rule).toBe("unresolvable_contradiction");
    expect(d.should_escalate_to_human).toBe(true);
    expect(d.recommended_next_action).toBe("escalate");
  });

  it("enough_evidence stops when N sources + confidence + low novelty", () => {
    const d = evaluateStoppingRules({
      ...base,
      independent_source_count: 3, confidence: 0.85, novelty_of_last_source: 0.05,
    });
    expect(d.rule).toBe("enough_evidence");
    expect(d.should_stop).toBe(true);
    expect(d.should_escalate_to_human).toBe(false);
  });

  it("decay parks the opportunity when no supporting evidence in window", () => {
    const d = evaluateStoppingRules({
      ...base,
      decay_window_ms: 1000,
      time_since_last_supporting_ms: 5000,
    });
    expect(d.rule).toBe("decay");
    expect(d.should_stop).toBe(true);
    expect(d.recommended_next_action).toBe("park");
  });

  it("high-reliability disagreement WITHOUT freshness does NOT escalate", () => {
    const d = evaluateStoppingRules({
      ...base,
      high_reliability_sources_disagreeing: 3,
      all_sources_fresh: false, // stale sources — could just be out-of-date
      contradicting_signal_count: 2,
    });
    expect(d.rule).not.toBe("unresolvable_contradiction");
  });
});

// ═══ M30 · Runtime-loop purity contract ═══════════════════════════
describe("M30 · Runtime-loop purity contract", () => {
  let tmp_root: string;
  beforeEach(async () => {
    tmp_root = await mkdtemp(join(tmpdir(), "nex-purity-"));
    await mkdir(join(tmp_root, "src", "lib", "nex", "runtime-path"), { recursive: true });
    await mkdir(join(tmp_root, "src", "lib", "llm"), { recursive: true });
  });
  afterEach(async () => {
    await rm(tmp_root, { recursive: true, force: true });
  });

  it("clean tree · no violations", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "worker.ts"),
      `import { createHash } from "node:crypto";\nexport function x() { return createHash("sha256"); }\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.files_scanned).toBeGreaterThan(0);
  });

  it("detects blocked import in non-allowlisted runtime file", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "leak.ts"),
      `import OpenAI from "openai";\nexport const client = new OpenAI();\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].imported).toBe("openai");
    expect(r.violations[0].file).toContain("leak.ts");
  });

  it("allowlisted path (src/lib/llm/) bypasses check", async () => {
    // src/lib/llm/openai/wrapper.ts is allowed to import openai because it
    // wraps the call in blockThirdPartyAI (per Wave 3.1 audit).
    await mkdir(join(tmp_root, "src", "lib", "llm", "openai"), { recursive: true });
    await writeFile(join(tmp_root, "src", "lib", "llm", "openai", "wrapper.ts"),
      `import OpenAI from "openai";\nexport function w() { return new OpenAI(); }\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(true);
  });

  it("detects dynamic-import bypass attempt", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "sneaky.ts"),
      `export async function f() { const m = await import("langchain"); return m; }\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(false);
    expect(r.violations[0].imported).toBe("langchain");
  });

  it("detects require() bypass attempt", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "legacy.ts"),
      `const anthropic = require("@anthropic-ai/sdk");\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(false);
    expect(r.violations[0].imported).toBe("@anthropic-ai/sdk");
  });

  it("detects scoped-package prefix (@langchain/anything)", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "scoped.ts"),
      `import { X } from "@langchain/core";\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(false);
    expect(r.violations[0].imported).toBe("@langchain/core");
  });

  it("excludes test files from the scan (avoids self-false-positive)", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "some.test.ts"),
      `import OpenAI from "openai"; // test-only reference · not runtime\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(true);
  });

  it("assertRuntimePurity throws with violation summary", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "bad.ts"),
      `import OpenAI from "openai";\nimport { X } from "crewai";\n`);
    await expect(assertRuntimePurity({ repo_root: tmp_root })).rejects.toBeInstanceOf(RuntimePurityViolationError);
  });

  it("Firecrawl imports are blocked (FCA rejection preserved)", async () => {
    await writeFile(join(tmp_root, "src", "lib", "nex", "runtime-path", "fc.ts"),
      `import { FirecrawlApp } from "@mendable/firecrawl";\n`);
    const r = await runPurityContract({ repo_root: tmp_root });
    expect(r.is_pure).toBe(false);
    expect(r.violations[0].imported).toBe("@mendable/firecrawl");
  });
});
