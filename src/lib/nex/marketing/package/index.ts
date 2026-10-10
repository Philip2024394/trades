// src/lib/nex/marketing/package/index.ts
//
// NEX Managed Email Marketing · Stage 3 · Package public API
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).

export * from "./types";
export {
  createPackage,
  loadPackageById,
  listPackagesForMember,
  transitionStatus,
  appendAudit,
  loadAuditHistory,
  loadAttributionById,
  loadAttributionByKey,
  listAttributionsForCampaign,
  type CreatePackageInput,
} from "./repository";
export {
  reserve,
  consume,
  release,
  derivePackageAttributionKey,
  assertMemberLane,
} from "./accounting";
