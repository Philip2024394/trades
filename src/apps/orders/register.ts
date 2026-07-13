// Orders App — self-registration + platform-service wiring.
//
// Same pattern as Marketplace's register.ts. Zero platform primitive
// change required to install a second App.

import { appRegistry } from "@/platform/registry";
import { registerProviderHandler } from "@/platform/search/orchestrator";
import { registerToolHandler } from "@/platform/aiTools/dispatcher";
import { registerWidgetHandler } from "@/platform/widgets/runtime";
import { ordersAppManifest } from "./manifest";
import { searchOrders } from "./handlers/searchOrders";
import {
  trackOrderTool,
  listRecentTool,
  cancelOrderTool
} from "./handlers/aiToolHandlers";
import {
  arrivingTodayWidget,
  awaitingConfirmationWidget
} from "./handlers/widgetHandlers";

let registered = false;

export function registerOrdersApp(): void {
  if (registered) return;
  registered = true;

  if (!appRegistry.has("orders")) {
    appRegistry.register(ordersAppManifest);
  }

  // Search provider handler
  registerProviderHandler("orders.orders", searchOrders);

  // AI tool handlers
  registerToolHandler("orders.track_order", trackOrderTool);
  registerToolHandler("orders.list_recent", listRecentTool);
  registerToolHandler("orders.cancel_order", cancelOrderTool);

  // Widget handlers
  registerWidgetHandler("orders.arriving_today", arrivingTodayWidget);
  registerWidgetHandler("orders.awaiting_confirmation", awaitingConfirmationWidget);
}
