// src/lib/nex-agent/code-engine/capability-conversation-graph.ts
//
// NEX1 · C10 Phase 1 · Conversation Knowledge Graph · 2026-09-17.
// Founder-authorised via frontier §17 queue after C7 Phase 2.
//
// PURPOSE
//   ConversationHead now carries 4 typed node collections beyond bindings +
//   threads (preferences · refused_prompts · unresolved_questions ·
//   corrections). This module provides:
//     · deterministic mutator functions that append to those collections,
//     · a normalised "graph snapshot" query that exposes ALL nodes + edges
//       as a single object · easy for consumers to reason about,
//     · a reference resolver upgrade that walks the graph (bindings + threads
//       + preferences + active target) instead of only the active target.
//
// PHASE 1 SCOPE (this batch)
//   · Types + mutators + snapshot + graph-aware reference resolver.
//   · Zero wiring into chat-turn / orchestrator · that is Phase 2.
//   · Diagnostic probe endpoint (separate file) validates the surface.
//
// SAFETY
//   Zero LLM · deterministic · every mutation is small and audit-logged in
//   the returned mutation receipt. The graph is per-conversation.

import { createHash } from "node:crypto";
import {
  getConversationHead,
  saveConversationHead,
  type ConversationHead,
  type FounderPreference,
  type RefusedPrompt,
  type UnresolvedQuestion,
  type Correction,
  type Binding,
} from "./capability-conversation-context";

// ── Config ──────────────────────────────────────────────────────────────

const CFG = Object.freeze({
  MAX_PREFERENCES: 200,
  MAX_REFUSED_HISTORY: 200,
  MAX_UNRESOLVED: 100,
  MAX_CORRECTIONS: 500,
  MAX_TEXT_LEN: 240,
} as const);

// ── ID helpers ─────────────────────────────────────────────────────────

function sha1short(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function clip(s: string): string {
  return s.length > CFG.MAX_TEXT_LEN ? s.slice(0, CFG.MAX_TEXT_LEN - 1) + "…" : s;
}

// ── Mutators · deterministic append (with de-dup where sensible) ────────

export interface AddPreferenceInput {
  readonly conversation_id: string;
  readonly text: string;
  readonly kind: "explicit" | "inferred";
  readonly turn: number;
  readonly derived_from_thread_id?: string | null;
}
export interface AddPreferenceResult {
  readonly ok: true;
  readonly preference: FounderPreference;
  readonly deduplicated: boolean;
}

export function addPreference(input: AddPreferenceInput): AddPreferenceResult {
  const head = getConversationHead(input.conversation_id);
  const text = clip(input.text.trim());
  if (!text) throw new Error("preference_empty");
  const id = sha1short(text.toLowerCase());
  const existing = head.preferences.find((p) => p.id === id);
  if (existing) {
    return { ok: true, preference: existing, deduplicated: true };
  }
  const pref: FounderPreference = {
    id,
    text,
    captured_turn: input.turn,
    captured_at: new Date().toISOString(),
    kind: input.kind,
    derived_from_thread_id: input.derived_from_thread_id ?? null,
  };
  head.preferences.push(pref);
  // Bound size · drop oldest first.
  while (head.preferences.length > CFG.MAX_PREFERENCES) head.preferences.shift();
  head.last_updated = new Date().toISOString();
  saveConversationHead(head);
  return { ok: true, preference: pref, deduplicated: false };
}

export interface AddRefusedPromptInput {
  readonly conversation_id: string;
  readonly turn: number;
  readonly prompt: string;
  readonly reason: string;
  readonly detail?: string | null;
}

export function addRefusedPrompt(input: AddRefusedPromptInput): RefusedPrompt {
  const head = getConversationHead(input.conversation_id);
  const rec: RefusedPrompt = {
    turn: input.turn,
    at: new Date().toISOString(),
    prompt: clip(input.prompt),
    reason: input.reason,
    detail: input.detail ?? null,
  };
  head.refused_prompts.push(rec);
  while (head.refused_prompts.length > CFG.MAX_REFUSED_HISTORY) head.refused_prompts.shift();
  head.last_updated = new Date().toISOString();
  saveConversationHead(head);
  return rec;
}

export interface AddUnresolvedQuestionInput {
  readonly conversation_id: string;
  readonly turn: number;
  readonly question: string;
  readonly asked_by?: "nex1" | "system";
  readonly thread_id?: string | null;
}

export function addUnresolvedQuestion(input: AddUnresolvedQuestionInput): UnresolvedQuestion {
  const head = getConversationHead(input.conversation_id);
  const q: UnresolvedQuestion = {
    id: sha1short(input.question + ":" + input.turn),
    asked_turn: input.turn,
    asked_at: new Date().toISOString(),
    question: clip(input.question),
    asked_by: input.asked_by ?? "nex1",
    resolved: false,
    resolved_turn: null,
    resolved_answer: null,
    thread_id: input.thread_id ?? null,
  };
  head.unresolved_questions.push(q);
  while (head.unresolved_questions.length > CFG.MAX_UNRESOLVED) head.unresolved_questions.shift();
  head.last_updated = new Date().toISOString();
  saveConversationHead(head);
  return q;
}

export interface ResolveQuestionInput {
  readonly conversation_id: string;
  readonly question_id: string;
  readonly turn: number;
  readonly answer: string;
}
export interface ResolveQuestionResult {
  readonly ok: boolean;
  readonly resolved: UnresolvedQuestion | null;
}

export function resolveQuestion(input: ResolveQuestionInput): ResolveQuestionResult {
  const head = getConversationHead(input.conversation_id);
  const q = head.unresolved_questions.find((u) => u.id === input.question_id && !u.resolved);
  if (!q) return { ok: false, resolved: null };
  q.resolved = true;
  q.resolved_turn = input.turn;
  q.resolved_answer = clip(input.answer);
  head.last_updated = new Date().toISOString();
  saveConversationHead(head);
  return { ok: true, resolved: q };
}

export interface AddCorrectionInput {
  readonly conversation_id: string;
  readonly turn: number;
  readonly kind: Correction["kind"];
  readonly from_value: string;
  readonly to_value: string;
  readonly context?: string | null;
  readonly thread_id?: string | null;
}

export function addCorrection(input: AddCorrectionInput): Correction {
  const head = getConversationHead(input.conversation_id);
  const rec: Correction = {
    turn: input.turn,
    at: new Date().toISOString(),
    kind: input.kind,
    from_value: clip(input.from_value),
    to_value: clip(input.to_value),
    context: input.context ? clip(input.context) : null,
    thread_id: input.thread_id ?? null,
  };
  head.corrections.push(rec);
  while (head.corrections.length > CFG.MAX_CORRECTIONS) head.corrections.shift();
  head.last_updated = new Date().toISOString();
  saveConversationHead(head);
  return rec;
}

// ── Query API · graph snapshot + typed selectors ────────────────────────

export interface GraphSnapshot {
  readonly conversation_id: string;
  readonly turn_id: number;
  readonly active_target: string | null;
  readonly active_thread_id: string | null;
  readonly counts: {
    readonly bindings: number;
    readonly threads: number;
    readonly preferences: number;
    readonly refused_prompts: number;
    readonly unresolved_questions: number;
    readonly resolved_questions: number;
    readonly corrections: number;
    readonly decisions: number;
    readonly mutations: number;
  };
  readonly preferences: readonly FounderPreference[];
  readonly refused_prompts: readonly RefusedPrompt[];
  readonly unresolved_questions: readonly UnresolvedQuestion[];   // still open
  readonly resolved_questions: readonly UnresolvedQuestion[];     // answered
  readonly corrections: readonly Correction[];
  readonly bindings: readonly Binding[];
}

export function getGraphSnapshot(conversation_id: string): GraphSnapshot {
  const head = getConversationHead(conversation_id);
  let decisions = 0;
  let mutations = 0;
  for (const t of head.threads) {
    decisions += t.decisions.length;
    mutations += t.mutations.length;
  }
  const unresolved = head.unresolved_questions.filter((q) => !q.resolved);
  const resolved = head.unresolved_questions.filter((q) => q.resolved);
  return {
    conversation_id: head.conversation_id,
    turn_id: head.turn_id,
    active_target: head.active_target,
    active_thread_id: head.active_thread_id,
    counts: {
      bindings: head.bindings.length,
      threads: head.threads.length,
      preferences: head.preferences.length,
      refused_prompts: head.refused_prompts.length,
      unresolved_questions: unresolved.length,
      resolved_questions: resolved.length,
      corrections: head.corrections.length,
      decisions,
      mutations,
    },
    preferences: head.preferences,
    refused_prompts: head.refused_prompts,
    unresolved_questions: unresolved,
    resolved_questions: resolved,
    corrections: head.corrections,
    bindings: head.bindings,
  };
}

// ── Graph-aware reference resolver ──────────────────────────────────────

export interface ReferenceHit {
  readonly source: "binding" | "active_target" | "thread_target" | "recent_mutation" | "recent_finding";
  readonly value: string;
  readonly binding_name?: string;
  readonly thread_id?: string;
  readonly confidence: number;   // [0, 1] deterministic tier
  readonly why: string;
}

const PRONOUN_TIERS: ReadonlyArray<{ re: RegExp; hint: "generic" | "file" | "identifier" }> = [
  { re: /\b(the file|that file|this file|the same file)\b/i, hint: "file" },
  { re: /\b(the function|that function|this function|the method)\b/i, hint: "identifier" },
  { re: /\b(it|that|this|the same|same|previous|last one|the previous one|the last)\b/i, hint: "generic" },
];

/**
 * Deterministic reference resolver. Walks bindings first, then thread target,
 * then active target, then recent mutations. Returns ranked candidates.
 * Returns [] if the message contains no pronoun/reference form.
 */
export function resolveReference(conversation_id: string, message: string): ReferenceHit[] {
  const head = getConversationHead(conversation_id);
  const hints: Array<"generic" | "file" | "identifier"> = [];
  for (const tier of PRONOUN_TIERS) {
    if (tier.re.test(message)) hints.push(tier.hint);
  }
  if (hints.length === 0) return [];

  const hits: ReferenceHit[] = [];

  // Bindings · exact-name match against the message · higher confidence.
  for (const b of head.bindings) {
    if (b.reference && message.toLowerCase().includes(b.canonical)) {
      hits.push({
        source: "binding",
        value: b.reference,
        binding_name: b.name,
        thread_id: b.thread_id,
        confidence: 0.9,
        why: `binding "${b.name}" matches by name`,
      });
    }
  }

  // Active target · lowest-effort default.
  if (head.active_target) {
    const isFileHint = hints.includes("file");
    const conf = isFileHint ? 0.75 : 0.6;
    hits.push({
      source: "active_target",
      value: head.active_target,
      thread_id: head.active_thread_id ?? undefined,
      confidence: conf,
      why: `active target${isFileHint ? " · file hint" : ""}`,
    });
  }

  // Most recent thread target (fallback if active_target null).
  if (!head.active_target && head.threads.length > 0) {
    const t = head.threads[head.threads.length - 1];
    if (t.target) {
      hits.push({
        source: "thread_target",
        value: t.target,
        thread_id: t.thread_id,
        confidence: 0.55,
        why: `most recent thread target · thread=${t.thread_id}`,
      });
    }
  }

  // Recent mutations · target file of the most recent write.
  for (let i = head.threads.length - 1; i >= 0 && hits.length < 6; i--) {
    const t = head.threads[i];
    for (let j = t.mutations.length - 1; j >= 0 && hits.length < 6; j--) {
      const m = t.mutations[j];
      const path = typeof (m as { path?: unknown }).path === "string" ? String((m as { path: string }).path) : null;
      if (path) {
        hits.push({
          source: "recent_mutation",
          value: path,
          thread_id: t.thread_id,
          confidence: 0.5,
          why: `most recent mutation in thread ${t.thread_id}`,
        });
        break; // one mutation ref is enough
      }
    }
  }

  // Deduplicate by value · keep the highest-confidence hit for each value.
  const byValue = new Map<string, ReferenceHit>();
  for (const h of hits) {
    const existing = byValue.get(h.value);
    if (!existing || h.confidence > existing.confidence) byValue.set(h.value, h);
  }
  return Array.from(byValue.values()).sort((a, b) => b.confidence - a.confidence);
}

// ── Convenience selectors ──────────────────────────────────────────────

export function getPreferences(conversation_id: string): readonly FounderPreference[] {
  return getConversationHead(conversation_id).preferences;
}
export function getUnresolvedQuestions(conversation_id: string): readonly UnresolvedQuestion[] {
  return getConversationHead(conversation_id).unresolved_questions.filter((q) => !q.resolved);
}
export function getRefusedPrompts(conversation_id: string): readonly RefusedPrompt[] {
  return getConversationHead(conversation_id).refused_prompts;
}
export function getCorrections(conversation_id: string): readonly Correction[] {
  return getConversationHead(conversation_id).corrections;
}
