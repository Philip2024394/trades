// /tc/notebook — Trade Notebook.
//
// Left-rail navigation now lives in the persistent NotebookRail drawer
// (mounted globally via /tc/layout.tsx). This page is content-only:
// header + toolbar + section content.
//
// Section is driven by ?section= URL param (set by the drawer's
// navigation buttons). Discipline filter via ?cat=, search via ?q=.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Notebook as NotebookIcon,
  MapPin,
  Send,
  Tag,
  Receipt,
  Repeat,
  FileText,
  Radio,
  Clock,
  ArrowRight,
  Package,
  ChevronLeft,
  HelpCircle
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { NotebookToolbar, type NotebookSortMode, type NotebookViewMode } from "@/apps/notebook/components/NotebookToolbar";
import { NotebookCompactCard } from "@/apps/notebook/components/NotebookCompactCard";
import { QuickViewModal } from "@/apps/notebook/components/QuickViewModal";
import { QuotationList } from "@/apps/notebook/components/QuotationList";
import { PagePersonaBadge } from "@/apps/hub/components/PagePersonaBadge";
import { HOW_IT_WORKS_TOPICS, type HowItWorksTopicKey } from "@/apps/hub/data/howItWorksTopics";
import { useQuoteBasket } from "@/apps/notebook/lib/quoteBasket";
import { WhatIsNotebookModal } from "@/apps/hub/components/WhatIsNotebookModal";
import { TradeClearanceCarousel } from "@/apps/notebook/components/TradeClearanceCarousel";
import { NotebookCategoriesStrip } from "@/apps/notebook/components/NotebookCategoriesStrip";
import { useNotebookItems } from "@/apps/notebook/lib/useNotebookItems";
import {
  NOTEBOOK_OFFERS_FIXTURES,
  NOTEBOOK_BULK_QUOTES_FIXTURES,
  JOB_TEMPLATE_FIXTURES
} from "@/apps/notebook/data/notebook";
import {
  findNearestForNotebookItem,
  summariseNotebookMatches
} from "@/apps/notebook/lib/findNearestMerchant";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";
import { findMerchant } from "@/apps/tradecenter/data/merchants";
import { ORDER_FIXTURES } from "@/apps/orders/data/orders";
import type { NotebookItem } from "@/apps/notebook/data/notebook";
import { useIsTrade } from "@/apps/hub/lib/useIsTrade";

type SectionKey = "regulars" | "past-orders" | "offers" | "quotes" | "substitutes" | "templates" | "trending";

export default function TradeNotebookPage() {
  const trade = currentViewerTrade();
  const isTrade = useIsTrade();
  const params = useSearchParams();
  const section = (params?.get("section") ?? "regulars") as SectionKey;
  const disciplineParam = params?.get("cat") ?? "all";
  const seedQuery = params?.get("q") ?? "";
  const quoteMeActive = params?.get("quoteme") === "1";

  const [query, setQuery] = useState(seedQuery);
  const [sort, setSort] = useState<NotebookSortMode>("nearest");
  const [view, setView] = useState<NotebookViewMode>("grid");
  const [paneView, setPaneView] = useState<"browse" | "quote">("browse");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const notebook = useNotebookItems();

  // Pick the explainer topic + trigger label based on where the user is.
  const howItWorksTopic: HowItWorksTopicKey =
    paneView === "quote"        ? "quotation-list"
    : section === "past-orders" ? "past-orders"
    : section === "offers"      ? "offers"
    : section === "quotes"      ? "trade-quote"
    : section === "templates"   ? "templates"
    : "trade-center";
  const howItWorksButtonLabel = HOW_IT_WORKS_TOPICS[howItWorksTopic].buttonLabel;

  const matches = useMemo(
    () =>
      notebook.items.map((item) => ({
        item,
        match: findNearestForNotebookItem(item, trade.homeCity)
      })),
    [notebook.items, trade.homeCity]
  );

  const filtered = useMemo(() => {
    let list = matches;
    if (disciplineParam !== "all") {
      list = list.filter((m) => m.item.categorySlug === disciplineParam);
    }
    // Trade viewers see trade-price-only matches (that's the core value
    // prop of Notebook for them). DIY viewers see every available match
    // regardless of trade price — trade prices are gated per the
    // constitutional rule (feedback_trade_features_trade_only.md).
    list = list.filter(
      (m) =>
        m.match !== null &&
        m.match.product.stockState !== "out" &&
        (!isTrade || m.match.product.tradePriceGbp !== undefined)
    );
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (m) =>
          m.item.productName.toLowerCase().includes(q) ||
          m.item.spec.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    // Saving % when the merchant offers a trade price vs. retail.
    const savingPct = (m: typeof sorted[number]) => {
      const trade = m.match?.product.tradePriceGbp;
      const retail = m.match?.product.priceGbp;
      if (trade === undefined || retail === undefined || retail <= 0) return 0;
      return ((retail - trade) / retail) * 100;
    };
    switch (sort) {
      case "nearest":
        sorted.sort((a, b) => (a.match?.distanceMi ?? Infinity) - (b.match?.distanceMi ?? Infinity));
        break;
      case "az":
        sorted.sort((a, b) => a.item.productName.localeCompare(b.item.productName));
        break;
      case "cheapest":
        sorted.sort((a, b) => {
          const ap = a.match?.product.tradePriceGbp ?? a.match?.product.priceGbp ?? Infinity;
          const bp = b.match?.product.tradePriceGbp ?? b.match?.product.priceGbp ?? Infinity;
          return ap - bp;
        });
        break;
      case "discounted":
        // Biggest % off retail first.
        sorted.sort((a, b) => savingPct(b) - savingPct(a));
        break;
      case "clearance":
        // Low stock / preorder surfaces first — that's how end-of-line runs read.
        sorted.sort((a, b) => {
          const rank = (m: typeof sorted[number]) => {
            const s = m.match?.product.stockState;
            if (s === "low") return 0;
            if (s === "preorder") return 1;
            return 2;
          };
          return rank(a) - rank(b);
        });
        break;
      case "most-reordered":
        sorted.sort((a, b) => b.item.usualQty - a.item.usualQty);
        break;
      case "recent":
      default:
        sorted.sort((a, b) => (b.item.lastOrderedIso ?? "").localeCompare(a.item.lastOrderedIso ?? ""));
    }
    return sorted;
  }, [matches, disciplineParam, query, sort]);

  const summary = useMemo(
    () => summariseNotebookMatches(notebook.items, trade.homeCity),
    [notebook.items, trade.homeCity]
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <PagePersonaBadge
        persona={isTrade ? "trade" : "trade"}
        label={isTrade ? "Notebook · Trade" : "Projects · DIY"}
      />
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 md:px-6 md:py-8">
        {/* Decluttered header — mobile-first, one line. Framing adapts
            to viewer role: trades see "Notebook Trade Center Prices"
            because their value prop is trade pricing on regulars; DIY
            viewers see "My project shopping list" because they buy for
            specific home projects, not for restocking. */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2 md:mb-6">
          <h1 className="flex items-center gap-1.5 text-[18px] font-black leading-tight text-neutral-900 md:text-[24px]">
            <NotebookIcon size={18}/>
            {paneView === "quote"
              ? (isTrade ? "Notebook Quotation List" : "My quote request")
              : (isTrade ? "Trade Center Quotations" : "My project shopping list")}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHowItWorks(true)}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm hover:brightness-105"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              title={howItWorksButtonLabel}
            >
              <HelpCircle size={13}/>
              {howItWorksButtonLabel}
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("tc:open-notebook"))}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm md:hidden"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <ChevronLeft size={12}/>
              Sections
            </button>
          </div>
        </header>

        <WhatIsNotebookModal
          open={showHowItWorks}
          onClose={() => setShowHowItWorks(false)}
          topic={howItWorksTopic}
        />

        {/* Section content */}
        {quoteMeActive && paneView === "browse" && <QuoteMeBanner/>}

        {section === "regulars" && (
          <RegularsSection
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={setView}
            matches={filtered}
            totalCount={matches.length}
            summary={summary}
            paneView={paneView}
            onPaneViewChange={setPaneView}
          />
        )}

        {section === "past-orders" && <PastOrdersSection/>}
        {section === "offers"      && <OffersSection/>}
        {section === "quotes"      && <BulkQuotesSection/>}
        {section === "substitutes" && <SubstitutesSection/>}
        {section === "templates"   && <TemplatesSection/>}
        {section === "trending"    && <TrendingSection/>}
      </main>
    </div>
  );
}

// ─── Section: Regulars ─────────────────────────────────────────────

type RegularsSectionProps = {
  query: string;
  onQueryChange: (q: string) => void;
  sort: NotebookSortMode;
  onSortChange: (s: NotebookSortMode) => void;
  view: NotebookViewMode;
  onViewChange: (v: NotebookViewMode) => void;
  matches: Array<{ item: NotebookItem; match: ReturnType<typeof findNearestForNotebookItem> }>;
  totalCount: number;
  summary: ReturnType<typeof summariseNotebookMatches>;
  paneView: "browse" | "quote";
  onPaneViewChange: (v: "browse" | "quote") => void;
};

function RegularsSection({
  query,
  onQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  matches,
  totalCount,
  summary,
  paneView,
  onPaneViewChange
}: RegularsSectionProps) {
  const [quickView, setQuickView] = useState<{
    item: NotebookItem;
    match: ReturnType<typeof findNearestForNotebookItem>;
  } | null>(null);
  const setPaneView = onPaneViewChange;

  return (
    <>
      {/* Browse-only chrome: hidden when the trade opens their Quotation List */}
      {paneView === "browse" && (
        <>
          <div className="mb-3">
            <NotebookCategoriesStrip
              itemCategories={matches.map((m) => m.item.categorySlug)}
            />
          </div>
          {sort === "cheapest" && (
            <div className="mb-3 flex items-start gap-2 rounded-md p-3 text-[10.5px] leading-snug" style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(139,69,19,0.15)" }}>
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white" style={{ backgroundColor: "#B45309" }}>i</span>
              <p className="text-neutral-700">
                You chose <strong>Cheapest</strong>. Trade Center never ranks merchants by price by default — this is
                your override. We'll go back to <strong>Nearest merchant</strong> when you switch.
              </p>
            </div>
          )}
          <NotebookToolbar
            query={query}
            onQueryChange={onQueryChange}
            sort={sort}
            onSortChange={onSortChange}
            view={view}
            onViewChange={onViewChange}
            totalCount={totalCount}
            visibleCount={matches.length}
          />
        </>
      )}

      <div className="mt-5 md:mt-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-black leading-tight text-neutral-900 md:text-[18px]">
              {paneView === "quote" ? "Quotation List" : sortHeadline(sort)}
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-500">
              {paneView === "quote"
                ? "Change, edit, delete, update and send for quote."
                : "Filter your search for suitable search results."}
            </p>
            {paneView === "browse" && (
              <Link
                href="/tc/trade-center"
                className="mt-2 inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider shadow-sm hover:brightness-105"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <ChevronLeft size={11}/>
                Back to products
              </Link>
            )}
          </div>
          <QuoteBasketButton
            active={paneView === "quote"}
            onToggle={() => setPaneView(paneView === "quote" ? "browse" : "quote")}
          />
        </header>

        {paneView === "quote" ? (
          <QuotationList onBackToBrowse={() => setPaneView("browse")}/>
        ) : matches.length === 0 ? (
          <EmptyState
            title={query.trim() ? "Currently out of stock" : "Nothing here yet"}
            detail={
              query.trim()
                ? `We couldn't find "${query.trim()}" in stock at a verified merchant near you right now. We'll show it here as soon as one lists it.`
                : "Try clearing your filter or picking a different section on the left."
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {matches.map(({ item, match }) => (
              <li key={item.id}>
                <NotebookCompactCard
                  item={item}
                  match={match}
                  onView={() => setQuickView({ item, match })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Trade Clearance from the trade's own merchants — browse pane only */}
      {paneView === "browse" && matches.length > 0 && (
        <TradeClearanceCarousel
          merchantSlugs={Array.from(new Set(matches.map((m) => m.match?.merchant.slug).filter((s): s is string => Boolean(s))))}
        />
      )}

      <QuickViewModal
        open={quickView !== null}
        onClose={() => setQuickView(null)}
        item={quickView?.item ?? null}
        match={quickView?.match ?? null}
      />
    </>
  );
}

// ─── Quote basket icon + count badge ──────────────────────────────

function QuoteBasketButton({
  active,
  onToggle
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const { count } = useQuoteBasket();
  const label = active ? "Back to notebook" : "View Quote List";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={active}
      className="relative inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-full border pl-3 pr-1 shadow-sm transition"
      style={{
        backgroundColor: active ? "#0A0A0A" : "#FFFFFF",
        color: active ? "#FFB300" : "#0A0A0A",
        borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.18)"
      }}
      title={label}
    >
      <span className="text-[10.5px] font-black uppercase tracking-wider">
        {label}
      </span>
      <span
        className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: active ? "#FFB300" : "#0A0A0A", color: active ? "#0A0A0A" : "#FFB300" }}
      >
        <NotebookIcon size={16}/>
        {count > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[9.5px] font-black leading-none shadow-sm ring-2 ring-white"
            style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── Sort → results headline ──────────────────────────────────────

function sortHeadline(sort: NotebookSortMode): string {
  switch (sort) {
    case "nearest":        return "Viewing Nearest Trade Centers";
    case "cheapest":       return "Viewing Cheapest";
    case "discounted":     return "Viewing Discounted";
    case "clearance":      return "Viewing Clearance / End-of-line";
    case "most-reordered": return "Viewing Most Reordered";
    case "recent":         return "Viewing Recently Added";
    case "az":             return "Viewing A → Z";
  }
}

// ─── Quote Me feature ─────────────────────────────────────────────

function QuoteMeBanner() {
  return (
    <section
      className="mb-4 rounded-2xl border p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFDF8" }}
    >
      <div className="flex items-center gap-2">
        <Send size={14} className="text-amber-700"/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
          Quote Me · active
        </div>
      </div>
      <div className="mt-1 text-[14px] font-black text-neutral-900">
        Add items to 1 main quote form from all suppliers and hit Quote My Project
      </div>
      <p className="mt-1 text-[11px] leading-snug text-neutral-700">
        View the total cost to your project or doorstep and wait for delivery time and cost. Easy as that.
      </p>
    </section>
  );
}

// ─── Section: Past Orders ──────────────────────────────────────────

function PastOrdersSection() {
  const orders = ORDER_FIXTURES.slice(0, 12);
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader
        Icon={Receipt}
        title="Past orders — reorder from history"
        detail="Orders that contained items on your notebook. Tap Reorder to send the same list to the merchant."
      />
      <ul className="flex flex-col gap-2">
        {orders.map((o) => {
          const merchant = findMerchant(o.merchantSlug);
          return (
            <li
              key={o.id}
              className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              >
                {merchant?.logoInitials ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12px] font-black text-neutral-900">
                  {o.itemsSummary}
                </div>
                <div className="text-[10.5px] text-neutral-500">
                  {merchant?.displayName ?? o.merchantSlug} · £{o.totalGbp}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
              >
                Again
              </button>
              <Link
                href={`/tc/orders/${o.id}`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                aria-label="View order"
              >
                <ArrowRight size={14}/>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Section: Offers on my notebook items ──────────────────────────

function OffersSection() {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader
        Icon={Tag}
        title="Offers on your notebook items"
        detail="Deals from verified merchants — only ones tied to items already on your notebook. General deals live at /tc/deals."
      />
      <ul className="flex flex-col gap-2">
        {NOTEBOOK_OFFERS_FIXTURES.map((o) => {
          const merchant = findMerchant(o.merchantSlug);
          return (
            <li
              key={o.id}
              className="flex items-center gap-3 rounded-xl border p-3 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFDF8" }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <Tag size={16} strokeWidth={2.5}/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="line-clamp-1 text-[12.5px] font-black text-neutral-900">{o.headline}</div>
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-black" style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>{o.savingLabel}</span>
                </div>
                <div className="mt-0.5 text-[10.5px] text-neutral-600">
                  Your notebook item: <strong>{o.itemName}</strong> · from {merchant?.displayName}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
                  <Clock size={9}/>
                  Ends in {o.endsInHours}h
                </div>
              </div>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                Claim
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Section: Bulk quotes ─────────────────────────────────────────

type LiveQuoteRequest = {
  requestId: string;
  status: string;
  sentAt: string;
  totalGbpEstimate: number;
  deliveryTiming: string;
  deliveryAddress: string;
  projectId: string | null;
  merchantCount: number;
  replyCount: number;
  replies: Array<{
    replyId: string;
    merchantSlug: string;
    totalGbp: number;
    deliveryPromise: string | null;
    deliveryDate: string | null;
    submittedAt: string | null;
    isCheapest: boolean;
  }>;
};

function BulkQuotesSection() {
  const [live, setLive] = useState<LiveQuoteRequest[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apps/notebook/quote-requests/list", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((json: { requests?: LiveQuoteRequest[] }) => {
        if (!cancelled) setLive(json.requests ?? []);
      })
      .catch(() => {
        if (!cancelled) setLive([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real data path — one card per submitted merchant reply
  const liveCards = live?.flatMap((req) =>
    req.replies.map((rep) => ({
      key:            rep.replyId,
      requestId:      req.requestId,
      merchantSlug:   rep.merchantSlug,
      totalGbp:       rep.totalGbp,
      savingPct:      Math.max(
        0,
        Math.round(((req.totalGbpEstimate - rep.totalGbp) / Math.max(1, req.totalGbpEstimate)) * 100)
      ),
      isCheapest:     rep.isCheapest,
      submittedAt:    rep.submittedAt ?? req.sentAt,
      itemsSummary:   `Reply to your ${new Date(req.sentAt).toLocaleDateString()} request`,
      deliveryPromise: rep.deliveryPromise
    }))
  );

  // Fixture fallback so the section always looks alive in dev
  const fixtureCards = NOTEBOOK_BULK_QUOTES_FIXTURES.map((q) => ({
    key:             q.id,
    requestId:       null as string | null,
    merchantSlug:    q.merchantSlug,
    totalGbp:        q.totalGbp,
    savingPct:       q.savingPct,
    isCheapest:      false,
    submittedAt:     q.receivedIso,
    itemsSummary:    q.items.join(" · "),
    deliveryPromise: null as string | null
  }));

  const cards = liveCards && liveCards.length > 0 ? liveCards : fixtureCards;

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        Icon={Receipt}
        title="Quote Me — merchant replies"
        detail="Nearest 3 verified merchants quoted your notebook items as a package. Whoever prices wins. Zero commission."
      />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((q) => {
          const merchant = findMerchant(q.merchantSlug);
          const heroUrl = merchant?.storeHeroImageUrl ?? merchant?.logoImageUrl;
          return (
            <li key={q.key}>
              <article
                className="flex overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                {/* Landscape image + View button — inset with equal top/left/bottom padding */}
                <div className="flex flex-shrink-0 flex-col gap-1.5 py-2 pl-2">
                  <div
                    className="relative aspect-square h-[132px] w-[132px] overflow-hidden rounded-lg sm:h-[148px] sm:w-[148px]"
                    style={{ backgroundColor: "#0A0A0A" }}
                    aria-hidden
                  >
                    {heroUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={heroUrl} alt="" className="h-full w-full object-cover"/>
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-[26px] font-black"
                        style={{ color: "#FFB300" }}
                      >
                        {merchant?.logoInitials ?? "?"}
                      </div>
                    )}
                    <span
                      className="absolute left-2 top-2 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider shadow-sm"
                      style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                    >
                      Quote
                    </span>
                  </div>
                  {q.requestId ? (
                    <Link
                      href={`/tc/notebook/quote-requests/${q.requestId}`}
                      aria-label="View quote details"
                      className="inline-flex h-8 w-[132px] items-center justify-center gap-1 rounded-md text-[10.5px] font-black uppercase tracking-wider shadow-sm sm:w-[148px]"
                      style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                    >
                      View
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-label="View quote details"
                      className="inline-flex h-8 w-[132px] items-center justify-center gap-1 rounded-md text-[10.5px] font-black uppercase tracking-wider shadow-sm sm:w-[148px]"
                      style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                    >
                      View
                    </button>
                  )}
                </div>

                {/* Details — right */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-black leading-tight text-neutral-900">
                        {merchant?.displayName ?? q.merchantSlug}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-neutral-500">
                        <Clock size={9}/>
                        Received {timeAgo(q.submittedAt)}
                      </div>
                      {q.isCheapest && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                        >
                          Cheapest
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[16px] font-black leading-none text-neutral-900">£{q.totalGbp}</div>
                      <div
                        className="mt-0.5 text-[9.5px] font-black uppercase tracking-wider"
                        style={{ color: "#166534" }}
                      >
                        save {q.savingPct}%
                      </div>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-[11px] leading-snug text-neutral-600">
                    {q.itemsSummary}
                    {q.deliveryPromise && (
                      <span className="ml-1 text-neutral-500">· {q.deliveryPromise}</span>
                    )}
                  </p>

                  <div className="mt-auto pt-1">
                    <button
                      type="button"
                      className="inline-flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm sm:text-[11.5px]"
                      style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                    >
                      Accept quote
                    </button>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return "just now";
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / (60 * 24))}d ago`;
}

// ─── Section: Substitutes ──────────────────────────────────────────

function SubstitutesSection() {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader
        Icon={Repeat}
        title="Substitutes for your notebook items"
        detail="Alternatives when your usual is unavailable. Trade Center never recommends by margin — only proven substitutes for items you already buy."
      />
      <EmptyState
        title="No substitutions needed right now"
        detail="Every item in your notebook is available from a verified merchant near you. Substitutes appear here when stock dries up."
      />
    </div>
  );
}

// ─── Section: Job templates ────────────────────────────────────────

function TemplatesSection() {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader
        Icon={FileText}
        title="Job templates"
        detail="Saved baskets per recurring job type. Load a template into the queue and Order All in one tap."
      />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {JOB_TEMPLATE_FIXTURES.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="text-[12.5px] font-black text-neutral-900">{t.label}</div>
            <div className="mt-1 flex items-center gap-3 text-[10.5px] text-neutral-600">
              <span>{t.itemCount} items</span>
              <span>·</span>
              <span className="font-black text-neutral-800">~£{t.totalEstimatedGbp}</span>
            </div>
            <div className="mt-2 text-[9.5px] text-neutral-500">
              Last used {new Date(t.lastUsedIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
            <button
              type="button"
              className="mt-3 inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              Load template
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Section: Trending ─────────────────────────────────────────────

function TrendingSection() {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader
        Icon={Radio}
        title="Trending in your discipline near you"
        detail="Anonymised: items other verified plasterers within 25mi of Manchester have added to their Notebooks this week. Never names anyone."
      />
      <EmptyState
        title="Trending signal warming up"
        detail="Once more Manchester plasterers publish rate cards + Notebooks, trending items appear here. Aggregated + anonymised."
      />
    </div>
  );
}

// ─── Shared UI ─────────────────────────────────────────────────────

function SectionHeader({
  Icon,
  title,
  detail
}: {
  Icon: typeof Tag;
  title: string;
  detail: string;
}) {
  return (
    <header
      className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
      >
        <Icon size={14} strokeWidth={2.2}/>
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-black text-neutral-900">{title}</div>
        <p className="mt-0.5 text-[10.5px] leading-snug text-neutral-600">{detail}</p>
      </div>
    </header>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed p-8 text-center"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      <div className="text-[12.5px] font-black text-neutral-900">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-[10.5px] text-neutral-600">{detail}</p>
    </div>
  );
}
