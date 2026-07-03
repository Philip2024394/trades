"use client";

// Studio Section Library — merchant-facing browser + full-size preview.
//
// The catalogue of every section registered in the platform, grouped
// by library, filterable by industry + difficulty, searchable by name
// + keywords + best-for. Every card shows the section rendering live
// with the merchant's brand tokens (25% scale, isolated in `preview`
// mode so no interactive JS fires).
//
// Clicking a card opens a FULL-SIZE live preview overlay with two
// terminal actions: "Add to page" (picks a merchant page, fetches its
// draft layout, appends the new section, saves) and "Back to library"
// (dismisses).

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
// Side-effect: registers every built-in section so the catalogue is
// populated before we render.
import "@/lib/studio/sections";
import type {
  BrandTokens,
  MerchantData,
  SectionLibrary
} from "@/lib/studio/sectionTypes";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

type AnySection = ReturnType<typeof sectionRegistry.list>[number];

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

const VALID_LIBRARIES: SectionLibrary[] = [
  "hero", "product_grid", "categories", "banner", "services", "features",
  "testimonials", "faq", "gallery", "video", "pricing", "statistics",
  "brands", "team", "newsletter", "contact", "map", "footer", "cta"
];

function isValidLibrary(v: unknown): v is SectionLibrary {
  return typeof v === "string" && (VALID_LIBRARIES as string[]).includes(v);
}

const LIBRARY_LABEL: Record<SectionLibrary, string> = {
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

const LIBRARY_PITCH: Partial<Record<SectionLibrary, string>> = {
  hero: "Set the tone in the first second.",
  faq: "Answer objections before they cost you a customer.",
  testimonials: "Let real customers do the pitching.",
  statistics: "Numbers that build trust in one glance.",
  features: "Explain what you sell, cleanly.",
  services: "The list customers scan for what they need.",
  pricing: "Turn a hesitation into a decision.",
  cta: "One line, one action, one moment of clarity.",
  gallery: "Show the work when the work is the pitch.",
  video: "Motion where a photo would fall short.",
  team: "Faces close the trust gap.",
  contact: "Make it easy to hire you.",
  map: "Answer 'do you cover me?' instantly.",
  newsletter: "Own the relationship, not just the visit.",
  brands: "Borrow trust from names customers already know.",
  banner: "Timely, dismissable, above-the-fold.",
  footer: "The last line of a good page.",
  product_grid: "Every product, one glance.",
  categories: "Split a big catalogue into a friendly path."
};

export function SectionLibraryBrowser({
  merchantTokens,
  merchantData
}: {
  merchantTokens: BrandTokens;
  merchantData: MerchantData;
}) {
  const all = useMemo(() => sectionRegistry.list(), []);
  const libraries = useMemo(() => {
    // Ordered: put populated libraries the merchant is most likely to
    // reach for first, empties collapse to the tail.
    const populated = new Set(all.map((r) => r.library));
    const ordering: SectionLibrary[] = [
      "hero", "cta", "faq", "testimonials", "statistics", "features",
      "services", "pricing", "gallery", "video", "team", "map",
      "contact", "newsletter", "brands", "product_grid", "categories",
      "banner", "footer"
    ];
    return ordering.filter((lib) => populated.has(lib));
  }, [all]);

  const searchParams = useSearchParams();
  const initialCat = searchParams?.get("cat");
  const [activeLibrary, setActiveLibrary] = useState<SectionLibrary | "all">(
    isValidLibrary(initialCat) ? (initialCat as SectionLibrary) : "all"
  );
  useEffect(() => {
    const cat = searchParams?.get("cat");
    if (isValidLibrary(cat)) {
      setActiveLibrary(cat as SectionLibrary);
    }
  }, [searchParams]);
  const [query, setQuery] = useState("");
  const [previewReg, setPreviewReg] = useState<AnySection | null>(null);
  // Mobile categories: closed by default so the grid gets full width;
  // opens as a slide-in drawer on tap. Desktop (lg+) ignores this and
  // always shows the sidebar.
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (activeLibrary !== "all" && r.library !== activeLibrary) return false;
      if (!q) return true;
      const haystack = [
        r.name,
        r.description,
        r.library,
        ...(r.bestForVerticals ?? []),
        ...(r.telemetryTags ?? [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [all, activeLibrary, query]);

  const counts = useMemo(() => {
    const out: Partial<Record<SectionLibrary | "all", number>> = { all: all.length };
    for (const r of all) {
      out[r.library] = (out[r.library] ?? 0) + 1;
    }
    return out;
  }, [all]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Section Library
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Every section, every category. Themed to your brand.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        The catalogue of everything the Studio can render. Cards below
        preview live with your active brand tokens — swap presets to see
        the whole library repaint instantly. Pick what fits, then add it
        from your page editor.
      </p>

      {/* Search */}
      <div className="mt-8">
        <label
          htmlFor="section-search"
          className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500"
        >
          Search
        </label>
        <input
          id="section-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. WhatsApp CTA, coverage map, video hero, before / after"
          className="w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
        />
      </div>

      {/* Mobile-only category chip — opens the drawer, freeing the
          grid to render full width the rest of the time. */}
      <div className="mt-6 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileCategoriesOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-800 shadow-sm active:bg-neutral-50"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span>
            Categories:{" "}
            <span style={{ color: BLACK }}>
              {activeLibrary === "all"
                ? "All"
                : LIBRARY_LABEL[activeLibrary]}
            </span>
          </span>
          <span
            className="ml-1 rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: "#F5F5F5", color: "#525252" }}
          >
            {activeLibrary === "all"
              ? counts["all"] ?? 0
              : counts[activeLibrary] ?? 0}
          </span>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[220px_1fr]">
        {/* Desktop-only library nav — the mobile drawer below covers
            small screens without stealing grid width. */}
        <aside className="hidden min-w-0 lg:block">
          <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Categories
          </p>
          <nav className="flex flex-col gap-1">
            <LibraryPill
              label="All"
              count={counts["all"] ?? 0}
              active={activeLibrary === "all"}
              onClick={() => setActiveLibrary("all")}
            />
            {libraries.map((lib) => (
              <LibraryPill
                key={lib}
                label={LIBRARY_LABEL[lib]}
                pitch={LIBRARY_PITCH[lib]}
                count={counts[lib] ?? 0}
                active={activeLibrary === lib}
                onClick={() => setActiveLibrary(lib)}
              />
            ))}
          </nav>
        </aside>

        {/* Grid */}
        <div className="min-w-0">
          {activeLibrary !== "all" && LIBRARY_PITCH[activeLibrary as SectionLibrary] && (
            <p className="mb-4 text-[13px] font-bold text-neutral-700">
              {LIBRARY_PITCH[activeLibrary as SectionLibrary]}
            </p>
          )}
          {visible.length === 0 ? (
            <EmptyState query={query} activeLibrary={activeLibrary} />
          ) : (
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((reg) => (
                <li key={reg.id}>
                  <SectionCard
                    reg={reg}
                    tokens={merchantTokens}
                    data={merchantData}
                    onOpenPreview={() => setPreviewReg(reg)}
                  />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-center text-[11px] text-neutral-400">
            {all.length} section{all.length === 1 ? "" : "s"} registered ·{" "}
            palette-aware · content-preserving swap across every card
          </p>
        </div>
      </div>

      {/* Mobile categories drawer */}
      {mobileCategoriesOpen && (
        <MobileCategoriesDrawer
          activeLibrary={activeLibrary}
          libraries={libraries}
          counts={counts}
          onPick={(lib) => {
            setActiveLibrary(lib);
            setMobileCategoriesOpen(false);
          }}
          onClose={() => setMobileCategoriesOpen(false)}
        />
      )}

      {/* Full-size live preview overlay */}
      {previewReg && (
        <FullSizePreviewOverlay
          reg={previewReg}
          tokens={merchantTokens}
          data={merchantData}
          onClose={() => setPreviewReg(null)}
        />
      )}
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────

function LibraryPill({
  label,
  count,
  active,
  onClick,
  pitch
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  pitch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition"
      style={{
        background: active ? BLACK : "transparent",
        color: active ? "#FFFFFF" : "#0A0A0A",
        borderColor: active ? BLACK : "#E5E5E5"
      }}
      title={pitch}
    >
      <span className="text-[12px] font-extrabold">{label}</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
        style={{
          background: active ? "rgba(255,255,255,0.15)" : "#F5F5F5",
          color: active ? "#FFFFFF" : "#525252"
        }}
      >
        {count}
      </span>
    </button>
  );
}

function SectionCard({
  reg,
  tokens,
  data,
  onOpenPreview
}: {
  reg: AnySection;
  tokens: BrandTokens;
  data: MerchantData;
  onOpenPreview: () => void;
}) {
  const Renderer = reg.renderer;
  const config = useMemo(() => reg.defaultConfig(), [reg]);

  return (
    <article
      onClick={onOpenPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenPreview();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Preview ${reg.name}`}
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
    >
      {/* Scaled preview. The wrapper uses a 3:2 aspect so hero banners
          (typically ~1440×960 at "true" size) fit fully with no vertical
          clipping. Inner element is sized to 1/scale × 100% so the
          renderer sees a real desktop viewport before the down-scale. */}
      <div
        className="relative w-full overflow-hidden"
        style={{ background: "#FAFAFA", aspectRatio: "3 / 2" }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: "500%",
            height: "500%",
            transform: "scale(0.2)",
            transformOrigin: "top left",
            pointerEvents: "none"
          }}
        >
          <Renderer
            instanceId={`preview-${reg.id}`}
            config={config}
            tokens={tokens}
            data={data}
            mode="preview"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-[9px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              {reg.library}
            </p>
            <h3 className="mt-0.5 truncate text-[14px] font-extrabold text-neutral-900">
              {reg.name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-400">
              {reg.id}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-500"
            style={{ background: "#F5F5F5" }}
          >
            v{reg.version}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-neutral-600 line-clamp-2">
          {reg.description}
        </p>
        {reg.bestForVerticals && reg.bestForVerticals.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reg.bestForVerticals.slice(0, 4).map((v: string) => (
              <span
                key={v}
                className="rounded-full px-2 py-0.5 font-mono text-[9px] text-neutral-500"
                style={{ background: "#F5F5F5" }}
              >
                {v}
              </span>
            ))}
            {reg.bestForVerticals.length > 4 && (
              <span className="rounded-full px-2 py-0.5 font-mono text-[9px] text-neutral-400">
                +{reg.bestForVerticals.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyState({
  query,
  activeLibrary
}: {
  query: string;
  activeLibrary: SectionLibrary | "all";
}) {
  const msg = query
    ? `No sections match "${query}"${activeLibrary !== "all" ? ` in ${activeLibrary}` : ""}.`
    : activeLibrary !== "all"
      ? `No sections registered in ${activeLibrary} yet — this category populates as we ship more.`
      : "No sections registered.";
  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center">
      <p className="text-[13px] font-bold text-neutral-600">{msg}</p>
      <p className="max-w-md text-[11px] text-neutral-500">
        New sections appear here automatically the moment they're
        registered — no config, no cache to bust.
      </p>
    </div>
  );
}

// ─── Mobile categories drawer ──────────────────────────────

function MobileCategoriesDrawer({
  activeLibrary,
  libraries,
  counts,
  onPick,
  onClose
}: {
  activeLibrary: SectionLibrary | "all";
  libraries: SectionLibrary[];
  counts: Partial<Record<SectionLibrary | "all", number>>;
  onPick: (lib: SectionLibrary | "all") => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[350] flex flex-col bg-black/50 backdrop-blur-sm lg:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Section categories"
    >
      <div
        className="mt-auto max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300" />
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Categories
          </p>
          <button
            type="button"
            aria-label="Close categories"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          <li>
            <LibraryPill
              label="All"
              count={counts["all"] ?? 0}
              active={activeLibrary === "all"}
              onClick={() => onPick("all")}
            />
          </li>
          {libraries.map((lib) => (
            <li key={lib}>
              <LibraryPill
                label={LIBRARY_LABEL[lib]}
                pitch={LIBRARY_PITCH[lib]}
                count={counts[lib] ?? 0}
                active={activeLibrary === lib}
                onClick={() => onPick(lib)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Full-size preview overlay ────────────────────────────────

type StudioPageRow = {
  id: string;
  slug: string;
  name: string;
  is_home: boolean;
};

type AddState =
  | { kind: "idle" }
  | { kind: "adding" }
  | { kind: "success"; pageName: string }
  | { kind: "error"; message: string };

function FullSizePreviewOverlay({
  reg,
  tokens,
  data,
  onClose
}: {
  reg: AnySection;
  tokens: BrandTokens;
  data: MerchantData;
  onClose: () => void;
}) {
  const Renderer = reg.renderer;
  const config = useMemo(() => reg.defaultConfig(), [reg]);
  const [pages, setPages] = useState<StudioPageRow[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addState, setAddState] = useState<AddState>({ kind: "idle" });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/studio/pages");
        const json = (await res.json()) as
          | { ok: true; pages: StudioPageRow[] }
          | { ok: false; error: string };
        if (!cancelled && json.ok) setPages(json.pages);
      } catch {
        // Non-fatal — merchant can still preview; adding is disabled.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addToPage(page: StudioPageRow) {
    setAddState({ kind: "adding" });
    setPickerOpen(false);
    try {
      const res = await fetchWithRetry(
        `/api/studio/pages/${page.id}/append-section`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionKey: reg.id,
            config: reg.defaultConfig()
          })
        }
      );
      const json = (await res.json()) as
        | { ok: true; instanceId: string; pageName: string }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setAddState({ kind: "success", pageName: json.pageName });
    } catch (err) {
      setAddState({
        kind: "error",
        message: (err as Error).message ?? "Save failed"
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-neutral-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${reg.name}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Live preview · {reg.library}
          </p>
          <h2 className="mt-0.5 truncate text-[16px] font-extrabold text-neutral-900 sm:text-[18px]">
            {reg.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50 sm:px-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="hidden sm:inline">Back to library</span>
          <span className="sm:hidden">Back</span>
        </button>
      </header>

      {/* Live section rendering — full width, full theme */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1440px]">
          <Renderer
            instanceId={`fullpreview-${reg.id}`}
            config={config}
            tokens={tokens}
            data={data}
            mode="preview"
          />
        </div>
      </main>

      {/* Footer — accept or cancel */}
      <footer className="border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] leading-relaxed text-neutral-600">
              {reg.description}
            </p>
            {reg.bestForVerticals && reg.bestForVerticals.length > 0 && (
              <p className="mt-0.5 text-[10px] text-neutral-400">
                Best for: {reg.bestForVerticals.slice(0, 5).join(" · ")}
              </p>
            )}
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {addState.kind === "success" && (
              <p
                role="status"
                className="rounded-lg px-3 py-2 text-[12px] font-bold"
                style={{
                  background: "rgba(16,185,129,0.10)",
                  color: "#059669"
                }}
              >
                Added to {addState.pageName} ✓
              </p>
            )}
            {addState.kind === "error" && (
              <p
                role="alert"
                className="rounded-lg px-3 py-2 text-[12px] font-bold"
                style={{
                  background: "rgba(220,38,38,0.10)",
                  color: "#DC2626"
                }}
              >
                {addState.message}
              </p>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((p) => !p)}
                disabled={!pages || pages.length === 0 || addState.kind === "adding"}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                style={{ background: YELLOW }}
              >
                <span>
                  {addState.kind === "adding"
                    ? "Adding…"
                    : addState.kind === "success"
                      ? "Add to another page"
                      : "Add to page"}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {pickerOpen && pages && pages.length > 0 && (
                <div
                  className="absolute right-0 z-10 mt-1 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl"
                  style={{ bottom: "calc(100% + 4px)" }}
                >
                  <p className="border-b border-neutral-100 px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                    Pick a page
                  </p>
                  <ul className="max-h-60 overflow-y-auto">
                    {pages.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => addToPage(p)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-bold text-neutral-800 transition hover:bg-neutral-50"
                        >
                          <span className="truncate">{p.name}</span>
                          {p.is_home && (
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                              style={{
                                background: "#F5F5F5",
                                color: "#525252"
                              }}
                            >
                              Home
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
