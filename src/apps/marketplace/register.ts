// Marketplace App — self-registration + platform-service wiring.
//
// Idempotent. Called once per server process from src/platform/
// bootstrap.ts.
//
// Wires:
//   - Registers the AppManifest into appRegistry
//   - Registers search provider handlers with the Universal Search
//     orchestrator (fan-out targets)

import { appRegistry } from "@/platform/registry";
import { registerProviderHandler } from "@/platform/search/orchestrator";
import { registerToolHandler } from "@/platform/aiTools/dispatcher";
import { registerWidgetHandler } from "@/platform/widgets/runtime";
import { marketplaceAppManifest } from "./manifest";
import { searchProducts } from "./handlers/searchProducts";
import { searchMerchants } from "./handlers/searchMerchants";
import { searchCategories } from "./handlers/searchCategories";
import {
  searchProductsTool,
  getProductTool,
  compareProductsTool,
  findAlternativesTool
} from "./handlers/aiToolHandlers";
import { backInStockWidget, newFromPinnedWidget } from "./handlers/widgetHandlers";

let registered = false;

export function registerMarketplaceApp(): void {
  if (registered) return;
  registered = true;

  if (!appRegistry.has("marketplace")) {
    appRegistry.register(marketplaceAppManifest);
  }
  // Search provider handlers plug into the orchestrator by id.
  // Handler names match the ids declared in manifest.searchProviders.
  registerProviderHandler("marketplace.products", searchProducts);
  registerProviderHandler("marketplace.merchants", searchMerchants);
  registerProviderHandler("marketplace.categories", searchCategories);

  // AI tool handlers — the Dispatcher discovers the declarations
  // and invokes these when the model requests them (Week 4 ADR-052).
  registerToolHandler("marketplace.search_products", searchProductsTool);
  registerToolHandler("marketplace.get_product", getProductTool);
  registerToolHandler("marketplace.compare_products", compareProductsTool);
  registerToolHandler("marketplace.find_alternatives", findAlternativesTool);

  // Widget handlers — Week 5 ADR-054.
  registerWidgetHandler("marketplace.back_in_stock", backInStockWidget);
  registerWidgetHandler("marketplace.new_from_pinned", newFromPinnedWidget);
}
