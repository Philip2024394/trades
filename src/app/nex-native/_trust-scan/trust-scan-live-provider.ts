// src/app/nex-native/_trust-scan/trust-scan-live-provider.ts
//
// NEX Trust Scan · live provider · Phase 2 · sealed scaffold 2026-10-01.
// -----------------------------------------------------------------------------
// Founder-sealed Phase 2 doctrine (NOT optional):
//
//   1. This file is the ONLY layer that may touch Supabase tables for
//      the Trust Scan feature. The UI components in `_trust-scan/`
//      must never import `nexSupabaseAdmin` or any service wrapper.
//
//   2. Missing data resolves to UNKNOWN, not CAUTION/WARNING. A query
//      that fails or returns null for business_verified_at MUST emit
//      an "unavailable" signal · never a yellow/red one.
//
//   3. Never expose reporter identity. The scanned user can see
//      aggregate counts and category breakdowns · never
//      "John reported you on September 14."
//
//   4. No raw IP, device fingerprint, or hidden identity inference
//      ever surfaces. §7A fingerprint isolation stands.
//
//   5. The returned TrustScanData must satisfy the typed contract
//      exactly. If a block cannot be fetched, return UNKNOWN values
//      inside that block rather than throwing · the UI needs to show
//      SOMETHING.
//
// Build order inside this file (per table source):
//
//   buildIdentity()       · nex_account (+ nex_account_profile)
//   buildHistory()        · nex_report + nex_friend_edge
//   buildTrading()        · nex_order + nex_business (verified_at,
//                           safe_trade_activated, last_seller_activity_at)
//   buildRelationship()   · nex_peer_conversation + nex_peer_message +
//                           nex_order (viewer ↔ scanned pair)
//   deriveSignals()       · composed from the above · re-uses the
//                           threshold logic in trust-scan-mock-provider
//                           to keep the public evidence set identical.
//
// Nothing in this file is wired yet · each build* function throws so
// an accidental Phase 1 → Phase 2 cutover without a code review fails
// loudly. Delete each `throw` as the real query lands.

import type {
  TrustScanData,
  TrustScanHistoryData,
  TrustScanIdentityData,
  TrustScanProvider,
  TrustScanRelationshipData,
  TrustScanSignal,
  TrustScanTradingData,
} from "./trust-scan-types";

const NOT_IMPLEMENTED =
  "trust-scan-live-provider: block not implemented yet · see Phase 2 build order comment at top of file.";

async function buildIdentity(_scannedAccountId: string): Promise<TrustScanIdentityData> {
  // TODO · query nex_account (created_at, claimed_at, phone_country_code
  // for DECLARED country only), nex_account_profile (avatar_url,
  // daily_activity, is_public), nex_business (verified_at) for the
  // scanned account. Any missing field resolves to UNKNOWN · see
  // trust-scan-types.ts · never yellow-code an absence.
  throw new Error(NOT_IMPLEMENTED);
}

async function buildHistory(_scannedAccountId: string): Promise<TrustScanHistoryData> {
  // TODO · query nex_report with reported_account_id = scannedAccountId ·
  // use countPendingReportsAgainst() + substantiated aggregate · group
  // by category · NEVER return reporter identities, only counts.
  // Also query nex_friend_edge for blocks received (b_account_id =
  // scannedAccountId AND status = 'blocked'). Missing orders table
  // results resolve to 0 WITH a note so the UI shows UNKNOWN.
  throw new Error(NOT_IMPLEMENTED);
}

async function buildTrading(_scannedAccountId: string): Promise<TrustScanTradingData> {
  // TODO · aggregate nex_order by seller_account_id for completed /
  // refunded / cancelled counts · nex_business.verified_at ·
  // nex_business.safe_trade_activated · nex_business.last_seller_activity_at
  // → active / slow / away / archived. If the account has no
  // nex_business row the sellerActivity is `null` (personal account).
  throw new Error(NOT_IMPLEMENTED);
}

async function buildRelationship(
  _scannedAccountId: string,
  _viewerAccountId: string,
): Promise<TrustScanRelationshipData | null> {
  // TODO · query nex_peer_conversation with pair (viewer, scanned) ·
  // first-contacted = created_at · messages = nex_peer_message count
  // where conversation_id matches · previous transactions = nex_order
  // count where (seller=scanned & buyer=viewer) OR vice versa ·
  // previous disputes · blockedByYou from nex_friend_edge where
  // requested_by=viewer AND b_account_id=scanned AND status='blocked' ·
  // previousReportsByYou from nex_report where reporter_id=viewer AND
  // reported_account_id=scanned. Return null if no interaction exists.
  throw new Error(NOT_IMPLEMENTED);
}

function deriveSignals(_data: Omit<TrustScanData, "signals">): TrustScanSignal[] {
  // Phase 2 note: pull the threshold logic from the mock provider's
  // deriveSignals() into a shared helper (`trust-scan-signal-rules.ts`)
  // so mock + live emit identical signal copy. For now this is still
  // separate so Phase 1 UI tests don't drift.
  throw new Error(NOT_IMPLEMENTED);
}

/** Live provider · wire this into the chat-header trigger once every
 *  build* function above is implemented. The UI contract is unchanged:
 *  callers import a `TrustScanProvider` and pass it to `<TrustScan />`. */
export const liveTrustScanProvider: TrustScanProvider = {
  async fetch({ scannedAccountId, viewerAccountId }) {
    const [identity, history, trading, relationship] = await Promise.all([
      buildIdentity(scannedAccountId),
      buildHistory(scannedAccountId),
      buildTrading(scannedAccountId),
      viewerAccountId
        ? buildRelationship(scannedAccountId, viewerAccountId)
        : Promise.resolve(null),
    ]);
    const base: Omit<TrustScanData, "signals"> = {
      displayName: scannedAccountId, // TODO · resolve from nex_account_profile.display_name
      identity,
      history,
      trading,
      relationship,
    };
    return { ...base, signals: deriveSignals(base) };
  },
};
