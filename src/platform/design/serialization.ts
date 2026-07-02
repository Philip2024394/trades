// Xrated Design System — serialization.
//
// The registry holds React component references (renderers) that can't
// travel over JSON. This module produces a JSON-safe subset of each
// registration for API responses, AI SDK consumption, and any future
// external tooling that needs to reason over the catalogue without
// running React.

import type { FrozenDesignComponent } from "./types";

export type SerializedDesignComponent = {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  contentShape: string;
  editableProps: FrozenDesignComponent["editableProps"];
  themeTokensUsed: readonly string[];
  animations: readonly string[];
  responsive: FrozenDesignComponent["responsive"];
  compatibleLayouts?: readonly string[];
  searchKeywords: readonly string[];
  defaultProps: Record<string, unknown>;
  defaultContent: Record<string, unknown>;
};

export function serializeRegistration(
  reg: FrozenDesignComponent
): SerializedDesignComponent {
  return {
    id: reg.id,
    name: reg.name,
    category: reg.category,
    description: reg.description,
    version: reg.version,
    contentShape: reg.contentShape,
    editableProps: reg.editableProps,
    themeTokensUsed: reg.themeTokensUsed,
    animations: reg.animations,
    responsive: reg.responsive,
    compatibleLayouts: reg.compatibleLayouts,
    searchKeywords: reg.searchKeywords,
    defaultProps: reg.defaultProps(),
    defaultContent: reg.defaultContent()
  };
}
