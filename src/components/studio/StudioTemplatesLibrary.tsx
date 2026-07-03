"use client";

// StudioTemplatesLibrary — browse-catalog for every registered section.
//
// One card per SectionRegistration. Each card renders the section's
// own renderer at scaled-down size for a true pixel-fidelity preview
// (no maintained thumbnail art required — the renderer IS the truth).
// Fetches usage counts from /api/studio/library/usage once on mount
// and overlays a "Used by N merchants" badge.
//
// Filter by library kind + free-text search on name / tags / verticals.
// Click a card to expand the preview to full-size. "Use this" is a
// future refinement — for Module 5 the catalog is browse-only; the
// page editor's Replace toolbar action handles in-place swap.

import { useEffect, useMemo, useState } from "react";
// Side-effect import so the registry is populated (server-rendered
// pages import this too, and section registrations are top-level).
import "@/lib/studio/sections";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type {
  AnySectionRegistration,
  SectionLibrary
} from "@/lib/studio/sectionTypes";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";
import { TemplatePreviewModal } from "./TemplatePreviewModal";

const YELLOW = "#FFB300";

type UsagePayload = Record<string, { count: number; uniqueMerchants: number }>;

type Props = {
  // The merchant's slug + brand — used to build correct data props
  // for the preview renderers.
  merchantSlug: string;
  brandName: string;
};

export function StudioTemplatesLibrary({ merchantSlug, brandName }: Props) {
  const [library, setLibrary] = useState<SectionLibrary | "all">("hero");
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState<UsagePayload>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);

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
      {/* Perf: freeze animations inside preview cards + defer off-screen
          cards. Rendering 24 heroes with infinite CSS animations at
          400% scale otherwise crushes the browser. Full-scale
          animation still plays inside the preview modal. */}
      <style>{`
        [data-tmpl-preview-frozen],
        [data-tmpl-preview-frozen] * {
          animation-play-state: paused !important;
          animation-delay: 0s !important;
        }
        [data-tmpl-card] {
          content-visibility: auto;
          contain-intrinsic-size: 380px;
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
        <p className="mt-12 text-center text-[13px] text-neutral-500">
          No sections match — try clearing the search or picking a different
          library.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((reg) => (
            <li key={reg.id}>
              <SectionCard
                reg={reg}
                usage={usage[reg.id]}
                merchantSlug={merchantSlug}
                onOpen={() => setPreviewingId(reg.id)}
              />
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
        />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────

function SectionCard({
  reg,
  usage,
  merchantSlug,
  onOpen
}: {
  reg: AnySectionRegistration;
  usage: { count: number; uniqueMerchants: number } | undefined;
  merchantSlug: string;
  onOpen: () => void;
}) {
  const Renderer = reg.renderer;
  const defaults = reg.defaultConfig();
  const data = {
    merchantId: "preview",
    slug: merchantSlug,
    merchantName: "Your business",
    city: "Your city",
    whatsappHref: null,
    brandName: "Main brand",
    domain: {}
  };

  return (
    <article
      data-tmpl-card
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md"
    >
      {/* Preview — the real renderer, scaled down + animation-frozen.
          Clicking opens the full-viewport preview modal where the
          animations play at full quality. */}
      <button
        type="button"
        onClick={onOpen}
        className="group relative block h-40 w-full overflow-hidden bg-neutral-100 text-left"
        aria-label={`Preview ${reg.name} full size`}
      >
        <div
          data-tmpl-preview-frozen
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "400%",
            height: "400%",
            transform: "scale(0.25)",
            transformOrigin: "top left",
            pointerEvents: "none"
          }}
        >
          <Renderer
            instanceId="preview"
            config={defaults}
            tokens={DEFAULT_TOKENS}
            data={data}
            mode="preview"
          />
        </div>
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
