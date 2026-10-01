// src/app/nex-native/_trust-scan/trust-scan-types.ts
//
// NEX Trust Scan · typed data contract · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Founder-approved doctrine: every UI component in `_trust-scan/` consumes
// a typed `TrustScanData` object. The provider that produces it is
// swappable (mock today → real NEX queries tomorrow). The UI must never
// read ad-hoc fields or embed mock values in JSX.
//
// Framing rule: evidence, not accusation. Every signal carries a `why`
// explanation. There is no overall numeric "trust score" and no raw IP
// or device identifier. See `nex_trust_scan_doctrine_2026_10_01.md` in
// memory for the full sealed design.

import type * as React from "react";

// ---------------------------------------------------------------------------
// Signals · colour-coded evidence items
// ---------------------------------------------------------------------------
// Sealed 2026-10-01 (Phase 2 doctrine): FOUR legitimate levels including
// `unknown`. Missing data MUST resolve to `unknown` (⚪ neutral) · never
// forced into caution/warning. Example: a provider that cannot read
// business verification yet emits a `unknown` signal titled "Business
// verification unavailable" — NOT a yellow "Business not verified."
// This is critical: 0 reports ≠ safe, it means no reports recorded.
export type TrustScanSignalLevel = "ok" | "caution" | "warning" | "unknown";

export interface TrustScanSignal {
  level: TrustScanSignalLevel;
  /** Short label · e.g. "Established account". */
  title: string;
  /** The "why" line · ALWAYS present · explains the evidence behind the
   *  level. e.g. "Account has existed for 3 years." */
  detail: string;
}

// ---------------------------------------------------------------------------
// Block 1 · Identity
// ---------------------------------------------------------------------------
export type TrustScanConsistency = "consistent" | "inconsistent" | "unknown";

export interface TrustScanIdentityData {
  /** Days since nex_account.created_at. */
  accountAgeDays: number;
  /** Country the user declared at signup (null if unknown). */
  countryDeclared: string | null;
  /** Consistency between declared country and NEX-internal signals ·
   *  rendered as "Consistent / Inconsistent / Unknown". Set to
   *  "unknown" in Phase 1 until the sealed network-consistency
   *  doctrine decision is made. */
  countryConsistency: TrustScanConsistency;
  /** null when the account is a personal account (no nex_business row). */
  businessVerified: boolean | null;
  businessVerifiedAt?: string;
  /** 0-100 · composite of avatar/display_name/bio/daily_activity. */
  profileCompleteness: number;
  /** false = provisional (nex_account.claimed_at IS NULL). */
  claimed: boolean;
}

// ---------------------------------------------------------------------------
// Block 2 · NEX history
// ---------------------------------------------------------------------------
export interface TrustScanReportCategory {
  category: string;
  count: number;
  substantiated: number;
}

export interface TrustScanHistoryData {
  completedOrders: number;
  refundedOrders: number;
  cancelledOrders: number;
  disputes: number;
  disputesResolved: number;
  confirmedViolations: number;
  suspensions: number;
  /** Total reports received against this account. */
  reportsReceived: number;
  /** Reports that were substantiated by moderation. Lower = less serious. */
  reportsSubstantiated: number;
  blocksReceived: number;
  /** Breakdown by report category (spam / scam / impersonation / etc.). */
  reportCategories: TrustScanReportCategory[];
}

// ---------------------------------------------------------------------------
// Block 3 · Trading reputation
// ---------------------------------------------------------------------------
export interface TrustScanTradingData {
  completedTrades: number;
  /** 0-100. */
  completionRate: number;
  refunds: number;
  unresolvedDisputes: number;
  confirmedFraudFindings: number;
  safeTradeAcknowledged: boolean;
  /** "active" / "slow" / "away" / "archived" / null for non-sellers. */
  sellerActivity: "active" | "slow" | "away" | "archived" | null;
}

// ---------------------------------------------------------------------------
// Block 4 · Your relationship history
// ---------------------------------------------------------------------------
export interface TrustScanRelationshipData {
  firstContactedAt: string | null;
  messagesExchanged: number;
  previousTransactions: number;
  previousDisputes: number;
  blockedByYou: boolean;
  previousReportsByYou: number;
}

// ---------------------------------------------------------------------------
// Composite data shape · the whole scan report
// ---------------------------------------------------------------------------
export interface TrustScanData {
  /** Display name of the scanned account. */
  displayName: string;
  /** Optional avatar URL · used in the reveal phase chrome. The engine
   *  falls back to an initial-letter avatar when null/undefined. */
  avatarUrl?: string | null;
  identity: TrustScanIdentityData;
  history: TrustScanHistoryData;
  trading: TrustScanTradingData;
  /** null when the viewer has never interacted with this account before. */
  relationship: TrustScanRelationshipData | null;
  /** Signals section · generated by the provider from the raw blocks so
   *  the UI never has to re-derive thresholds. Each signal is already
   *  colour + explanation. */
  signals: TrustScanSignal[];
}

/** Factual summary of the signals · counts per level. Rendered in the
 *  reveal phase as a NON-VERDICT badge ("0 warnings · 2 caution ·
 *  5 ok · 1 unavailable") so the user sees a quick posture without the
 *  engine ever declaring the ACCOUNT itself safe/unsafe. Derived from
 *  `TrustScanData.signals` · see `summariseSignals()` helper. */
export interface TrustScanSignalSummary {
  ok: number;
  caution: number;
  warning: number;
  unknown: number;
  /** The highest-severity level present · drives the badge colour.
   *  Order: warning > caution > ok > unknown. */
  dominant: TrustScanSignalLevel;
}

export function summariseSignals(
  signals: TrustScanSignal[],
): TrustScanSignalSummary {
  const counts = { ok: 0, caution: 0, warning: 0, unknown: 0 };
  for (const s of signals) counts[s.level]++;
  const dominant: TrustScanSignalLevel =
    counts.warning > 0
      ? "warning"
      : counts.caution > 0
        ? "caution"
        : counts.ok > 0
          ? "ok"
          : "unknown";
  return { ...counts, dominant };
}

// ---------------------------------------------------------------------------
// Provider · how the UI fetches a TrustScanData
// ---------------------------------------------------------------------------
export interface TrustScanProvider {
  fetch(input: {
    scannedAccountId: string;
    viewerAccountId: string | null;
  }): Promise<TrustScanData>;
}

// ---------------------------------------------------------------------------
// Skin · how a theme styles the cinematic + report chrome
// ---------------------------------------------------------------------------
export interface TrustScanSkin {
  /** Monospace stack for data readouts. */
  fontMono: string;
  /** Display stack for the serif title. */
  fontDisplay: string;

  colors: {
    background: string;
    textPrimary: string;
    textMuted: string;
    accent: string;
    danger: string;
    warn: string;
    success: string;
    /** Rim glow colour · used on borders + shadows. */
    rim: string;
  };

  cinematic: {
    /** Full-screen image flashed during the "ACCOUNT IDENTIFIED" phase ·
     *  optional · skins without an image get a flat accent wash. */
    revealImageUrl?: string;
    /** Line one of the receiving phase · e.g. "RECEIVING DATA…" (Joker)
     *  or "GATHERING SIGNALS…" (neutral). */
    receivingLabel: string;
    /** Line two of the receiving phase · subtitle under the ring. */
    receivingSubtitle: string;
    /** Line one of the reveal phase · e.g. "TARGET LOCKED" or
     *  "ACCOUNT IDENTIFIED". */
    revealLabel: string;
    /** Line two of the reveal phase · smaller status copy. */
    revealSubtitle: string;
  };

  /** Small chip glyph rendered next to the title in the header · lets
   *  each theme stamp its own mascot into the scan without the engine
   *  caring what it is. Pass a React node (SVG, img, text, whatever). */
  headerGlyph: React.ReactNode;

  /** Header eyebrow label · e.g. "NEX TRUST SCAN · JOKER" (Joker) or
   *  "NEX TRUST SCAN" (neutral default). */
  headerEyebrow: string;
}
