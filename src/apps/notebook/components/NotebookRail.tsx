// NotebookRail — persistent left-edge tab + slide-in drawer.
//
// Mirror of DashboardRail (right side). Same pattern:
//   1. Collapsed — narrow black tab on left edge, "NOTEBOOK" vertical
//      text + notebook icon. Always visible on every marketplace-adjacent
//      route.
//   2. Expanded — slide-in drawer from left edge (full screen height),
//      backdrop dims page, close X inside drawer.
//
// Three entry points:
//   - Header nav "Notebook" link (fires `tc:open-notebook` window event)
//   - Identity chip dropdown "Notebook" link (same event)
//   - The tab itself
//
// Drawer contains navigation ONLY (sections + Quote Me + Add item +
// location + discipline filter + search). Product cards render on the
// /tc/notebook page main content.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Notebook as NotebookIcon,
  X,
  ChevronLeft,
  MapPin,
  Search,
  Send,
  Plus,
  Tag,
  Receipt,
  Repeat,
  FileText,
  Radio,
  ShoppingBag,
  ChevronRight
} from "lucide-react";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";
import { DEMO_NOTEBOOK, NOTEBOOK_OFFERS_FIXTURES, NOTEBOOK_BULK_QUOTES_FIXTURES, JOB_TEMPLATE_FIXTURES } from "@/apps/notebook/data/notebook";
import { ORDER_FIXTURES } from "@/apps/orders/data/orders";

const DISCIPLINE_OPTIONS = [
  { value: "all",           label: "All trades" },
  { value: "plastering",    label: "Plastering" },
  { value: "drywall",       label: "Drywall" },
  { value: "electrical",    label: "Electrical" },
  { value: "plumbing",      label: "Plumbing" },
  { value: "carpentry",     label: "Carpentry" },
  { value: "tiling",        label: "Tiling" },
  { value: "general",       label: "General" }
];

type SectionKey =
  | "regulars"
  | "past-orders"
  | "offers"
  | "quotes"
  | "substitutes"
  | "templates"
  | "trending";

const SECTIONS: Array<{ key: SectionKey; label: string; Icon: typeof NotebookIcon; count: number }> = [
  { key: "regulars",    label: "My Regulars",   Icon: NotebookIcon, count: DEMO_NOTEBOOK.items.length },
  { key: "past-orders", label: "Past Orders",   Icon: ShoppingBag,  count: ORDER_FIXTURES.length },
  { key: "offers",      label: "Offers",        Icon: Tag,          count: NOTEBOOK_OFFERS_FIXTURES.length },
  { key: "quotes",      label: "Bulk Quotes",   Icon: Receipt,      count: NOTEBOOK_BULK_QUOTES_FIXTURES.length },
  { key: "substitutes", label: "Substitutes",   Icon: Repeat,       count: 0 },
  { key: "templates",   label: "Job Templates", Icon: FileText,     count: JOB_TEMPLATE_FIXTURES.length },
  { key: "trending",    label: "Trending",      Icon: Radio,        count: 0 }
];

const LOCATION_KEY = "tc.notebook.location";

export function NotebookRail() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("Manchester M20");
  const [changingLocation, setChangingLocation] = useState(false);
  const [discipline, setDiscipline] = useState("all");
  const [query, setQuery] = useState("");
  const router = useRouter();
  const identity = currentViewerTrade();

  // Load persisted location
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LOCATION_KEY);
    if (saved) setLocation(saved);
  }, []);

  // Listen for the open-notebook event fired from header/dropdown
  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("tc:open-notebook", onOpen);
    return () => window.removeEventListener("tc:open-notebook", onOpen);
  }, []);

  // Body scroll lock + ESC
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const saveLocation = useCallback((next: string) => {
    setLocation(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCATION_KEY, next);
    }
    setChangingLocation(false);
  }, []);

  const goToSection = useCallback((key: SectionKey) => {
    const search = new URLSearchParams();
    search.set("section", key);
    if (discipline !== "all") search.set("cat", discipline);
    if (query.trim()) search.set("q", query.trim());
    router.push(`/tc/notebook?${search.toString()}`);
    // Close on mobile to reveal content
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setOpen(false);
    }
  }, [router, discipline, query]);

  return (
    <>
      {/* Persistent left-edge tab (always visible) */}
      <aside
        className="fixed left-0 z-20 -translate-y-1/2"
        style={{ top: "28%" }}
        aria-label="Notebook access"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="group flex items-center gap-1 rounded-r-2xl border py-3 pl-1.5 pr-2 shadow-lg backdrop-blur transition-transform hover:translate-x-0.5"
          style={{
            backgroundColor: "#0A0A0A",
            color: "#FFB300",
            borderColor: "rgba(255,179,0,0.3)"
          }}
          title="Open your notebook"
        >
          <ChevronRight size={12} className="opacity-60 group-hover:opacity-100"/>
          <div className="flex flex-col items-center gap-2">
            <NotebookIcon size={16} strokeWidth={2.2}/>
            <div
              className="rotate-180 text-[9px] font-black uppercase tracking-[0.16em]"
              style={{ writingMode: "vertical-rl", color: "#FFB300" }}
            >
              Notebook
            </div>
          </div>
        </button>
      </aside>

      {/* Expanded drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Your notebook"
        >
          <aside
            className="relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl"
          >
            {/* Header */}
            <header
              className="flex items-center justify-between border-b p-4"
              style={{
                backgroundColor: "#0A0A0A",
                color: "#FFFFFF",
                borderColor: "rgba(255,179,0,0.3)"
              }}
            >
              <div className="flex items-center gap-2">
                <NotebookIcon size={18} style={{ color: "#FFB300" }}/>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: "#FFB300" }}>
                    TC · Notebook
                  </div>
                  <div className="text-[13px] font-black">{identity.displayName}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                aria-label="Close notebook"
              >
                <X size={16}/>
              </button>
            </header>

            {/* Location + discipline + search */}
            <section className="flex flex-col gap-3 border-b p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              {/* Location pill */}
              {!changingLocation ? (
                <button
                  type="button"
                  onClick={() => setChangingLocation(true)}
                  className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-full border bg-neutral-50 px-3 text-left"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <span className="flex items-center gap-2">
                    <MapPin size={13} className="text-neutral-500"/>
                    <span className="text-[12px] font-black text-neutral-900">{location}</span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Change</span>
                </button>
              ) : (
                <LocationEditor initial={location} onSave={saveLocation} onCancel={() => setChangingLocation(false)}/>
              )}

              {/* Discipline dropdown */}
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Trade discipline
                </span>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className="min-h-[40px] rounded-md border bg-white px-3 text-[12.5px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  {DISCIPLINE_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>

              {/* Search */}
              <label
                className="flex min-h-[40px] items-center gap-2 rounded-md border bg-neutral-50 px-3"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <Search size={12} className="text-neutral-500"/>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400"
                />
              </label>
            </section>

            {/* Quote Me feature entry */}
            <section
              className="border-b p-4"
              style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFDF8" }}
            >
              <div className="flex items-center gap-2">
                <Send size={13} style={{ color: "#B45309" }}/>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
                  Quote Me
                </div>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-700">
                Pick items → nearest verified merchants price the whole basket → one delivery.
              </p>
              <button
                type="button"
                onClick={() => {
                  router.push("/tc/notebook?section=regulars&quoteme=1");
                  if (window.innerWidth < 768) setOpen(false);
                }}
                className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                Build quote request →
              </button>
            </section>

            {/* Sections */}
            <nav className="flex-1 p-2">
              <div className="mb-1 px-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Sections
              </div>
              <ul className="flex flex-col gap-0.5">
                {SECTIONS.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => goToSection(s.key)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md px-3 text-left transition hover:bg-neutral-50"
                    >
                      <span className="flex items-center gap-2 text-[12px] font-black text-neutral-800">
                        <s.Icon size={13} className="text-neutral-500"/>
                        {s.label}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black text-neutral-600">
                        {s.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Add item CTA */}
            <div className="border-t p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <Link
                href="/tc/trade-center/plastering"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <Plus size={13}/>
                Add item
              </Link>
            </div>
          </aside>

          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close notebook"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}

function LocationEditor({
  initial,
  onSave,
  onCancel
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
        Your location
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Postcode or town"
        className="min-h-[40px] rounded-md border bg-white px-3 text-[12.5px]"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(value.trim() || initial)}
          className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
