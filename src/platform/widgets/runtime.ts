// Platform Widget Runtime.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Widget rendering must be uniform. Every App
//    contributes a payload; the shell canonicalises the presentation.
//    If Apps shipped their own layouts, "Today's Work" would look
//    fragmented — the visual signature of the workspace would break.
//
// 2. Which future Apps benefit?  Every App with a widget declaration
//    (Marketplace, Orders, Messages, Quotes, Estimator, Fleet…).
//    Each opts in by returning a payload from a registered handler.
//
// 3. Which doc authorises?  ADR-054 + ADR-048 (widget declarations
//    on AppManifest) + PLATFORM_ARCHITECTURE §2.3 (shell slots).
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Handler-shape parallel to the AI Dispatcher's tool handler
// registry:
//   registerWidgetHandler(widgetId, async () => WidgetPayload)
//
// Handlers run server-side (called from the Home page's server
// component) and return a typed payload the canonical renderer walks.
// No custom UI per App — Marketplace can't ship its own widget layout.
// Everything composes from the same primitives.

import { emitBaseline } from "@/platform/telemetry/baseline";

// ─── Payload shape ────────────────────────────────────────────

export type WidgetChip = {
  kind: "count" | "distance" | "money" | "eta" | "info" | "warn" | "good";
  label: string;
  value?: string | number;
};

export type WidgetRow = {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  trailing?: string;
};

export type WidgetPayload = {
  /** One-line headline shown above the chip row. */
  headline?: string;
  /** Chip row — 0..5 chips. */
  chips?: readonly WidgetChip[];
  /** Row list — 0..5 rows for lightweight tabular displays. */
  rows?: readonly WidgetRow[];
  /** Empty-state message if the handler has nothing to show. */
  emptyLabel?: string;
  /** Trailing link the shell renders as "See all →". */
  href?: string;
};

// ─── Handler registry ─────────────────────────────────────────

type WidgetHandler = () => Promise<WidgetPayload> | WidgetPayload;

const handlerRegistry = new Map<string, WidgetHandler>();

export function registerWidgetHandler(
  widgetId: string,
  handler: WidgetHandler
): void {
  handlerRegistry.set(widgetId, handler);
}

export function resolveWidgetHandler(widgetId: string): WidgetHandler | undefined {
  return handlerRegistry.get(widgetId);
}

/** Invoke a widget handler + emit telemetry. Returns an
 *  empty payload if the handler is unregistered or throws. */
export async function renderWidgetPayload(
  widgetId: string
): Promise<WidgetPayload> {
  const handler = handlerRegistry.get(widgetId);
  if (!handler) {
    emitBaseline("plugin.error.count", 1, {
      app: "shell",
      kind: "widget.handler_missing",
      widget_id: widgetId
    });
    return { emptyLabel: `Handler for "${widgetId}" not registered.` };
  }
  const start = Date.now();
  try {
    const payload = await handler();
    emitBaseline("plugin.request.duration_ms", Date.now() - start, {
      app: "shell",
      route: "widget",
      widget_id: widgetId
    });
    return payload;
  } catch (err) {
    emitBaseline("plugin.error.count", 1, {
      app: "shell",
      kind: "widget.handler_threw",
      widget_id: widgetId
    });
    return {
      emptyLabel:
        err instanceof Error
          ? `Widget error: ${err.message}`
          : "Widget error"
    };
  }
}

/** Test helper. */
export function resetWidgetRuntimeForTests(): void {
  handlerRegistry.clear();
}
