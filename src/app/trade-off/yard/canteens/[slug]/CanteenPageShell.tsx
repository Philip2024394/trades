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
import { MessageCircle, Send, Heart, MessageSquare, ArrowUpRight, Image as ImageIcon, Video, X, MoreHorizontal, Trash2, ThumbsUp, HelpCircle, ShoppingBag, Tag, Users, Star, Package, Wrench, Radio, UserCog, TrendingUp, LayoutDashboard, BookOpen, Rocket, HardDrive, Sparkles } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK, BRAND_AMBER } from "@/lib/brand/tokens";
import { MOOD_LIBRARY, suggestMood, type MoodSlug } from "@/lib/yardMoods";
import { requiresProUpload, type MembershipTier } from "@/lib/tierGates";

const CREAM = "#FBF6EC";

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
  returnLabel
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const arrivedViaInvite = searchParams?.get("invite") === "1";
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

  return (
    <main
      className="relative min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: CREAM,
        // Inset yellow ring when Edit mode is on. 3px so it reads
        // clearly at any viewport without feeling loud. Uses inset
        // box-shadow so it doesn't shift page layout on toggle.
        boxShadow: editMode ? "inset 0 0 0 3px #FFB300" : undefined
      }}
    >
      {/* ── Mobile view — pixel-mirror of the mockup dashboard.
          Only 5 elements: Hero (avatar+greeting+bell / split copy+photo
          with KPI overlay), Quick Actions row, Live Feed, Trade Deals,
          Trending. Everything else (product carousel, editorial quote,
          hero stats, rotator, Counter side-lane, composer, full feed)
          is hidden until lg:. */}
      <div className="lg:hidden">
        <CanteenHeroWow
          canteen={canteen}
          isHost={isHost}
          hostWhatsapp={admin?.whatsapp ?? null}
          hostReviews={admin?.reviews ?? null}
          hostAvatarUrl={admin?.avatarUrl ?? null}
          notificationCount={isHost ? hostActions.length : 0}
          addressLine={admin?.showroom?.addressLine ?? null}
          postcode={admin?.showroom?.postcode ?? null}
          city={admin?.city ?? null}
        />
        {/* Outer sheet container with three inner cards nested inside.
            The outer white sheet reads as one designed surface; each
            inner tile has its own rounded card so the sections stay
            visually distinct. */}
        <div className="relative z-10 mx-auto -mt-10 max-w-6xl px-3 md:px-6">
          <div
            className="rounded-t-[28px] border bg-white p-3 shadow-lg md:p-4"
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
                  direct link (#tab-products / #tab-jobs). */}
              <div
                className="rounded-xl p-3 md:p-4"
                style={{ backgroundColor: "#FBF6EC", border: "1px solid rgba(139,69,19,0.08)" }}
              >
                <CanteenTabbedSection
                  canteenSlug={canteen.slug}
                  isHost={isHost}
                  posts={pickRotatorPosts(initialChatPosts)}
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
                />
              </div>
              {/* Container 3 — "Customers say it best" reviews callout.
                  Click routes to the in-page Reviews tab via the same
                  CustomEvent bridge as Quick Actions. */}
              <CanteenTradeDeals
                canteenSlug={canteen.slug}
                tradeLabel={canteen.tradeLabel}
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
          canteenSlug={canteen.slug}
          hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
          hostWhatsapp={admin?.whatsapp ?? null}
          sendToTradeCenter={admin?.sendToTradeCenter ?? false}
        />


        {/* "Powered by" strip + optional social icons — sits between
            the last content section and the sticky bottom nav. Social
            icons render only for platforms the owner has published
            (max 3: Instagram · TikTok · Facebook). Demo canteens
            currently show placeholder handles so the row is visible;
            real owner settings will replace these once the profile
            schema grows a `social_links` field. */}
        <div className="mx-auto mt-5 flex max-w-6xl items-center justify-center px-3 md:px-6">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Powered by <span style={{ color: "#B8860B" }}>Thenetworkers.co</span>
          </span>
        </div>
        <CanteenSocialLinks
          instagram={`https://instagram.com/${canteen.hostSlug}`}
          tiktok={`https://tiktok.com/@${canteen.hostSlug}`}
          facebook={`https://facebook.com/${canteen.hostSlug}`}
        />
        {/* Exact clearance for the slimmer sticky contact bar — no
            visible gap between social icons and the sticky footer. */}
        <div className="h-12"/>
      </div>

      {/* Sticky bottom nav — mobile only, sits above AppShell's own
          bottom nav via z-50. Home · Feed · [+] · Messages · Profile
          with an elevated tan + button in the middle. */}
      <CanteenBottomNav
        canteenSlug={canteen.slug}
        hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
        hostWhatsapp={admin?.whatsapp ?? null}
        hostReviews={admin?.reviews ?? null}
        tradeLabel={canteen.tradeLabel}
      />

      {/* Edit mode sticky strip — shown at the very top of the
          canteen when the host has Edit mode on. Positioned above the
          header so it reads as chrome, not content. */}
      {isHost && editMode && (
        <div
          className="sticky top-0 z-30 border-b bg-[#FFB300] px-3 py-1.5 text-center text-[10.5px] font-black uppercase tracking-[0.18em] text-[#0A0A0A] md:px-6"
          style={{ borderColor: "rgba(0,0,0,0.1)" }}
        >
          You&apos;re editing your canteen · changes save as drafts
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
        editMode={editMode}
        onToggleEditMode={() => setEditMode((v) => !v)}
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
            posts={pickRotatorPosts(initialChatPosts)}
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
                        photoUrls: p.photoUrls
                      }}
                      tradeLabel={canteen.tradeLabel}
                      viewerSlug={viewerSlug}
                      hostSlug={canteen.hostSlug}
                      canteenSlug={canteen.slug}
                      productsById={productsById}
                      onRemoved={handleRemoved}
                    />
                  ));
                }
                return CANTEEN_MOCK_POSTS.map((p, i) => (
                  <CanteenPostCard
                    key={i}
                    post={p}
                    tradeLabel={canteen.tradeLabel}
                    viewerSlug={viewerSlug}
                    hostSlug={canteen.hostSlug}
                    canteenSlug={canteen.slug}
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
                    silent sales pitch to future canteen owners. */}
                <div className="mt-3">
                  <CanteenMobileAppShowcase
                    hostSlug={canteen.hostSlug}
                    hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
                    tradeLabel={canteen.tradeLabel}
                    heroImageUrl={canteen.headerBgUrl}
                    heroTitle={canteen.name}
                  />
                </div>
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
 *  even on a fresh canteen. Returns the shape RotatorPost expects. */
function pickRotatorPosts(dbPosts: CanteenChatPost[] | undefined): RotatorPost[] {
  if (dbPosts && dbPosts.length > 0) {
    return dbPosts.slice(0, 6).map((p) => ({
      id:                p.id,
      authorDisplayName: p.authorDisplayName,
      authorSlug:        p.authorSlug,
      body:              p.body,
      createdAt:         p.createdAt,
      imageUrl:          p.photoUrls?.[0] ?? null,
      reactionsLike:     p.reactionsLike,
      replyCount:        p.replyCount
    }));
  }
  // Fall back to the shell's mock feed so demo canteens still show
  // a live pulse before real posts land.
  return CANTEEN_MOCK_POSTS.slice(0, 6).map((p, i) => ({
    id:                `mock-${i}`,
    authorDisplayName: p.who,
    authorSlug:        p.handle,
    body:              p.body,
    createdAt:         approxIsoFromAgoLabel(p.postedAgo),
    imageUrl:          p.photoUrls?.[0] ?? null,
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
};

// Canteen feed = chat + questions + announcements only.
// For-sale posts route to The Counter, NOT the main feed — so the
// for-sale / sold-out mood characters should never appear on canteen
// cards. The mood picker (below) filters them out defensively.
const CANTEEN_MOCK_POSTS: CanteenPost[] = [
  {
    who: "Mike Watson",
    handle: "mike-watson",
    postedAgo: "2h",
    body: "Anyone tried the new Blum soft-close on 40mm oak? Fitting a corner unit next week and the standard hinges have been catching.",
    reactions: 6, replies: 3
  },
  {
    who: "Rachel Simms",
    handle: "rachel-simms",
    postedAgo: "4h",
    body: "Recommendations for a supplier doing 24h templating in the NW? Current one just went to 5 days and I've a customer breathing down my neck.",
    reactions: 4, replies: 8
  },
  {
    who: "Tom Fisher",
    handle: "tom-fisher",
    postedAgo: "7h",
    body: "Smashed the Whittington fit-out today — 3-day install into a full new-build kitchen. Client over the moon, big handshake at the end.",
    reactions: 18, replies: 6
  },
  {
    who: "Craig McDermott",
    handle: "craig-mcdermott",
    postedAgo: "1d",
    body: "Important notice for anyone on the Alder Grove site — access diverted through the north gate all next week. Save yourselves the ballache I had this morning.",
    reactions: 22, replies: 4
  }
];

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

function PostPhotoGrid({ urls }: { urls: string[] }) {
  const shown = urls.slice(0, 4);
  const overflow = Math.max(0, urls.length - 4);
  // Layout: 1 → single, 2 → 2-col, 3 → 3-col, 4+ → 2x2.
  const gridClass =
    shown.length === 1 ? "grid grid-cols-1"
    : shown.length === 2 ? "grid grid-cols-2 gap-1"
    : shown.length === 3 ? "grid grid-cols-3 gap-1"
    : "grid grid-cols-2 gap-1";
  return (
    <div className={`mt-2 overflow-hidden rounded-lg ${gridClass}`} style={{ maxHeight: "22rem" }}>
      {shown.map((url, i) => (
        <div
          key={url}
          className="relative aspect-square"
          style={{ backgroundColor: "#F3F4F6" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover"/>
          {i === shown.length - 1 && overflow > 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center text-[16px] font-black text-white"
              style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
            >
              +{overflow}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Reply bodies that start with "@name " get the @name rendered as a
// chip and the rest as body text. Handles names with dashes/dots/
// numbers/underscores; stops at the first whitespace.
function parseMentionPrefix(body: string): { name: string; rest: string } | null {
  const match = body.match(/^@([A-Za-z0-9._-]+)\s+([\s\S]*)$/);
  if (!match) return null;
  return { name: match[1], rest: match[2] };
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
  productsById,
  onRemoved
}: {
  post: CanteenPost;
  tradeLabel: string;
  viewerSlug?: string | null;
  hostSlug?: string;
  canteenSlug?: string;
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

  return (
    <article
      className="relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)", opacity: removing ? 0.5 : 1 }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Link
          href={`/trade/${post.handle}`}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-black transition hover:brightness-95"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          aria-label={`View ${post.who}'s profile`}
        >
          {post.who.charAt(0)}
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
        {/* Send-to-Yard button removed — every canteen post now
            auto-appears in the Yard feed by default. No opt-in
            promotion needed. */}
        {canRemove && (
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
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-lg border bg-white shadow-lg"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <button
                    type="button"
                    onClick={remove}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={13}/>
                    Delete post
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Body — full width, no character reserving space anymore */}
      <p className="text-[13px] leading-relaxed text-neutral-700">
        {bodyDisplay}
      </p>

      {/* Photo grid — 1 photo goes full-width, 2 splits, 3-4 grid, 5+ shows
          first 4 with a "+N more" overlay on the last tile. Uses
          object-cover for tight aspect fitting; the feed reader can
          promote to a lightbox later. */}
      {post.photoUrls && post.photoUrls.length > 0 && (
        <PostPhotoGrid urls={post.photoUrls}/>
      )}

      {/* Attached product tile — only when the marker resolves to a
          real product we can render. Marker-only-without-lookup falls
          silently to just the stripped body. */}
      {attachedProduct && canteenSlug && (
        <a
          href={`/trade-off/yard/canteens/${canteenSlug}?focus=${encodeURIComponent(attachedProduct.id)}`}
          className="mt-2 flex items-center gap-2 rounded-lg border bg-neutral-50 p-2 shadow-sm transition hover:bg-white"
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

      {/* Action row — Like + Comment. Real reactions posts to
          /api/canteens/posts/[id]/react when the post has an id.
          Mock posts (no id) fall back to optimistic-only. */}
      <ReactionRow
        initialCount={post.reactions}
        initialAgree={post.reactionsAgree ?? 0}
        initialQuestion={post.reactionsQuestion ?? 0}
        initialReplies={post.replies}
        postId={post.id ?? null}
      />
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
  initialReplies
}: {
  postId: string | null;
  initialCount: number;
  initialAgree: number;
  initialQuestion: number;
  initialReplies: number;
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
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [mentionTarget, setMentionTarget] = useState<{ slug: string; displayName: string } | null>(null);
  const replyInputRef = useRef<HTMLInputElement | null>(null);

  function startReplyTo(target: { slug: string; displayName: string }) {
    setMentionTarget(target);
    // Focus + insert the @mention. Uses the slug (never spaces) so
    // parseMentionPrefix can round-trip it cleanly from the body.
    const prefix = `@${target.slug} `;
    setDraft((d) => (d.startsWith("@") ? prefix : `${prefix}${d}`));
    setTimeout(() => replyInputRef.current?.focus(), 0);
  }

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
    if (!postId || draft.trim().length < 2) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "not-authenticated") setPostError("Log in to reply.");
        else if (data.error === "not-a-member") setPostError("Join the canteen to reply.");
        else setPostError(data.error ?? "reply-failed");
        return;
      }
      // Optimistic append
      const newReply: Reply = {
        id: data.id,
        authorSlug: "you",
        authorDisplayName: "You",
        authorAvatarUrl: null,
        body: draft.trim(),
        createdAt: new Date().toISOString(),
        likeCount: 0
      };
      setReplies((prev) => [...(prev ?? []), newReply]);
      setReplyCount((c) => c + 1);
      setDraft("");
      setMentionTarget(null);
    } finally {
      setPosting(false);
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

      {threadOpen && postId && (
        <div className="mt-2 rounded-lg border bg-neutral-50 p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          {loadingReplies && (
            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Loading…</div>
          )}
          {replies && replies.length === 0 && !loadingReplies && (
            <div className="text-[11px] text-neutral-500">No replies yet — be the first.</div>
          )}
          {replies && replies.length > 0 && (
            <ul className="flex flex-col gap-2">
              {replies.map((r) => {
                const mention = parseMentionPrefix(r.body);
                return (
                  <li key={r.id} className="rounded-lg bg-white p-2 shadow-sm" style={{ border: "1px solid rgba(139,69,19,0.08)" }}>
                    <div className="flex items-baseline justify-between text-[10px] font-black uppercase tracking-wider">
                      <Link href={`/trade/${r.authorSlug}`} className="text-neutral-900 hover:underline">
                        {r.authorDisplayName}
                      </Link>
                      <span className="text-neutral-400">{formatAgoShort(r.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-neutral-800">
                      {mention && (
                        <span
                          className="mr-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-black"
                          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                        >
                          @{mention.name}
                        </span>
                      )}
                      {mention ? mention.rest : r.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => startReplyTo({ slug: r.authorSlug, displayName: r.authorDisplayName })}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
                    >
                      <MessageSquare size={10}/>
                      Reply
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {mentionTarget && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
              Replying to <span className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>@{mentionTarget.slug}</span>
              <button
                type="button"
                onClick={() => {
                  setMentionTarget(null);
                  setDraft((d) => d.replace(/^@\S+\s?/, ""));
                }}
                className="ml-1 text-neutral-400 hover:text-red-600"
                aria-label="Cancel reply-to"
              >
                <X size={11} strokeWidth={3}/>
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <input
              ref={replyInputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
              placeholder={mentionTarget ? `Reply to @${mentionTarget.slug}…` : "Reply to the canteen…"}
              className="flex-1 rounded-full border bg-white px-3 py-2 text-[12px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              onKeyDown={(e) => { if (e.key === "Enter") submitReply(); }}
            />
            <button
              type="button"
              onClick={submitReply}
              disabled={posting || draft.trim().length < 2}
              className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <Send size={11} strokeWidth={2.5}/>
              {posting ? "…" : "Send"}
            </button>
          </div>
          {postError && (
            <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-red-600">{postError}</div>
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
