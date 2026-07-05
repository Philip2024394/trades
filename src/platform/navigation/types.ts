// Navigation Registry — types.
//
// Navigation patterns are page-scale primitives that decide *how
// users move through the app*. Each pattern owns:
//   • its device targeting + behaviours (registry metadata)
//   • its renderer (React component consuming items + brand + theme)
//
// Content (labels, hrefs, icons) is authored per-brand — the pattern
// only decides how items render.

import type { ComponentType } from "react";

export type NavigationPatternKind =
  | "top"
  | "mega"
  | "sidebar"
  | "bottom"
  | "drawer"
  | "sticky"
  | "transparent"
  | "floating";

export type NavigationDeviceTarget = "mobile" | "tablet" | "desktop";

/** A single navigation entry. Extensible without breaking existing
 *  patterns: new fields are optional. */
export type NavigationItem = {
  key: string;
  label: string;
  /** Short form used by dense patterns (bottom tabs / floating). */
  shortLabel?: string;
  href: string;
  /** Lucide icon name — patterns that show icons resolve this to a
   *  component at render. */
  icon?: string;
  /** Numeric badge or short text ("3", "New"). */
  badge?: string | number;
  /** Sub-items for mega-menu / drawer / dropdown patterns. */
  children?: readonly NavigationItem[];
  /** Whether this entry represents the current route. */
  isActive?: boolean;
};

export type NavigationItemShape = {
  key: string;
  labelKey: "label" | "shortLabel" | "iconOnly";
  supportsBadges: boolean;
  supportsSubmenus: boolean;
};

/** Contract every pattern renderer receives. Consumers pass the same
 *  shape regardless of pattern — the pattern picks what it needs. */
export type NavigationRendererProps = {
  items: readonly NavigationItem[];
  brandLabel?: string;
  brandHref?: string;
  brandLogoUrl?: string;
  /** Optional primary CTA displayed inside the nav (e.g. "Book now"). */
  ctaLabel?: string;
  ctaHref?: string;
  /** Route the user is currently on — patterns render active state. */
  currentPath?: string;
};

export type NavigationManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;

  pattern: NavigationPatternKind;
  devices: readonly NavigationDeviceTarget[];
  itemShape: NavigationItemShape;

  /** Layout patterns this navigation slots cleanly into. `["*"]` = any. */
  compatibleLayouts?: readonly string[];
  /** Behaviours this pattern supports — used by AI matching. */
  behaviours?: readonly string[];

  /** The pure React component that renders this navigation pattern. */
  renderer: ComponentType<NavigationRendererProps>;

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenNavigationManifest = Readonly<NavigationManifest>;
