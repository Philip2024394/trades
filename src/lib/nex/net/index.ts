// Nex Network Intelligence — public barrel.

export type {
  CollaborationRow,
  Evidence,
  MatchIntent,
  MatchResult,
  NetworkBusiness,
  NetworkSnapshot,
  ReferralOpportunity,
  TrustProfile,
  TrustSignal
} from "./types";
export { evidenceFor } from "./types";

export { findBusinesses, haversineKm }        from "./directory";
export { bandFor, buildTrustProfile }         from "./trust";
export { findCollaborators }                  from "./collaborations";
export { findReferralOpportunities }          from "./referrals";
export { findMatches, parseMatchIntent }      from "./matchmaker";

export { _clearNetCache, buildNetworkSnapshot } from "./engine";
export type { BuildNetworkSnapshotInput, BuildNetworkSnapshotResult } from "./engine";

export { answerNetwork, classifyNetworkQuestion } from "./answer";
export type { AnswerNetworkInput, NetworkQuestion } from "./answer";
