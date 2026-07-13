// Platform Telemetry — auto-instrumented baseline + custom emitter.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Telemetry is a cross-App concern. Every App gets
//    the same 12 baseline metrics without writing instrumentation
//    code. If each App shipped its own metric pipeline, we'd have
//    N different observability stories.
//
// 2. Which future Apps benefit?  Every App. The baseline metrics
//    (request count, event emissions, command executions, AI tool
//    invocations, search queries, navigation routes, workflow steps,
//    flag evaluations, errors, active users, request duration) are
//    common to every App regardless of domain.
//
// 3. Which doc authorises?  ADR-038 + ADR-044 + TRADE_CENTER_PLATFORM
//    _DELTA §4.2 rows "AppManifest telemetry declarations" and
//    "Runtime auto-instrumented telemetry wrapper".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Two responsibilities:
//   1. Auto-baseline: emit the 12 baseline metrics from any App
//      operation the runtime observes. Emission is fire-and-forget
//      and uses Registry Kit's telemetry hooks under the hood.
//   2. Custom emissions: Apps that declare `telemetry` on their
//      manifest get typed emitters via `emitTelemetry()`. Metric
//      name and labels validated against the declaration; invalid
//      emissions warn in dev, silently drop in prod.
//
// Emission sink is pluggable — Week 1 ships with a console sink
// (development) and a Sentry breadcrumb sink (production). Later
// milestones swap for a real metrics pipeline (Grafana, OpenTelemetry
// exporter) without any App-level change.

import { appRegistry } from "@/platform/registry";
import type { TelemetryDeclaration } from "@/platform/manifest/types";

// ─── Baseline metric catalogue (auto-emitted by runtime) ─────────

export const BASELINE_METRICS = [
  "plugin.request.count",
  "plugin.request.duration_ms",
  "plugin.error.count",
  "plugin.usage.active_users",
  "plugin.event.emitted",
  "plugin.event.handled",
  "plugin.command.executed",
  "plugin.ai.tool_invoked",
  "plugin.search.queried",
  "plugin.navigation.route",
  "plugin.workflow.step",
  "plugin.flag.evaluated"
] as const;

export type BaselineMetric = (typeof BASELINE_METRICS)[number];

// ─── Sink interface ──────────────────────────────────────────────

export type TelemetryEvent = {
  metric: string;
  value: number;
  labels: Record<string, string>;
  emittedAt: number;
};

export type TelemetrySink = (event: TelemetryEvent) => void;

let activeSink: TelemetrySink = (event) => {
  // Development default — console sink. Prod overrides via setSink().
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[telemetry]", event.metric, event.value, event.labels);
  }
};

/** Swap the telemetry sink at boot. Production wires this to Sentry
 *  breadcrumbs + OpenTelemetry exporter; development leaves the
 *  console sink in place.
 */
export function setSink(sink: TelemetrySink): void {
  activeSink = sink;
}

// ─── Baseline emitter (called by runtime wrapper) ────────────────

/** Auto-emitted by the runtime for every App operation. Apps never
 *  call this directly; the runtime wrapper handles it.
 *
 *  Labels: always include `app` for slug-based grouping. Callers may
 *  add more (route, kind, status, etc.) — no schema enforcement on
 *  baseline emissions because they're runtime-produced, not
 *  manifest-declared.
 */
export function emitBaseline(
  metric: BaselineMetric,
  value: number,
  labels: Record<string, string>
): void {
  activeSink({
    metric,
    value,
    labels,
    emittedAt: Date.now()
  });
}

// ─── Custom emitter (Apps call this) ─────────────────────────────

/** Emit a custom metric declared in the App's manifest. Validates
 *  the metric name against the App's declared telemetry list and
 *  rejects unknown labels.
 *
 *  Callers pass the App slug so the runtime doesn't have to
 *  reconstruct it from imports. This makes the emitter usable from
 *  server routes, workers, and edge functions equally.
 */
export function emitTelemetry(
  appSlug: string,
  metric: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const app = appRegistry.get(appSlug);
  if (!app) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[telemetry] unknown app "${appSlug}" — emission dropped`);
    }
    return;
  }
  const declaration = app.telemetry?.find((t) => t.metric === metric);
  if (!declaration) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[telemetry] undeclared metric "${metric}" for app "${appSlug}" — emission dropped`
      );
    }
    return;
  }
  // Reject undeclared labels
  const allowed = new Set(declaration.labels ?? []);
  for (const key of Object.keys(labels)) {
    if (!allowed.has(key)) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          `[telemetry] undeclared label "${key}" for metric "${metric}" — emission dropped`
        );
      }
      return;
    }
  }
  activeSink({
    metric,
    value,
    labels: { ...labels, app: appSlug },
    emittedAt: Date.now()
  });
}

// ─── Discovery — what does each App emit? ────────────────────────

export type DiscoveredTelemetry = TelemetryDeclaration & {
  appSlug: string;
  appName: string;
};

export function discoverTelemetry(): DiscoveredTelemetry[] {
  const out: DiscoveredTelemetry[] = [];
  for (const app of appRegistry.list()) {
    if (!app.telemetry?.length) continue;
    for (const t of app.telemetry) {
      out.push({ ...t, appSlug: app.slug, appName: app.name });
    }
  }
  return out;
}
