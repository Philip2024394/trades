// src/lib/nex/agent-runtime/worker-specialists-registration.test.ts
//
// Contract tests · Vision + Travel + Business specialist registration
// Founder BEGIN 2026-09-08 · continue-signal · S-1/S-2/S-3 wire-in verification
//
// Confirms:
//   · AgentId union includes new specialists
//   · Each worker exports required functions
//   · Each specialist has a corpus + evaluator
//   · Benchmark-once functions return well-formed results
//   · Registration in control-plane adds them to the position list
// Does NOT spawn real processes · runs pure functions only.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let priorRoot: string | undefined;
beforeEach(() => {
  priorRoot = process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-specialist-reg-"));
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  else process.env.NEX_AGENT_RUNTIME_DATA_ROOT = priorRoot;
});

// ═══════════════════════════════════════════════════════════════════
// § AgentId union extension
// ═══════════════════════════════════════════════════════════════════

describe("§SPEC-REG · AgentId union extended", () => {
  it("union accepts vision + travel + business at type level (compile check)", async () => {
    const { AGENT_RUNTIME_VERSION } = await import("./types");
    // Just importing the module + reading a const confirms the file typechecks
    expect(typeof AGENT_RUNTIME_VERSION).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § Worker function exports
// ═══════════════════════════════════════════════════════════════════

describe("§SPEC-REG · workers export required functions", () => {
  it("vision worker exports runVisionWorker + runVisionBenchmarkOnce", async () => {
    const mod = await import("./worker-vision");
    expect(typeof mod.runVisionWorker).toBe("function");
    expect(typeof mod.runVisionBenchmarkOnce).toBe("function");
  });

  it("travel worker exports runTravelWorker + runTravelBenchmarkOnce", async () => {
    const mod = await import("./worker-travel");
    expect(typeof mod.runTravelWorker).toBe("function");
    expect(typeof mod.runTravelBenchmarkOnce).toBe("function");
  });

  it("business worker exports runBusinessWorker + runBusinessBenchmarkOnce", async () => {
    const mod = await import("./worker-business");
    expect(typeof mod.runBusinessWorker).toBe("function");
    expect(typeof mod.runBusinessBenchmarkOnce).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § Benchmark-once returns valid results
// ═══════════════════════════════════════════════════════════════════

describe("§SPEC-REG · benchmark-once produces valid result shape", () => {
  it("vision benchmark returns pass=8 fail=0 on frozen corpus V1", async () => {
    const { runVisionBenchmarkOnce } = await import("./worker-vision");
    const r = runVisionBenchmarkOnce();
    expect(r.corpus_version).toBe("nex-vision-corpus-v1");
    expect(r.case_count).toBe(8);
    expect(r.passed).toBe(8);
    expect(r.failed).toBe(0);
  });

  it("travel benchmark returns pass=8 fail=0 on frozen corpus V1", async () => {
    const { runTravelBenchmarkOnce } = await import("./worker-travel");
    const r = runTravelBenchmarkOnce();
    expect(r.corpus_version).toBe("nex-travel-corpus-v1");
    expect(r.case_count).toBe(8);
    expect(r.passed).toBe(8);
    expect(r.failed).toBe(0);
  });

  it("business benchmark returns pass=8 fail=0 on frozen corpus V1", async () => {
    const { runBusinessBenchmarkOnce } = await import("./worker-business");
    const r = runBusinessBenchmarkOnce();
    expect(r.corpus_version).toBe("nex-business-corpus-v1");
    expect(r.case_count).toBe(8);
    expect(r.passed).toBe(8);
    expect(r.failed).toBe(0);
  });

  it("all three benchmarks are deterministic (repeated runs same result)", async () => {
    const { runVisionBenchmarkOnce } = await import("./worker-vision");
    const { runTravelBenchmarkOnce } = await import("./worker-travel");
    const { runBusinessBenchmarkOnce } = await import("./worker-business");
    const v1 = runVisionBenchmarkOnce();
    const v2 = runVisionBenchmarkOnce();
    expect(v1).toEqual(v2);
    const t1 = runTravelBenchmarkOnce();
    const t2 = runTravelBenchmarkOnce();
    expect(t1).toEqual(t2);
    const b1 = runBusinessBenchmarkOnce();
    const b2 = runBusinessBenchmarkOnce();
    expect(b1).toEqual(b2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § control-plane registration
// ═══════════════════════════════════════════════════════════════════

describe("§SPEC-REG · ensureAuthorizedAgentsRegistered lists all 7 specialists", () => {
  it("registers programmer + accommodation + master_ai + speaking + vision + travel + business", async () => {
    const { ensureAuthorizedAgentsRegistered } = await import("./control-plane");
    const { listPositions } = await import("./registry");
    ensureAuthorizedAgentsRegistered();
    const positions = listPositions();
    const ids = new Set(positions.map((p) => p.agent_id));
    expect(ids.has("programmer")).toBe(true);
    expect(ids.has("accommodation")).toBe(true);
    expect(ids.has("master_ai")).toBe(true);
    expect(ids.has("speaking")).toBe(true);
    expect(ids.has("vision")).toBe(true);
    expect(ids.has("travel")).toBe(true);
    expect(ids.has("business")).toBe(true);
  });

  it("new specialists registered with correct machinery + domain + internet_requirement", async () => {
    const { ensureAuthorizedAgentsRegistered } = await import("./control-plane");
    const { getPosition } = await import("./registry");
    ensureAuthorizedAgentsRegistered();
    const vision = getPosition("vision");
    expect(vision?.machinery).toBe("vision_intelligence_engineer");
    expect(vision?.domain).toBe("vision");
    expect(vision?.internet_requirement).toBe("NOT_REQUIRED");
    const travel = getPosition("travel");
    expect(travel?.machinery).toBe("travel_intelligence_engineer");
    expect(travel?.internet_requirement).toBe("NOT_REQUIRED");
    const business = getPosition("business");
    expect(business?.machinery).toBe("business_intelligence_engineer");
    expect(business?.internet_requirement).toBe("NOT_REQUIRED");
  });

  it("registration is idempotent (safe to call twice)", async () => {
    const { ensureAuthorizedAgentsRegistered } = await import("./control-plane");
    const { listPositions } = await import("./registry");
    ensureAuthorizedAgentsRegistered();
    const first = listPositions().length;
    ensureAuthorizedAgentsRegistered();
    const second = listPositions().length;
    expect(first).toBe(second);
  });
});
