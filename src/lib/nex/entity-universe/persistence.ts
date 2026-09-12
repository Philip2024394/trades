// src/lib/nex/entity-universe/persistence.ts
//
// NEX Entity Universe · JSONL persistence
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
//
// §39 · no database schema change. JSONL under data/nex-entity-universe/.
// Production migration path: rows map 1:1 to Postgres tables
// (nex_entity_businesses, nex_entity_placements, nex_entity_changes)
// when a separate authorization is granted.
//
// §11 · append-only for changes. Businesses + placements support
// updates (in-place rewrite of the JSONL) because their CURRENT state
// is the query hot path; every mutation ALSO writes a ChangeRecord so
// history is preserved.
//
// §26 · atomic writes via tmp + rename so a concurrent reader never
// sees a torn file.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BusinessId,
  BusinessIdentity,
  BusinessPlacement,
  ChangeRecord,
  EvidenceId,
  EvidenceRef,
  PlacementId,
  PlacementStatus,
} from "./types";
import type { CandidatePool } from "./identity-matching";

// ── Paths ─────────────────────────────────────────────────────────

function dataRoot(): string {
  const override = process.env.NEX_ENTITY_UNIVERSE_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "nex-entity-universe");
}
function businessesPath(): string { return path.join(dataRoot(), "businesses.jsonl"); }
function placementsPath(): string { return path.join(dataRoot(), "placements.jsonl"); }
function changesPath(): string { return path.join(dataRoot(), "changes.jsonl"); }
function evidencePath(): string { return path.join(dataRoot(), "evidence.jsonl"); }

function ensureDir(): void {
  const d = dataRoot();
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function readAllLines<T>(p: string): T[] {
  try {
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return [];
    return raw.split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as T);
  } catch { return []; }
}

function appendLine(p: string, obj: unknown): void {
  ensureDir();
  fs.appendFileSync(p, JSON.stringify(obj) + "\n", "utf8");
}

function atomicRewrite<T>(p: string, records: ReadonlyArray<T>): void {
  ensureDir();
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : ""), "utf8");
  fs.renameSync(tmp, p);
}

// ── Evidence ──────────────────────────────────────────────────────

export function recordEvidence(ev: Omit<EvidenceRef, "evidence_id">): EvidenceRef {
  const full: EvidenceRef = { ...ev, evidence_id: randomUUID() };
  appendLine(evidencePath(), full);
  return full;
}

export function readEvidence(evidence_id: EvidenceId): EvidenceRef | null {
  const all = readAllLines<EvidenceRef>(evidencePath());
  for (let i = all.length - 1; i >= 0; i--) if (all[i].evidence_id === evidence_id) return all[i];
  return null;
}

// ── Businesses ────────────────────────────────────────────────────

export function readAllBusinesses(): BusinessIdentity[] {
  return readAllLines<BusinessIdentity>(businessesPath());
}

export function readBusiness(business_id: BusinessId): BusinessIdentity | null {
  const all = readAllBusinesses();
  for (let i = all.length - 1; i >= 0; i--) if (all[i].business_id === business_id) return all[i];
  return null;
}

export function upsertBusiness(input: {
  business: BusinessIdentity;
  change: ChangeRecord | null;
}): BusinessIdentity {
  const all = readAllBusinesses();
  const idx = all.findIndex((b) => b.business_id === input.business.business_id);
  if (idx < 0) all.push(input.business); else all[idx] = input.business;
  atomicRewrite(businessesPath(), all);
  if (input.change) appendLine(changesPath(), input.change);
  return input.business;
}

// ── Placements ────────────────────────────────────────────────────

export function readAllPlacements(): BusinessPlacement[] {
  return readAllLines<BusinessPlacement>(placementsPath());
}

export function readPlacement(placement_id: PlacementId): BusinessPlacement | null {
  const all = readAllPlacements();
  for (let i = all.length - 1; i >= 0; i--) if (all[i].placement_id === placement_id) return all[i];
  return null;
}

export function readActivePlacementsForBusiness(business_id: BusinessId): BusinessPlacement[] {
  return readAllPlacements()
    .filter((p) => p.business_id === business_id
      && (p.status === "ACTIVE" || p.status === "STARTING" || p.status === "PROVISIONAL"));
}

export function readAllPlacementsForBusiness(business_id: BusinessId): BusinessPlacement[] {
  return readAllPlacements().filter((p) => p.business_id === business_id);
}

export function upsertPlacement(input: {
  placement: BusinessPlacement;
  changes: ReadonlyArray<ChangeRecord>;
}): BusinessPlacement {
  const all = readAllPlacements();
  const idx = all.findIndex((p) => p.placement_id === input.placement.placement_id);
  if (idx < 0) all.push(input.placement); else all[idx] = input.placement;
  atomicRewrite(placementsPath(), all);
  for (const c of input.changes) appendLine(changesPath(), c);
  return input.placement;
}

/** Convenience: mark placements HISTORICAL when a business moves.
 *  Appends a ChangeRecord per demoted placement. Returns the new state
 *  for each affected placement. */
export function demotePlacementsToHistorical(input: {
  business_id: BusinessId;
  demote_placement_ids: ReadonlyArray<PlacementId>;
  reason: string;
  evidence_ids: EvidenceId[];
  now_iso?: string;
}): BusinessPlacement[] {
  const now = input.now_iso ?? new Date().toISOString();
  const all = readAllPlacements();
  const affected: BusinessPlacement[] = [];
  const changes: ChangeRecord[] = [];
  for (const p of all) {
    if (p.business_id !== input.business_id) continue;
    if (!input.demote_placement_ids.includes(p.placement_id)) continue;
    if (p.status !== "ACTIVE" && p.status !== "STARTING") continue;
    const prev: PlacementStatus = p.status;
    p.status = "HISTORICAL";
    p.effective_to_iso = now;
    affected.push(p);
    changes.push({
      change_id: randomUUID(),
      subject: { kind: "placement", placement_id: p.placement_id, business_id: p.business_id },
      kind: "STATUS_CHANGED",
      previous_value: prev,
      new_value: "HISTORICAL",
      change_reason: input.reason,
      evidence_ids: input.evidence_ids,
      confidence: "HIGH",
      observed_at_iso: now,
    });
  }
  atomicRewrite(placementsPath(), all);
  for (const c of changes) appendLine(changesPath(), c);
  return affected;
}

// ── Changes ───────────────────────────────────────────────────────

export function readAllChanges(): ChangeRecord[] {
  return readAllLines<ChangeRecord>(changesPath());
}

export function readChangesForBusiness(business_id: BusinessId): ChangeRecord[] {
  return readAllChanges().filter((c) => {
    if (c.subject.kind === "business") return c.subject.business_id === business_id;
    return c.subject.business_id === business_id;
  });
}

export function readChangesForPlacement(placement_id: PlacementId): ChangeRecord[] {
  return readAllChanges().filter((c) => c.subject.kind === "placement" && c.subject.placement_id === placement_id);
}

// ── CandidatePool builder (for identity-matching) ─────────────────

export function buildCandidatePool(): CandidatePool {
  const businesses = readAllBusinesses();
  const placements = readAllPlacements();
  return businesses.map((b) => ({
    identity: b,
    placements: placements.filter((p) => p.business_id === b.business_id),
  }));
}
