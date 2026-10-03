// src/app/nex-native/vault/_move-to-vault-affordance.tsx
//
// Client-side affordance for the sealed Vault activation primitives.
// Supports:
//   · long-press (pointerdown ≥ 500ms) on the wrapped element · mobile
//   · right-click (contextmenu) · desktop parity
//   · dedicated 3-dots button when a chip is visible
//
// Renders a bottom-sheet confirm with the EXACT founder-sealed copy from
// docs/doctrine/vault-build-plan-2026-10-03.md (D1.a / D1.b / D1.c). The
// confirmation copy must stay in sync with the doctrine; this file is the
// single UI source for it.

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import {
  moveConversationToVaultAction,
  moveFriendToVaultAction,
  removeConversationFromVaultAction,
  removeFriendFromVaultAction,
} from "./_actions";

type Mode =
  | { kind: "move-conversation"; conversationId: string; friendName: string }
  | { kind: "move-friend"; friendId: string; friendName: string }
  | { kind: "remove-conversation"; conversationId: string; friendName: string }
  | { kind: "remove-friend"; friendId: string; friendName: string };

interface Props {
  mode: Mode;
  children: ReactNode;
  // Optional small kebab chip rendered inline for discoverability. If
  // false, the only trigger is long-press / right-click.
  showChip?: boolean;
}

const LONG_PRESS_MS = 500;

export function MoveToVaultAffordance({ mode, children, showChip = true }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const consumedRef = useRef(false);

  const openSheet = useCallback(() => {
    setErr(null);
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (busy) return;
    setOpen(false);
  }, [busy]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    consumedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      consumedRef.current = true;
      openSheet();
    }, LONG_PRESS_MS);
  };
  const onPointerUp = () => {
    clearTimer();
  };
  const onPointerLeave = () => clearTimer();
  const onPointerCancel = () => clearTimer();
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openSheet();
  };
  const onClickCapture = (e: React.MouseEvent) => {
    // If the long-press fired, swallow the subsequent click so navigation
    // doesn't happen when the user intended to open the sheet.
    if (consumedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      consumedRef.current = false;
    }
  };

  useEffect(() => clearTimer, []);

  async function runAction(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      let result: { ok: true } | { ok: false; reason: string };
      switch (mode.kind) {
        case "move-conversation":
          result = await moveConversationToVaultAction(mode.conversationId);
          break;
        case "move-friend":
          result = await moveFriendToVaultAction(mode.friendId);
          break;
        case "remove-conversation":
          result = await removeConversationFromVaultAction(mode.conversationId);
          break;
        case "remove-friend":
          result = await removeFriendFromVaultAction(mode.friendId);
          break;
      }
      if (!result.ok) {
        setErr(result.reason);
        setBusy(false);
        return;
      }
      setOpen(false);
      setBusy(false);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const sheet = SHEET_COPY[mode.kind](getFriendName(mode));

  return (
    <div
      data-nex-vault-affordance
      data-nex-vault-affordance-mode={mode.kind}
      style={{ position: "relative" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      onClickCapture={onClickCapture}
    >
      {children}
      {showChip && (
        <button
          type="button"
          aria-label={sheet.chipAriaLabel}
          data-nex-vault-affordance-chip
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openSheet();
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 999,
            border: "1px solid rgba(247, 239, 228, 0.08)",
            background: "rgba(22, 16, 12, 0.62)",
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
            color: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <MoreVertical size={16} strokeWidth={1.8} aria-hidden />
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          data-nex-vault-affordance-sheet
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 15, 0.68)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
          onClick={closeSheet}
        >
          <div
            style={{
              background: "rgba(14, 10, 18, 0.78)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              border: "1px solid rgba(247, 239, 228, 0.10)",
              color: "#F2F5F8",
              borderRadius: 22,
              padding: "22px 20px",
              width: "100%",
              maxWidth: 420,
              boxShadow:
                "0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(247,239,228,0.08)",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "0.01em",
              }}
            >
              {sheet.heading}
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "#C9BFAE",
              }}
            >
              {sheet.body}
            </p>
            {err && (
              <p
                data-nex-vault-affordance-error
                style={{
                  margin: "12px 0 0",
                  fontSize: 12.5,
                  color: "#FFB199",
                  lineHeight: 1.4,
                }}
              >
                {err}
              </p>
            )}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={closeSheet}
                disabled={busy}
                data-nex-vault-affordance-cancel
                style={{
                  background: "transparent",
                  color: "#C9BFAE",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 999,
                  padding: "10px 18px",
                  fontSize: 13.5,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {sheet.cancel}
              </button>
              <button
                type="button"
                onClick={() => void runAction()}
                disabled={busy}
                data-nex-vault-affordance-confirm
                style={{
                  background: "#FF8A2A",
                  color: "#1a0f04",
                  border: "none",
                  borderRadius: 999,
                  padding: "10px 20px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.72 : 1,
                }}
              >
                {busy ? "Working…" : sheet.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getFriendName(mode: Mode): string {
  if ("friendName" in mode) return mode.friendName;
  return "this contact";
}

type SheetCopy = {
  heading: string;
  body: string;
  cancel: string;
  confirm: string;
  chipAriaLabel: string;
};

// Keep in sync with docs/doctrine/vault-build-plan-2026-10-03.md D1.
const SHEET_COPY: Record<Mode["kind"], (friendName: string) => SheetCopy> = {
  "move-conversation": (name) => ({
    heading: "Move this conversation to Vault?",
    body:
      `This chat will disappear from your main inbox and only be reachable from Vault. ${name} stays in your Contacts and will not know this chat was moved. You can move it back any time.`,
    cancel: "Cancel",
    confirm: "Move to Vault",
    chipAriaLabel: "Vault options for this conversation",
  }),
  "move-friend": (name) => ({
    heading: `Move ${name} to Vault?`,
    body:
      `This friend will disappear from your Contacts, search, and group picker. All your chats with them move into Vault with them. They won't know. You can move them back any time.`,
    cancel: "Cancel",
    confirm: "Move to Vault",
    chipAriaLabel: "Vault options for this friend",
  }),
  "remove-conversation": (name) => ({
    heading: "Move this conversation back to Contacts?",
    body:
      `It will reappear in your main inbox. ${name} will not be notified either way.`,
    cancel: "Cancel",
    confirm: "Move back",
    chipAriaLabel: "Remove this conversation from Vault",
  }),
  "remove-friend": (name) => ({
    heading: `Move ${name} back to Contacts?`,
    body:
      `${name} will reappear in your Contacts, search, and group picker. They will not be notified either way.`,
    cancel: "Cancel",
    confirm: "Move back",
    chipAriaLabel: "Remove this friend from Vault",
  }),
};
