// NEX activation · client-side state model + persistence.
//
// Distinguishes three onboarding progression states for the NEX device
// (frame · voice · progressive reveal will consume this signal in later
// batches · this file is pure state + persistence only).
//
// Doctrine anchor: `feedback_ship_mode_batch_workflow_2026_08_29`
//   (SHIP MODE · batches · Philip is UX architect · Claude implements
//   exact scope + stops)
//
// States (Philip 2026-08-29 BATCH 4 · "NEX activation" model · replaces
// the earlier "profile complete" idea which had no existing signal):
//
//   dormant     · NEX device has never been entered
//                 · useNexIdentity().status !== "ready"
//                 · no NexIdentity persisted
//                 · frame should read as un-activated
//
//   activating  · identity is captured but NEX has not yet completed its
//                 first-run introduction for this user
//                 · useNexIdentity().status === "ready"
//                 · localStorage["nex.activation"] absent
//                 · frame should read as waking up
//                 · this is where the intro ceremony fires
//                   (voice intro + progressive frame reveal · both are
//                   later batches · NOT built here)
//
//   active      · introduction complete · NEX fully activated for this user
//                 · useNexIdentity().status === "ready"
//                 · localStorage["nex.activation"] present with introducedAt
//                 · frame reads as fully alive
//
// Persistence key: `nex.activation` (parallel to existing `nex.identity`
// + `nex_device_id` localStorage keys). Schema-versioned for future
// forward-compat. NO database migration, NO server-side state, NO
// provider profile involvement, NO wallet involvement.
//
// Consumers (future batches):
//   · frameLights derivation function → maps NexActivationState → frameMode
//   · voice intro ceremony → gates on state === "activating"
//   · progressive light reveal → sequences during state === "activating"

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNexIdentity, type NexIdentity } from "./useNexIdentity";

const STORAGE_KEY = "nex.activation";
const SCHEMA_VERSION = 1;

/**
 * Grandfather cutoff · Philip 2026-08-29 · STEP 2.
 *
 * Deterministic ISO timestamp representing when the NEX activation system
 * shipped. Any nex.identity whose createdAt is BEFORE this cutoff was
 * created before the activation ceremony existed · those users must NOT
 * unexpectedly receive the first-run introduction. They are silently
 * marked as active on first hydration under this hook.
 *
 * New identities created AFTER this cutoff continue to behave as designed:
 *   identity ready + no nex.activation → "activating".
 *
 * String comparison of ISO 8601 timestamps matches chronological order
 * (safe · no Date parsing required).
 */
export const ACTIVATION_SYSTEM_CUTOFF_ISO = "2026-08-29T12:00:00Z";

/** Pure helper · true when this identity predates the activation system. */
function isGrandfathered(identity: NexIdentity): boolean {
  return identity.createdAt < ACTIVATION_SYSTEM_CUTOFF_ISO;
}

export type NexActivationState = "dormant" | "activating" | "active";

export interface NexActivation {
  schemaVersion: number;
  /** ISO timestamp · when the introduction ceremony completed. */
  introducedAt: string;
}

function readStored(): NexActivation | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NexActivation> | null;
    if (!parsed || !parsed.introducedAt) return null;
    return parsed as NexActivation;
  } catch {
    return null;
  }
}

export interface UseNexActivationReturn {
  /** Derived activation state. See top-of-file for semantics. */
  state: NexActivationState;
  /**
   * True while either useNexIdentity or the activation-flag localStorage
   * read is still hydrating. Consumers MUST respect this to avoid a brief
   * dormant-flash for existing activated users during the first render.
   */
  isLoading: boolean;
  /**
   * Full persisted activation record when present · null when the user
   * has not yet completed the introduction. Consumers rarely need this
   * directly · the `state` derivation is the primary API.
   */
  activation: NexActivation | null;
  /**
   * Mark the introduction ceremony as complete. Persists to localStorage
   * and transitions state from "activating" → "active". Idempotent · safe
   * to call multiple times (subsequent calls simply refresh the
   * introducedAt timestamp · not exposed as a bug because introducedAt
   * is informational, not gating).
   */
  markIntroduced: () => void;
  /**
   * Clear the activation record · used by dev/test surfaces to re-simulate
   * first-run behavior. Does NOT clear the underlying NexIdentity.
   */
  reset: () => void;
}

/**
 * useNexActivation · derives the NEX activation state from identity +
 * a small persisted flag. Safe to call from any client component.
 */
export function useNexActivation(): UseNexActivationReturn {
  const { state: identityState } = useNexIdentity();

  const [activationHydrated, setActivationHydrated] = useState(false);
  const [activation, setActivation] = useState<NexActivation | null>(null);

  // Hydrate the activation flag from localStorage on mount.
  useEffect(() => {
    setActivation(readStored());
    setActivationHydrated(true);
  }, []);

  const markIntroduced = useCallback(() => {
    const record: NexActivation = {
      schemaVersion: SCHEMA_VERSION,
      introducedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Storage quota / disabled — non-fatal · in-memory state still
      // transitions the user through activation for this session.
      // eslint-disable-next-line no-console
      console.warn("[nex-activation] localStorage write failed · in-memory only for this session");
    }
    setActivation(record);
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setActivation(null);
  }, []);

  // Grandfather effect · Philip 2026-08-29 · STEP 2.
  // On first hydration where identity is ready AND activation is absent,
  // check if this identity predates the activation-system cutoff. If so,
  // silently mark introduced so the user is treated as "active" without
  // ever seeing the first-run ceremony.
  //
  // Runs at most ONCE per hook instance (guarded by grandfatherCheckedRef).
  // Once marker is persisted, subsequent hydrations skip the check because
  // activation is present.
  const grandfatherCheckedRef = useRef(false);
  useEffect(() => {
    if (grandfatherCheckedRef.current) return;
    if (identityState.status === "loading" || !activationHydrated) return;
    grandfatherCheckedRef.current = true;
    if (identityState.status !== "ready") return;
    if (activation) return;
    if (isGrandfathered(identityState.identity)) {
      markIntroduced();
    }
  }, [identityState, activationHydrated, activation, markIntroduced]);

  const isLoading =
    identityState.status === "loading" || !activationHydrated;

  // State derivation · pure function of the two hydrated signals.
  // Returns "dormant" during isLoading; consumers must gate on isLoading
  // to avoid rendering a stale visual for an already-activated user
  // during the first-render window.
  const state: NexActivationState = (() => {
    if (isLoading) return "dormant";
    if (identityState.status !== "ready") return "dormant";
    if (!activation) return "activating";
    return "active";
  })();

  return { state, isLoading, activation, markIntroduced, reset };
}
