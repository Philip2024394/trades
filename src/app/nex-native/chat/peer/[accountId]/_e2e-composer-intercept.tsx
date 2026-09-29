"use client";

// src/app/nex-native/chat/peer/[accountId]/_e2e-composer-intercept.tsx
//
// Bridge 76 · Intercept composer submits and route them through the
// encrypted path when both parties have device keys.
// -----------------------------------------------------------------
// Attaches a capture-phase `submit` listener on the form containing
// the composer textarea (marked with `data-nex-composer-textarea`).
// When the form is submitted:
//   · If E2E is ready (peer has ≥ 1 device key AND we have one),
//     prevent the default Server-Action submit, encrypt client-side,
//     POST to /api/nex-native/peer-message/encrypted, then reload the
//     chat via router.refresh().
//   · If E2E is NOT ready, let the plaintext form submit through
//     unchanged — the existing sendPeerMessageAction path handles it.
//
// Attachments (image / video / voice) still route through the
// plaintext path in v1 — encrypting binary payloads through the same
// pipeline is a follow-up. The intercept detects an attachment on the
// URL and steps aside so nothing breaks.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  sendEncryptedPeerMessage,
} from "@/lib/nex-native/crypto/encrypted-send";

const ATTACH_MAX_ATTEMPTS = 5;
const ATTACH_INTERVAL_MS = 200;

export interface E2eComposerInterceptProps {
  conversationId: string;
  peerAccountId: string;
  selfAccountId: string;
  /** Skip entirely for NEX1 (no E2E for support chat per doctrine). */
  disabled?: boolean;
}

export function E2eComposerIntercept(
  props: E2eComposerInterceptProps,
): React.JSX.Element | null {
  const router = useRouter();
  const [status, setStatus] = React.useState<
    "idle" | "sending" | "fallback" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [e2eReady, setE2eReady] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (props.disabled) return;
    let attached: HTMLFormElement | null = null;
    let attempt = 0;

    const onSubmit = (evt: SubmitEvent) => {
      const form = evt.currentTarget as HTMLFormElement | null;
      if (!form) return;
      // If the URL already carries an attachment, defer to the
      // plaintext path — binary encryption isn't in v1 yet.
      const url = new URL(window.location.href);
      if (url.searchParams.get("attachment_url")) return;

      const fd = new FormData(form);
      const bodyText = String(fd.get("body") ?? "").trim();
      if (!bodyText) return;

      // Speculative: intercept, try encrypted send; on any signal that
      // E2E isn't available fall back to the plaintext path by
      // re-submitting the form programmatically.
      evt.preventDefault();
      evt.stopImmediatePropagation();
      setStatus("sending");
      setErrorMsg(null);

      const replyToId = (fd.get("reply_to_id") as string | null) || null;

      void (async () => {
        const outcome = await sendEncryptedPeerMessage({
          conversationId: props.conversationId,
          peerAccountId: props.peerAccountId,
          selfAccountId: props.selfAccountId,
          plaintext: bodyText,
          replyToId,
        });
        if (outcome.ok) {
          setStatus("idle");
          setE2eReady(true);
          const textarea = form.querySelector<HTMLTextAreaElement>(
            "[data-nex-composer-textarea]",
          );
          if (textarea) {
            const setter = Object.getOwnPropertyDescriptor(
              HTMLTextAreaElement.prototype, "value",
            )?.set;
            setter?.call(textarea, "");
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          }
          // Bring the conversation back from the server so the new
          // (encrypted) row lands in the message list.
          router.refresh();
          return;
        }
        if (outcome.error === "no_peer_devices" || outcome.error === "no_self_devices") {
          // Silent fallback · resubmit form (without our capture listener
          // preventing) to let the Server Action send plaintext.
          setStatus("fallback");
          setE2eReady(false);
          form.removeEventListener("submit", onSubmit, true);
          form.requestSubmit();
          form.addEventListener("submit", onSubmit, true);
          return;
        }
        setStatus("error");
        setErrorMsg(outcome.message ?? String(outcome.error));
      })();
    };

    const tryAttach = () => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "[data-nex-composer-textarea]",
      );
      const form = textarea?.form ?? null;
      if (form) {
        attached = form;
        form.addEventListener("submit", onSubmit, true);
        return;
      }
      attempt += 1;
      if (attempt < ATTACH_MAX_ATTEMPTS) {
        setTimeout(tryAttach, ATTACH_INTERVAL_MS);
      }
    };
    tryAttach();

    return () => {
      if (attached) attached.removeEventListener("submit", onSubmit, true);
    };
  }, [
    props.conversationId,
    props.peerAccountId,
    props.selfAccountId,
    props.disabled,
    router,
  ]);

  if (props.disabled) return null;
  // Status chip · surfaces sending / error / E2E-active states. Tucked
  // above the composer, small footprint, dismissable by user via time.
  if (status === "sending" || status === "error" || e2eReady === true) {
    return (
      <StatusChip
        state={status === "error" ? "error" : status === "sending" ? "sending" : "on"}
        errorMsg={errorMsg}
      />
    );
  }
  return null;
}

function StatusChip({
  state,
  errorMsg,
}: {
  state: "on" | "sending" | "error";
  errorMsg: string | null;
}): React.JSX.Element {
  const label =
    state === "sending"
      ? "🔒 Encrypting…"
      : state === "error"
        ? `🔒 Encrypt failed · ${errorMsg ?? "unknown"}`
        : "🔒 End-to-end encrypted";
  const color =
    state === "error" ? "#FFB4C0"
    : state === "sending" ? "#DDE9FA"
    : "#16D66B";
  const bg =
    state === "error" ? "rgba(255,51,85,0.10)"
    : state === "sending" ? "rgba(4,20,36,0.85)"
    : "rgba(22,214,107,0.10)";
  const border =
    state === "error" ? "rgba(255,51,85,0.35)"
    : state === "sending" ? "rgba(139,169,209,0.30)"
    : "rgba(22,214,107,0.35)";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(env(safe-area-inset-bottom, 0) + 148px)",
        zIndex: 5,
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        backdropFilter: "blur(6px)",
      }}
    >
      {label}
    </div>
  );
}
