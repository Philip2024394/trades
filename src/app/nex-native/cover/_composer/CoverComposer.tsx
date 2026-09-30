"use client";

// src/app/nex-native/cover/_composer/CoverComposer.tsx
//
// Bridge 99 · Stage 8 · Cover composer primitive.
// -----------------------------------------------------------------------------
// Renders at the foot of every Cover layout per sealed §7B activation
// boundary ("Curiosity does not create identity; participation does").
// Sending fires POST /api/nex-native/first-message which creates the
// provisional account atomically per §7B.
//
// Client-side responsibilities:
//   · Ensure a nacl.box keypair exists in IndexedDB (Bridge 74 pattern);
//     generate one on first Send if absent.
//   · Fetch the owner's device public keys (Bridge 76 read path).
//   · nacl.box(plaintext, nonce, ownerPub, ourPriv) per owner device.
//   · Assemble ciphertext_rows + send_intent_id + fingerprint_client.
//   · POST /api/nex-native/first-message.
//   · On 'created' response → route to redirect_to with cookie set.
//   · On 'existing_session' → route to owner chat.
//   · On 'challenge' → surface the challenge UX.
//   · On 'blocked' → show reason.
//
// This file is the composer UI + client hook. Actual crypto lives in
// the useCoverSendMessage hook so it's independently testable and can
// be reused elsewhere.
//
// HONEST NOTE: real browser verification (opening Chrome against
// localhost:3008 and exercising the full Cover → Send → Chat flow with
// IndexedDB keypair generation) requires a human at a keyboard and
// remains outside what the assistant can certify alone. This code is
// the implementation; the browser proof needs to be run interactively.

import * as React from "react";
import { useCoverSendMessage } from "./useCoverSendMessage";

export interface CoverComposerProps {
  /** The cover's owner nex_account.id. */
  ownerAccountId: string;
  /** The cover's business id (for cover-attribution) · null if not on a cover. */
  ownerBusinessId: string | null;
  /** Owner's Bisnis tier for risk assessment · defaults to 'gratis'. */
  ownerBisnisTier?: "gratis" | "bisnis";
  /** Owner display name for placeholder text. */
  ownerDisplayName?: string;
  /** Chat-theme accent hex for the composer rim (per ONE NEX IDENTITY). */
  accentHex?: string;
}

export function CoverComposer(props: CoverComposerProps): React.JSX.Element {
  const [draft, setDraft] = React.useState("");
  const { send, sendState, lastError, lastResponse } = useCoverSendMessage({
    ownerAccountId: props.ownerAccountId,
    ownerBusinessId: props.ownerBusinessId,
    ownerBisnisTier: props.ownerBisnisTier ?? "gratis",
  });

  const canSend =
    sendState === "idle" && draft.trim().length >= 3 && draft.trim().length <= 4000;

  const placeholder = props.ownerDisplayName
    ? `Message ${props.ownerDisplayName}…`
    : "Message…";
  const accent = props.accentHex ?? "#00AFFF";

  const onSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSend) return;
      const body = draft.trim();
      setDraft("");
      await send(body);
    },
    [canSend, draft, send],
  );

  return (
    <form
      onSubmit={onSubmit}
      data-nex-cover-composer
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        padding: "10px 12px",
        borderTop: `1px solid ${accent}44`,
        background: "rgba(3, 8, 20, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <textarea
        aria-label={placeholder}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={sendState !== "idle"}
        rows={1}
        maxLength={4000}
        style={{
          flex: 1,
          resize: "none",
          minHeight: 40,
          maxHeight: 120,
          padding: "10px 12px",
          borderRadius: 20,
          border: `1px solid ${accent}55`,
          background: "rgba(255,255,255,0.06)",
          color: "#F2F5F8",
          fontFamily: "inherit",
          fontSize: 14,
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send"
        style={{
          minWidth: 44,
          height: 40,
          borderRadius: 20,
          border: "none",
          background: canSend ? accent : "rgba(255,255,255,0.14)",
          color: canSend ? "#03101D" : "rgba(255,255,255,0.4)",
          fontWeight: 700,
          fontSize: 18,
          cursor: canSend ? "pointer" : "not-allowed",
        }}
      >
        {sendState === "sending" ? "…" : "➤"}
      </button>
      {lastError && (
        <div
          role="alert"
          style={{
            position: "absolute",
            bottom: 62,
            left: 12,
            right: 12,
            padding: "6px 10px",
            fontSize: 12,
            color: "#FFB1A4",
            background: "rgba(60, 20, 20, 0.85)",
            borderRadius: 8,
          }}
        >
          {lastError}
        </div>
      )}
      {lastResponse?.status === "challenge" && (
        <div
          role="alert"
          style={{
            position: "absolute",
            bottom: 62,
            left: 12,
            right: 12,
            padding: "6px 10px",
            fontSize: 12,
            color: "#F2F5F8",
            background: "rgba(30, 50, 90, 0.85)",
            borderRadius: 8,
          }}
        >
          Please confirm you're not a bot.
        </div>
      )}
    </form>
  );
}
