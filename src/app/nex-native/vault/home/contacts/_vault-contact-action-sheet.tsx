"use client";

// src/app/nex-native/vault/home/contacts/_vault-contact-action-sheet.tsx
//
// Vault Contacts · vaulted-row action sheet (founder-authorised
// 2026-10-07).
// -----------------------------------------------------------------
// Mirrors the sealed B.5 MoveToVaultAffordance interaction pattern
// (long-press · right-click · 3-dot chip) but exposes THREE actions
// instead of one. Appears ONLY on contact rows whose
// `data-nex-vault-contact-state="vaulted"` · the sealed
// MoveToVaultAffordance continues to own the not-vaulted-row flow.
//
// Actions · all route through sealed server actions, zero new
// backend:
//
//   · Move from Vault
//       → sealed removeConversationFromVaultAction (if a conversation
//         is in the vault)
//       → sealed removeFriendFromVaultAction        (if a friendship
//         is in the vault)
//       Both are called when both apply · each is idempotent per
//       sealed B.5 service invariants. The conversation ID stays the
//       same (canonical conversation rule) · the row simply drops
//       its vault-entry row(s) so the contact reappears in the
//       normal /chat/peer and /friends surfaces.
//
//   · Delete from Vault
//       Backend path IS the same as Move from Vault per founder
//       decision 2026-10-07 · the UX wording is scarier so the user
//       understands the Vault entry is being removed. Canonical
//       conversation is preserved regardless. Reversible by re-
//       vaulting later.
//
//   · Block contact
//       → sealed blockAccountAction (FormData · redirects to the
//         sealed /nex-native/friends banner after success).
//
// This component NEVER reads nex_peer_message · never ciphertext,
// never attachment_url · the vault-locked safety invariant from
// sealed Vault Contacts is unchanged.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MoreVertical } from "lucide-react";
import { useT } from "@/lib/nex/i18n/I18nProvider";
import {
  removeConversationFromVaultAction,
  removeFriendFromVaultAction,
} from "../../_actions";
import { blockAccountAction } from "../../../_actions";

export type VaultedActionKind = "move-out" | "delete" | "block";

export interface VaultContactActionSheetProps {
  friendId: string;
  friendName: string;
  /** Canonical conversation id · passed through to
   *  removeConversationFromVaultAction when the pair has one. Null
   *  when the vault entry is friend-only. */
  conversationId: string | null;
  /** True iff the viewer's friendship-with-this-contact row exists
   *  in nex_vault_entry (entry_kind='friend'). The remove-friend
   *  action is called only when this is true · false means the
   *  vault entry was conversation-only. */
  isFriendVaulted: boolean;
  children: ReactNode;
}

const LONG_PRESS_MS = 500;

/** Replace `{name}` in a template string with the viewer-known
 *  friend display name. The display name is a server-rendered value
 *  (nex_account.display_name) and is NOT translated · it's inserted
 *  into the localised template directly. */
function fillName(template: string, name: string): string {
  return template.replace("{name}", name);
}

export function VaultContactActionSheet(props: VaultContactActionSheetProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<VaultedActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const consumedRef = useRef(false);

  const openMenu = useCallback(() => {
    setError(null);
    setMenuOpen(true);
  }, []);
  const closeMenu = useCallback(() => {
    if (busy) return;
    setMenuOpen(false);
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
      openMenu();
    }, LONG_PRESS_MS);
  };
  const onPointerUp = () => clearTimer();
  const onPointerCancel = () => clearTimer();
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openMenu();
  };
  const onClickCapture = (e: React.MouseEvent) => {
    // If the long-press timer fired already we treat the following
    // click as consumed · same pattern the sealed Move-to-Vault
    // affordance uses to prevent accidental link navigation.
    if (consumedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      consumedRef.current = false;
    }
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirm(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const runMoveOrDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Call BOTH sealed remove-actions · each is idempotent.
      // Conversation-level entry is removed when a conversation id
      // exists · friend-level entry is removed when the friendship
      // is friend-vaulted. The surface treats these as one logical
      // "take out of Vault" step so the user does not have to care
      // about which axis they vaulted on originally.
      const results: Array<{ ok: true } | { ok: false; reason: string }> = [];
      if (props.conversationId) {
        results.push(
          await removeConversationFromVaultAction(props.conversationId),
        );
      }
      if (props.isFriendVaulted) {
        results.push(
          await removeFriendFromVaultAction(props.friendId),
        );
      }
      const failed = results.find((r) => !r.ok) as
        | { ok: false; reason: string }
        | undefined;
      if (failed) {
        setError(failed.reason);
        return;
      }
      setConfirm(null);
      setMenuOpen(false);
      // revalidatePath lives in the sealed vault _actions so the
      // Contacts list re-renders with the row no longer vaulted on
      // the next route segment · we do not call router.refresh here
      // because the sealed action already did a revalidate.
    } finally {
      setBusy(false);
    }
  }, [props.conversationId, props.friendId, props.isFriendVaulted]);

  const blockFormRef = useRef<HTMLFormElement | null>(null);
  const runBlock = useCallback(() => {
    // The sealed blockAccountAction redirects to the main
    // /nex-native/friends banner surface · we submit through a real
    // <form> so the server action receives its FormData shape as
    // sealed.
    blockFormRef.current?.requestSubmit();
  }, []);

  return (
    <>
      <div
        data-nex-vault-contact-action-root
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerCancel}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContextMenu}
        onClickCapture={onClickCapture}
        style={{ position: "relative" }}
      >
        {props.children}
        <button
          type="button"
          aria-label={fillName(
            t("vault.contacts.actions.kebabAriaLabelTemplate"),
            props.friendName,
          )}
          data-nex-vault-contact-kebab
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openMenu();
          }}
          style={{
            position: "absolute",
            right: 48,
            top: "50%",
            transform: "translateY(-50%)",
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "1px solid rgba(247, 239, 228, 0.14)",
            background: "rgba(22, 16, 12, 0.72)",
            color: "rgba(247, 239, 228, 0.78)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <MoreVertical size={16} strokeWidth={1.9} aria-hidden />
        </button>
      </div>

      {menuOpen ? (
        <ActionMenu
          onDismiss={closeMenu}
          onPick={(k) => {
            setMenuOpen(false);
            setConfirm(k);
          }}
          friendName={props.friendName}
        />
      ) : null}

      {confirm === "move-out" ? (
        <ConfirmSheet
          title={t("vault.contacts.confirm.move.title")}
          body={fillName(
            t("vault.contacts.confirm.move.bodyTemplate"),
            props.friendName,
          )}
          cancelLabel={t("vault.contacts.confirm.move.cancel")}
          confirmLabel={t("vault.contacts.confirm.move.confirm")}
          workingLabel={t("vault.contacts.confirm.workingLabel")}
          onDismiss={() => setConfirm(null)}
          onConfirm={runMoveOrDelete}
          busy={busy}
          error={error}
          dataAttr="data-nex-vault-contact-confirm-move"
        />
      ) : null}

      {confirm === "delete" ? (
        <ConfirmSheet
          title={t("vault.contacts.confirm.delete.title")}
          body={fillName(
            t("vault.contacts.confirm.delete.bodyTemplate"),
            props.friendName,
          )}
          cancelLabel={t("vault.contacts.confirm.move.cancel")}
          confirmLabel={t("vault.contacts.confirm.delete.confirm")}
          workingLabel={t("vault.contacts.confirm.workingLabel")}
          onDismiss={() => setConfirm(null)}
          onConfirm={runMoveOrDelete}
          busy={busy}
          error={error}
          dataAttr="data-nex-vault-contact-confirm-delete"
        />
      ) : null}

      {confirm === "block" ? (
        <>
          <ConfirmSheet
            title={fillName(
              t("vault.contacts.confirm.block.titleTemplate"),
              props.friendName,
            )}
            body={t("vault.contacts.confirm.block.body")}
            cancelLabel={t("vault.contacts.confirm.move.cancel")}
            confirmLabel={t("vault.contacts.confirm.block.confirm")}
            workingLabel={t("vault.contacts.confirm.workingLabel")}
            onDismiss={() => setConfirm(null)}
            onConfirm={runBlock}
            busy={busy}
            error={error}
            dataAttr="data-nex-vault-contact-confirm-block"
          />
          <form
            ref={blockFormRef}
            action={blockAccountAction}
            style={{ display: "none" }}
          >
            <input
              type="hidden"
              name="other_account_id"
              value={props.friendId}
            />
          </form>
        </>
      ) : null}
    </>
  );
}

function ActionMenu({
  onDismiss,
  onPick,
  friendName,
}: {
  onDismiss: () => void;
  onPick: (k: VaultedActionKind) => void;
  friendName: string;
}) {
  const t = useT();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fillName(
        t("vault.contacts.actions.menuAriaLabelTemplate"),
        friendName,
      )}
      data-nex-vault-contact-action-menu
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 16, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 90,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 12px 24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(22, 16, 12, 0.95)",
          border: "1px solid rgba(247, 239, 228, 0.08)",
          borderRadius: 20,
          padding: "6px 0",
          color: "#F7EFE4",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <MenuRow
          data-nex-vault-contact-action="move-out"
          label={t("vault.contacts.actions.moveOut.label")}
          hint={fillName(
            t("vault.contacts.actions.moveOut.hintTemplate"),
            friendName,
          )}
          onClick={() => onPick("move-out")}
        />
        <MenuDivider />
        <MenuRow
          data-nex-vault-contact-action="delete"
          label={t("vault.contacts.actions.delete.label")}
          hint={t("vault.contacts.actions.delete.hint")}
          onClick={() => onPick("delete")}
          danger
        />
        <MenuDivider />
        <MenuRow
          data-nex-vault-contact-action="block"
          label={t("vault.contacts.actions.block.label")}
          hint={fillName(
            t("vault.contacts.actions.block.hintTemplate"),
            friendName,
          )}
          onClick={() => onPick("block")}
          danger
        />
      </div>
    </div>
  );
}

function MenuRow({
  label,
  hint,
  onClick,
  danger,
  ...rest
}: {
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
} & Record<`data-${string}`, string>) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "14px 20px",
        background: "transparent",
        border: "none",
        color: danger ? "#FFB4C0" : "#F7EFE4",
        cursor: "pointer",
        font: "inherit",
      }}
      {...rest}
    >
      <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>
        {label}
      </span>
      <span
        style={{
          display: "block",
          marginTop: 2,
          fontSize: 12,
          color: "rgba(247, 239, 228, 0.6)",
          lineHeight: 1.3,
        }}
      >
        {hint}
      </span>
    </button>
  );
}

function MenuDivider() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        margin: "0 20px",
        background: "rgba(247, 239, 228, 0.08)",
      }}
    />
  );
}

function ConfirmSheet({
  title,
  body,
  cancelLabel,
  confirmLabel,
  workingLabel,
  onDismiss,
  onConfirm,
  busy,
  error,
  dataAttr,
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  workingLabel: string;
  onDismiss: () => void;
  onConfirm: () => void;
  busy: boolean;
  error: string | null;
  dataAttr: string;
}) {
  const dataAttrs = { [dataAttr]: "true" } as Record<string, string>;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 16, 0.76)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 95,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 12px 24px",
      }}
      {...dataAttrs}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(22, 16, 12, 0.98)",
          border: "1px solid rgba(247, 239, 228, 0.08)",
          borderRadius: 20,
          padding: "20px 20px 16px",
          color: "#F7EFE4",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "rgba(247, 239, 228, 0.78)",
          }}
        >
          {body}
        </p>
        {error ? (
          <p
            data-nex-vault-contact-confirm-error
            style={{
              margin: "10px 0 0",
              fontSize: 12.5,
              color: "#FFB4C0",
            }}
          >
            {error}
          </p>
        ) : null}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            data-nex-vault-contact-confirm-cancel
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid rgba(247, 239, 228, 0.14)",
              background: "transparent",
              color: "#F7EFE4",
              font: "inherit",
              fontSize: 13,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            data-nex-vault-contact-confirm-confirm
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              background: "#FF8A2A",
              color: "#1A1300",
              font: "inherit",
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? workingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
