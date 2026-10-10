// NEX Code Brain · Write-lease system
// Exclusive · TTL · atomic acquisition via O_EXCL create.
// Guarantees: two lanes cannot both hold an active lease on the same path.
//
// Leases are stored as one file per leased path under
// data/nex-code-brain/leases/<sha1(path)>.lock. Atomic exclusive creation
// via `writeFileSync(..., { flag: "wx" })` ensures cross-process safety on
// both POSIX and NTFS.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import * as path from "node:path";
import type { LeaseRequest, LeaseResult, WriteLease } from "./types";
import { routePath, normaliseRel } from "./path-router";
import { findLane, getBrainDir } from "./lane-registry";

function getLeaseDir(): string {
  return path.join(getBrainDir(), "leases");
}
function getHistoryPath(): string {
  return path.join(getLeaseDir(), "history.jsonl");
}
const DEFAULT_TTL_SECONDS = 1800;
const MAX_PATH_LENGTH = 4096; // defense-in-depth · rejects oversized paths

const UNIVERSAL_DENY: readonly string[] = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.local.backup-pre-cutover-2026-09-10",
  "CLAUDE.md",
  "supabase/migrations/20260915180000_nex_visual_structural_lock_architecture.sql",
];
const UNIVERSAL_DENY_PREFIXES: readonly string[] = ["src/lib/nex-v3/", "data/nex-visual-proving/"];

function ensureLeaseDir(): void {
  if (!existsSync(getLeaseDir())) mkdirSync(getLeaseDir(), { recursive: true });
}

function isProtectedPath(rel: string): boolean {
  if (UNIVERSAL_DENY.includes(rel)) return true;
  return UNIVERSAL_DENY_PREFIXES.some((p) => rel === p.slice(0, -1) || rel.startsWith(p));
}

function pathIsRepoRelative(rel: string): boolean {
  return !rel.startsWith("..") && !path.isAbsolute(rel) && !rel.includes("\0");
}

function lockFileFor(rel: string): string {
  const sha = createHash("sha1").update(rel).digest("hex").slice(0, 24);
  return path.join(getLeaseDir(), `${sha}.lock`);
}

function newLeaseId(): string {
  return `lease-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

function appendHistory(event: "acquired" | "released" | "reclaimed" | "expired", lease: WriteLease): void {
  ensureLeaseDir();
  appendFileSync(getHistoryPath(), JSON.stringify({ event, ...lease, event_at: new Date().toISOString() }) + "\n", "utf8");
}

/**
 * Try to acquire an exclusive write lease for a path.
 * The path must (a) resolve to the requesting lane, (b) not be universally denied,
 * (c) not be currently leased by a different holder unless the existing lease has expired.
 */
export function acquireLease(req: LeaseRequest): LeaseResult {
  const rel = normaliseRel(req.path);
  if (rel.length > MAX_PATH_LENGTH) {
    return { ok: false, kind: "UNSAFE_PATH", reason: `path exceeds ${MAX_PATH_LENGTH} chars (defense-in-depth)` };
  }
  if (!pathIsRepoRelative(rel)) {
    return { ok: false, kind: "UNSAFE_PATH", reason: `path escapes repo or contains null byte: ${req.path}` };
  }
  if (isProtectedPath(rel)) {
    return { ok: false, kind: "UNSAFE_PATH", reason: `path is universally denied: ${rel}` };
  }

  const lane = findLane(req.agent_lane);
  if (!lane) {
    return { ok: false, kind: "UNKNOWN_LANE", reason: `lane not registered: ${req.agent_lane}` };
  }
  if (lane.status !== "active") {
    return { ok: false, kind: "LANE_INACTIVE", reason: `lane "${req.agent_lane}" is ${lane.status}` };
  }

  const routed = routePath(rel);
  if (routed.resolved_lane !== req.agent_lane) {
    return {
      ok: false,
      kind: "WRONG_LANE",
      reason: `path "${rel}" routes to lane "${routed.resolved_lane ?? "(unrouted)"}", not "${req.agent_lane}"`,
      expected_lane: routed.resolved_lane ?? undefined,
    };
  }

  ensureLeaseDir();
  const lockPath = lockFileFor(rel);
  const now = new Date();
  const ttl_seconds = req.ttl_seconds && req.ttl_seconds > 0 ? Math.min(req.ttl_seconds, 24 * 3600) : DEFAULT_TTL_SECONDS;
  const record: WriteLease = {
    lease_id: newLeaseId(),
    path: rel,
    agent_lane: req.agent_lane,
    task_id: req.task_id ?? null,
    acquired_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttl_seconds * 1000).toISOString(),
    holder_pid: process.pid,
    holder_agent_id: req.holder_agent_id ?? null,
  };

  try {
    writeFileSync(lockPath, JSON.stringify(record, null, 2), { flag: "wx", encoding: "utf8" });
    appendHistory("acquired", record);
    return { ok: true, lease: record };
  } catch {
    // Lock exists · inspect
    let existing: WriteLease | null = null;
    try {
      existing = JSON.parse(readFileSync(lockPath, "utf8")) as WriteLease;
    } catch {
      /* malformed lease — reclaim */
    }
    if (existing) {
      const expired = new Date(existing.expires_at).getTime() < Date.now();
      if (expired) {
        appendHistory("expired", existing);
        try {
          unlinkSync(lockPath);
          writeFileSync(lockPath, JSON.stringify(record, null, 2), { flag: "wx", encoding: "utf8" });
          appendHistory("reclaimed", record);
          return { ok: true, lease: record, reclaimed_from: existing };
        } catch {
          return {
            ok: false,
            kind: "CONFLICT",
            reason: `path "${rel}" is leased and could not be reclaimed`,
            conflict: existing,
          };
        }
      }
      return {
        ok: false,
        kind: "CONFLICT",
        reason: `path "${rel}" is currently leased by lane "${existing.agent_lane}" until ${existing.expires_at}`,
        conflict: existing,
      };
    }
    // Malformed lease file · try to remove and re-acquire once
    try {
      unlinkSync(lockPath);
      writeFileSync(lockPath, JSON.stringify(record, null, 2), { flag: "wx", encoding: "utf8" });
      appendHistory("acquired", record);
      return { ok: true, lease: record };
    } catch {
      return { ok: false, kind: "CONFLICT", reason: `path "${rel}" is contested` };
    }
  }
}

/** Release a lease · only the holder (matching lease_id) may release. */
export function releaseLease(lease_id: string): { ok: boolean; reason?: string } {
  ensureLeaseDir();
  const all = listActiveLeases();
  const target = all.find((l) => l.lease_id === lease_id);
  if (!target) return { ok: false, reason: `no active lease with id ${lease_id}` };
  const lockPath = lockFileFor(target.path);
  try {
    unlinkSync(lockPath);
    appendHistory("released", target);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Force-release ALL leases for a lane · Founder / admin operation. */
export function forceReleaseByLane(lane_id: string): { released: number } {
  const all = listActiveLeases();
  let n = 0;
  for (const lease of all) {
    if (lease.agent_lane !== lane_id) continue;
    const r = releaseLease(lease.lease_id);
    if (r.ok) n++;
  }
  return { released: n };
}

/** Return all currently-held (non-expired) leases. */
export function listActiveLeases(): readonly WriteLease[] {
  ensureLeaseDir();
  const now = Date.now();
  const out: WriteLease[] = [];
  for (const f of readdirSync(getLeaseDir())) {
    if (!f.endsWith(".lock")) continue;
    try {
      const l = JSON.parse(readFileSync(path.join(getLeaseDir(), f), "utf8")) as WriteLease;
      if (new Date(l.expires_at).getTime() >= now) out.push(l);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/** Sweep expired leases · returns count removed. */
export function sweepExpiredLeases(): { removed: number } {
  ensureLeaseDir();
  const now = Date.now();
  let removed = 0;
  for (const f of readdirSync(getLeaseDir())) {
    if (!f.endsWith(".lock")) continue;
    const p = path.join(getLeaseDir(), f);
    try {
      const l = JSON.parse(readFileSync(p, "utf8")) as WriteLease;
      if (new Date(l.expires_at).getTime() < now) {
        appendHistory("expired", l);
        unlinkSync(p);
        removed++;
      }
    } catch {
      /* skip */
    }
  }
  return { removed };
}

// Test-only reset.
export function __resetLeasesForTest(): void {
  if (!existsSync(getLeaseDir())) return;
  for (const f of readdirSync(getLeaseDir())) {
    try {
      unlinkSync(path.join(getLeaseDir(), f));
    } catch {
      /* nothing */
    }
  }
}

export { getLeaseDir, getHistoryPath };
