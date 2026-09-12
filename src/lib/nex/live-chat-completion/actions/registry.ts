// src/lib/nex/live-chat-completion/actions/registry.ts
//
// Founder BEGIN Phase 3.7 · Safe Actionable Intelligence · Action registry.
//
// The definitive list of actions NEX can perform. Adding an action is
// a Founder-level decision — new entries need a schema, a permission
// rule, and an executor + audit test.
//
// All executors here are BOUNDED / SIDE-EFFECT-MINIMAL for this session:
//   - contact_via_whatsapp   → returns a wa.me URL · does not send anything itself.
//   - save_favorite          → in-memory session set · resets on process restart.
//   - submit_gap_ticket      → writes to nex.knowledge_gap (already used by rescue path).
//   - request_evidence_page  → returns a public URL path · no external call.
//
// Every action is idempotent OR clearly labelled.

import { z } from "zod";
import type { ActionDefinition, ActionId } from "./contract";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { makeKnowledgeGapQueue } from "@/lib/nex/live-chat-completion/knowledge-gap-queue";
import type { Domain } from "@/lib/nex/live-chat-completion/contract";

// ═══════════════════════════════════════════════════════════════════
// In-memory "favorites" list per session · session-scoped only.
// A real user-identity BEGIN will replace this with a durable store.
// ═══════════════════════════════════════════════════════════════════
const _favorites = new Map<string, Set<string>>();
const _MAX_FAVORITES_PER_SESSION = 100;

// ═══════════════════════════════════════════════════════════════════
// Action definitions
// ═══════════════════════════════════════════════════════════════════

const contactViaWhatsapp: ActionDefinition = {
  id: "contact_via_whatsapp",
  display_en: "Contact via WhatsApp",
  display_id: "Hubungi via WhatsApp",
  args_schema: z.object({
    entity_ref: z.string().min(1).max(120),
    message: z.string().min(1).max(400),
  }),
  requires_confirmation: true,
  min_trust: "any",
  permission: ({ context, args }) => {
    if (!args.entity_ref) return { allowed: false, reason: "no_entity_ref" };
    if (!context.conversation_id) return { allowed: false, reason: "no_conversation_id" };
    return { allowed: true };
  },
  async executor({ args }) {
    // Never sends the message · we just prepare the deep link.
    // The client renders it as a "Open WhatsApp" button after confirmation.
    const msg = encodeURIComponent(String(args.message ?? ""));
    return { ok: true, result: { deep_link: `https://wa.me/?text=${msg}` } };
  },
};

const saveFavorite: ActionDefinition = {
  id: "save_favorite",
  display_en: "Save to favorites",
  display_id: "Simpan ke favorit",
  args_schema: z.object({
    entity_ref: z.string().min(1).max(120),
  }),
  requires_confirmation: false,
  min_trust: null,
  permission: ({ context, args }) => {
    if (!context.conversation_id) return { allowed: false, reason: "no_conversation_id" };
    if (!args.entity_ref) return { allowed: false, reason: "no_entity_ref" };
    return { allowed: true };
  },
  async executor({ context, args }) {
    const key = context.session_id ?? context.conversation_id ?? "anon";
    let set = _favorites.get(key);
    if (!set) {
      if (_favorites.size >= 4096) {
        // Trim oldest by insertion order.
        const firstKey = _favorites.keys().next().value as string | undefined;
        if (firstKey) _favorites.delete(firstKey);
      }
      set = new Set();
      _favorites.set(key, set);
    }
    if (set.size >= _MAX_FAVORITES_PER_SESSION) return { ok: false, error: "favorites_full" };
    set.add(String(args.entity_ref));
    return { ok: true, result: { total: set.size } };
  },
};

const submitGapTicket: ActionDefinition = {
  id: "submit_gap_ticket",
  display_en: "Ask NEX to look this up",
  display_id: "Minta NEX cari infonya",
  args_schema: z.object({
    domain: z.string().min(1).max(60),
    entity_ref: z.string().min(1).max(120),
    intent_slug: z.string().min(1).max(120),
  }),
  requires_confirmation: false,
  min_trust: null,
  permission: () => ({ allowed: true }),
  async executor({ context, args }) {
    try {
      const q = makeKnowledgeGapQueue({ kfPool: getKnowledgeFactoryDbPool() });
      const { gap_id, created } = await q.enqueue({
        domain: String(args.domain) as Domain,
        entity_ref: String(args.entity_ref),
        intent_slug: String(args.intent_slug),
        source: "live_chat",
        source_conversation_id: context.conversation_id ?? null,
      });
      return { ok: true, result: { gap_id, created } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "gap_enqueue_error" };
    }
  },
};

const requestEvidencePage: ActionDefinition = {
  id: "request_evidence_page",
  display_en: "Show the evidence page for this",
  display_id: "Tampilkan halaman bukti",
  args_schema: z.object({
    entity_ref: z.string().min(1).max(120),
  }),
  requires_confirmation: false,
  min_trust: null,
  permission: ({ args }) => {
    if (!args.entity_ref) return { allowed: false, reason: "no_entity_ref" };
    return { allowed: true };
  },
  async executor({ args }) {
    // Public evidence page URL is a stable path per entity.
    return { ok: true, result: { url: `/nex-app/entity/${encodeURIComponent(String(args.entity_ref))}` } };
  },
};

// ═══════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════

const _ACTION_REGISTRY: readonly ActionDefinition[] = Object.freeze([
  contactViaWhatsapp,
  saveFavorite,
  submitGapTicket,
  requestEvidencePage,
]);

const _BY_ID = new Map<string, ActionDefinition>();
for (const a of _ACTION_REGISTRY) _BY_ID.set(a.id, a);

export function getActionDefinition(id: string): ActionDefinition | null {
  return _BY_ID.get(id) ?? null;
}

export function allActionIds(): readonly ActionId[] {
  return _ACTION_REGISTRY.map((a) => a.id);
}

/** Founder ECO-2 · Action Brain facade helper · list summaries for MCP. */
export function listActionSummaries(): readonly {
  action_id: string;
  summary: string;
  requires_confirmation: boolean;
}[] {
  return _ACTION_REGISTRY.map((a) => ({
    action_id: a.id,
    summary: a.display_en ?? a.id,
    requires_confirmation: !!a.requires_confirmation,
  }));
}

// Test helpers
export function _clearFavoritesForTesting(): void { _favorites.clear(); }
export function _snapshotFavorites(key: string): string[] {
  return Array.from(_favorites.get(key) ?? []);
}
