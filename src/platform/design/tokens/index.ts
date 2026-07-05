// Design Token Registry — barrel.
//
// Importing this module side-effect-registers the default token set.
// Additional token sets (industry, dark-mode, brand overrides) register
// via their own files imported here.

import "./defaultSet";

export type { DesignToken, DesignTokenSet, TokenCategory, TokenValueKind } from "./types";
export { designTokenRegistry, resolveToken, tokensByCategory } from "./registry";
