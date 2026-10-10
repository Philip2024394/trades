// src/lib/nex/marketing/member/index.ts
//
// NEX Managed Email Marketing · Stage 4 · Member-facing public API
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).

export * from "./types";
export { countAudience } from "./audience";
export { resolveMemberAuth } from "./auth";
export {
  assertAuthenticatedMember,
  listMemberCampaigns,
  loadMemberCampaign,
  createDraftCampaign,
  previewMemberCampaign,
  reviewMemberCampaign,
  scheduleOrSendMemberCampaign,
  cancelMemberCampaign,
  getMemberCampaignAnalytics,
  compileTemplate,
  type CreateCampaignInput,
} from "./campaign-service";
