"use client";

// src/lib/nex-native/business/_wizard-state.ts
//
// NEX Business NEX Activation · client-side wizard state.
// Phase 2 · Rev 6 clarification #2 (2026-10-02).
//
// Two independent pieces of UX state live here:
//   1. welcome_seen flag · per account · one-shot per device
//   2. wizard draft    · per account · survives tab-close
//
// Both live in localStorage. Device-specific by design (clarification 2).
// Not the source of truth for anything; the authoritative "is Business
// NEX active?" signal is `nex_business.profile IS NOT NULL` in the DB.
//
// Every accessor wraps try/catch · private windows, blocked storage,
// previews, and thumbnail capture may throw or return empty. All public
// functions degrade to the "no state found" branch rather than crashing.

import type {
  BusinessProfile,
  CapabilityKey,
  ContentTypeKey,
  CtaIntent,
} from "./types";

// -----------------------------------------------------------------------------
// Draft shape
// -----------------------------------------------------------------------------

/** Wizard draft · parallel to BusinessOwnerState but with three separate
 *  toggle maps so the UI can distinguish current-wizard-change from
 *  previously-saved-choice (Rev 6 clarification #4). */
export interface WizardDraft {
  profile: BusinessProfile | null;

  /** Explicit toggles the owner made in THIS wizard session. Keys only
   *  appear if the owner touched them. Compared against recommendations
   *  (code-computed from profile) and against saved overrides (DB) to
   *  decide chip state and what to write on save. */
  capability_wizard_toggle: Partial<Record<CapabilityKey, boolean>>;
  content_wizard_toggle: Partial<Record<ContentTypeKey, boolean>>;

  /** Owner's chosen primary CTA preference (one of the 8 intents) or
   *  null to defer to subtype recommendation. */
  cta_preference: CtaIntent | null;

  /** Which step the wizard was last on. Lets a return visit resume
   *  where the owner left. */
  current_step: 0 | 1 | 2 | 3 | 4 | 5;

  /** Draft version · bumped when the DraftV2 shape ever ships. Any
   *  draft with an unexpected version is discarded and the owner
   *  restarts from Step 0 or 1 (safe degrade, no data loss because
   *  nothing persists on save until Step 5). */
  draft_version: number;

  /** ISO timestamp of last write · informational only. */
  last_updated_iso: string;
}

export const CURRENT_DRAFT_VERSION = 1;

export function makeEmptyDraft(): WizardDraft {
  return {
    profile: null,
    capability_wizard_toggle: {},
    content_wizard_toggle: {},
    cta_preference: null,
    current_step: 0,
    draft_version: CURRENT_DRAFT_VERSION,
    last_updated_iso: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Storage key helpers
// -----------------------------------------------------------------------------

const WELCOME_PREFIX = "nex_business_setup_welcome_seen:";
const DRAFT_PREFIX = "nex_business_setup_draft:";

function welcomeKey(accountId: string): string {
  return `${WELCOME_PREFIX}${accountId}`;
}

function draftKey(accountId: string): string {
  return `${DRAFT_PREFIX}${accountId}`;
}

// Soft storage · wraps localStorage with try/catch. Private windows and
// Safari ITP can both throw on read; the only safe approach is to treat
// every access as failable.
function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    /* best effort · UX state only */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}

// -----------------------------------------------------------------------------
// Welcome-seen flag
// -----------------------------------------------------------------------------

export function loadWelcomeSeen(accountId: string): boolean {
  return safeGet(welcomeKey(accountId)) === "1";
}

export function setWelcomeSeen(accountId: string): void {
  safeSet(welcomeKey(accountId), "1");
}

export function clearWelcomeSeen(accountId: string): void {
  safeRemove(welcomeKey(accountId));
}

// -----------------------------------------------------------------------------
// Wizard draft
// -----------------------------------------------------------------------------

/** Parse + validate a stored draft. Returns null for any shape mismatch,
 *  version mismatch, or JSON parse failure — safe degrade. */
export function loadDraft(accountId: string): WizardDraft | null {
  const raw = safeGet(draftKey(accountId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.draft_version !== CURRENT_DRAFT_VERSION) return null;
    if (
      typeof parsed.current_step !== "number" ||
      parsed.current_step < 0 ||
      parsed.current_step > 5
    ) {
      return null;
    }
    if (
      typeof parsed.capability_wizard_toggle !== "object" ||
      typeof parsed.content_wizard_toggle !== "object"
    ) {
      return null;
    }
    return parsed as WizardDraft;
  } catch {
    return null;
  }
}

export function saveDraft(accountId: string, draft: WizardDraft): void {
  const normalized: WizardDraft = {
    ...draft,
    draft_version: CURRENT_DRAFT_VERSION,
    last_updated_iso: new Date().toISOString(),
  };
  try {
    safeSet(draftKey(accountId), JSON.stringify(normalized));
  } catch {
    /* best effort */
  }
}

export function clearDraft(accountId: string): void {
  safeRemove(draftKey(accountId));
}

/** Called on successful activation save · clears both pieces of state
 *  so a later visit to /business-setup lands on the "already active"
 *  overview rather than resuming a stale draft. */
export function clearAllActivationState(accountId: string): void {
  clearDraft(accountId);
  // welcome_seen is deliberately kept · the user has acknowledged the
  // welcome screen once; no need to re-show after a successful save.
}
