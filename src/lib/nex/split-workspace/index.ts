// src/lib/nex/split-workspace/index.ts
//
// Stage 9 · public API. Split-workspace layout algebra.

export type { PanelKind, PanelState, WorkspaceLayout, WorkspaceValidation } from "./types";
export {
  defaultLayout,
  validateLayout,
  focusPanel,
  togglePanel,
  keyToPanel,
} from "./layout";
