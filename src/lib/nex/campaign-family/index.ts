// Campaign Family · public exports.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

export {
  register, get, all, count, clear, updateOutput, planCampaign, DEFAULT_DOMESTIC_FAN_OUT,
} from "./store";
export type { CampaignFamily, CampaignOutput, CampaignOutputChannel } from "./types";
