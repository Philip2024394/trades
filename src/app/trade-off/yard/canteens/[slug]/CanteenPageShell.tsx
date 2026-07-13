"use client";

// Client shell for the canteen detail page — handles invite modal state
// and stitches the header, main feed, and The Counter together.

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CanteenHeader } from "@/components/xrated/yard/CanteenHeader";
import { CanteenSideLane } from "@/components/xrated/yard/CanteenSideLane";
import { CanteenInviteModal } from "@/components/xrated/yard/CanteenInviteModal";
import { CanteenAdminCard } from "@/components/xrated/yard/CanteenAdminCard";
import { CanteenVideoUpsellModal } from "@/components/xrated/yard/CanteenVideoUpsellModal";
import { CanteenPrivateView } from "@/components/xrated/yard/CanteenPrivateView";
import { CanteenMobilePostsRotator, type RotatorPost } from "@/components/xrated/yard/CanteenMobilePostsRotator";
import {
  CanteenQuickActions,
  CanteenTradeDeals
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
import type { Canteen, SideLanePost, CanteenMember, CanteenProduct } from "@/lib/canteens";
import type { CanteenChatPost } from "@/lib/canteens.server";
import { MessageCircle, Send, Heart, MessageSquare, ArrowUpRight, Image as ImageIcon, Video, X, MoreHorizontal, Trash2, ThumbsUp, HelpCircle, ShoppingBag, Tag, Users, Star, Package, Wrench } from "lucide-react";
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
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: CREAM }}>
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
                  products={featuredProducts}
                  hostDisplayName={canteen.hostDisplayName}
                  hostFirstName={canteen.hostDisplayName.split(/\s+/)[0]}
                  hostSlug={canteen.hostSlug}
                  hostWhatsapp={admin?.whatsapp ?? null}
                  tradeSlug={canteen.tradeSlug}
                  tradeLabel={canteen.tradeLabel}
                  hostRating={admin?.reviews && admin.reviews.count >= 5 ? admin.reviews : null}
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

        {/* Trending ribbon moved to /products page 2026-07-13 per Philip. */}


        {/* "Powered by" strip + optional social icons — sits between
            the last content section and the sticky bottom nav. Social
            icons render only for platforms the owner has published
            (max 3: Instagram · TikTok · Facebook). Demo canteens
            currently show placeholder handles so the row is visible;
            real owner settings will replace these once the profile
            schema grows a `social_links` field. */}
        <div className="mx-auto mt-5 flex max-w-6xl items-center justify-center px-3 md:px-6">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Powered by <span style={{ color: "#B8860B" }}>Thenetwork.com</span>
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
      />

      {/* Host's product carousel — full-width strip that sits directly
          under the hero on ALL breakpoints. Was previously nested
          inside the main feed section (below the right column on
          mobile); moved here so the host's shop is the first thing
          scrolled to after the hero, before the chat or side lane.
          Hidden when a focus overlay takes over the section. */}
      {!counterExplainerOpen && !profileFocusOpen && !focusedProduct && (
        <div className="mx-auto max-w-6xl px-3 pt-5 md:px-6 md:pt-6">
          <CanteenProductPanel
            hostDisplayName={canteen.hostDisplayName}
            canteenSlug={canteen.slug}
            products={featuredProducts}
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
      {!counterExplainerOpen && !profileFocusOpen && !focusedProduct && (
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
      <div className="mx-auto max-w-6xl px-3 pb-16 pt-5 md:px-6 md:pt-6">
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
                Silent otherwise. */}
            {hostActions.length > 0 && (
              <div
                className="mb-3 overflow-hidden rounded-xl border-2 shadow-sm"
                style={{ borderColor: BRAND_AMBER, backgroundColor: "#FFFBEB" }}
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
  hostHasProducts
}: {
  memberCount: number;
  reviews: { avg: number; count: number } | null;
  productsCount: number;
  hostHasProducts: boolean;
}) {
  const showRating = reviews && reviews.count >= 5;
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
