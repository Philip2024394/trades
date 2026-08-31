// src/lib/nex/brain/long-term-memory.ts
//
// Stage 3.26 · Phase 19 · Long-Term Memory (Philip 2026-08-31).
//
// Cross-session preference store keyed by userId. Consent-gated by
// Governance (`write.long_term_memory` require_consent by default;
// consent flag in OrchestrateOptions flips it to allow). Enables
// Personalization (future phase) and adaptive behavior across
// conversations for the same user.
//
// v1 discipline:
//   · In-memory globalThis-bound (HMR-safe · consistent with session store)
//   · Keyed by userId (opaque client-provided string · trusted for v1)
//   · Consent required for BOTH read AND write · without consent, LTM inactive
//   · Preferences derived from accommodation slots (location/type/budget/area)
//   · Frequency-weighted (repeated picks bubble to top)
//   · Never fabricates a preference the user didn't demonstrate
//   · Postgres persistence lands with user-auth wiring · future phase

export type LongTermPreferences = {
  userId: string;
  createdAt: number;
  updatedAt: number;
  /** Interaction count for this user across all conversations. */
  interactionCount: number;
  /** Location picked most often (with frequency tally). */
  locationPreference?: { canonical: string; count: number };
  /** Property type picked most often. */
  typePreference?: { canonical: string; count: number };
  /** Budget picked most often. */
  budgetPreference?: { canonical: string; count: number };
  /** Sub-area picked most often. */
  areaPreference?: { canonical: string; count: number };
  /** Raw counts by dimension (for updates without losing frequency history). */
  _counts?: {
    location?: Record<string, number>;
    type?: Record<string, number>;
    budget?: Record<string, number>;
    area?: Record<string, number>;
  };
};

const GLOBAL_KEY = "__nexLongTermMemory__" as const;
const CAP = 10_000; // total users cap

function bag(): Map<string, LongTermPreferences> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(GLOBAL_KEY in g)) g[GLOBAL_KEY] = new Map<string, LongTermPreferences>();
  return g[GLOBAL_KEY] as Map<string, LongTermPreferences>;
}

function pruneOverCap(): void {
  const m = bag();
  if (m.size > CAP) {
    const sorted = [...m.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const drop = m.size - CAP;
    for (let i = 0; i < drop; i++) m.delete(sorted[i][0]);
  }
}

function pickTop(counts: Record<string, number> | undefined): { canonical: string; count: number } | undefined {
  if (!counts) return undefined;
  let bestKey = "";
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestCount) { bestKey = k; bestCount = v; }
  }
  return bestKey ? { canonical: bestKey, count: bestCount } : undefined;
}

// ─── Read ─────────────────────────────────────────────────────────────

export function getPreferences(userId: string | undefined, hasConsent: boolean): LongTermPreferences | null {
  if (!userId || !hasConsent) return null;
  return bag().get(userId) ?? null;
}

// ─── Write ────────────────────────────────────────────────────────────

export type PreferenceUpdate = {
  userId: string;
  hasConsent: boolean;
  location?: string;
  type?: string;
  budget?: string;
  area?: string;
};

export function updatePreferencesFromSlots(update: PreferenceUpdate): LongTermPreferences | null {
  if (!update.userId || !update.hasConsent) return null;

  const now = Date.now();
  const m = bag();
  const existing = m.get(update.userId);
  const counts = { ...(existing?._counts ?? {}) };

  const bump = (dim: "location" | "type" | "budget" | "area", value: string | undefined) => {
    if (!value) return;
    const dimCounts = { ...(counts[dim] ?? {}) };
    dimCounts[value] = (dimCounts[value] ?? 0) + 1;
    counts[dim] = dimCounts;
  };
  bump("location", update.location);
  bump("type", update.type);
  bump("budget", update.budget);
  bump("area", update.area);

  const next: LongTermPreferences = {
    userId: update.userId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    interactionCount: (existing?.interactionCount ?? 0) + 1,
    locationPreference: pickTop(counts.location),
    typePreference: pickTop(counts.type),
    budgetPreference: pickTop(counts.budget),
    areaPreference: pickTop(counts.area),
    _counts: counts,
  };
  m.set(update.userId, next);
  pruneOverCap();
  return next;
}

// ─── Test helpers ─────────────────────────────────────────────────────

export function _resetLongTermMemoryForTests(): void {
  bag().clear();
}

export function longTermMemorySizeForTests(): number {
  return bag().size;
}

/** Serialisable snapshot for response payload · omits _counts (internal). */
export function snapshotPreferences(p: LongTermPreferences | null): {
  userId: string;
  interactionCount: number;
  locationPreference?: { canonical: string; count: number };
  typePreference?: { canonical: string; count: number };
  budgetPreference?: { canonical: string; count: number };
  areaPreference?: { canonical: string; count: number };
} | null {
  if (!p) return null;
  return {
    userId: p.userId,
    interactionCount: p.interactionCount,
    locationPreference: p.locationPreference,
    typePreference: p.typePreference,
    budgetPreference: p.budgetPreference,
    areaPreference: p.areaPreference,
  };
}
