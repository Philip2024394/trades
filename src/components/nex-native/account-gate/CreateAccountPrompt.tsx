"use client";

// src/components/nex-native/account-gate/CreateAccountPrompt.tsx
//
// NEX Settings Header · Create-Account prompt modal.
// -----------------------------------------------------------------------
// Sealed 2026-10-10.
//
// Appears when a locked Settings button is tapped. Two copy variants:
//
//   · "anonymous"            · fully-anonymous visitor · primary CTA
//                              reads "Create account", routes to
//                              /nex-native/create-account.
//   · "signed_in_no_account" · Supabase auth session exists but no
//                              nex_account row · primary CTA reads
//                              "Finish setup". Still routes to the
//                              same onboarding entry (the server-side
//                              auto-provisioner picks it up on the
//                              next resolver pass).
//
// Dismissal semantics are per-TAP, not per-session. If the user
// dismisses, re-tapping the locked button reopens the modal. The lock
// is a feature-reveal, not a nag.
//
// Accessibility:
//   · role="dialog", aria-modal="true", aria-labelledby, aria-describedby.
//   · Focus trap: tab/shift-tab cycles within the modal.
//   · Esc closes.
//   · Backdrop click closes.
//   · On open: initial focus goes to the primary CTA.
//   · On close: focus returns to the invoking element (passed by parent
//     via `returnFocusRef`).
//
// Routing:
//   · Primary CTA uses next/navigation `useRouter().push(onboardingHref)`.
//   · Parent controls open/close via `open` + `onClose` props.
//
// No account-related writes happen here. This is a pure navigation
// hand-off to the sealed onboarding flow.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_GATE_PALETTE as P } from "./_palette";

export type CreateAccountPromptVariant = "anonymous" | "signed_in_no_account";

export interface CreateAccountPromptProps {
  readonly open: boolean;
  readonly variant: CreateAccountPromptVariant;
  readonly onClose: () => void;
  /**
   * Canonical onboarding route. Defaults to `/nex-native/create-account`.
   * Override only in tests / fixtures.
   */
  readonly onboardingHref?: string;
  /**
   * Ref to the element that opened the modal (the locked Settings
   * button). On close we restore focus to it.
   */
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const DEFAULT_ONBOARDING_HREF = "/nex-native/create-account";

export function CreateAccountPrompt({
  open,
  variant,
  onClose,
  onboardingHref = DEFAULT_ONBOARDING_HREF,
  returnFocusRef,
}: CreateAccountPromptProps) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const primaryBtnRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();
  const bodyId = React.useId();

  // Initial focus + focus restore on close
  React.useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // Defer so the dialog node is painted before we focus
    const t = window.setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      // Restore focus to the invoking button (fallback: previous active)
      const target = returnFocusRef?.current ?? prev;
      try {
        target?.focus();
      } catch {
        /* noop */
      }
    };
  }, [open, returnFocusRef]);

  // Esc + focus-trap keyboard handler
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  if (!open) return null;

  const title =
    variant === "signed_in_no_account"
      ? "Finish creating your NEX account"
      : "Create your NEX account";

  const body =
    variant === "signed_in_no_account"
      ? "Your sign-in is ready · finish creating your NEX profile to unlock Settings and the rest of the app."
      : "Settings and most NEX features need an account. Create one in less than a minute to unlock Vault, Emergency Help, Chats, your Directory profile, and everything else.";

  const primaryLabel = variant === "signed_in_no_account" ? "Finish setup" : "Create account";

  const handlePrimary = () => {
    router.push(onboardingHref);
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdrop}
      data-nex-account-gate-backdrop
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: P.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="nex-create-account-prompt"
        data-nex-prompt-variant={variant}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          maxWidth: 420,
          background: P.panel,
          border: `1px solid ${P.panelBorder}`,
          borderRadius: 14,
          padding: 24,
          color: P.textPrimary,
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontSize: 20,
            lineHeight: 1.25,
            fontWeight: 600,
            color: P.textPrimary,
          }}
        >
          {title}
        </h2>
        <p
          id={bodyId}
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: P.textSecondary,
          }}
        >
          {body}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            ref={primaryBtnRef}
            onClick={handlePrimary}
            data-testid="nex-create-account-prompt-primary"
            style={{
              appearance: "none",
              border: "none",
              background: P.ctaBg,
              color: P.ctaText,
              fontSize: 16,
              fontWeight: 600,
              padding: "12px 16px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="nex-create-account-prompt-dismiss"
            style={{
              appearance: "none",
              background: "transparent",
              color: P.dismissText,
              fontSize: 14,
              fontWeight: 500,
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${P.dismissBorder}`,
              cursor: "pointer",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
