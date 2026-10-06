// src/app/nex-native/chat-themes-library/_test-registry-view.ts
//
// Test-only helper · re-exports a stable snapshot of the registered
// category ids plus the public functions the Step 1B suite needs.
// Keeps the suite's imports clean (one path) and avoids re-exporting
// internals to production callers · nothing else should import this
// file.

import { listCategories } from "@/lib/nex-native/theme-category/registry";

export {
  EXPLORE_CATEGORY_ID,
  getCategory,
  isRegisteredCategory,
  listCategories,
  resolveCategoryId,
} from "@/lib/nex-native/theme-category/registry";

/** Snapshot of the currently-registered category ids. Updates
 *  automatically when the registry grows · tests assert against the
 *  snapshot. */
export const CATEGORY_REGISTRY_IDS: readonly string[] = listCategories().map(
  (c) => c.id,
);
