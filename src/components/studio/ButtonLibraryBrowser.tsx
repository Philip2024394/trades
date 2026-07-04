"use client";

// Studio Button Library — merchant-facing browser.
//
// Same shape as SectionLibraryBrowser but scoped to buttons: category
// nav on desktop, mobile drawer, search across name/description/
// keywords/role/category, live-preview cards themed to the merchant's
// brand tokens. Every card renders the button at real size in the
// default state.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buttonRegistry } from "@/platform/buttons";
import "@/platform/buttons";
import { PersonalButtonsPanel } from "./PersonalButtonsPanel";
import type {
  BrandTokens,
  MerchantData
} from "@/lib/studio/sectionTypes";
import type { ButtonCategory } from "@/platform/buttons/types";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

const VALID_CATEGORIES: ButtonCategory[] = [
  "basic",
  "marketing",
  "ecommerce",
  "navigation",
  "social",
  "utility",
  "floating",
  "interactive"
];

const CATEGORY_LABEL: Record<ButtonCategory, string> = {
  basic: "Basic",
  marketing: "Marketing",
  ecommerce: "Ecommerce",
  navigation: "Navigation",
  social: "Social",
  utility: "Utility",
  floating: "Floating",
  interactive: "Interactive"
};

const CATEGORY_PITCH: Partial<Record<ButtonCategory, string>> = {
  basic: "The workhorse foundations — primary, secondary, ghost, outline.",
  marketing: "Book, buy, subscribe, WhatsApp. The clicks that pay bills.",
  ecommerce: "Cart, wishlist, checkout, pre-order — every commerce moment.",
  navigation: "Move through the site cleanly.",
  social: "Share, follow, connect.",
  utility: "Save, print, copy, delete.",
  floating: "Sticky, corner, scroll-to-top — persistent CTAs.",
  interactive: "Toggles, chips, splits, dropdowns."
};

function isValidCategory(v: unknown): v is ButtonCategory {
  return (
    typeof v === "string" && (VALID_CATEGORIES as string[]).includes(v)
  );
}

export function ButtonLibraryBrowser({
  merchantTokens,
  merchantData
}: {
  merchantTokens: BrandTokens;
  merchantData: MerchantData;
}) {
  const searchParams = useSearchParams();
  const initialCat = searchParams?.get("cat");
  const all = useMemo(() => buttonRegistry.list(), []);
  const [activeCategory, setActiveCategory] = useState<
    ButtonCategory | "all"
  >(isValidCategory(initialCat) ? (initialCat as ButtonCategory) : "all");
  useEffect(() => {
    const cat = searchParams?.get("cat");
    if (isValidCategory(cat)) setActiveCategory(cat as ButtonCategory);
  }, [searchParams]);

  const [query, setQuery] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [tab, setTab] = useState<"library" | "mine">("library");

  const categories = useMemo(() => {
    const populated = new Set(all.map((r) => r.category));
    return VALID_CATEGORIES.filter((c) => populated.has(c));
  }, [all]);

  const visible = useMemo(() => {
    const q = query.trim();
    let out = q ? buttonRegistry.search(q, 500) : all;
    if (activeCategory !== "all") {
      out = out.filter((r) => r.category === activeCategory);
    }
    return out;
  }, [all, activeCategory, query]);

  const counts = useMemo(() => {
    const out: Partial<Record<ButtonCategory | "all", number>> = {
      all: all.length
    };
    for (const r of all) out[r.category] = (out[r.category] ?? 0) + 1;
    return out;
  }, [all]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Button Library
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Every button, every category. Themed to your brand.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        The catalogue of every registered button. Cards render live in
        your active brand. Swap presets in Design Presets to see the
        whole library repaint. Set a global to apply the same variant
        everywhere.
      </p>

      <div className="mt-8 flex items-center gap-2 border-b border-neutral-200 pb-1">
        <TabButton
          active={tab === "library"}
          label="Library"
          onClick={() => setTab("library")}
        />
        <TabButton
          active={tab === "mine"}
          label="My buttons"
          onClick={() => setTab("mine")}
        />
      </div>

      {tab === "library" && (
        <div className="mt-6">
          <label
            htmlFor="button-search"
            className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500"
          >
            Search
          </label>
          <input
            id="button-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. WhatsApp, add to cart, book, icon"
            className="w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
          />
        </div>
      )}

      {tab === "mine" && (
        <div className="mt-6">
          <PersonalButtonsPanel
            merchantTokens={merchantTokens}
            merchantData={merchantData}
          />
        </div>
      )}

      {tab === "library" && (
      <>
      <div className="mt-6 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
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
              {activeCategory === "all"
                ? "All"
                : CATEGORY_LABEL[activeCategory]}
            </span>
          </span>
          <span
            className="ml-1 rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: "#F5F5F5", color: "#525252" }}
          >
            {activeCategory === "all"
              ? counts["all"] ?? 0
              : counts[activeCategory] ?? 0}
          </span>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden min-w-0 lg:block">
          <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Categories
          </p>
          <nav className="flex flex-col gap-1">
            <CategoryPill
              label="All"
              count={counts["all"] ?? 0}
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            {categories.map((c) => (
              <CategoryPill
                key={c}
                label={CATEGORY_LABEL[c]}
                pitch={CATEGORY_PITCH[c]}
                count={counts[c] ?? 0}
                active={activeCategory === c}
                onClick={() => setActiveCategory(c)}
              />
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          {activeCategory !== "all" && CATEGORY_PITCH[activeCategory] && (
            <p className="mb-4 text-[13px] font-bold text-neutral-700">
              {CATEGORY_PITCH[activeCategory]}
            </p>
          )}
          {visible.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
              <p className="text-[13px] font-bold text-neutral-600">
                No buttons match.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((reg) => (
                <li key={reg.id}>
                  <ButtonCard
                    reg={reg}
                    tokens={merchantTokens}
                    data={merchantData}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 text-center text-[11px] text-neutral-400">
            {all.length} button{all.length === 1 ? "" : "s"} registered ·
            palette-aware · role-preserving swap
          </p>
        </div>
      </div>

      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-[350] flex flex-col bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Categories"
        >
          <div
            className="mt-auto max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300" />
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Categories
            </p>
            <ul className="flex flex-col gap-1">
              <li>
                <CategoryPill
                  label="All"
                  count={counts["all"] ?? 0}
                  active={activeCategory === "all"}
                  onClick={() => {
                    setActiveCategory("all");
                    setMobileDrawerOpen(false);
                  }}
                />
              </li>
              {categories.map((c) => (
                <li key={c}>
                  <CategoryPill
                    label={CATEGORY_LABEL[c]}
                    pitch={CATEGORY_PITCH[c]}
                    count={counts[c] ?? 0}
                    active={activeCategory === c}
                    onClick={() => {
                      setActiveCategory(c);
                      setMobileDrawerOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-9 items-center px-3 text-[11px] font-extrabold uppercase tracking-widest transition"
      style={{
        color: active ? BLACK : "#737373"
      }}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: YELLOW }}
        />
      )}
    </button>
  );
}

function CategoryPill({
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

function ButtonCard({
  reg,
  tokens,
  data
}: {
  reg: ReturnType<typeof buttonRegistry.list>[number];
  tokens: BrandTokens;
  data: MerchantData;
}) {
  const Renderer = reg.renderer;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md">
      <div
        className="flex min-h-[112px] items-center justify-center border-b border-neutral-100 p-6"
        style={{ background: "#FAFAFA" }}
      >
        <Renderer
          instanceId={`btn-preview-${reg.id}`}
          config={reg.defaultConfig()}
          state="default"
          tokens={tokens}
          role={reg.role}
          size={reg.size}
          shape={reg.shape}
          motion={reg.motion}
          data={data}
          mode="preview"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p
          className="text-[9px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          {reg.category} · {reg.role}
        </p>
        <h3 className="text-[13px] font-extrabold text-neutral-900">
          {reg.name}
        </h3>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-600">
          {reg.shortPitch}
        </p>
        <p className="mt-auto truncate font-mono text-[9px] text-neutral-400">
          {reg.id} · v{reg.version}
        </p>
      </div>
    </article>
  );
}
