"use client";

// Client shell for the canteen detail page — handles invite modal state
// and stitches the header, main feed, and The Counter together.

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CanteenHeader } from "@/components/xrated/yard/CanteenHeader";
import { CanteenSideLane } from "@/components/xrated/yard/CanteenSideLane";
import { ProductEditorForm, type ProductEditorInitial } from "@/app/trade-off/edit/[slug]/products/[id]/ProductEditorForm";

// Empty-state initial for the inline Add product form on the canteen.
// Mirrors the standalone editor page's EMPTY constant. See
// src/app/trade-off/edit/[slug]/products/[id]/page.tsx.
const PRODUCT_EDITOR_EMPTY: ProductEditorInitial = {
  id: "",
  name: "",
  blurb: "",
  description: "",
  imageUrl: "",
  galleryUrls: [],
  videoUrls: [],
  priceGbp: 0,
  currency: "GBP",
  specs: [],
  tradeCenterListingId: null,
  showInCanteenProducts: true,
  showInTrending: true,
  showInTradeCenter: true,
  featured: false,
  variants: null,
  commerce: null,
  categorySlug: "",
  categoryAspects: {}
};
import { CanteenInviteModal } from "@/components/xrated/yard/CanteenInviteModal";
import { CanteenAdminCard } from "@/components/xrated/yard/CanteenAdminCard";
import { CanteenVideoUpsellModal } from "@/components/xrated/yard/CanteenVideoUpsellModal";
import { CanteenPrivateView } from "@/components/xrated/yard/CanteenPrivateView";
import { CanteenMobilePostsRotator, type RotatorPost } from "@/components/xrated/yard/CanteenMobilePostsRotator";
import {
  CanteenQuickActions,
  CanteenTradeDeals,
  CanteenTrendingRibbon
} from "@/components/xrated/yard/CanteenDashboardSections";
import { CanteenHeroWow } from "@/components/xrated/yard/CanteenHeroWow";
import { CanteenLiveFeedWow } from "@/components/xrated/yard/CanteenLiveFeedWow";
import { CanteenTabbedSection } from "@/components/xrated/yard/CanteenTabbedSection";
import { CanteenBottomNav } from "@/components/xrated/yard/CanteenBottomNav";
import { CanteenVisitUs } from "@/components/xrated/yard/CanteenVisitUs";
import { CanteenSocialLinks } from "@/components/xrated/yard/CanteenSocialLinks";
import { CanteenMobileAppShowcase } from "@/components/xrated/yard/CanteenMobileAppShowcase";
import { CanteenProductPanel } from "@/components/xrated/yard/CanteenProductPanel";
import { CanteenProductFocus } from "@/components/xrated/yard/CanteenProductFocus";
import { CanteenProfileFocus } from "@/components/xrated/yard/CanteenProfileFocus";
import { CanteenCounterExplainer } from "@/components/xrated/yard/CanteenCounterExplainer";
import { canteenProductById } from "@/lib/canteens";
import type { Canteen, SideLanePost, CanteenMember, CanteenProduct, CanteenDesign } from "@/lib/canteens";
import type { CanteenChatPost } from "@/lib/canteens.server";
import { DEFAULT_PALETTE, type PaletteTokens } from "@/lib/paletteTokens";
import { MessageCircle, Send, Heart, MessageSquare, ArrowUpRight, Image as ImageIcon, Video, X, MoreHorizontal, Trash2, ThumbsUp, HelpCircle, ShoppingBag, Tag, Users, Star, Package, Wrench, Radio, UserCog, TrendingUp, LayoutDashboard, BookOpen, Rocket, HardDrive, Sparkles, Pencil, Pin, Flag } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK, BRAND_AMBER } from "@/lib/brand/tokens";
import { MOOD_LIBRARY, suggestMood, type MoodSlug } from "@/lib/yardMoods";
import { requiresProUpload, type MembershipTier } from "@/lib/tierGates";

const CREAM = "#FBF6EC";

// Trade-family footer art on the mobile app view. Rendered behind the
// canteen content, anchored to bottom-center at 100% width. Same
// artwork is also used as the CanteenMobileAppShowcase container
// backdrop (see CONTAINER_BG_BY_TRADE in CanteenMobileAppShowcase.tsx).
// Add new entries as trade-family art is generated.
const CANTEEN_FOOTER_ART_BY_TRADE: Record<string, string> = {
  landscaper:               "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_16_10%20PM.png",
  "garden-designer":        "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_16_10%20PM.png",
  "luxury-garden-designer": "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_16_10%20PM.png",
  electrician:              "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_41_25%20PM.png",
  plasterer:                "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_52_37%20PM.png",
  bricklayer:               "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_56_50%20PM.png"
};

// Fallback thumbnails for canteen post cards that have no photoUrls
// yet. Deterministic pick by author-slug + card index so the same post
// always resolves to the same fallback tile — matches the pattern the
// mobile FeedList uses so a post reads the same on both surfaces.
const CANTEEN_POST_THUMBS = [
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_00_58%20AM.png"
];
function canteenPostThumb(authorSlug: string, salt: number = 0): string {
  const code = authorSlug.charCodeAt(0) + salt;
  return CANTEEN_POST_THUMBS[Math.abs(code) % CANTEEN_POST_THUMBS.length];
}

export function CanteenPageShell({
  canteen,
  sideLane,
  members,
  admin,
  featuredProducts,
  totalProducts,
  initialChatPosts,
  designs,
  initialFocusProductId,
  returnHref,
  returnLabel,
  palette,
  heroVeilOpacity,
  darkMode = false
}: {
  canteen: Canteen;
  sideLane: SideLanePost[];
  members: CanteenMember[];
  admin: CanteenMember | null;
  featuredProducts: CanteenProduct[];
  totalProducts: number;
  /** Real DB posts, top-level only. When the array is empty, the
   *  shell falls back to CANTEEN_MOCK_POSTS. */
  initialChatPosts?: CanteenChatPost[];
  /** Merchant portfolio designs. Empty array is fine — the tabbed
   *  section falls back to the hardcoded DEMO_DESIGNS so the surface
   *  reads full while a new merchant onboards into the designs editor. */
  designs?: CanteenDesign[];
  /** SSR-supplied product ID from `?focus=` — opens the page in
   *  product-focus mode on first paint. Skipped when the URL param
   *  points to a product not in this canteen (server-validated). */
  initialFocusProductId?: string;
  /** SSR-supplied return-pill config from `?from=`. When set, the
   *  product-focus sticky pill reads "Back to {returnLabel}" and
   *  navigates rather than closing the focus view — buyers who came
   *  from Trade Center return to Trade Center, not to canteen chat. */
  returnHref?: string;
  returnLabel?: string;
  /** Merchant's palette color pack. Resolved server-side from
   *  hammerex_trade_off_listings.palette_slug. Passed to CanteenHeroWow
   *  and CanteenBottomNav so the merchant's colour choice drives the
   *  visible surface. */
  palette?: PaletteTokens;
  /** [DEV BUTTON] Hero cream-veil opacity multiplier (0-1). 1 = full
   *  veil (default), 0 = veil transparent so the hero photo shows
   *  100% clear. Driven by `?hero_shade=` dev-tuner query param on
   *  the canteen page. Strip on "remove dev buttons". */
  heroVeilOpacity?: number;
  /** [DEV BUTTON] Dark-mode override. When true, the page background
   *  swaps from cream (#FBF6EC) to near-black and the hero veil (if
   *  any) flips to a black veil — the hero photo itself stays clear
   *  where the veil isn't drawn. Driven by `?theme_mode=dark` on the
   *  canteen page, wired from the templates picker "Dark ON" toggle.
   *  Strip on "remove dev buttons". */
  darkMode?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const arrivedViaInvite = searchParams?.get("invite") === "1";
  // `?embed=1` is set by the CanteenMobileAppShowcase iframe so the
  // canteen page inside the iframe suppresses the same showcase
  // (would otherwise iframe itself and recurse forever).
  const isEmbedded = searchParams?.get("embed") === "1";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [videoUpsellOpen, setVideoUpsellOpen] = useState(false);
  const [privateViewPostId, setPrivateViewPostId] = useState<string | null>(null);
  const [focusedProductId, setFocusedProductId] = useState<string | null>(initialFocusProductId ?? null);
  const [counterExplainerOpen, setCounterExplainerOpen] = useState(false);
  const [profileFocusOpen, setProfileFocusOpen] = useState(false);
  const [viewerSlug, setViewerSlug] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [isMember, setIsMember] = useState<boolean>(false);
  const [isHost, setIsHost] = useState<boolean>(false);
  // Host-only Edit mode. When true, the whole shell renders in an
  // editable state: yellow ring border, sticky "you're editing" strip
  // at the top, in-place editor affordances on each section (Phase 2
  // will wire the stats-container quick-create + product grid). Toggle
  // lives BOTH in CanteenHeader and (per Philip's rule) in the AppShell
  // header beside the bell. AppShell dispatches
  // `canteen:toggle-edit` events; we listen + toggle, then broadcast
  // `canteen:edit-mode-changed` so the AppShell pill stays in sync.
  const [editMode, setEditMode] = useState<boolean>(false);
  useEffect(() => {
    function onToggle() {
      if (!isHost) return; // Non-hosts can't turn it on.
      setEditMode((v) => !v);
    }
    window.addEventListener("canteen:toggle-edit", onToggle);
    return () => window.removeEventListener("canteen:toggle-edit", onToggle);
  }, [isHost]);
  useEffect(() => {
    // Broadcast state so the AppShell header pill can render the right
    // label ("Edit mode" vs "Exit edit").
    window.dispatchEvent(
      new CustomEvent("canteen:edit-mode-changed", { detail: { active: editMode } })
    );
  }, [editMode]);
  useEffect(() => {
    // When Edit mode is force-off (e.g. host toggled off before nav-away),
    // broadcast a clean state on unmount so a subsequent canteen page
    // doesn't inherit stale "on" state.
    return () => {
      window.dispatchEvent(
        new CustomEvent("canteen:edit-mode-changed", { detail: { active: false } })
      );
    };
  }, []);

  // Listen for tile-click events from the Edit-mode stats container.
  // "add-item" opens a two-step inline flow:
  //   1. Kind picker — "What are you adding? Product or Service?"
  //   2. Selected form — Product path uses the eBay-style
  //      ProductEditorForm; Service path shows a placeholder (Phase 2).
  // Members + Reviews are stubs for the next slice.
  // Each creation flow has its own direct-entry tile in the stats
  // container. No picker step — merchants decide Product vs Service by
  // tapping the right tile, not by answering a prompt after tapping a
  // generic "Add Item" button. The old picker + AddItemKindPicker
  // component are kept in the file (dead code, low cost) in case we
  // want a "not sure which?" flow later.
  const [addItemStep, setAddItemStep] = useState<"closed" | "product" | "service" | "live" | "profile" | "trending" | "reviews" | "kitchens" | "features" | "plan-storage">("closed");
  const addProductPanelOpen = addItemStep !== "closed";
  useEffect(() => {
    if (!isHost) return;
    function onAction(e: Event) {
      const detail = (e as CustomEvent).detail as { kind?: string } | undefined;
      if (!detail?.kind) return;
      if (detail.kind === "add-product") {
        setAddItemStep("product");
      } else if (detail.kind === "add-service") {
        setAddItemStep("service");
      } else if (detail.kind === "live-listing") {
        setAddItemStep("live");
      } else if (detail.kind === "edit-profile") {
        setAddItemStep("profile");
      } else if (detail.kind === "edit-trending") {
        setAddItemStep("trending");
      } else if (detail.kind === "manage-reviews") {
        setAddItemStep("reviews");
      } else if (detail.kind === "kitchen-designs") {
        setAddItemStep("kitchens");
      } else if (detail.kind === "button-features") {
        setAddItemStep("features");
      } else if (detail.kind === "plan-storage") {
        setAddItemStep("plan-storage");
      } else {
        return;
      }
      // Smooth scroll so the picker/form is at the top of Mike's view.
      setTimeout(() => {
        document.getElementById("canteen-add-item")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 100);
      // Future: kind === "members" → open invite/manage panel
      // Future: kind === "reviews" → open moderation panel
    }
    window.addEventListener("canteen:edit-action", onAction);
    return () => window.removeEventListener("canteen:edit-action", onAction);
  }, [isHost]);
  const [memberDelta, setMemberDelta] = useState<number>(0);
  // Ticker so relative timestamps ("5m", "3h") stay honest as the
  // user sits on the page. Bumps once per minute; every call to
  // formatAgoShort re-reads Date.now() so the label updates.
  const [, setNowTick] = useState<number>(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const [hostActions, setHostActions] = useState<Array<{
    id: string;
    kind: string;
    title: string;
    deadlineAt: string | null;
    actionLabel: string | null;
    actionHref: string | null;
  }>>([]);
  // Auto-dismiss the host action banner 10s after the merchant arrives
  // on the canteen page. The header bell + red badge + popover keep the
  // signal reachable — Mike doesn't need a persistent banner in his
  // feed. Starts as visible, timer flips it to hidden. Small CSS fade
  // for a soft exit rather than a hard pop.
  const [actionBannerVisible, setActionBannerVisible] = useState(true);
  useEffect(() => {
    if (hostActions.length === 0) return;
    const t = setTimeout(() => setActionBannerVisible(false), 10_000);
    return () => clearTimeout(t);
  }, [hostActions.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trade-off/session");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.slug) setViewerSlug(data.slug as string);
      } catch { /* offline / no session — kebab just stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Membership check — powers the Join / Joined / Manage state on the
  // header. One call on mount; further changes come through the
  // handleJoin / handleLeave optimistic updates below.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/canteens/${encodeURIComponent(canteen.slug)}/membership`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setIsMember(Boolean(data.isMember));
        setIsHost(Boolean(data.isHost));
      } catch { /* offline — header shows non-member state */ }
    })();
    return () => { cancelled = true; };
  }, [canteen.slug]);

  async function handleJoin() {
    // Optimistic — flip state before the network call. If the server
    // rejects (401 / already member / etc) we roll back.
    setIsMember(true);
    setMemberDelta((d) => d + 1);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteen.slug)}/join`, { method: "POST" });
      if (!res.ok) {
        setIsMember(false);
        setMemberDelta((d) => d - 1);
      }
    } catch {
      setIsMember(false);
      setMemberDelta((d) => d - 1);
    }
  }

  async function handleLeave() {
    setIsMember(false);
    setMemberDelta((d) => d - 1);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteen.slug)}/join`, { method: "DELETE" });
      if (!res.ok) {
        setIsMember(true);
        setMemberDelta((d) => d + 1);
      }
    } catch {
      setIsMember(true);
      setMemberDelta((d) => d + 1);
    }
  }

  // Host-only action banner — fetches the notebook's action-required
  // events once we know the viewer is the canteen host. Wrong viewer
  // just skips the request.
  useEffect(() => {
    if (!viewerSlug || viewerSlug !== canteen.hostSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notebook/actions");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.actions)) setHostActions(data.actions);
      } catch { /* offline — banner stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, [viewerSlug, canteen.hostSlug]);

  function handleRemoved(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }
  const privateViewPost = sideLane.find((p) => p.id === privateViewPostId) ?? null;
  const focusedProduct = focusedProductId ? canteenProductById(focusedProductId) : null;
  // Public-facing product list: filters out any product the merchant
  // has hidden from the canteen Products tab via the per-product
  // `showInCanteenProducts` toggle. The owner's post composer still
  // gets the full list so hidden products can be attached to a post.
  const publicProducts = featuredProducts.filter((p) => p.showInCanteenProducts !== false);
  // Map of featured products so post cards can inflate a
  // [[product:<id>]] marker into an inline product tile.
  const productsById: Record<string, CanteenProduct> = {};
  for (const p of featuredProducts) productsById[p.id] = p;
  // Wire this to the real auth session once memberships ship. For now
  // free tier is the mock default so upgrade prompts render.
  const viewerTier: MembershipTier = "free";
  const canPostImage = !requiresProUpload("canteen-image", viewerTier);
  const canPostVideo = !requiresProUpload("canteen-video", viewerTier);
  // [DEV BUTTON] Dark-mode palette override — swaps the palette
  // tokens that would otherwise render dark-on-dark. Overridden:
  //   • bg           → near-black so the mobile wrapper + hero cream
  //                    veil (CanteenHeroWow reads palette.bg) flip
  //                    dark. Hero photo stays clear where the veil
  //                    isn't drawn.
  //   • text         → cream so host name, H1, meta strip stay
  //                    legible. Without this, Gary Hughes / any
  //                    HEADLINE_INK text disappears on light
  //                    palettes (their `text` token is near-black).
  //   • mutedText    → warm mid-grey so the "Trade · Specialist"
  //                    row + KPI labels still read.
  //   • dark         → true so CanteenHeroWow picks the "dark
  //                    palette" text-shadow branch (bright glow
  //                    against the dark hero veil) instead of the
  //                    white-outline branch (invisible on black).
  // Accent + heroLastWord stay intact — the palette's identity
  // survives, only bg/text swap. Strip on "remove dev buttons".
  const effectivePalette = darkMode && palette
    ? {
        ...palette,
        bg:         "#0A0A0A",
        text:       "#F5F0E4",
        mutedText:  "#B8B0A0",
        dark:       true
      }
    : palette;

  return (
    <main
      className="relative min-h-screen overflow-x-hidden"
      style={{
        // GOLDEN RULE: every canteen page under the header uses the
        // platform theme off-white #FBF6EC — regardless of palette.
        // Palette colours belong on the hero, buttons, accents, and
        // feed tiles ONLY. They must NEVER bleed into the outer page
        // bg, because a black or dark page surprises the merchant
        // ("why did my page turn black?"). The palette-driven "hero
        // fade matches page bg" experiment was reverted here: off-
        // white is universal, palette is contained.
        //
        // [DEV BUTTON] darkMode escape hatch — when the templates-picker
        // "Dark ON" toggle sets ?theme_mode=dark, swap the outer page
        // bg to near-black so merchants can preview a dark variant of
        // any palette. Reversible per URL param; strip on
        // "remove dev buttons".
        backgroundColor: darkMode ? "#0A0A0A" : "#FBF6EC",
        // Inset yellow ring when Edit mode is on. 3px so it reads
        // clearly at any viewport without feeling loud. Uses inset
        // box-shadow so it doesn't shift page layout on toggle.
        boxShadow: editMode ? "inset 0 0 0 3px #FFB300" : undefined
      }}
    >
      {/* ── Mobile view — pixel-mirror of the mockup dashboard.
          This section IS "the app" — the phone-native surface. It has
          its OWN bg = palette.bg so dark palettes (Iron, Oak) get their
          native dark chrome back — black for Iron, brown for Oak, etc.
          The outer <main> stays at #FBF6EC (golden rule for the canteen
          page area). This wrapper isolates the app view's bg from the
          canteen page bg — two surfaces, two colours.

          Certain trades also carry a trade-family footer artwork behind
          the app scroll, anchored to the bottom-center so it reads as
          the trade's "ground" under the content:
            • landscaper / garden-designer / luxury-garden-designer →
              wheelbarrow + plants + path
            • electrician → tool bag + sockets + consumer unit + hard hat
            • plasterer   → plaster sacks + buckets + ladder + drill
            • bricklayer  → bricks + wheelbarrow + cement sacks + mesh
          Trades without a mapped image stay clean. Add new entries by
          extending `CANTEEN_FOOTER_ART_BY_TRADE`. */}
      <div
        className="lg:hidden"
        style={{
          backgroundColor: effectivePalette?.bg ?? (darkMode ? "#0A0A0A" : "#FBF6EC"),
          ...(canteen.tradeSlug && CANTEEN_FOOTER_ART_BY_TRADE[canteen.tradeSlug]
            ? {
                backgroundImage:      `url('${CANTEEN_FOOTER_ART_BY_TRADE[canteen.tradeSlug]}')`,
                backgroundPosition:   "bottom center",
                backgroundRepeat:     "no-repeat",
                backgroundSize:       "100% auto",
                backgroundAttachment: "local"
              }
            : {})
        }}
      >
        <CanteenHeroWow
          canteen={canteen}
          hostWhatsapp={admin?.whatsapp ?? null}
          hostReviews={admin?.reviews ?? null}
          hostAvatarUrl={admin?.avatarUrl ?? null}
          addressLine={admin?.showroom?.addressLine ?? null}
          postcode={admin?.showroom?.postcode ?? null}
          city={admin?.city ?? null}
          palette={effectivePalette ?? DEFAULT_PALETTE}
          veilOpacity={heroVeilOpacity}
        />
        {/* Outer sheet container with three inner cards nested inside.
            The outer white sheet reads as one designed surface; each
            inner tile has its own rounded card so the sections stay
            visually distinct. Sheet stays WHITE under every palette
            (including Iron) — dark rendering is scoped to specific
            inner tiles (Live Feed) per the mockup. */}
        <div className="relative z-10 mx-auto -mt-10 max-w-6xl px-3 md:px-6">
          <div
            className="rounded-[28px] border bg-white p-3 shadow-lg md:p-4"
            style={{ borderColor: "#FBF6EC" }}
          >
            <div className="flex flex-col gap-3 md:gap-4">
              {/* Quick Actions — no card wrapper, just the icon row
                  rendered directly on the outer white sheet. */}
              <CanteenQuickActions canteenSlug={canteen.slug} tradeSlug={canteen.tradeSlug} inline/>
              {/* Container 2 — Tabbed section (Feed / Products / Jobs).
                  Same visual card as Live Feed had, but content
                  switches based on the active tab. Products and Jobs
                  tabs reveal via URL hash from Quick Actions or
                  direct link (#tab-products / #tab-jobs).
                  Background = palette.accent (matches the hero CTA
                  buttons — Profile/Card use the same colour). Text
                  inside recoloured to white/light so it reads against
                  any accent colour (navy, warm gold, amber, brown). */}
              <div
                className="canteen-feed-tile-styled rounded-xl p-3 md:p-4"
                style={{
                  // Live Feed tile bg:
                  //   Dark palettes (Iron, Oak) → palette.bg (near-black
                  //     / deep brown) so the tile matches the palette's
                  //     native dark chrome — Template 2 (Iron) reads as
                  //     a black live feed on a black app surface, per
                  //     Philip 2026-07-15.
                  //   Light palettes → palette.accent (warm gold /
                  //     navy / etc.) — the accent-CTA-coloured tile the
                  //     mobile mockup ships with.
                  backgroundColor: palette?.dark
                    ? (palette?.bg ?? "#0A0A0A")
                    : (palette?.accent ?? "#FBF6EC"),
                  border: "1px solid rgba(0,0,0,0.10)"
                }}
              >
                <style>{`
                  .canteen-feed-tile-styled .text-neutral-900 { color: #FFFFFF !important; }
                  .canteen-feed-tile-styled .text-neutral-800 { color: #FFFFFF !important; }
                  .canteen-feed-tile-styled .text-neutral-700 { color: #F5F5F5 !important; }
                  .canteen-feed-tile-styled .text-neutral-600 { color: #E5E5E5 !important; }
                  .canteen-feed-tile-styled .text-neutral-500 { color: rgba(255,255,255,0.75) !important; }
                  .canteen-feed-tile-styled .text-neutral-400 { color: rgba(255,255,255,0.55) !important; }
                  .canteen-feed-tile-styled [class*="bg-white"] { background-color: rgba(255,255,255,0.10) !important; }
                  .canteen-feed-tile-styled [class*="bg-neutral-100"] { background-color: rgba(255,255,255,0.06) !important; }
                  .canteen-feed-tile-styled [class*="bg-neutral-50"] { background-color: rgba(255,255,255,0.08) !important; }
                `}</style>
                <CanteenTabbedSection
                  canteenSlug={canteen.slug}
                  isHost={isHost}
                  posts={pickRotatorPosts(initialChatPosts, canteen.slug)}
                  products={publicProducts}
                  designs={designs ?? []}
                  hostDisplayName={canteen.hostDisplayName}
                  hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
                  hostSlug={canteen.hostSlug}
                  hostWhatsapp={admin?.whatsapp ?? null}
                  tradeSlug={canteen.tradeSlug}
                  tradeLabel={canteen.tradeLabel}
                  hostRating={admin?.reviews && admin.reviews.count >= 5 ? admin.reviews : null}
                  sendToTradeCenter={admin?.sendToTradeCenter ?? false}
                  addressLine={admin?.showroom?.addressLine ?? null}
                  postcode={admin?.showroom?.postcode ?? null}
                  city={admin?.city ?? null}
                  postcodeArea={admin?.postcodeArea ?? null}
                  bioShort={admin?.bioShort ?? null}
                  servicesOffered={admin?.servicesOffered ?? null}
                />
              </div>
              {/* Container 3 — "Customers say it best" reviews callout.
                  Click routes to the in-page Reviews tab via the same
                  CustomEvent bridge as Quick Actions. */}
              <CanteenTradeDeals
                canteenSlug={canteen.slug}
                tradeLabel={canteen.tradeLabel}
                tradeSlug={canteen.tradeSlug ?? null}
                hostSlug={canteen.hostSlug}
                hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
                reviews={admin?.reviews ?? null}
                inline
              />
            </div>
          </div>
        </div>
        {/* Visit us / Where we work card removed from the mobile
            landing 2026-07-13 per Philip. The map and address still
            live on their own pages (/map + /contact) and are reached
            via the "Contact us" quick action. Landing stays cleaner. */}

        {/* Trending ribbon — restored to the mobile app footer area
            2026-07-13 per Philip. Compact 4-tile grid so it reads as
            a footer discovery strip, not a dominant section. When
            canteenSlug + hostFirstName are provided the ribbon opens
            an Instagram Stories-style swipe sheet on tile-tap instead
            of routing to the products page. */}
        <CanteenTrendingRibbon
          tradeLabel={canteen.tradeLabel}
          tradeSlug={canteen.tradeSlug}
          products={featuredProducts
            // Merchant per-product visibility: only include products the
            // merchant flagged as showInTrending. Undefined → treated as
            // true (existing rows without the flag stay visible).
            .filter((p) => p.showInTrending !== false)
            .slice(0, 8)
            .map((p) => ({
              id:                    p.id,
              name:                  p.name,
              imageUrl:              p.imageUrl,
              hrefPath:              `/trade-off/yard/canteens/${canteen.slug}/products/${encodeURIComponent(p.id)}`,
              priceGbp:              p.priceGbp,
              blurb:                 p.blurb,
              tradeCenterListingId:  p.tradeCenterListingId,
              variants:              p.variants
            }))}
          compact
          paletteDark={palette?.dark ?? false}
          canteenSlug={canteen.slug}
          hostSlug={canteen.hostSlug}
          hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
          hostDisplayName={canteen.hostDisplayName}
          hostWhatsapp={admin?.whatsapp ?? null}
          hostCity={admin?.city ?? null}
          sendToTradeCenter={admin?.sendToTradeCenter ?? false}
        />


        {/* Powered by credit — sits between the last content section
            and the floating pill footer. */}
        <div className="mx-auto mt-5 flex max-w-6xl items-center justify-center px-3 md:px-6">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Powered by{" "}
            <Link href="/" style={{ color: "#B8860B" }} className="hover:underline">
              Thenetworkers.app
            </Link>
          </span>
        </div>
        <CanteenSocialLinks
          instagram={`https://instagram.com/${canteen.hostSlug}`}
          tiktok={`https://tiktok.com/@${canteen.hostSlug}`}
          facebook={`https://facebook.com/${canteen.hostSlug}`}
        />

        {/* Clearance so page content doesn't get hidden behind the
            floating pill footer (pill ~40px + 12px bottom pad). */}
        <div className="h-20"/>
      </div>

      {/* Floating pill footer — fixed at bottom of viewport, padded
          off all edges so it hovers like a floating action bar. Star
          rating + WhatsApp CTA on one rounded-full container. */}
      <CanteenBottomNav
        canteenSlug={canteen.slug}
        hostSlug={canteen.hostSlug}
        hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
        hostDisplayName={canteen.hostDisplayName}
        hostWhatsapp={admin?.whatsapp ?? null}
        hostReviews={admin?.reviews ?? null}
        tradeLabel={canteen.tradeLabel}
        hostCity={admin?.city ?? null}
        palette={palette ?? DEFAULT_PALETTE}
      />

      {/* Edit mode sticky strip — shown at the very top of the
          canteen when the host has Edit mode on. Positioned above the
          header so it reads as chrome, not content. Now carries a
          "Washer bag" pill on the right so the merchant can jump to
          the washer purchase page in one tap. */}
      {isHost && editMode && (
        <div
          className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-[#FFB300] px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.18em] text-[#0A0A0A] md:px-6"
          style={{ borderColor: "rgba(0,0,0,0.1)" }}
        >
          <span className="hidden md:inline">
            You&apos;re editing your canteen · changes save as drafts
          </span>
          <span className="md:hidden">
            Editing · draft
          </span>
          <Link
            href={`/trade-off/edit/${canteen.hostSlug}/washers`}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-black/20 bg-[#0A0A0A] px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#FFB300] shadow-sm transition active:scale-[0.97]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Washer bag
          </Link>
        </div>
      )}

      {/* Floating Edit mode toggle — host-only. Same button on every
          breakpoint so mobile Mike can enter/exit Edit mode without
          hunting through the header. Positioned in the top-right,
          respects safe-area on iOS. Hidden inside the desktop header
          on lg+ (where the header pill takes over) to avoid double
          buttons. */}
      {/* Floating mobile Edit-mode toggle removed 2026-07-14 per
          Philip. Edit mode is now driven entirely by the AppShell
          top-right chip which is visible on every page and every
          breakpoint. */}

      {/* ── Desktop view — the richer existing shell. Hidden below lg. */}
      <div className="hidden lg:block">
      <CanteenHeader
        canteen={{
          ...canteen,
          memberCount: Math.max(0, canteen.memberCount + memberDelta)
        }}
        onInvite={() => setInviteOpen(true)}
        onPost={() => { /* wired to the composer in a follow-up */ }}
        isMember={isMember}
        isHost={isHost}
        onJoin={handleJoin}
        onLeave={handleLeave}
        hostHasProducts={totalProducts > 0}
        hostWhatsapp={admin?.whatsapp ?? null}
        hostReviews={admin?.reviews ?? null}
        hostAvatarUrl={admin?.avatarUrl ?? null}
        editMode={editMode}
        onToggleEditMode={() => setEditMode((v) => !v)}
        paletteDark={palette?.dark ?? false}
      />

      {/* Hero stats card — floats at the bottom of the hero, overlapping
          into the cream page below (-mt-8) so it reads as an
          authoritative KPI bar attached to the hero. Rating tile only
          renders when reviews.count >= 5 — a 0.0 rating on a new
          canteen looks worse than showing nothing. */}
      <CanteenHeroStats
        memberCount={Math.max(0, canteen.memberCount + memberDelta)}
        reviews={admin?.reviews ?? null}
        productsCount={totalProducts}
        hostHasProducts={totalProducts > 0}
        editMode={isHost && editMode}
        activeStep={addItemStep}
      />

      {/* Direct-entry creation flows mounted NATIVELY on the canteen
          page (no iframe). Each tile in the stats container is a
          distinct entry point — no picker step. Everything else on the
          page is hidden while a flow is active. */}
      {isHost && editMode && addItemStep !== "closed" && (
        <div id="canteen-add-item" className="mx-auto mt-4 max-w-6xl px-3 md:px-6">
          {addItemStep === "product" && (
            <>
              <div className="mb-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setAddItemStep("closed")}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
                >
                  Cancel
                </button>
              </div>
              <ProductEditorForm
                slug={canteen.hostSlug}
                editToken=""
                initial={PRODUCT_EDITOR_EMPTY}
                isNew={true}
                merchantTier="free"
              />
            </>
          )}
          {addItemStep === "service" && (
            <AddServicePlaceholder
              onCancel={() => setAddItemStep("closed")}
            />
          )}
          {addItemStep === "live" && (
            <LiveListingPlaceholder
              onCancel={() => setAddItemStep("closed")}
            />
          )}
          {addItemStep === "profile" && (
            <EditProfilePlaceholder
              slug={canteen.hostSlug}
              onCancel={() => setAddItemStep("closed")}
            />
          )}
          {addItemStep === "trending" && (
            <EditTrendingPlaceholder
              onCancel={() => setAddItemStep("closed")}
            />
          )}
          {addItemStep === "reviews" && (
            <ManageReviewsPlaceholder
              onCancel={() => setAddItemStep("closed")}
            />
          )}
          {addItemStep === "kitchens" && (
            <KitchenDesignsPlaceholder
              onCancel={() => setAddItemStep("closed")}
            />
          )}
          {addItemStep === "features" && (
            <ButtonFeaturesPanel
              onCancel={() => setAddItemStep("closed")}
            />
          )}
          {addItemStep === "plan-storage" && (
            <PlanStoragePanel
              slug={canteen.hostSlug}
              onCancel={() => setAddItemStep("closed")}
            />
          )}
        </div>
      )}

      {/* Host's product carousel — full-width strip that sits directly
          under the hero on ALL breakpoints. Was previously nested
          inside the main feed section (below the right column on
          mobile); moved here so the host's shop is the first thing
          scrolled to after the hero, before the chat or side lane.
          Hidden when a focus overlay takes over the section OR when
          the add-product panel is active (focused-editing mode). */}
      {!counterExplainerOpen && !profileFocusOpen && !focusedProduct && !addProductPanelOpen && (
        <div
          id="canteen-products-library"
          className="mx-auto max-w-6xl px-3 pt-5 md:px-6 md:pt-6"
        >
          <CanteenProductPanel
            hostDisplayName={canteen.hostDisplayName}
            canteenSlug={canteen.slug}
            products={publicProducts}
            totalCount={totalProducts}
            onSelect={setFocusedProductId}
            manageHref={`/trade-off/yard/canteens/${canteen.slug}/manage`}
            hostRating={admin?.reviews && admin.reviews.count >= 5 ? admin.reviews : null}
          />
        </div>
      )}

      {/* Trending ribbon moved to /products page 2026-07-13 per Philip. */}

      {/* Mobile-only "Live from the canteen" — 3-post rotator that sits
          between the product carousel and the (hidden-on-mobile) grid.
          Takes the newest chat posts and auto-scrolls a 3-slot window;
          tap "Reply" on any card to open the compose overlay page.
          Desktop keeps the full feed + The Counter side-lane instead. */}
      {!counterExplainerOpen && !profileFocusOpen && !focusedProduct && !addProductPanelOpen && (
        <div className="mx-auto max-w-6xl px-3 pt-5 md:px-6 md:pt-6 lg:hidden">
          <CanteenMobilePostsRotator
            posts={pickRotatorPosts(initialChatPosts, canteen.slug)}
            canteenSlug={canteen.slug}
          />
          {/* Big yellow post CTA — routes to the compose overlay page.
              Sticks to the bottom of the mobile rotator so it's always
              obvious how to add your own post. */}
          <Link
            href={`/trade-off/yard/canteens/${canteen.slug}/post`}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.98]"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <MessageCircle size={13} strokeWidth={2.5}/>
            Post to this canteen
          </Link>
        </div>
      )}

      {/* Content grid — feed left, The Counter right (lg+).
          Mobile order: right column (Admin card + short Counter) sits
          ABOVE the main feed so users get "who runs this" + "what's
          on The Counter" as context before scrolling into the chat.
          Desktop keeps the original main-left / rail-right split. */}
      {/* Main feed + right rail. Hidden when Mike's Add product panel
          is active so his focus stays on the form (per Philip's spec:
          only stats container + product form visible in that mode). */}
      <div
        className={`mx-auto max-w-6xl px-3 pb-16 pt-5 md:px-6 md:pt-6 ${
          addProductPanelOpen ? "hidden" : ""
        }`}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main feed — min-w-0 so wide children (carousel) can't push
              the right column off-screen. */}
          <section className="order-2 min-w-0 lg:order-none">
            {/* Counter explainer — replaces the general feed when the
                user taps "Know The Flow?" on the marketplace stream. */}
            {counterExplainerOpen ? (
              <CanteenCounterExplainer onBack={() => setCounterExplainerOpen(false)} />
            ) : profileFocusOpen && admin ? (
              <CanteenProfileFocus
                admin={admin}
                bannerUrl={canteen.headerBgUrl}
                onBack={() => setProfileFocusOpen(false)}
              />
            ) : focusedProduct ? (
              <CanteenProductFocus
                product={focusedProduct}
                hostDisplayName={canteen.hostDisplayName}
                hostSlug={canteen.hostSlug}
                hostRating={admin?.reviews && admin.reviews.count >= 5 ? { avg: admin.reviews.avg, count: admin.reviews.count } : null}
                onBack={() => setFocusedProductId(null)}
                returnHref={returnHref}
                returnLabel={returnLabel}
              />
            ) : null}

            {/* Private-view — lands ABOVE the composer when the user
                clicks a side-lane card. Only this user sees it. */}
            {privateViewPost && !focusedProduct && !counterExplainerOpen && !profileFocusOpen && (
              <CanteenPrivateView
                post={privateViewPost}
                onPass={() => setPrivateViewPostId(null)}
                onMakeOffer={() => {
                  // Wire this to the real offer flow when the schema lands.
                  setPrivateViewPostId(null);
                }}
              />
            )}

            {/* Composer — hidden while any focus view is open (each
                focus surface has its own CTAs; composer would be
                out of place). */}
            {focusedProduct || counterExplainerOpen || profileFocusOpen ? null : <>
            {/* Invite landing — arriving via ?invite=1 and not yet a
                member surfaces a nudge card with the Join CTA. Host
                and existing members ignore the query param. */}
            {arrivedViaInvite && !isMember && !isHost && (
              <div
                className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border-2 p-3 shadow-sm"
                style={{ borderColor: BRAND_AMBER, backgroundColor: "#FFFBEB" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "#78350F" }}>
                    You were invited
                  </div>
                  <div className="mt-0.5 text-[13px] font-black text-neutral-900">
                    Join {canteen.name} to post, reply, and see The Counter feed.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleJoin}
                  className="inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
                  style={{ backgroundColor: BRAND_GREEN_DARK }}
                >
                  Join canteen
                </button>
              </div>
            )}
            {/* Host action banner — only visible when the viewer is
                the canteen host AND their notebook has open actions.
                Auto-dismisses 10s after arrival — Mike sees it once,
                the header bell + red badge keep the actions reachable.
                Fades out (opacity + max-height) rather than popping. */}
            {hostActions.length > 0 && (
              <div
                className={`overflow-hidden rounded-xl border-2 shadow-sm transition-all duration-500 ${
                  actionBannerVisible ? "mb-3 max-h-[400px] opacity-100" : "mb-0 max-h-0 opacity-0"
                }`}
                style={{ borderColor: BRAND_AMBER, backgroundColor: "#FFFBEB" }}
                aria-hidden={!actionBannerVisible}
              >
                <div className="flex items-center gap-2 px-3 pt-2.5 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "#78350F" }}>
                  <HelpCircle size={12}/>
                  {hostActions.length === 1 ? "1 action needed" : `${hostActions.length} actions needed`}
                  <span className="text-neutral-400">·</span>
                  <span className="text-neutral-500">Your notebook</span>
                </div>
                <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(217,119,6,0.15)" }}>
                  {hostActions.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-[12.5px] text-neutral-900">{a.title}</span>
                      {a.actionHref && a.actionLabel && (
                        <a
                          href={a.actionHref}
                          className="inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                          style={{ backgroundColor: BRAND_YELLOW }}
                        >
                          {a.actionLabel}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Composer + full feed — hidden on mobile. The mobile
                rotator above already surfaces the same posts (in the
                same CanteenPostCard-style card visuals) and the yellow
                "Post to this canteen" pill routes to the compose
                overlay page. Below lg we render neither the inline
                composer nor the full post list; desktop keeps them. */}
            <div className="hidden lg:block">
            <CanteenPostComposer
              canteenSlug={canteen.slug}
              canPostImage={canPostImage}
              canPostVideo={canPostVideo}
              onUpgradeNeeded={() => setVideoUpsellOpen(true)}
              onPosted={() => router.refresh()}
              attachableProducts={viewerSlug === canteen.hostSlug ? featuredProducts : []}
            />

            {/* Post cards — real DB posts if we got any, otherwise
                the mock feed. Dim to 40% when a private-view is
                open so the user understands the group is still
                moving behind. */}
            <div
              className="flex flex-col gap-3 transition-opacity"
              style={{ opacity: privateViewPost ? 0.4 : 1, pointerEvents: privateViewPost ? "none" : "auto" }}
            >
              {(() => {
                if (initialChatPosts && initialChatPosts.length > 0) {
                  const visible = initialChatPosts.filter((p) => !removedIds.has(p.id));
                  if (visible.length === 0) return <EmptyPostsState canteenName={canteen.name}/>;
                  return visible.map((p) => (
                    <CanteenPostCard
                      key={p.id}
                      post={{
                        id: p.id,
                        who: p.authorDisplayName,
                        handle: p.authorSlug,
                        postedAgo: formatAgoShort(p.createdAt),
                        body: p.body,
                        moodExplicit: (p.moodSlug ?? undefined) as MoodSlug | undefined,
                        reactions: p.reactionsLike,
                        reactionsAgree: p.reactionsAgree,
                        reactionsQuestion: p.reactionsQuestion,
                        replies: p.replyCount,
                        photoUrls: p.photoUrls,
                        avatarUrl: p.authorAvatarUrl
                      }}
                      tradeLabel={canteen.tradeLabel}
                      viewerSlug={viewerSlug}
                      hostSlug={canteen.hostSlug}
                      canteenSlug={canteen.slug}
                      canteenName={canteen.name}
                      hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
                      productsById={productsById}
                      onRemoved={handleRemoved}
                    />
                  ));
                }
                return mockPostsForCanteen(canteen.slug).map((p, i) => (
                  <CanteenPostCard
                    key={i}
                    post={p}
                    tradeLabel={canteen.tradeLabel}
                    viewerSlug={viewerSlug}
                    hostSlug={canteen.hostSlug}
                    canteenSlug={canteen.slug}
                    canteenName={canteen.name}
                    hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
                    productsById={productsById}
                    onRemoved={handleRemoved}
                  />
                ));
              })()}
            </div>
            </div>
            </>}
          </section>

          {/* Right column — admin card + The Counter marquee. HIDDEN
              on mobile (< lg): the mobile view is a trade showcase
              (host products + 3-post rotator only), no community
              chrome. Both surfaces return at lg+. */}
          <div className="order-1 hidden min-w-0 lg:order-none lg:block">
            {admin && (
              <div className="hidden lg:block">
                <CanteenAdminCard
                  admin={admin}
                  members={members}
                  totalMemberCount={canteen.memberCount}
                  onOpenProfileFocus={() => setProfileFocusOpen(true)}
                />
                {/* Mobile app showcase — sits directly under the admin
                    "View profile" card in the desktop right column.
                    Dual-purpose: QR handoff for Mick's customers +
                    silent sales pitch to future canteen owners. Hidden
                    when the canteen page is itself embedded inside the
                    showcase's iframe (`?embed=1`) to prevent recursion. */}
                {!isEmbedded && (
                  <div className="mt-3">
                    <CanteenMobileAppShowcase
                      hostSlug={canteen.hostSlug}
                      hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
                      tradeLabel={canteen.tradeLabel}
                      tradeSlug={canteen.tradeSlug ?? null}
                      heroImageUrl={canteen.headerBgUrl}
                      heroTitle={canteen.name}
                      canteenSlug={canteen.slug}
                      editMode={isHost && editMode}
                    />
                  </div>
                )}
              </div>
            )}
            <CanteenSideLane
              posts={sideLane}
              onOpenPost={(postId) => setPrivateViewPostId(postId)}
              onKnowTheFlow={() => setCounterExplainerOpen(true)}
            />
          </div>
        </div>
      </div>
      </div>{/* ← close hidden lg:block desktop wrapper */}

      <CanteenInviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        canteenSlug={canteen.slug}
        canteenName={canteen.name}
      />
      <CanteenVideoUpsellModal
        open={videoUpsellOpen}
        onClose={() => setVideoUpsellOpen(false)}
        canteenTradeLabel={canteen.tradeLabel}
      />
    </main>
  );
}

// ─── Mobile rotator input helper ─────────────────────────────

/** Pick up to 6 recent posts from either the DB feed or the fallback
 *  mock so the mobile 3-slot rotator has something to cycle through
 *  even on a fresh canteen. Returns the shape RotatorPost expects.
 *  Fallback is slug-aware so the Iron reference canteen
 *  (uk-rated-electricians) shows electrician posts, not kitchen ones. */
function pickRotatorPosts(
  dbPosts: CanteenChatPost[] | undefined,
  canteenSlug: string
): RotatorPost[] {
  if (dbPosts && dbPosts.length > 0) {
    return dbPosts.slice(0, 6).map((p) => ({
      id:                p.id,
      authorDisplayName: p.authorDisplayName,
      authorSlug:        p.authorSlug,
      body:              p.body,
      createdAt:         p.createdAt,
      imageUrl:          p.photoUrls?.[0] ?? null,
      authorAvatarUrl:   p.authorAvatarUrl,
      reactionsLike:     p.reactionsLike,
      replyCount:        p.replyCount
    }));
  }
  // Fall back to the shell's mock feed so demo canteens still show
  // a live pulse before real posts land.
  return mockPostsForCanteen(canteenSlug).slice(0, 6).map((p, i) => ({
    id:                `mock-${i}`,
    authorDisplayName: p.who,
    authorSlug:        p.handle,
    body:              p.body,
    createdAt:         approxIsoFromAgoLabel(p.postedAgo),
    imageUrl:          p.photoUrls?.[0] ?? null,
    authorAvatarUrl:   p.avatarUrl ?? null,
    reactionsLike:     p.reactions,
    replyCount:        p.replies
  }));
}

function approxIsoFromAgoLabel(label: string): string {
  const m = label.match(/^(\d+)([mhdw])$/);
  if (!m) return new Date().toISOString();
  const n = parseInt(m[1], 10);
  const unitMs = m[2] === "m" ? 60_000
    : m[2] === "h" ? 60 * 60_000
    : m[2] === "d" ? 24 * 60 * 60_000
    : 7 * 24 * 60 * 60_000;
  return new Date(Date.now() - n * unitMs).toISOString();
}

// ─── Canteen post composer types ─────────────────────────────

type PostKind = "chat" | "question" | "showcase" | "make-offer";

// ─── Mock canteen posts (Yard-style, mood auto-detected) ─────

type CanteenPost = {
  /** Real DB row id when the post came from hammerex_canteen_posts.
   *  Optional so the mock feed can still render without one. */
  id?: string;
  who: string;
  handle: string;
  postedAgo: string;
  body: string;
  /** Optional explicit mood — falls back to suggestMood(body). */
  moodExplicit?: MoodSlug;
  reactions: number;
  reactionsAgree?: number;
  reactionsQuestion?: number;
  replies: number;
  photoUrls?: string[];
  /** Poster's avatar image. When null we fall back to the yellow
   *  initial chip; when set the header renders an <img>. */
  avatarUrl?: string | null;
};

// Canteen feed = chat + questions + announcements only.
// For-sale posts route to The Counter, NOT the main feed — so the
// for-sale / sold-out mood characters should never appear on canteen
// cards. The mood picker (below) filters them out defensively.
// Member avatars — reuse the same Unsplash face crops the canteen
// member roster uses (MOCK_CANTEEN_MEMBERS in src/lib/canteens.ts)
// so the poster's face on the feed card matches their face in the
// "Members" popover / trade profile / directory.
const CANTEEN_MEMBER_AVATARS: Record<string, string> = {
  "mike-watson":     "https://ik.imagekit.io/9mrgsv2rp/Untitleddasdaasbbbb.png",
  "tom-fisher":      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces",
  "rachel-simms":    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
  "craig-mcdermott": "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2010_58_56%20PM.png",
  "terry-nolan":     "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
  "james-holt":      "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&fit=crop&crop=faces",
  "kate-morris":     "https://images.unsplash.com/photo-1601456108021-fbdba97b9d47?w=200&h=200&fit=crop&crop=faces",
  "paul-webb":       "https://images.unsplash.com/photo-1622555094100-5ae7bfe4a3b5?w=200&h=200&fit=crop&crop=faces"
};

// Default (kitchen-fitter) mock post feed — used on Mike Watson's
// canteen and any canteen without a slug-specific override below.
const CANTEEN_MOCK_POSTS_KITCHEN: CanteenPost[] = [
  {
    who: "Mike Watson",
    handle: "mike-watson",
    postedAgo: "2h",
    body: "Anyone tried the new Blum soft-close on 40mm oak? Fitting a corner unit next week and the standard hinges have been catching.",
    reactions: 6, replies: 3,
    avatarUrl: CANTEEN_MEMBER_AVATARS["mike-watson"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2009_02_52%20PM.png"]
  },
  {
    who: "Rachel Simms",
    handle: "rachel-simms",
    postedAgo: "4h",
    body: "Recommendations for a supplier doing 24h templating in the NW? Current one just went to 5 days and I've a customer breathing down my neck.",
    reactions: 4, replies: 8,
    avatarUrl: CANTEEN_MEMBER_AVATARS["rachel-simms"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2009_08_27%20PM.png"]
  },
  {
    who: "Tom Fisher",
    handle: "tom-fisher",
    postedAgo: "7h",
    body: "Smashed the Whittington fit-out today — 3-day install into a full new-build kitchen. Client over the moon, big handshake at the end.",
    reactions: 18, replies: 6,
    avatarUrl: CANTEEN_MEMBER_AVATARS["tom-fisher"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2009_00_03%20PM.png"]
  },
  {
    who: "Craig McDermott",
    handle: "craig-mcdermott",
    postedAgo: "1d",
    body: "Important notice for anyone on the Alder Grove site — access diverted through the north gate all next week. Save yourselves the ballache I had this morning.",
    reactions: 22, replies: 4,
    avatarUrl: CANTEEN_MEMBER_AVATARS["craig-mcdermott"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2009_05_53%20PM.png"]
  }
];

// Electrician mock post feed — used on the Iron reference canteen
// (uk-rated-electricians). Same shape as kitchen posts, different
// trade context so the Iron demo reads as a real sparks community.
const CANTEEN_MOCK_POSTS_ELECTRICIAN: CanteenPost[] = [
  {
    who: "Craig McDermott",
    handle: "craig-mcdermott",
    postedAgo: "2h",
    body: "Wired up an 11kW EV charger into a 100A supply today — head-end had 78A already loaded. DNO notification going in tomorrow. Anyone recently had a DNO refuse an EVSE install on a pre-existing rewire?",
    reactions: 11, replies: 5,
    avatarUrl: CANTEEN_MEMBER_AVATARS["craig-mcdermott"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2011_29_45%20PM.png"]
  },
  {
    who: "Terry Nolan",
    handle: "terry-nolan",
    postedAgo: "5h",
    body: "New Amendment 2 EICR code changes are catching people out on old fuseboards. Just red-carded a Wylex plug-in RCBO board because the DP isolation was undersized. If you're still using pre-2011 Wylex NB, worth checking your books.",
    reactions: 17, replies: 8,
    avatarUrl: CANTEEN_MEMBER_AVATARS["terry-nolan"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2011_33_31%20PM.png"]
  },
  {
    who: "Mike Watson",
    handle: "mike-watson",
    postedAgo: "1d",
    body: "Consumer unit swap this morning on a 1930s semi. Old rewireables + no bonding to the incoming water. Two hours of extra 10mm² and now she's happy. Sparks jobs on kitchen fit-outs paying more than the joinery some weeks.",
    reactions: 22, replies: 6,
    avatarUrl: CANTEEN_MEMBER_AVATARS["mike-watson"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png"]
  },
  {
    who: "James Holt",
    handle: "james-holt",
    postedAgo: "2d",
    body: "Sparks + gas combo job on a new build in Nottingham. Full first-fix rewire + boiler install in 5 days. Any Yorkshire sparks up for a similar sub next month? I'm booked but the site foreman wants a preferred trade list.",
    reactions: 9, replies: 4,
    avatarUrl: CANTEEN_MEMBER_AVATARS["james-holt"],
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_08_09%20AM.png"]
  }
];

// Plumber mock post feed — used on the Slate reference canteen
// (uk-verified-plumbers). Same shape as the other feeds, plumber-
// specific content so the Slate demo reads as a real plumbing
// community.
const CANTEEN_MOCK_POSTS_PLUMBER: CanteenPost[] = [
  {
    who: "James Holt",
    handle: "james-holt",
    postedAgo: "1h",
    body: "Just finished a Worcester 4000 combi swap on a 1950s semi. Old back-boiler out, new combi in the loft with SPD, 10-year warranty registered. Homeowner said hot water is unrecognisable. Anyone else finding Worcester 4000 lead times slipping to 5+ weeks direct?",
    reactions: 14, replies: 6,
    avatarUrl: CANTEEN_MEMBER_AVATARS["james-holt"],
    photoUrls: null
  },
  {
    who: "Kate Morris",
    handle: "kate-morris",
    postedAgo: "4h",
    body: "Skimmed a bathroom last week after a full re-pipe. Fitter left the pipework in the wall proud by 2mm — had to feather-skim across a metre to hide the ridge. Sparks + plumbers: please dot-and-dab the pipework FLUSH before you tape up. It matters.",
    reactions: 22, replies: 11,
    avatarUrl: CANTEEN_MEMBER_AVATARS["kate-morris"],
    photoUrls: null
  },
  {
    who: "Craig McDermott",
    handle: "craig-mcdermott",
    postedAgo: "1d",
    body: "Sparks + gas combo job today. First-fix electrics for a kitchen refurb — 32A ring, cooker circuit, isolators. Plumber timeline slipping means I'm back Thursday for second fix instead of Wednesday. Anyone else finding gas engineer availability worse this month?",
    reactions: 9, replies: 5,
    avatarUrl: CANTEEN_MEMBER_AVATARS["craig-mcdermott"],
    photoUrls: null
  },
  {
    who: "Paul Webb",
    handle: "paul-webb",
    postedAgo: "2d",
    body: "Wet-room build in a loft conversion. Trays fitted, gulley in, drainage tied to soil stack. Waiting on plumber to first-fix the shower + basin before we tile. If anyone has an under-tray waterproofing membrane brand they swear by, drop a name — trying to avoid callbacks.",
    reactions: 11, replies: 7,
    avatarUrl: CANTEEN_MEMBER_AVATARS["paul-webb"],
    photoUrls: null
  }
];

// ─── Phase 3 trade-themed feeds (2026-07-15) ─────────────────
// One post-set per palette demo canteen so each iPhone preview in
// the templates picker shows on-theme feed content — not kitchen
// posts everywhere. Admin authors their own posts (single-hand feed
// per demo; multi-member depth added when real merchants sign up).
// Feed post image URLs reuse 2026 ImageKit library entries matched
// to the trade — same convention as canteen hero images.
const IK = "https://ik.imagekit.io/9mrgsv2rp";
const P = (rel: string) => `${IK}/${rel}`;
const CANTEEN_MOCK_POSTS_CARPENTER: CanteenPost[] = [
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "10m", body: "Subbed on an oak-frame porch build for @aidan-frost's crew in Solihull today — truss up, rafters going on, stone pier below. Same joinery rules as any timber frame: sole plate first, plumb everything twice.", reactions: 24, replies: 5, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/4cbfbc8a67a7512e6742574e38537fca.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "12m", body: "Big veranda canopy framing in progress on a garage retrofit — 6m run, curved sole plate laminated from four boards, cut in the workshop, dry-fitted on-site. Aidan's crew's second job like this on my patch this month.", reactions: 20, replies: 4, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/1be0fdf473712c28ec30059c9c1530ef.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "15m", body: "New-build roof truss + OSB decking install today in Chippenham. Two-storey timber frame, roof carpentry laying out. Hi-vis on and roped in — the wind was strong up there.", reactions: 23, replies: 5, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/b5938354c2fde868067bd2be981dc2f6.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "20m", body: "Bit of a departure — subbing on a treehouse build for @rowan-ashcroft's crew. Cedar-shingle roof going on around a mature oak, ladders each side, cobble base laid for the tree collar. Same jointing rules apply as any timber frame.", reactions: 29, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/2f456eb541f26dfedcd3ff0bf9c0abad.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "40m", body: "Structural timber-frame raise in Wiltshire today. Team on the ridge, oak-peg mortise joints going in by hand. Weather held for the whole set.", reactions: 34, replies: 8, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/084f21873251f02e29e609e1e77b26f9.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "2h", body: "Rip cuts on the DeWalt bench saw at 6am. New-build joist stock going in tomorrow — better to prep before the site's live.", reactions: 22, replies: 5, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsd.png"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "5h", body: "Nail-gun through 4x2 studs on the new-build in Whitby. Two-storey timber frame, tomorrow we sheet with OSB. Good day on site.", reactions: 28, replies: 7, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/Untitleddfsdfzzdsfsdff.png"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "8h", body: "Roof trusses going up in Redland. Prefab from the yard, nail-gun on the ridge, three lads on the deck. Should be watertight by Friday.", reactions: 31, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/Untitleddfsdfzzdsfsdffsd.png"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "1d", body: "Formwork carpentry on a Southmead basement dig. Ply forms braced against the rebar cage — concrete pour Thursday. Slow, careful work.", reactions: 18, replies: 4, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/Untitleddfsdfzzdsfsdffsddsd.png"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "1d", body: "First-fix flooring on a Portishead conversion — engineered oak, 220mm boards, glued + secret-nailed to the joists. Client loves how it looks in the morning light.", reactions: 26, replies: 3, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/b5757afffcd7671db9c5657356dec79e.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "2d", body: "Plywood delivery just landed in the workshop. 18mm birch for a run of kitchen carcasses next week. Best sheet ply I've had in 12 months.", reactions: 14, replies: 2, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/369b0923175db2ea84dd4caf884d14f9.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "2d", body: "Bench full of veneer samples + timber offcuts + blueprints for a new-build console. Client's picking finish tomorrow — six oaks and a walnut on the tape.", reactions: 11, replies: 3, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ee4093d9ce6198bb9e1f36806790e08c.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "3d", body: "End-of-day toolbox — hammer, jack plane, nails, offcuts. Every joint on today's stud wall by hand. Not glamorous, but stays true 30 years.", reactions: 19, replies: 5, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/aaa55d3fe3b00c44b79593d8d54ed11c.jpg"] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "4d", body: "1st fix on the Bishopston extension today. Steel beam bearer in, joists spanning 4.2m. Sub-floor tomorrow if the weather holds.", reactions: 12, replies: 4, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%205,%202026,%2010_56_22%20PM.png")] },
  { who: "Owen Thompson", handle: "owen-thompson", postedAgo: "5d", body: "Anyone in the SW got a good source for kiln-dried structural pine? My usual timber merchant is 3 weeks behind.", reactions: 6, replies: 9, avatarUrl: null }
];
// Joinery posts — Edward Halliwell workshop content matched to
// bench + hand-tool photography. Kept separate from carpenter feed
// so each surface reads as its own trade community.
const CANTEEN_MOCK_POSTS_JOINER_WOOD: CanteenPost[] = [
  { who: "Edward Halliwell", handle: "edward-halliwell", postedAgo: "1h", body: "Morning at the bench — light through the workshop windows, hand tools laid out, ready for a run of sash frames. Best hour of the day.", reactions: 26, replies: 5, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/c804a7f8aaa537b6f922d52cf615939b.jpg"] },
  { who: "Edward Halliwell", handle: "edward-halliwell", postedAgo: "3h", body: "Frame assembly on a bespoke set of interior doors — mortise-and-tenon, hand-cut, glued and cramped up overnight. No dowels, no biscuits.", reactions: 22, replies: 4, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/983529fb46cacb257b43dafbe877f4d9.jpg"] },
  { who: "Edward Halliwell", handle: "edward-halliwell", postedAgo: "7h", body: "Design study for a bespoke library door — hand-drawn on the bench, cast-iron hardware to spec. Client's finalising the panel bead this week.", reactions: 18, replies: 3, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/5aaec8a06fa19110674118f2aa2924ea.jpg"] },
  { who: "Edward Halliwell", handle: "edward-halliwell", postedAgo: "1d", body: "Sharpening the bench chisels between commissions — 10-degree hollow-ground, honed on Japanese waterstones. Ready for a run of walnut dovetails tomorrow.", reactions: 15, replies: 2, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/7b4128799dc4d74c74f4a1e69d3435ba.jpg"] },
  { who: "Edward Halliwell", handle: "edward-halliwell", postedAgo: "2d", body: "Vintage No. 4 Stanley plane back in service after a full restore. Blade lapped, sole flattened, cap iron polished — cuts silk-smooth on curly maple.", reactions: 21, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffs.png"] },
  { who: "Edward Halliwell", handle: "edward-halliwell", postedAgo: "3d", body: "Planing walnut stiles for a corner cabinet. Old-style bench, morning light, single-blade plane. This kind of work keeps the trade alive.", reactions: 24, replies: 4, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/Untitleddfsdfzzdsfsdf.png"] },
  { who: "Edward Halliwell", handle: "edward-halliwell", postedAgo: "4d", body: "Sash window restoration in Harrogate. Draught-proofing seals + weight rebalance — client can hear the difference already.", reactions: 16, replies: 3, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%205,%202026,%2012_06_42%20AM.png")] }
];
const CANTEEN_MOCK_POSTS_FURNITURE: CanteenPost[] = [
  { who: "Harriet Blake", handle: "harriet-blake", postedAgo: "2h", body: "Bandsaw milling a slab of English elm for a farmhouse table. 3m long, single board, book-matched leaves. Waiting six months for this timber to season was worth it.", reactions: 32, replies: 7, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/fdfb32014411b6719f4d60a09b4f5292.jpg"] },
  { who: "Harriet Blake", handle: "harriet-blake", postedAgo: "6h", body: "Design sketch of a new refectory table — 1500mm x 800mm, English walnut, hand-cut through-tenons on the trestles. Client signing off tomorrow.", reactions: 21, replies: 4, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/dbf7cbb6e6d5bf7687010dac50e95e09.jpg"] },
  { who: "Harriet Blake", handle: "harriet-blake", postedAgo: "1d", body: "CNC precision setup on the new commission — hand-drawn curve traced with the router bit before the first cut. Marries hand-work and machine.", reactions: 14, replies: 3, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/2e1ba8395051fdc3b2d5f8b2dbd2cb3ad.jpg"] },
  { who: "Harriet Blake", handle: "harriet-blake", postedAgo: "3d", body: "Loading live-edge oak into the workshop — going to be a wall-mount console for a Cotswolds client. Character grain, natural bark inclusion left in.", reactions: 27, replies: 5, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/6b868b252c0a43aa5d826da447c349a7.jpg"] }
];
const CANTEEN_MOCK_POSTS_WOOD_CARVER: CanteenPost[] = [
  { who: "Callum Ford", handle: "callum-ford", postedAgo: "3h", body: "Chisel-and-mallet portrait commission — eagle, one-piece basswood, four weeks of shaping and detailing. Client picks it up on Saturday.", reactions: 38, replies: 9, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/a533c1bd9280ab9696f6c4dced041a6f.jpg"] },
  { who: "Callum Ford", handle: "callum-ford", postedAgo: "1d", body: "Floral relief panel underway on the workbench — acanthus scrollwork, all hand-cut with a single skew knife. Slow, meditative work.", reactions: 41, replies: 11, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/93bf4c7289b643b54c98fec085a28aa2.jpg"] },
  { who: "Callum Ford", handle: "callum-ford", postedAgo: "3d", body: "New engraved chisel arrived from a bench-mate in Devon — my name on the handle. It's the small things that make the workshop feel like home.", reactions: 19, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddd.png"] }
];
const CANTEEN_MOCK_POSTS_WOOD_RESTORER: CanteenPost[] = [
  { who: "Miles Warrington", handle: "miles-warrington", postedAgo: "2h", body: "Refectory table restoration signed off today — split joinery cleaned out, ebony patches let in, French-polished. Client couldn't tell where the repairs are.", reactions: 44, replies: 8, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/3137f2abf8096eed67335bda1d2b047b.jpg"] },
  { who: "Miles Warrington", handle: "miles-warrington", postedAgo: "1d", body: "Georgian sideboard came in filthy — 40 years in a garage. Stripped, joints reglued with hide, doors re-veneered, hand-rubbed shellac finish. Different piece entirely.", reactions: 37, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/6aec7c93dabe2b38806b2370ed223148.jpg"] },
  { who: "Miles Warrington", handle: "miles-warrington", postedAgo: "3d", body: "Reclaimed oak beams stacked in the workshop — 200-year-old barn frame. Being cut down for a client's kitchen island. History goes into the next generation.", reactions: 28, replies: 5, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/fdfb32014411b6719f4d60a09b4f5292.jpg"] }
];
const CANTEEN_MOCK_POSTS_WOOD_STAINER: CanteenPost[] = [
  { who: "Ryan Hollis", handle: "ryan-hollis", postedAgo: "4h", body: "Spray-finish day on a run of teak garden tables. Osmo UV Protection Oil, three thin coats, 20-minute flash between each. Bench looks glass-smooth already.", reactions: 26, replies: 4, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/f6906127ca6b272c347366e0ec1049f9.jpg"] }
];
// Tree House Builders — bespoke canopy builds. 20 posts, each anchored
// to a photographed project. Watermarked source images (t03 Happy Happy
// Nester, t07 zenviora.xyz, t13 veo) are cropped from the top via
// ImageKit URL transform `?tr=cm-extract,fo-top,ar-4-5` so the bottom
// watermark strip is trimmed off before the image ever renders.
const IK_TH = "https://ik.imagekit.io/9mrgsv2rp";
const CROP_TOP = "?tr=cm-extract,fo-top,ar-4-5";
const CANTEEN_MOCK_POSTS_TREE_HOUSE: CanteenPost[] = [
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "35m", body: "Green-roofed A-frame handed over in Totnes today. Spiral stair on live oak trunks, raised veg bed borders, stone path in. Client's kids already claimed it.", reactions: 42, replies: 9, avatarUrl: null, photoUrls: [`${IK_TH}/2a103a44bcbcea865e53a0eb865667c7.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "1h", body: "Timber-framed loft build with steel roof, wrap-around balcony, cottage-garden planters. Reclaimed oak beams from a Devon barn — dead sound after 200 years.", reactions: 36, replies: 6, avatarUrl: null, photoUrls: [`${IK_TH}/59e0990ee7c6107d6ceb8c25c4960109.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "3h", body: "Snow-day cabin in the oak — commissioned Christmas surprise, lit up with 400 warm-whites. Clients said their kids opened the door and just went quiet.", reactions: 48, replies: 11, avatarUrl: null, photoUrls: [`${IK_TH}/cb31e56e74c9df7eac5f4d9f2265048c.jpg${CROP_TOP}`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "5h", body: "Cottage-style build on a mature oak — string lights, curtains, hydrangea border, swing bench alongside. This one photographs like a fairy tale but the joinery is dead serious.", reactions: 39, replies: 7, avatarUrl: null, photoUrls: [`${IK_TH}/2dcf60100d1a3969a1a5f4dfeef7028a.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "7h", body: "Rope-hammock retreat wrapped in ivy — jungle-style build in a Bristol back garden. Full loft-bed inside, dropped hammock nook underneath. Small footprint, huge personality.", reactions: 33, replies: 5, avatarUrl: null, photoUrls: [`${IK_TH}/0ffafef83d8d04d673dba61e9b5c8121.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "9h", body: "Pallet-deck platform build in an urban Manchester garden — 'M' monogram on the gable at the client's request. Whitewashed cladding, floral sofa underneath. Family movie-nights sorted.", reactions: 27, replies: 4, avatarUrl: null, photoUrls: [`${IK_TH}/b979d305cebd199ade4026df75e000f8.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "11h", body: "Zen-cabin lit by outdoor chandeliers in a Somerset arboretum — arched windows, dark metal roof, hammock underneath, rock border. Feels like a retreat by dinner time.", reactions: 44, replies: 8, avatarUrl: null, photoUrls: [`${IK_TH}/808124ca6d268e78601351d4b57c2c3a.jpg${CROP_TOP}`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "14h", body: "Victorian turret build in Exeter — spiral stair, lavender window boxes, formal-planted approach. Client wanted 'the treehouse from a storybook'. Two kids, one adult retreat.", reactions: 37, replies: 6, avatarUrl: null, photoUrls: [`${IK_TH}/6868518e336d047905b9f09d1a14f3e7.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "18h", body: "Blossom-canopy multi-cabin estate — 3 individual cabins around a central spiral stair, koi pond and bridge below. Six-month build. Biggest job we've delivered this year.", reactions: 61, replies: 15, avatarUrl: null, photoUrls: [`${IK_TH}/52b67046677b74b10af91069b341617b.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "21h", body: "Twin spiral stairs up a mature oak, dusk lighting, pallet-deck lounge below. Manor-house garden in Wiltshire — sits well with the formal parterre next door.", reactions: 41, replies: 7, avatarUrl: null, photoUrls: [`${IK_TH}/8d1a41993f83bcd2f2e3e33275a3dabc.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "1d", body: "Mid-build in a Toronto suburb — cedar-shingle roof going on, ladders each side, cobble base for the tree collar. Team's dry-fitting the balustrade before we lock the joints.", reactions: 34, replies: 5, avatarUrl: null, photoUrls: [`${IK_TH}/2f456eb541f26dfedcd3ff0bf9c0abad.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "1d", body: "In-progress build with the pond forms in — 'moat' around the tree, spiral stair going up. Client's a landscape architect so every detail's spec'd tight. Great to work to a brief this precise.", reactions: 29, replies: 6, avatarUrl: null, photoUrls: [`${IK_TH}/36fb3309a8ed8158b291634f07b2ebe6.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "1d", body: "Framing day on the Utah gazebo build. Mountain backdrop, curved deck going down to the pool. Started at 6am so we could do the ridge joinery before it got hot.", reactions: 32, replies: 4, avatarUrl: null, photoUrls: [`${IK_TH}/f075226192984c2bd912faeaa9f25461.jpg${CROP_TOP}`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "2d", body: "Grown-up build in a New England garden — cedar decking, black steel balustrade, park-bench-and-pergola pad below. Doubles as a bar for outdoor entertaining. First proper adult-only build we've delivered.", reactions: 38, replies: 8, avatarUrl: null, photoUrls: [`${IK_TH}/ad4a8b97d5a436080ca2575a22b7cf39.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "2d", body: "Cedar cottage on a mature oak in Dorset — grey shingle roof, iron balustrade, kids' desk inside. Woodland planting around the trunk hides the platform legs beautifully.", reactions: 35, replies: 6, avatarUrl: null, photoUrls: [`${IK_TH}/9e554d7dbd1d3d172a8e22af46ad6fbb.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "3d", body: "Cedar + glass build in a Pacific Northwest redwood — full-height windows on both gable ends, chandelier inside, spiral stair down the trunk. Owner wanted it to disappear into the canopy. Reckon it does.", reactions: 52, replies: 11, avatarUrl: null, photoUrls: [`${IK_TH}/2a02f34f8e67fb69671c95d64ab4c7fb.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "3d", body: "Bali-inspired luxury build overlooking a rice paddy — bedroom loft above, sunset lounge deck below with hanging lantern trees. Six weeks of design + eight weeks on-site.", reactions: 58, replies: 12, avatarUrl: null, photoUrls: [`${IK_TH}/948bdf8e6ffae8d932767f763f78695c.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "4d", body: "Backyard build with a slide + plunge pool underneath. Sedum green roof so the local birds still nest above. Client's twin boys have opinions about the slide radius — they were right, we made it steeper.", reactions: 46, replies: 9, avatarUrl: null, photoUrls: [`${IK_TH}/08b8bbd8d451562ede3e1fa99c24dc0c.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "5d", body: "Cottage build under a mature oak in a Cotswolds meadow. String-lit gable, curtain-drawn window, hanging bench, stone-edged flower border. Photographed at last light — nothing filter-fixed, that's the real lantern glow.", reactions: 43, replies: 8, avatarUrl: null, photoUrls: [`${IK_TH}/a926505f830aca6899b57a9a9c9df5bc.jpg`] },
  { who: "Rowan Ashcroft", handle: "rowan-ashcroft", postedAgo: "6d", body: "Painted cottage on a Sussex oak, hanging macramé chair + purple papasan below on the crazy-paved patio. Small footprint, lantern-lit path. Client's daughter's reading nook.", reactions: 37, replies: 5, avatarUrl: null, photoUrls: [`${IK_TH}/0a482767e77f4d3307d91bccdea1a6c3.jpg`] }
];
// Water Feature Specialists — bespoke fountains + waterfall walls +
// lagoon pools. Small feed because it's a niche trade; both posts
// carry hero-scale project photos rather than progress shots.
// Canopy Specialists — bespoke oak-frame door canopies, verandas,
// car canopies. All 11 posts photo-anchored to real projects: shop-
// made or in-progress builds plus finished installs.
const IK_CAN = "https://ik.imagekit.io/9mrgsv2rp";
const CANTEEN_MOCK_POSTS_CANOPIES: CanteenPost[] = [
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "1h", body: "Timber-frame car canopy signed off yesterday alongside a stone cottage in Prestbury. Green-oak posts, matching slate roof to the main house, cobble drive under. Doubled as a covered walkway to the front door.", reactions: 34, replies: 7, avatarUrl: null, photoUrls: [`${IK_CAN}/15b7014afd1bcaeff30d0013a0fe95d8.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "3h", body: "Detail from a covered walkway install in Cheshire — 8m run of oak trusses, hand-cut mortise-and-tenon, wrought-iron lanterns dropped between the beams. Owner walked me the length of it three times before signing off, said it read as \"lived-in from day one\".", reactions: 41, replies: 9, avatarUrl: null, photoUrls: [`${IK_CAN}/25e09fee653b406acec6fb6e73d3e7c9.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "5h", body: "Dark-oak gable canopy on a shingle-clad porch — sunset handover in Alderley Edge. Curved-arch bracket detail hand-carved in the workshop over three days. Client's second commission with us.", reactions: 37, replies: 6, avatarUrl: null, photoUrls: [`${IK_CAN}/7111c22e1cf71822731684fdd8873c3f.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "8h", body: "Full oak-frame porch canopy over a raised timber-deck entry. Truss detail visible from below, stone-clad columns, downlighters in the beam pockets. Landing shot at the end of a two-week install.", reactions: 32, replies: 5, avatarUrl: null, photoUrls: [`${IK_CAN}/79defdd2ce4fca1a120c923d4906ff50.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "10h", body: "Simple pitched canopy over a stained-oak front door — modest scale, big impact. Stone-corbel end supports, cedar-shingle roof to match the surrounding cladding. Two-day install, minimal fixings into the render.", reactions: 26, replies: 4, avatarUrl: null, photoUrls: [`${IK_CAN}/dd0c52977959e32de1bf7c183d308bd2.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "13h", body: "Cotswold-stone cottage got a proper oak canopy today — hand-planed corbel supports, seasoned oak boards on the underside, welded steel gutter running the pitch. Owner's spent 15 years without one — job done.", reactions: 44, replies: 10, avatarUrl: null, photoUrls: [`${IK_CAN}/93efa274ab0db39481e4f60400500771.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "1d", body: "Modern oak-frame canopy dropped onto a 1930s red-brick semi. Cambered rafters, slate ridge cap, iron ties into the brickwork with resin-bonded studs. Client had scaffolding removed by lunchtime — cleanest handover we've had this year.", reactions: 39, replies: 8, avatarUrl: null, photoUrls: [`${IK_CAN}/890c1e9c30ac381fb9ac163a0e6dad9f.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "1d", body: "Pitched oak-frame canopy over a leaded-glass front door — Cotswold-stone wall behind. Traditional bracket detail, welded lead ridge, deep overhang so rain sits clear of the sill. Number '11' plate installed same day.", reactions: 31, replies: 6, avatarUrl: null, photoUrls: [`${IK_CAN}/b62455d9a55667db2aac3ddb81699b17.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "2d", body: "Rustic log-and-timber canopy install on a stone-clad house — decorative wrought-iron ornaments installed either side. Signature build for a client who wanted a lodge feel. Signed off last week, photographing today for the portfolio.", reactions: 47, replies: 12, avatarUrl: null, photoUrls: [`${IK_CAN}/5a1894751925a82870e8bda002d47c94.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "3d", body: "Oak-frame porch install in progress on a Solihull semi. Truss up, roof rafters going on, stone pier below. Client's watching every step — first frame of oak they've seen up close, apparently.", reactions: 28, replies: 5, avatarUrl: null, photoUrls: [`${IK_CAN}/4cbfbc8a67a7512e6742574e38537fca.jpg`] },
  { who: "Aidan Frost", handle: "aidan-frost", postedAgo: "4d", body: "Rafter framing for a large veranda canopy over a double-garage — captured mid-build. Full 6m run, curved sole plate cut from a single laminated blank. Waiting on the felt roll before we sheath.", reactions: 35, replies: 7, avatarUrl: null, photoUrls: [`${IK_CAN}/1be0fdf473712c28ec30059c9c1530ef.jpg`] }
];
const CANTEEN_MOCK_POSTS_WATER_FEATURE: CanteenPost[] = [
  { who: "Tobias Marlow", handle: "tobias-marlow", postedAgo: "3h", body: "Mediterranean courtyard water feature signed off in a Cotswolds manor today. Wall-mounted stone fountain feeding a turquoise plunge pool, sunken stair entry, iron footbridge above. Six months of design and build.", reactions: 47, replies: 12, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/9b08d4bb58890f657a357d12d48e5f6a.jpg"] },
  { who: "Tobias Marlow", handle: "tobias-marlow", postedAgo: "2d", body: "Rock-waterfall lagoon-pool commission handed over yesterday. Multi-tier fall dropping 3.5m into a natural-edge pool, integrated poolside bar behind, tropical planting on both banks. Full plumbing routed through the retaining wall — no visible pipework.", reactions: 61, replies: 18, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/42f47d2611b1e31f45cd0780022a7010.jpg?tr=cm-extract,fo-bottom,ar-4-5"] }
];
const CANTEEN_MOCK_POSTS_INTERIOR: CanteenPost[] = [
  { who: "Rebecca Ashworth", handle: "rebecca-ashworth", postedAgo: "1h", body: "Colour scheme approved on the Marylebone flat — Farrow & Ball De Nimes on cabinetry, warm brass hardware. Install starts Monday.", reactions: 14, replies: 5, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2003_45_28%20AM.png")] },
  { who: "Rebecca Ashworth", handle: "rebecca-ashworth", postedAgo: "5h", body: "Meeting with a fabric mill in Somerset next week — bespoke curtain weave for a Kensington drawing room. Slow luxury.", reactions: 9, replies: 3, avatarUrl: null },
  { who: "Rebecca Ashworth", handle: "rebecca-ashworth", postedAgo: "2d", body: "Anyone recommend a wallpaper hanger in central London who's OK with hand-blocked papers? My usual has retired.", reactions: 7, replies: 11, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_STONE: CanteenPost[] = [
  { who: "David Whitmore", handle: "david-whitmore", postedAgo: "3h", body: "Lime mortar rebuild on the west wall of a Grade II listed church. Slow set — 3-week cure before we can move to the tower repointing.", reactions: 11, replies: 4, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2001_46_00%20PM.png")] },
  { who: "David Whitmore", handle: "david-whitmore", postedAgo: "1d", body: "Bath stone quoin replacement on a Georgian terrace. Sourced matching stone from Corsham quarry — the old and new blend perfectly.", reactions: 15, replies: 2, avatarUrl: null },
  { who: "David Whitmore", handle: "david-whitmore", postedAgo: "3d", body: "SPAB approval landed for the manor house lime plastering. Six-month job. Absolute privilege.", reactions: 22, replies: 6, avatarUrl: null }
];
const IK_R = "https://ik.imagekit.io/9mrgsv2rp";
const CROP_TOP_R = "?tr=cm-extract,fo-top,ar-3-4";
const CANTEEN_MOCK_POSTS_ROOFER: CanteenPost[] = [
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "5m", body: "Cedar shake install on a summerhouse in Bakewell — worker up the pitch with the drill, hand-splitting shakes to fit the gable trim. Slower than composite tile but the sound as the client's kids play under it is unbeatable.", reactions: 27, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/106a1d315869aacc2add07606cb89750.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "8m", body: "Cedar shake gable finished this morning. Diminishing courses, tight overlap, stainless nails only — will silver in about 3 years to the classic weathered look.", reactions: 22, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/22794f87e9cefcecd010a05bb8d5424c.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "12m", body: "Full aerial handover of a modern hip-roof new-build in Cheshire — dark grey interlocking tiles, twin ventilation stacks, kickers on every corner. Drone shot at zenith. Clean geometry.", reactions: 31, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/be6189c4672ed2a2dc667a6ac1e40ec3.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "14m", body: "Lead-cap ridge going down on a cedar-clad gable in the Peaks. Traditional standing-seam finish, welded corners, breather membrane behind. Nothing beats hot-lead work for a heritage build.", reactions: 26, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/aed24e6ffaf1232a2dba76d655cd6ad3.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "16m", body: "Slate install in progress on a Yorkshire new-build. Scaffolding up, roll of felt at the ridge, first courses down. Cold morning but the work goes fast when the pitch is generous.", reactions: 20, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/7ef74a472c67a3f16bd9fac17449d281.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "18m", body: "Red pantile detail on a client's chimney dormer today. Fresh-hip-cap flashing kit set into the lead — old-school flashing bond, no mastic. Should last 60 years on a good tile.", reactions: 24, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/60cdf695d0715dadf17e80d4311c7a94.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "20m", body: "Scalloped clay tile close-up on a heritage dormer. Half-hipped end detail with dark-lead trim standing seam. Two days on the dormer alone — the little details are what makes it worth doing.", reactions: 29, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/6cabbd4a2fd80b1642f40c2d1892e426.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "15m", body: "Slate strip in progress today — old slates lifting cleanly on the ripper tool, roof jacks holding the row while we work down the pitch. Watch the tin, one of the lads got a splinter in a knuckle this morning.", reactions: 21, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/28d0bd6c24e8dd3e9eb074038930bfcb.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "25m", body: "Slate laying on a Scottish rain-lash today — Sika stickers on the batten, skew knife trimming, patting them down with a gloved hand. Slow methodical work but the finish will outlive us.", reactions: 25, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/e911685f6fc77742d93489b633ccf72f.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "35m", body: "Standing-seam metal panel install today — drill through the pre-formed rib into the batten, no fixings through the flat pan. Watertight before we're off the roof.", reactions: 17, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/5147f1574217b1d7a476db5aa9efa8f8.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "40m", body: "Clay pantile install at sunset in Bakewell — south-facing pitch, harness on, dry ridge system going in. Two days ahead of schedule.", reactions: 32, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/70d2eaa0f786429b723d6852652eaff2.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "55m", body: "Full-terrace re-roof underway on a row of red-brick semis in Chesterfield. Scaffolding up the front, tiles stacked in triangular piles waiting for the fitters. Best day of weather we're going to get all week.", reactions: 34, replies: 8, avatarUrl: null, photoUrls: [`${IK_R}/1bffdb65d9127a2055ccc6fc835bb9f9.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1h", body: "Terracotta pantile new-build in Doncaster today — two lads flying up the hip, ridge tiles landing at the peak. Nice symmetrical roof to work on, no chimneys, no valleys.", reactions: 28, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/a7f573c98f97e84a66cb81354bddf4f1.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "3h", body: "Interlocking pantile going down on a mansard restoration. Skylight kit prepped, batten spacing checked twice — one wrong course and the whole thing has to come off.", reactions: 19, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/bd422e5b93e73203340d90cc928307fb.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "6h", body: "Handmade terracotta pantile setting-out shot. Batten spacing tight to the gauge, small piles waiting to feed the run. Sound of tiles clacking together is the best background noise on any job.", reactions: 22, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/c446cddae7c6808abdfe7b25ecaf085b.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "9h", body: "Modern black shingle new-build in the Peaks — hip roof design, matching stone cladding, panelled soffits. Handed over yesterday, drone shot at first light.", reactions: 31, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/a8d1933df402ed6051537e36732f7a2f.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "12h", body: "Forest-green standing-seam metal on a cedar-clad chalet build in the Lakes. Zinc coping, hidden rainwater goods, standing seam every 400mm. Modern roofing done well.", reactions: 37, replies: 7, avatarUrl: null, photoUrls: [`${IK_R}/ecaa94ef1856638cd3e9d01e045ed9ab.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1d", body: "Navy metal-panel roof on a modern gable in Cumbria. Complex hip + intersection geometry — pre-cut ridge caps and step-flashing kept the day tidy. Client sent the sunset shot back — that's a keeper.", reactions: 33, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/198cdded60cb7434aae5a0c0cae0bfef.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1d", body: "Stripping a hip ridge on a 1990s tile roof today. Two courses off already, batten stripes showing, hip iron laid ready. Rain forecast tomorrow so we're chasing the dry.", reactions: 26, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/3e29d475f53d95a6e270c6bae2f552c9.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1h", body: "Coil-nailer on a shed re-roof in Chesterfield. Standard 3-in-1 asphalt shingle, quick turnaround for the homeowner — one afternoon, done.", reactions: 14, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/1d0108027f0750efe71f93bc0ae52d74.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "3h", body: "Slate survey on a Peak District farmhouse today — 20% of the tops delaminated. Full strip + relay quoted with matching Welsh slate. 3-week job.", reactions: 21, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/612dd521c884f1a84b80038b375f1325.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "5h", body: "Team strip-and-relay in progress on a two-storey semi. Ridge board exposed, new battens going in, felt roll ready for the underlay. Cold day but the crew's flying.", reactions: 24, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/b3785840d16b30030c7caea90d062172.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "7h", body: "Slate strip on a Welsh farmhouse — 100+ year old graduated slates, careful handling to sort re-usable vs skip. Chimney flashing to remake at the same time.", reactions: 26, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/d293d79ac4cb0cc9a23434979344b557.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "10h", body: "New-build slate roof in the Peaks — 500mm x 250mm Spanish slate, staggered laying, copper nails. Client's a stone mason, keeping the standard high.", reactions: 29, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/9711c22eb619f2d31dfd55c5f4b7a48b.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "12h", body: "Aerial drone shot of yesterday's sign-off — full house re-roof with graduated stone-slate blend on a Derbyshire manor. Golden hour, no filter, worth the two weeks on scaffold.", reactions: 41, replies: 9, avatarUrl: null, photoUrls: [`${IK_R}/93a8da9188b19aaf799a8e600b122f3b.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1d", body: "Handmade clay pantile install underway — traditional over-under lay, battens spaced to the tile gauge. Slower than modern interlocking but the finish is worth it.", reactions: 22, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/aabfebaa847430bc6c7f24e103fc3e6f.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1d", body: "Cedar shingle install on a Cotswold outbuilding — Western Red cedar, breather membrane behind, stainless nails only. Ages to silver in 3 years.", reactions: 27, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/c8c3e87e832d9d4bcec47b7fed212873.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1d", body: "Scalloped clay tile ridge going down on a mansard restoration in Whitby. Old boys used to lay these in a day; we're two lads and it's taken us three. Different pace now.", reactions: 19, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/cf0d14558c9588e443e6a46c3be521e4.jpg${CROP_TOP_R}`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "2d", body: "Zinc valley lining welded up between two thatch pitches — this one's a Grade II job in North Yorkshire. Sealed the last standing seam yesterday, waiting for the thatcher to finish either side.", reactions: 17, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/b6b7a1bc81d757d02bbf991683a5792d.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "3d", body: "Detailed slate progression photo from the Sheffield semi — 20-course lift over the eaves showing the graduation from smaller heads to larger tails. Client wanted the pattern on record for insurance.", reactions: 15, replies: 2, avatarUrl: null, photoUrls: [`${IK_R}/54b484804168f69430b10852534594aa.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "4d", body: "Anthracite interlocking tile with roof-window install on a Barnsley new-build. Flashing kit fitted, all sealed to the underlay. Never had a leak on one of these units.", reactions: 20, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/fa3502eeae57ff5733ae9e52898e6e27.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "5d", body: "Weathered slate close-up from a heritage repair in the Dales — 150 years old, still watertight. Never underestimate what a well-laid slate roof will do if the fixings are right.", reactions: 24, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/81b79c889ce66919303f627a7aaea3bb.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "6d", body: "Slate texture up close on a rustic Cumbrian farmhouse roof — random-width, mixed colour, laid tight. This is what \"looks like it's always been there\" costs on a heritage job.", reactions: 18, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/bf8eb7814733d64f049ada483ffbd4b6.jpg`] },
  { who: "Gary Hughes", handle: "gary-hughes", postedAgo: "1w", body: "Anyone selling second-hand handmade clay tiles? Doing a heritage repair and the merchant wants £4.50 a tile.", reactions: 8, replies: 14, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_GUTTERING: CanteenPost[] = [
  { who: "Dylan Reid", handle: "dylan-reid", postedAgo: "1h", body: "Anthracite half-round install signed off in Fulwood — matched the tile roof colour perfectly, brick-mounted downpipe with swan-neck offset around the eaves. Nice clean line.", reactions: 22, replies: 4, avatarUrl: null, photoUrls: [`${IK_R}/559d24dd273f4ac60396c1d819997f03.jpg`] },
  { who: "Dylan Reid", handle: "dylan-reid", postedAgo: "5h", body: "First rain after yesterday's install — captured this on a callback visit. Two-inch overflow rate, gutter's clearing perfectly, downpipe running fast. Homeowner sent me the video first thing.", reactions: 29, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/840969aba49a2cd496f6872e6c672520.jpg`] },
  { who: "Dylan Reid", handle: "dylan-reid", postedAgo: "1d", body: "Modern square-line black system going onto a new-build. Full mitred corner cut on-site — 45° angles, sealed with butyl tape, no external brackets showing. Looks factory-finished.", reactions: 25, replies: 5, avatarUrl: null, photoUrls: [`${IK_R}/85cbf19d75ffa14ffde727e9821f4616.jpg`] },
  { who: "Dylan Reid", handle: "dylan-reid", postedAgo: "2d", body: "Brown ogee replacement on a 1970s semi — old cast-iron was rotting through, replaced with polyester-coated aluminium that colour-matches the fascia. 25-year guarantee.", reactions: 18, replies: 3, avatarUrl: null, photoUrls: [`${IK_R}/224d95517b4d22fafdef198aa5439826.jpg`] },
  { who: "Dylan Reid", handle: "dylan-reid", postedAgo: "3d", body: "Traditional white uPVC replacement on a Victorian villa — ogee profile matching the original, fascia + soffit refurbed at the same time. Full board vented for the loft insulation.", reactions: 14, replies: 2, avatarUrl: null, photoUrls: [`${IK_R}/0a4b31d6f64c478a5dced783845f7dc0.jpg`] }
];
const CANTEEN_MOCK_POSTS_COPPER_FLASHING: CanteenPost[] = [
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "30m", body: "Fresh copper gutter + downpipe run signed off today on a stone-clad house in Ripon. Full ogee profile, standing-seam joins, no visible bracket work. Sun catching the freshly-formed sheet — this is why we bench-work every joint.", reactions: 38, replies: 8, avatarUrl: null, photoUrls: [`${IK_R}/e6cd0946a9be5d805afbe740d5a1b8eb.jpg`] },
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "1h", body: "Bright copper gutter + downpipe with elbow bend on a cedar-shingle dormer — new fit yesterday. Bright polish now, will patina to a deep bronze in 5 years, then verdigris green another decade after. Only material that gets better with age.", reactions: 44, replies: 10, avatarUrl: null, photoUrls: [`${IK_R}/0819e487596e35d181567184f39acf2e.jpg`] },
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "3h", body: "Copper eaves + downpipe run on a Cape Cod-style client's back porch. Two 90° bends around the cornice + a step-flashing detail into the wall. Clean lines and no leaks — that's the whole job.", reactions: 31, replies: 6, avatarUrl: null, photoUrls: [`${IK_R}/1778528aca641ad363c2ac53d3dcae44.jpg`] },
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "6h", body: "Detail shot from this morning — copper gutter with matching copper leaf-guard mesh, brass-plated retainer clips, on a heritage slate roof. Client wanted zero-maintenance for the next 40 years. Job done.", reactions: 41, replies: 9, avatarUrl: null, photoUrls: [`${IK_R}/acebef325927ec340441f41e14f33033.jpg`] },
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "1d", body: "Copper downpipe with cast decorative hopper installed today on a Sussex hacienda — bench-formed by hand, brass swan-neck fittings, patina left natural. Six weeks lead-time on the hopper alone.", reactions: 34, replies: 8, avatarUrl: null, photoUrls: [`${IK_R}/b407959abbcf3566a3ded9ee7a8ca0d6.jpg`] },
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "1d", body: "Copper valley + dormer flashings on a Cologne-style scalloped-tile roof in Harrogate — bench-formed sheet copper, 0.7mm gauge, standing-seam joints. This one'll patina in about 5 years.", reactions: 41, replies: 11, avatarUrl: null, photoUrls: [`${IK_R}/9d4e999cc7a04a90e1aefcc8801009f2.jpg`] },
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "3d", body: "In-progress copper dormer install on a Ripon manor. Twin pyramid caps, standing-seam ridge, matching decorative wrought railings between. Weeks of setup work — install itself is the fast part.", reactions: 38, replies: 7, avatarUrl: null, photoUrls: [`${IK_R}/b6ff3b094b161b7cce2db22b69bb232a.jpg`] },
  { who: "Wilf Adair", handle: "wilf-adair", postedAgo: "5d", body: "Detail shot of the finished copper dormer on the Ripon job — signed-off panel joinery, mansard curve caught in profile against the slate. Client held the ladder while I shot this. Best kind of client.", reactions: 45, replies: 12, avatarUrl: null, photoUrls: [`${IK_R}/9983490cfcca854cb008110704501b6f.jpg`] }
];
const CANTEEN_MOCK_POSTS_COPPER: CanteenPost[] = [
  { who: "Nathan Barrett", handle: "nathan-barrett", postedAgo: "4h", body: "New copper sheet delivery in from Bristol — 1.5mm for the gutter runs on the Sedgeley job. Ready to press-form next week.", reactions: 8, replies: 1, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2003_29_09%20AM.png")] },
  { who: "Nathan Barrett", handle: "nathan-barrett", postedAgo: "1d", body: "Weld-repair on a Victorian conservatory downpipe. Original owners kept the lead flashing — saved them £900 vs full replacement.", reactions: 12, replies: 2, avatarUrl: null },
  { who: "Nathan Barrett", handle: "nathan-barrett", postedAgo: "3d", body: "Tender in for a Grade II church roof — copper cladding to replace stolen lead. Slow process, satisfying work.", reactions: 17, replies: 5, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_POOL: CanteenPost[] = [
  { who: "Ben Callaghan", handle: "ben-callaghan", postedAgo: "3h", body: "Fibreglass pool shell dropped into the excavation this morning. Perfect fit — surveyor's laser was worth every penny.", reactions: 14, replies: 4, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%2015,%202026,%2007_30_54%20AM.png")] },
  { who: "Ben Callaghan", handle: "ben-callaghan", postedAgo: "1d", body: "Retrofit heat pump upgrade on a Poole client's pool — swapped their gas boiler for a Vaillant AroTHERM. Half the running cost.", reactions: 11, replies: 3, avatarUrl: null },
  { who: "Ben Callaghan", handle: "ben-callaghan", postedAgo: "4d", body: "Anyone got experience with saltwater conversions on gunite pools? Client's asking and I want to be honest about the maintenance shift.", reactions: 6, replies: 8, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_LANDSCAPER: CanteenPost[] = [
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "10m", body: "Lakeside cottage garden sign-off in the Lake District today — mixed cottage borders around the stone terrace, cascade planting spilling down the retaining wall, hydrangeas at the water's edge. The house sells the shot, but the garden earns the sale.", reactions: 41, replies: 9, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/523b1f1ecc7751b29ab0274d332b4884.jpg"] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "20m", body: "Curved raised planter finished tonight in a Newnham back garden. Warm LED strip under the skirt, wildflower mix on top — cornflower, ox-eye, red campion. Client asked for meadow-in-a-box and this is close.", reactions: 27, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/4cac1b021929821a65d2a34a41c88b3d.jpg"] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "35m", body: "Zen courtyard install signed off in Grantchester. White pebble beds, silver lantern trio, mirror pool, stone-clad fire pit as the anchor. Slower to build than it looks — every pebble laid by hand.", reactions: 33, replies: 9, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/15cdce4e24050c4f2f426dd8fceb1d86.jpg"] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "1h", body: "Curved lawn medallion cut into the Trumpington courtyard today. Pea-shingle margin around the circle, sofa lounge under the porch overhang. Homeowners wanted something that reads different from every window.", reactions: 31, replies: 8, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/e9e801591f7930c0eb79c126e026311d.jpg"] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "3h", body: "Pergola with built-in bench seat finished in Waterbeach. White painted timber, slatted side screen for the afternoon shade, cushions dropped in. 3 days start to finish. Great little garden-room upgrade under £4k.", reactions: 26, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/id-11134207-7ra0j-mcw7hzy0ks6wbe@resize_w900_nl.webp"] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "1d", body: "Sloped garden in South Cambridge signed off yesterday. Charcoal block retaining walls with LED strip underlighting, integrated planters running down each level, firepit lounge on the top terrace. Sun trap in the afternoon.", reactions: 34, replies: 9, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/e4f5f64409accc428e37b825ee1bbd21.jpg"] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "2d", body: "Estate lawn regeneration in Cambridge — soil aeration + spring seed. Green as anything in three weeks.", reactions: 18, replies: 4, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%2015,%202026,%2007_21_23%20AM.png")] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "3d", body: "Full garden overhaul signed off in Chesterton. Reclaimed timber deck for the dining spot, stepping-stone path down to a fire pit lounge, hammock on the shady side, raised veg beds at the back. Drone shot at dusk with the low-voltage lighting on — pretty happy with the layering.", reactions: 27, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/6415b0ad6f5081ff2d0fde336e9ec6b5.jpg"] },
  { who: "Tom Ashfield", handle: "tom-ashfield", postedAgo: "5d", body: "Sunken firepit lounge finished last night in Girton. Curved timber-deck seating ring with LED underlighting on every riser, waterfall wall to the right, pergola-kitchen at the back. This one took 6 weeks — most involved build we've done all year.", reactions: 38, replies: 11, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/56ad64cd28de8be8b223d9a93dfe44eb.jpg"] }
];
const CANTEEN_MOCK_POSTS_GARDEN: CanteenPost[] = [
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "20m", body: "Wisteria climb + rose garden install signed off yesterday on a Gothic stone cottage — pink alliums on the steps, wrought balcony baskets already in bloom. The stonework does most of the work; my job is to frame it.", reactions: 44, replies: 11, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/9b5d4672f02bcea7b51a74450587f25c.jpg"] },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "40m", body: "Evening handover of an arched-facade residence in Marlow — lantern-lit approach path with stepped stone treads, box hedging, hanging brackets and dining terrace with outdoor lanterns. The lighting brief was as detailed as the planting.", reactions: 39, replies: 8, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/3a8ae2822f2ecb335143e6040ea00942.jpg"] },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "45m", body: "Site visit to a client's blossom-canopy garden — three linked treehouses on cherry trunks, koi pond and bridge below, formal beds framing. Working with @rowan-ashcroft's team on the landscape integration. Six-month build, coming together beautifully.", reactions: 37, replies: 9, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/52b67046677b74b10af91069b341617b.jpg"] },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "2h", body: "Client hangout centrepiece finished this week. Stone-clad waterfall wall with a circular fire pit at the base, tropical planting each side, LED underlighting to the seating ring. Best photo I've taken all year.", reactions: 41, replies: 12, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/3a7df85defc86bd33d27c2dea1c6f421.jpg"] },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "9h", body: "Signature curved raised planter installed tonight in Chipping Norton. Warm white LED strip along the underskirt, mixed wildflower planting to reflect the meadow behind. Photo taken 20 mins after the electrician's final test.", reactions: 28, replies: 7, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/4cac1b021929821a65d2a34a41c88b3d.jpg"] },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "1d", body: "Modern zen courtyard install completed in the Cotswolds. White pebble beds, silver lantern trio, mirror pool with reflection. Stone-clad fire pit as the centrepiece. Client's brief was 'calm and dramatic in the same breath' — think we hit it.", reactions: 33, replies: 10, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/15cdce4e24050c4f2f426dd8fceb1d86.jpg"] },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "2d", body: "Formal parterre design signed off for a Cotswolds manor house. Box, lavender, standard bay. Install begins March.", reactions: 14, replies: 3, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%2015,%202026,%2006_41_30%20AM.png")] },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "4d", body: "Orangery landscaping meeting today. Client wants year-round colour with structured hedging. Sketching options this week.", reactions: 11, replies: 2, avatarUrl: null },
  { who: "Charlotte Grantham", handle: "charlotte-grantham", postedAgo: "5d", body: "SGD conference next month in Bath — anyone else attending? Would love to swap notes on winter garden schemes.", reactions: 7, replies: 8, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_WELDER: CanteenPost[] = [
  { who: "Wayne Hartley", handle: "wayne-hartley", postedAgo: "2h", body: "Structural steel beam fabricated + coated today for a Sheffield warehouse conversion. Coded weld inspection Friday.", reactions: 13, replies: 3, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2003_29_09%20AM.png")] },
  { who: "Wayne Hartley", handle: "wayne-hartley", postedAgo: "9h", body: "Bespoke gate install in Chesterfield. 4m span with drop bolts, decorative scrollwork. Client's a repeat — third gate in two years.", reactions: 15, replies: 2, avatarUrl: null },
  { who: "Wayne Hartley", handle: "wayne-hartley", postedAgo: "2d", body: "Anyone in the North selling used MIG welding rigs? Looking to expand the workshop with a second machine.", reactions: 8, replies: 11, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_ARCHITECT: CanteenPost[] = [
  { who: "Sarah Fenton", handle: "sarah-fenton", postedAgo: "1h", body: "Planning permission granted on the Islington rear extension. Client's been waiting 18 months — massive relief for them.", reactions: 24, replies: 6, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%203,%202026,%2008_38_50%20AM.png")] },
  { who: "Sarah Fenton", handle: "sarah-fenton", postedAgo: "8h", body: "Building regs submission today for a barn conversion in Suffolk. Passivhaus principles, GSHP, MVHR. Ambitious build.", reactions: 12, replies: 3, avatarUrl: null },
  { who: "Sarah Fenton", handle: "sarah-fenton", postedAgo: "2d", body: "RIBA panel review of my Peckham studio scheme tomorrow. Fingers crossed the material palette lands.", reactions: 9, replies: 4, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_CONCRETE: CanteenPost[] = [
  { who: "Marcus Reeves", handle: "marcus-reeves", postedAgo: "3h", body: "Polished concrete floor pour in a Manchester warehouse conversion — 300m². Diamond-grinding + sealing next week.", reactions: 11, replies: 2, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png")] },
  { who: "Marcus Reeves", handle: "marcus-reeves", postedAgo: "10h", body: "Formwork setup for a raft foundation on a Cheshire new-build. Rebar mat inspection Thursday, pour Monday.", reactions: 8, replies: 3, avatarUrl: null },
  { who: "Marcus Reeves", handle: "marcus-reeves", postedAgo: "2d", body: "Anyone got a source for micro-cement in the North West? Client wants seamless bathroom finish and my usual supplier is short.", reactions: 6, replies: 9, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_BRICKLAYER: CanteenPost[] = [
  { who: "Kevin Doherty", handle: "kevin-doherty", postedAgo: "2h", body: "Extension gable wall going up in Belfast today — Flemish bond, dark facing brick. Fiddly on the corner detail but satisfying.", reactions: 17, replies: 4, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2001_46_00%20PM.png")] },
  { who: "Kevin Doherty", handle: "kevin-doherty", postedAgo: "7h", body: "Cavity insulation top-up on a 1950s semi. Full-fill mineral wool, snug fit around the wall ties. Nice quiet job.", reactions: 9, replies: 2, avatarUrl: null },
  { who: "Kevin Doherty", handle: "kevin-doherty", postedAgo: "3d", body: "Anyone using the new self-levelling mortars for wall bedding? Trade rep was flogging me some, curious if they hold up.", reactions: 7, replies: 13, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_PLASTERER: CanteenPost[] = [
  { who: "Lucas Hensley", handle: "lucas-hensley", postedAgo: "3h", body: "Skim coat on a full lounge + hall today in Bishopston — 78m² one-coat with Multi-Finish. Two lads on the trowel, sweet finish across every wall.", reactions: 14, replies: 3, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2002_18_53%20AM.png")] },
  { who: "Lucas Hensley", handle: "lucas-hensley", postedAgo: "1d", body: "External K-Rend on a new-build in Clifton. Base coat down yesterday, top-coat this morning. Weather held long enough for a full 24-hour cure.", reactions: 11, replies: 2, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2001_47_47%20PM.png")] },
  { who: "Lucas Hensley", handle: "lucas-hensley", postedAgo: "3d", body: "Anyone in Bristol got a source for hair-lime plaster? Restoring a Grade II ceiling and Mike Wye is 3 weeks out on stock.", reactions: 6, replies: 11, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_PRESTIGE: CanteenPost[] = [
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "30m", body: "Handover shot of the Windermere villa — colonial-style veranda, terracotta pantile roof, formal planted approach, mountain backdrop. 14 months from planning to keys.", reactions: 41, replies: 9, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/d6401a8646cdba6db3d1fe46f665c8fd.jpg"] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "1h", body: "Timber-frame Alpine-inspired build we signed off in Cumbria this week. Deep balconies, tile mansard, exposed rafter tails, wet garden below. Client wanted \"chalet warmth\", we think we delivered.", reactions: 36, replies: 7, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/786994edb913f9467e5ecace2bfdfd8d.jpg"] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "3h", body: "French chateau conversion in Kensington — slate mansard, dormer sculptures, iron balconies, coach-house garage. 22-month build, seven trades on site at peak. Client's second commission with us.", reactions: 54, replies: 12, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/6c0b1052a97ccff35b257d8994481b4a.jpg"] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "6h", body: "Palazzo-style new-build in Surrey handed over yesterday. Formal wrought-iron gates, dark tile hip roof, ornamental flower borders. Marble driveway inlay was the fiddliest detail of the whole job.", reactions: 47, replies: 10, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/565fee3a8296e6aa74d8d72f1bbf8c9c.jpg"] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "1d", body: "Golden-hour handover of a Cotswolds villa — cream stone, blue-grey slate hip roof, sculpted parterre with wrought entrance gates. The kind of light photographers can't fake.", reactions: 51, replies: 11, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/574a2becedc31909bf7de9eeacf87300.jpg"] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "2d", body: "Neo-classical new-build in Sunningdale — column entrance, gilt balustrade, blue-tile mansard with dormer detail. Landscape design by @charlotte-grantham finishing this week.", reactions: 43, replies: 9, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/51d074776503d28d85e32e12885b3054.jpg"] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "3d", body: "Mediterranean-style villa handover in Bournemouth — palm-lined approach, black-tile mansard turret, wrap-around veranda with dining terrace. Ten-month build, second time working with this designer.", reactions: 38, replies: 6, avatarUrl: null, photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/c5ea7a87b58c7f572ab4c01b9e8d4a49.jpg"] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "5d", body: "Basement dig sign-off on the Belgravia project — full underpinning + 4m depth. Structural engineer signed off yesterday, clear to break through.", reactions: 19, replies: 4, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2003_26_58%20AM.png")] },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "1d", body: "Kitchen commissioning day on the Surrey renovation. Handmade in-frame cabinetry, Miele appliances, natural stone from Verona. Client's speechless.", reactions: 27, replies: 6, avatarUrl: null },
  { who: "Julian Hartley", handle: "julian-hartley", postedAgo: "3d", body: "Party wall notice served on the Kensington remodel. 12-week countdown starts now — planning coordination begins Tuesday.", reactions: 8, replies: 3, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_MARINA: CanteenPost[] = [
  { who: "Alistair Ferguson", handle: "alistair-ferguson", postedAgo: "6h", body: "New pontoon set installed at Ocean Village today — 20 berths, timber decking on aluminium float sections. Tide window was tight.", reactions: 13, replies: 2, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2002_59_22%20AM.png")] },
  { who: "Alistair Ferguson", handle: "alistair-ferguson", postedAgo: "2d", body: "Refurb inspection on a 40-year-old timber jetty. Structural rot on 3 posts, sistering + partial rebuild scheduled for October slack.", reactions: 9, replies: 1, avatarUrl: null },
  { who: "Alistair Ferguson", handle: "alistair-ferguson", postedAgo: "5d", body: "Anyone marine-fabricating stainless cleats? Portsmouth marina wants an upgrade and my usual chandler is 8 weeks out.", reactions: 5, replies: 7, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_EMERGENCY: CanteenPost[] = [
  { who: "Frank Delaney", handle: "frank-delaney", postedAgo: "3h", body: "Storm damage callout at 3am — roof tile displacement + saturated ceiling. Temporary tarp up, insurance-approved repair scheduled for Monday.", reactions: 18, replies: 4, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png")] },
  { who: "Frank Delaney", handle: "frank-delaney", postedAgo: "1d", body: "Burst pipe emergency in Jesmond overnight. Isolated within 20 mins, dried down + repair scoped. Insurer covering full remediation.", reactions: 14, replies: 2, avatarUrl: null },
  { who: "Frank Delaney", handle: "frank-delaney", postedAgo: "3d", body: "Fallen tree took out a garage roof this morning. Chainsaw + tarp — full rebuild quote landed with the client's underwriter same day.", reactions: 11, replies: 5, avatarUrl: null }
];
const CANTEEN_MOCK_POSTS_GROUNDWORKER: CanteenPost[] = [
  { who: "Barry Rollins", handle: "barry-rollins", postedAgo: "2h", body: "New-build foundation dig in Bootle today — 4m trenches, waterlogged as always. Concrete pour scheduled for Thursday.", reactions: 15, replies: 3, avatarUrl: null, photoUrls: [P("ChatGPT%20Image%20Jul%203,%202026,%2002_25_52%20PM.png")] },
  { who: "Barry Rollins", handle: "barry-rollins", postedAgo: "1d", body: "Full drainage rework on a Wirral extension. Foul + surface split, gully connections, tested + signed off with Building Control.", reactions: 11, replies: 2, avatarUrl: null },
  { who: "Barry Rollins", handle: "barry-rollins", postedAgo: "3d", body: "Anyone hiring a 5-ton excavator this month around Speke? Mine's in for service, need a bridge while my main machine is out.", reactions: 8, replies: 9, avatarUrl: null }
];

function mockPostsForCanteen(canteenSlug: string): CanteenPost[] {
  // Existing three (Chalk/Iron/Slate) — preserved as before.
  if (canteenSlug === "uk-rated-electricians")   return CANTEEN_MOCK_POSTS_ELECTRICIAN;
  if (canteenSlug === "uk-verified-plumbers")    return CANTEEN_MOCK_POSTS_PLUMBER;
  // Phase 3 palette demos — 17 trade-themed feeds.
  if (canteenSlug === "uk-master-carpenters")     return CANTEEN_MOCK_POSTS_CARPENTER;
  if (canteenSlug === "uk-interior-designers")    return CANTEEN_MOCK_POSTS_INTERIOR;
  if (canteenSlug === "uk-heritage-stone")        return CANTEEN_MOCK_POSTS_STONE;
  if (canteenSlug === "uk-tile-roofers")          return CANTEEN_MOCK_POSTS_ROOFER;
  if (canteenSlug === "uk-coppersmiths")          return CANTEEN_MOCK_POSTS_COPPER;
  if (canteenSlug === "uk-pool-builders")         return CANTEEN_MOCK_POSTS_POOL;
  if (canteenSlug === "uk-landscapers")           return CANTEEN_MOCK_POSTS_LANDSCAPER;
  if (canteenSlug === "uk-garden-designers")      return CANTEEN_MOCK_POSTS_GARDEN;
  if (canteenSlug === "uk-metal-fabricators")     return CANTEEN_MOCK_POSTS_WELDER;
  if (canteenSlug === "uk-architects")            return CANTEEN_MOCK_POSTS_ARCHITECT;
  if (canteenSlug === "uk-concrete-specialists")  return CANTEEN_MOCK_POSTS_CONCRETE;
  if (canteenSlug === "uk-bricklayers")           return CANTEEN_MOCK_POSTS_BRICKLAYER;
  if (canteenSlug === "uk-plasterers")            return CANTEEN_MOCK_POSTS_PLASTERER;
  if (canteenSlug === "uk-bespoke-joiners")       return CANTEEN_MOCK_POSTS_JOINER_WOOD;
  if (canteenSlug === "uk-furniture-makers")      return CANTEEN_MOCK_POSTS_FURNITURE;
  if (canteenSlug === "uk-wood-carvers")          return CANTEEN_MOCK_POSTS_WOOD_CARVER;
  if (canteenSlug === "uk-wood-restorers")        return CANTEEN_MOCK_POSTS_WOOD_RESTORER;
  if (canteenSlug === "uk-wood-stainers")         return CANTEEN_MOCK_POSTS_WOOD_STAINER;
  if (canteenSlug === "uk-tree-house-builders")   return CANTEEN_MOCK_POSTS_TREE_HOUSE;
  if (canteenSlug === "uk-water-feature-specialists") return CANTEEN_MOCK_POSTS_WATER_FEATURE;
  if (canteenSlug === "uk-guttering-downpipes")   return CANTEEN_MOCK_POSTS_GUTTERING;
  if (canteenSlug === "uk-copper-flashing-specialists") return CANTEEN_MOCK_POSTS_COPPER_FLASHING;
  if (canteenSlug === "uk-canopy-specialists")    return CANTEEN_MOCK_POSTS_CANOPIES;
  if (canteenSlug === "uk-prestige-builders")     return CANTEEN_MOCK_POSTS_PRESTIGE;
  if (canteenSlug === "uk-marina-builders")       return CANTEEN_MOCK_POSTS_MARINA;
  if (canteenSlug === "uk-emergency-repairs")     return CANTEEN_MOCK_POSTS_EMERGENCY;
  if (canteenSlug === "uk-groundworkers")         return CANTEEN_MOCK_POSTS_GROUNDWORKER;
  return CANTEEN_MOCK_POSTS_KITCHEN;
}

// Back-compat alias — call sites that don't yet pass the slug fall
// back to the kitchen feed (Mike Watson's original canteen).
const CANTEEN_MOCK_POSTS = CANTEEN_MOCK_POSTS_KITCHEN;

// Marketplace-flavoured slugs route to The Counter, not the canteen
// feed — never surface these characters on a feed post card.
const SIDE_LANE_ONLY_MOODS: MoodSlug[] = ["for-sale", "sold-out"];

function pickCanteenMood(post: CanteenPost): MoodSlug {
  if (post.moodExplicit) return post.moodExplicit;
  const detected = suggestMood(post.body);
  return SIDE_LANE_ONLY_MOODS.includes(detected) ? "hard-at-work" : detected;
}

// ─── Hero stats bar ─────────────────────────────────────────
//
// Floating KPI card that sits at the bottom of the hero and overlaps
// slightly into the cream page below. 3 tiles: Members · Rating ·
// Products (or Services). Rating tile is suppressed until reviews.count
// ≥ 5 so a fresh canteen doesn't advertise 0.0 stars.

function CanteenHeroStats({
  memberCount,
  reviews,
  productsCount,
  hostHasProducts,
  editMode = false,
  activeStep = "closed"
}: {
  memberCount: number;
  reviews: { avg: number; count: number } | null;
  productsCount: number;
  hostHasProducts: boolean;
  /** When true, the 3 stats tiles become square action buttons the
   *  host taps to manage each section (Products / Members / Reviews).
   *  Only ever true when Edit mode is on AND the viewer is the host. */
  editMode?: boolean;
  /** Which creation flow is currently open — used to highlight the
   *  matching tile in yellow ("you're editing this"). */
  activeStep?: "closed" | "product" | "service" | "live" | "profile" | "trending" | "reviews" | "kitchens" | "features" | "plan-storage";
}) {
  const showRating = reviews && reviews.count >= 5;

  // In Edit mode: tiles become square action buttons. Primary tile
  // (yellow) is the "Add product" quick-action — highest-leverage
  // thing Mike does. Secondary tiles (cream) are Members + Reviews.
  // Small corner badge keeps the count visible so Mike doesn't lose
  // the "how many do I have" signal in the swap. Container height
  // unchanged from view mode.
  if (editMode) {
    return (
      <div className="mx-auto -mt-8 max-w-6xl px-3 md:px-6">
        {/* Horizontal carousel — every tile is fixed width. Fits ~9
            tiles on desktop max-w-6xl; on mobile it scrolls horizontally
            (snap-x) so the merchant swipes rather than the container
            wrapping into multiple rows. Same compact tile size as the
            hero StatTile in view mode. */}
        <div
          className="relative z-10 flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl border-2 p-2.5 shadow-xl md:justify-center md:p-3 [&::-webkit-scrollbar]:hidden"
          style={{
            borderColor: "#166534",
            backgroundColor: "#FFFDF6",
            scrollbarWidth: "none"
          }}
        >
          <EditActionSquare
            icon={<Package size={18} strokeWidth={2.4}/>}
            label="Add Product"
            badge={String(productsCount)}
            active={activeStep === "product"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "add-product" } }))}
          />
          <EditActionSquare
            icon={<Wrench size={18} strokeWidth={2.4}/>}
            label="Add Service"
            active={activeStep === "service"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "add-service" } }))}
          />
          <EditActionSquare
            icon={<Radio size={18} strokeWidth={2.4}/>}
            label="Live Listing"
            badge="New"
            active={activeStep === "live"}
            liveDot
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "live-listing" } }))}
          />
          <EditActionSquare
            icon={<LayoutDashboard size={18} strokeWidth={2.4}/>}
            label="Kitchen Designs"
            active={activeStep === "kitchens"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "kitchen-designs" } }))}
          />
          <EditActionSquare
            icon={<UserCog size={18} strokeWidth={2.4}/>}
            label="Edit Profile"
            active={activeStep === "profile"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "edit-profile" } }))}
          />
          <EditActionSquare
            icon={<TrendingUp size={18} strokeWidth={2.4}/>}
            label="Edit Trending"
            active={activeStep === "trending"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "edit-trending" } }))}
          />
          <EditActionSquare
            icon={<MessageSquare size={18} strokeWidth={2.4}/>}
            label="Manage Reviews"
            badge={showRating ? String(reviews.count) : "New"}
            active={activeStep === "reviews"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "manage-reviews" } }))}
          />
          <EditActionSquare
            icon={<Rocket size={18} strokeWidth={2.4}/>}
            label="Plan & Storage"
            active={activeStep === "plan-storage"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "plan-storage" } }))}
          />
          <EditActionSquare
            icon={<Users size={18} strokeWidth={2.4}/>}
            label="Members"
            badge={String(memberCount)}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "members" } }))}
          />
          <EditActionSquare
            icon={<Star size={18} strokeWidth={2.4} fill="currentColor"/>}
            label="Reviews"
            badge={showRating ? String(reviews.count) : "New"}
            onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "reviews" } }))}
          />
          {/* Button Features moved out of the carousel 2026-07-14 —
              it's now the yellow pill in the hero (top-left of the
              CTA row). Kept the "features" activeStep + panel below
              so the event still fires. */}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto -mt-8 max-w-6xl px-3 md:px-6">
      <div
        className="relative z-10 grid grid-cols-3 gap-2 rounded-2xl border bg-white/95 p-2.5 shadow-xl backdrop-blur md:p-3"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <StatTile
          icon={<Users size={16} strokeWidth={2.2}/>}
          value={String(memberCount)}
          label="Members"
        />
        {showRating ? (
          <StatTile
            icon={<Star size={16} strokeWidth={2.2} fill="currentColor"/>}
            value={reviews.avg.toFixed(1)}
            label={`Rating · ${reviews.count}`}
            accent
          />
        ) : (
          <StatTile
            icon={<Star size={16} strokeWidth={2.2}/>}
            value="New"
            label="No reviews yet"
            muted
          />
        )}
        <StatTile
          icon={hostHasProducts ? <Package size={16} strokeWidth={2.2}/> : <Wrench size={16} strokeWidth={2.2}/>}
          value={String(productsCount)}
          label={hostHasProducts ? "Products" : "Services"}
        />
      </div>
    </div>
  );
}

// Square action button used inside the stats container when Edit mode
// is active. Big icon + label centred, small count badge in the top-
// right corner. Yellow variant marks the primary action (Products);
// cream variant marks secondary ones (Members, Reviews). Each tile
// dispatches a `canteen:edit-action` CustomEvent with its kind so
// downstream editors (Phase 2) can open the right panel.
// Square-styled button that fits INSIDE the existing stats container
// without growing the container height. Matches the original StatTile
// padding so the row keeps the same vertical footprint — just swaps
// info tiles for tappable action buttons in Edit mode.
// EditActionSquare — compact tile inside the stats container when
// Edit mode is on. Size matches the view-mode StatTile (natural
// height, ~70-80px). Yellow (BRAND_YELLOW #FFB300) means SELECTED:
// the tile's flow is currently open below the container. Cream white
// is the idle state. Sized to fit ~9 tiles in the container on
// desktop; mobile horizontal-scrolls when tiles overflow.
function EditActionSquare({
  icon,
  label,
  badge,
  active,
  liveDot,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  liveDot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-20 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] md:w-24 md:py-2.5 ${
        active ? "ring-2 ring-[#166534]" : ""
      }`}
      style={{
        backgroundColor: active ? "#FFB300" : "#FFFFFF",
        borderColor: active ? "#166534" : "rgba(22,101,52,0.20)",
        color: active ? "#0A0A0A" : "#1B1A17"
      }}
    >
      {/* Small pulsing green dot in top-LEFT for the Live Listing
          tile. Uses #10B981 which the platform reserves for live/
          in-stock indicators only. Visually differentiates a "live
          feed" action from a normal creation action. */}
      {liveDot && (
        <span
          aria-hidden
          className="absolute left-1 top-1 inline-flex h-2 w-2 items-center justify-center"
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ backgroundColor: "#10B981" }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: "#10B981" }}
          />
        </span>
      )}
      {badge && (
        <span
          className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black shadow-sm"
          style={{
            backgroundColor: active ? "#0A0A0A" : "#166534",
            color: "#FFFFFF"
          }}
        >
          {badge}
        </span>
      )}
      <span style={{ color: active ? "#0A0A0A" : "#166534" }}>{icon}</span>
      <span className="mt-0.5 text-center text-[10px] font-black uppercase leading-tight tracking-[0.10em] md:text-[10.5px]">
        {label}
      </span>
    </button>
  );
}

function StatTile({
  icon,
  value,
  label,
  accent,
  muted
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
  muted?: boolean;
}) {
  const iconColor = muted ? "text-neutral-400" : accent ? "text-amber-500" : "text-neutral-700";
  const valueColor = muted ? "text-neutral-500" : "text-neutral-900";
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-center md:py-3">
      <div className={`flex items-center gap-1 ${iconColor}`}>
        {icon}
      </div>
      <div className={`text-[18px] font-black leading-none md:text-[22px] ${valueColor}`}>
        {value}
      </div>
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500 md:text-[10px]">
        {label}
      </div>
    </div>
  );
}

function EmptyPostsState({ canteenName }: { canteenName: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 text-center"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        <MessageCircle size={22} color={BRAND_BLACK}/>
      </div>
      <div className="text-[14px] font-black text-neutral-900">
        No posts yet in {canteenName}.
      </div>
      <p className="max-w-sm px-6 text-[12px] leading-snug text-neutral-600">
        Break the ice — introduce yourself, ask a question, or drop a photo of what you're on this week.
      </p>
    </div>
  );
}

function formatAgoShort(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const mins = Math.floor(ms / (60 * 1000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function CanteenPostCard({
  post,
  tradeLabel,
  viewerSlug,
  hostSlug,
  canteenSlug,
  canteenName,
  hostFirstName,
  productsById,
  onRemoved
}: {
  post: CanteenPost;
  tradeLabel: string;
  viewerSlug?: string | null;
  hostSlug?: string;
  canteenSlug?: string;
  /** Canteen display name — used by the guest reply confirmation
   *  ("Sent to Team {canteenName} for review"). */
  canteenName?: string;
  /** Canteen host's first name — used by the guest-reply terms line
   *  ("By replying you agree to {firstName}'s terms & privacy"). */
  hostFirstName?: string;
  productsById?: Record<string, CanteenProduct>;
  onRemoved?: (id: string) => void;
}) {
  // Extract [[product:<id>]] marker from the body — the composer
  // appends this when a product is attached. If we can resolve the id
  // to a real CanteenProduct we render an inline mini-tile below the
  // body; otherwise we just strip the marker and show plain text.
  const productMatch = post.body.match(/\[\[product:([a-zA-Z0-9_-]+)\]\]/);
  const attachedProduct = productMatch && productsById ? productsById[productMatch[1]] : null;
  const bodyDisplay = productMatch ? post.body.replace(productMatch[0], "").trim() : post.body;
  const canRemove = Boolean(
    post.id && viewerSlug && (viewerSlug === post.handle || viewerSlug === hostSlug)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!post.id || removing) return;
    setRemoving(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/canteens/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.ok) onRemoved?.(post.id);
    } finally {
      setRemoving(false);
    }
  }

  // Hero image on the LEFT of the card — same position + logic as the
  // Yard card and the mobile Live Feed row. photoUrls[0] when set,
  // deterministic fallback thumbnail otherwise so a bodied-only post
  // still reads as content, not a blank row.
  const heroImage = post.photoUrls && post.photoUrls.length > 0
    ? post.photoUrls[0]
    : canteenPostThumb(post.handle);

  return (
    <article
      className="relative overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)", opacity: removing ? 0.5 : 1 }}
    >
      {/* Landscape row: thumbnail left, content right — matches
          YardPostCard's pattern so canteen + Yard cards feel like the
          same object across surfaces. */}
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        {/* Thumbnail */}
        <div
          className="relative aspect-square h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28"
          style={{ backgroundColor: CREAM }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Content column */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/trade/${post.handle}`}
              className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-black transition hover:brightness-95"
              style={{
                backgroundColor: post.avatarUrl ? undefined : BRAND_YELLOW,
                color: BRAND_BLACK
              }}
              aria-label={`View ${post.who}'s profile`}
            >
              {post.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={post.avatarUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                post.who.charAt(0)
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/trade/${post.handle}`}
                  className="truncate text-[13px] font-black text-neutral-900 hover:underline"
                >
                  {post.who}
                </Link>
                {hostSlug && post.handle === hostSlug && (
                  <span
                    className="flex-shrink-0 rounded-sm px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em]"
                    style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                    title="Canteen host"
                  >
                    Host
                  </span>
                )}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {tradeLabel} · {post.postedAgo}
              </div>
            </div>
            {/* Post actions — always shown, top-right of the row.
                Author + host see edit/delete/pin/boost; everyone sees
                Report. Unimplemented actions surface a "Coming soon"
                toast so we're honest about what's live. */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Post actions"
              >
                <MoreHorizontal size={16}/>
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[170px] overflow-hidden rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          window.alert("Edit post — coming soon.");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-neutral-800 hover:bg-neutral-50"
                      >
                        <Pencil size={13}/>
                        Edit post
                      </button>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        onClick={remove}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={13}/>
                        Delete post
                      </button>
                    )}
                    {hostSlug && viewerSlug === hostSlug && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          window.alert("Pin post — coming soon.");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-neutral-800 hover:bg-neutral-50"
                      >
                        <Pin size={13}/>
                        Pin post
                      </button>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          window.alert("Boost post — coming soon.");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-neutral-800 hover:bg-neutral-50"
                      >
                        <Rocket size={13}/>
                        Boost post
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        const reason = window.prompt(
                          "Why are you reporting this post? Please add a short reason (harmful / misleading / IP / under-18 unsuitable / other):"
                        );
                        if (!reason || reason.trim().length < 4) return;
                        try {
                          const res = await fetch(`/api/content-reports/create`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              contentType: "canteen-post",
                              contentId: post.id ?? null,
                              merchantSlug: hostSlug ?? null,
                              reason: reason.trim(),
                              reportedBody: post.body
                            })
                          });
                          const data = await res.json();
                          if (res.ok && data.ok) {
                            window.alert("Report received. Thenetworkers admin will review shortly.");
                          } else {
                            window.alert("Report failed — please try again in a moment.");
                          }
                        } catch {
                          window.alert("Network error — please try again in a moment.");
                        }
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-neutral-800 hover:bg-neutral-50"
                    >
                      <Flag size={13}/>
                      Report post
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Body */}
          <p className="line-clamp-4 text-[13px] leading-relaxed text-neutral-700">
            {bodyDisplay}
          </p>

          {/* Attached product tile — only when the marker resolves to
              a real product we can render. */}
          {attachedProduct && canteenSlug && (
            <a
              href={`/trade-off/yard/canteens/${canteenSlug}?focus=${encodeURIComponent(attachedProduct.id)}`}
              className="flex items-center gap-2 rounded-lg border bg-neutral-50 p-2 shadow-sm transition hover:bg-white"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div
                className="h-14 w-14 flex-shrink-0 rounded"
                style={{
                  backgroundImage: `url('${attachedProduct.imageUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#F3F4F6"
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Featured product
                </div>
                <div className="truncate text-[13px] font-black text-neutral-900">{attachedProduct.name}</div>
                <div className="mt-0.5 text-[11px] font-bold" style={{ color: BRAND_GREEN_DARK }}>
                  £{attachedProduct.priceGbp}
                </div>
              </div>
              <ArrowUpRight size={14} className="flex-shrink-0 text-neutral-500"/>
            </a>
          )}

          {/* Action row — Like + Comment. */}
          <ReactionRow
            initialCount={post.reactions}
            initialAgree={post.reactionsAgree ?? 0}
            initialQuestion={post.reactionsQuestion ?? 0}
            initialReplies={post.replies}
            postId={post.id ?? null}
            canteenSlug={canteenSlug}
            canteenName={canteenName}
            hostFirstName={hostFirstName}
            viewerSlug={viewerSlug ?? null}
          />
        </div>
      </div>
    </article>
  );
}

function CanteenPostComposer({
  canteenSlug,
  canPostImage,
  canPostVideo,
  onUpgradeNeeded,
  onPosted,
  attachableProducts = []
}: {
  canteenSlug: string;
  canPostImage: boolean;
  canPostVideo: boolean;
  onUpgradeNeeded: () => void;
  /** Fires after a successful create so the parent can refresh the
   *  SSR feed. The optimistic "just posted" tile stays visible; the
   *  refresh replaces it with the real DB card. */
  onPosted?: () => void;
  /** Products the composer can attach. When empty (non-host / no
   *  products) the Attach button is hidden. */
  attachableProducts?: CanteenProduct[];
}) {
  // Composer always open per Philip 2026-07-13 — reads like a texting
  // interface. `expanded` kept as a variable so the post-reset logic
  // doesn't need refactoring; it's initialised true and never flipped.
  const [expanded] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<{ id: string; body: string; kind: PostKind } | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<PostKind>("chat");
  const [attachedProductId, setAttachedProductId] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachedProduct = attachedProductId ? attachableProducts.find((p) => p.id === attachedProductId) : null;

  const placeholderFor: Record<PostKind, string> = {
    chat: "Talk shop in the canteen…",
    question: "Ask the canteen — what would you do here?",
    showcase: "Show your latest finish. Photos welcome.",
    "make-offer": "What are you selling? Condition, size, why you're moving it on."
  };
  const [priceGbp, setPriceGbp] = useState<string>("");

  const MAX_PHOTOS = 8;
  const PER_FILE_MAX_MB = 8;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires change
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (photoUrls.length >= MAX_PHOTOS) {
      setError(`Max ${MAX_PHOTOS} photos per post.`);
      return;
    }
    if (file.size > PER_FILE_MAX_MB * 1024 * 1024) {
      setError(`File too large — ${PER_FILE_MAX_MB} MB max.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "canteen-image");
      fd.append("ownerKind", "merchant");
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 402) setError("Upload limit reached — upgrade to keep posting photos.");
        else if (data.error === "not-authenticated") setError("Log in to add photos.");
        else setError(data.error ?? "Upload failed.");
        return;
      }
      setPhotoUrls((prev) => [...prev, data.url as string]);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url));
  }

  async function submit() {
    if (body.trim().length < 4 && photoUrls.length === 0 && !attachedProductId) {
      setError("Say more than a couple of words, add a photo, or attach a product.");
      return;
    }
    if (kind === "make-offer" && (!priceGbp || Number(priceGbp) <= 0)) {
      setError("Add a price for the listing.");
      return;
    }
    // Product references travel as a `[[product:<id>]]` marker at the
    // end of the body — the renderer strips it from display and
    // inflates it into a card. Avoids a schema change while still
    // giving posts first-class product embeds.
    const bodyWithMarker = attachedProductId
      ? `${body.trim()}\n\n[[product:${attachedProductId}]]`.trim()
      : body.trim();
    setSubmitting(true);
    setError(null);
    try {
      const payload: {
        kind: PostKind;
        body: string;
        photoUrls: string[];
        priceGbp?: number;
        currency?: string;
      } = { kind, body: bodyWithMarker, photoUrls };
      if (kind === "make-offer") {
        payload.priceGbp = Number(priceGbp);
        payload.currency = "GBP";
      }
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/posts/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "not-authenticated") setError("Log in to post.");
        else if (data.error === "not-a-member") setError("Join the canteen to post.");
        else setError(data.error ?? "unknown-error");
        return;
      }
      setPosted({ id: data.id, body: body.trim(), kind });
      setBody("");
      setPhotoUrls([]);
      setKind("chat");
      setPriceGbp("");
      setAttachedProductId(null);
      onPosted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-4 rounded-xl border bg-white p-3 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        {expanded && (
          <>
            {/* Kind picker — three chips above the textarea. Chat is
                the default. Question / Showcase nudge the mood
                character on the rendered card. */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(["chat", "question", "showcase", "make-offer"] as const).map((k) => {
                const label = k === "chat" ? "Chat" : k === "question" ? "Ask" : k === "showcase" ? "Showcase" : "Sell";
                const Icon = k === "chat" ? MessageCircle : k === "question" ? HelpCircle : k === "showcase" ? ImageIcon : Tag;
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider transition"
                    style={{
                      backgroundColor: active ? BRAND_BLACK : "transparent",
                      color: active ? BRAND_YELLOW : "#525252",
                      border: `1px solid ${active ? BRAND_BLACK : "rgba(139,69,19,0.20)"}`
                    }}
                  >
                    <Icon size={11} strokeWidth={active ? 3 : 2.25}/>
                    {label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 4000))}
              rows={3}
              autoFocus
              placeholder={placeholderFor[kind]}
              className="w-full rounded-lg border p-3 text-[13px] leading-relaxed text-neutral-800 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
            />
            {kind === "make-offer" && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                  <span className="text-[11px] font-black text-neutral-500">£</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={priceGbp}
                    onChange={(e) => setPriceGbp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                    placeholder="Price"
                    className="w-20 border-none bg-transparent p-0 text-[13px] font-black text-neutral-900 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Sits on The Counter · 5-day min live
                </span>
              </div>
            )}
            {photoUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photoUrls.map((url) => (
                  <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover"/>
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"
                      aria-label="Remove photo"
                    >
                      <X size={10} strokeWidth={3}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div className="mt-2 text-[11px] font-black uppercase tracking-wider text-red-600">
                {error}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (!canPostImage) { onUpgradeNeeded(); return; }
                    if (uploading) return;
                    if (photoUrls.length >= MAX_PHOTOS) { setError(`Max ${MAX_PHOTOS} photos.`); return; }
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
                  disabled={uploading}
                  title={canPostImage ? (uploading ? "Uploading…" : "Add a photo") : "Upgrade to post photos"}
                >
                  <ImageIcon size={13}/>
                  {uploading ? "Uploading…" : "Photo"}
                  {photoUrls.length > 0 && (
                    <span className="ml-1 rounded-full px-1.5 text-[9px] font-black" style={{ backgroundColor: BRAND_GREEN_DARK, color: "#fff" }}>
                      {photoUrls.length}
                    </span>
                  )}
                  {!canPostImage && (
                    <span className="ml-1 rounded-sm px-1 text-[8px] font-black uppercase tracking-wider" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                      Pro
                    </span>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                {attachableProducts.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setProductPickerOpen((v) => !v)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                      title={attachedProduct ? `Attached: ${attachedProduct.name}` : "Attach a product"}
                    >
                      <ShoppingBag size={13}/>
                      {attachedProduct ? attachedProduct.name.slice(0, 18) : "Attach product"}
                      {attachedProduct && (
                        <span className="ml-1 rounded-full px-1.5 text-[9px] font-black" style={{ backgroundColor: BRAND_GREEN_DARK, color: "#fff" }}>
                          1
                        </span>
                      )}
                    </button>
                    {productPickerOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setProductPickerOpen(false)}
                        />
                        <div
                          className="absolute left-0 top-full z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border bg-white shadow-lg"
                          style={{ borderColor: "rgba(139,69,19,0.15)" }}
                        >
                          {attachedProduct && (
                            <button
                              type="button"
                              onClick={() => { setAttachedProductId(null); setProductPickerOpen(false); }}
                              className="flex w-full items-center gap-2 border-b px-2.5 py-2 text-left text-[11px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50"
                              style={{ borderColor: "rgba(139,69,19,0.10)" }}
                            >
                              <X size={12}/>
                              Detach product
                            </button>
                          )}
                          {attachableProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setAttachedProductId(p.id); setProductPickerOpen(false); }}
                              className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-neutral-50"
                              style={{
                                backgroundColor: attachedProductId === p.id ? "#FEF3C7" : "transparent"
                              }}
                            >
                              <div
                                className="h-9 w-9 flex-shrink-0 rounded"
                                style={{
                                  backgroundImage: `url('${p.imageUrl}')`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  backgroundColor: "#F3F4F6"
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-black text-neutral-900">{p.name}</div>
                                <div className="text-[10px] font-bold text-neutral-500">£{p.priceGbp}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={() => !canPostVideo && onUpgradeNeeded()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                  title={canPostVideo ? "Add a video" : "Upgrade to post video"}
                >
                  <Video size={13}/>
                  Video
                  {!canPostVideo && (
                    <span className="ml-1 rounded-sm px-1 text-[8px] font-black uppercase tracking-wider" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                      Pro
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setError(null); setBody(""); }}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || (body.trim().length < 4 && photoUrls.length === 0)}
                  className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: BRAND_YELLOW }}
                >
                  <Send size={11} strokeWidth={2.5}/>
                  {submitting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Optimistic post — shows above the mock feed until page
          refresh replaces it with the real query. */}
      {posted && (
        <article
          className="mb-3 rounded-xl border-2 bg-white p-3 shadow-sm"
          style={{ borderColor: BRAND_GREEN_DARK }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_GREEN_DARK }}>
            Just posted · yours · {posted.kind === "chat" ? "Chat" : posted.kind === "question" ? "Ask" : posted.kind === "showcase" ? "Showcase" : "Sell"}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-900">{posted.body}</p>
        </article>
      )}
    </>
  );
}

// ─── Reactions row ─────────────────────────────────────
//
// Wired to POST /api/canteens/posts/[id]/react. When postId is null
// (mock post) we just do optimistic-only local state — no endpoint
// call. Once the feed swaps to real DB posts every click hits the
// endpoint.

type Reply = {
  id: string;
  authorSlug: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  likeCount: number;
};

function ReactionRow({
  postId,
  initialCount,
  initialAgree,
  initialQuestion,
  initialReplies,
  canteenSlug,
  canteenName: _canteenName,
  hostFirstName: _hostFirstName,
  viewerSlug
}: {
  postId: string | null;
  initialCount: number;
  initialAgree: number;
  initialQuestion: number;
  initialReplies: number;
  canteenSlug?: string;
  /** Canteen display name — retained for compatibility with legacy
   *  callers; no longer surfaced now that the guest-review flow is
   *  gone. Marked `_canteenName` to keep TS quiet. */
  canteenName?: string;
  /** Canteen host first name — legacy prop from the removed guest
   *  reply terms line. Retained for callers; unused now. */
  hostFirstName?: string;
  /** Viewer's merchant slug when signed in; null for guests. Drives
   *  the auth gate on the reply composer. Per Philip 2026-07-15 the
   *  old name+WhatsApp guest reply form was killing conversions — the
   *  composer is now auth-only and guests see a "Sign in to comment"
   *  CTA instead. */
  viewerSlug: string | null;
}) {
  const [count, setCount] = useState(initialCount);
  const [agreeCount, setAgreeCount] = useState(initialAgree);
  const [questionCount, setQuestionCount] = useState(initialQuestion);
  const [liked, setLiked] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [questioned, setQuestioned] = useState(false);
  const [pending, setPending] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [replyCount, setReplyCount] = useState(initialReplies);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  // Auth-gated reply composer state. Guests can read the whole thread
  // but cannot post — see the sign-in CTA below the list. No more
  // name/WhatsApp collection. Posts go live immediately with no
  // moderation queue.
  const [replyBody, setReplyBody] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  async function toggleReaction(kind: "like" | "agree" | "question") {
    if (pending) return;
    const stateFor = (k: typeof kind) => k === "like" ? liked : k === "agree" ? agreed : questioned;
    const setStateFor = (k: typeof kind, v: boolean) => {
      if (k === "like") setLiked(v);
      else if (k === "agree") setAgreed(v);
      else setQuestioned(v);
    };
    const setCountFor = (k: typeof kind, delta: number) => {
      if (k === "like") setCount((c) => Math.max(0, c + delta));
      else if (k === "agree") setAgreeCount((c) => Math.max(0, c + delta));
      else setQuestionCount((c) => Math.max(0, c + delta));
    };
    const nextActive = !stateFor(kind);
    setStateFor(kind, nextActive);
    setCountFor(kind, nextActive ? 1 : -1);
    if (!postId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStateFor(kind, !nextActive);
        setCountFor(kind, nextActive ? -1 : 1);
        return;
      }
      if (typeof data.count === "number") {
        if (kind === "like") setCount(data.count);
        else if (kind === "agree") setAgreeCount(data.count);
        else setQuestionCount(data.count);
      }
      if (typeof data.reacted === "boolean") setStateFor(kind, data.reacted);
    } catch {
      setStateFor(kind, !nextActive);
      setCountFor(kind, nextActive ? -1 : 1);
    } finally {
      setPending(false);
    }
  }

  async function openThread() {
    setThreadOpen(true);
    if (replies || !postId) return; // already loaded, or mock post
    setLoadingReplies(true);
    try {
      const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/replies`);
      const data = await res.json();
      if (res.ok && data.ok) setReplies(data.replies as Reply[]);
      else setReplies([]);
    } catch {
      setReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  }

  async function submitReply() {
    const body = replyBody.trim();
    if (!body || replySubmitting) return;
    if (!viewerSlug) {
      setReplyError("Sign in to comment.");
      return;
    }
    if (!postId) {
      // Mock post — optimistic append only, no server round trip.
      setReplies((prev) => [
        ...(prev ?? []),
        {
          id: `local-${Date.now()}`,
          authorSlug: viewerSlug,
          authorDisplayName: viewerSlug,
          authorAvatarUrl: null,
          body,
          createdAt: new Date().toISOString(),
          likeCount: 0
        }
      ]);
      setReplyCount((n) => n + 1);
      setReplyBody("");
      return;
    }
    setReplySubmitting(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.error === "not-authenticated") setReplyError("Sign in to comment.");
        else if (data.error === "not-a-member") setReplyError("Join the canteen to comment.");
        else if (data.error === "body-too-short") setReplyError("Write a bit more.");
        else setReplyError("Comment failed. Try again.");
        return;
      }
      setReplyBody("");
      setReplyCount((n) => n + 1);
      // Refetch to pick up the row with its real timestamp + author
      // display name resolved from the members table.
      try {
        const refetch = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/replies`);
        const refetchData = await refetch.json().catch(() => ({}));
        if (refetch.ok && refetchData.ok && Array.isArray(refetchData.replies)) {
          setReplies(refetchData.replies as Reply[]);
        }
      } catch {
        // Silent — count already bumped.
      }
    } finally {
      setReplySubmitting(false);
    }
  }

  return (
    <>
      <div className="mt-3 flex items-center gap-3 border-t border-neutral-100 pt-2.5 text-[11px] font-black uppercase tracking-wider text-neutral-500">
        <button
          type="button"
          onClick={() => toggleReaction("like")}
          disabled={pending}
          className="inline-flex items-center gap-1 transition hover:text-neutral-900 disabled:opacity-60"
          style={{ color: liked ? BRAND_GREEN_DARK : undefined }}
        >
          <Heart size={13} fill={liked ? BRAND_GREEN_DARK : "none"}/>
          <span>Like</span>
          <span className="text-neutral-400">·</span>
          <span>{count}</span>
        </button>
        <button
          type="button"
          onClick={() => toggleReaction("agree")}
          disabled={pending}
          className="inline-flex items-center gap-1 transition hover:text-neutral-900 disabled:opacity-60"
          style={{ color: agreed ? BRAND_GREEN_DARK : undefined }}
          title="Agree"
        >
          <ThumbsUp size={13} fill={agreed ? BRAND_GREEN_DARK : "none"}/>
          <span>Agree</span>
          <span className="text-neutral-400">·</span>
          <span>{agreeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => toggleReaction("question")}
          disabled={pending}
          className="inline-flex items-center gap-1 transition hover:text-neutral-900 disabled:opacity-60"
          style={{ color: questioned ? BRAND_AMBER : undefined }}
          title="Question this"
        >
          <HelpCircle size={13} fill={questioned ? BRAND_AMBER : "none"}/>
          <span>Q?</span>
          <span className="text-neutral-400">·</span>
          <span>{questionCount}</span>
        </button>
        <button
          type="button"
          onClick={() => (threadOpen ? setThreadOpen(false) : openThread())}
          className="inline-flex items-center gap-1 transition hover:text-neutral-900"
          style={{ color: threadOpen ? BRAND_BLACK : undefined }}
        >
          <MessageSquare size={13}/>
          <span>{threadOpen ? "Hide" : "Comment"}</span>
          <span className="text-neutral-400">·</span>
          <span>{replyCount}</span>
        </button>
      </div>

      {threadOpen && (
        <div className="mt-2 rounded-lg border bg-neutral-50 p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          {/* Approved replies from the DB. All comments are live the
              moment they're posted — no moderation queue. */}
          {postId && loadingReplies && (
            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Loading…</div>
          )}
          {postId && replies && replies.length === 0 && !loadingReplies && (
            <div className="text-[11.5px] text-neutral-500">
              No comments yet — be the first.
            </div>
          )}
          {replies && replies.length > 0 && (
            <ul className="flex flex-col gap-2">
              {replies.map((r) => (
                <li key={r.id} className="rounded-lg bg-white p-2 shadow-sm" style={{ border: "1px solid rgba(139,69,19,0.08)" }}>
                  <div className="flex items-baseline justify-between text-[10px] font-black uppercase tracking-wider">
                    <Link href={`/trade/${r.authorSlug}`} className="text-neutral-900 hover:underline">
                      {r.authorDisplayName}
                    </Link>
                    <span className="text-neutral-400">{formatAgoShort(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-neutral-800">
                    {r.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {/* Composer OR sign-in CTA — the read/write split. Anyone can
              read every comment above; posting requires an account. The
              old name+WhatsApp guest form was killed 2026-07-15 per
              Philip — friction was suppressing engagement. */}
          {viewerSlug ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value.slice(0, 4000))}
                placeholder="Write a comment…"
                rows={2}
                className="rounded-lg border bg-white px-3 py-2 text-[12.5px] leading-snug text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
              <div className="flex items-center justify-between gap-2">
                {replyError ? (
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600">
                    {replyError}
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-400">
                    Comments go live immediately.
                  </span>
                )}
                <button
                  type="button"
                  onClick={submitReply}
                  disabled={replySubmitting || replyBody.trim().length === 0}
                  className="inline-flex h-9 flex-shrink-0 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: BRAND_YELLOW }}
                >
                  <Send size={11} strokeWidth={2.5}/>
                  {replySubmitting ? "Posting…" : "Comment"}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-white p-2.5"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <span className="text-[11.5px] leading-snug text-neutral-700">
                Free to read every comment. Create an account to reply.
              </span>
              <Link
                href={`/sign-in${canteenSlug ? `?next=${encodeURIComponent(`/trade-off/yard/canteens/${canteenSlug}`)}` : ""}`}
                className="inline-flex h-9 flex-shrink-0 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: BRAND_BLACK }}
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Add Item kind picker ───────────────────────────────────
//
// First step of the "Add Item" inline flow. Splits the merchant into
// the right form: Product (physical thing you sell) vs Service (work
// you offer). Two large tap-targets side by side; small cancel below.

function AddItemKindPicker({
  onPickProduct,
  onPickService,
  onCancel
}: {
  onPickProduct: () => void;
  onPickService: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="mb-5">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#166534]">
          Adding to your canteen
        </div>
        <h2 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
          What are you adding?
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
          Pick one — the form matches what you&apos;re listing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={onPickProduct}
          className="group flex flex-col items-start rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ borderColor: "rgba(22,101,52,0.20)" }}
        >
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition group-hover:scale-105"
            style={{ backgroundColor: "#FFF8E6" }}
          >
            <Package size={22} strokeWidth={2.2} style={{ color: "#B8860B" }}/>
          </div>
          <div className="text-[16px] font-black text-neutral-900">Product</div>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600">
            A physical item you sell — worktops, tools, cabinets, tiles.
          </p>
          <div
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            Add a product →
          </div>
        </button>

        <button
          type="button"
          onClick={onPickService}
          className="group flex flex-col items-start rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ borderColor: "rgba(22,101,52,0.20)" }}
        >
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition group-hover:scale-105"
            style={{ backgroundColor: "#DCFCE7" }}
          >
            <Wrench size={22} strokeWidth={2.2} style={{ color: "#166534" }}/>
          </div>
          <div className="text-[16px] font-black text-neutral-900">Service</div>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600">
            Work you offer — kitchen fitting, plumbing, electrical, tiling.
          </p>
          <div
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            Add a service →
          </div>
        </button>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Add Service placeholder ────────────────────────────────
//
// Phase 2 will replace this with a proper service-listing form
// (service name, price model, service area, portfolio). For now, a
// small holding card so the merchant can see the service path exists
// and knows what's coming.

function AddServicePlaceholder({
  onCancel
}: {
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#DCFCE7" }}>
          <Wrench size={22} strokeWidth={2.2} style={{ color: "#166534" }}/>
        </div>
        <h3 className="text-[18px] font-black text-neutral-900">Service listing — coming soon.</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
          The service form is being built next: <b>service name</b>, price model (hourly / fixed / quoted), service area, callout fee, availability, portfolio.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[12px] leading-snug text-neutral-500">
          For now, list your services as products with &ldquo;<b>Price on request</b>&rdquo; and use the description for details.
        </p>
      </div>
    </div>
  );
}

// ─── Live Listing placeholder ────────────────────────────────
//
// Live Listings are a distinct concept from the regular product
// editor — think Facebook Marketplace + eBay auction + "gone today"
// classifieds. Merchants use them for time-limited or immediate-
// availability offers: van-loads, cash-and-carry, seconds/damaged,
// end-of-day stock, or 24h auction-style listings.
//
// Phase 2 will replace this with the real form. For now, a holding
// card so the merchant can see the flow exists and knows what fields
// are coming. No "← Change item type" button because Live Listing
// skips the Product/Service picker — it's its own entry point from
// the stats container tile.

function LiveListingPlaceholder({
  onCancel
}: {
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF8E6" }}>
          <Radio size={22} strokeWidth={2.2} style={{ color: "#0A0A0A" }}/>
        </div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]"
          style={{ backgroundColor: "rgba(16,185,129,0.14)", color: "#166534" }}
        >
          <span className="relative inline-flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
              style={{ backgroundColor: "#10B981" }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#10B981" }}
            />
          </span>
          Live feed
        </div>
        <h3 className="text-[18px] font-black text-neutral-900">Live listing — coming soon.</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
          Live listings are for time-limited or immediate stock: <b>van-loads</b>, <b>end-of-day clearance</b>, <b>cash &amp; carry</b>, <b>seconds</b>, or <b>24-hour auctions</b>. They surface at the top of The Counter and expire when you say they do.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[12px] leading-snug text-neutral-500">
          The form will include: <b>title</b>, <b>photo</b>, <b>quantity</b>, <b>price or auction</b>, <b>collection window</b> (e.g. today 4pm–7pm), and <b>expiry</b>. Different from a regular product — no VAT tax banded into card, no delivery grid, no multi-buy tiers. Fast and time-boxed.
        </p>
      </div>
    </div>
  );
}

// ─── Edit Profile placeholder ────────────────────────────────
//
// "Edit Profile" opens the merchant's canteen identity in-place —
// avatar/logo, business name, bio, service area, trades covered,
// contact, cover image, hours, verification badges.
//
// The real editor already exists at
// /trade-off/yard/canteens/[slug]/manage (CanteenManageShell), but
// it lives on a separate page. Phase 2 will pull those fields inline
// so Mike edits without leaving his canteen. Until then, this card
// tells him what's coming and offers a direct link to the full
// manage page so he isn't blocked.

function EditProfilePlaceholder({
  slug,
  onCancel
}: {
  slug: string;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF8E6" }}>
          <UserCog size={22} strokeWidth={2.2} style={{ color: "#0A0A0A" }}/>
        </div>
        <h3 className="text-[18px] font-black text-neutral-900">Inline profile editor — coming soon.</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
          Editing your profile without leaving this page is coming. It will include: <b>logo</b>, <b>cover image</b>, <b>business name</b>, <b>bio</b>, <b>trades covered</b>, <b>service area</b>, <b>opening hours</b>, <b>contact</b>, and <b>verification badges</b>.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[12px] leading-snug text-neutral-500">
          In the meantime, the full profile manager is one tap away.
        </p>
        <Link
          href={`/trade-off/yard/canteens/${slug}/manage`}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
        >
          <UserCog size={14} strokeWidth={2.4}/>
          Open profile manager
        </Link>
      </div>
    </div>
  );
}

// ─── Edit Trending placeholder ───────────────────────────────
//
// "Edit Trending Today" lets the merchant curate which of their own
// products appear in the "Trending Today" strip on their canteen —
// the row that highlights hero SKUs / deals of the day / stock
// clearance. Phase 2 will be a drag-to-reorder grid + a scheduled
// window (start/end datetime) per pinned product.

function EditTrendingPlaceholder({
  onCancel
}: {
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF8E6" }}>
          <TrendingUp size={22} strokeWidth={2.2} style={{ color: "#0A0A0A" }}/>
        </div>
        <h3 className="text-[18px] font-black text-neutral-900">Edit Trending Today — coming soon.</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
          Curate the products that appear in the <b>Trending Today</b> strip on your canteen. Push hero SKUs, deals of the day, or clearance stock to the top of what buyers see first.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[12px] leading-snug text-neutral-500">
          The editor will let you: <b>pin products</b>, <b>drag to reorder</b>, <b>set a start/end time</b> for scheduled promos, and <b>preview the strip</b> as buyers will see it. Cap: 6 pinned products at a time.
        </p>
      </div>
    </div>
  );
}

// ─── Manage Reviews placeholder ──────────────────────────────
//
// "Manage Reviews" opens the review moderation panel — reply to
// reviews, feature one on the canteen hero, request revisions from
// buyers who left <=3 stars, or flag suspected fake reviews. Distinct
// from the "Reviews" stat tile which just surfaces the count/rating.

function ManageReviewsPlaceholder({
  onCancel
}: {
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF8E6" }}>
          <MessageSquare size={22} strokeWidth={2.2} style={{ color: "#0A0A0A" }}/>
        </div>
        <h3 className="text-[18px] font-black text-neutral-900">Manage Reviews — coming soon.</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
          Reply to reviews, feature one on your hero, ask a buyer to revise a low rating, or flag a suspected fake — all in one place.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[12px] leading-snug text-neutral-500">
          The panel will let you: <b>reply publicly</b> to any review, <b>feature a review</b> in the canteen hero, <b>request revision</b> for ≤3-star reviews, and <b>flag review</b> for platform moderation.
        </p>
      </div>
    </div>
  );
}

// ─── Kitchen Designs placeholder ─────────────────────────────
//
// Trade-specific portfolio surface — for kitchen fitters (Mike),
// this shows off completed kitchen installs / 3D renders / concept
// mockups. Different from Products (which he sells) and Services
// (which he offers) — this is credibility content: "look what I've
// built." Phase 2 will be a per-design gallery with photos, style
// tags, materials, price band, testimonial, and links to related
// product listings.

function KitchenDesignsPlaceholder({
  onCancel
}: {
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF8E6" }}>
          <LayoutDashboard size={22} strokeWidth={2.2} style={{ color: "#0A0A0A" }}/>
        </div>
        <h3 className="text-[18px] font-black text-neutral-900">Kitchen Designs — coming soon.</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
          A portfolio surface for completed kitchen installs, 3D renders, and concept mockups. Different from Products or Services — this is credibility content: <b>&ldquo;look what I&rsquo;ve built.&rdquo;</b>
        </p>
        <p className="mx-auto mt-3 max-w-md text-[12px] leading-snug text-neutral-500">
          Each design will have: <b>photos</b> (before/after or gallery), <b>style tags</b> (modern / shaker / handleless / traditional), <b>materials</b>, <b>installed price band</b>, <b>location</b>, an optional <b>testimonial</b>, and <b>links to related product listings</b> so buyers can shop the look.
        </p>
      </div>
    </div>
  );
}

// ─── Button Features documentation panel ─────────────────────
//
// The "manual" for the Edit-mode stats carousel. Each entry lists a
// button's name, what it does, where the output appears in the app,
// and what state it's in (live / coming soon / stub). Merchants can
// read this to understand every action available in Edit mode
// without trial-and-error. Also serves as an internal spec of what
// still needs to be built.

function ButtonFeaturesPanel({
  onCancel
}: {
  onCancel: () => void;
}) {
  const features: Array<{
    icon: React.ReactNode;
    label: string;
    status: "live" | "coming-soon";
    what: string;
    where: string;
    notes?: string;
  }> = [
    {
      icon: <Package size={16} strokeWidth={2.4}/>,
      label: "Add Product",
      status: "live",
      what: "Publishes a physical product (worktops, tools, cabinets, tiles). Full eBay-style form with Pricing & Delivery, VAT position, images, variants, and multi-buy tiers.",
      where: "Product cards appear on your canteen product list, in the Trade Center marketplace (if enabled), and can pin to Trending Today.",
      notes: "Category-warning banner: wrong-category listings get moved without notice so buyers can find them."
    },
    {
      icon: <Wrench size={16} strokeWidth={2.4}/>,
      label: "Add Service",
      status: "coming-soon",
      what: "Publishes a service you offer (kitchen fitting, plumbing, electrical). Different fields from products — price model (hourly / fixed / quoted), service area, callout fee, availability, portfolio.",
      where: "Service cards will appear on your canteen alongside products, tagged as services.",
      notes: "Interim: list services as products with 'Price on request'."
    },
    {
      icon: <Radio size={16} strokeWidth={2.4}/>,
      label: "Live Listing",
      status: "coming-soon",
      what: "Publishes a time-limited or immediate-availability listing — van-loads, end-of-day clearance, cash & carry, seconds, 24-hour auctions.",
      where: "Surfaces at the top of The Counter feed (platform marketplace stream). Expires when the collection window closes or quantity hits zero.",
      notes: "No VAT, no delivery grid, no multi-buy tiers. Fast and time-boxed."
    },
    {
      icon: <LayoutDashboard size={16} strokeWidth={2.4}/>,
      label: "Kitchen Designs",
      status: "coming-soon",
      what: "Portfolio surface for completed kitchen installs, 3D renders, and concept mockups. Credibility content — not for sale, for proof.",
      where: "New tab on your canteen (between Products and Reviews). Each design links to related product listings so buyers can shop the look.",
      notes: "Trade-specific. Other trades will see equivalent portfolio surfaces (e.g. Bathroom Designs for plumbers)."
    },
    {
      icon: <UserCog size={16} strokeWidth={2.4}/>,
      label: "Edit Profile",
      status: "coming-soon",
      what: "Editing your canteen identity inline — logo, cover image, business name, bio, trades covered, service area, opening hours, contact, verification badges.",
      where: "Reflects everywhere your canteen surfaces — hero card, search results, Trade Center merchant tile.",
      notes: "The full manager already exists at /trade-off/yard/canteens/{slug}/manage — the inline version will pull those fields into this panel."
    },
    {
      icon: <TrendingUp size={16} strokeWidth={2.4}/>,
      label: "Edit Trending",
      status: "coming-soon",
      what: "Curate the products in your Trending Today strip. Pin hero SKUs, deals of the day, or clearance stock so buyers see them first.",
      where: "The Trending Today horizontal strip on your canteen page, above the Products list.",
      notes: "Drag-to-reorder, scheduled start/end times per pinned product, cap of 6 pins at a time."
    },
    {
      icon: <MessageSquare size={16} strokeWidth={2.4}/>,
      label: "Manage Reviews",
      status: "coming-soon",
      what: "Review moderation panel — reply publicly, feature a review on the hero, request revision for ≤3-star reviews, flag suspected fakes for platform moderation.",
      where: "Reviews live on the Reviews tab of your canteen and feed into your overall rating shown on the hero stats bar.",
      notes: "Distinct from the Reviews stat tile (which just surfaces count/rating)."
    },
    {
      icon: <Rocket size={16} strokeWidth={2.4}/>,
      label: "Plan & Storage",
      status: "live",
      what: "Your back-office. Boost individual products via Stripe, track storage against your tier, and see Founding 100 activity progress.",
      where: "Opens a panel here with links to the classic manager for each sub-section. Phase 2 will fold the actual controls inline.",
      notes: "This is the replacement for the /trade-off/yard/canteens/{slug}/manage dashboard. Same functionality, canonical entry point is here now."
    },
    {
      icon: <Users size={16} strokeWidth={2.4}/>,
      label: "Members",
      status: "coming-soon",
      what: "Currently a stat tile showing member count. Will become a management panel — invite trades, approve/remove members, message members in bulk.",
      where: "Members appear in your canteen's Members section and can post to the wall.",
      notes: "The 'Invite trades' action from the old header has moved into this panel."
    },
    {
      icon: <Star size={16} strokeWidth={2.4} fill="currentColor"/>,
      label: "Reviews",
      status: "live",
      what: "Read-only stat tile showing your rating and total review count. Displays 'New' if you have fewer than 5 reviews (avoids advertising a 0.0 star average).",
      where: "Same tile position on the hero stats bar in both view mode and edit mode.",
      notes: "Use Manage Reviews (above) to actually reply/moderate."
    },
    {
      icon: <BookOpen size={16} strokeWidth={2.4}/>,
      label: "Button Features",
      status: "live",
      what: "This panel — the reference manual for every button in the carousel.",
      where: "Only visible in Edit mode on the canteen page.",
      notes: "Kept up to date as new tiles ship or existing ones move from 'coming soon' to 'live'."
    }
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-4 shadow-sm md:p-6"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF8E6" }}>
            <BookOpen size={20} strokeWidth={2.2} style={{ color: "#0A0A0A" }}/>
          </div>
          <div className="min-w-0">
            <h3 className="text-[18px] font-black text-neutral-900">Button Features</h3>
            <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-600">
              Every button in the Edit-mode carousel above — what it does, where it displays, and its status.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {features.map((f) => (
            <div
              key={f.label}
              className="rounded-xl border p-3 md:p-4"
              style={{ borderColor: "rgba(22,101,52,0.15)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "#FFF8E6", color: "#0A0A0A" }}>
                  {f.icon}
                </span>
                <span className="text-[14px] font-black text-neutral-900">{f.label}</span>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                  style={
                    f.status === "live"
                      ? { backgroundColor: "rgba(16,185,129,0.14)", color: "#166534" }
                      : { backgroundColor: "rgba(245,158,11,0.14)", color: "#92400E" }
                  }
                >
                  {f.status === "live" ? "Live" : "Coming soon"}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">
                <b className="font-black text-neutral-900">What it does:</b> {f.what}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-700">
                <b className="font-black text-neutral-900">Where it appears:</b> {f.where}
              </p>
              {f.notes && (
                <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
                  <b className="font-black text-neutral-700">Note:</b> {f.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Plan & Storage panel ────────────────────────────────────
//
// The "back-office" surface that the old /trade-off/yard/canteens/
// [slug]/manage page used to be. Wraps three sub-sections currently
// living on that page: Boost per product, Storage/tier meter, and
// Founding-100 activity progress. Phase 2 will port the actual UI
// into this panel; for now the panel links to the classic manager
// so merchants don't lose functionality while we migrate.

function PlanStoragePanel({
  slug,
  onCancel
}: {
  slug: string;
  onCancel: () => void;
}) {
  const sections: Array<{
    icon: React.ReactNode;
    tint: string;
    label: string;
    desc: string;
    where: string;
  }> = [
    {
      icon: <Rocket size={18} strokeWidth={2.2}/>,
      tint: "#FFF8E6",
      label: "Boost your products",
      desc: "Pay to promote a product for a fixed window. Boosted products float above their category and get a green ribbon.",
      where: "Stripe checkout — 30-day boost per SKU. Live today on the classic manager."
    },
    {
      icon: <HardDrive size={18} strokeWidth={2.2}/>,
      tint: "#EFF6FF",
      label: "Storage & tier",
      desc: "See how much of your tier's storage you're using and upgrade if you need more headroom for images and video.",
      where: "Live today on the classic manager. Server-side storage cap enforced per lib/tierGates."
    },
    {
      icon: <Sparkles size={18} strokeWidth={2.2}/>,
      tint: "#FEF3C7",
      label: "Founding 100 progress",
      desc: "Your progress toward the Founding 100 tier — activity streaks, member growth, product adds. Complete it and lock in the founding rate for life.",
      where: "Live today on the classic manager."
    }
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-2xl border-2 bg-white p-4 shadow-sm md:p-6"
        style={{ borderColor: "rgba(22,101,52,0.20)" }}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF8E6" }}>
            <Rocket size={20} strokeWidth={2.2} style={{ color: "#0A0A0A" }}/>
          </div>
          <div className="min-w-0">
            <h3 className="text-[18px] font-black text-neutral-900">Plan &amp; Storage</h3>
            <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-600">
              Your back-office. Boost individual products, track storage against your tier, and see Founding 100 progress. Full inline editor is Phase 2 — for now these open the classic manager.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {sections.map((s) => (
            <Link
              key={s.label}
              href={`/trade-off/yard/canteens/${slug}/manage`}
              className="block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md md:p-4"
              style={{ borderColor: "rgba(22,101,52,0.15)" }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-900" style={{ backgroundColor: s.tint }}>
                  {s.icon}
                </span>
                <span className="text-[14px] font-black text-neutral-900">{s.label}</span>
                <ArrowUpRight size={14} className="ml-auto text-neutral-400" strokeWidth={2.4}/>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">{s.desc}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-neutral-500">
                <b className="font-black text-neutral-700">Status:</b> {s.where}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-4 rounded-xl border-l-4 border-l-amber-400 border border-amber-100 bg-amber-50 p-3">
          <p className="text-[11.5px] leading-snug text-amber-900">
            <b className="font-black">Phase 2 note:</b> Boost / Storage / Founding-100 will land inline in this panel over the next iterations. Nothing you rely on today is going away — the classic manager stays live until each section is ported here.
          </p>
        </div>
      </div>
    </div>
  );
}
