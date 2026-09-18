// src/lib/nex-agent/code-engine/capability-conversation-context.ts
//
// NEX1 · UNIFIED CONVERSATION STATE · deterministic · zero LLM.
// Founder-authorised 2026-09-17 · World-Class Conversation Intelligence Mission.
//
// One coherent state module (not five separate patches) so composite
// interactions work · bindings + threads + findings + mutations +
// verifications + decisions all live on the same ConversationHead object.
//
// The intelligence flow reads a single state; the response composer reads
// the same state; the chat-turn orchestrator writes to the same state.

import * as fs from "node:fs";
import * as path from "node:path";
import type { ConversationTurnContext } from "./capability-response-composer";
// C10 Phase 4b · snapshot-per-conversation durable persistence.
import { saveHead as persistHead, loadAllHeads as persistLoadAll } from "./capability-conversation-persistence";

// ── Bindings ─────────────────────────────────────────────────────────────

export type BindingKind =
  | "entity"          // named UI component / module / project / feature
  | "phrase"          // "the zero case", "the fallback path"
  | "code_identifier" // computeAnswer, safeQty, PricingCard
  | "file"            // src/lib/foo.ts
  | "concept";        // "the previous decision", "the frame"

/** A single introduced binding · one name → one reference. */
export interface Binding {
  readonly name: string;            // verbatim as introduced (case-preserved for display)
  readonly canonical: string;       // lowercase for O(1) match
  readonly kind: BindingKind;
  readonly reference: string | null; // resolved target where applicable
  readonly introduced_turn: number;
  readonly thread_id: string;
}

// ── Threads ─────────────────────────────────────────────────────────────

export interface Thread {
  readonly thread_id: string;
  readonly opened_turn: number;
  readonly closed_turn: number | null;
  goal: string | null;               // "pricing utility issue"
  target: string | null;             // primary file for this thread
  verb: string | null;
  entity_binding_names: string[];    // names introduced in THIS thread (subset of state.bindings)
  decisions: Decision[];
  findings: FindingsRecord[];
  mutations: MutationRecord[];
  verifications: VerificationRecord[];
  parent_thread_id: string | null;
}

export interface Decision {
  readonly turn: number;
  readonly text: string;
  readonly evidence: readonly string[];
}

export interface FindingsRecord {
  readonly turn: number;
  readonly candidate_targets: readonly string[];
  readonly verdict: string;
  readonly rationale: string | null;
}

export interface MutationRecord {
  readonly turn: number;
  readonly target_file: string;
  readonly target_function: string | null;
  readonly current_literal: string;
  readonly proposed_literal: string;
  readonly line: number | null;
}

export interface VerificationRecord {
  readonly turn: number;
  readonly ok: boolean;
  readonly test_exit_code: number | null;
  readonly preservation_kind: "preserved" | "regressed" | "no_sibling" | null;
  readonly notes: string | null;
}

// ── Head (unified state) ─────────────────────────────────────────────────

export interface ConversationHead {
  readonly conversation_id: string;
  turn_id: number;
  active_thread_id: string | null;
  threads: Thread[];
  bindings: Binding[];
  active_target: string | null;      // convenience mirror of active thread's target
  active_task_verb: string | null;   // convenience mirror
  pending_clarification: string | null;
  last_verified_result: string | null;
  last_updated: string;
  // ── C10 Phase 1 · Typed knowledge-graph nodes (2026-09-17) ──────────
  // Cross-thread durable state that doesn't fit inside a single Thread.
  // All four arrays are append-only in normal use · corrections/questions
  // get a `resolved` flag rather than being deleted, so the trace is intact.
  preferences: FounderPreference[];        // durable prefs across all threads
  refused_prompts: RefusedPrompt[];        // history of refusals with reason
  unresolved_questions: UnresolvedQuestion[]; // NEX1 asked · founder hasn't answered
  corrections: Correction[];               // "no, do X instead of Y" · founder-voice
}

// ── C10 typed node records (all readonly · append-only semantics) ─────

export interface FounderPreference {
  readonly id: string;                   // stable id · sha1(text)
  readonly text: string;                 // the preference statement, verbatim
  readonly captured_turn: number;
  readonly captured_at: string;
  readonly kind: "explicit" | "inferred"; // how it entered the graph
  readonly derived_from_thread_id: string | null;
}

export interface RefusedPrompt {
  readonly turn: number;
  readonly at: string;
  readonly prompt: string;               // trimmed to 240 chars for storage
  readonly reason: string;               // "refused_no_verb_recognised" | "unsafe" | etc.
  readonly detail: string | null;
}

export interface UnresolvedQuestion {
  readonly id: string;                   // stable id
  readonly asked_turn: number;
  readonly asked_at: string;
  readonly question: string;
  readonly asked_by: "nex1" | "system";
  resolved: boolean;                     // mutable · flipped when answered
  resolved_turn: number | null;
  resolved_answer: string | null;
  readonly thread_id: string | null;
}

export interface Correction {
  readonly turn: number;
  readonly at: string;
  readonly kind: "intent" | "target" | "value" | "wording" | "other";
  readonly from_value: string;
  readonly to_value: string;
  readonly context: string | null;       // free-form note · what was being discussed
  readonly thread_id: string | null;
}

// ── Turn store ───────────────────────────────────────────────────────────

export interface Nex1ChatTurn {
  readonly conversation_id: string;
  readonly turn_id: number;
  readonly timestamp: string;
  readonly sender: "user" | "nex1";
  readonly text: string;
  readonly state?: string;
  readonly trace?: readonly string[];
}

// ── In-memory store · Batch 1 Final Closure 2026-09-17 ─────────────────
//
// Pinned to `globalThis` so BOTH `/api/nex-chat/gateway` and
// `/api/nex1/chat/turn` share ONE ConversationHead per Node process even
// under Turbopack dev-mode route-level module isolation (where each route
// otherwise loads its own copy of this module and gets its own Map).
//
// In production Next.js bundles consolidate imports and this globalThis
// pin is a no-op. In dev it is load-bearing for cross-interface state.

interface Nex1ConversationStore {
  heads: Map<string, ConversationHead>;
  turns: Map<string, Nex1ChatTurn[]>;
}

const STORE_KEY = "__NEX1_CONVERSATION_STORE__";
type GT = typeof globalThis & { [STORE_KEY]?: Nex1ConversationStore };

function getStore(): Nex1ConversationStore {
  const g = globalThis as GT;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { heads: new Map(), turns: new Map() };
  }
  return g[STORE_KEY]!;
}

const HEADS: Map<string, ConversationHead> = getStore().heads;
const TURNS: Map<string, Nex1ChatTurn[]> = getStore().turns;
const MAX_TURNS_PER_CONVO = 400;
const MAX_BINDINGS_PER_CONVO = 200;

// C10 Phase 4b · hydrate from disk once per process lifetime. Guarded so
// repeated module re-imports (Turbopack dev-mode) do not re-hydrate over
// live state on the shared globalThis map.
// C10 Phase 4c · also hydrates turn transcripts from the JSONL log.
type GTFlag = typeof globalThis & { __NEX1_CONVERSATION_HYDRATED__?: boolean };
(function hydrateOnceFromDisk() {
  const g = globalThis as GTFlag;
  if (g.__NEX1_CONVERSATION_HYDRATED__) return;
  try {
    const { heads } = persistLoadAll();
    for (const h of heads) {
      if (!HEADS.has(h.conversation_id)) HEADS.set(h.conversation_id, h);
    }
  } catch { /* silent · persistence-optional */ }
  // Turn transcripts · scan data/nex1-chat-conversations/*.jsonl → TURNS map.
  try {
    const dir = path.join(process.cwd(), "data", "nex1-chat-conversations");
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
      for (const f of files) {
        const convId = f.slice(0, -".jsonl".length);
        if (!/^[A-Za-z0-9_-]+$/.test(convId)) continue;
        if (TURNS.has(convId)) continue; // already in memory
        const raw = fs.readFileSync(path.join(dir, f), "utf8");
        const arr: Nex1ChatTurn[] = [];
        for (const line of raw.split("\n")) {
          if (!line.trim()) continue;
          try {
            const t = JSON.parse(line) as Nex1ChatTurn;
            if (t && typeof t.turn_id === "number") arr.push(t);
          } catch { /* skip malformed */ }
        }
        if (arr.length > MAX_TURNS_PER_CONVO) arr.splice(0, arr.length - MAX_TURNS_PER_CONVO);
        if (arr.length > 0) TURNS.set(convId, arr);
      }
    }
  } catch { /* silent · persistence-optional */ }
  const g2 = globalThis as GTFlag;
  g2.__NEX1_CONVERSATION_HYDRATED__ = true;
})();

/** Persist a head after any mutation. Fire-and-forget · logs on failure. */
export function saveConversationHead(head: ConversationHead): void {
  try {
    head.last_updated = new Date().toISOString();
    persistHead(head);
  } catch { /* silent · never break the caller */ }
}

// ── Pronoun resolver (kept for backwards compatibility) ─────────────────

const PRONOUN_RE = /\b(it|that|this|the file|the same|same|previous|last one|the previous one)\b/i;

export function resolvePronounToActiveTarget(
  message: string,
  head: ConversationHead,
): string | null {
  if (!head.active_target) return null;
  if (!PRONOUN_RE.test(message)) return null;
  const filePathRe = /[\w/.\-@]+\.[jt]sx?/;
  if (filePathRe.test(message)) return null;
  return head.active_target;
}

// ── Head accessors ──────────────────────────────────────────────────────

function makeThreadId(head: ConversationHead): string {
  return `t${head.threads.length + 1}-${Date.now().toString(36).slice(-4)}`;
}

export function getConversationHead(conversation_id: string): ConversationHead {
  const existing = HEADS.get(conversation_id);
  if (existing) {
    // C10 · guarantee the new arrays exist on heads created before this batch.
    // Defensive · older singleton state persists across turbopack hot-reloads.
    if (!Array.isArray(existing.preferences)) existing.preferences = [];
    if (!Array.isArray(existing.refused_prompts)) existing.refused_prompts = [];
    if (!Array.isArray(existing.unresolved_questions)) existing.unresolved_questions = [];
    if (!Array.isArray(existing.corrections)) existing.corrections = [];
    return existing;
  }
  const now = new Date().toISOString();
  const fresh: ConversationHead = {
    conversation_id,
    turn_id: 0,
    active_thread_id: null,
    threads: [],
    bindings: [],
    active_target: null,
    active_task_verb: null,
    pending_clarification: null,
    last_verified_result: null,
    last_updated: now,
    preferences: [],
    refused_prompts: [],
    unresolved_questions: [],
    corrections: [],
  };
  HEADS.set(conversation_id, fresh);
  // Persist fresh head immediately so downstream mutations only need to
  // re-save · the file exists from the first getConversationHead call.
  saveConversationHead(fresh);
  return fresh;
}

export function getConversationTurns(conversation_id: string): readonly Nex1ChatTurn[] {
  return TURNS.get(conversation_id) ?? [];
}

/** Open a new thread when a new goal/target appears, or when the user
 *  explicitly switches topic. Returns the thread ID. */
export function openThread(
  head: ConversationHead,
  input: { goal?: string | null; target?: string | null; verb?: string | null; parent?: string | null; opened_turn: number },
): Thread {
  const id = makeThreadId(head);
  const t: Thread = {
    thread_id: id,
    opened_turn: input.opened_turn,
    closed_turn: null,
    goal: input.goal ?? null,
    target: input.target ?? null,
    verb: input.verb ?? null,
    entity_binding_names: [],
    decisions: [],
    findings: [],
    mutations: [],
    verifications: [],
    parent_thread_id: input.parent ?? head.active_thread_id ?? null,
  };
  head.threads.push(t);
  head.active_thread_id = id;
  head.active_target = t.target;
  head.active_task_verb = t.verb;
  head.last_updated = new Date().toISOString();
  return t;
}

/** Set the active thread by ID (used on "go back to X" resolution). */
export function activateThread(head: ConversationHead, thread_id: string): boolean {
  const t = head.threads.find((x) => x.thread_id === thread_id);
  if (!t) return false;
  head.active_thread_id = thread_id;
  head.active_target = t.target;
  head.active_task_verb = t.verb;
  head.last_updated = new Date().toISOString();
  return true;
}

/** Return the currently-active thread record (creates a default if none). */
export function getActiveThread(head: ConversationHead): Thread {
  if (head.active_thread_id) {
    const found = head.threads.find((t) => t.thread_id === head.active_thread_id);
    if (found) return found;
  }
  return openThread(head, { opened_turn: head.turn_id });
}

// ── Binding operations ──────────────────────────────────────────────────

/** Insert a new binding on the active thread. Returns the created binding.
 *  If a same-canonical entry already exists, updates rather than duplicates. */
export function addBinding(
  head: ConversationHead,
  input: { name: string; kind: BindingKind; reference?: string | null; turn: number },
): Binding {
  const canonical = input.name.trim().toLowerCase();
  const thread = getActiveThread(head);
  const existingIdx = head.bindings.findIndex((b) => b.canonical === canonical);
  const b: Binding = {
    name: input.name.trim(),
    canonical,
    kind: input.kind,
    reference: input.reference ?? null,
    introduced_turn: input.turn,
    thread_id: thread.thread_id,
  };
  if (existingIdx >= 0) {
    head.bindings[existingIdx] = b;
  } else {
    head.bindings.push(b);
    if (head.bindings.length > MAX_BINDINGS_PER_CONVO) {
      head.bindings.shift();
    }
  }
  // Track membership in thread's entity list (for "go back to X" resolution)
  if (input.kind === "entity" && !thread.entity_binding_names.includes(b.name)) {
    thread.entity_binding_names.push(b.name);
  }
  head.last_updated = new Date().toISOString();
  return b;
}

/** Look up a binding by verbatim name or canonical form. */
export function findBinding(head: ConversationHead, name: string): Binding | null {
  const canonical = name.trim().toLowerCase();
  return head.bindings.find((b) => b.canonical === canonical) ?? null;
}

/** Scan a message for any binding-name mentions. Returns the matched
 *  bindings, ordered by name length descending so longer names win over
 *  shorter overlaps ("CustomerPanel" beats "Panel" if both exist). */
export function scanMessageForBindingMentions(
  head: ConversationHead,
  message: string,
): Binding[] {
  const lc = message.toLowerCase();
  const matches: Binding[] = [];
  const seen = new Set<string>();
  const sortedByLenDesc = [...head.bindings].sort((a, b) => b.canonical.length - a.canonical.length);
  for (const b of sortedByLenDesc) {
    if (seen.has(b.canonical)) continue;
    // Word-boundary-ish check to avoid false positives on partial substrings
    const escaped = b.canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, "i");
    if (re.test(lc)) {
      matches.push(b);
      seen.add(b.canonical);
    }
  }
  return matches;
}

// ── Record events on the active thread ─────────────────────────────────

export function recordFindings(head: ConversationHead, r: FindingsRecord): void {
  getActiveThread(head).findings.push(r);
  head.last_updated = new Date().toISOString();
}

export function recordMutation(head: ConversationHead, r: MutationRecord): void {
  getActiveThread(head).mutations.push(r);
  head.last_updated = new Date().toISOString();
}

export function recordVerification(head: ConversationHead, r: VerificationRecord): void {
  getActiveThread(head).verifications.push(r);
  head.last_updated = new Date().toISOString();
}

export function recordDecision(head: ConversationHead, d: Decision): void {
  getActiveThread(head).decisions.push(d);
  head.last_updated = new Date().toISOString();
}

// ── Legacy shim · keep prior callers working ────────────────────────────

export interface UpdateContextInput {
  readonly conversation_id: string;
  readonly active_target?: string | null;
  readonly active_task_verb?: string | null;
  readonly pending_clarification?: string | null;
  readonly last_verified_result?: string | null;
}

export function updateContextHead(input: UpdateContextInput): ConversationHead {
  const head = getConversationHead(input.conversation_id);
  // If the active_target changed to a new file, ensure there's a thread for it.
  if (input.active_target !== undefined && input.active_target !== null && input.active_target !== head.active_target) {
    const existingThread = head.threads.find((t) => t.target === input.active_target && t.closed_turn === null);
    if (existingThread) {
      head.active_thread_id = existingThread.thread_id;
      existingThread.verb = input.active_task_verb ?? existingThread.verb;
    } else {
      openThread(head, {
        target: input.active_target,
        verb: input.active_task_verb ?? head.active_task_verb,
        opened_turn: head.turn_id,
      });
    }
  }
  head.active_target = input.active_target === undefined ? head.active_target : input.active_target;
  head.active_task_verb = input.active_task_verb === undefined ? head.active_task_verb : input.active_task_verb;
  head.pending_clarification =
    input.pending_clarification === undefined ? head.pending_clarification : input.pending_clarification;
  head.last_verified_result =
    input.last_verified_result === undefined ? head.last_verified_result : input.last_verified_result;
  head.last_updated = new Date().toISOString();
  // C10 Phase 4b · persist after every context-head mutation.
  saveConversationHead(head);
  return head;
}

export function appendTurn(turn: Omit<Nex1ChatTurn, "turn_id" | "timestamp">, opts: {
  readonly repo_root?: string;
} = {}): Nex1ChatTurn {
  const head = getConversationHead(turn.conversation_id);
  const turn_id = head.turn_id + 1;
  const full: Nex1ChatTurn = {
    ...turn,
    turn_id,
    timestamp: new Date().toISOString(),
  };
  const arr = TURNS.get(turn.conversation_id) ?? [];
  arr.push(full);
  if (arr.length > MAX_TURNS_PER_CONVO) arr.splice(0, arr.length - MAX_TURNS_PER_CONVO);
  TURNS.set(turn.conversation_id, arr);
  head.turn_id = turn_id;
  head.last_updated = new Date().toISOString();

  // C10 Phase 4c · turn transcripts always persist to the JSONL log · same
  // path prior callers used opt-in via `repo_root`. Default falls through to
  // process.cwd() so every caller benefits without needing to thread the arg.
  try {
    const root = opts.repo_root ?? process.cwd();
    const dir = path.join(root, "data", "nex1-chat-conversations");
    fs.mkdirSync(dir, { recursive: true });
    // Guard conversation_id against path traversal · same regex as heads store.
    if (/^[A-Za-z0-9_-]+$/.test(turn.conversation_id)) {
      const file = path.join(dir, `${turn.conversation_id}.jsonl`);
      fs.appendFileSync(file, JSON.stringify(full) + "\n", "utf8");
    }
  } catch {
    // Non-fatal · in-memory state is still correct for this session.
  }
  return full;
}

export function toTurnContext(head: ConversationHead): ConversationTurnContext {
  return {
    conversation_id: head.conversation_id,
    turn_id: head.turn_id,
    active_target: head.active_target,
    active_task_verb: head.active_task_verb,
    pending_clarification: head.pending_clarification,
    last_verified_result: head.last_verified_result,
  };
}

export function _resetAllConversations_TESTONLY(): void {
  HEADS.clear();
  TURNS.clear();
}



