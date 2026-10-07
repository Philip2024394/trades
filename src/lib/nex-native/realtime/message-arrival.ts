// src/lib/nex-native/realtime/message-arrival.ts
//
// R1 · Universal Live Messaging · server-side arrival emit.
// --------------------------------------------------------
// Fire-and-forget broadcast on the sealed Bridge 73 channel
// `nex:messages:{conversationId}` with a new `arrival` event.
//
// Payload is strictly:
//     { conversation_id, message_group_id, sent_at }
//
// The event is a NUDGE, not the message. Receivers call the
// authenticated /api/nex-native/peer-message/since endpoint to fetch
// the actual encrypted row + decrypt locally via the sealed Bridge 76
// client pipeline. Nothing in this payload reveals plaintext,
// ciphertext, attachment URL, or identities.
//
// Doctrine
//   · Realtime is an optimisation for immediate delivery · NOT a
//     correctness dependency. If this emit fails, the recipient still
//     catches up via (a) visibility reconciliation, (b) subscribe-
//     reconnect reconciliation, or (c) their next SSR page open.
//   · The broadcast is NEVER inside the DB transaction's correctness
//     path. Call this AFTER the row insert succeeds · a failure here
//     must never flip a successful send into a failed send.
//   · Encrypted sends create multiple physical rows (one per recipient
//     device, Bridge 76 fan-out). This module emits exactly ONE event
//     per logical send · the caller passes `message_group_id` so
//     every sibling collapses into one arrival signal.
//
// Transport
//   · Supabase Realtime HTTP Broadcast endpoint. Server-side friendly,
//     no channel subscription required, nothing to tear down. Matches
//     the public-channel configuration created by Bridge 67's
//     openNexChannel on the client side.

import "server-only";

const BROADCAST_PATH = "/realtime/v1/api/broadcast";
const EVENT_NAME = "arrival";

/** Marker so receivers never self-filter a server-origin broadcast ·
 *  Bridge 67's envelope filter compares against the subscriber's UUID
 *  `selfId` · a non-UUID sentinel is guaranteed never to match. */
const SERVER_SENDER_SENTINEL = "@nex-server";

/** Strict payload shape · public to allow deterministic grep-static
 *  guards in the R1 test suite. */
export interface MessageArrivalPayload {
  conversation_id: string;
  message_group_id: string;
  sent_at: string;
}

export interface EmitMessageArrivalOptions {
  conversationId: string;
  /** For encrypted fan-out sends, the Bridge 76 message_group_id (same
   *  value on every sibling row). For plaintext sends, the single
   *  row's id. Either way: a stable logical identifier the receiver
   *  uses for dedup. */
  messageGroupId: string;
  /** ISO 8601 · the server emit time. Receivers treat this as a hint
   *  only · their reconciliation watermark is driven by server-
   *  stamped `sent_at` on actual fetched rows, not by this field. */
  sentAtIso: string;
}

/**
 * Fire-and-forget. Resolves silently on failure. Never throws. The
 * caller MUST treat this as a best-effort optimisation layered on top
 * of the committed canonical message write.
 */
export async function emitMessageArrival(
  opts: EmitMessageArrivalOptions,
): Promise<void> {
  try {
    const url = buildBroadcastUrl();
    const key = resolveServiceKey();
    if (!url || !key) {
      // Fail-closed on misconfiguration · we do NOT throw here · the
      // send already succeeded · reconciliation will catch up.
      return;
    }

    const envelopePayload: MessageArrivalPayload = {
      conversation_id: opts.conversationId,
      message_group_id: opts.messageGroupId,
      sent_at: opts.sentAtIso,
    };

    // Bridge 67's receive filter expects `{sender, payload}` so we
    // mirror that envelope shape · the sentinel sender ensures no
    // real subscriber ever self-filters it.
    const body = {
      messages: [
        {
          topic: `nex:messages:${opts.conversationId}`,
          event: EVENT_NAME,
          payload: {
            sender: SERVER_SENDER_SENTINEL,
            payload: envelopePayload,
          },
          private: false,
        },
      ],
    };

    // Short per-call timeout · broadcast is best-effort · we do not
    // want a hung realtime endpoint to delay the send response.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: key,
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    /* fire-and-forget · reconciliation handles missed events */
  }
}

/** Public constants · exported ONLY so the R1 test suite can grep-
 *  static them. The module code paths above use the local names. */
export const R1_ARRIVAL_EVENT_NAME = EVENT_NAME;
export const R1_ARRIVAL_SERVER_SENDER = SERVER_SENDER_SENTINEL;

function buildBroadcastUrl(): string | null {
  const base =
    process.env.NEX_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ??
    null;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}${BROADCAST_PATH}`;
}

function resolveServiceKey(): string | null {
  return process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? null;
}
