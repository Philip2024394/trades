// src/lib/nex/brain/attention.ts
//
// Stage 3.28 · Phase 21 · Attention (Philip 2026-08-31).
//
// Cross-turn priority tracking. Reads session state (slots, entities,
// goal) + this turn's signals (introduced slots, correction, resolved
// reference) and ranks the subjects the Brain should pay attention
// to. Observational v1 · future consumers: composer prioritises the
// top-attention entity as default reference · Insight prefers questions
// about high-attention slots · Personalization weights the top-scored
// preference.
//
// v1 discipline:
//   · Deterministic scorer · no LLM
//   · Fixed base scores + turn-signal boosts + status modifiers
//   · Returns ranked list (top-K) + top item + summary
//   · Never fabricates a subject the state doesn't hold
//   · Cross-turn awareness: reads from session so priorities persist
//     naturally across conversation turns

import type { AccommodationSlots } from "./accommodation-slots";
import type { Goal } from "./goal-tracking";
import type { RecognisedEntity } from "./entities";

export type AttentionKind = "slot" | "entity" | "goal";

export type AttentionItem = {
  kind: AttentionKind;
  subject: string;            // "slot:location" | "entity:hotel trim tiga" | "goal:accommodation"
  displayName: string;        // "location" · "Hotel Trim Tiga" · "accommodation goal"
  score: number;              // higher = more attention worth
  reason: string;
};

export type AttentionReport = {
  ranked: AttentionItem[];    // top-K sorted by score desc
  top?: AttentionItem;
  summary: string;
};

export type AttentionInput = {
  slots?: Readonly<AccommodationSlots>;
  goal?: Goal | null;
  entities?: ReadonlyArray<RecognisedEntity>;
  /** Slots INTRODUCED this turn (from newSlotsIntroduced). Boosts attention. */
  slotsIntroducedThisTurn?: ReadonlyArray<keyof AccommodationSlots>;
  /** True when this turn extracted a correction (user changed mind). */
  correctionThisTurn?: boolean;
  /** Canonical name of the business referenced this turn (if resolved). */
  resolvedReferenceCanonical?: string;
  /** Top-K to return · default 5. */
  topK?: number;
};

// ─── Scoring constants ───────────────────────────────────────────────
const SLOT_BASE = 1.0;
const SLOT_INTRODUCED_BOOST = 0.6;
const SLOT_CORRECTION_BOOST = 0.4;

const ENTITY_BASE = 0.8;
const ENTITY_RESOLVED_BOOST = 1.2;
const ENTITY_USER_MESSAGE_BOOST = 0.5;

const GOAL_SCORE_BY_STATUS: Record<Goal["status"], number> = {
  active: 1.5,
  resumed: 1.3,
  paused: 0.8,
  completed: 0.3,
  abandoned: 0.2,
};

// ─── Scorer ──────────────────────────────────────────────────────────

export function computeAttention(input: AttentionInput): AttentionReport {
  const items: AttentionItem[] = [];

  // ─── Slots ─────────────────────────────────────────────────────
  const slots = input.slots ?? {};
  const introduced = new Set(input.slotsIntroducedThisTurn ?? []);
  const slotDims: Array<keyof AccommodationSlots> = ["location", "area", "type", "budget", "date", "guests", "action"];
  for (const dim of slotDims) {
    const value = slots[dim];
    if (value === undefined || value === null) continue;
    let score = SLOT_BASE;
    const reasonParts: string[] = [`slot present: ${String(value)}`];
    if (introduced.has(dim)) {
      score += SLOT_INTRODUCED_BOOST;
      reasonParts.push("introduced this turn");
    }
    if (input.correctionThisTurn && introduced.has(dim)) {
      score += SLOT_CORRECTION_BOOST;
      reasonParts.push("corrected this turn");
    }
    items.push({
      kind: "slot",
      subject: `slot:${dim}`,
      displayName: dim,
      score,
      reason: reasonParts.join(" · "),
    });
  }

  // ─── Entities ──────────────────────────────────────────────────
  const entities = input.entities ?? [];
  for (const e of entities) {
    // Focus on business_name entities (main referenceable subject).
    if (e.kind !== "business_name") continue;
    let score = ENTITY_BASE;
    const reasonParts: string[] = [`presented entity`];
    if (input.resolvedReferenceCanonical && e.canonical === input.resolvedReferenceCanonical) {
      score += ENTITY_RESOLVED_BOOST;
      reasonParts.push("resolved reference this turn");
    }
    if (e.source === "user_message") {
      score += ENTITY_USER_MESSAGE_BOOST;
      reasonParts.push("mentioned in user message");
    }
    items.push({
      kind: "entity",
      subject: `entity:${e.canonical}`,
      displayName: e.raw,
      score,
      reason: reasonParts.join(" · "),
    });
  }

  // ─── Goal ──────────────────────────────────────────────────────
  if (input.goal) {
    const score = GOAL_SCORE_BY_STATUS[input.goal.status] ?? 0;
    items.push({
      kind: "goal",
      subject: `goal:${input.goal.kind}`,
      displayName: `${input.goal.kind} goal (${input.goal.summary})`,
      score,
      reason: `goal status=${input.goal.status}`,
    });
  }

  // ─── Sort + trim ───────────────────────────────────────────────
  items.sort((a, b) => b.score - a.score);
  const topK = input.topK ?? 5;
  const ranked = items.slice(0, topK);
  const top = ranked[0];

  const summary = ranked.length === 0
    ? "no attention subjects (empty state)"
    : `top=${top?.subject} score=${top?.score.toFixed(2)} · ${ranked.length} ranked`;

  return { ranked, top, summary };
}
