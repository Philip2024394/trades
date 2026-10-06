// src/lib/nex-native/vault/client/vault-session.ts
//
// Vault Phase A · Commit A.3b · tab-scoped VMK memory singleton.
//
// Holds the unwrapped Vault Master Key for the lifetime of the browser
// tab. Never persisted to localStorage · sessionStorage · cookies ·
// URL · or server-side session data. Zeroises the backing bytes on
// lock (best-effort scrubbing · GC may still hold copies, documented
// in the honest-limits disclaimer).
//
// This file is CLIENT ONLY · intentionally has no `import "server-only"`
// so client components can bind to it, but it is only ever meaningful
// in a browser context (module-scoped `let` lives on the tab).
//
// Design cross-reference:
//   §G lock lifecycle · §J data-flow (CLIENT · Memory while unlocked)

"use client";

import { useEffect, useState } from "react";
import { zeroiseBuffer } from "../key-hierarchy";

interface VaultMemoryState {
  vmk: Uint8Array | null;
  unlockedAt: number | null; // epoch ms
}

const state: VaultMemoryState = { vmk: null, unlockedAt: null };
const listeners = new Set<() => void>();

/** Register a listener and return an unsubscribe. */
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

/** Set the current VMK · zeroises any prior buffer before overwriting. */
export function installVmk(bytes: Uint8Array): void {
  if (state.vmk) {
    zeroiseBuffer(state.vmk);
  }
  // Copy to a fresh buffer so the caller's reference can also be
  // zeroised independently.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  state.vmk = copy;
  state.unlockedAt = Date.now();
  notify();
}

/** Clear VMK and zeroise the backing bytes. Idempotent. */
export function clearVmk(): void {
  if (state.vmk) {
    zeroiseBuffer(state.vmk);
    state.vmk = null;
  }
  state.unlockedAt = null;
  notify();
}

/** Snapshot current state (does not expose the VMK bytes). */
export function readVaultSessionSnapshot(): {
  unlocked: boolean;
  unlockedAt: number | null;
} {
  return { unlocked: state.vmk !== null, unlockedAt: state.unlockedAt };
}

/**
 * Access the VMK ONLY to perform a cryptographic operation locally.
 * The callback receives the raw bytes; the function returns the
 * callback's result. The VMK reference stays scoped to this closure
 * so no code path can leak it unintentionally. If Vault is locked
 * when called, the callback is NOT invoked and this returns null.
 */
export function withVmk<T>(fn: (vmk: Uint8Array) => T | Promise<T>): T | Promise<T> | null {
  if (!state.vmk) return null;
  return fn(state.vmk);
}

/** React hook · subscribes to lock/unlock transitions. Returns a
 *  snapshot without ever exposing the VMK itself. */
export function useVaultSession(): {
  unlocked: boolean;
  unlockedAt: number | null;
} {
  const [snap, setSnap] = useState(() => readVaultSessionSnapshot());
  useEffect(() => {
    return subscribe(() => setSnap(readVaultSessionSnapshot()));
  }, []);
  return snap;
}

/** Install an idle-timer that locks after `idleMs` of no activity.
 *  Also locks after visibilitychange → hidden for `hiddenGraceMs`.
 *  Returns a teardown. Call once from a top-level client provider. */
export function startVaultIdleGuard(options: {
  idleMs?: number;
  hiddenGraceMs?: number;
} = {}): () => void {
  if (typeof window === "undefined") return () => undefined;
  const idleMs = options.idleMs ?? 300_000; // 5 min per §G
  const hiddenGraceMs = options.hiddenGraceMs ?? 60_000;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (readVaultSessionSnapshot().unlocked) clearVmk();
    }, idleMs);
  };
  const onVisibility = () => {
    if (document.hidden) {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(() => {
        if (readVaultSessionSnapshot().unlocked) clearVmk();
      }, hiddenGraceMs);
    } else if (hiddenTimer) {
      clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
  };

  const activityEvents = [
    "pointerdown",
    "keydown",
    "scroll",
    "touchstart",
  ] as const;
  for (const ev of activityEvents) {
    window.addEventListener(ev, resetIdle, { passive: true });
  }
  document.addEventListener("visibilitychange", onVisibility);
  resetIdle();

  return () => {
    for (const ev of activityEvents) {
      window.removeEventListener(ev, resetIdle);
    }
    document.removeEventListener("visibilitychange", onVisibility);
    if (idleTimer) clearTimeout(idleTimer);
    if (hiddenTimer) clearTimeout(hiddenTimer);
  };
}
