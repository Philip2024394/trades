// Wave 11 · Phase 5 · W-C-COMPANION drift-catcher negative regressions.
//
// The adapter-isolation.test.mjs drift-catcher only FIRES when a real
// violation is present in the tree. That means we currently rely on
// the ambient "the tree is clean" state to prove the check works.
// This file proves the CHECK LOGIC ITSELF still catches known-shape
// offenders. Two invariants covered:
//
//   AI9  · Every BrainStore method must have an implementation in
//          every adapter file. Simulated offender: an adapter source
//          missing `async getWorkerJob(`. The AI9 regex must flag it.
//
//   KJT1 · Every fs-store terminal transition
//          (updateJob(...status:"completed"|"failed"|"released"))
//          must be paired with `applyTerminalKnowledgeJobTransition`
//          OR carry an inline `// drift-exempt-KJT1:<reason>` comment.
//          Simulated offender: raw updateJob({status:"completed"})
//          in a synthetic file with no helper reference. The KJT1
//          regex + windowed context check must flag it.
//
// Coupling guard: we also assert the exact source of the shipped
// adapter-isolation.test.mjs still contains the regex fragments we
// depend on. If someone weakens the check, this file fails first.
//
// This file lives under `brain/tests/` which is explicitly excluded
// from the drift-catcher walk (adapter-isolation.test.mjs `walk()`
// skips the "tests" directory). No collateral effect on the real
// invariants.
//
// See:
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-CONTRACT-TEST-DESIGN.md  §4

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_DRIFT_CATCHER = join(HERE, "adapter-isolation.test.mjs");
const REAL_DRIFT_SRC = readFileSync(REAL_DRIFT_CATCHER, "utf8");

// ─────────────────────────────────────────────────────────────────────
// AI9 · every BrainStore method has an implementation in every adapter.
// ─────────────────────────────────────────────────────────────────────

// The exact patterns the real drift-catcher uses to (a) discover the
// interface methods and (b) discover the adapter implementations.
const IFACE_METHOD_RE = /^\s{2}([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:<[^>]*>)?\s*\(/gm;
const ADAPTER_METHOD_RE = /^\s+async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;

function extractInterfaceMethods(interfaceBlock: string): string[] {
  return [...interfaceBlock.matchAll(IFACE_METHOD_RE)]
    .map((m) => m[1])
    .filter((n) => n && n !== "BrainStore");
}

function extractAdapterMethods(adapterSrc: string): Set<string> {
  return new Set([...adapterSrc.matchAll(ADAPTER_METHOD_RE)].map((m) => m[1]));
}

describe("drift-catcher · AI9 · adapter method coverage", () => {
  const INTERFACE_BLOCK = `export interface BrainStore {
  insertRecord(input: X): Promise<Y>;
  getRecord(record_id: string): Promise<Y | null>;
  getWorkerJob(id: string): Promise<J | null>;
  listWorkerJobsByInputRef(refs: string[]): Promise<J[]>;
  writeKnowledgeJobTransitionAudit(input: A): Promise<void>;
}`;

  it("detects an adapter that omits getWorkerJob", () => {
    const OFFENDER = `
export class BrokenBrainStore implements BrainStore {
  async insertRecord(input: X) { return {} as never; }
  async getRecord(record_id: string) { return null; }
  // MISSING: getWorkerJob
  async listWorkerJobsByInputRef(refs: string[]) { return []; }
  async writeKnowledgeJobTransitionAudit(input: A) { /* noop */ }
}`;
    const ifaceMethods = extractInterfaceMethods(INTERFACE_BLOCK);
    const adapterMethods = extractAdapterMethods(OFFENDER);
    const missing = ifaceMethods.filter((n) => !adapterMethods.has(n));
    expect(missing).toContain("getWorkerJob");
  });

  it("accepts a compliant adapter that implements all five methods", () => {
    const COMPLIANT = `
export class GoodBrainStore implements BrainStore {
  async insertRecord(input: X) { return {} as never; }
  async getRecord(record_id: string) { return null; }
  async getWorkerJob(id: string) { return null; }
  async listWorkerJobsByInputRef(refs: string[]) { return []; }
  async writeKnowledgeJobTransitionAudit(input: A) { /* noop */ }
}`;
    const ifaceMethods = extractInterfaceMethods(INTERFACE_BLOCK);
    const adapterMethods = extractAdapterMethods(COMPLIANT);
    const missing = ifaceMethods.filter((n) => !adapterMethods.has(n));
    expect(missing).toEqual([]);
  });

  it("detects multiple missing methods · lists every gap", () => {
    const OFFENDER = `
export class VeryBrokenBrainStore implements BrainStore {
  async insertRecord(input: X) { return {} as never; }
  // MISSING: getRecord · getWorkerJob · listWorkerJobsByInputRef · writeKnowledgeJobTransitionAudit
}`;
    const ifaceMethods = extractInterfaceMethods(INTERFACE_BLOCK);
    const adapterMethods = extractAdapterMethods(OFFENDER);
    const missing = ifaceMethods.filter((n) => !adapterMethods.has(n));
    expect(missing).toEqual([
      "getRecord",
      "getWorkerJob",
      "listWorkerJobsByInputRef",
      "writeKnowledgeJobTransitionAudit",
    ]);
  });

  it("coupling · real drift-catcher still uses the same discovery regex", () => {
    // If someone weakens the interface-method regex in the shipped
    // drift-catcher, this assertion fails and the negative test above
    // no longer proves anything. Fail loud, not silent.
    expect(REAL_DRIFT_SRC).toContain(
      "^\\s{2}([a-zA-Z_][a-zA-Z0-9_]*)\\s*(?:<[^>]*>)?\\s*\\(",
    );
    expect(REAL_DRIFT_SRC).toContain(
      "^\\s+async\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// KJT1 · terminal transitions must pair with the audit helper.
// ─────────────────────────────────────────────────────────────────────

// Same patterns the real drift-catcher applies.
const TERMINAL_STATUS_RE = /updateJob\s*\([^)]*status:\s*["'](?:completed|failed|released)["']/g;
const EXEMPTION_RE = /\/\/\s*drift-exempt-KJT1[\s:]/i;
const HELPER_NAME = "applyTerminalKnowledgeJobTransition";

function kjt1Violations(src: string): { snippet: string }[] {
  const matches = [...src.matchAll(TERMINAL_STATUS_RE)];
  const out: { snippet: string }[] = [];
  for (const m of matches) {
    const idx = m.index ?? 0;
    const windowStart = Math.max(0, idx - 800);
    const windowEnd = Math.min(src.length, idx + 800);
    const contextWin = src.slice(windowStart, windowEnd);
    const hasHelper = contextWin.includes(HELPER_NAME) || src.includes(HELPER_NAME);
    const hasExempt = EXEMPTION_RE.test(contextWin);
    if (!hasHelper && !hasExempt) {
      out.push({ snippet: src.slice(Math.max(0, idx - 60), idx + 80).replace(/\s+/g, " ") });
    }
  }
  return out;
}

describe("drift-catcher · KJT1 · terminal transition pairing", () => {
  it("flags a raw updateJob({status:'completed'}) with no helper or exemption", () => {
    const OFFENDER = `
// synthetic worker · missing audit pairing
export async function processJob(jobId: string) {
  await updateJob(jobId, { status: "completed", progress: 100 });
}`;
    const v = kjt1Violations(OFFENDER);
    expect(v).toHaveLength(1);
    expect(v[0].snippet).toContain("status:");
  });

  it("flags a failed transition without the helper", () => {
    const OFFENDER = `
export async function failJob(jobId: string, error: string) {
  await updateJob(jobId, { status: "failed", completion_result: { error } });
}`;
    expect(kjt1Violations(OFFENDER)).toHaveLength(1);
  });

  it("flags a released transition without the helper", () => {
    const OFFENDER = `
export async function releaseJob(jobId: string) {
  await updateJob(jobId, { status: "released" });
}`;
    expect(kjt1Violations(OFFENDER)).toHaveLength(1);
  });

  it("accepts a transition that flows through applyTerminalKnowledgeJobTransition", () => {
    const COMPLIANT = `
import { applyTerminalKnowledgeJobTransition } from "@/lib/nex/jobs/terminal-transition";
export async function processJob(store: any, jobId: string) {
  await applyTerminalKnowledgeJobTransition(store, {
    kjid: jobId,
    patch: { status: "completed", progress: 100 },
    actor: "worker:test",
  });
}`;
    // The helper does its updateJob internally, but the outer file may
    // ALSO carry an updateJob call with a completed status literal —
    // that literal appears inside terminal-transition.ts, not here.
    // Verify the plain path is clean.
    expect(kjt1Violations(COMPLIANT)).toEqual([]);
  });

  it("accepts an explicit inline exemption comment", () => {
    const COMPLIANT_EXEMPT = `
export async function reclaimJob(jobId: string) {
  // drift-exempt-KJT1: reclaim path resets to pending · not a terminal transition
  await updateJob(jobId, { status: "completed", progress: 0 });
}`;
    expect(kjt1Violations(COMPLIANT_EXEMPT)).toEqual([]);
  });

  it("accepts non-terminal status transitions untouched", () => {
    const NON_TERMINAL = `
export async function claimJob(jobId: string) {
  await updateJob(jobId, { status: "claimed" });
}
export async function progressJob(jobId: string) {
  await updateJob(jobId, { status: "in_progress", progress: 50 });
}`;
    expect(kjt1Violations(NON_TERMINAL)).toEqual([]);
  });

  it("coupling · real drift-catcher still uses the same terminal-status pattern", () => {
    // Escape the check to strings the real .mjs actually contains.
    expect(REAL_DRIFT_SRC).toContain(
      "updateJob\\s*\\([^)]*status:\\s*[\"'](?:completed|failed|released)[\"']",
    );
    expect(REAL_DRIFT_SRC).toContain("applyTerminalKnowledgeJobTransition");
    expect(REAL_DRIFT_SRC).toContain("drift-exempt-KJT1");
  });
});

// ─────────────────────────────────────────────────────────────────────
// AI10 · KnowledgeJobStatus (brain/types.ts) must equal JobStatus
//        (jobs/fs-store.ts). Negative regression: two synthetic unions
//        must diverge.
// ─────────────────────────────────────────────────────────────────────

function unionMembers(src: string, typeName: string): string[] | null {
  const re = new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*([^;]+);`, "m");
  const m = src.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
}

describe("drift-catcher · AI10 · KJ status enum alignment", () => {
  it("detects divergent unions", () => {
    const brainSrc = `export type KnowledgeJobStatus = | "pending" | "claimed" | "completed";`;
    const fsSrc = `export type JobStatus = | "pending" | "claimed" | "completed" | "failed";`;
    const brain = unionMembers(brainSrc, "KnowledgeJobStatus");
    const fs = unionMembers(fsSrc, "JobStatus");
    expect(brain).not.toEqual(fs);
  });

  it("accepts aligned unions", () => {
    const brainSrc = `export type KnowledgeJobStatus = | "pending" | "claimed" | "completed" | "failed";`;
    const fsSrc = `export type JobStatus = | "pending" | "claimed" | "completed" | "failed";`;
    const brain = unionMembers(brainSrc, "KnowledgeJobStatus");
    const fs = unionMembers(fsSrc, "JobStatus");
    expect(brain).toEqual(fs);
  });

  it("coupling · real drift-catcher still parses via the same regex", () => {
    expect(REAL_DRIFT_SRC).toContain(
      "export\\\\s+type\\\\s+${typeName}\\\\s*=\\\\s*([^;]+);",
    );
  });
});
