"use client";

// StudioTemplatesLibrary — browse-catalog for every registered section.
//
// One card per SectionRegistration. Each card renders the section via
// an iframe embed of /preview/section/[id] at 25% scale — total layout,
// animation, and event isolation from siblings. Fetches usage counts
// from /api/studio/library/usage once on mount and overlays a
// "Used by N merchants" badge.
//
// Filter by library kind + free-text search on name / tags / verticals.
// Click a card to open the full-viewport preview modal. Modal + filter
// state round-trip through the URL (?library=hero&preview=<id>) so
// merchants can deep-link into any template — and share links to their
// team.
//
// Perf & polish (Shopify/Wix-tier):
//   · Skeleton shimmer per card until its iframe fires `onLoad`.
//   · `content-visibility: auto` skips paint below the fold entirely.
//   · Hover-prefetch (150ms intent debounce) warms the preview route
//     cache so the modal opens instantly.
//   · Every renderer call is wrapped in a StudioErrorBoundary so a
//     single broken section renderer can never white-out the grid.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Side-effect import so the registry is populated (server-rendered
// pages import this too, and section registrations are top-level).
import "@/lib/studio/sections";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type {
  AnySectionRegistration,
  SectionLibrary
} from "@/lib/studio/sectionTypes";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { StudioErrorBoundary } from "./StudioErrorBoundary";

const YELLOW = "#FFB300";

type UsagePayload = Record<string, { count: number; uniqueMerchants: number }>;

type Props = {
  // The merchant's slug + brand — used to build correct data props
  // for the preview renderers.
  merchantSlug: string;
  brandName: string;
};

export function StudioTemplatesLibrary({ merchantSlug, brandName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL state on mount + on every URL change. `library` defaults
  // to "hero" so the grid always shows something.
  const urlLibrary = (searchParams.get("library") as SectionLibrary | "all" | null) ?? "hero";
  const urlPreview = searchParams.get("preview");
  // `?pageId=` carries the empty-page context — set by the EmptyPage
  // deep link on new pages. When present, template selection skips
  // the page-picker modal and drops straight onto this page.
  const pinnedPageId = searchParams.get("pageId");

  const [library, setLibraryLocal] = useState<SectionLibrary | "all">(urlLibrary);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [usage, setUsage] = useState<UsagePayload>({});
  const [previewingId, setPreviewingIdLocal] = useState<string | null>(urlPreview);

  // Persist filter/preview changes back to the URL. Using replaceState
  // (not push) avoids polluting the back stack — merchants use the
  // browser Back button to leave the library, not to undo a filter.
  const setLibrary = (next: SectionLibrary | "all") => {
    setLibraryLocal(next);
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "hero") sp.delete("library");
    else sp.set("library", next);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  const setPreviewingId = (next: string | null) => {
    setPreviewingIdLocal(next);
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("preview", next);
    else sp.delete("preview");
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  // Debounce search into the URL — writing on every keystroke would
  // spam replaceState.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());
      if (query.trim()) sp.set("q", query.trim());
      else sp.delete("q");
      router.replace(`?${sp.toString()}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/studio/library/usage");
        const json = (await res.json()) as {
          ok: boolean;
          usage?: UsagePayload;
        };
        if (!cancelled && json.ok && json.usage) setUsage(json.usage);
      } catch {
        // silent — panel gracefully degrades to "New" badges.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const all = sectionRegistry.list();
  const libraries = Array.from(new Set(all.map((r) => r.library))).sort();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (library !== "all" && r.library !== library) return false;
      if (!q) return true;
      const hay = [
        r.name,
        r.description,
        ...(r.bestForVerticals ?? []),
        ...(r.telemetryTags ?? [])
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [all, library, query]);

  const counts = sectionRegistry.counts();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      {/* Perf: defer off-screen cards. Each hero preview is an
          iframe (see SectionCard) which the browser lazy-loads +
          isolates automatically. content-visibility skips paint
          entirely for cards below the fold. */}
      <style>{`
        [data-tmpl-card] {
          content-visibility: auto;
          contain-intrinsic-size: 380px;
        }
        @keyframes tmpl-skeleton-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        [data-tmpl-skeleton] {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: #171717;
        }
        [data-tmpl-skeleton]::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 20%,
            rgba(255,255,255,0.06) 40%,
            rgba(255,179,0,0.10) 50%,
            rgba(255,255,255,0.06) 60%,
            transparent 80%
          );
          animation: tmpl-skeleton-shimmer 1.4s ease-in-out infinite;
        }
      `}</style>
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        {brandName} · Library
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Section templates
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Professionally-designed layouts tuned for UK trades. Pick one to
        preview at full size. Use them in your pages via the Replace
        toolbar on any section, or add fresh sections from the page editor.
      </p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterPill
          active={library === "all"}
          onClick={() => setLibrary("all")}
          label={`All (${all.length})`}
        />
        {libraries.map((lib) => (
          <FilterPill
            key={lib}
            active={library === lib}
            onClick={() => setLibrary(lib)}
            label={`${prettyLibraryName(lib)} (${counts[lib] ?? 0})`}
          />
        ))}
        <div className="flex-1" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, trade, tag…"
          className="h-9 w-56 rounded-lg border border-neutral-300 bg-white px-3 text-[12px] font-medium text-neutral-800"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          onClearFilters={() => {
            setQuery("");
            setLibrary("all");
          }}
        />
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((reg) => (
            <li key={reg.id}>
              <StudioErrorBoundary
                label={`Template card: ${reg.id}`}
                compact
              >
                <SectionCard
                  reg={reg}
                  usage={usage[reg.id]}
                  merchantSlug={merchantSlug}
                  onOpen={() => setPreviewingId(reg.id)}
                />
              </StudioErrorBoundary>
            </li>
          ))}
        </ul>
      )}

      {/* Full-viewport preview modal — the "expand" action opens
          here rather than trying to zoom inside the small card. */}
      {previewingId && (
        <TemplatePreviewModal
          templates={filtered}
          activeIndex={Math.max(
            0,
            filtered.findIndex((r) => r.id === previewingId)
          )}
          onChangeIndex={(nextIndex) => {
            const next = filtered[nextIndex];
            if (next) setPreviewingId(next.id);
          }}
          onClose={() => setPreviewingId(null)}
          merchantSlug={merchantSlug}
          pinnedPageId={pinnedPageId}
        />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────

function SectionCard({
  reg,
  usage,
  merchantSlug: _merchantSlug,
  onOpen
}: {
  reg: AnySectionRegistration;
  usage: { count: number; uniqueMerchants: number } | undefined;
  merchantSlug: string;
  onOpen: () => void;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const previewUrl = `/preview/section/${encodeURIComponent(reg.id)}`;

  // Hover-prefetch: on 150ms of sustained hover intent we ask the
  // browser to warm the preview route. When the merchant clicks, the
  // modal renderer already has code + data hot. 150ms filters out
  // "mouse just passing through" so we don't hammer the origin.
  const hoverTimer = useRef<number | null>(null);
  const prefetched = useRef(false);
  const onHoverStart = () => {
    if (prefetched.current) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      prefetched.current = true;
      // Two warms:
      //   · router.prefetch would only warm the RSC payload for
      //     app-router pages — we want the browser cache for the
      //     iframe body too, so a plain GET is enough.
      void fetch(previewUrl, { credentials: "same-origin" }).catch(() => {});
    }, 150);
  };
  const onHoverEnd = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  return (
    <article
      data-tmpl-card
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md"
    >
      {/* Preview — an iframe pointing at the standalone preview route.
          The iframe gives us total isolation from neighbouring cards:
          each hero has its own layout tree, animation frame budget,
          and event loop. `loading="lazy"` defers off-screen iframes.
          Skeleton overlays the iframe until it fires onLoad — zero
          CLS, smooth reveal. */}
      <button
        type="button"
        onClick={onOpen}
        className="group relative block h-40 w-full overflow-hidden bg-neutral-900 text-left"
        aria-label={`Preview ${reg.name} full size`}
      >
        {!iframeLoaded && (
          <span data-tmpl-skeleton aria-hidden="true" />
        )}
        <iframe
          src={previewUrl}
          loading="lazy"
          title={`Preview: ${reg.name}`}
          sandbox="allow-same-origin allow-scripts"
          onLoad={() => setIframeLoaded(true)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "400%",
            height: "400%",
            transform: "scale(0.25)",
            transformOrigin: "top left",
            border: 0,
            pointerEvents: "none",
            background: "#0A0A0A",
            opacity: iframeLoaded ? 1 : 0,
            transition: "opacity 200ms ease-out"
          }}
        />
        {/* Hover overlay — makes the "click to view full size" affordance explicit */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
          <span
            className="rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest opacity-0 transition group-hover:opacity-100"
            style={{ background: YELLOW, color: "#0A0A0A" }}
          >
            Preview full size ↗
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="text-[9px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              {prettyLibraryName(reg.library)}
            </p>
            <p className="mt-0.5 text-[14px] font-extrabold text-neutral-900">
              {reg.name}
            </p>
          </div>
          <UsageBadge usage={usage} />
        </div>

        <p className="text-[12px] leading-relaxed text-neutral-600">
          {reg.description}
        </p>

        {reg.bestForVerticals && reg.bestForVerticals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {reg.bestForVerticals.slice(0, 4).map((v) => (
              <span
                key={v}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-neutral-600"
              >
                {v.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2 text-[10px] text-neutral-400">
          <code className="rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-[9px]">
            {reg.id}
          </code>
          <span>·</span>
          <span>v{reg.version}</span>
        </div>
      </div>
    </article>
  );
}

function UsageBadge({
  usage
}: {
  usage: { count: number; uniqueMerchants: number } | undefined;
}) {
  if (!usage || usage.count === 0) {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest"
        style={{ background: "#F5F5F5", color: "#737373" }}
      >
        New
      </span>
    );
  }
  const label =
    usage.uniqueMerchants >= 100
      ? `${Math.floor(usage.uniqueMerchants / 100) * 100}+ merchants`
      : usage.uniqueMerchants >= 10
        ? `${usage.uniqueMerchants} merchants`
        : `${usage.uniqueMerchants} merchant${usage.uniqueMerchants === 1 ? "" : "s"}`;
  return (
    <span
      className="shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest"
      style={{ background: YELLOW, color: "#0A0A0A" }}
      title={`Picked ${usage.count} times · ${usage.uniqueMerchants} merchants`}
    >
      {label}
    </span>
  );
}

function FilterPill({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-extrabold uppercase tracking-widest transition"
      style={{
        background: active ? "#0A0A0A" : "transparent",
        borderColor: active ? "#0A0A0A" : "#D4D4D4",
        color: active ? "#FFFFFF" : "#404040"
      }}
    >
      {label}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────

function EmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="mt-12 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Nothing matches
      </p>
      <p className="mt-2 text-[16px] font-extrabold text-neutral-900">
        No templates for that combination
      </p>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-neutral-600">
        Try a different library, remove the search, or view all templates
        together.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-5 inline-flex h-10 items-center rounded-lg bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-neutral-700"
      >
        Clear filters
      </button>
    </div>
  );
}

// ─── Library name pretty-printer ──────────────────────────────

const LIBRARY_LABELS: Record<string, string> = {
  hero: "Hero",
  product_grid: "Product grid",
  categories: "Categories",
  banner: "Banner",
  services: "Services",
  features: "Features",
  testimonials: "Testimonials",
  faq: "FAQ",
  gallery: "Gallery",
  video: "Video",
  pricing: "Pricing",
  statistics: "Statistics",
  brands: "Brands",
  team: "Team",
  newsletter: "Newsletter",
  contact: "Contact",
  map: "Map",
  footer: "Footer",
  cta: "CTA"
};

function prettyLibraryName(k: string): string {
  return LIBRARY_LABELS[k] ?? k;
}
