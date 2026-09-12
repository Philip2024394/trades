// src/lib/nex/live-chat-completion/memory/contract.ts
//
// Founder BEGIN Phase 3.10 · L2 long-term memory · user identity · custom instructions.
//
// ═══════════════════════════════════════════════════════════════════
// FOUNDER DOCTRINE #4 (2026-09-09 · MEMORY IS NOT TRUTH)
// ═══════════════════════════════════════════════════════════════════
//   "Memory informs context. Memory does NOT establish truth."
//
//   A remembered user preference (e.g. "I prefer concise answers") may
//   influence tone / format / filtering.
//   A remembered factual claim (e.g. "my business address is X") must
//   NEVER become authoritative evidence · it must be re-verified through
//   the Truth Engine like any other claim before it can be cited.
//
//   The four-layer trust model:
//     Knowledge Factory  builds knowledge
//     Truth Engine       determines evidence + trust
//     Memory             remembers user / context (this module)
//     LLM / Vision       proposes interpretation / content
//   NEX is the sole authority deciding what reaches the user.
//
// Contract consequences:
//   (a) Memories are NEVER converted into EvidenceItem records.
//       There is NO source_type "memory". They surface only via
//       bundle.user_context (a distinct field the LLM sees) and via
//       deterministic filter hints (e.g. "user is vegetarian" → recipe
//       filter). The Fabrication Gate cannot validate a memory citation
//       because memories are not in bundle.items.
//   (b) A user-asserted fact ("my kids are 6 and 8") may be REMEMBERED,
//       but the reply pipeline treats it as USER-STATED CONTEXT, not
//       verified truth. If NEX is asked "how old are my kids?" it may
//       answer using memory but MUST label the answer "based on what
//       you've told me" · never as a canonical fact.
//   (c) Custom instructions may shape TONE and FORMAT only. They CANNOT
//       elevate trust, override honest UNKNOWN, or introduce facts.

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// User identity
// ═══════════════════════════════════════════════════════════════════

/** Opaque user identifier. Stable across sessions. Assigned by caller (auth). */
export type UserId = string;

/** Deterministic short hash of a user_id · safe for observability + surface refs. */
export function hashUserId(user_id: UserId): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(String(user_id)).digest("hex").slice(0, 16);
}

// ═══════════════════════════════════════════════════════════════════
// Custom instructions
// ═══════════════════════════════════════════════════════════════════

export const CustomInstructionsSchema = z.object({
  /** What the user wants NEX to know about them (persona · context). */
  about_user: z.string().max(1500).optional(),
  /** How the user wants NEX to respond (tone · format · length). */
  response_style: z.string().max(1500).optional(),
  /** Preferred language for replies. Overrides auto-detection when set. */
  preferred_language: z.enum(["en", "id"]).optional(),
  /** ISO date the instructions were last updated. */
  updated_at: z.string().optional(),
});
export type CustomInstructions = z.infer<typeof CustomInstructionsSchema>;

// ═══════════════════════════════════════════════════════════════════
// User memory
// ═══════════════════════════════════════════════════════════════════
//
// Categories reflect the FOUR ROLES memory can play. Two are personalization
// (they may influence tone/filter), two are user-stated facts (they may be
// SURFACED as "based on what you've told me" but NEVER as verified truth).

/** Category tag drives how the reply pipeline treats the memory. */
export type UserMemoryCategory =
  // Personalization signals · shape tone / format / filter (never a fact)
  | "preference"        // "I prefer concise answers" · "window seat"
  | "response_style"    // "please answer in bullet points"
  // Soft-identity · shapes filter (never a canonical fact)
  | "identity_soft"     // "I'm a solo traveller" · "vegetarian"
  // User-stated facts · REMEMBERED but NOT authoritative
  | "user_asserted_fact" // "my address is X" · "my kids are 6 and 8"
  | "correction"        // "you had my name wrong before" · shape future replies
  // Free-form context · treat as user-asserted fact by default
  | "context"           // "I'm planning a trip in November"
  | "other";

/** Which memories flow to the LLM as personalization vs. user-asserted context. */
export function memoryRole(cat: UserMemoryCategory): "personalization" | "user_asserted" {
  return (cat === "preference" || cat === "response_style" || cat === "identity_soft")
    ? "personalization"
    : "user_asserted";
}

/**
 * Founder Path A · Phase L2M-Tiered · three-tier long-term memory.
 * Per Redis long-term memory architecture (P6 in the architecture
 * research report): semantic (timeless facts), episodic (time-indexed
 * events), procedural (learned procedures). Tier drives how the
 * personalization context surfaces the memory to the LLM.
 *
 * Doctrine #4 unchanged: NO tier makes memory truth. All three tiers
 * flow through PersonalizationContext, never EvidenceItem.
 */
export type UserMemoryTier = "semantic" | "episodic" | "procedural";

export const UserMemorySchema = z.object({
  memory_id: z.string().min(1).max(64),
  user_id: z.string().min(1).max(200),
  claim_text: z.string().min(1).max(500),
  category: z.enum([
    "preference", "response_style", "identity_soft",
    "user_asserted_fact", "correction", "context", "other",
  ]),
  /** Which long-term memory tier this row belongs to. Default: semantic. */
  tier: z.enum(["semantic", "episodic", "procedural"]).default("semantic"),
  /** 0..1 confidence in the extracted memory · low = probably paraphrased. */
  confidence: z.number().min(0).max(1).default(0.7),
  /** Source turn that produced this memory · human-readable (e.g. "u:12"). */
  source_turn_id: z.string().max(80).optional(),
  created_at: z.string(),
  /** Optional soft TTL · after this ISO date the memory is filtered from context. */
  expires_at: z.string().nullable().optional(),
  /** When the user last acted on / referenced this memory · drives ranking. */
  last_referenced_at: z.string().nullable().optional(),
});
export type UserMemory = z.infer<typeof UserMemorySchema>;

// ═══════════════════════════════════════════════════════════════════
// User profile (aggregate)
// ═══════════════════════════════════════════════════════════════════

export const UserProfileSchema = z.object({
  user_id: z.string().min(1).max(200),
  custom_instructions: CustomInstructionsSchema.optional(),
  memories: z.array(UserMemorySchema).max(200).default([]),
  /** Optional display name · never used in surface refs · pure UX. */
  display_name: z.string().max(80).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ═══════════════════════════════════════════════════════════════════
// Personalization context surface
// ═══════════════════════════════════════════════════════════════════
//
// This is the ONLY structured surface the LLM sees for memory-derived
// information. It is DISTINCT from EvidenceItem · it deliberately has no
// ref_id · the LLM cannot "cite" it as evidence and the Fabrication Gate
// cannot validate a memory citation because memories are not in bundle.items.

export interface PersonalizationContext {
  /** Personalization signals: tone/format/filter hints. */
  preferences: readonly {
    category: Extract<UserMemoryCategory, "preference" | "response_style" | "identity_soft">;
    claim_text: string;
    confidence: number;
    tier: UserMemoryTier;
  }[];
  /** User-asserted facts: shown to the LLM as "user has previously told us" · never authoritative. */
  user_asserted: readonly {
    category: Extract<UserMemoryCategory, "user_asserted_fact" | "correction" | "context" | "other">;
    claim_text: string;
    confidence: number;
    tier: UserMemoryTier;
  }[];
  /**
   * Founder L2M-Tiered · tiered surfacing for the LLM prompt.
   *   semantic   · timeless facts (highest weight for personalization)
   *   episodic   · time-indexed events (label as "previously you...")
   *   procedural · learned procedures (label as "you typically...")
   */
  tiered: {
    semantic: readonly { claim_text: string; category: UserMemoryCategory; confidence: number }[];
    episodic: readonly { claim_text: string; category: UserMemoryCategory; confidence: number; created_at: string }[];
    procedural: readonly { claim_text: string; category: UserMemoryCategory; confidence: number }[];
  };
  /** Custom instructions surface. */
  custom_instructions?: CustomInstructions;
  /** Deterministic short hash of user_id · safe for observability. */
  user_id_hash: string;
}

// ═══════════════════════════════════════════════════════════════════
// Store interface
// ═══════════════════════════════════════════════════════════════════

export interface MemoryStore {
  name: string;
  loadProfile(user_id: UserId): Promise<UserProfile | null>;
  upsertProfile(profile: UserProfile): Promise<void>;
  listMemories(user_id: UserId, opts?: { limit?: number; category?: UserMemoryCategory }): Promise<UserMemory[]>;
  saveMemory(mem: UserMemory): Promise<void>;
  deleteMemory(user_id: UserId, memory_id: string): Promise<void>;
  setCustomInstructions(user_id: UserId, ci: CustomInstructions): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// Memory-id generator · deterministic-ish · unique per user+claim
// ═══════════════════════════════════════════════════════════════════

export function makeMemoryId(user_id: UserId, claim_text: string, ts?: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const seed = `${user_id}|${claim_text}|${ts ?? Date.now()}`;
  return "m_" + createHash("sha256").update(seed).digest("hex").slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════════
// Build a PersonalizationContext from a UserProfile (filter expired etc.)
// ═══════════════════════════════════════════════════════════════════

export function buildPersonalizationContext(
  profile: UserProfile,
  opts: { max_per_bucket?: number; now?: Date } = {},
): PersonalizationContext {
  const now = opts.now ?? new Date();
  const max = opts.max_per_bucket ?? 12;
  const alive = profile.memories.filter((m) => {
    if (!m.expires_at) return true;
    try { return new Date(m.expires_at) > now; } catch { return true; }
  });

  // Rank: last_referenced desc, then confidence desc, then created_at desc.
  const ranked = [...alive].sort((a, b) => {
    const ar = a.last_referenced_at ? new Date(a.last_referenced_at).getTime() : 0;
    const br = b.last_referenced_at ? new Date(b.last_referenced_at).getTime() : 0;
    if (br !== ar) return br - ar;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const preferences: Array<{ category: "preference" | "response_style" | "identity_soft"; claim_text: string; confidence: number; tier: UserMemoryTier }> = [];
  const user_asserted: Array<{ category: "user_asserted_fact" | "correction" | "context" | "other"; claim_text: string; confidence: number; tier: UserMemoryTier }> = [];
  const semantic: Array<{ claim_text: string; category: UserMemoryCategory; confidence: number }> = [];
  const episodic: Array<{ claim_text: string; category: UserMemoryCategory; confidence: number; created_at: string }> = [];
  const procedural: Array<{ claim_text: string; category: UserMemoryCategory; confidence: number }> = [];

  for (const m of ranked) {
    const tier: UserMemoryTier = m.tier ?? "semantic";
    // Feed the personalization/user_asserted views (backwards compat).
    if (memoryRole(m.category) === "personalization") {
      if (preferences.length < max) {
        preferences.push({
          category: m.category as "preference" | "response_style" | "identity_soft",
          claim_text: m.claim_text, confidence: m.confidence, tier,
        });
      }
    } else {
      if (user_asserted.length < max) {
        user_asserted.push({
          category: m.category as "user_asserted_fact" | "correction" | "context" | "other",
          claim_text: m.claim_text, confidence: m.confidence, tier,
        });
      }
    }
    // Feed the tiered view.
    if (tier === "semantic" && semantic.length < max) {
      semantic.push({ claim_text: m.claim_text, category: m.category, confidence: m.confidence });
    } else if (tier === "episodic" && episodic.length < max) {
      episodic.push({ claim_text: m.claim_text, category: m.category, confidence: m.confidence, created_at: m.created_at });
    } else if (tier === "procedural" && procedural.length < max) {
      procedural.push({ claim_text: m.claim_text, category: m.category, confidence: m.confidence });
    }
  }

  return {
    preferences,
    user_asserted,
    tiered: { semantic, episodic, procedural },
    custom_instructions: profile.custom_instructions,
    user_id_hash: hashUserId(profile.user_id),
  };
}
