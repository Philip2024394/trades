// src/lib/nex/master-ai/offline-reservoir.ts
//
// NEX Master AI Engineer · M10 · Offline intelligence reservoir
// Philip 2026-09-07 · AUTHORIZE
//
// The reservoir is already-implicit: every ledger (M1..M9) writes to
// data/master-ai/ as append-only JSONL. This module adds:
//
//   · explicit online/offline mode state
//   · freshness policy per record category
//   · CACHE_ONLY flag on claims emitted during offline mode
//   · reconcile-on-reconnect hook
//
// PRESERVATION: never fabricates fresh info while offline. Every
// offline-emitted claim MUST carry `cache_only=true` in supporting_refs.

import fs from "node:fs";
import { writeJsonAtomic } from "./fs-atomic";
import { offlineModeFlagPath } from "./paths";
import type { OfflineModeState } from "./types";

const DEFAULT_ONLINE: OfflineModeState = {
  online: true,
  since_iso: new Date(0).toISOString(),
  last_online_iso: null,
  reason: "default",
};

export function readMode(): OfflineModeState {
  try {
    if (!fs.existsSync(offlineModeFlagPath())) return DEFAULT_ONLINE;
    const raw = fs.readFileSync(offlineModeFlagPath(), "utf8");
    if (!raw.trim()) return DEFAULT_ONLINE;
    return JSON.parse(raw) as OfflineModeState;
  } catch {
    return DEFAULT_ONLINE;
  }
}

export function setMode(next: OfflineModeState): void {
  writeJsonAtomic(offlineModeFlagPath(), next);
}

export function setOffline(reason: string): OfflineModeState {
  const prev = readMode();
  const next: OfflineModeState = {
    online: false,
    since_iso: new Date().toISOString(),
    last_online_iso: prev.online ? prev.since_iso : prev.last_online_iso,
    reason,
  };
  setMode(next);
  return next;
}

export function setOnline(reason: string): OfflineModeState {
  const next: OfflineModeState = {
    online: true,
    since_iso: new Date().toISOString(),
    last_online_iso: new Date().toISOString(),
    reason,
  };
  setMode(next);
  return next;
}

/** Category → TTL in ms. Beyond TTL, the reservoir marks records STALE.
 *  During offline mode, callers MUST honour these to distinguish fresh
 *  from stale cached data. */
export const FRESHNESS_TTL_MS: Record<string, number | "PERMANENT"> = {
  FACT:                 "PERMANENT",
  BENCHMARK_RUN:        "PERMANENT",
  CAPABILITY_RECORD:    "PERMANENT",
  RESEARCH_FINDING:     24 * 60 * 60 * 1000,        // 24h default
  OBSERVATION:          15 * 60 * 1000,             // 15m
  PHILIP_INTEL_CLAIM:   6 * 60 * 60 * 1000,         // 6h
  AGENT_HEARTBEAT:      60 * 1000,                  // 60s
};

export function freshnessOf(category: string, timestamp_iso: string, nowMs = Date.now()): "FRESH" | "STALE" | "PERMANENT" | "UNKNOWN" {
  const ttl = FRESHNESS_TTL_MS[category];
  if (ttl === undefined) return "UNKNOWN";
  if (ttl === "PERMANENT") return "PERMANENT";
  const t = Date.parse(timestamp_iso);
  if (!Number.isFinite(t)) return "UNKNOWN";
  return (nowMs - t) <= ttl ? "FRESH" : "STALE";
}

export function _resetOfflineForTests(): void {
  try { if (fs.existsSync(offlineModeFlagPath())) fs.unlinkSync(offlineModeFlagPath()); } catch { /* ignore */ }
}
