// src/lib/nex/preview/index.ts
//
// Stage 5 · public API. Preview environment isolation + emergency-revert flag layer.

export {
  PREVIEW_ELIGIBLE_STATES,
  PREVIEW_PATH_PREFIX,
} from "./preview-config";

export type {
  PreviewResolution,
  PreviewRouteParams,
  EmergencyFlag,
  EmergencyFlagScope,
} from "./preview-config";

export {
  validatePreviewParams,
  resolvePreviewFromRevision,
  composePreviewUrl,
} from "./preview-resolver";

export {
  InMemoryFlagStore,
  evaluateFlags,
  makeFlag,
} from "./preview-flags";

export type {
  FlagEvaluationInput,
  FlagEvaluationResult,
} from "./preview-flags";
