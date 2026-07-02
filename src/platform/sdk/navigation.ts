// Platform SDK — navigation.
//
// Thin wrapper around runtime.composeNavigation. The SDK doesn't add
// filtering — consumers decide whether to render "public" vs
// "merchant" entries themselves via each entry's `visibility` field.

import { runtime, type ComposedNavigation } from "../runtime";

export function getNavigation(
  merchantId: string
): Promise<ComposedNavigation> {
  return runtime.composeNavigation(merchantId);
}
