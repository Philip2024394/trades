// dashboardBlockRegistry — types.
//
// A DashboardBlock is a self-contained tile in the merchant's
// Business OS control panel. Every block CONSUMES metrics from the
// metricRegistry (never invents them) and reads facets from the
// resolved strategy to adapt what it emphasises.

import type { ComponentType } from "react";
import type { MetricValue } from "@/platform/metrics";

export type DashboardBlockKind =
  | "analytics-card"
  | "statistics-big"
  | "chart-line"
  | "chart-bar"
  | "chart-donut"
  | "table-data"
  | "crm-contact-list"
  | "orders-recent"
  | "jobs-pipeline"
  | "messages-inbox"
  | "calendar-week"
  | "activity-feed"
  | "notifications-center"
  | "suggested-action";

/** (columns × rows) against a 4-column grid. */
export type DashboardBlockSize =
  | "1x1"
  | "1x2"
  | "2x1"
  | "2x2"
  | "3x1"
  | "4x1"
  | "4x2";

export type DashboardBlockDomain =
  | "sales"
  | "operations"
  | "communication"
  | "finance"
  | "content"
  | "reviews"
  | "reach"
  | "actions";

/** Props every block renderer receives. Blocks pick from the passed
 *  metric map; missing entries render as a subtle placeholder. */
export type DashboardBlockRendererProps = {
  /** Which metrics this block instance is showing. Keyed by
   *  metricRegistry slug. */
  metrics: Readonly<Record<string, MetricValue>>;
  /** Optional size override. */
  size?: DashboardBlockSize;
  /** Optional target values from `dashboard.kpiTargets` facet. */
  kpiTargets?: Readonly<Record<string, number>>;
  /** Optional custom heading (from block instance config). */
  title?: string;
};

export type DashboardBlockManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;

  blockType: DashboardBlockKind;
  domain: DashboardBlockDomain;

  supportedSizes: readonly DashboardBlockSize[];

  /** metricRegistry slugs this block reads. Blocks that show
   *  multiple metrics (e.g. table-data) list them all. */
  consumesMetrics: readonly string[];

  /** ResolvedStrategy facets this block reads (typically
   *  `dashboard.kpiTargets`). */
  consumesFacets: readonly string[];

  /** Renderer receives materialised metric values. */
  renderer: ComponentType<DashboardBlockRendererProps>;

  publisher?: { name: string; verified: boolean };
};

export type FrozenDashboardBlockManifest = Readonly<DashboardBlockManifest>;
