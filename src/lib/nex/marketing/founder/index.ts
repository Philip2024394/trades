// src/lib/nex/marketing/founder/index.ts
export * from "./types";
export { resolveFounderAuth } from "./auth";
export {
  assertFounder,
  getHQSystemStatus,
  listFounderSenders,
  addFounderSender,
  createFounderDraft,
  listFounderCampaigns,
  loadFounderCampaign,
  previewFounderCampaign,
  reviewFounderCampaign,
  sendFounderCampaign,
  sendFounderTestEmail,
  checkGlobalUnsubscribe,
  getFounderAnalytics,
  type AddFounderSenderInput,
} from "./founder-service";
export {
  loadEmailStorageInventory,
  _EMAIL_STORAGE_INVENTORY_BOUNDARY,
  type EmailStorageInventory,
  type CountryInventoryRow,
  type CategoryInventoryRow,
  type SourceInventoryRow,
} from "./inventory";
