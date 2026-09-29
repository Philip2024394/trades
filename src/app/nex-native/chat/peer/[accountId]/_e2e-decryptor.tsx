"use client";

// src/app/nex-native/chat/peer/[accountId]/_e2e-decryptor.tsx
//
// Bridge 76 · Client-side decrypt of encrypted peer messages.
// -----------------------------------------------------------
// Scans the DOM on mount + on route-change for message bubbles
// carrying `data-nex-msg-encrypted="true"`, extracts the encryption
// fields from the surrounding data-attributes, decrypts each with
// this device's private key, and replaces the '(encrypted)' body
// text with the plaintext.
//
// Also drops bubbles addressed to a DIFFERENT device — those are
// fan-out siblings (see Bridge 76 migration 093) that this device
// can't read. Sibling on the same message_group_id addressed to
// this device carries the same plaintext; showing both would render
// the same message twice.
//
// DOM mutation approach was chosen over React state because:
//   · The shell is a large existing component we don't want to fork.
//   · Encryption fields are in data-attributes anyway (server render).
//   · Refresh via router.refresh() cycles the whole tree so state
//     wouldn't survive the round-trip on inbound delivery either.

import * as React from "react";
import {
  decryptEncryptedRows,
  type EncryptedRowInput,
} from "@/lib/nex-native/crypto/encrypted-receive";
import { ensureDeviceKey } from "@/lib/nex-native/crypto/device-key";
import { putMessage } from "@/lib/nex-native/crypto/message-store";
import {
  fetchAndDecryptAttachment,
  isAttachmentEnvelope,
  type AttachmentEnvelope,
} from "@/lib/nex-native/crypto/attachment-envelope";

export interface E2eDecryptorProps {
  conversationId: string;
  disabled?: boolean;
}

export function E2eDecryptor(props: E2eDecryptorProps): null {
  React.useEffect(() => {
    if (props.disabled) return;

    let cancelled = false;
    const runOnce = async () => {
      const dev = await ensureDeviceKey();
      if (cancelled) return;

      const nodes = document.querySelectorAll<HTMLElement>(
        '[data-nex-msg-encrypted="true"]',
      );
      if (nodes.length === 0) return;

      const rows: Array<EncryptedRowInput & { node: HTMLElement }> = [];
      const dropForWrongDevice: HTMLElement[] = [];

      for (const node of Array.from(nodes)) {
        const recipientDev = node.dataset.nexMsgRecipientDev;
        // Fast pre-filter — nothing we can do about rows for other devices.
        if (recipientDev && recipientDev !== dev.deviceId) {
          dropForWrongDevice.push(node);
          continue;
        }
        const id = node.dataset.nexMsgId;
        const ct = node.dataset.nexMsgCt;
        const nonce = node.dataset.nexMsgNonce;
        const senderPub = node.dataset.nexMsgSenderPub;
        const senderDev = node.dataset.nexMsgSenderDev;
        const senderAcc = node.dataset.nexMsgSenderAcc;
        if (!id || !ct || !nonce || !senderPub || !senderDev || !senderAcc || !recipientDev) {
          continue;
        }
        rows.push({
          id,
          senderAccountId: senderAcc,
          senderDeviceId: senderDev,
          senderPublicKey: senderPub,
          recipientDeviceId: recipientDev,
          ciphertextB64: ct,
          nonceB64: nonce,
          node,
        });
      }

      // Drop wrong-device siblings from view (visually collapse) so
      // the reader doesn't see one copy per fan-out device.
      for (const node of dropForWrongDevice) {
        // Walk up to the outermost message-row wrapper (the fragment
        // sibling of MessageBubbleClient) and hide it. The bubble
        // itself carries data-nex-bloom-msg; its wrapper is the
        // React.Fragment container which has no DOM. Simplest: hide
        // the bubble node itself + its adjacent reaction row.
        const wrapper = node.closest("div") as HTMLElement | null;
        if (wrapper) wrapper.style.display = "none";
      }

      if (rows.length === 0) return;

      const results = await decryptEncryptedRows(
        rows.map(({ node: _n, ...r }) => r),
      );
      if (cancelled) return;

      for (const r of results) {
        const match = rows.find((x) => x.id === r.id);
        if (!match) continue;
        const bodyEl = document.querySelector<HTMLElement>(
          `[data-nex-msg-body="${cssEscape(r.id)}"]`,
        );
        if (!bodyEl) continue;
        if (r.ok) {
          bodyEl.textContent = r.plaintext;
          match.node.setAttribute("data-nex-msg-decrypted", "true");
          // Fire delivered-ack (fire-and-forget) so Bridge 78 can prune.
          void fetch("/api/nex-native/peer-message/delivered", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: r.id }),
          }).catch(() => { /* silent · purge is best-effort */ });
          // Bridge 77 · cache decrypted plaintext to IDB so the message
          // survives the Bridge 78 server purge · fire-and-forget.
          const sentAt = match.node.getAttribute("data-nex-msg-sent-at") ?? "";
          void putMessage({
            id: r.id,
            conversation_id: props.conversationId,
            sender_account_id: match.senderAccountId,
            body: r.plaintext,
            sent_at: sentAt || new Date().toISOString(),
            from_encrypted: true,
          }).catch(() => { /* silent · cache is best-effort */ });
        } else if (r.error === "tamper") {
          bodyEl.textContent = "🔒 Could not verify this message";
          bodyEl.style.opacity = "0.55";
          bodyEl.style.fontStyle = "italic";
        }
      }
    };

    // Also process encrypted attachments (Bridge 81) · these have a
    // `[data-nex-encrypted-attach]` placeholder that we replace with
    // the decrypted media element.
    const decryptedAttachIds = new Set<string>();
    const runAttachmentsOnce = async () => {
      const dev = await ensureDeviceKey();
      if (cancelled) return;
      const nodes = document.querySelectorAll<HTMLElement>(
        "[data-nex-encrypted-attach]",
      );
      for (const node of Array.from(nodes)) {
        const raw = node.dataset.nexEncryptedAttach;
        const kind = node.dataset.nexEncryptedAttachKind;
        const senderId = node.dataset.nexEncryptedAttachSender;
        if (!raw || !kind || !senderId) continue;
        const nodeKey = `${senderId}:${raw.slice(0, 32)}`;
        if (decryptedAttachIds.has(nodeKey)) continue;
        decryptedAttachIds.add(nodeKey);
        try {
          const envelope = JSON.parse(atob(raw)) as AttachmentEnvelope;
          if (!isAttachmentEnvelope(envelope)) continue;
          const result = await fetchAndDecryptAttachment(envelope, dev, senderId);
          if (cancelled) return;
          if (!result) {
            node.textContent = "🔒 Can't decrypt · wrong device or removed";
            continue;
          }
          const blob = new Blob([new Uint8Array(result.bytes)], {
            type: result.contentType,
          });
          const url = URL.createObjectURL(blob);
          replaceAttachmentPlaceholder(node, kind, url);
        } catch {
          decryptedAttachIds.delete(nodeKey); // allow retry
        }
      }
    };

    // Run once on mount, then on every DOM mutation that adds bubbles.
    void runOnce();
    void runAttachmentsOnce();
    const obs = new MutationObserver(() => {
      void runOnce();
      void runAttachmentsOnce();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [props.disabled, props.conversationId]);

  return null;
}

/** Minimal CSS.escape polyfill for older Safari. Modern browsers have
 *  it built in but we don't need any of its edge cases · we only pass
 *  UUID v4 strings, so escape the characters that would break the
 *  attribute selector. */
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(s);
  }
  return s.replace(/["\\]/g, "\\$&");
}

/** Replace the placeholder div with an img/video/audio element
 *  pointing at the blob URL. Element choice matches the sender's
 *  attachment kind. */
function replaceAttachmentPlaceholder(
  node: HTMLElement,
  kind: string,
  blobUrl: string,
): void {
  // Reuse the placeholder's parent slot · replace its inner content.
  node.innerHTML = "";
  node.removeAttribute("style");
  node.style.borderRadius = "12px";
  node.style.overflow = "hidden";
  node.style.background = "#000";
  let el: HTMLElement;
  if (kind === "video") {
    const v = document.createElement("video");
    v.src = blobUrl;
    v.controls = true;
    v.playsInline = true;
    v.style.width = "100%";
    v.style.display = "block";
    el = v;
  } else if (kind === "audio") {
    const a = document.createElement("audio");
    a.src = blobUrl;
    a.controls = true;
    a.style.width = "100%";
    a.style.display = "block";
    el = a;
  } else {
    const img = document.createElement("img");
    img.src = blobUrl;
    img.alt = "";
    img.style.width = "100%";
    img.style.display = "block";
    img.decoding = "async";
    el = img;
  }
  node.appendChild(el);
  node.setAttribute("data-nex-encrypted-attach-decrypted", "true");
}
