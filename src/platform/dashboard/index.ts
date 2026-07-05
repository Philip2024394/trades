// dashboardBlockRegistry — barrel. 14 blocks registered in B6.

import "@/platform/business/facets";  // facet kinds first
import "@/platform/metrics";           // metric kinds first
import "./blocks";

export { dashboardBlockRegistry, REGISTRY_METADATA } from "./registry";
export { StrategyAwareDashboard } from "./StrategyAwareDashboard";
export type {
  DashboardBlockDomain,
  DashboardBlockKind,
  DashboardBlockManifest,
  DashboardBlockRendererProps,
  DashboardBlockSize,
  FrozenDashboardBlockManifest
} from "./types";
