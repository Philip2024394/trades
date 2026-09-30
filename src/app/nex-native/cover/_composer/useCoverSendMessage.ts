"use client";

// src/app/nex-native/cover/_composer/useCoverSendMessage.ts
//
// Bridge 99 · Stage 8 · client hook that owns the Send action.
// -----------------------------------------------------------------------------
// State machine · idle → sending → (idle after response).
// send_intent_id generated fresh per Send · double-tap protected by
//   the sendState machine + Migration 105/106 server-side dedup.

import { useCallback, useRef, useState } from "react";

export type SendState = "idle" | "sending";

export interface UseCoverSendMessageInput {
  ownerAccountId: string;
  ownerBusinessId: string | null;
  ownerBisnisTier: "gratis" | "bisnis";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FirstMessageResponse = any;

export interface UseCoverSendMessageResult {
  send: (plaintextBody: string) => Promise<void>;
  sendState: SendState;
  lastResponse: FirstMessageResponse | null;
  lastError: string | null;
}

export function useCoverSendMessage(
  input: UseCoverSendMessageInput,
): UseCoverSendMessageResult {
  const [sendState, setSendState] = useState<SendState>("idle");
  const [lastResponse, setLastResponse] = useState<FirstMessageResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const inflight = useRef(false);

  const send = useCallback(
    async (plaintextBody: string) => {
      if (inflight.current) return; // Client-side double-tap guard (server also enforces via M105/M106)
      inflight.current = true;
      setSendState("sending");
      setLastError(null);

      try {
        // 1. Ensure device_id + keypair · Bridge 74 pattern.
        //    (For Stage 8 initial wiring: use crypto.randomUUID for device_id
        //     placeholder. Real production wiring integrates with the existing
        //     Bridge 74 device-key IndexedDB module.)
        const deviceId = ensureDeviceId();
        const devicePublicKeyB64 = await ensureDevicePublicKey();

        // 2. Fetch owner device keys · Bridge 76 read path.
        //    (For Stage 8 initial wiring: uses a synthetic "owner-device-1"
        //     placeholder. Real wiring calls the existing /api endpoint that
        //     returns the owner's active device public keys.)
        const ownerDeviceIds = ["owner-device-1"]; // placeholder

        // 3. Encrypt the body per owner device · nacl.box.
        //    Placeholder implementation: base64-encode the plaintext.
        //    Real wiring imports the existing Bridge 76 encryption helper.
        const ciphertextRows = ownerDeviceIds.map((rid) => ({
          recipient_device_id: rid,
          ciphertext_b64: btoa(unescape(encodeURIComponent(plaintextBody))),
          nonce_b64: btoa("nonce-24bytes-padding-ok"),
        }));

        // 4. Fingerprint client-side inputs
        const fingerprintClient = deriveFingerprintClientSide();

        // 5. Build the request
        const requestBody = {
          message_length: plaintextBody.length,
          send_intent_id: crypto.randomUUID(),
          message_group_id: crypto.randomUUID(),
          ciphertext_rows: ciphertextRows,
          device_id: deviceId,
          device_public_key_b64: devicePublicKeyB64,
          owner_account_id: input.ownerAccountId,
          owner_business_id: input.ownerBusinessId,
          owner_bisnis_tier: input.ownerBisnisTier,
          fingerprint_client: fingerprintClient,
        };

        // 6. POST
        const resp = await fetch("/api/nex-native/first-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const parsed = (await resp.json()) as FirstMessageResponse;
        setLastResponse(parsed);

        // 7. Handle result
        if (parsed?.status === "created" || parsed?.status === "existing_session") {
          window.location.assign(parsed.redirect_to);
          return;
        }
        if (parsed?.status === "blocked") {
          setLastError(mapBlockReason(parsed.reason));
        }
        // 'challenge' surfaces via lastResponse.status · component reads it
      } catch (e) {
        setLastError(e instanceof Error ? e.message : "Send failed");
      } finally {
        inflight.current = false;
        setSendState("idle");
      }
    },
    [input.ownerAccountId, input.ownerBusinessId, input.ownerBisnisTier],
  );

  return { send, sendState, lastResponse, lastError };
}

// ---------------------------------------------------------------------------
// Client-side helpers
// ---------------------------------------------------------------------------

function ensureDeviceId(): string {
  const key = "nex_device_id";
  if (typeof localStorage === "undefined") return `dev-${crypto.randomUUID()}`;
  const existing = localStorage.getItem(key);
  if (existing && existing.length >= 8) return existing;
  const fresh = `dev-${crypto.randomUUID()}`;
  localStorage.setItem(key, fresh);
  return fresh;
}

async function ensureDevicePublicKey(): Promise<string> {
  // Placeholder · real Bridge 74 wiring persists private key in IndexedDB
  // and returns the base64-encoded 32-byte Curve25519 public key.
  return "A".repeat(43);
}

function deriveFingerprintClientSide(): {
  ua_class: "chromium" | "webkit" | "gecko" | "unknown";
  tz_offset_minutes: number;
  accept_language_primary: string;
} {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let uaClass: "chromium" | "webkit" | "gecko" | "unknown" = "unknown";
  if (/Chrome|Chromium|Edg/.test(ua)) uaClass = "chromium";
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) uaClass = "webkit";
  else if (/Firefox|Gecko/.test(ua) && !/like Gecko/.test(ua)) uaClass = "gecko";
  const tz = typeof Date !== "undefined" ? -new Date().getTimezoneOffset() : 0;
  const langRaw =
    typeof navigator !== "undefined" ? navigator.language || "en" : "en";
  const langPrimary = (langRaw.split("-")[0] || "en").toLowerCase().slice(0, 2);
  return {
    ua_class: uaClass,
    tz_offset_minutes: tz,
    accept_language_primary: /^[a-z]{2}$/.test(langPrimary) ? langPrimary : "en",
  };
}

function mapBlockReason(reason: string): string {
  switch (reason) {
    case "message_too_short":
      return "Say a bit more so we can help.";
    case "duplicate_message":
      return "Looks like a repeat. Try something a bit different.";
    case "ip_reputation":
      return "This connection isn't allowed right now.";
    default:
      return "This message can't be sent right now.";
  }
}
