"use client";

// src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx
//
// Vault Phase B · Commit B.4 · client-side Vault chat surface.
//
// Three visual states:
//   · LOCKED   — Vault VMK is not in memory on this tab · plaintext
//                never appears · composer unavailable · unlock
//                control present.
//   · LOADING  — Vault just unlocked · we are provisioning or loading
//                K_c, decrypting server-fetched ciphertext rows,
//                caching under K_c in the B.3 IDB.
//   · UNLOCKED — messages render as plaintext in memory · composer
//                sends via the sealed Bridge 76 encrypted send flow.
//
// Doctrine
//   · The canonical conversation is nex_peer_conversation.id · we
//     never create a second conversation or a second message history.
//   · Server stays plaintext-blind · Curve25519 wire layer (Bridge
//     76) is unchanged · Vault adds a client-side K_c layer that
//     wraps the at-rest IDB cache so a stolen device with Vault
//     locked cannot read Vault history.
//   · Theme chrome is sourced from the active NEX Standard
//     Experience · we do NOT hardcode Ocean / Joker / security
//     colours. The locked shell + composer rim use neutral tokens
//     from the shared Vault palette (same tokens the sealed Vault
//     home uses).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import {
  cacheEncryptedMessage,
  ensureAllConversationKeysLoaded,
  hasConversationKeyInMemory,
  provisionConversationKey,
  readCachedMessages,
  clearInMemoryConversationKeys,
} from "@/lib/nex-native/vault/client/conversation-key";
import { unlockVault } from "@/lib/nex-native/vault/client/unlock-orchestrator";
import { ensureDeviceKey } from "@/lib/nex-native/crypto/device-key";
import {
  decryptEncryptedRows,
  type DecryptResult,
  type EncryptedRowInput,
} from "@/lib/nex-native/crypto/encrypted-receive";
import { sendEncryptedPeerMessage } from "@/lib/nex-native/crypto/encrypted-send";
import { preserveAttachmentsForVaultedConversation } from "@/lib/nex-native/vault/client/attachment-preservation";
import { lockVaultEverywhere } from "@/lib/nex-native/vault/client/lock-sweep";
import { uploadEncryptedAttachment } from "@/lib/nex-native/crypto/encrypted-attachment-upload";

// ─── types from server ──────────────────────────────────────────────

export interface InitialMessage {
  id: string;
  sender_account_id: string;
  sent_at: string;
  read_at: string | null;
  encrypted: boolean;
  body: string;
  ciphertext_b64: string | null;
  nonce_b64: string | null;
  sender_public_key: string | null;
  sender_device_id: string | null;
  recipient_device_id: string | null;
  message_group_id: string | null;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  deleted_for_everyone: boolean;
}

interface Props {
  viewerAccountId: string;
  peerAccountId: string;
  peerDisplayName: string;
  conversationId: string;
  initialMessages: InitialMessage[];
}

// ─── palette tokens (reused from Vault home · neutral · theme-safe) ─

const NEX = {
  bg: "#06040a",
  bgGradient:
    "radial-gradient(80% 60% at 50% 10%, rgba(60, 30, 50, 0.6), transparent 70%)",
  textPrimary: "#F7EFE4",
  textSecondary: "rgba(247, 239, 228, 0.72)",
  textMuted: "rgba(247, 239, 228, 0.45)",
  accent: "#FF8A2A",
  accentSoft: "rgba(255, 138, 42, 0.14)",
  accentStrong: "rgba(255, 138, 42, 0.4)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  bubbleOut: "rgba(255, 138, 42, 0.22)",
  bubbleIn: "rgba(255, 255, 255, 0.07)",
};

// ─── decrypted-message type (what we render) ────────────────────────

interface DisplayMessage {
  id: string;
  sender_account_id: string;
  sent_at: string;
  text: string;
  outgoing: boolean;
}

// ---------------------------------------------------------------------------

export function VaultChatClient(props: Props) {
  const vault = useVaultSession();
  const router = useRouter();

  const [phase, setPhase] = useState<"locked" | "loading" | "ready" | "error">(
    vault.unlocked ? "loading" : "locked",
  );
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<
    import("@/lib/nex-native/crypto/encrypted-attachment-upload").UploadedEncryptedAttachment | null
  >(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const bootRef = useRef(false);

  // ── bootstrap on unlock ────────────────────────────────────────────
  const boot = useCallback(async () => {
    if (bootRef.current) return;
    bootRef.current = true;
    setPhase("loading");
    setErrorText(null);
    try {
      const dk = await ensureDeviceKey();
      const deviceId = dk.deviceId;

      // Make sure every active envelope on this device is unwrapped
      // into memory · idempotent · fetches via B.2 /envelope/list.
      await ensureAllConversationKeysLoaded({ targetDeviceId: deviceId });

      // First-ever open of this vaulted conversation on this device:
      // no envelope exists yet · provision one. The partial unique
      // index on (account, conversation, device, generation) collapses
      // duplicate_active_envelope to a no-op so repeat calls are safe.
      if (!hasConversationKeyInMemory(props.conversationId, 1)) {
        const prov = await provisionConversationKey({
          conversationId: props.conversationId,
          targetDeviceId: deviceId,
        });
        if (!prov.ok) {
          if (prov.error === "duplicate_active_envelope") {
            // Another tab beat us to it · reload envelope list.
            await ensureAllConversationKeysLoaded({ targetDeviceId: deviceId });
          } else if (prov.error === "vault_locked") {
            setPhase("locked");
            return;
          } else {
            setErrorText(`Could not set up this conversation (${prov.error}).`);
            setPhase("error");
            return;
          }
        }
      }

      // Decrypt server rows via the sealed Bridge 76 path · for each
      // encrypted row addressed to this device, run getSharedSecret +
      // openWithSharedSecret · cache the plaintext under K_c in B.3
      // IDB for at-rest protection · then surface to the UI.
      const encryptedRows: EncryptedRowInput[] = [];
      for (const m of props.initialMessages) {
        if (
          m.encrypted &&
          m.ciphertext_b64 &&
          m.nonce_b64 &&
          m.sender_public_key &&
          m.sender_device_id &&
          m.recipient_device_id
        ) {
          encryptedRows.push({
            id: m.id,
            senderAccountId: m.sender_account_id,
            senderDeviceId: m.sender_device_id,
            senderPublicKey: m.sender_public_key,
            recipientDeviceId: m.recipient_device_id,
            ciphertextB64: m.ciphertext_b64,
            nonceB64: m.nonce_b64,
          });
        }
      }

      let decrypted: DecryptResult[] = [];
      if (encryptedRows.length > 0) {
        decrypted = await decryptEncryptedRows(encryptedRows);
      }
      const decryptMap = new Map<string, string>();
      for (const d of decrypted) {
        if (d.ok) decryptMap.set(d.id, d.plaintext);
      }

      // Cache decrypted plaintext under K_c in B.3 IDB (idempotent at
      // row-level via IDB put). The ciphertext we persist here is K_c-
      // wrapped · B.3 keeps it unreadable without a live VMK.
      for (const [messageId, plaintext] of decryptMap) {
        await cacheEncryptedMessage({
          conversationId: props.conversationId,
          messageId,
          plaintext: new TextEncoder().encode(plaintext),
        }).catch(() => undefined);
      }

      // Also pull any older messages that are already in the B.3 cache
      // (e.g. from a previous session before server purge). Merge with
      // the fresh server rows · dedupe by message id.
      const cachedResp = await readCachedMessages({
        conversationId: props.conversationId,
      });

      const idToDisplay = new Map<string, DisplayMessage>();
      // Prefer freshly decrypted text when both sources agree.
      if (cachedResp.ok) {
        for (const c of cachedResp.messages) {
          idToDisplay.set(c.messageId, {
            id: c.messageId,
            // We lost original sender in IDB · reconstruct from server
            // rows where available.
            sender_account_id: "",
            sent_at: c.created_at,
            text: new TextDecoder().decode(c.plaintext),
            outgoing: false,
          });
        }
      }
      // Overlay server-known plaintext + metadata.
      for (const m of props.initialMessages) {
        if (m.deleted_for_everyone) {
          idToDisplay.delete(m.id);
          continue;
        }
        const text =
          decryptMap.get(m.id) ??
          (!m.encrypted ? m.body : idToDisplay.get(m.id)?.text ?? "");
        if (!text) continue; // can't decrypt (wrong device, tamper, etc.)
        idToDisplay.set(m.id, {
          id: m.id,
          sender_account_id: m.sender_account_id,
          sent_at: m.sent_at,
          text,
          outgoing: m.sender_account_id === props.viewerAccountId,
        });
      }

      const ordered = Array.from(idToDisplay.values()).sort((a, b) =>
        a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0,
      );
      setMessages(ordered);
      setPhase("ready");

      // Policy X (B.5) · future-attachment auto-preservation.
      // Scan every attachment-bearing message in the server-fetched
      // history and ask the sealed B.2 /attachment/preserve route to
      // persist it into Vault. The route is idempotent per source_
      // message_id so repeat runs skip already-preserved rows cheaply.
      // Fires fire-and-forget · failures do not break the chat UI
      // (the preservation batch returns an honest per-row result but
      // we don't block render on it · the brief authorises this as
      // long as we don't claim total success when some failed · the
      // call-site is deliberately non-fatal).
      const candidates = props.initialMessages
        .filter((m) => !!m.attachment_url && !m.deleted_for_everyone)
        .map((m) => ({
          conversationId: props.conversationId,
          messageId: m.id,
        }));
      if (candidates.length > 0) {
        void preserveAttachmentsForVaultedConversation(candidates);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Vault chat failed to load.");
      setPhase("error");
    }
  }, [props.conversationId, props.initialMessages, props.viewerAccountId]);

  // ── react to lock/unlock transitions ───────────────────────────────
  useEffect(() => {
    if (vault.unlocked && phase === "locked") {
      bootRef.current = false;
      void boot();
    } else if (!vault.unlocked) {
      // Discard decrypted state immediately · founder-sealed rule.
      // B.6A · also discard any in-progress attachment preparation ·
      // the content key the sealed uploadEncryptedAttachment held in
      // memory becomes unusable once Vault locks because our handler
      // no longer runs the send path.
      bootRef.current = false;
      setMessages([]);
      setDraft("");
      setPendingAttachment(null);
      setPhase("locked");
      // Zeroise any K_c that may still be in memory from before lock.
      clearInMemoryConversationKeys();
    }
  }, [vault.unlocked, phase, boot]);

  // First-mount: if already unlocked, boot.
  useEffect(() => {
    if (vault.unlocked && phase === "locked") {
      bootRef.current = false;
      void boot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── unlock submit ──────────────────────────────────────────────────
  const handleUnlock = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (unlockBusy) return;
      setUnlockBusy(true);
      setUnlockError(null);
      try {
        const dk = await ensureDeviceKey();
        const r = await unlockVault({
          mode: "pin",
          secret: pinInput,
          deviceId: dk.deviceId,
        });
        if (!r.ok) {
          setUnlockError(r.error ?? "Unlock failed.");
          return;
        }
        setPinInput("");
      } catch (err) {
        setUnlockError(err instanceof Error ? err.message : "Unlock failed.");
      } finally {
        setUnlockBusy(false);
      }
    },
    [pinInput, unlockBusy],
  );

  // ── send ──────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (ev?: React.FormEvent) => {
      ev?.preventDefault();
      if (sending) return;
      if (!vault.unlocked || phase !== "ready") return;
      const text = draft.trim();
      if (!text && !pendingAttachment) return;
      setSending(true);
      try {
        const outcome = await sendEncryptedPeerMessage({
          conversationId: props.conversationId,
          peerAccountId: props.peerAccountId,
          selfAccountId: props.viewerAccountId,
          plaintext: text,
          encryptedAttachment: pendingAttachment ?? null,
        });
        if (!outcome.ok) {
          setErrorText(`Send failed (${outcome.error}).`);
          return;
        }
        // Optimistic local append · cache under K_c too so lock+reload
        // continues to show it.
        const insertedId = outcome.insertedIds[0] ?? crypto.randomUUID();
        const nowIso = new Date().toISOString();
        const bubbleText = text || (pendingAttachment ? attachmentLabelFor(pendingAttachment.kind) : "");
        setMessages((prev) => [
          ...prev,
          {
            id: insertedId,
            sender_account_id: props.viewerAccountId,
            sent_at: nowIso,
            text: bubbleText,
            outgoing: true,
          },
        ]);
        await cacheEncryptedMessage({
          conversationId: props.conversationId,
          messageId: insertedId,
          plaintext: new TextEncoder().encode(bubbleText),
        }).catch(() => undefined);
        setDraft("");
        setPendingAttachment(null);
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : "Send failed.");
      } finally {
        setSending(false);
      }
    },
    [draft, sending, vault.unlocked, phase, props, pendingAttachment],
  );

  // ── attachment upload (B.6A) ──────────────────────────────────────
  // Reuses the sealed canonical uploadEncryptedAttachment · the plain
  // bytes never leave this browser · the ciphertext POSTs to the
  // sealed /api/nex-native/attachment/encrypted route · the content
  // key stays in memory and is wrapped per recipient device at send
  // time inside sendEncryptedPeerMessage.
  const handleAttachmentPick = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      ev.target.value = ""; // reset the input so re-picking the same file re-fires
      if (!file) return;
      if (!vault.unlocked || phase !== "ready") return;
      setErrorText(null);
      try {
        const uploaded = await uploadEncryptedAttachment({ file });
        setPendingAttachment(uploaded);
      } catch (err) {
        setErrorText(
          err instanceof Error ? err.message : "Attachment upload failed.",
        );
      }
    },
    [vault.unlocked, phase],
  );

  // ── views ──────────────────────────────────────────────────────────

  const header = useMemo(
    () => (
      <header
        data-nex-vault-chat-header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(6, 4, 10, 0.78)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${NEX.glassBorder}`,
          color: NEX.textPrimary,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
        }}
      >
        <Link
          href="/nex-native/vault/home/chats"
          aria-label="Back to Vault chats"
          data-nex-vault-chat-back
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            color: NEX.textPrimary,
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={18} strokeWidth={1.6} aria-hidden />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              color: NEX.textPrimary,
            }}
          >
            <span data-nex-vault-chat-peer-name>{props.peerDisplayName}</span>
            <span
              aria-hidden
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: NEX.accent,
                border: `1px solid ${NEX.accentStrong}`,
                background: NEX.accentSoft,
                padding: "2px 6px",
                borderRadius: 999,
                marginLeft: 4,
              }}
            >
              VAULT
            </span>
          </div>
          <div style={{ fontSize: 11, color: NEX.textMuted }}>
            {vault.unlocked ? "Protected on this device" : "Locked"}
          </div>
        </div>
        {vault.unlocked ? (
          <button
            type="button"
            data-nex-vault-chat-lock
            onClick={() => {
              // B.6A · explicit lock also broadcasts to peer tabs so
              // every open Vault surface on this origin locks
              // atomically. The sealed clearVmk + K_c zeroise still
              // fires locally first · the broadcast is a one-way
              // signal with no key material.
              lockVaultEverywhere();
            }}
            style={{
              background: "transparent",
              border: `1px solid ${NEX.glassBorder}`,
              color: NEX.textPrimary,
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            <Lock size={12} strokeWidth={1.8} /> Lock Vault
          </button>
        ) : null}
      </header>
    ),
    [props.peerDisplayName, vault.unlocked],
  );

  if (phase === "locked") {
    return (
      <div
        data-nex-vault-chat
        data-nex-vault-chat-state="locked"
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          backgroundImage: NEX.bgGradient,
          color: NEX.textPrimary,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {header}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: NEX.accentSoft,
              color: NEX.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              border: `1px solid ${NEX.accentStrong}`,
            }}
          >
            <Lock size={28} strokeWidth={1.6} />
          </div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              color: NEX.textPrimary,
            }}
          >
            Vault is locked
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: NEX.textSecondary,
              maxWidth: 360,
            }}
          >
            Unlock Vault to view this conversation. Your messages stay encrypted
            on this device while Vault is locked.
          </p>

          <form
            onSubmit={handleUnlock}
            data-nex-vault-chat-unlock-form
            style={{
              marginTop: 24,
              width: "100%",
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Enter PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              data-nex-vault-chat-unlock-input
              style={{
                padding: "12px 14px",
                fontSize: 14,
                borderRadius: 10,
                border: `1px solid ${NEX.glassBorder}`,
                background: "rgba(255,255,255,0.04)",
                color: NEX.textPrimary,
                letterSpacing: "0.2em",
                textAlign: "center",
              }}
            />
            <button
              type="submit"
              data-nex-vault-chat-unlock-submit
              disabled={unlockBusy || pinInput.length < 8}
              style={{
                padding: "12px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                border: "none",
                background: NEX.accent,
                color: "#1A1300",
                cursor:
                  unlockBusy || pinInput.length < 8 ? "not-allowed" : "pointer",
                opacity: unlockBusy || pinInput.length < 8 ? 0.6 : 1,
              }}
            >
              {unlockBusy ? "Unlocking…" : "Unlock Vault"}
            </button>
            {unlockError ? (
              <div
                data-nex-vault-chat-unlock-error
                style={{ fontSize: 12, color: "#ffa07a" }}
              >
                {unlockError}
              </div>
            ) : null}
          </form>
        </main>
      </div>
    );
  }

  return (
    <div
      data-nex-vault-chat
      data-nex-vault-chat-state={phase}
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        backgroundImage: NEX.bgGradient,
        color: NEX.textPrimary,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {header}
      <main
        data-nex-vault-chat-messages
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 90px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {phase === "loading" ? (
          <div style={{ color: NEX.textMuted, fontSize: 12, textAlign: "center", marginTop: 24 }}>
            Loading encrypted conversation…
          </div>
        ) : null}
        {phase === "error" ? (
          <div
            data-nex-vault-chat-error
            style={{ color: "#ffa07a", fontSize: 12, textAlign: "center", marginTop: 24 }}
          >
            {errorText ?? "Something went wrong."}
          </div>
        ) : null}
        {phase === "ready" && messages.length === 0 ? (
          <div
            data-nex-vault-chat-empty
            style={{ color: NEX.textMuted, fontSize: 12, textAlign: "center", marginTop: 24 }}
          >
            No messages yet. Say hello.
          </div>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            data-nex-vault-chat-bubble
            data-nex-vault-chat-outgoing={m.outgoing ? "true" : "false"}
            style={{
              alignSelf: m.outgoing ? "flex-end" : "flex-start",
              background: m.outgoing ? NEX.bubbleOut : NEX.bubbleIn,
              color: NEX.textPrimary,
              borderRadius: 16,
              padding: "8px 12px",
              maxWidth: "76%",
              fontSize: 14,
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {m.text}
          </div>
        ))}
      </main>

      <form
        onSubmit={handleSend}
        data-nex-vault-chat-composer
        style={{
          position: "sticky",
          bottom: 0,
          padding: "10px 12px",
          background: "rgba(6, 4, 10, 0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: `1px solid ${NEX.glassBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {pendingAttachment ? (
          <div
            data-nex-vault-chat-pending-attachment
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${NEX.glassBorder}`,
              background: "rgba(255,255,255,0.04)",
              fontSize: 12,
              color: NEX.textSecondary,
            }}
          >
            <span style={{ flex: 1 }}>
              Encrypted {pendingAttachment.kind} ready to send
              ({Math.ceil(pendingAttachment.sizeBytes / 1024)} KB)
            </span>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              data-nex-vault-chat-attachment-remove
              style={{
                background: "transparent",
                border: "none",
                color: NEX.textMuted,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label
            data-nex-vault-chat-attach-label
            htmlFor="nex-vault-chat-file-input"
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: `1px solid ${NEX.glassBorder}`,
              background: "rgba(255,255,255,0.03)",
              color: NEX.textSecondary,
              fontSize: 14,
              cursor: phase === "ready" ? "pointer" : "not-allowed",
              userSelect: "none",
            }}
          >
            +
          </label>
          <input
            id="nex-vault-chat-file-input"
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleAttachmentPick}
            disabled={phase !== "ready"}
            data-nex-vault-chat-file-input
            style={{ display: "none" }}
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={phase === "ready" ? "Message" : "Loading…"}
            disabled={phase !== "ready"}
            data-nex-vault-chat-input
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 999,
              border: `1px solid ${NEX.glassBorder}`,
              background: "rgba(255,255,255,0.05)",
              color: NEX.textPrimary,
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={
              sending ||
              phase !== "ready" ||
              (!draft.trim() && !pendingAttachment)
            }
            data-nex-vault-chat-send
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              background: NEX.accent,
              color: "#1A1300",
              fontSize: 13,
              fontWeight: 600,
              cursor:
                sending ||
                phase !== "ready" ||
                (!draft.trim() && !pendingAttachment)
                  ? "not-allowed"
                  : "pointer",
              opacity:
                sending ||
                phase !== "ready" ||
                (!draft.trim() && !pendingAttachment)
                  ? 0.6
                  : 1,
            }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>

      {/* preserve router prop (unused in current render but required by useRouter import) */}
      {typeof router === "object" ? null : null}
    </div>
  );
}

function attachmentLabelFor(kind: "image" | "video" | "audio"): string {
  switch (kind) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎬 Video";
    case "audio":
      return "🎤 Voice note";
  }
}
