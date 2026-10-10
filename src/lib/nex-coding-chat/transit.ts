// NEX Coding Chat · file-based transit protocol
// Every user message is written to `transit/inbox/<message_id>.json` so any
// external engine (NEX1 runtime, NEX-Twin, Python watchdog, Node fs.watch, C#
// FileSystemWatcher) can process it — no HTTP dependency required.
//
// Engines respond by writing `transit/outbox/<message_id>.json`. The Next.js
// poll endpoint checks the outbox and moves the message to `answered` when the
// response arrives.
//
// This is the SAME source of truth the HTTP API and any local engine share.

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import * as path from "node:path";
import type { InboxPayload, OutboxPayload } from "./types";

const REPO_ROOT = process.cwd();
const INBOX_DIR = path.join(REPO_ROOT, "data", "nex-coding-chat", "transit", "inbox");
const OUTBOX_DIR = path.join(REPO_ROOT, "data", "nex-coding-chat", "transit", "outbox");

function ensureDirs(): void {
  if (!existsSync(INBOX_DIR)) mkdirSync(INBOX_DIR, { recursive: true });
  if (!existsSync(OUTBOX_DIR)) mkdirSync(OUTBOX_DIR, { recursive: true });
}

export function inboxPath(message_id: string): string {
  return path.join(INBOX_DIR, `${message_id}.json`);
}

export function outboxPath(message_id: string): string {
  return path.join(OUTBOX_DIR, `${message_id}.json`);
}

/** Write an inbox payload atomically (temp + rename). */
export function writeInbox(p: InboxPayload): void {
  ensureDirs();
  const final = inboxPath(p.message_id);
  const tmp = final + ".tmp";
  writeFileSync(tmp, JSON.stringify(p, null, 2), "utf8");
  const fs = require("node:fs") as typeof import("node:fs");
  fs.renameSync(tmp, final);
}

/** Read outbox response if present. Returns null while the engine hasn't answered yet. */
export function readOutboxIfReady(message_id: string): OutboxPayload | null {
  const p = outboxPath(message_id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as OutboxPayload;
  } catch {
    return null;
  }
}

/** Remove the inbox + outbox files after a response has been consumed. Keeps transit tidy. */
export function cleanup(message_id: string): void {
  for (const p of [inboxPath(message_id), outboxPath(message_id)]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      /* best-effort */
    }
  }
}

/** Emit a stub outbox response — used when no external engine is running so the UI
 * still gets an honest reply instead of timing out. This is NOT a real answer;
 * it's a truthful placeholder telling the user what happened. */
export function writeStubOutbox(message_id: string, session_id: string, reason: string): void {
  ensureDirs();
  const p: OutboxPayload = {
    protocol_version: 1,
    message_id,
    session_id,
    ts: new Date().toISOString(),
    executor: "STUB",
    reply: [
      "⚠️ **No external engine is currently attached to the transit inbox.**",
      "",
      `Your message was written to \`data/nex-coding-chat/transit/inbox/${message_id}.json\` for any watching engine`,
      `(NEX1 runtime · NEX-Twin · Python watchdog · Node fs.watch · C# FileSystemWatcher).`,
      "",
      "Attach an engine using one of the watcher examples in `scripts/nex-coding-chat/`,",
      "or dispatch this as a coding-team run via `/dispatch <your prompt>`.",
      "",
      `**Reason:** ${reason}`,
    ].join("\n"),
    evidence: [`data/nex-coding-chat/transit/inbox/${message_id}.json`],
  };
  writeFileSync(outboxPath(message_id), JSON.stringify(p, null, 2), "utf8");
}
