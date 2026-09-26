"use client";

// src/app/nex-native/sign-in/_face-button.tsx
//
// Inline face sign-in trigger for /nex-native/sign-in.
// -------------------------------------------------------------------------
// No camera preview, no MediaPipe, no countdown. Just triggers the OS
// platform-authenticator biometric prompt via WebAuthn. Return sign-in
// is meant to be *fast* — the enrolment ceremony is where the visual
// weight lives.
//
// Only rendered by the server when the `nex-has-face` cookie is present
// (set by the enroll-finish endpoint after successful enrolment on this
// device). If enrolment never happened here, the user never sees this
// button and never hits a WebAuthn "no credential found" error.

import { useCallback, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

const NEX = {
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

type ButtonState =
  | { kind: "idle" }
  | { kind: "prompting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function SignInFaceButton() {
  const [state, setState] = useState<ButtonState>({ kind: "idle" });

  const onClick = useCallback(async () => {
    setState({ kind: "prompting" });
    try {
      const startRes = await fetch("/api/nex-native/auth/webauthn/assert-start", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!startRes.ok) {
        throw new Error(await startRes.text().catch(() => `assert-start ${startRes.status}`));
      }
      const startJson = (await startRes.json()) as {
        options: PublicKeyCredentialRequestOptionsJSON;
      };
      const assertion = await startAuthentication({ optionsJSON: startJson.options });
      const finishRes = await fetch("/api/nex-native/auth/webauthn/assert-finish", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!finishRes.ok) {
        throw new Error(await finishRes.text().catch(() => `assert-finish ${finishRes.status}`));
      }
      const finishJson = (await finishRes.json()) as { redirect?: string };
      setState({ kind: "success" });
      window.location.href = finishJson.redirect ?? "/nex-native/conversations";
    } catch (e) {
      setState({
        kind: "error",
        message:
          (e instanceof Error ? e.message : String(e)).slice(0, 200) ||
          "Face sign-in failed · use password instead.",
      });
    }
  }, []);

  const busy = state.kind === "prompting" || state.kind === "success";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{
          marginTop: 18,
          display: "inline-flex",
          width: "100%",
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "12px 18px",
          background: NEX.panel,
          color: NEX.cyan,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.16em",
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
        data-nex-sign-in-face-button
        aria-busy={state.kind === "prompting"}
      >
        <FaceScanIcon />
        {state.kind === "idle" && "SIGN IN WITH FACE"}
        {state.kind === "prompting" && "CONFIRMING…"}
        {state.kind === "success" && "SIGNED IN"}
        {state.kind === "error" && "TRY AGAIN"}
      </button>

      {state.kind === "error" && (
        <p
          role="status"
          style={{
            marginTop: 10,
            padding: "8px 12px",
            border: `1px solid ${NEX.orange}`,
            borderRadius: 8,
            color: NEX.textPrimary,
            fontSize: 12,
            background: "rgba(255,114,0,0.08)",
          }}
          data-nex-sign-in-face-error
        >
          {state.message}
        </p>
      )}
    </>
  );
}

function FaceScanIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9.5 15c.5.5 1.5 1 2.5 1s2-.5 2.5-1" />
    </svg>
  );
}
