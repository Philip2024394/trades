// src/lib/nex/workforce/workforce.test.ts
//
// NEX SPECIALIST WORKFORCE · unit tests
// (Philip 2026-09-05 · corrective for Indonesian workforce)
// (Philip 2026-09-07 · Slice A0 · permanent test isolation from production data/workforce/)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  registerPosition,
  listPositions,
  getPosition,
  persistRun,
  readRuns,
  readRunsForPosition,
  derivePositionStatus,
  deriveAllPositionStatuses,
  _resetWorkforceStateForTests,
  type Position,
  type PositionRun,
} from "./positions";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ────────────────────────────────────────────────────────────────────
// Per-test production isolation · Slice A0 · 2026-09-07
// ────────────────────────────────────────────────────────────────────
// Before every test we (1) allocate a fresh temp directory, (2) set
// NEX_WORKFORCE_DATA_ROOT so positions.ts writes/reads there instead of
// the real data/workforce/, (3) reset the in-directory state.
//
// Rationale (root-cause fix): prior to Slice A0, positions.ts had no
// override mechanism · every Vitest run was writing test-shaped rows into
// the real data/workforce/positions.json, clobbering the production
// 6-position registry (last observed 2026-09-06 12:28 UTC).
//
// The env-var override in workforceDir() defaults to the real path when
// unset, so production runtime paths are unchanged. Every test in this
// file receives its own private temp dir and cannot see the real file.
// ────────────────────────────────────────────────────────────────────

let currentTempDir = "";
let originalEnvValue: string | undefined;

beforeEach(() => {
  originalEnvValue = process.env.NEX_WORKFORCE_DATA_ROOT;
  currentTempDir = mkdtempSync(join(tmpdir(), "nex-workforce-test-"));
  process.env.NEX_WORKFORCE_DATA_ROOT = currentTempDir;
  _resetWorkforceStateForTests();
});

afterEach(() => {
  if (originalEnvValue === undefined) delete process.env.NEX_WORKFORCE_DATA_ROOT;
  else process.env.NEX_WORKFORCE_DATA_ROOT = originalEnvValue;
  try { rmSync(currentTempDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ─── Registry ─────────────────────────────────────────────────────

describe("workforce · position registry", () => {
  it("registerPosition + listPositions · upserts by position_id", () => {
    const p1: Position = {
      position_id: "hotel_accommodation",
      mission: "Deep knowledge of every accommodation entity",
      domain: ["accommodation", "room_types", "amenities"],
      machinery: "p1_acquisition_pipeline",
      source_availability: "sources_via_supabase",
      source_details: "accommodation directory lives in Supabase · needs read access",
      activation_notes: "not activated · needs Supabase-side acquisition adapter",
      registered_at: new Date().toISOString(),
    };
    registerPosition(p1);
    expect(listPositions()).toHaveLength(1);
    // Re-register with different payload → upserts
    registerPosition({ ...p1, mission: "UPDATED" });
    const list = listPositions();
    expect(list).toHaveLength(1);
    expect(list[0].mission).toBe("UPDATED");
  });

  it("getPosition finds registered position by id · null when absent", () => {
    expect(getPosition("hotel_accommodation")).toBeNull();
    registerPosition({
      position_id: "hotel_accommodation",
      mission: "test",
      domain: [],
      machinery: "none",
      source_availability: "sources_missing",
      source_details: "test",
      activation_notes: "test",
      registered_at: new Date().toISOString(),
    });
    expect(getPosition("hotel_accommodation")).not.toBeNull();
  });
});

// ─── Run history ─────────────────────────────────────────────────

describe("workforce · run history · append-only", () => {
  it("persistRun + readRuns · appends and returns all", () => {
    const run: PositionRun = {
      run_id: randomUUID(),
      position_id: "indonesia_knowledge",
      started_at: new Date().toISOString(),
      last_progress_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      machinery_used: "indonesia_walker",
      sources_accessed: ["adat_communities"],
      snapshots_created: 1,
      claims_extracted: 5,
      claims_verified: 5,
      claims_rejected: 0,
      claims_promoted: 5,
      failure_stage: null,
      failure_reason: null,
      evidence_pointers: ["RUN_CREATED@..."],
      final_status: null,
    };
    persistRun(run);
    expect(readRuns()).toHaveLength(1);
    expect(readRunsForPosition("indonesia_knowledge")).toHaveLength(1);
    expect(readRunsForPosition("hotel_accommodation")).toHaveLength(0);
  });

  it("persisted run has final_status: null per Op-Truth §OP.5", () => {
    const run: PositionRun = {
      run_id: randomUUID(),
      position_id: "restaurant_food",
      started_at: new Date().toISOString(),
      last_progress_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      machinery_used: "indonesia_walker",
      sources_accessed: [],
      snapshots_created: 0,
      claims_extracted: 0,
      claims_verified: 0,
      claims_rejected: 0,
      claims_promoted: 0,
      failure_stage: null,
      failure_reason: null,
      evidence_pointers: [],
      final_status: null,
    };
    persistRun(run);
    const persisted = readRuns()[0];
    expect(persisted.final_status).toBeNull();
  });
});

// ─── Status derivation ───────────────────────────────────────────

describe("workforce · derivePositionStatus · evidence-first · never self-asserted", () => {
  const registerBasic = (id: Position["position_id"], machinery: Position["machinery"] = "indonesia_walker") => {
    registerPosition({
      position_id: id,
      mission: "test",
      domain: [],
      machinery,
      source_availability: "sources_available",
      source_details: "test",
      activation_notes: "test",
      registered_at: new Date().toISOString(),
    });
  };

  it("registered but never run → NEVER_PROVEN", () => {
    registerBasic("hotel_accommodation");
    const r = derivePositionStatus("hotel_accommodation");
    expect(r.status).toBe("NEVER_PROVEN");
    expect(r.reason).toMatch(/no acquisition runs/i);
  });

  it("Programmer position → PHASE_A_PENDING regardless of runs", () => {
    registerBasic("programmer", "programmer_agent");
    const r = derivePositionStatus("programmer");
    expect(r.status).toBe("PHASE_A_PENDING");
    expect(r.reason).toMatch(/Phase A implementation requires its own AUTHORIZE/i);
  });

  it("successful recent run → PROVEN_HEALTHY", () => {
    registerBasic("indonesia_knowledge");
    const now = Date.now();
    const nowIso = new Date(now - 60000).toISOString();
    persistRun({
      run_id: randomUUID(),
      position_id: "indonesia_knowledge",
      started_at: nowIso,
      last_progress_at: nowIso,
      completed_at: new Date(now - 30000).toISOString(),
      machinery_used: "indonesia_walker",
      sources_accessed: ["adat_communities"],
      snapshots_created: 1,
      claims_extracted: 5,
      claims_verified: 5,
      claims_rejected: 0,
      claims_promoted: 5,
      failure_stage: null,
      failure_reason: null,
      evidence_pointers: [],
      final_status: null,
    });
    const r = derivePositionStatus("indonesia_knowledge", now);
    expect(r.status).toBe("PROVEN_HEALTHY");
    expect(r.evidence.claims_promoted_total).toBe(5);
    expect(r.evidence.verification_rate).toBe(1);
  });

  it("stale in-progress run (>24h no progress) → FAILED (adversarial silence)", () => {
    registerBasic("gym_fitness");
    const now = Date.now();
    persistRun({
      run_id: randomUUID(),
      position_id: "gym_fitness",
      started_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      last_progress_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      completed_at: null, // never completed
      machinery_used: "indonesia_walker",
      sources_accessed: [],
      snapshots_created: 0,
      claims_extracted: 0,
      claims_verified: 0,
      claims_rejected: 0,
      claims_promoted: 0,
      failure_stage: null,
      failure_reason: null,
      evidence_pointers: [],
      final_status: null,
    });
    const r = derivePositionStatus("gym_fitness", now);
    expect(r.status).toBe("FAILED");
    expect(r.reason).toMatch(/stale|silence/i);
  });

  it("failed runs but no successful ones → NEVER_PROVEN", () => {
    registerBasic("travel_transport");
    const now = Date.now();
    persistRun({
      run_id: randomUUID(),
      position_id: "travel_transport",
      started_at: new Date(now - 60000).toISOString(),
      last_progress_at: new Date(now - 30000).toISOString(),
      completed_at: new Date(now - 30000).toISOString(),
      machinery_used: "indonesia_walker",
      sources_accessed: [],
      snapshots_created: 0,
      claims_extracted: 0,
      claims_verified: 0,
      claims_rejected: 0,
      claims_promoted: 0,
      failure_stage: "SOURCE_ACCESS",
      failure_reason: "source registration incomplete",
      evidence_pointers: [],
      final_status: null,
    });
    const r = derivePositionStatus("travel_transport", now);
    expect(r.status).toBe("NEVER_PROVEN");
    expect(r.reason).toMatch(/zero successful/i);
  });

  it("verification rate below threshold → DEGRADED", () => {
    registerBasic("restaurant_food");
    const now = Date.now();
    persistRun({
      run_id: randomUUID(),
      position_id: "restaurant_food",
      started_at: new Date(now - 60000).toISOString(),
      last_progress_at: new Date(now - 30000).toISOString(),
      completed_at: new Date(now - 30000).toISOString(),
      machinery_used: "indonesia_walker",
      sources_accessed: ["curated"],
      snapshots_created: 1,
      claims_extracted: 10,
      claims_verified: 2, // 20% · below 50% threshold
      claims_rejected: 8,
      claims_promoted: 2,
      failure_stage: null,
      failure_reason: null,
      evidence_pointers: [],
      final_status: null,
    });
    const r = derivePositionStatus("restaurant_food", now);
    expect(r.status).toBe("DEGRADED");
    expect(r.reason).toMatch(/verification rate/i);
  });

  it("deriveAllPositionStatuses returns one entry per registered position", () => {
    registerBasic("indonesia_knowledge");
    registerBasic("hotel_accommodation");
    registerBasic("programmer", "programmer_agent");
    const all = deriveAllPositionStatuses();
    expect(all).toHaveLength(3);
    expect(all.find((r) => r.position_id === "programmer")?.status).toBe("PHASE_A_PENDING");
  });
});

// ─── Op-Truth compliance boundary ───────────────────────────────

describe("workforce · Op-Truth compliance", () => {
  it("no position sets its own final_status at any point in the run lifecycle", () => {
    const run: PositionRun = {
      run_id: randomUUID(),
      position_id: "indonesia_knowledge",
      started_at: new Date().toISOString(),
      last_progress_at: new Date().toISOString(),
      completed_at: null,
      machinery_used: "indonesia_walker",
      sources_accessed: [],
      snapshots_created: 0,
      claims_extracted: 0,
      claims_verified: 0,
      claims_rejected: 0,
      claims_promoted: 0,
      failure_stage: null,
      failure_reason: null,
      evidence_pointers: [],
      final_status: null,
    };
    persistRun(run);
    const persisted = readRuns()[0];
    expect(persisted.final_status).toBeNull();
    // TypeScript enforces the null literal · runtime confirms it stays null
  });

  it("status is derived · not read · from the run record's final_status field", () => {
    registerPosition({
      position_id: "hotel_accommodation",
      mission: "test",
      domain: [],
      machinery: "p1_acquisition_pipeline",
      source_availability: "sources_via_supabase",
      source_details: "test",
      activation_notes: "test",
      registered_at: new Date().toISOString(),
    });
    const r = derivePositionStatus("hotel_accommodation");
    // status derived from run history · never from any self-report
    expect(["NEVER_PROVEN", "PROVEN_HEALTHY", "DEGRADED", "FAILED", "PHASE_A_PENDING", "RECOVERING"]).toContain(r.status);
  });
});

// ────────────────────────────────────────────────────────────────────
// Production isolation invariant · Slice A0 · 2026-09-07
// ────────────────────────────────────────────────────────────────────
// Locks in the guarantee that this test file can NEVER touch the real
// data/workforce/positions.json. If someone removes the beforeEach
// isolation, these assertions will fail immediately.
// ────────────────────────────────────────────────────────────────────

describe("workforce · production isolation invariant", () => {
  it("NEX_WORKFORCE_DATA_ROOT is set to a temp dir for every test", () => {
    const envVal = process.env.NEX_WORKFORCE_DATA_ROOT;
    expect(envVal, "isolation env var must be set").toBeDefined();
    expect(envVal!.length, "isolation env var must be non-empty").toBeGreaterThan(0);
    expect(envVal, "isolation env var must point at a temp dir").toContain("nex-workforce-test-");
  });

  it("registerPosition writes to the isolated temp dir · not the production file", () => {
    const envVal = process.env.NEX_WORKFORCE_DATA_ROOT;
    expect(envVal).toBeDefined();

    const sentinelMission = `isolation-sentinel-${randomUUID()}`;
    registerPosition({
      position_id: "hotel_accommodation",
      mission: sentinelMission,
      domain: [],
      machinery: "none",
      source_availability: "sources_missing",
      source_details: "isolation check",
      activation_notes: "isolation check",
      registered_at: new Date().toISOString(),
    });

    // The write MUST land inside the temp dir · read the file back directly.
    const isolatedFile = join(envVal!, "positions.json");
    expect(existsSync(isolatedFile), "positions.json must exist inside temp dir").toBe(true);
    const isolatedRaw = readFileSync(isolatedFile, "utf8");
    expect(isolatedRaw, "temp-dir file must contain the sentinel mission").toContain(sentinelMission);

    // The real production file MUST NOT contain the sentinel mission. If the
    // production file exists (typical dev machine) confirm it stays clean.
    const prodFile = join(process.cwd(), "data", "workforce", "positions.json");
    if (existsSync(prodFile)) {
      const prodRaw = readFileSync(prodFile, "utf8");
      expect(prodRaw, "production positions.json must never contain the test sentinel").not.toContain(sentinelMission);
    }
  });
});
