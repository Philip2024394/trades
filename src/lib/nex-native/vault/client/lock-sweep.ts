// src/lib/nex-native/vault/client/lock-sweep.ts
//
// Vault Phase B · Commit B.6A · global cross-tab Vault-lock signal.
//
// Problem it solves:
//   Each Vault surface (Vault Home · Vault chat · Vault Settings)
//   mounts in its own React tree. The sealed Phase A vault-session
//   singleton is per-tab · one browser tab's `clearVmk` call does not
//   lock another tab's Vault. Alice could unlock Vault in tab A, open
//   tab B on the same account (also unlocked via server freshness
//   window), then explicitly lock in A · tab B would still see
//   decrypted plaintext until its own idle timer fired or Alice hit
//   the lock button there too.
//
// Doctrine:
//   · The cross-tab signal is a BROADCAST-ONLY LOCK SIGNAL. It carries
//     exactly {type: "lock", at: epoch_ms}. Nothing else. Never VMK ·
//     never K_c · never plaintext · never PIN · never recovery
//     material · never any key or envelope.
//   · The receiver's handler calls the sealed primitives:
//       - clearVmk() from vault-session (Phase A sealed)
//       - clearInMemoryConversationKeys() from conversation-key (B.3)
//     and nothing else. The receiver does not transmit anything back ·
//     the signal is one-way.
//   · No new VMK store. No second lock state. The sealed vault-session
//     snapshot remains the authoritative read.
//
// Explicit non-goals (sealed into this file by the founder's B.6A
// scope):
//   · This module does NOT implement realtime message delivery.
//   · This module does NOT implement push notifications.
//   · This module does NOT subscribe to postgres_changes.
//   · This module does NOT fetch, decrypt, or render any Vault content.
//
// Browser support: BroadcastChannel is standard in all evergreen
// browsers from 2022+ (Safari 15.4+, Chrome 54+, Firefox 38+). If the
// API is unavailable at runtime we silently no-op · the per-tab
// vault-session guard still fires locally on any explicit lock.

"use client";

import {
  clearVmk,
  readVaultSessionSnapshot,
} from "./vault-session";
import { clearInMemoryConversationKeys } from "./conversation-key";

/** Opaque channel name. Anything on this channel is treated as a lock
 *  signal · the payload shape is {type:"lock", at:number}. We do NOT
 *  version the channel name · a schema change would require a new
 *  channel name to avoid cross-version replay. */
const CHANNEL_NAME = "nex-vault-lock-signal/v1";

type LockMessage = { type: "lock"; at: number };

let channel: BroadcastChannel | null = null;
let installed = false;

function openChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

/**
 * Install the cross-tab lock receiver for this tab. Idempotent · safe
 * to call once per Vault surface mount. The receiver:
 *   · listens for {type:"lock"} on the BroadcastChannel
 *   · on receive, calls clearVmk() + clearInMemoryConversationKeys()
 *   · never transmits anything back · one-way sink
 *
 * Returns a teardown function. In practice we leave the receiver
 * installed for the tab's lifetime because the sealed Phase A idle
 * guard already runs for the tab's lifetime.
 */
export function installCrossTabLockReceiver(): () => void {
  if (installed) return () => undefined;
  const ch = openChannel();
  if (!ch) return () => undefined;
  installed = true;

  const handler = (ev: MessageEvent) => {
    const data = ev.data as unknown;
    if (!isLockMessage(data)) return;
    // Side-effect only · zeroise VMK and K_c for this tab. Do NOT
    // broadcast back · that would cause a feedback loop between tabs.
    try {
      clearVmk();
      clearInMemoryConversationKeys();
    } catch {
      // best-effort · never throw from a message handler
    }
  };
  ch.addEventListener("message", handler);

  return () => {
    try {
      ch.removeEventListener("message", handler);
    } catch {
      // ignore
    }
    installed = false;
  };
}

/**
 * Broadcast a lock event to every other tab subscribed to this
 * origin's Vault lock channel. The CURRENT tab does NOT call this on
 * its own locally-triggered lock · the local call site already called
 * clearVmk() + clearInMemoryConversationKeys() · the broadcast only
 * notifies PEER tabs that may still be holding decrypted state.
 *
 * Safe to call even if the receiver has not been installed in this
 * tab · the broadcast fires to every subscribed tab, which may or may
 * not include this one depending on when the local handler ran.
 */
export function broadcastLockSignal(): void {
  const ch = openChannel();
  if (!ch) return;
  const msg: LockMessage = { type: "lock", at: Date.now() };
  try {
    ch.postMessage(msg);
  } catch {
    // ignore · broadcast is best-effort
  }
}

/**
 * One-shot helper for Vault surfaces that want the sealed "lock
 * everywhere" behaviour. Calls the local sealed primitives THEN
 * broadcasts to other tabs. Idempotent · a second call while already
 * locked is a no-op (clearVmk is idempotent · the broadcast is cheap).
 */
export function lockVaultEverywhere(): void {
  try {
    clearVmk();
    clearInMemoryConversationKeys();
  } finally {
    broadcastLockSignal();
  }
}

/**
 * Hook-friendly helper · returns the current snapshot without any
 * cross-tab coordination. Exposed only to keep imports clean when a
 * component wants to decide render based on vault state AND also mount
 * the receiver. The caller still consults readVaultSessionSnapshot
 * directly for authoritative state.
 */
export function readVaultSnapshotForLockSweep(): ReturnType<
  typeof readVaultSessionSnapshot
> {
  return readVaultSessionSnapshot();
}

function isLockMessage(data: unknown): data is LockMessage {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { type?: unknown }).type === "lock"
  );
}
