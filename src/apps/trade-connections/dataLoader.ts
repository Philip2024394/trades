// App data loader: trade-connections.
// The full carousel data is per-PDP (cards + productSlug). Home-page
// slots receive an empty cards array so the wrapper skips render
// silently; the PDP hydrator will populate real cards when the
// product-page probe lands (Module 21 rollout to product pages).

import { registerAppDataLoader } from "@/platform/apps/_shared/appDataLoader";

registerAppDataLoader("trade-connections", () => ({
  cards: [],
  productSlug: ""
}));
