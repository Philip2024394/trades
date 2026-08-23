// NEX identity · client-side profile hook.
//
// Backs the first-time onboarding gate (see pinned
// `project_nex_first_time_identity_onboarding_2026_08_21`) AND the
// pinned `project_nex_user_identity_id_model_2026_08_21` two-ID model.
//
// Schema (localStorage["nex.identity"]):
//   internalId     — UUID v4 · PRIVATE · never exposed to any UI/URL/API
//   publicNexId    — shareable · format NEX-XXXX-XXXX · Crockford Base32
//   name           — display name
//   countryCode    — ISO 3166-1 alpha-2
//   country        — human name (derived from picker)
//   phoneNumber    — E.164 canonical · PRIVATE · never the public identifier
//   conversationLanguage — initial hint from country · adapts from speech
//
// V1: localStorage-only (single device). Priority 4+ NEX Listings will
// lift this to a server-backed account keyed by `internalId` (Postgres PK)
// with `publicNexId` as an indexed unique column and `phoneNumber` in a
// private column with its own row-level policy.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { NexVoiceLanguage } from "@/lib/nex-voice";
import { generateInternalId, generatePublicNexId } from "./nexId";

const STORAGE_KEY = "nex.identity";
// Schema version bumps whenever we add or change fields in NexIdentity.
// Hydration path knows how to upgrade older versions in place.
//   v1 = name/country/phone/language only
//   v2 = adds internalId + publicNexId (2026-08-21)
const SCHEMA_VERSION = 2;

export type NexIdentity = {
  schemaVersion: number;
  /** PRIVATE account PK · UUID v4 · never exposed to any user-visible surface. */
  internalId: string;
  /** Shareable NEX ID · format NEX-XXXX-XXXX · safe to speak/share/print. */
  publicNexId: string;
  name: string;
  countryCode: string;                // ISO 3166-1 alpha-2
  country: string;                    // Human name (derived from picker)
  phoneNumber: string;                // E.164 canonical · PRIVATE
  conversationLanguage: NexVoiceLanguage;
  createdAt: string;                  // ISO timestamp
};

/** Fields the onboarding form supplies · IDs are added by the hook. */
export type NexIdentityInput = Pick<
  NexIdentity,
  "name" | "countryCode" | "country" | "phoneNumber" | "conversationLanguage"
>;

type IdentityState =
  | { status: "loading" }
  | { status: "onboarding" }
  | { status: "ready"; identity: NexIdentity };

/** Read + upgrade the stored identity if it's an older schema version. */
function readStored(): NexIdentity | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NexIdentity> | null;
    if (!parsed) return null;
    if (!parsed.name || !parsed.phoneNumber || !parsed.countryCode) return null;

    // v1 → v2 upgrade: if an older record is missing the IDs, generate
    // and re-persist. Preserves account continuity for anyone who
    // completed onboarding before the two-ID model landed.
    if (!parsed.internalId || !parsed.publicNexId || (parsed.schemaVersion ?? 0) < SCHEMA_VERSION) {
      const upgraded: NexIdentity = {
        schemaVersion: SCHEMA_VERSION,
        internalId: parsed.internalId || generateInternalId(),
        publicNexId: parsed.publicNexId || generatePublicNexId(),
        name: parsed.name,
        countryCode: parsed.countryCode,
        country: parsed.country ?? "",
        phoneNumber: parsed.phoneNumber,
        conversationLanguage: (parsed.conversationLanguage as NexVoiceLanguage) ?? "en",
        createdAt: parsed.createdAt ?? new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
      } catch {
        // eslint-disable-next-line no-console
        console.warn("[nex-identity] localStorage upgrade write failed · in-memory only");
      }
      return upgraded;
    }
    return parsed as NexIdentity;
  } catch {
    return null;
  }
}

export function useNexIdentity() {
  const [state, setState] = useState<IdentityState>({ status: "loading" });

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stored = readStored();
    setState(stored ? { status: "ready", identity: stored } : { status: "onboarding" });
  }, []);

  /**
   * Complete onboarding. The form supplies user-provided fields; this
   * function generates the two IDs and the createdAt timestamp before
   * persisting. Never accept a caller-supplied internalId or publicNexId
   * — those are always generated here so they can never be spoofed.
   */
  const save = useCallback((input: NexIdentityInput) => {
    const full: NexIdentity = {
      schemaVersion: SCHEMA_VERSION,
      internalId: generateInternalId(),
      publicNexId: generatePublicNexId(),
      name: input.name,
      countryCode: input.countryCode,
      country: input.country,
      phoneNumber: input.phoneNumber,
      conversationLanguage: input.conversationLanguage,
      createdAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    } catch {
      // Storage quota / disabled — non-fatal. In-memory state still promotes
      // the user through onboarding for this session.
      // eslint-disable-next-line no-console
      console.warn("[nex-identity] localStorage write failed · identity in memory only for this session");
    }
    setState({ status: "ready", identity: full });
  }, []);

  const clear = useCallback(() => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    setState({ status: "onboarding" });
  }, []);

  return { state, save, clear };
}
