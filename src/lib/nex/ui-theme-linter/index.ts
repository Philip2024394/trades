// src/lib/nex/ui-theme-linter/index.ts
//
// Stage 4 · public API for UI theme lint. Consumed by Security Agent
// on every UI-file inspection. Wire in nex/security-agent when Stage 4
// enters SUPERVISORY REVIEW.

export { loadDesignTokens, sanctionedHexSet } from "./tokens";
export type { DesignTokens } from "./tokens";
export {
  lintUiFile,
  isUiSurface,
  verifyTokensInSync,
} from "./rules";
export type { UiViolation } from "./rules";
