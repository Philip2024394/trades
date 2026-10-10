// NEX Coding Chat · Session memory · per-session JSON store on disk
// Append-only for messages · session file replaced atomically on each update.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { ChatMessage, ChatSession } from "./types";

const REPO_ROOT = process.cwd();
const SESSIONS_DIR = path.join(REPO_ROOT, "data", "nex-coding-chat", "sessions");

function ensureDir(): void {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

function sessionPath(session_id: string): string {
  return path.join(SESSIONS_DIR, `${session_id}.json`);
}

export function newSessionId(): string {
  return `chat-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

export function newMessageId(): string {
  return `msg-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

export function createSession(session_id: string, title: string = "New chat"): ChatSession {
  ensureDir();
  const now = new Date().toISOString();
  const s: ChatSession = { session_id, created_at: now, last_ts: now, title, messages: [] };
  writeFileSync(sessionPath(session_id), JSON.stringify(s, null, 2), "utf8");
  return s;
}

export function loadSession(session_id: string): ChatSession | null {
  const p = sessionPath(session_id);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as ChatSession;
}

/** Save a session atomically (write to temp, rename). Prevents partial reads on concurrent poll. */
export function saveSession(s: ChatSession): void {
  ensureDir();
  const final = sessionPath(s.session_id);
  const tmp = final + ".tmp";
  writeFileSync(tmp, JSON.stringify(s, null, 2), "utf8");
  // Node's renameSync is atomic on same filesystem.
  const fs = require("node:fs") as typeof import("node:fs");
  fs.renameSync(tmp, final);
}

export function appendMessage(session_id: string, msg: ChatMessage): ChatSession {
  const s = loadSession(session_id);
  if (!s) throw new Error(`session missing: ${session_id}`);
  const next: ChatSession = {
    ...s,
    last_ts: msg.ts,
    title: s.title === "New chat" && msg.role === "user" ? deriveTitle(msg.content) : s.title,
    messages: [...s.messages, msg],
  };
  saveSession(next);
  return next;
}

export function updateMessageStatus(
  session_id: string,
  message_id: string,
  status: ChatMessage["status"],
  patch: Partial<Pick<ChatMessage, "content" | "error">> = {},
): ChatSession {
  const s = loadSession(session_id);
  if (!s) throw new Error(`session missing: ${session_id}`);
  const next: ChatSession = {
    ...s,
    messages: s.messages.map((m) =>
      m.id === message_id ? { ...m, status, ...patch } : m,
    ),
  };
  saveSession(next);
  return next;
}

export function listSessions(limit: number = 50): readonly { session_id: string; title: string; last_ts: string }[] {
  ensureDir();
  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"));
  const rows = files.map((f) => {
    const abs = path.join(SESSIONS_DIR, f);
    const stat = statSync(abs);
    try {
      const s = JSON.parse(readFileSync(abs, "utf8")) as ChatSession;
      return {
        session_id: s.session_id,
        title: s.title,
        last_ts: s.last_ts,
        _mtime: stat.mtimeMs,
      };
    } catch {
      return null;
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  rows.sort((a, b) => b._mtime - a._mtime);
  return rows.slice(0, limit).map(({ _mtime, ...r }) => r);
}

function deriveTitle(userContent: string): string {
  const oneLine = userContent.replace(/\s+/g, " ").trim();
  return oneLine.length <= 60 ? oneLine : oneLine.slice(0, 57) + "…";
}
