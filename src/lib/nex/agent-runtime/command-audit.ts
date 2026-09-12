// src/lib/nex/agent-runtime/command-audit.ts
//
// NEX Agent Runtime · command audit log (§28)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// Every activation/deactivation command records: who requested, when,
// authorization result, previous state, new state, reason. §28: no
// silent activation, no silent shutdown.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { randomUUID } from "node:crypto";
import { type ControlCommand, type ControlCommandKind, type AgentId, type DesiredState } from "./types";
import { commandsPath, runtimeDataRoot } from "./paths";

function ensureDir(): void {
  const dir = runtimeDataRoot();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Founder 2026-09-10 · command-audit rotation (mirrors event-bus)
// Command audit log grows one line per founder command · unbounded
// growth was flagged in the security audit as a "disk-fill risk". Same
// pattern as event-bus.ts: rotate at 5 MB, gzip archive, 7-day prune.
const ROTATE_AT_BYTES = 5 * 1024 * 1024;
const KEEP_DAYS = 7;
const KEEP_MS = KEEP_DAYS * 24 * 60 * 60 * 1000;
let pruneCheckedAtMs = 0;

function archiveTimestamp(): string {
  return new Date().toISOString().replace(/-/g, "").replace(/:/g, "").replace(/\./g, "");
}

function rotateIfNeeded(): void {
  try {
    const p = commandsPath();
    const st = fs.statSync(p);
    if (st.size < ROTATE_AT_BYTES) return;
    const dir = runtimeDataRoot();
    const archived = path.join(dir, `commands-${archiveTimestamp()}.jsonl`);
    fs.renameSync(p, archived);
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
    if (code === "ENOENT") return;
    process.stderr.write(`[command-audit] rotate error: ${String(err)}\n`);
  }
}

function pruneOldArchives(nowMs: number): void {
  if (nowMs - pruneCheckedAtMs < 60 * 60 * 1000) return;
  pruneCheckedAtMs = nowMs;
  try {
    const dir = runtimeDataRoot();
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (!name.startsWith("commands-")) continue;
      if (!name.endsWith(".jsonl") && !name.endsWith(".jsonl.gz")) continue;
      try {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (nowMs - st.mtimeMs > KEEP_MS) fs.unlinkSync(full);
      } catch { /* ignore per-file */ }
    }
  } catch { /* ignore prune */ }
}

export function auditCommand(input: {
  founder_user_id: string | null;
  agent_id: AgentId | "ALL";
  command: ControlCommandKind;
  authorization: "AUTHORIZED" | "REJECTED";
  authorization_reason: string;
  previous_desired_state: DesiredState | null;
  new_desired_state: DesiredState | null;
  result: "OK" | "NOOP" | "REJECTED" | "PARTIAL";
  reason: string;
}): ControlCommand {
  ensureDir();
  rotateIfNeeded();
  pruneOldArchives(Date.now());
  const cmd: ControlCommand = {
    command_id: randomUUID(),
    founder_user_id: input.founder_user_id,
    agent_id: input.agent_id,
    command: input.command,
    timestamp_iso: new Date().toISOString(),
    authorization: input.authorization,
    authorization_reason: input.authorization_reason,
    previous_desired_state: input.previous_desired_state,
    new_desired_state: input.new_desired_state,
    result: input.result,
    reason: input.reason,
  };
  try {
    fs.appendFileSync(commandsPath(), JSON.stringify(cmd) + "\n", "utf8");
  } catch (err) {
    process.stderr.write(`[command-audit] append error: ${String(err)}\n`);
    try { rotateIfNeeded(); } catch { /* silent */ }
  }
  return cmd;
}

export function readRecentCommands(limit: number): ControlCommand[] {
  try {
    const p = commandsPath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return [];
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const start = Math.max(0, lines.length - limit);
    const out: ControlCommand[] = [];
    for (let i = start; i < lines.length; i++) {
      try { out.push(JSON.parse(lines[i]) as ControlCommand); } catch { /* skip */ }
    }
    return out;
  } catch {
    return [];
  }
}
