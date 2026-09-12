// src/lib/nex/agent-runtime/event-bus.ts
//
// NEX Agent Runtime · append-only event bus (§13)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// Events are the only inter-agent communication channel (§11 · §36).
// Append-only, attributable, timestamp-ordered. Never truncated by the
// runtime — external tooling may rotate offline.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { randomUUID } from "node:crypto";
import { type AgentEvent, type EventKind, type AgentId } from "./types";
import { eventsPath, runtimeDataRoot } from "./paths";

function ensureDir(): void {
  const dir = runtimeDataRoot();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Fire #1 · Event-log rotation (Philip 2026-09-10) ──────────────
// Root cause of the 2026-09-09 crash cascade: events.jsonl grew
// unbounded to 5.7 MB / 21,025 lines while C: drive had 7.5 GB free
// (8%). First appendFileSync that hit ENOSPC crashed the caller,
// heartbeats stopped being written, watchdog interpreted the silence
// as death, and all 7 agents were killed and restarted at once.
//
// Rotation policy:
//   · Check current file size on every emit (cheap statSync)
//   · When size >= ROTATE_AT_BYTES (5 MB), rename to
//     events-YYYYMMDDTHHMMSSZ.jsonl and start fresh
//   · Gzip the archived file in the background (fire-and-forget)
//   · Prune archives older than KEEP_DAYS
//   · Rotation errors NEVER propagate — they log to stderr and the
//     next emit tries again. The daemon must survive rotation faults.
const ROTATE_AT_BYTES = 5 * 1024 * 1024;
const KEEP_DAYS = 7;
const KEEP_MS = KEEP_DAYS * 24 * 60 * 60 * 1000;
let pruneCheckedAtMs = 0;

function archiveTimestamp(): string {
  // Strip separators from ISO timestamp so we get a filesystem-safe suffix.
  // Character class is spelled out to avoid Tailwind's JIT scanner
  // treating the compact pattern as a class-name literal.
  return new Date().toISOString().replace(/-/g, "").replace(/:/g, "").replace(/\./g, "");
}

function rotateIfNeeded(): void {
  try {
    const p = eventsPath();
    const st = fs.statSync(p);
    if (st.size < ROTATE_AT_BYTES) return;
    const dir = runtimeDataRoot();
    const archived = path.join(dir, `events-${archiveTimestamp()}.jsonl`);
    fs.renameSync(p, archived);
    // Fire-and-forget gzip · errors here don't matter, the .jsonl is
    // already off the hot path.
    fs.readFile(archived, (readErr, buf) => {
      if (readErr) return;
      zlib.gzip(buf, (zErr, gz) => {
        if (zErr || !gz) return;
        fs.writeFile(`${archived}.gz`, gz, (wErr) => {
          if (!wErr) fs.unlink(archived, () => { /* ignore */ });
        });
      });
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ENOENT") return; // file didn't exist yet, nothing to rotate
    process.stderr.write(`[event-bus] rotate error: ${String(err)}\n`);
  }
}

function pruneOldArchives(nowMs: number): void {
  // Cheap gate · at most one prune per hour per process
  if (nowMs - pruneCheckedAtMs < 60 * 60 * 1000) return;
  pruneCheckedAtMs = nowMs;
  try {
    const dir = runtimeDataRoot();
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (!name.startsWith("events-")) continue;
      if (!name.endsWith(".jsonl") && !name.endsWith(".jsonl.gz")) continue;
      try {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (nowMs - st.mtimeMs > KEEP_MS) fs.unlinkSync(full);
      } catch { /* ignore per-file errors */ }
    }
  } catch { /* ignore prune errors */ }
}

/** Append a single event. Synchronous by design — events must be
 *  durable before the caller returns to work. */
export function emitEvent(input: {
  kind: EventKind;
  agent_id: AgentId | "control_plane" | "watchdog";
  process_id: number | null;
  attributes?: Record<string, string | number | boolean | null>;
}): AgentEvent {
  ensureDir();
  rotateIfNeeded();
  pruneOldArchives(Date.now());
  const event: AgentEvent = {
    event_id: randomUUID(),
    kind: input.kind,
    agent_id: input.agent_id,
    timestamp_iso: new Date().toISOString(),
    process_id: input.process_id,
    attributes: input.attributes ?? {},
  };
  try {
    fs.appendFileSync(eventsPath(), JSON.stringify(event) + "\n", "utf8");
  } catch (err) {
    // Fire #1 hardening · if the append fails (disk full, permission
    // race, whatever), do NOT crash the caller. The whole point of
    // rotation is that the daemon survives storage faults. Best-effort
    // trigger a rotation and log the error so the founder sees it.
    process.stderr.write(`[event-bus] append error: ${String(err)}\n`);
    try { rotateIfNeeded(); } catch { /* silent */ }
  }
  return event;
}

/** Read the last N events (tail). Used by /status and /watchdog for
 *  recent-activity display. Does NOT hold a lock — best-effort tail. */
export function readRecentEvents(limit: number): AgentEvent[] {
  try {
    const p = eventsPath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return [];
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const start = Math.max(0, lines.length - limit);
    const out: AgentEvent[] = [];
    for (let i = start; i < lines.length; i++) {
      try { out.push(JSON.parse(lines[i]) as AgentEvent); } catch { /* skip malformed */ }
    }
    return out;
  } catch {
    return [];
  }
}

/** Read events matching filter · used by watchdog for restart counting
 *  and by tests. */
export function readEventsSince(sinceMs: number, filter?: { kind?: EventKind; agent_id?: AgentEvent["agent_id"] }): AgentEvent[] {
  const all = readRecentEvents(10_000);
  const out: AgentEvent[] = [];
  for (const e of all) {
    const t = Date.parse(e.timestamp_iso);
    if (Number.isNaN(t) || t < sinceMs) continue;
    if (filter?.kind && e.kind !== filter.kind) continue;
    if (filter?.agent_id && e.agent_id !== filter.agent_id) continue;
    out.push(e);
  }
  return out;
}
