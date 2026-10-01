// src/app/nex-native/_trust-scan/trust-scan-mock-provider.ts
//
// NEX Trust Scan · mock provider · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Returns a plausible TrustScanData so Phase 1 UI can be reviewed before
// the real queries land. Deterministic output per scannedAccountId so a
// given account always "scans" the same way during QA.
//
// ⚠️ Nothing in this file touches Supabase · it is pure in-memory data.
// Phase 2 will introduce a parallel `trust-scan-live-provider.ts` that
// implements the same interface against nex_report + nex_friend_edge +
// nex_business + nex_order + nex_account + nex_account_profile.

import type {
  TrustScanData,
  TrustScanProvider,
  TrustScanSignal,
} from "./trust-scan-types";

function pickMockDisplayName(id: string): string {
  const seedChar = id.charCodeAt(0) || 65;
  const pool = [
    "Philip Construction",
    "Maria Photography",
    "Satria Bakery",
    "Kopi Nona",
    "Dewi Textiles",
    "Rendra Wiring",
  ];
  return pool[seedChar % pool.length]!;
}

/** Compose the Signals block from the raw numbers so the UI never has
 *  to re-derive thresholds. Doctrine: every signal MUST have a `detail`
 *  explaining the evidence — the UI will show it under the title. */
function deriveSignals(data: Omit<TrustScanData, "signals">): TrustScanSignal[] {
  const sig: TrustScanSignal[] = [];

  // Account age
  const years = Math.floor(data.identity.accountAgeDays / 365);
  if (years >= 2) {
    sig.push({
      level: "ok",
      title: "Established account",
      detail: `Account has existed for ${years} year${years === 1 ? "" : "s"}.`,
    });
  } else if (data.identity.accountAgeDays < 90) {
    sig.push({
      level: "caution",
      title: "New account",
      detail: `Account was created ${data.identity.accountAgeDays} days ago.`,
    });
  }

  // Verification · note that an UNVERIFIED business is NOT a yellow
  // caution per Phase 2 doctrine (missing data ≠ bad). Only the
  // positive case is coloured; the absence case stays unknown.
  if (data.identity.businessVerified === true) {
    sig.push({
      level: "ok",
      title: "Business verified",
      detail: "NEX verification was completed by the moderation team.",
    });
  } else if (data.identity.businessVerified === false) {
    sig.push({
      level: "unknown",
      title: "Business verification unavailable",
      detail:
        "This account has not completed NEX business verification. Many legitimate users are also unverified.",
    });
  }

  // Claimed vs provisional
  if (!data.identity.claimed) {
    sig.push({
      level: "caution",
      title: "Provisional account",
      detail:
        "The account has not been claimed with a profile yet. Common for first-time visitors.",
    });
  }

  // Trading history
  if (data.trading.completedTrades >= 40) {
    sig.push({
      level: "ok",
      title: "Trading history",
      detail: `${data.trading.completedTrades} completed transactions on record.`,
    });
  } else if (data.trading.completedTrades > 0 && data.trading.completedTrades < 5) {
    sig.push({
      level: "caution",
      title: "Limited history",
      detail: `Only ${data.trading.completedTrades} completed transaction${
        data.trading.completedTrades === 1 ? "" : "s"
      }.`,
    });
  }

  // Fraud / community warning
  if (data.trading.confirmedFraudFindings > 0) {
    sig.push({
      level: "warning",
      title: "Confirmed fraud findings",
      detail: `${data.trading.confirmedFraudFindings} fraud finding${
        data.trading.confirmedFraudFindings === 1 ? "" : "s"
      } confirmed by NEX moderation.`,
    });
  } else if (
    data.history.reportsSubstantiated >= 3 ||
    data.history.blocksReceived >= 5
  ) {
    sig.push({
      level: "warning",
      title: "Community warning",
      detail: `${data.history.reportsSubstantiated} substantiated report${
        data.history.reportsSubstantiated === 1 ? "" : "s"
      } and ${data.history.blocksReceived} block${
        data.history.blocksReceived === 1 ? "" : "s"
      } on this account.`,
    });
  }

  // Unresolved disputes
  if (data.trading.unresolvedDisputes > 0) {
    sig.push({
      level: "caution",
      title: "Unresolved dispute",
      detail: `${data.trading.unresolvedDisputes} unresolved trade dispute${
        data.trading.unresolvedDisputes === 1 ? "" : "s"
      }. Still being reviewed.`,
    });
  }

  // Safe-trade acknowledgement
  if (data.trading.safeTradeAcknowledged) {
    sig.push({
      level: "ok",
      title: "Safe-trade acknowledged",
      detail:
        "User has acknowledged NEX Safe-Trade guidelines before trading.",
    });
  }

  // Country consistency · doctrine-neutral placeholder. Phase 1 never
  // emits a yellow country signal because the IP-check feature is
  // deferred to a separate founder doctrine decision.
  if (data.identity.countryConsistency === "inconsistent") {
    sig.push({
      level: "caution",
      title: "Country-signal mismatch",
      detail:
        "Declared country does not match recent connection region. VPNs, travel, or network routing can cause this.",
    });
  } else if (data.identity.countryConsistency === "unknown") {
    sig.push({
      level: "unknown",
      title: "Network consistency unavailable",
      detail:
        "NEX does not currently have enough information to assess country consistency for this account.",
    });
  }

  // Report absence · 0 reports is NOT the same as "safe person" per
  // Phase 2 doctrine · explicitly surface the honest reading.
  if (
    data.history.reportsReceived === 0 &&
    data.trading.completedTrades === 0
  ) {
    sig.push({
      level: "unknown",
      title: "No activity on record",
      detail:
        "No reports or completed trades are currently recorded against this account.",
    });
  }

  return sig;
}

/** Build a deterministic mock for a given scannedAccountId · same id
 *  always produces the same scan during QA. Signals are derived from
 *  the raw numbers so the UI gets a complete `TrustScanData`. */
export function buildMockTrustScan(input: {
  scannedAccountId: string;
  viewerAccountId: string | null;
}): TrustScanData {
  // Simple deterministic hash so different mock ids produce different
  // flavours of report during preview.
  const seed = Array.from(input.scannedAccountId).reduce(
    (a, c) => a + c.charCodeAt(0),
    0,
  );
  const seedMod = seed % 100;

  const identity = {
    accountAgeDays: 300 + (seed % 900), // ~10 months to ~3.3 years
    countryDeclared: "Indonesia",
    countryConsistency: "unknown" as const,
    businessVerified: seedMod < 70,
    businessVerifiedAt:
      seedMod < 70 ? "2025-04-18" : undefined,
    profileCompleteness: 60 + (seed % 40),
    claimed: seedMod < 90,
  };

  const history = {
    completedOrders: 92 + (seed % 180),
    refundedOrders: 2 + (seed % 6),
    cancelledOrders: 3 + (seed % 8),
    disputes: seedMod % 4,
    disputesResolved: Math.max(0, (seedMod % 4) - 1),
    confirmedViolations: 0,
    suspensions: 0,
    reportsReceived: seedMod % 6,
    reportsSubstantiated: Math.floor((seedMod % 6) / 3),
    blocksReceived: seedMod % 10,
    reportCategories:
      seedMod % 6 > 0
        ? [
            { category: "spam", count: 1, substantiated: 0 },
            { category: "off_doctrine_payment", count: 1, substantiated: 0 },
          ]
        : [],
  };

  const trading = {
    completedTrades: 42 + (seed % 160),
    completionRate: 92 + (seed % 8),
    refunds: history.refundedOrders,
    unresolvedDisputes: Math.max(0, history.disputes - history.disputesResolved),
    confirmedFraudFindings: 0,
    safeTradeAcknowledged: seedMod < 85,
    sellerActivity: "active" as const,
  };

  const relationship = input.viewerAccountId
    ? {
        firstContactedAt: "2026-05-14",
        messagesExchanged: 48,
        previousTransactions: 2,
        previousDisputes: 0,
        blockedByYou: false,
        previousReportsByYou: 0,
      }
    : null;

  const base: Omit<TrustScanData, "signals"> = {
    displayName: pickMockDisplayName(input.scannedAccountId),
    // No avatar in the mock · the reveal phase falls back to an
    // initial-letter chip, which is what we want so the preview
    // shows the no-avatar path too.
    avatarUrl: null,
    identity,
    history,
    trading,
    relationship,
  };

  const signals = deriveSignals(base);

  return { ...base, signals };
}

/** Mock provider · wrap the builder in the TrustScanProvider shape so
 *  callers can switch to a live provider later without touching the UI. */
export const mockTrustScanProvider: TrustScanProvider = {
  async fetch(input) {
    // Tiny delay so the "RECEIVING DATA…" phase of the cinematic has
    // something to feel like it is waiting for. Real provider will have
    // its own network latency and should NOT impose extra delay here.
    await new Promise((r) => setTimeout(r, 400));
    return buildMockTrustScan(input);
  },
};
