// Template contract — the props every template MUST accept.
//
// Rule (Philip 2026-07-16): templates are fixed UI files. Merchants
// edit their canteen (data). The template reads that data and renders
// it in the template's own layout. Template UI never changes because
// a merchant edited their canteen — only when we deliberately update
// the template code + version it.
//
// This file is the ONE contract. Any file under `src/templates/`
// exports a component whose props satisfy `TemplateProps` and a
// static `meta: TemplateMeta`. Registry (`_registry.ts`) enforces
// this via TypeScript.

import type {
  Canteen,
  CanteenChatPost,
  CanteenDesign,
  CanteenMember,
  CanteenProduct,
  SideLanePost
} from "@/lib/canteens";
import type { PaletteTokens } from "@/lib/paletteTokens";

/** The immutable data the merchant has authored on their canteen.
 *  Templates render this — they do NOT own or mutate it. Every field
 *  here comes from the DB via `canteens.server.ts` loaders. */
export type TemplateCanteenData = {
  canteen:         Canteen;
  admin:           CanteenMember | null;
  members:         readonly CanteenMember[];
  products:        readonly CanteenProduct[];
  featuredProducts: readonly CanteenProduct[];
  chatPosts:       readonly CanteenChatPost[];
  sideLane:        readonly SideLanePost[];
  designs:         readonly CanteenDesign[];
};

/** Viewer + environment context. Same across every template so a
 *  template can decide "show edit affordances" or "route through
 *  ?embed=1 chrome" without redefining conventions. */
export type TemplateViewer = {
  /** Signed-in trade session slug (null for guests / DIY). */
  slug:        string | null;
  /** True when viewer's slug matches canteen.hostSlug. Owner-only
   *  affordances (Edit mode, "Post to your canteen") gate on this. */
  isHost:      boolean;
  /** True when viewer has joined this canteen (member table row). */
  isMember:    boolean;
  /** True when the page is rendered inside the phone-mockup iframe
   *  (`?embed=1`). Templates should hide chrome + shrink outer
   *  padding when true. */
  isEmbedded:  boolean;
  /** DIY audience flag. DIY viewers must not see trade-only content
   *  (per feedback_trade_features_trade_only.md). */
  isDiy:       boolean;
};

/** Actions the template can invoke on the parent canteen page. Kept
 *  callback-shaped so templates never call fetch() directly — every
 *  side effect goes through the parent, keeping data mutation
 *  centralised. */
export type TemplateActions = {
  onJoinCanteen:   () => Promise<void> | void;
  onLeaveCanteen:  () => Promise<void> | void;
  onOpenInvite:    () => void;
  onOpenBusinessCard: () => void;
};

/** The full props envelope. */
export type TemplateProps = {
  data:    TemplateCanteenData;
  viewer:  TemplateViewer;
  palette: PaletteTokens;
  actions: TemplateActions;
};

/** Metadata every template ships alongside its component. Consumed by
 *  the templates picker (/trade-off/edit/[slug]/templates) so cards
 *  render with the right screenshot, name, tagline, and default
 *  palette. */
export type TemplateMeta = {
  /** Unique identifier stored on `hammerex_canteens.template_slug`.
   *  Kebab-case. Include the family word (`template-1-chalk`,
   *  `template-2-iron`) so it reads as a version + variant. */
  slug: string;
  /** Human-readable name shown on the picker card. */
  name: string;
  /** One-line description for the picker. */
  tagline: string;
  /** Which palette this template ships with by default. Merchants
   *  can override at the canteen level (canteen.paletteSlug wins if
   *  set), so this is only the fallback. */
  defaultPaletteSlug: string;
  /** Static screenshot URL for the picker card (fallback to live
   *  iframe when missing). */
  screenshotUrl?: string;
  /** Which demo canteen the picker previews for this template. */
  previewCanteenSlug: string;
  /** Semver-style version of this template's UI. Bumped when we
   *  ship breaking layout changes so existing merchants can either
   *  pin to a prior version or auto-migrate. */
  version: string;
};

/** Every template file exports { meta, default component }. Registry
 *  imports both.
 *
 *  Component signature is intentionally `ComponentType<any>` during
 *  the passthrough phase — every template today forwards props to the
 *  existing CanteenPageShell so they share its exact prop shape. The
 *  strict `TemplateProps` interface above documents the direction of
 *  travel: as each template grows its own bespoke Hero / Feed /
 *  Sidebar and stops depending on the shared shell, its Component
 *  signature narrows to `(props: TemplateProps) => ReactElement`.
 *  When ALL templates satisfy `TemplateProps`, we tighten this to
 *  the strict form. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Template = {
  meta: TemplateMeta;
  Component: React.ComponentType<any>;
};
