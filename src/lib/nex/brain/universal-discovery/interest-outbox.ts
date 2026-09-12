// src/lib/nex/brain/universal-discovery/interest-outbox.ts
//
// NEX Universal Discovery Slice · Interest Outbox
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§14 · §15 · §16 · §22)
//   Client-side "outbox" for pending owner conversations. When the user
//   presses Send on a prefilled interested message, the draft is
//   persisted locally so the /nex-app/messages surface can list it as
//   a pending outbound conversation. The realtime messenger backend
//   is a separate authorized slice · this outbox is the honest
//   intermediate state.
//
// TRUTH RULE (§4)
//   The outbox NEVER fabricates: entities, messages, timestamps, owner
//   receipts. A message in the outbox is "you drafted this locally";
//   nothing more.
//
// PRIVACY (§23)
//   Only the entity context + the user's typed message body is stored.
//   No user contact info · no owner phone leak into the client. When
//   the future real backend lands, this outbox is the migration source.
//
// STORAGE (§32 file budget · reuse existing patterns)
//   localStorage under the key `nex.universal-discovery.interest-outbox`.
//   Kept append-only + read-any so the /nex-app/messages surface can
//   render without any extra state machine. Pure functions here · the
//   caller (React component) handles the actual localStorage IO so
//   this module stays server-safe.

import type { WorldVertical } from "../world-adapters/types";

// ─── Types ──────────────────────────────────────────────────────

export type InterestOutboxItem = {
  /** Stable client-side id · uuid or hash. */
  id: string;
  /** Entity reference id · maps to session.entities / EntityDetail. */
  entity_ref_id: string;
  entity_name: string;
  vertical: WorldVertical;
  /** The message body the user actually sent (may have been edited from
   *  the prefill). */
  message: string;
  /** ISO timestamp of local send action. */
  created_at: string;
  /** Delivery state · this slice ships PENDING_LOCAL only.
   *  DELIVERED / READ come from the future realtime backend. */
  status: "PENDING_LOCAL" | "DELIVERED" | "READ" | "FAILED";
  /** Language of the message · so the future backend can render owner
   *  side correctly. */
  language: "EN" | "ID";
  /** Snapshot of the entity summary at send time · so the owner
   *  conversation retains context even when the underlying entity
   *  changes later. */
  entity_snapshot: {
    name: string;
    location: string | null;
    category: string | null;
    primary_source: string;
  };
};

// ─── Pure reducers ─────────────────────────────────────────────

/** Prepend a new item · newest first. Bounded to 200 items to keep
 *  localStorage from growing unbounded. */
export function addOutboxItem(
  prior: ReadonlyArray<InterestOutboxItem>,
  next: InterestOutboxItem,
): InterestOutboxItem[] {
  const combined = [next, ...prior];
  return combined.length > 200 ? combined.slice(0, 200) : combined;
}

/** Filter for a specific entity_ref_id · used by the detail page to
 *  show "you've already messaged this owner" affordance. */
export function itemsForEntity(
  all: ReadonlyArray<InterestOutboxItem>,
  entity_ref_id: string,
): InterestOutboxItem[] {
  return all.filter((i) => i.entity_ref_id === entity_ref_id);
}

// ─── Storage helpers (client-only) ────────────────────────────

const STORAGE_KEY = "nex.universal-discovery.interest-outbox";

/** Read the outbox from localStorage. Client-only · returns [] on
 *  server or on any parse error (defensive). */
export function loadOutbox(): InterestOutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch { return []; }
}

/** Persist the outbox to localStorage. Silent on failure so a full
 *  storage quota doesn't crash the app. */
export function saveOutbox(items: ReadonlyArray<InterestOutboxItem>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota exceeded · silent */ }
}

// ─── Validation ────────────────────────────────────────────────

function isValidItem(x: unknown): x is InterestOutboxItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string"
    && typeof o.entity_ref_id === "string"
    && typeof o.entity_name === "string"
    && typeof o.message === "string"
    && typeof o.created_at === "string"
    && (o.status === "PENDING_LOCAL" || o.status === "DELIVERED" || o.status === "READ" || o.status === "FAILED");
}

/** Convenience id generator · uses crypto.randomUUID when available. */
export function newItemId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through */ }
  // Fallback · not cryptographically strong but sufficient for a local id
  return "ib_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}
