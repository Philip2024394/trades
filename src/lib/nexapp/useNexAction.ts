// NEX Actions · client hook · F3 (2026-08-25).
//
// Calls the single /api/nex-actions/invoke endpoint. Never trusts client-side
// state for security decisions · the server is authoritative for cost,
// balance, ownership, and outcome. This hook just posts the intent and
// returns the confirmed server response.

"use client";

import { useCallback, useRef, useState } from "react";
import { useNexIdentity } from "@/lib/nex-identity";

export type NexActionInvocation = {
  actionId: string;
  target?: {
    kind: "message";
    messageId: string;
    conversationId: string;
  };
  clientPayload?: Record<string, unknown>;
};

export type NexActionResult =
  | { ok: true; kind: "noop" }
  | { ok: true; kind: "message-posted"; messageId: string }
  | { ok: true; kind: "message-deleted"; messageId: string; historyLine: string }
  | { ok: true; kind: "interactive"; messageId: string; expiresAt?: number }
  | { ok: false; error: { code: string; [k: string]: unknown } };

export function useNexAction() {
  const identity = useNexIdentity();
  const [inFlight, setInFlight] = useState(false);
  const inFlightKey = useRef<string | null>(null);

  const invoke = useCallback(
    async (call: NexActionInvocation): Promise<NexActionResult> => {
      const userId = identity.state.status === "ready"
        ? identity.state.identity.internalId
        : null;
      const displayName = identity.state.status === "ready"
        ? identity.state.identity.name
        : "You";
      if (!userId) {
        return { ok: false, error: { code: "unauthorised", reason: "no-identity" } };
      }
      // Client-side double-click protection · not a security boundary, just UX.
      const key = `${call.actionId}:${call.target?.kind === "message" ? call.target.messageId : ""}`;
      if (inFlightKey.current === key) {
        return { ok: false, error: { code: "in-flight", reason: "duplicate-tap" } };
      }
      inFlightKey.current = key;
      setInFlight(true);
      // Deterministic nonce per attempt · server uses it for idempotency.
      const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const resp = await fetch("/api/nex-actions/invoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-nex-user-id": userId,
            "x-nex-user-display-name": displayName,
          },
          body: JSON.stringify({
            actionId: call.actionId,
            nonce,
            target: call.target,
            clientPayload: call.clientPayload,
          }),
        });
        const body = (await resp.json()) as NexActionResult;
        return body;
      } catch (e) {
        return { ok: false, error: { code: "network", message: (e as Error).message } };
      } finally {
        inFlightKey.current = null;
        setInFlight(false);
      }
    },
    [identity],
  );

  return { invoke, inFlight };
}
