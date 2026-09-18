// NEX1 · Agent Registry · Full Connection + Real Coding Test
// Founder-authorised 2026-09-18.
//
// Three sequenced runtime probes against localhost:3008:
//   Probe A · Plain turn · confirm baseline agents (orchestrator, perception,
//             working_memory, afraid, registry-self) each emit a heartbeat.
//   Probe B · Investigation turn · confirm target discovery, reasoning,
//             prior context, Fix 25 salience, fear, Fix 30B comparator,
//             concern, class2_bridge, investigation_to_agent all beat.
//   Probe C · Two-turn CODING TEST · fresh fixture NEX has never seen.
//             Turn 1: analyse+propose. Turn 2: authorise. Assert coding
//             loop verdict, execution + verification + learning_signal
//             heartbeats present, file actually mutated.
//
// Every phase writes to the receipt. Zero LLM. Deterministic. Fresh state.

import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const REPO = "C:/Users/Victus/trades";
const REGISTRY_ROOT = path.join(REPO, "data", "nex1-agent-registry");
const OUT_DIR = path.join(REPO, "data", "nex1-agent-registry-probe");
const CODING_FIXTURE_DIR = path.join(REPO, "src", "lib", "nex1-coding-probe");
const CODING_FIXTURE = path.join(CODING_FIXTURE_DIR, "emotion-check.ts");
const CODING_ASSERTION = path.join(CODING_FIXTURE_DIR, "emotion-check.assertion.ts");
const CODING_REL = "src/lib/nex1-coding-probe/emotion-check.ts";

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────

function resetRegistry() {
  if (!fs.existsSync(REGISTRY_ROOT)) return;
  // Wipe agent DBs + heartbeats. Keep the catalog because it's re-emitted on
  // next chat turn (ensureCanonicalAgentsRegistered is idempotent).
  const dbs = path.join(REGISTRY_ROOT, "agent-dbs");
  const beats = path.join(REGISTRY_ROOT, "heartbeats");
  const catalog = path.join(REGISTRY_ROOT, "agents.json");
  for (const dir of [dbs, beats]) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ }
      }
    }
  }
  if (fs.existsSync(catalog)) {
    try { fs.unlinkSync(catalog); } catch { /* ignore */ }
  }
}

function readRegistrySnapshot() {
  const root = REGISTRY_ROOT;
  const catalogPath = path.join(root, "agents.json");
  let agents = [];
  if (fs.existsSync(catalogPath)) {
    try { agents = JSON.parse(fs.readFileSync(catalogPath, "utf8")); } catch { /* ignore */ }
  }
  const heartbeats = {};
  const db_sizes = {};
  const db_lines = {};
  for (const a of agents) {
    const beatPath = path.join(root, "heartbeats", `${a.agent_id}.json`);
    const dbPath = path.join(root, "agent-dbs", `${a.agent_id}.jsonl`);
    heartbeats[a.agent_id] = null;
    db_sizes[a.agent_id] = 0;
    db_lines[a.agent_id] = 0;
    if (fs.existsSync(beatPath)) {
      try { heartbeats[a.agent_id] = JSON.parse(fs.readFileSync(beatPath, "utf8")); } catch { /* ignore */ }
    }
    if (fs.existsSync(dbPath)) {
      try {
        const raw = fs.readFileSync(dbPath, "utf8");
        db_sizes[a.agent_id] = raw.length;
        db_lines[a.agent_id] = raw.split(/\r?\n/).filter((l) => l.trim() !== "").length;
      } catch { /* ignore */ }
    }
  }
  return { agents_count: agents.length, agents: agents.map((a) => a.agent_id), heartbeats, db_sizes, db_lines };
}

async function post(convId, message) {
  const res = await fetch("http://localhost:3008/api/nex1/chat/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message }),
  });
  return res.json();
}

// ── Probe A · Plain turn ─────────────────────────────────────────────────

async function probeA() {
  console.log("\n=== PROBE A · plain turn ===");
  resetRegistry();
  const t0 = Date.now();
  const r = await post(`A-${Date.now()}`, "hello");
  const snap = readRegistrySnapshot();
  const expected = ["chat_turn_orchestrator", "agent_registry", "working_memory", "perception", "metacognition_afraid"];
  const missing = expected.filter((id) => !snap.heartbeats[id]);
  return {
    probe: "A",
    duration_ms: Date.now() - t0,
    turn_state: r.state,
    zero_llm: r.zero_llm,
    snap,
    expected_agents: expected,
    missing_from_expected: missing,
    all_expected_beat: missing.length === 0,
  };
}

// ── Probe B · Investigation-style turn ───────────────────────────────────

async function probeB() {
  console.log("\n=== PROBE B · investigation turn ===");
  resetRegistry();
  // Reset any pre-existing store to guarantee no prior context.
  const store = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
  if (fs.existsSync(store)) fs.unlinkSync(store);
  // Reset fixture to canonical value.
  fs.writeFileSync(
    path.join(REPO, "src/lib/nex1-fix24-fixtures/s1-niladic.ts"),
    `// FIXTURE · reset by connection probe.
export interface WorkerPoolResult { readonly size: number; }
export function computeWorkerPool(): WorkerPoolResult {
  const size = 8;
  return { size };
}
`,
    "utf8",
  );
  const t0 = Date.now();
  const r = await post(`B-${Date.now()}`, "Analyse computeWorkerPool and propose a correction.");
  const snap = readRegistrySnapshot();
  const expected = [
    "chat_turn_orchestrator",
    "working_memory",
    "perception",
    "metacognition_afraid",
    "semantic_memory",              // target discovery
    "reasoning",                    // investigation
    "investigation_to_agent",       // agent selector
    "procedural_memory",            // Fix 30 build prior context
    "episodic_memory",              // Fix 30 status emit
    "attention_salience",           // Fix 25 promotion path
    "class2_bridge",                // Fix 24 bridge fired
    "safety_fear",                  // fear assessed at Fix 25
    "prior_evidence_comparator",    // Fix 30B comparator
    "metacognition_concern",        // concern assessed on promote
  ];
  const missing = expected.filter((id) => !snap.heartbeats[id]);
  return {
    probe: "B",
    duration_ms: Date.now() - t0,
    turn_state: r.state,
    zero_llm: r.zero_llm,
    rationale: r.summary?.rationale ?? null,
    snap,
    expected_agents: expected,
    missing_from_expected: missing,
    all_expected_beat: missing.length === 0,
  };
}

// ── Probe C · Real coding test (2-turn NEX-only) ────────────────────────

function createFreshCodingFixture() {
  fs.mkdirSync(CODING_FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(
    CODING_FIXTURE,
    `// FIXTURE · fresh · never seen · NEX-only coding test.
export function emotionCheck(): number {
  return 7;
}
`,
    "utf8",
  );
  fs.writeFileSync(
    CODING_ASSERTION,
    `import { describe, it, expect } from "vitest";
import { emotionCheck } from "./emotion-check";
describe("emotionCheck", () => {
  it("returns 42", () => {
    expect(emotionCheck()).toBe(42);
  });
});
`,
    "utf8",
  );
}
function cleanupCodingFixture() {
  try { if (fs.existsSync(CODING_FIXTURE)) fs.unlinkSync(CODING_FIXTURE); } catch { /* ignore */ }
  try { if (fs.existsSync(CODING_ASSERTION)) fs.unlinkSync(CODING_ASSERTION); } catch { /* ignore */ }
  try { if (fs.existsSync(CODING_FIXTURE_DIR)) fs.rmdirSync(CODING_FIXTURE_DIR); } catch { /* ignore */ }
}

async function probeC() {
  console.log("\n=== PROBE C · REAL CODING TEST · NEX only · two-turn ===");
  resetRegistry();
  const store = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
  if (fs.existsSync(store)) fs.unlinkSync(store);
  createFreshCodingFixture();
  const beforeSrc = fs.readFileSync(CODING_FIXTURE, "utf8");

  const convId = `C-${Date.now()}`;

  // Turn 1: analyse
  const t1_start = Date.now();
  const r1 = await post(convId, "Analyse emotionCheck and propose a correction.");
  const t1_ms = Date.now() - t1_start;
  const snapT1 = readRegistrySnapshot();

  await sleep(500);

  // Turn 2: authorise
  const t2_start = Date.now();
  const r2 = await post(convId, "Yes, go ahead.");
  const t2_ms = Date.now() - t2_start;
  const snapT2 = readRegistrySnapshot();

  const afterSrc = fs.readFileSync(CODING_FIXTURE, "utf8");
  const file_changed = beforeSrc !== afterSrc;
  const returns7 = /return\s+7\s*;/.test(afterSrc);
  const returns42 = /return\s+42\s*;/.test(afterSrc);

  // Cleanup fixture regardless of outcome
  cleanupCodingFixture();

  const expected_t2_agents = ["execution", "verification", "learning_signal"];
  const missing_t2 = expected_t2_agents.filter((id) => !snapT2.heartbeats[id]);

  return {
    probe: "C",
    conversation_id: convId,
    turn_1: {
      duration_ms: t1_ms,
      state: r1.state,
      rationale: r1.summary?.rationale ?? null,
      verb_family: r1.summary?.verb_family ?? null,
      zero_llm: r1.zero_llm,
      snap: snapT1,
    },
    turn_2: {
      duration_ms: t2_ms,
      state: r2.state,
      rationale: r2.summary?.rationale ?? null,
      verb_family: r2.summary?.verb_family ?? null,
      zero_llm: r2.zero_llm,
      trace_tail: (r2.trace ?? []).slice(-25),
      snap: snapT2,
    },
    file_evidence: {
      before_sha: sha256(beforeSrc),
      after_sha: sha256(afterSrc),
      changed: file_changed,
      returns_7: returns7,
      returns_42: returns42,
      after_preview: afterSrc,
    },
    execution_agents_beat: missing_t2.length === 0,
    missing_execution_agents: missing_t2,
    coding_verdict:
      r2.state === "verified" && returns42
        ? "CODING_TEST_PASSED"
        : r2.state === "verified" && !returns42
          ? "STATE_VERIFIED_BUT_FILE_UNCHANGED"
          : r2.state === "failed"
            ? "CODING_LOOP_FAILED"
            : `INCOMPLETE_${r2.state}`,
  };
}

import crypto from "node:crypto";
function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const receipt = {
    date: new Date().toISOString(),
    zero_llm: true,
    probes: {},
    summary: {},
  };

  receipt.probes.A = await probeA(); await sleep(500);
  receipt.probes.B = await probeB(); await sleep(500);
  receipt.probes.C = await probeC();

  // Summary
  const A = receipt.probes.A, B = receipt.probes.B, C = receipt.probes.C;
  receipt.summary = {
    A_baseline_agents_all_beat: A.all_expected_beat,
    A_registered_agents_count: A.snap.agents_count,
    B_investigation_agents_all_beat: B.all_expected_beat,
    B_missing: B.missing_from_expected,
    B_registered_agents_count: B.snap.agents_count,
    C_coding_verdict: C.coding_verdict,
    C_turn1_state: C.turn_1.state,
    C_turn2_state: C.turn_2.state,
    C_file_changed: C.file_evidence.changed,
    C_returns_42: C.file_evidence.returns_42,
    C_execution_agents_beat: C.execution_agents_beat,
    C_missing_execution: C.missing_execution_agents,
    zero_llm_all_probes:
      A.zero_llm !== false && B.zero_llm !== false && C.turn_1.zero_llm !== false && C.turn_2.zero_llm !== false,
  };

  const CONNECTION_VERIFIED = A.all_expected_beat && B.all_expected_beat;
  const CODING_TEST_PASSED = C.coding_verdict === "CODING_TEST_PASSED";

  receipt.verdict = {
    connection: CONNECTION_VERIFIED ? "ALL_AGENTS_CONNECTED_WITH_DATA_FLOW_AND_HEARTBEAT" : "PARTIAL_CONNECTION",
    coding_test: CODING_TEST_PASSED ? "PASSED" : "FAILED",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "connection-and-coding-probe-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(receipt.summary, null, 2));
  console.log("\n=== VERDICT ===");
  console.log(JSON.stringify(receipt.verdict, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
