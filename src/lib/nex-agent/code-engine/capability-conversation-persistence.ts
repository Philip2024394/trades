// src/lib/nex-agent/code-engine/capability-conversation-persistence.ts
//
// NEX1 · C10 Phase 4b · Conversation-head durable snapshot layer.
// Same Fix 17 discipline as the paraphrase-persistence module, but different
// shape: heads are nested state so we snapshot the WHOLE head per mutation
// (one JSON per conversation_id) instead of appending mutation events.
//
// Store layout:
//   data/nex1-conversation-heads/index.json     · list of known conversation_ids
//   data/nex1-conversation-heads/{conv_id}.json · one full ConversationHead
//
// Safety invariants:
//   · Never overwrites unrelated conversation files
//   · Writes are atomic-in-effect via write-to-temp + rename (best-effort · OS-fsync-follows)
//   · Missing / corrupt files at hydrate time → soft-skip · never crash
//   · Zero LLM · zero network · zero external process

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import type { ConversationHead } from "./capability-conversation-context";

const REPO_ROOT = process.cwd();
const STORE_DIR = path.join(REPO_ROOT, "data", "nex1-conversation-heads");

/** Regex guard · conversation IDs may only contain [a-zA-Z0-9_-] so a rogue
 *  input can never escape the store directory or write to a system file. */
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    try { mkdirSync(STORE_DIR, { recursive: true }); } catch { /* ignore · rare */ }
  }
}

function headFile(convId: string): string {
  return path.join(STORE_DIR, `${convId}.json`);
}

/** Persist ONE head to disk. Best-effort · returns { ok, error? }. */
export function saveHead(head: ConversationHead): { ok: boolean; error?: string } {
  if (!SAFE_ID_RE.test(head.conversation_id)) {
    return { ok: false, error: "unsafe_conversation_id" };
  }
  try {
    ensureDir();
    const target = headFile(head.conversation_id);
    const tmp = target + ".tmp";
    writeFileSync(tmp, JSON.stringify(head, null, 2), { encoding: "utf8" });
    renameSync(tmp, target);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 200) };
  }
}

/** Read one head back · returns null if file missing / corrupt. */
export function loadHead(convId: string): ConversationHead | null {
  if (!SAFE_ID_RE.test(convId)) return null;
  try {
    const f = headFile(convId);
    if (!existsSync(f)) return null;
    const raw = readFileSync(f, "utf8");
    const parsed = JSON.parse(raw) as ConversationHead;
    if (parsed && typeof parsed.conversation_id === "string" && parsed.conversation_id === convId) {
      // Defensive · guarantee array fields exist on any historical snapshot.
      if (!Array.isArray(parsed.preferences)) parsed.preferences = [];
      if (!Array.isArray(parsed.refused_prompts)) parsed.refused_prompts = [];
      if (!Array.isArray(parsed.unresolved_questions)) parsed.unresolved_questions = [];
      if (!Array.isArray(parsed.corrections)) parsed.corrections = [];
      if (!Array.isArray(parsed.threads)) parsed.threads = [];
      if (!Array.isArray(parsed.bindings)) parsed.bindings = [];
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** List every head on disk. Used by bootstrap to hydrate the in-memory store. */
export function loadAllHeads(): { heads: ConversationHead[]; skipped: number } {
  if (!existsSync(STORE_DIR)) return { heads: [], skipped: 0 };
  const heads: ConversationHead[] = [];
  let skipped = 0;
  try {
    const files = readdirSync(STORE_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".tmp.json") && !f.endsWith(".tmp"));
    for (const f of files) {
      const convId = f.slice(0, -".json".length);
      const h = loadHead(convId);
      if (h) heads.push(h); else skipped++;
    }
  } catch { /* directory read failure · silent · leave heads empty */ }
  return { heads, skipped };
}

/** Diagnostic surface · exposed via /api/nex1/conversation-graph snapshot. */
export function getStoreDir(): string { return STORE_DIR; }
