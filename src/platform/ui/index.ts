// Mobile UI Kit — the platform's presentation-primitive library.
//
// Every merchant-facing page consumes primitives from here.
// Never hand-write `rounded-2xl border ...` — use a primitive.
//
// This kit does NOT touch business logic. It consumes ResolvedStrategy,
// ContentManifest, BusinessHealthScore etc. — never modifies them.
//
// See CATALOG.md for the full component index + roadmap.

// ─── Tokens ─────────────────────────────────────────────────
export * from "./tokens";

// ─── Content primitives ─────────────────────────────────────
export { Badge } from "./content/Badge";
export type { BadgeProps, BadgeTone } from "./content/Badge";
export { Blockquote } from "./content/Blockquote";
export type {
  BlockquoteProps,
  BlockquoteVariant
} from "./content/Blockquote";
export { Chip } from "./content/Chip";
export type { ChipProps, ChipSize, ChipTone } from "./content/Chip";
export { Divider } from "./content/Divider";
export type {
  DividerProps,
  DividerSpacing,
  DividerVariant
} from "./content/Divider";
export { Overline } from "./content/Overline";
export type { OverlineProps, OverlineTone } from "./content/Overline";
export { Prose } from "./content/Prose";
export type { ProseProps, ProseSize } from "./content/Prose";

// ─── Section headers ────────────────────────────────────────
export { PageHeader } from "./sections/PageHeader";
export type { PageHeaderProps } from "./sections/PageHeader";
export { SectionHeader } from "./sections/SectionHeader";
export type {
  SectionHeaderAlign,
  SectionHeaderProps
} from "./sections/SectionHeader";

// ─── Feedback ───────────────────────────────────────────────
export { Alert } from "./feedback/Alert";
export type { AlertIntent, AlertProps } from "./feedback/Alert";
export { Callout } from "./feedback/Callout";
export type { CalloutProps, CalloutTone } from "./feedback/Callout";

// ─── Primitives ─────────────────────────────────────────────
export { Button } from "./primitives/Button";
export type { ButtonIntent, ButtonProps, ButtonSize } from "./primitives/Button";
export { EmptyState } from "./primitives/EmptyState";
export type { EmptyStateProps } from "./primitives/EmptyState";
export { Grid } from "./primitives/Grid";
export type { GridDensity, GridProps } from "./primitives/Grid";
export { SectionContainer } from "./primitives/SectionContainer";
export type {
  SectionContainerProps,
  SectionSurface
} from "./primitives/SectionContainer";
export { Skeleton, SkeletonCard } from "./primitives/Skeleton";
export type { SkeletonProps } from "./primitives/Skeleton";
export { SurfaceCard } from "./primitives/SurfaceCard";
export type {
  SurfaceCardProps,
  SurfacePadding,
  SurfaceVariant
} from "./primitives/SurfaceCard";

// ─── Cards ──────────────────────────────────────────────────
export { MetricCard } from "./cards/MetricCard";
export type { MetricCardProps } from "./cards/MetricCard";
export { ProjectTile } from "./cards/ProjectTile";
export type { ProjectTileProps } from "./cards/ProjectTile";
export { ServiceTile } from "./cards/ServiceTile";
export type { ServiceTileProps } from "./cards/ServiceTile";

// ─── Navigation ─────────────────────────────────────────────
export { MobileNavDrawer } from "./nav/MobileNavDrawer";
export type {
  MobileNavDrawerProps,
  MobileNavLink
} from "./nav/MobileNavDrawer";
export { StickyBottomActionBar } from "./nav/StickyBottomActionBar";
export type { StickyBottomActionBarProps } from "./nav/StickyBottomActionBar";
export { StickyTopNav } from "./nav/StickyTopNav";
export type { StickyTopNavProps } from "./nav/StickyTopNav";

// ─── Sheets ─────────────────────────────────────────────────
export { BottomSheet } from "./sheets/BottomSheet";
export type { BottomSheetProps } from "./sheets/BottomSheet";

// ─── Gallery ────────────────────────────────────────────────
export { SwipeGallery } from "./gallery/SwipeGallery";
export type { SwipeGalleryProps } from "./gallery/SwipeGallery";
