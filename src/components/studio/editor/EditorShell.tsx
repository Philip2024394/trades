"use client";

// EditorShell — the admin editor.
//
// Layout:
//   Top strip:  brand mark · save · publish · viewport toggle
//   Center:     device-framed canvas — the current StudioLayoutJson,
//               drag to reorder, click to select, x to remove.
//   Right rail: category tabs (Containers · Heroes · Buttons · Sections).
//               Selecting a tab shows ONE category with a search field
//               and item list. Clicking an item appends to the canvas.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search, Box, Image as ImageIcon, MousePointer2, Grid3x3,
  Sparkles, Save, Trash2, Plus, GripVertical, X, Download,
  ZoomIn, ZoomOut, Smartphone, Star, Phone, MessageCircle,
  Shield, Award, MapPin, Check, ChevronRight, Camera, Mail,
  Wrench, Upload, Undo2, Redo2, Hash, FileText,
  Folder, FilePlus, ChevronDown, ExternalLink,
  Home, Briefcase, Users, Settings, Book, Calendar, Layers,
  ShoppingCart, Heart, Info, HelpCircle, Package, Truck, Coffee,
  Pencil, Menu, MoreHorizontal, LayoutGrid, CircleDot
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_AMBER } from "@/lib/brand/tokens";
import type { CatalogItem, EditorCategory } from "@/lib/studio/editor/catalog";

type CatalogPayload = {
  containers: CatalogItem[];
  heroes: CatalogItem[];
  buttons: CatalogItem[];
  sections: CatalogItem[];
};

/** Per-slot overrides for an instance on the canvas. Slots are named
 *  strings the block renderers read from context (e.g. "eyebrow",
 *  "headline", "primaryCtaLabel", "primaryCtaBg"). Value is the raw
 *  string. */
type BlockOverrides = Record<string, string>;

type CanvasItem = {
  instanceId: string;
  item: CatalogItem;
  overrides: BlockOverrides;
};

type OverridesCtxValue = {
  overrides: BlockOverrides;
  set: (slot: string, value: string) => void;
  isSelected: boolean;
};

const BlockOverridesContext = createContext<OverridesCtxValue>({
  overrides: {},
  set: () => undefined,
  isSelected: false
});

/** Shell exposes the pages + navigator so canvas blocks (e.g. the
 *  burger header) can render real page names + jump between them. */
type PagesCtxValue = {
  pages: Array<{ id: string; name: string; icon?: string }>;
  currentPageId: string;
  switchPage: (id: string) => void;
  addPage: () => void;
  renamePage: (id: string, name: string) => void;
  setPageIcon: (id: string, icon: string) => void;
  removePage: (id: string) => void;
};
const PagesContext = createContext<PagesCtxValue>({
  pages: [],
  currentPageId: "",
  switchPage: () => undefined,
  addPage: () => undefined,
  renamePage: () => undefined,
  setPageIcon: () => undefined,
  removePage: () => undefined
});

/** Read an override with a fallback. Text elements wrap this. */
function useSlot(name: string, fallback: string): {
  value: string;
  set: (v: string) => void;
  editable: boolean;
} {
  const ctx = useContext(BlockOverridesContext);
  return {
    value: ctx.overrides[name] ?? fallback,
    set: (v) => ctx.set(name, v),
    editable: ctx.isSelected
  };
}

const CATEGORY_TABS: Array<{
  id: EditorCategory;
  label: string;
  icon: typeof Box;
}> = [
  { id: "container", label: "Containers", icon: Grid3x3 },
  { id: "hero", label: "Heroes", icon: ImageIcon },
  { id: "button", label: "Buttons", icon: MousePointer2 },
  { id: "section", label: "Sections", icon: Box }
];

export function EditorShell({ brandId }: { brandId: string }): JSX.Element {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<EditorCategory>("container");
  const [query, setQuery] = useState("");
  const [canvas, setCanvas] = useState<CanvasItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(75);

  // ─── Undo/Redo history ────────────────────────────
  const [history, setHistory] = useState<CanvasItem[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [restoringHistory, setRestoringHistory] = useState(false);

  // Stable template number for the current session — displayed above
  // the phone. Persists in localStorage so the counter increments
  // across page reloads.
  const [templateNumber] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const key = "studio.editor.templateCounter";
    const prev = parseInt(window.localStorage?.getItem(key) ?? "0", 10);
    const next = (isNaN(prev) ? 0 : prev) + 1;
    try {
      window.localStorage?.setItem(key, String(next));
    } catch { /* silent */ }
    return next;
  });

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [templateDescription, setTemplateDescription] = useState("");
  const [popupState, setPopupState] = useState<{ title: string; body: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ─── Multi-page project state ─────────────────────
  type Page = { id: string; name: string; icon?: string };
  const [pages, setPages] = useState<Page[]>([
    { id: "landing", name: "Landing", icon: "home" }
  ]);
  const [currentPageId, setCurrentPageId] = useState<string>("landing");
  const [pageCanvases, setPageCanvases] = useState<Record<string, CanvasItem[]>>({
    landing: []
  });

  // Whenever the top-level `canvas` mutates, sync it to the current page's slot
  useEffect(() => {
    setPageCanvases((prev) => ({ ...prev, [currentPageId]: canvas }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  const switchPage = (nextId: string) => {
    if (nextId === currentPageId) return;
    setPageCanvases((prev) => ({ ...prev, [currentPageId]: canvas }));
    setCurrentPageId(nextId);
    setCanvas(pageCanvases[nextId] ?? []);
    setSelectedId(null);
  };

  const addPage = () => {
    const id = `page_${Math.random().toString(36).slice(2, 8)}`;
    const name = `Page ${pages.length + 1}`;
    setPages((prev) => [...prev, { id, name }]);
    setPageCanvases((prev) => ({ ...prev, [id]: [] }));
    switchPage(id);
  };

  const renamePage = (id: string, name: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const setPageIcon = (id: string, icon: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, icon } : p)));
  };

  const removePage = (id: string) => {
    if (pages.length <= 1) return;
    if (!window.confirm(`Delete "${pages.find((p) => p.id === id)?.name}"?`)) return;
    setPages((prev) => prev.filter((p) => p.id !== id));
    setPageCanvases((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    if (id === currentPageId) {
      const next = pages.find((p) => p.id !== id);
      if (next) switchPage(next.id);
    }
  };

  // ─── Projects dropdown ─────────────────────────────
  type Project = {
    id: string;
    number: number;
    name: string;
    description: string;
    savedAt: string;
    pages: Array<{ id: string; name: string; canvas: CanvasItem[] }>;
    landingPageId: string;
  };
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Hydrate saved projects from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("studio.editor.projects");
      if (raw) setProjects(JSON.parse(raw) as Project[]);
    } catch { /* silent */ }
  }, []);

  const persistProjects = (list: Project[]) => {
    setProjects(list);
    try {
      window.localStorage?.setItem("studio.editor.projects", JSON.stringify(list));
    } catch { /* silent */ }
  };

  const saveCurrentAsProject = () => {
    const now = new Date().toISOString();
    const projectId = `proj_${templateNumber}`;
    // Bake the current canvas back into pageCanvases so we snapshot everything.
    const snapshotPages = pages.map((p) => ({
      id: p.id,
      name: p.name,
      canvas: p.id === currentPageId ? canvas : (pageCanvases[p.id] ?? [])
    }));
    const project: Project = {
      id: projectId,
      number: templateNumber,
      name: templateName || `Template #${templateNumber}`,
      description: templateDescription,
      savedAt: now,
      pages: snapshotPages,
      landingPageId: pages[0]?.id ?? "landing"
    };
    // Dedup by id.
    const next = projects.filter((p) => p.id !== projectId).concat(project);
    persistProjects(next);
  };

  const loadProject = (project: Project) => {
    // Landing first, then whatever else is defined.
    const landingId = project.landingPageId ?? project.pages[0]?.id ?? "landing";
    const nextCanvasStore: Record<string, CanvasItem[]> = {};
    for (const p of project.pages) nextCanvasStore[p.id] = p.canvas;
    setPages(project.pages.map((p) => ({ id: p.id, name: p.name })));
    setPageCanvases(nextCanvasStore);
    setCurrentPageId(landingId);
    setCanvas(nextCanvasStore[landingId] ?? []);
    setSelectedId(null);
    setTemplateName(project.name);
    setTemplateDescription(project.description);
    setProjectsOpen(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch("/api/studio/editor/catalog")
      .then((r) => r.json())
      .then((json: { ok: boolean; catalog?: CatalogPayload }) => {
        if (json.ok && json.catalog) setCatalog(json.catalog);
      })
      .finally(() => setLoading(false));
  }, []);

  // Reset the search when the tab changes — each category has its
  // own mental model of what a "search" means.
  useEffect(() => {
    setQuery("");
  }, [tab]);

  // Listen for button-action fires from inside canvas blocks.
  useEffect(() => {
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type: string; target: string; popupTitle: string };
      if (detail.type === "navigate" && detail.target) {
        const pageExists = pages.some((p) => p.id === detail.target || p.name.toLowerCase() === detail.target.toLowerCase());
        if (pageExists) {
          const target = pages.find((p) => p.id === detail.target || p.name.toLowerCase() === detail.target.toLowerCase());
          if (target) switchPage(target.id);
        } else {
          setToastMessage(`Would navigate to "${detail.target}" — no matching page in this project.`);
          window.setTimeout(() => setToastMessage(null), 2500);
        }
      } else if (detail.type === "popup") {
        setPopupState({ title: detail.popupTitle || "Popup", body: detail.target || "Popup content" });
      } else if (detail.type === "external") {
        setToastMessage(`Would open ${detail.target || "(no URL)"}`);
        window.setTimeout(() => setToastMessage(null), 2500);
      } else if (detail.type === "call") {
        setToastMessage(`tel:${detail.target || "(no number)"}`);
        window.setTimeout(() => setToastMessage(null), 2500);
      } else if (detail.type === "whatsapp") {
        setToastMessage(`WhatsApp → ${detail.target || "(no number)"}`);
        window.setTimeout(() => setToastMessage(null), 2500);
      } else if (detail.type === "email") {
        setToastMessage(`mailto:${detail.target || "(no address)"}`);
        window.setTimeout(() => setToastMessage(null), 2500);
      }
    };
    window.addEventListener("studio-editor:button-action", onAction);
    return () => window.removeEventListener("studio-editor:button-action", onAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, currentPageId]);

  const items = useMemo(() => {
    if (!catalog) return [];
    const pool =
      tab === "container" ? catalog.containers
      : tab === "hero"    ? catalog.heroes
      : tab === "button"  ? catalog.buttons
      : catalog.sections;
    if (!query.trim()) return pool;
    const q = query.toLowerCase().trim();
    return pool.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.searchKeywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [catalog, tab, query]);

  // Push a snapshot to the history whenever canvas changes — except
  // when we're in the middle of restoring from a past snapshot.
  useEffect(() => {
    if (restoringHistory) {
      setRestoringHistory(false);
      return;
    }
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      // Only push if the snapshot is meaningfully different.
      const last = trimmed[trimmed.length - 1];
      const nextJson = JSON.stringify(canvas);
      if (last && JSON.stringify(last) === nextJson) return prev;
      const next = [...trimmed, canvas];
      // Cap history at 30 entries.
      if (next.length > 30) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setRestoringHistory(true);
    setHistoryIndex(newIndex);
    setCanvas(history[newIndex] ?? []);
    setSelectedId(null);
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setRestoringHistory(true);
    setHistoryIndex(newIndex);
    setCanvas(history[newIndex] ?? []);
    setSelectedId(null);
  };
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addToCanvas = (item: CatalogItem) => {
    const instanceId = `inst_${Math.random().toString(36).slice(2, 10)}`;
    setCanvas((prev) => [...prev, { instanceId, item, overrides: {} }]);
    setSelectedId(instanceId);
  };

  const setOverride = (instanceId: string, slot: string, value: string) => {
    setCanvas((prev) =>
      prev.map((c) =>
        c.instanceId === instanceId
          ? { ...c, overrides: { ...c.overrides, [slot]: value } }
          : c
      )
    );
  };

  const removeItem = (instanceId: string) => {
    setCanvas((prev) => prev.filter((c) => c.instanceId !== instanceId));
    if (selectedId === instanceId) setSelectedId(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCanvas((prev) => {
      const oldIdx = prev.findIndex((c) => c.instanceId === active.id);
      const newIdx = prev.findIndex((c) => c.instanceId === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const exportTemplate = () => {
    const payload = {
      brandId,
      name: templateName || `Template ${Date.now()}`,
      createdAt: new Date().toISOString(),
      items: canvas.map((c) => ({
        instanceId: c.instanceId,
        kind: c.item.category,
        key: c.item.payload.key,
        config: c.item.payload.config ?? {},
        name: c.item.name
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(templateName || "template").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-100 text-slate-900">
      {/* Top strip */}
      <header
        className="flex h-14 flex-shrink-0 items-center gap-3 px-4"
        style={{ backgroundColor: BRAND_BLACK, color: "white" }}
      >
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/Untitledxcxzxczxc-removebg-preview.png"
          alt="Thenetworkers — Editor"
          className="h-8 w-auto"
        />
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          Editor · Beta
        </span>

        {/* Projects dropdown */}
        <div className="relative ml-3">
          <button
            onClick={() => setProjectsOpen((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 text-[12px] font-semibold text-white hover:bg-white/20"
          >
            <Folder size={13} />
            Projects
            <span
              className="ml-1 rounded-full px-1.5 text-[10px] font-bold"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              {projects.length}
            </span>
            <ChevronDown size={12} className={projectsOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {projectsOpen && (
            <div className="absolute left-0 top-10 z-40 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[12px] font-bold text-slate-900">Saved projects</div>
                <div className="text-[10px] text-slate-500">Click any to load. Landing page opens first.</div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {projects.length === 0 && (
                  <div className="p-4 text-center text-[12px] text-slate-500">No projects yet — save a template to add one.</div>
                )}
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProject(p)}
                    className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md font-bold"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      #{p.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-slate-900">{p.name}</div>
                      <div className="truncate text-[10px] text-slate-500">
                        {p.pages.length} page{p.pages.length === 1 ? "" : "s"} · {new Date(p.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ExternalLink size={12} className="text-slate-400" />
                  </button>
                ))}
              </div>
              {projects.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
                  {projects.length} project{projects.length === 1 ? "" : "s"} saved locally
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-3 flex items-center gap-1 rounded-md bg-white/10 px-2 py-1">
          <Hash size={11} className="text-white/60" />
          <span className="text-[11px] font-bold text-white">#{templateNumber.toString().padStart(4, "0")}</span>
        </div>

        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Template name…"
          className="ml-2 h-8 w-52 rounded-md border border-white/20 bg-white/10 px-3 text-[13px] text-white placeholder:text-slate-400 focus:border-white/60 focus:outline-none"
        />

        {/* Undo / Redo — outside the phone, always visible */}
        <div className="ml-3 flex items-center gap-1 rounded-md border border-white/20 bg-white/5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex h-9 w-9 items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Undo"
            title="Undo last change (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex h-9 w-9 items-center justify-center border-l border-white/20 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-md border border-white/20 bg-white/5">
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="flex h-9 w-9 items-center justify-center text-white hover:bg-white/10"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <div className="min-w-[42px] text-center text-[12px] font-semibold text-white">
              {zoom}%
            </div>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="flex h-9 w-9 items-center justify-center text-white hover:bg-white/10"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            onClick={async () => {
              // Load Woodcraft mirror — if catalog isn't cached yet,
              // fetch it fresh so the button always works.
              let cat = catalog;
              if (!cat) {
                try {
                  const res = await fetch("/api/studio/editor/catalog");
                  const json = (await res.json()) as { ok: boolean; catalog?: CatalogPayload };
                  if (json.ok && json.catalog) {
                    cat = json.catalog;
                    setCatalog(json.catalog);
                  }
                } catch { /* silent */ }
              }
              if (!cat) return;

              // ─── Landing page — Woodcraft mirror ────────
              const landingIds = [
                "section.header-burger",
                "section.hero-text-left",
                "section.social-proof-avatars",
                "section.search-card-hero",
                "section.features-4-icons-circle",
                "section.services-4-image-row",
                "section.guarantee-banner",
                "section.bottom-nav-fab"
              ];
              const landingItems = landingIds
                .map((id) => cat!.sections.find((s) => s.id === id))
                .filter((x): x is CatalogItem => !!x);
              if (landingItems.length === 0) return;
              const landingOverrides: Record<string, BlockOverrides> = {
                "section.header-burger": {
                  brand: "Woodcraft Carpenter Services",
                  bg: "#FBF6EC",
                  brandTextColor: "#3B2413",
                  burgerBg: "#FFFFFF",
                  burgerIconColor: "#3B2413",
                  burgerShape: "round"
                },
                "section.hero-text-left": {
                  eyebrow: "Crafted with Precision, Built for Life.",
                  headline: "Expert Carpenter Services",
                  subhead: "From custom furniture to beautiful interiors — we bring your ideas to life.",
                  primaryLabel: "Book a Service",
                  primaryBg: "#3B2413",
                  primaryFg: "#FFFFFF",
                  eyebrowColor: "#8B4513",
                  headlineColor: "#3B2413",
                  subheadColor: "#8B4513",
                  bg: "#FBF6EC"
                },
                "section.guarantee-banner": {
                  heading: "Quality Work. Guaranteed.",
                  body: "We use the best tools & materials to deliver durable and beautiful results.",
                  bg: "#4A2C1A",
                  fg: "#FBF6EC",
                  accent: "#D4A056"
                },
                "section.features-4-icons-circle": {
                  f1Label: "Skilled & Verified Carpenters",
                  f2Label: "Quality Workmanship",
                  f3Label: "On-Time Service",
                  f4Label: "Affordable Pricing",
                  iconBg: "#FBF6EC",
                  iconColor: "#8B4513"
                },
                "section.bottom-nav-fab": {
                  tab1: "Home", tab2: "Bookings", tab4: "Messages", tab5: "Profile",
                  fabLabel: "Book Now", fabBg: "#8B4513"
                }
              };
              const landingCanvasBlocks = landingItems.map((it) => ({
                instanceId: `inst_${Math.random().toString(36).slice(2, 10)}`,
                item: it,
                overrides: landingOverrides[it.id] ?? {}
              }));

              // ─── Gallery page ────────────────────────────
              // No header block — the shell auto-mirrors the Landing
              // header on every non-landing page.
              const galleryIds = [
                "section.page-header-strip",
                "section.gallery-grid-priced",
                "section.guarantee-banner",
                "section.bottom-nav-fab"
              ];
              const galleryItems = galleryIds
                .map((id) => cat!.sections.find((s) => s.id === id))
                .filter((x): x is CatalogItem => !!x);
              const galleryOverrides: Record<string, BlockOverrides> = {
                "section.page-header-strip": {
                  eyebrow: "OUR WORK",
                  title: "Gallery",
                  subhead: "Recent projects with real costs — tap any tile to enquire on WhatsApp.",
                  bg: "#FBF6EC"
                },
                "section.gallery-grid-priced": {
                  bg: "#FBF6EC",
                  cardBg: "#FFFFFF",
                  titleColor: "#3B2413",
                  descColor: "#8B4513",
                  priceColor: "#8B4513"
                },
                "section.guarantee-banner": landingOverrides["section.guarantee-banner"] ?? {},
                "section.bottom-nav-fab": landingOverrides["section.bottom-nav-fab"] ?? {}
              };
              const galleryCanvasBlocks = galleryItems.map((it) => ({
                instanceId: `inst_${Math.random().toString(36).slice(2, 10)}`,
                item: it,
                overrides: galleryOverrides[it.id] ?? {}
              }));

              // ─── Contact page ────────────────────────────
              // No header block — auto-inherited from Landing.
              const contactIds = [
                "section.page-header-strip",
                "section.contact-details",
                "section.contact-form",
                "section.bottom-nav-fab"
              ];
              const contactItems = contactIds
                .map((id) => cat!.sections.find((s) => s.id === id))
                .filter((x): x is CatalogItem => !!x);
              const contactOverrides: Record<string, BlockOverrides> = {
                "section.page-header-strip": {
                  eyebrow: "SPEAK TO US",
                  title: "Contact Us",
                  subhead: "Send a message and we'll reply within 24h.",
                  bg: "#FBF6EC"
                },
                "section.contact-details": {
                  bg: "#FBF6EC",
                  bubbleBg: "#5B2E0A",
                  iconColor: "#FBF6EC",
                  textColor: "#3B2413",
                  phone: "0161 555 0000",
                  email: "hello@woodcraft.co.uk",
                  address: "42 Oakwood Lane, Manchester",
                  hours: "Mon–Sat · 8:00–18:00"
                },
                "section.contact-form": {
                  heading: "Get a Free Quote",
                  subhead: "We reply within 24h.",
                  submitLabel: "Send on WhatsApp",
                  bg: "#FBF6EC",
                  cardBg: "#FFFFFF",
                  labelColor: "#8B4513",
                  inputBg: "#FBF6EC",
                  submitBg: "#166534"
                },
                "section.bottom-nav-fab": landingOverrides["section.bottom-nav-fab"] ?? {}
              };
              const contactCanvasBlocks = contactItems.map((it) => ({
                instanceId: `inst_${Math.random().toString(36).slice(2, 10)}`,
                item: it,
                overrides: contactOverrides[it.id] ?? {}
              }));

              // ─── Multi-page seed ─────────────────────────
              const landingId = "landing";
              const galleryId = `page_gallery_${Math.random().toString(36).slice(2, 6)}`;
              const contactId = `page_contact_${Math.random().toString(36).slice(2, 6)}`;
              setPages([
                { id: landingId, name: "Landing", icon: "home" },
                { id: galleryId, name: "Gallery", icon: "layers" },
                { id: contactId, name: "Contact Us", icon: "mail" }
              ]);
              setPageCanvases({
                [landingId]: landingCanvasBlocks,
                [galleryId]: galleryCanvasBlocks,
                [contactId]: contactCanvasBlocks
              });
              setCurrentPageId(landingId);
              setCanvas(landingCanvasBlocks);
              setTemplateName("Woodcraft Carpenter Services");
            }}
            className="flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold shadow"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            title="Load the Woodcraft template mirror on the canvas"
          >
            <Sparkles size={14}/>
            Load Woodcraft
          </button>
          <button
            onClick={() => setSaveDialogOpen(true)}
            disabled={canvas.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold disabled:opacity-40"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            <Save size={14} />
            Save template
          </button>
          <button
            onClick={exportTemplate}
            disabled={canvas.length === 0}
            className="flex h-9 items-center justify-center rounded-md border border-white/30 bg-white/5 px-2 text-white hover:bg-white/10 disabled:opacity-30"
            title="Export JSON"
          >
            <Download size={14} />
          </button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: phone canvas — narrow column */}
        <aside className="flex w-[420px] flex-shrink-0 flex-col overflow-auto border-r border-slate-200 bg-slate-200 p-4">
          <div className="flex min-h-full flex-col items-center">
            {/* Pages tabs — landing first, then any added pages, then + to add */}
            <div className="mb-2 flex w-full items-center gap-1 overflow-x-auto">
              {pages.map((p, i) => {
                const isActive = p.id === currentPageId;
                const isLanding = i === 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => switchPage(p.id)}
                    className="group flex flex-shrink-0 items-center gap-1 rounded-t-md border-b-2 px-3 py-1.5 text-[11px] font-semibold"
                    style={
                      isActive
                        ? { backgroundColor: "white", color: BRAND_BLACK, borderColor: BRAND_YELLOW }
                        : { backgroundColor: "transparent", color: "#334155", borderColor: "transparent" }
                    }
                  >
                    {isLanding && <span className="rounded-sm bg-slate-900 px-1 py-0 text-[8px] font-bold text-white">L</span>}
                    <span>{p.name}</span>
                    {!isLanding && isActive && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removePage(p.id);
                        }}
                        className="ml-1 rounded-full p-0.5 hover:bg-red-100 hover:text-red-600"
                      >
                        <X size={10} />
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={addPage}
                className="flex flex-shrink-0 items-center gap-0.5 rounded-md border border-dashed border-slate-400 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white"
                title="Add a new page (About / Contact / etc.)"
              >
                <FilePlus size={11} />
                Add
              </button>
            </div>

            {/* Canvas toolbar */}
            <div className="mb-3 flex w-full items-center justify-between">
              <div>
                <div className="text-[13px] font-bold text-slate-900">
                  {templateName || "Untitled template"}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Smartphone size={11} />
                  <span>340×700</span>
                  <span>·</span>
                  <span>{canvas.length} block{canvas.length === 1 ? "" : "s"}</span>
                </div>
              </div>
              {canvas.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm("Clear the whole canvas?")) setCanvas([]);
                  }}
                  className="flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              )}
            </div>

            {/* Phone frame — scaled by zoom */}
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                marginBottom: `${Math.max(0, (100 - zoom) * 5)}px`
              }}
            >
              <div
                className="relative overflow-hidden rounded-[36px] border-[8px] border-slate-900 bg-white shadow-2xl"
                style={{ width: 340, minHeight: 700 }}
              >
                {/* Notch */}
                <div className="absolute left-1/2 top-0 z-10 flex h-6 w-32 -translate-x-1/2 items-center justify-center rounded-b-2xl bg-slate-900">
                  <div className="h-1.5 w-16 rounded-full bg-slate-700" />
                </div>

                {/* Scrollable canvas surface — cream when a warm-palette template is loaded.
                    If the first block is a header with `edgeToEdge=true`, we drop the top
                    padding so the header sits flush against the notch. */}
                {(() => { /* just to keep JSX terse */ return null; })()}
                <div
                  className="flex min-h-[680px] flex-col"
                  style={{
                    backgroundColor: templateName.toLowerCase().includes("woodcraft") ? "#FBF6EC" : "#FFFFFF",
                    paddingTop: (() => {
                      const first = canvas[0];
                      if (first && first.item.id.startsWith("section.header") && first.overrides?.edgeToEdge === "true") {
                        return 0;
                      }
                      return 32; // ~pt-8 default; clears the notch
                    })()
                  }}
                >
                  <PagesContext.Provider value={{ pages, currentPageId, switchPage, addPage, renamePage, setPageIcon, removePage }}>
                  {/* Global header — Landing page's header renders on every other page */}
                  {(() => {
                    const landingId = pages[0]?.id;
                    if (!landingId || currentPageId === landingId) return null;
                    const landingCanvas = pageCanvases[landingId] ?? [];
                    const headers = landingCanvas.filter((c) => c.item.id.startsWith("section.header"));
                    if (headers.length === 0) return null;
                    return (
                      <div className="relative border-b-2 border-dashed" style={{ borderColor: BRAND_YELLOW }}>
                        <div
                          className="absolute right-1 top-1 z-10 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                          title="This header lives on the Landing page — click to edit there"
                        >
                          From Landing
                        </div>
                        {headers.map((c) => (
                          <BlockOverridesContext.Provider
                            key={`from-landing-${c.instanceId}`}
                            value={{
                              overrides: c.overrides,
                              set: () => undefined,
                              isSelected: false
                            }}
                          >
                            <div onClick={() => switchPage(landingId)} className="cursor-pointer">
                              <RealBlockRender item={c.item}/>
                            </div>
                          </BlockOverridesContext.Provider>
                        ))}
                      </div>
                    );
                  })()}
                  {canvas.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                      <div
                        className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ backgroundColor: BRAND_BLACK }}
                      >
                        <Plus size={24} color={BRAND_YELLOW} />
                      </div>
                      <div className="text-[15px] font-bold text-slate-900">
                        Start adding blocks
                      </div>
                      <div className="mt-1 text-[12px] leading-relaxed text-slate-500">
                        Pick a category on the right — Containers, Heroes,
                        Buttons or Sections. Click any item to add it here.
                      </div>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={onDragEnd}
                    >
                      <SortableContext
                        items={canvas.map((c) => c.instanceId)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="flex flex-col">
                          {canvas.map((c) => (
                            <BlockOverridesContext.Provider
                              key={c.instanceId}
                              value={{
                                overrides: c.overrides,
                                set: (slot, v) => setOverride(c.instanceId, slot, v),
                                isSelected: selectedId === c.instanceId
                              }}
                            >
                              <CanvasBlock
                                block={c}
                                selected={selectedId === c.instanceId}
                                onSelect={() => setSelectedId(c.instanceId)}
                                onRemove={() => removeItem(c.instanceId)}
                              />
                            </BlockOverridesContext.Provider>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                  </PagesContext.Provider>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Properties panel — shows when a block is selected */}
        {selectedId && (() => {
          const selectedBlock = canvas.find((c) => c.instanceId === selectedId);
          if (!selectedBlock) return null;
          return (
            <PropertiesPanel
              block={selectedBlock}
              onOverride={(slot, value) => setOverride(selectedBlock.instanceId, slot, value)}
              onClose={() => setSelectedId(null)}
            />
          );
        })()}

        {/* Right: elements workspace — takes all remaining width */}
        <main className="flex flex-1 flex-col overflow-hidden bg-white">
          {/* Category tabs */}
          <div className="flex flex-shrink-0 gap-1 border-b border-slate-200 bg-slate-50 p-2">
            {CATEGORY_TABS.map((t) => {
              const isActive = tab === t.id;
              const Icon = t.icon;
              const count = catalog
                ? (t.id === "container" ? catalog.containers.length
                  : t.id === "hero"     ? catalog.heroes.length
                  : t.id === "button"   ? catalog.buttons.length
                  : catalog.sections.length)
                : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-[11px] font-semibold transition"
                  style={
                    isActive
                      ? { backgroundColor: BRAND_BLACK, color: "white" }
                      : { backgroundColor: "white", color: "#334155" }
                  }
                >
                  <Icon size={16} />
                  <span>{t.label}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: isActive ? BRAND_YELLOW : "#E2E8F0",
                      color: isActive ? BRAND_BLACK : "#64748B"
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search — per-category */}
          <div className="flex-shrink-0 border-b border-slate-200 bg-white p-2">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5">
              <Search size={13} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${CATEGORY_TABS.find((t) => t.id === tab)?.label.toLowerCase()}…`}
                className="w-full text-[13px] outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>{items.length} available</span>
              <span>Click to add →</span>
            </div>
          </div>

          {/* One-category-at-a-time list */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading && (
              <div className="p-4 text-center text-[12px] text-slate-500">Loading…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-4 text-center text-[12px] text-slate-500">
                No {tab}s match "{query}".
              </div>
            )}
            <div
              className={
                tab === "hero" || tab === "section" || tab === "container"
                  ? "grid grid-cols-3 gap-3 md:grid-cols-4 xl:grid-cols-5"
                  : "grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4"
              }
            >
              {items.map((it) => (
                <CatalogTile
                  key={it.id}
                  item={it}
                  onClick={() => addToCanvas(it)}
                  compact={tab === "button"}
                />
              ))}
            </div>
          </div>
        </main>
      </div>

      {saveDialogOpen && (
        <SaveTemplateDialog
          templateName={templateName}
          onName={setTemplateName}
          description={templateDescription}
          onDescription={setTemplateDescription}
          onClose={() => setSaveDialogOpen(false)}
          onSave={async () => {
            try {
              await fetch("/api/studio/templates/register", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  templateNumber,
                  name: templateName || `Template #${templateNumber}`,
                  description: templateDescription,
                  brandId,
                  canvas: canvas.map((c) => ({
                    instanceId: c.instanceId,
                    itemId: c.item.id,
                    itemName: c.item.name,
                    category: c.item.category,
                    overrides: c.overrides
                  })),
                  createdAt: new Date().toISOString()
                })
              }).catch(() => undefined);
            } catch { /* silent */ }
            // Also save as a local Project so it shows up in the Projects dropdown
            saveCurrentAsProject();
            setSaveDialogOpen(false);
            setAnalysisDialogOpen(true);
          }}
        />
      )}

      {/* Button-action popup */}
      {popupState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPopupState(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
              <Sparkles size={14} color={BRAND_YELLOW}/>
              <div className="text-[14px] font-bold">{popupState.title}</div>
              <button onClick={() => setPopupState(null)} className="ml-auto flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10">
                <X size={13}/>
              </button>
            </div>
            <div className="p-5 text-[13px] leading-relaxed text-slate-700">{popupState.body || "Popup content — set the button's target in the Properties panel."}</div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-2">
              <button onClick={() => setPopupState(null)} className="rounded-md px-3 py-1.5 text-[13px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast for external / call / whatsapp / email actions */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] font-semibold shadow-lg"
          style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}>
          {toastMessage}
        </div>
      )}

      {analysisDialogOpen && (
        <TemplateAnalysisDialog
          templateNumber={templateNumber}
          templateName={templateName || `Template #${templateNumber}`}
          description={templateDescription}
          canvas={canvas}
          onClose={() => setAnalysisDialogOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Save + Analysis dialogs ─────────────────────────────────

function SaveTemplateDialog({
  templateName, onName, description, onDescription, onClose, onSave
}: {
  templateName: string;
  onName: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
          <Save size={16} color={BRAND_YELLOW} />
          <div className="text-[15px] font-bold">Save template</div>
          <button onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Template name</label>
            <input type="text" value={templateName} onChange={(e) => onName(e.target.value)}
              placeholder="e.g. Woodcraft Carpenter · Warm Editorial"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-slate-900 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Design description</label>
            <textarea value={description} onChange={(e) => onDescription(e.target.value)}
              placeholder="What kind of business is this for? What's the mood? Any specific trades or scenarios?"
              rows={4}
              className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] leading-relaxed focus:border-slate-900 focus:outline-none" />
            <div className="mt-1 text-[11px] text-slate-500">
              The AI editor uses this to match the template to the right business briefs.
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button onClick={onClose}
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-900">Cancel</button>
          <button onClick={onSave}
            className="flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-bold"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
            <Sparkles size={14} />Save + analyse
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateAnalysisDialog({
  templateNumber, templateName, description, canvas, onClose
}: {
  templateNumber: number;
  templateName: string;
  description: string;
  canvas: CanvasItem[];
  onClose: () => void;
}): JSX.Element {
  const summary = useMemo(() => scanTemplate(canvas), [canvas]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
          <Sparkles size={16} color={BRAND_YELLOW} />
          <div className="text-[15px] font-bold">Template analysed</div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
            #{templateNumber.toString().padStart(4, "0")}
          </span>
          <button onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <div className="text-[18px] font-bold text-slate-900">{templateName}</div>
            {description && <div className="mt-1 text-[13px] leading-relaxed text-slate-600">{description}</div>}
          </div>
          <SummaryRow label="Sections" value={String(summary.totalBlocks)} />
          <SummaryRow label="Unique block types" value={String(summary.uniqueBlockKinds.size)} />
          <SummarySection title="By category">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.byCategory).map(([cat, n]) => (
                <span key={cat} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {cat} · <span style={{ color: BRAND_BLACK }}>{n}</span>
                </span>
              ))}
            </div>
          </SummarySection>
          <SummarySection title={`Colour palette (${summary.colours.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {summary.colours.map((c) => (
                <div key={c} className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1">
                  <span className="h-4 w-4 rounded-sm" style={{ backgroundColor: c }} />
                  <span className="font-mono text-[10px] text-slate-700">{c}</span>
                </div>
              ))}
              {summary.colours.length === 0 && (
                <span className="text-[11px] text-slate-500">No custom colours set — using system defaults.</span>
              )}
            </div>
          </SummarySection>
          {summary.buttons.length > 0 && (
            <SummarySection title={`Buttons (${summary.buttons.length})`}>
              <div className="flex flex-wrap gap-1">
                {summary.buttons.map((b) => (
                  <span key={b} className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{b}</span>
                ))}
              </div>
            </SummarySection>
          )}
          {summary.effects.length > 0 && (
            <SummarySection title={`Effects (${summary.effects.length})`}>
              <div className="flex flex-wrap gap-1">
                {summary.effects.map((e) => (
                  <span key={e} className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>{e}</span>
                ))}
              </div>
            </SummarySection>
          )}
          {summary.headings.length > 0 && (
            <SummarySection title="Key copy">
              <ul className="flex flex-col gap-1">
                {summary.headings.slice(0, 8).map((h, i) => (
                  <li key={i} className="rounded-md bg-slate-50 px-3 py-2 text-[12px] italic text-slate-700">"{h}"</li>
                ))}
              </ul>
            </SummarySection>
          )}
          {summary.imageSlots > 0 && <SummaryRow label="Image slots" value={String(summary.imageSlots)} />}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-900">Done</button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-[15px] font-bold text-slate-900">{value}</div>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function scanTemplate(canvas: CanvasItem[]): {
  totalBlocks: number;
  uniqueBlockKinds: Set<string>;
  byCategory: Record<string, number>;
  colours: string[];
  buttons: string[];
  effects: string[];
  headings: string[];
  imageSlots: number;
} {
  const uniqueBlockKinds = new Set<string>();
  const byCategory: Record<string, number> = {};
  const coloursSet = new Set<string>();
  const buttonsSet = new Set<string>();
  const effectsSet = new Set<string>();
  const headings: string[] = [];
  let imageSlots = 0;
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const EFFECT_KEYS = ["pulse", "glow", "ripple", "slide-fill", "underline-sweep", "gradient", "glass", "neumorph"];
  for (const c of canvas) {
    uniqueBlockKinds.add(c.item.id);
    byCategory[c.item.category] = (byCategory[c.item.category] ?? 0) + 1;
    if (c.item.category === "button") {
      buttonsSet.add(c.item.name);
      const eff = EFFECT_KEYS.find((k) => c.item.id.includes(k));
      if (eff) effectsSet.add(eff);
    }
    for (const [key, val] of Object.entries(c.overrides)) {
      if (typeof val !== "string") continue;
      if (HEX.test(val)) coloursSet.add(val.toUpperCase());
      if (key === "headline" || key === "heading") headings.push(val);
      if (key.toLowerCase().includes("image") && val.length > 0) imageSlots += 1;
    }
  }
  return { totalBlocks: canvas.length, uniqueBlockKinds, byCategory, colours: [...coloursSet], buttons: [...buttonsSet], effects: [...effectsSet], headings, imageSlots };
}

/** Returns where the floating grip+X toolbar should sit so it doesn't
 *  overlap important controls inside the block (the header burger, the
 *  bottom-nav FAB, etc.). Positioning is expressed as a Tailwind
 *  className string. */
function toolbarPositionFor(itemId: string): string {
  // Header variants have controls on the right — put toolbar on left
  if (itemId.startsWith("section.header")) return "left-1 top-1";
  // Bottom-nav / FAB blocks have the FAB centered on top — put toolbar
  // pinned to the top-left corner (above the tab row) where the space
  // is empty.
  if (itemId === "section.bottom-nav-fab") return "left-1 top-1";
  // Guarantee banner has the seal-circle on the right — put toolbar on
  // left so it doesn't sit on top of the seal.
  if (itemId === "section.guarantee-banner") return "left-1 top-1";
  // Default — top-right corner.
  return "right-1 top-1";
}

function CanvasBlock({
  block, selected, onSelect, onRemove
}: {
  block: CanvasItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.instanceId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  };

  const toolbarPos = toolbarPositionFor(block.item.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className="group relative"
    >
      {/* Selection outline */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{ boxShadow: `inset 0 0 0 3px ${BRAND_YELLOW}` }}
        />
      )}

      {/* Floating hover toolbar — position auto-adapts per block so it
          never sits on top of interactive controls (burger, FAB, seal). */}
      <div className={`pointer-events-none absolute ${toolbarPos} z-30 flex gap-0.5 opacity-0 transition group-hover:opacity-100`}>
        <button
          {...attributes}
          {...listeners}
          className="pointer-events-auto flex h-5 w-5 cursor-grab items-center justify-center rounded bg-white/90 shadow ring-1 ring-slate-200 backdrop-blur hover:bg-slate-50 active:cursor-grabbing"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={10} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="pointer-events-auto flex h-5 w-5 items-center justify-center rounded bg-white/90 text-slate-500 shadow ring-1 ring-slate-200 backdrop-blur hover:bg-red-50 hover:text-red-600"
          aria-label="Remove"
        >
          <X size={10} />
        </button>
      </div>

      {/* Real block content — no schematic strips, no wrapper chrome */}
      <RealBlockRender item={block.item} />
    </div>
  );
}

/** Full-fidelity mobile-scoped render per block category. Everything
 *  ships with trades-native copy so previews read as real, not filler. */
function RealBlockRender({ item }: { item: CatalogItem }): JSX.Element {
  if (item.category === "hero") return <HeroBlock item={item} />;
  if (item.category === "button") return <ButtonBlock item={item} />;
  if (item.category === "container") return <ContainerBlock item={item} />;
  return <SectionBlock item={item} />;
}

// ─── Hero ──────────────────────────────────────────────────
function HeroBlock({ item }: { item: CatalogItem }): JSX.Element {
  const bgImage = useSlot("bgImage", item.thumbnailUrl ?? "");
  const showEyebrow = useSlot("showEyebrow", "true");
  const eyebrow = useSlot("eyebrow", "Gas Safe · Manchester");
  const headline = useSlot("headline", "Emergency plumber — on your doorstep in 45 min.");
  const showSubhead = useSlot("showSubhead", "true");
  const subhead = useSlot("subhead", "No callout fee before 8pm. £5m public liability. Family-run since 2008.");
  const eyebrowColor = useSlot("eyebrowColor", BRAND_YELLOW);
  const showPrimary = useSlot("showPrimary", "true");
  const primaryLabel = useSlot("primaryLabel", "Call 0161 555 0000");
  const primaryBg = useSlot("primaryBg", BRAND_YELLOW);
  const primaryFg = useSlot("primaryFg", BRAND_BLACK);
  const showSecondary = useSlot("showSecondary", "true");
  const secondaryLabel = useSlot("secondaryLabel", "WhatsApp");
  const secondaryBg = useSlot("secondaryBg", "#25D366");
  const textAlign = useSlot("textAlign", "left");
  const textPosition = useSlot("textPosition", "bottom");
  const showMarquee = useSlot("showMarquee", "false");
  const marqueeText = useSlot("marqueeText", "FREE CALLOUT · GAS SAFE · £5M PL · TODAY ONLY");
  const marqueePosition = useSlot("marqueePosition", "top");
  const marqueeBg = useSlot("marqueeBg", BRAND_YELLOW);
  const marqueeFg = useSlot("marqueeFg", BRAND_BLACK);
  const showTrust = useSlot("showTrustBar", "false");
  const trust1Icon = useSlot("trust1Icon", "shield");
  const trust1Label = useSlot("trust1Label", "Gas Safe");
  const trust2Icon = useSlot("trust2Icon", "award");
  const trust2Label = useSlot("trust2Label", "£5m Insured");
  const trust3Icon = useSlot("trust3Icon", "star");
  const trust3Label = useSlot("trust3Label", "4.9 · 127 reviews");

  const alignItems =
    textAlign.value === "center" ? "items-center text-center"
    : textAlign.value === "right"  ? "items-end text-right"
    : "items-start text-left";
  const justifyContent =
    textPosition.value === "top" ? "justify-start"
    : textPosition.value === "middle" ? "justify-center"
    : "justify-end";

  return (
    <div
      className={`relative flex min-h-[280px] flex-col p-4 text-white ${justifyContent} ${alignItems}`}
      style={{
        backgroundImage: bgImage.value
          ? `linear-gradient(180deg, ${BRAND_BLACK}20 0%, ${BRAND_BLACK}CC 100%), url('${bgImage.value}')`
          : `linear-gradient(135deg, ${BRAND_BLACK} 0%, #1F2937 100%)`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      {/* Running text — absolute at top or bottom of the hero */}
      {showMarquee.value === "true" && (
        <div
          className="absolute inset-x-0 flex h-8 items-center overflow-hidden"
          style={{
            backgroundColor: marqueeBg.value,
            [marqueePosition.value === "top" ? "top" : "bottom"]: 0
          } as React.CSSProperties}
        >
          <div
            className="animate-[heroMarquee_12s_linear_infinite] whitespace-nowrap text-[11px] font-bold"
            style={{ color: marqueeFg.value }}
          >
            {marqueeText.value} · {marqueeText.value}
          </div>
          <style>{`@keyframes heroMarquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
        </div>
      )}
      {showEyebrow.value === "true" && (
        <EditableText
          value={eyebrow.value}
          onCommit={eyebrow.set}
          editable={eyebrow.editable}
          className="mb-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: eyebrowColor.value }}
        />
      )}
      <EditableText
        value={headline.value}
        onCommit={headline.set}
        editable={headline.editable}
        className="text-[22px] font-bold leading-tight"
      />
      {showSubhead.value === "true" && (
        <EditableText
          value={subhead.value}
          onCommit={subhead.set}
          editable={subhead.editable}
          className="mt-1 text-[12px] leading-relaxed text-slate-200"
        />
      )}
      {(showPrimary.value === "true" || showSecondary.value === "true") && (
        <div className="mt-3 flex gap-2">
          {showPrimary.value === "true" && (
            <button
              className="rounded-md px-3 py-1.5 text-[12px] font-bold"
              style={{ backgroundColor: primaryBg.value, color: primaryFg.value }}
              onClick={(e) => e.stopPropagation()}
            >
              <EditableText
                value={primaryLabel.value}
                onCommit={primaryLabel.set}
                editable={primaryLabel.editable}
                className="inline"
              />
            </button>
          )}
          {showSecondary.value === "true" && (
            <button
              className="rounded-md px-3 py-1.5 text-[12px] font-bold text-white"
              style={{ backgroundColor: secondaryBg.value }}
              onClick={(e) => e.stopPropagation()}
            >
              <EditableText
                value={secondaryLabel.value}
                onCommit={secondaryLabel.set}
                editable={secondaryLabel.editable}
                className="inline"
              />
            </button>
          )}
        </div>
      )}
      {showTrust.value === "true" && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: trust1Icon.value, label: trust1Label, set: trust1Label.set, editable: trust1Label.editable, value: trust1Label.value },
            { icon: trust2Icon.value, label: trust2Label, set: trust2Label.set, editable: trust2Label.editable, value: trust2Label.value },
            { icon: trust3Icon.value, label: trust3Label, set: trust3Label.set, editable: trust3Label.editable, value: trust3Label.value }
          ].map((b, i) => {
            const I = iconByName(b.icon);
            return (
              <div key={i} className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 backdrop-blur">
                <I size={11} color={BRAND_YELLOW}/>
                <EditableText
                  value={b.value}
                  onCommit={b.set}
                  editable={b.editable}
                  className="text-[10px] font-bold text-white"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function iconByName(name: string): typeof Phone {
  switch (name) {
    case "shield": return Shield;
    case "award": return Award;
    case "star": return Star;
    case "phone": return Phone;
    case "map": return MapPin;
    case "check": return Check;
    case "wrench": return Wrench;
    case "home": return Home;
    case "briefcase": return Briefcase;
    case "users": return Users;
    case "settings": return Settings;
    case "book": return Book;
    case "calendar": return Calendar;
    case "layers": return Layers;
    case "cart": return ShoppingCart;
    case "heart": return Heart;
    case "info": return Info;
    case "help": return HelpCircle;
    case "package": return Package;
    case "truck": return Truck;
    case "coffee": return Coffee;
    case "mail": return Mail;
    case "camera": return Camera;
    case "folder": return Folder;
    default: return Shield;
  }
}

const PAGE_ICON_CHOICES = [
  "home", "briefcase", "users", "settings", "book", "calendar",
  "layers", "cart", "heart", "info", "help", "package", "truck",
  "coffee", "mail", "camera", "folder", "phone", "star", "shield", "award", "wrench"
];

// ─── Hero variants — full-size canvas renders that match sidebar ────

function HeroTextLeftBlock({ item }: { item: CatalogItem }): JSX.Element {
  const bgImage = useSlot("bgImage", item.thumbnailUrl ?? "");
  const eyebrow = useSlot("eyebrow", "Gas Safe · Manchester");
  const headline = useSlot("headline", "Emergency plumber");
  const subhead = useSlot("subhead", "£5m public liability. Response in 45 min.");
  const eyebrowColor = useSlot("eyebrowColor", BRAND_YELLOW);
  const headlineColor = useSlot("headlineColor", BRAND_BLACK);
  const subheadColor = useSlot("subheadColor", "#334155");
  const primaryLabel = useSlot("primaryLabel", "Call Now");
  const primaryBg = useSlot("primaryBg", BRAND_YELLOW);
  const primaryFg = useSlot("primaryFg", BRAND_BLACK);
  const bg = useSlot("bg", "#FFFFFF");
  const imageHeight = useSlot("imageHeight", "220");
  const imageWidth = useSlot("imageWidth", "50%");

  // Column widths — text takes what's left over.
  const imgW = imageWidth.value;
  const textW = imgW === "100%" ? "0" : `calc(100% - ${imgW} - 12px)`;

  return (
    <div className="flex gap-3 p-4" style={{ backgroundColor: bg.value }}>
      {imgW !== "100%" && (
        <div className="flex flex-col justify-center" style={{ width: textW, minWidth: 0 }}>
          <EditableText value={eyebrow.value} onCommit={eyebrow.set} editable={eyebrow.editable}
            className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: eyebrowColor.value }} />
          <EditableText value={headline.value} onCommit={headline.set} editable={headline.editable}
            className="text-[20px] font-bold leading-tight" style={{ color: headlineColor.value }} />
          <EditableText value={subhead.value} onCommit={subhead.set} editable={subhead.editable}
            className="mt-1 text-[12px] leading-relaxed" style={{ color: subheadColor.value }} />
          <button className="mt-3 w-fit rounded-md px-3 py-1.5 text-[12px] font-bold"
            style={{ backgroundColor: primaryBg.value, color: primaryFg.value }}
            onClick={(e) => e.stopPropagation()}>
            <EditableText value={primaryLabel.value} onCommit={primaryLabel.set} editable={primaryLabel.editable} className="inline" />
          </button>
        </div>
      )}
      <ImageDropSlot
        value={bgImage.value}
        onCommit={bgImage.set}
        editable={bgImage.editable}
        width={imgW}
        height={`${imageHeight.value}px`}
      />
    </div>
  );
}

/** Click-to-upload image slot. The controls always overlay ONLY this
 *  image area — they don't require the parent hero block to be
 *  selected first, and they never affect other blocks. Every click
 *  inside the slot stops propagation so the parent block's selection
 *  state is never toggled by image interaction. */
function ImageDropSlot({
  value, onCommit, width, height
}: {
  value: string;
  onCommit: (v: string) => void;
  editable?: boolean;
  width: string;
  height: string;
}): JSX.Element {
  const [urlBoxOpen, setUrlBoxOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onCommit(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="group relative flex items-center justify-center overflow-hidden rounded-md"
      style={{
        width,
        height,
        flexShrink: 0,
        ...(value
          ? { backgroundImage: `url('${value}')`, backgroundSize: "cover", backgroundPosition: "center" }
          : { backgroundColor: "#EDD4B0" })
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Empty-state placeholder — click to upload */}
      {!value && !urlBoxOpen && (
        <div className="flex flex-col items-center gap-1.5 text-center">
          <label
            className="flex cursor-pointer flex-col items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Camera size={28} style={{ color: "#8B4513" }} />
            <div className="text-[10px] font-bold" style={{ color: "#8B4513" }}>Click to upload</div>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button
            onClick={(e) => { e.stopPropagation(); setUrlBoxOpen(true); }}
            className="text-[9px] font-bold underline"
            style={{ color: "#8B4513" }}
          >
            or paste URL
          </button>
        </div>
      )}

      {/* Small toolbar top-right — always visible on hover, no
          selection dependency */}
      {value && !urlBoxOpen && (
        <div
          className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <label
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full shadow-md"
            style={{ backgroundColor: BRAND_YELLOW }}
            title="Replace image"
          >
            <Upload size={12} style={{ color: BRAND_BLACK }}/>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button
            onClick={(e) => { e.stopPropagation(); setUrlBoxOpen(true); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md"
            title="Paste image URL"
          >
            <ExternalLink size={12} className="text-slate-700"/>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCommit(""); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md hover:bg-red-50"
            title="Remove image"
          >
            <X size={12} className="text-slate-700"/>
          </button>
        </div>
      )}

      {/* URL input popover — replaces the image temporarily while entering */}
      {urlBoxOpen && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3"
          style={{ backgroundColor: "#0A0A0AEE" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND_YELLOW }}>Paste image URL</div>
          <input
            autoFocus
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (urlDraft.trim()) onCommit(urlDraft.trim());
                setUrlBoxOpen(false);
                setUrlDraft("");
              }
              if (e.key === "Escape") {
                setUrlBoxOpen(false);
                setUrlDraft("");
              }
            }}
            placeholder="https://…"
            className="w-full rounded-md border border-white/40 bg-white/10 px-2 py-1.5 text-[11px] text-white placeholder:text-white/40 focus:outline-none"
          />
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (urlDraft.trim()) onCommit(urlDraft.trim());
                setUrlBoxOpen(false);
                setUrlDraft("");
              }}
              className="rounded-md px-3 py-1 text-[10px] font-bold"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              Apply
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setUrlBoxOpen(false); }}
              className="rounded-md border border-white/30 px-2 py-1 text-[10px] font-bold text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroCenteredBlock({ item }: { item: CatalogItem }): JSX.Element {
  const bgImage = useSlot("bgImage", item.thumbnailUrl ?? "");
  const eyebrow = useSlot("eyebrow", "Manchester");
  const headline = useSlot("headline", "Emergency plumber");
  const subhead = useSlot("subhead", "Available 24/7. Free callout before 8pm.");
  const eyebrowColor = useSlot("eyebrowColor", BRAND_YELLOW);
  const primaryLabel = useSlot("primaryLabel", "Book Now");
  const primaryBg = useSlot("primaryBg", BRAND_YELLOW);
  const primaryFg = useSlot("primaryFg", BRAND_BLACK);

  return (
    <div
      className="relative flex min-h-[280px] flex-col items-center justify-center p-4 text-center text-white"
      style={{
        backgroundImage: bgImage.value
          ? `linear-gradient(180deg, ${BRAND_BLACK}66 0%, ${BRAND_BLACK}CC 100%), url('${bgImage.value}')`
          : `linear-gradient(135deg, ${BRAND_BLACK} 0%, #1F2937 100%)`,
        backgroundSize: "cover", backgroundPosition: "center"
      }}
    >
      <EditableText value={eyebrow.value} onCommit={eyebrow.set} editable={eyebrow.editable}
        className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: eyebrowColor.value }} />
      <EditableText value={headline.value} onCommit={headline.set} editable={headline.editable}
        className="text-[24px] font-bold leading-tight" />
      <EditableText value={subhead.value} onCommit={subhead.set} editable={subhead.editable}
        className="mt-1 text-[12px] text-slate-200" />
      <button className="mt-3 rounded-md px-4 py-2 text-[13px] font-bold"
        style={{ backgroundColor: primaryBg.value, color: primaryFg.value }}
        onClick={(e) => e.stopPropagation()}>
        <EditableText value={primaryLabel.value} onCommit={primaryLabel.set} editable={primaryLabel.editable} className="inline" />
      </button>
    </div>
  );
}

function HeroBottomLeftBlock({ item }: { item: CatalogItem }): JSX.Element {
  const bgImage = useSlot("bgImage", item.thumbnailUrl ?? "");
  const eyebrow = useSlot("eyebrow", "Editorial");
  const headline = useSlot("headline", "Craft you can see.");
  const eyebrowColor = useSlot("eyebrowColor", BRAND_YELLOW);
  return (
    <div className="flex min-h-[240px] flex-col justify-end p-4"
      style={{
        backgroundImage: bgImage.value
          ? `linear-gradient(180deg, transparent 40%, ${BRAND_BLACK} 100%), url('${bgImage.value}')`
          : `linear-gradient(135deg, ${BRAND_BLACK} 0%, #4B5563 100%)`,
        backgroundSize: "cover", backgroundPosition: "center"
      }}
    >
      <EditableText value={eyebrow.value} onCommit={eyebrow.set} editable={eyebrow.editable}
        className="text-[10px] font-bold uppercase tracking-wider" style={{ color: eyebrowColor.value }} />
      <EditableText value={headline.value} onCommit={headline.set} editable={headline.editable}
        className="text-[24px] font-bold leading-tight text-white" />
    </div>
  );
}

function HeroFloatingBlock({ item }: { item: CatalogItem }): JSX.Element {
  const bgImage = useSlot("bgImage", item.thumbnailUrl ?? "");
  const eyebrow = useSlot("eyebrow", "Premium");
  const headline = useSlot("headline", "Bespoke kitchens");
  const eyebrowColor = useSlot("eyebrowColor", BRAND_YELLOW);
  return (
    <div className="relative flex min-h-[260px] items-center justify-center p-4"
      style={{
        backgroundImage: bgImage.value
          ? `url('${bgImage.value}')`
          : `linear-gradient(135deg, #94A3B8, #475569)`,
        backgroundSize: "cover", backgroundPosition: "center"
      }}
    >
      <div className="rounded-lg bg-white p-4 shadow-lg">
        <EditableText value={eyebrow.value} onCommit={eyebrow.set} editable={eyebrow.editable}
          className="text-[10px] font-bold uppercase tracking-wider" style={{ color: eyebrowColor.value }} />
        <EditableText value={headline.value} onCommit={headline.set} editable={headline.editable}
          className="mt-1 text-[20px] font-bold leading-tight text-slate-900" />
      </div>
    </div>
  );
}

function HeroVideoBlock({ item }: { item: CatalogItem }): JSX.Element {
  const eyebrow = useSlot("eyebrow", "▶ VIDEO");
  const headline = useSlot("headline", "Watch us on site");
  const eyebrowColor = useSlot("eyebrowColor", BRAND_YELLOW);
  return (
    <div className="relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden p-4"
      style={{ backgroundColor: BRAND_BLACK }}>
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-600 to-slate-900" />
      <div className="relative z-10 text-center">
        <EditableText value={eyebrow.value} onCommit={eyebrow.set} editable={eyebrow.editable}
          className="text-[10px] font-bold uppercase tracking-wider" style={{ color: eyebrowColor.value }} />
        <EditableText value={headline.value} onCommit={headline.set} editable={headline.editable}
          className="mt-1 text-[20px] font-bold leading-tight text-white" />
      </div>
    </div>
  );
}

// ─── Marquee / ticker / product-rail / header / gallery / CTA ─────

function MarqueeSingleBlock(): JSX.Element {
  return (
    <div className="flex h-12 items-center overflow-hidden" style={{ backgroundColor: BRAND_YELLOW }}>
      <div className="animate-[marquee_10s_linear_infinite] whitespace-nowrap text-[13px] font-bold" style={{ color: BRAND_BLACK }}>
        FREE CALLOUT · GAS SAFE · £5M PUBLIC LIABILITY · TODAY ONLY · FREE CALLOUT · GAS SAFE ·
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
    </div>
  );
}
function MarqueeLogosBlock(): JSX.Element {
  return (
    <div className="flex h-12 items-center overflow-hidden bg-slate-50">
      <div className="animate-[marquee_14s_linear_infinite] flex whitespace-nowrap gap-3 text-[11px] font-bold text-slate-600">
        {["GAS SAFE", "NICEIC", "CPCS", "TRUSTMARK", "FMB", "OFTEC", "GAS SAFE", "NICEIC", "CPCS"].map((l, i) => (
          <span key={i} className="rounded bg-white px-2 py-1">{l}</span>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
    </div>
  );
}
function TickerReviewsBlock(): JSX.Element {
  return (
    <div className="flex h-14 items-center overflow-hidden bg-white">
      <div className="animate-[marquee_18s_linear_infinite] flex whitespace-nowrap gap-4 text-[11px]">
        {["Turned up on time · Sarah T.", "Sorted the leak in 20 min · James P.", "Gas Safe cert on hand · Priya K.", "Booked online, on-time · Mark H."].map((r, i) => (
          <span key={i} className="flex items-center gap-1"><Star size={10} fill={BRAND_YELLOW} color={BRAND_YELLOW}/><span className="font-semibold text-slate-800">{r}</span></span>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

function ProductCategoryRailBlock(): JSX.Element {
  const heading = useSlot("heading", "Categories");
  const showHeading = useSlot("showHeading", "true");
  const layout = useSlot("layout", "bordered");
  const tileBg = useSlot("tileBg", "#F8FAFC");
  const tileFg = useSlot("tileFg", BRAND_BLACK);
  const iconColor = useSlot("iconColor", BRAND_AMBER);
  const cat1I = useSlot("cat1Icon", "wrench");
  const cat1L = useSlot("cat1Label", "Boilers");
  const cat2I = useSlot("cat2Icon", "shield");
  const cat2L = useSlot("cat2Label", "Safety");
  const cat3I = useSlot("cat3Icon", "award");
  const cat3L = useSlot("cat3Label", "Deals");
  const cat4I = useSlot("cat4Icon", "wrench");
  const cat4L = useSlot("cat4Label", "Tools");
  const showCat4 = useSlot("showCat4", "true");
  const cat5I = useSlot("cat5Icon", "star");
  const cat5L = useSlot("cat5Label", "Radiators");
  const showCat5 = useSlot("showCat5", "true");

  const cats = [
    { icon: cat1I.value, label: cat1L, show: true },
    { icon: cat2I.value, label: cat2L, show: true },
    { icon: cat3I.value, label: cat3L, show: true },
    { icon: cat4I.value, label: cat4L, show: showCat4.value === "true" },
    { icon: cat5I.value, label: cat5L, show: showCat5.value === "true" }
  ].filter((c) => c.show);

  const tileClasses =
    layout.value === "borderless" ? "flex flex-shrink-0 flex-col items-center gap-1 p-2 w-16" :
    layout.value === "image-only" ? "flex flex-shrink-0 flex-col items-center gap-0.5 p-1 w-14" :
    "flex flex-shrink-0 flex-col items-center gap-1 rounded-md border border-slate-200 p-2 w-16";

  return (
    <div className="bg-white p-3">
      {showHeading.value === "true" && (
        <EditableText
          value={heading.value}
          onCommit={heading.set}
          editable={heading.editable}
          className="mb-2 text-[13px] font-bold text-slate-900"
        />
      )}
      <div className="flex gap-2 overflow-x-auto">
        {cats.map((cat, i) => {
          const I = iconByName(cat.icon);
          return (
            <div
              key={i}
              className={tileClasses}
              style={{ backgroundColor: layout.value === "image-only" ? "transparent" : tileBg.value }}
            >
              <I size={layout.value === "image-only" ? 24 : 20} color={iconColor.value} />
              {layout.value !== "image-only" && (
                <EditableText
                  value={cat.label.value}
                  onCommit={cat.label.set}
                  editable={cat.label.editable}
                  className="text-[10px] font-bold"
                  style={{ color: tileFg.value }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ProductGridScrollBlock(): JSX.Element {
  const heading = useSlot("heading", "Featured");
  const p1R = useSlot("p1Ref", "F045");
  const p1P = useSlot("p1Price", "£4.85");
  const p2R = useSlot("p2Ref", "T1M100");
  const p2P = useSlot("p2Price", "£38");
  const p3R = useSlot("p3Ref", "PLB-A");
  const p3P = useSlot("p3Price", "£29");
  const p4R = useSlot("p4Ref", "BLY100");
  const p4P = useSlot("p4Price", "£0.68");
  const products = [
    { r: p1R, p: p1P },
    { r: p2R, p: p2P },
    { r: p3R, p: p3P },
    { r: p4R, p: p4P }
  ];
  return (
    <div className="bg-white p-3">
      <EditableText value={heading.value} onCommit={heading.set} editable={heading.editable}
        className="mb-2 text-[13px] font-bold text-slate-900" />
      <div className="flex gap-2 overflow-x-auto">
        {products.map((prod, i) => (
          <div key={i} className="flex-shrink-0 rounded-md border border-slate-200 w-24">
            <div className="flex h-16 items-center justify-center rounded-t bg-slate-100"><Camera size={16} className="text-slate-400"/></div>
            <div className="p-1.5">
              <div className="flex items-baseline gap-0.5 text-[10px] font-bold text-slate-900">
                <span>Ref</span>
                <EditableText value={prod.r.value} onCommit={prod.r.set} editable={prod.r.editable} className="inline" />
              </div>
              <EditableText value={prod.p.value} onCommit={prod.p.set} editable={prod.p.editable}
                className="text-[10px] text-slate-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeaderStickyBlock(): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
      <div className="h-6 w-6 rounded" style={{ backgroundColor: BRAND_BLACK }} />
      <div className="text-[13px] font-bold text-slate-900">Brand</div>
      <div className="ml-auto flex gap-3">
        {["Home", "Work", "About"].map((l) => (<span key={l} className="text-[11px] font-semibold text-slate-600">{l}</span>))}
      </div>
      <div className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Book</div>
    </div>
  );
}
function HeaderTransparentBlock(): JSX.Element {
  return (
    <div className="flex flex-col" style={{ background: `linear-gradient(180deg, ${BRAND_BLACK} 0%, #1F2937 100%)` }}>
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="h-6 w-6 rounded" style={{ backgroundColor: BRAND_YELLOW }} />
        <div className="text-[13px] font-bold text-white">Brand</div>
        <div className="ml-auto flex gap-3">
          {["Home", "About"].map((l) => (<span key={l} className="text-[11px] font-semibold text-white/70">{l}</span>))}
        </div>
      </div>
      <div className="flex items-center justify-center py-8">
        <div className="text-[11px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>Hero content</div>
      </div>
    </div>
  );
}
function HeaderFloatingBlock(): JSX.Element {
  return (
    <div className="bg-slate-100 p-3">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="h-5 w-5 rounded-full" style={{ backgroundColor: BRAND_BLACK }} />
        <div className="ml-2 flex gap-3">
          {["Home", "Work", "About"].map((l) => (<span key={l} className="text-[11px] font-semibold text-slate-600">{l}</span>))}
        </div>
        <div className="ml-auto rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Book</div>
      </div>
    </div>
  );
}

function HeaderLinksBlock(): JSX.Element {
  return (
    <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded" style={{ backgroundColor: BRAND_BLACK }} />
        <div className="text-[13px] font-bold text-slate-900">Manchester Plumbing</div>
      </div>
      <div className="ml-6 flex gap-5">
        {["Home", "Services", "About", "Contact"].map((l, i) => (
          <div key={l} className={`text-[12px] font-semibold ${i === 0 ? "text-slate-900" : "text-slate-600"}`}
            style={i === 0 ? { borderBottom: `2px solid ${BRAND_YELLOW}`, paddingBottom: "2px" } : {}}>{l}</div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1 text-[13px] font-bold text-slate-900">
        <Phone size={13} color={BRAND_AMBER}/>0161 555 0000
      </div>
    </div>
  );
}

function HeaderBurgerBlock(): JSX.Element {
  const brand = useSlot("brand", "Brand");
  const bg = useSlot("bg", "#FFFFFF");
  const borderColor = useSlot("borderColor", "#E2E8F0");
  const brandTextColor = useSlot("brandTextColor", "#0F172A");
  const burgerBg = useSlot("burgerBg", "#FFB300");
  const burgerIconColor = useSlot("burgerIconColor", "#0A0A0A");
  const logo = useSlot("logo", "");
  const logoSize = useSlot("logoSize", "md"); // sm|md|lg|xl
  const dropdownBg = useSlot("dropdownBg", "#F8FAFC");
  const activeItemBg = useSlot("activeItemBg", "#FFB300");
  const edgeToEdge = useSlot("edgeToEdge", "false");
  const topPad = useSlot("topPad", "notch"); // none|notch|generous|xl
  const burgerShape = useSlot("burgerShape", "rounded"); // square|rounded|round
  const burgerIconKind = useSlot("burgerIconKind", "bars"); // bars|menu|grid|dots|plus
  const [burgerEditorOpen, setBurgerEditorOpen] = useState(false);
  const [open, setOpen] = useState(true);
  const pagesCtx = useContext(PagesContext);
  // Real pages from the project — landing renders as "Home".
  const items = pagesCtx.pages.length > 0
    ? pagesCtx.pages.map((p, i) => ({
        id: p.id,
        label: i === 0 ? "Home" : p.name,
        isLanding: i === 0
      }))
    : ["Home", "Services", "About", "Contact"].map((l, i) => ({ id: `mock_${i}`, label: l, isLanding: i === 0 }));

  const logoSizePx: Record<string, number> = { sm: 20, md: 28, lg: 40, xl: 56 };
  const logoDim = logoSizePx[logo.editable ? logoSize.value : logoSize.value] ?? 28;

  const cycleLogoSize = (dir: 1 | -1) => {
    const order = ["sm", "md", "lg", "xl"];
    const idx = order.indexOf(logoSize.value);
    const next = order[Math.min(order.length - 1, Math.max(0, idx + dir))];
    logoSize.set(next);
  };

  const topPadPx: Record<string, number> = { none: 0, notch: 28, generous: 44, xl: 64 };
  const extraTop = edgeToEdge.value === "true" ? (topPadPx[topPad.value] ?? 28) : 0;

  return (
    <div className="flex flex-col" style={{ backgroundColor: bg.value, paddingTop: extraTop }}>
      <div className="flex items-center px-4 py-3" style={{ borderBottom: `1px solid ${borderColor.value}` }}>
        <div className="flex items-center gap-2">
          {/* Brand logo — click to upload / paste URL / remove */}
          <div className="relative flex items-center">
            <ImageDropSlot
              value={logo.value}
              onCommit={logo.set}
              width={`${logoDim}px`}
              height={`${logoDim}px`}
            />
            {/* Size +/- controls — only when the block is selected */}
            {logo.editable && (
              <div className="absolute -bottom-6 left-0 flex items-center gap-0.5 rounded-md bg-white px-1 py-0.5 shadow"
                onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); cycleLogoSize(-1); }}
                  disabled={logoSize.value === "sm"}
                  className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold disabled:opacity-30"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >−</button>
                <div className="min-w-[16px] text-center text-[9px] font-bold uppercase text-slate-600">{logoSize.value}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); cycleLogoSize(1); }}
                  disabled={logoSize.value === "xl"}
                  className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold disabled:opacity-30"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >+</button>
              </div>
            )}
          </div>
          <EditableText value={brand.value} onCommit={brand.set} editable={brand.editable}
            className="text-[13px] font-bold"
            style={{ color: brandTextColor.value }}/>
        </div>
        {/* Toggle button — always visible on the right. Shape and icon
            style come from slots. Editable via a small pencil-chip
            attached to the button when the block is selected. */}
        <div className="relative ml-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="flex h-8 w-8 items-center justify-center border transition"
            style={{
              backgroundColor: open ? burgerBg.value : "transparent",
              borderColor: open ? burgerBg.value : borderColor.value,
              borderRadius: burgerShape.value === "round" ? "9999px" : burgerShape.value === "rounded" ? "6px" : "0px"
            }}
            aria-label={open ? "Close menu" : "Open menu"}
            title={open ? "Close menu" : "Open menu"}
          >
            {open ? (
              <X size={14} style={{ color: burgerIconColor.value }} />
            ) : burgerIconKind.value === "menu" ? (
              <Menu size={16} style={{ color: burgerIconColor.value }}/>
            ) : burgerIconKind.value === "grid" ? (
              <LayoutGrid size={14} style={{ color: burgerIconColor.value }}/>
            ) : burgerIconKind.value === "dots" ? (
              <MoreHorizontal size={16} style={{ color: burgerIconColor.value }}/>
            ) : burgerIconKind.value === "plus" ? (
              <Plus size={16} style={{ color: burgerIconColor.value }}/>
            ) : (
              <div className="flex flex-col gap-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-0.5 w-4 rounded-full" style={{ backgroundColor: burgerIconColor.value }}/>
                ))}
              </div>
            )}
          </button>
          {/* Edit chip — only visible when the block is selected */}
          {brand.editable && (
            <button
              onClick={(e) => { e.stopPropagation(); setBurgerEditorOpen((v) => !v); }}
              className="absolute -left-2 -top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full shadow"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              title="Change burger shape / icon / colours"
            >
              <Pencil size={8} strokeWidth={3}/>
            </button>
          )}
          {/* Burger editor popover */}
          {burgerEditorOpen && brand.editable && (
            <div
              className="absolute right-0 top-full z-40 mt-1 w-[220px] rounded-md border border-slate-200 bg-white p-2 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Shape */}
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Shape</div>
              <div className="mt-1 flex gap-1">
                {[
                  { id: "square", label: "Square" },
                  { id: "rounded", label: "Rounded" },
                  { id: "round", label: "Round" }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={(e) => { e.stopPropagation(); burgerShape.set(s.id); }}
                    className="flex-1 border py-1 text-[10px] font-bold transition"
                    style={{
                      borderColor: s.id === burgerShape.value ? BRAND_YELLOW : "#E2E8F0",
                      backgroundColor: s.id === burgerShape.value ? BRAND_YELLOW : "transparent",
                      color: s.id === burgerShape.value ? BRAND_BLACK : "#334155",
                      borderRadius: s.id === "round" ? "9999px" : s.id === "rounded" ? "6px" : "0px"
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Icon design */}
              <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Icon</div>
              <div className="mt-1 grid grid-cols-5 gap-1">
                {[
                  { id: "bars", I: (props: { size: number; color: string }) => (
                      <div className="flex flex-col gap-0.5">
                        {[1, 2, 3].map((i) => <div key={i} className="h-0.5 w-3 rounded-full" style={{ backgroundColor: props.color }}/>)}
                      </div>
                    ) },
                  { id: "menu", I: Menu },
                  { id: "grid", I: LayoutGrid },
                  { id: "dots", I: MoreHorizontal },
                  { id: "plus", I: Plus }
                ].map((opt) => {
                  const isCur = opt.id === burgerIconKind.value;
                  const Icon = opt.I as React.ElementType;
                  return (
                    <button
                      key={opt.id}
                      onClick={(e) => { e.stopPropagation(); burgerIconKind.set(opt.id); }}
                      className="flex h-7 items-center justify-center rounded border transition"
                      style={{
                        borderColor: isCur ? BRAND_YELLOW : "#E2E8F0",
                        backgroundColor: isCur ? "#FFF7E6" : "transparent"
                      }}
                    >
                      <Icon size={14} color={burgerIconColor.value}/>
                    </button>
                  );
                })}
              </div>

              {/* Button background colour */}
              <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Button bg</div>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {["#FFB300", "#0A0A0A", "#FFFFFF", "#166534", "#8B4513", "#DC2626", "#0EA5E9", "#FBF6EC", "transparent"].map((c) => (
                  <button
                    key={c}
                    onClick={(e) => { e.stopPropagation(); burgerBg.set(c); }}
                    className="h-5 w-5 rounded border border-slate-300"
                    style={{ backgroundColor: c, boxShadow: c === burgerBg.value ? `0 0 0 2px ${BRAND_YELLOW}` : undefined }}
                  />
                ))}
              </div>

              {/* Icon colour */}
              <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Icon colour</div>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {["#0A0A0A", "#FFFFFF", "#FFB300", "#166534", "#8B4513", "#DC2626", "#0EA5E9"].map((c) => (
                  <button
                    key={c}
                    onClick={(e) => { e.stopPropagation(); burgerIconColor.set(c); }}
                    className="h-5 w-5 rounded border border-slate-300"
                    style={{ backgroundColor: c, boxShadow: c === burgerIconColor.value ? `0 0 0 2px ${BRAND_YELLOW}` : undefined }}
                  />
                ))}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setBurgerEditorOpen(false); }}
                className="mt-2 w-full rounded py-1 text-[10px] font-bold"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
      {open && (
        <div style={{ backgroundColor: dropdownBg.value, borderBottom: `1px solid ${borderColor.value}` }}>
          {items.map((it) => {
            const isActive = it.id === pagesCtx.currentPageId;
            const isReal = pagesCtx.pages.some((p) => p.id === it.id);
            const realPage = pagesCtx.pages.find((p) => p.id === it.id);
            return (
              <PageDropdownRow
                key={it.id}
                pageId={it.id}
                label={it.label}
                icon={realPage?.icon}
                isLanding={it.isLanding}
                isActive={isActive}
                isReal={isReal}
                activeBg={activeItemBg.value}
                onNavigate={() => {
                  if (isReal) {
                    pagesCtx.switchPage(it.id);
                    setOpen(false);
                  }
                }}
                onRename={(name) => isReal && pagesCtx.renamePage(it.id, name)}
                onSetIcon={(icon) => isReal && pagesCtx.setPageIcon(it.id, icon)}
                onRemove={() => isReal && pagesCtx.removePage(it.id)}
              />
            );
          })}
          {/* + Add new page — creates a new page and switches into it */}
          {pagesCtx.pages.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                pagesCtx.addPage();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-slate-100"
              style={{ borderTop: `1px dashed ${borderColor.value}` }}
              title="Create a new blank page and start designing it"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                <Plus size={12} strokeWidth={3}/>
              </span>
              <span className="text-[12px] font-bold" style={{ color: BRAND_BLACK }}>New page</span>
              <span className="ml-auto text-[10px] font-semibold text-slate-500">design + save</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** One row inside the burger dropdown. Landing/other real pages can:
 *  – navigate on click, – rename inline (pencil), – pick an icon from a
 *  small popover (icon), – delete (non-landing only). Mock rows just
 *  render the label. */
function PageDropdownRow({
  pageId, label, icon, isLanding, isActive, isReal, activeBg,
  onNavigate, onRename, onSetIcon, onRemove
}: {
  pageId: string;
  label: string;
  icon?: string;
  isLanding: boolean;
  isActive: boolean;
  isReal: boolean;
  activeBg: string;
  onNavigate: () => void;
  onRename: (name: string) => void;
  onSetIcon: (icon: string) => void;
  onRemove: () => void;
}): JSX.Element {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(label);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => { setDraft(label); }, [label]);
  const IconCmp = icon ? iconByName(icon) : null;

  const commitRename = () => {
    const v = draft.trim();
    if (v) onRename(v);
    setRenaming(false);
  };

  return (
    <div
      className="group relative flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left last:border-b-0"
      style={isActive ? { backgroundColor: activeBg } : {}}
    >
      {/* Landing badge */}
      {isLanding && (
        <span className="rounded-sm bg-slate-900 px-1 text-[8px] font-bold text-white">L</span>
      )}

      {/* Icon slot — click to change (real pages only) */}
      {isReal ? (
        <button
          onClick={(e) => { e.stopPropagation(); setPickerOpen((v) => !v); }}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:border-yellow-400"
          title="Change page icon"
        >
          {IconCmp ? <IconCmp size={12} className="text-slate-700"/> : <Plus size={11} className="text-slate-400"/>}
        </button>
      ) : IconCmp ? (
        <IconCmp size={13} className="text-slate-500"/>
      ) : null}

      {/* Label — click pencil to rename */}
      {renaming ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setDraft(label); setRenaming(false); }
          }}
          className="min-w-0 flex-1 rounded border border-yellow-400 bg-white px-1.5 py-0.5 text-[13px] font-semibold text-slate-900 focus:outline-none"
        />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-slate-900"
        >
          {label}
        </button>
      )}

      {/* Trailing controls */}
      {isReal && !renaming && (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
            className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 hover:bg-slate-200"
            title="Rename page"
          >
            <Pencil size={10} className="text-slate-600"/>
          </button>
          {!isLanding && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 hover:bg-red-100"
              title="Delete page"
            >
              <X size={11} className="text-red-600"/>
            </button>
          )}
          <ChevronRight size={14} className="text-slate-400"/>
        </div>
      )}

      {/* Icon-picker popover */}
      {pickerOpen && (
        <div
          className="absolute left-4 top-full z-30 mt-1 grid w-[220px] grid-cols-6 gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {PAGE_ICON_CHOICES.map((n) => {
            const I = iconByName(n);
            const isCurrent = n === icon;
            return (
              <button
                key={n}
                onClick={(e) => { e.stopPropagation(); onSetIcon(n); setPickerOpen(false); }}
                className="flex h-7 w-7 items-center justify-center rounded transition hover:bg-yellow-100"
                style={isCurrent ? { backgroundColor: BRAND_YELLOW } : {}}
                title={n}
              >
                <I size={13} className="text-slate-700"/>
              </button>
            );
          })}
          {icon && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetIcon(""); setPickerOpen(false); }}
              className="col-span-6 rounded border border-slate-200 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Remove icon
            </button>
          )}
        </div>
      )}

      {/* Reference to prevent unused pageId warning */}
      <span hidden>{pageId}</span>
    </div>
  );
}

function HeaderCartBlock(): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded" style={{ backgroundColor: BRAND_BLACK }} />
        <div className="text-[13px] font-bold text-slate-900">Shop</div>
      </div>
      <div className="ml-4 flex gap-3">
        {["Products", "Deals", "Trade"].map((l) => (
          <div key={l} className="text-[12px] font-semibold text-slate-600">{l}</div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
          <Search size={16} className="text-slate-700"/>
        </button>
        <button className="relative flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-900">
          <Box size={14}/>
          Cart
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#DC2626" }}>3</span>
        </button>
      </div>
    </div>
  );
}

function HeaderSignInBlock(): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded" style={{ backgroundColor: BRAND_BLACK }} />
        <div className="text-[13px] font-bold text-slate-900">Thenetworkers</div>
      </div>
      <div className="ml-6 flex gap-4">
        {["Home", "Explore", "Pricing"].map((l) => (
          <div key={l} className="text-[12px] font-semibold text-slate-600">{l}</div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="text-[12px] font-semibold text-slate-700 hover:underline">Sign in</button>
        <button className="rounded-md px-3 py-1.5 text-[12px] font-bold" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
          Get started
        </button>
      </div>
    </div>
  );
}

function HeaderSearchBlock(): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="h-7 w-7 rounded" style={{ backgroundColor: BRAND_BLACK }} />
      <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5">
        <Search size={13} className="text-slate-400"/>
        <div className="text-[12px] text-slate-500">Search products, trades, or services…</div>
      </div>
      <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
        <Mail size={16} className="text-slate-700"/>
      </button>
      <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
        <Box size={16} className="text-slate-700"/>
      </button>
    </div>
  );
}

function GalleryBeforeAfterBlock(): JSX.Element {
  return (
    <div className="relative min-h-[200px] overflow-hidden bg-white">
      <div className="absolute inset-0 flex">
        <div className="flex flex-1 items-center justify-center bg-slate-300"><div className="text-[13px] font-bold text-white">BEFORE</div></div>
        <div className="flex flex-1 items-center justify-center bg-slate-700"><div className="text-[13px] font-bold text-white">AFTER</div></div>
      </div>
      <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-0.5" style={{ backgroundColor: BRAND_YELLOW }}/>
      <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg" style={{ backgroundColor: BRAND_YELLOW }}>
        <ChevronRight size={12} color={BRAND_BLACK}/>
      </div>
    </div>
  );
}

function FooterAppStoreBlock(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4" style={{ backgroundColor: BRAND_BLACK }}>
      <div className="text-[13px] font-bold text-white">Get the app</div>
      <div className="flex gap-2">
        {["App Store", "Play Store"].map((s) => (
          <div key={s} className="rounded border border-white/30 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white">{s}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Search ────────────────────────────────────────────────
function SearchGlobalBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-2 flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3">
        <Search size={14} className="text-slate-400"/>
        <div className="text-[13px] text-slate-400">Search anything…</div>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {["Boiler swap", "Emergency leak", "Solar quote", "Bathroom fit"].map((t) => (
          <span key={t} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{t}</span>
        ))}
      </div>
    </div>
  );
}
function SearchLocationBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2">
        <MapPin size={14} color={BRAND_AMBER}/>
        <div className="text-[13px] font-medium text-slate-500">M1 4EN, Manchester</div>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2">
        <Wrench size={14} color={BRAND_AMBER}/>
        <div className="text-[13px] font-medium text-slate-500">Plumber</div>
      </div>
      <button className="w-full rounded-md py-2 text-[13px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Find near me</button>
    </div>
  );
}
function SearchAutocompleteBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="flex h-10 items-center gap-2 rounded-md border-2 bg-white px-3" style={{ borderColor: BRAND_BLACK }}>
        <Search size={14}/>
        <div className="text-[13px] font-semibold text-slate-900">plum</div>
        <div className="ml-0.5 h-4 w-0.5 animate-pulse bg-slate-900"/>
      </div>
      <div className="mt-1 rounded-md border border-slate-200 bg-white shadow-sm">
        {["plumber", "plumbing", "plumbers near me", "plumbing supplies"].map((s) => (
          <div key={s} className="border-b border-slate-100 px-3 py-2 text-[13px] text-slate-700 last:border-b-0 hover:bg-slate-50">{s}</div>
        ))}
      </div>
    </div>
  );
}
function SearchAIBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-2 flex items-center gap-2 rounded-md p-3" style={{ background: `linear-gradient(90deg, ${BRAND_YELLOW}44, ${BRAND_YELLOW}11)` }}>
        <Sparkles size={16} color={BRAND_AMBER}/>
        <div className="text-[13px] font-semibold text-slate-900">Ask anything…</div>
      </div>
      <div className="rounded-md bg-slate-100 p-3 text-[12px] italic text-slate-600">"My boiler is making a banging noise — who fixes this near me?"</div>
    </div>
  );
}

// ─── Booking ───────────────────────────────────────────────
function BookingCalendarBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-2 text-[13px] font-bold text-slate-900">March 2026</div>
      <div className="grid grid-cols-7 gap-1">
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} className="py-1 text-center text-[9px] font-bold uppercase text-slate-500">{d}</div>
        ))}
        {Array.from({ length: 28 }).map((_, i) => {
          const available = [3, 5, 8, 12, 15, 17, 20, 22, 25].includes(i);
          const active = i === 12;
          return (
            <div key={i} className="flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold"
              style={{
                backgroundColor: active ? BRAND_BLACK : available ? "#FFFCF0" : "white",
                color: active ? BRAND_YELLOW : available ? BRAND_BLACK : "#94A3B8",
                border: available ? `1px solid ${BRAND_YELLOW}` : "1px solid transparent"
              }}>
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function BookingSlotsBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-3 text-[13px] font-bold text-slate-900">Available slots · Wed 12 Mar</div>
      {[
        { period: "Morning", slots: ["9:00", "10:30", "11:00"] },
        { period: "Afternoon", slots: ["1:00", "2:30", "3:30", "4:00"] },
        { period: "Evening", slots: ["6:00", "7:30"] }
      ].map((r) => (
        <div key={r.period} className="mb-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{r.period}</div>
          <div className="flex flex-wrap gap-1.5">
            {r.slots.map((s, i) => (
              <div key={s} className="rounded-md border px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  backgroundColor: i === 1 && r.period === "Morning" ? BRAND_YELLOW : "white",
                  borderColor: i === 1 && r.period === "Morning" ? BRAND_YELLOW : "#CBD5E1",
                  color: i === 1 && r.period === "Morning" ? BRAND_BLACK : "#334155"
                }}>{s}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function BookingQuoteBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-3 flex items-center gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i <= 2 ? BRAND_BLACK : "#E2E8F0" }}/>
        ))}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 2 of 4</div>
      <div className="text-[15px] font-bold text-slate-900">What kind of job?</div>
      <div className="mt-3 flex flex-col gap-1.5">
        {["Boiler swap", "Emergency callout", "Bathroom fit", "Solar install"].map((s, i) => (
          <div key={s} className="flex items-center justify-between rounded-md border p-2.5"
            style={{ borderColor: i === 0 ? BRAND_BLACK : "#E2E8F0", backgroundColor: i === 0 ? "#F8FAFC" : "white" }}>
            <div className="text-[13px] font-semibold text-slate-900">{s}</div>
            {i === 0 && <Check size={14} color={BRAND_BLACK}/>}
          </div>
        ))}
      </div>
      <button className="mt-3 w-full rounded-md py-2 text-[13px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Continue</button>
    </div>
  );
}

// ─── Ecommerce ─────────────────────────────────────────────
function EcomVariantsBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-2 text-[13px] font-bold text-slate-900">Choose size</div>
      <div className="mb-3 flex gap-1.5">
        {["S", "M", "L", "XL"].map((s, i) => (
          <div key={s} className="flex h-9 w-11 items-center justify-center rounded-md border-2 text-[13px] font-bold"
            style={{ borderColor: i === 1 ? BRAND_BLACK : "#E2E8F0", backgroundColor: i === 1 ? BRAND_BLACK : "white", color: i === 1 ? "white" : "#334155" }}>{s}</div>
        ))}
      </div>
      <div className="mb-2 text-[13px] font-bold text-slate-900">Colour</div>
      <div className="flex gap-1.5">
        {[BRAND_BLACK, BRAND_YELLOW, "#3B82F6", "#DC2626", "#10B981"].map((c, i) => (
          <div key={c} className="h-9 w-9 rounded-full" style={{ backgroundColor: c, boxShadow: i === 1 ? `0 0 0 2px white, 0 0 0 4px ${BRAND_BLACK}` : "none" }}/>
        ))}
      </div>
    </div>
  );
}
function EcomAddCartBlock(): JSX.Element {
  return (
    <div className="flex flex-col bg-white p-4">
      <div className="flex-1 mb-3 flex h-24 items-center justify-center rounded-md bg-slate-100">
        <Camera size={28} className="text-slate-400"/>
      </div>
      <div className="flex items-center gap-3 rounded-md p-3" style={{ backgroundColor: BRAND_BLACK }}>
        <div>
          <div className="text-[10px] font-bold uppercase text-white/60">Total</div>
          <div className="text-[16px] font-bold text-white">£42.50</div>
        </div>
        <button className="ml-auto rounded-md px-4 py-2 text-[13px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Add to cart</button>
      </div>
    </div>
  );
}
function EcomRelatedBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-3 text-[13px] font-bold text-slate-900">You may also like</div>
      <div className="grid grid-cols-3 gap-2">
        {[15, 24, 32].map((price) => (
          <div key={price} className="overflow-hidden rounded-md border border-slate-200">
            <div className="flex h-16 items-center justify-center bg-slate-100"><Camera size={16} className="text-slate-400"/></div>
            <div className="p-2">
              <div className="text-[10px] text-slate-500">Ref F{price}0</div>
              <div className="text-[12px] font-bold text-slate-900">£{price}.85</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Restaurant ────────────────────────────────────────────
function FoodMenuBlock(): JSX.Element {
  const heading = useSlot("heading", "Wood-fired favourites");
  const m1N = useSlot("m1Name", "Margherita");
  const m1D = useSlot("m1Desc", "San Marzano · basil");
  const m1P = useSlot("m1Price", "£11");
  const m1V = useSlot("m1Vegan", "true");
  const m2N = useSlot("m2Name", "Salmon Poke");
  const m2D = useSlot("m2Desc", "sushi rice · avocado");
  const m2P = useSlot("m2Price", "£13");
  const m2V = useSlot("m2Vegan", "false");
  const m3N = useSlot("m3Name", "Vegan Burger");
  const m3D = useSlot("m3Desc", "beetroot patty · vegan mayo");
  const m3P = useSlot("m3Price", "£10");
  const m3V = useSlot("m3Vegan", "true");

  const items = [
    { n: m1N, d: m1D, p: m1P, v: m1V.value === "true" },
    { n: m2N, d: m2D, p: m2P, v: m2V.value === "true" },
    { n: m3N, d: m3D, p: m3P, v: m3V.value === "true" }
  ];

  return (
    <div className="bg-white p-4">
      <EditableText value={heading.value} onCommit={heading.set} editable={heading.editable}
        className="mb-2 text-[13px] font-bold text-slate-900" />
      {items.map((m, i) => (
        <div key={i} className="mb-2 flex items-center gap-3 rounded-md border border-slate-200 p-2">
          <div className="flex h-14 w-14 items-center justify-center rounded bg-slate-100"><Camera size={16} className="text-slate-400"/></div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <EditableText value={m.n.value} onCommit={m.n.set} editable={m.n.editable}
                className="text-[13px] font-bold text-slate-900" />
              {m.v && <div className="rounded px-1 text-[8px] font-bold text-white" style={{ backgroundColor: "#10B981" }}>VEGAN</div>}
            </div>
            <EditableText value={m.d.value} onCommit={m.d.set} editable={m.d.editable}
              className="text-[11px] text-slate-500" />
          </div>
          <EditableText value={m.p.value} onCommit={m.p.set} editable={m.p.editable}
            className="text-[14px] font-bold text-slate-900" />
        </div>
      ))}
    </div>
  );
}
function FoodCombosBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="rounded-lg border-2 p-4" style={{ borderColor: BRAND_YELLOW, backgroundColor: "#FFFCF0" }}>
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BRAND_AMBER }}>Combo · Save £5</div>
        <div className="mt-1 text-[18px] font-bold text-slate-900">Any 2 for £18</div>
        <div className="mt-1 text-[12px] text-slate-700">Any 2 pizzas + garlic bread + soft drinks</div>
        <button className="mt-2 rounded-md px-3 py-1.5 text-[12px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Add combo</button>
      </div>
    </div>
  );
}

// ─── Ride-hailing ──────────────────────────────────────────
function RidePickupBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-1 flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500"/>
        <div className="text-[13px] font-medium text-slate-900">Manchester · M1 4EN</div>
      </div>
      <div className="mb-3 ml-2 h-3 w-px bg-slate-300"/>
      <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2">
        <div className="h-2.5 w-2.5 rounded-sm bg-red-500"/>
        <div className="text-[13px] font-medium text-slate-900">Salford · M4 3AA</div>
      </div>
      <div className="flex h-24 items-center justify-center rounded-md bg-slate-100">
        <MapPin size={24} className="text-slate-400"/>
      </div>
    </div>
  );
}
function RideDriverBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="relative mb-3 flex h-32 items-center justify-center overflow-hidden rounded-md bg-slate-100">
        {[
          { top: "20%", left: "30%" },
          { top: "60%", left: "60%" },
          { top: "40%", left: "20%" }
        ].map((pos, i) => (
          <div key={i} className="absolute h-3 w-3 rounded-full ring-2 ring-white" style={{ ...pos, backgroundColor: BRAND_BLACK }}/>
        ))}
        <div className="absolute bottom-2 right-2 rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>3 nearby</div>
      </div>
      <div className="flex items-center gap-3 rounded-md p-3" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700"><Camera size={14} className="text-white/60"/></div>
        <div>
          <div className="text-[13px] font-bold text-white">Driver 2 min away</div>
          <div className="text-[11px] text-white/60">John · Toyota Prius · Yellow</div>
        </div>
      </div>
    </div>
  );
}

// ─── Auth ──────────────────────────────────────────────────
function AuthLoginBlock(): JSX.Element {
  return (
    <div className="bg-white p-6">
      <div className="mb-4 text-[18px] font-bold text-slate-900">Welcome back</div>
      <input placeholder="Email" className="mb-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-[13px]"/>
      <input placeholder="Password" type="password" className="mb-3 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-[13px]"/>
      <button className="mb-3 w-full rounded-md py-2 text-[13px] font-bold" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>Sign in</button>
      <div className="mb-2 text-center text-[11px] text-slate-500">or continue with</div>
      <div className="flex justify-center gap-2">
        {["G", "", "f"].map((s, i) => (
          <div key={i} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-[13px] font-bold">{s}</div>
        ))}
      </div>
    </div>
  );
}
function AuthOTPBlock(): JSX.Element {
  return (
    <div className="bg-white p-6">
      <div className="mb-1 text-center text-[16px] font-bold text-slate-900">Enter code</div>
      <div className="mb-4 text-center text-[11px] text-slate-500">Sent to 07•••234</div>
      <div className="mb-3 flex justify-center gap-1.5">
        {[8, 4, 2, "", "", ""].map((n, i) => (
          <div key={i} className="flex h-10 w-8 items-center justify-center rounded-md border-2 text-[16px] font-bold"
            style={{ borderColor: i < 3 ? BRAND_BLACK : "#E2E8F0", color: BRAND_BLACK }}>{n}</div>
        ))}
      </div>
      <div className="text-center text-[11px] text-slate-500">Resend in <span className="font-bold">27s</span></div>
    </div>
  );
}

// ─── Chat ──────────────────────────────────────────────────
function ChatBlock({ ai }: { ai: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 bg-slate-50 p-4">
      <div className="max-w-[80%] rounded-lg rounded-bl-none bg-white p-2.5 text-[12px] text-slate-900 shadow-sm">
        {ai ? "Hi — how can I help?" : "Hi, are you still available today?"}
      </div>
      <div className="ml-auto max-w-[80%] rounded-lg rounded-br-none p-2.5 text-[12px]" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
        {ai ? "Book me a plumber for Wed morning" : "Yes — 3pm slot is free"}
      </div>
      <div className="max-w-[80%] rounded-lg rounded-bl-none bg-white p-2.5 text-[12px] text-slate-900 shadow-sm">
        {ai ? "Found 3 near you. Want me to book the closest?" : "Great, I'll take it!"}
      </div>
      {ai && (
        <div className="ml-1 text-[10px] text-slate-500 flex items-center gap-1"><Sparkles size={10} color={BRAND_AMBER}/>AI · typing…</div>
      )}
    </div>
  );
}

// ─── Empty states ──────────────────────────────────────────
function EmptyStateBlock({ kind }: { kind: "orders" | "messages" | "error" }): JSX.Element {
  if (kind === "error") {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 bg-white p-8">
        <div className="text-[48px] font-bold text-slate-300">404</div>
        <div className="text-[15px] font-bold text-slate-900">Page not found</div>
        <div className="max-w-xs text-center text-[12px] text-slate-500">The page you're looking for doesn't exist or was moved.</div>
        <button className="mt-2 rounded-md px-4 py-2 text-[13px] font-bold" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>Go home</button>
      </div>
    );
  }
  const config = kind === "orders"
    ? { icon: Box, title: "No orders yet", body: "When you place your first order it'll show up here.", cta: "Browse products" }
    : { icon: MessageCircle, title: "No messages", body: "Reach out to a merchant and their reply lands here.", cta: "Start a chat" };
  const I = config.icon;
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 bg-white p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <I size={26} className="text-slate-400"/>
      </div>
      <div className="text-[15px] font-bold text-slate-900">{config.title}</div>
      <div className="max-w-xs text-center text-[12px] text-slate-500">{config.body}</div>
      <button className="mt-2 rounded-md px-4 py-2 text-[13px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>{config.cta}</button>
    </div>
  );
}

// ─── Woodcraft-template sections ────────────────────────────

/** Circular avatar slot. Click to upload (or paste URL). Face-position
 *  picker (top / center / bottom / top-left / etc.) so a portrait
 *  taken off-centre still shows the face. Non-square images are
 *  cover-cropped to a perfect circle. */
function AvatarSlot({
  value, onCommit,
  position, onPositionChange,
  fallbackColor, size = 32
}: {
  value: string;
  onCommit: (v: string) => void;
  position: string;
  onPositionChange: (v: string) => void;
  fallbackColor: string;
  size?: number;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [urlBoxOpen, setUrlBoxOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [posOpen, setPosOpen] = useState(false);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onCommit(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const POSITIONS = [
    { id: "left top", label: "TL" },
    { id: "center top", label: "T" },
    { id: "right top", label: "TR" },
    { id: "left center", label: "L" },
    { id: "center center", label: "C" },
    { id: "right center", label: "R" },
    { id: "left bottom", label: "BL" },
    { id: "center bottom", label: "B" },
    { id: "right bottom", label: "BR" }
  ];

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="group flex items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-sm"
        style={{
          width: `${size}px`, height: `${size}px`,
          backgroundColor: value ? "transparent" : fallbackColor,
          backgroundImage: value ? `url('${value}')` : undefined,
          backgroundSize: "cover",
          backgroundPosition: position
        }}
        title="Click to edit avatar"
      >
        {!value && <Camera size={size / 3} className="text-white/70"/>}
      </button>

      {/* Edit menu */}
      {open && !urlBoxOpen && !posOpen && (
        <div className="absolute left-1/2 top-full z-40 mt-1 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-1 shadow-xl">
          <label className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-yellow-50">
            <Upload size={11}/>
            Upload
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0]); setOpen(false); }}/>
          </label>
          <button
            onClick={(e) => { e.stopPropagation(); setUrlBoxOpen(true); }}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-yellow-50"
          >
            <ExternalLink size={11}/>
            Paste URL
          </button>
          {value && (
            <button
              onClick={(e) => { e.stopPropagation(); setPosOpen(true); }}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-yellow-50"
            >
              <Grid3x3 size={11}/>
              Face position
            </button>
          )}
          {value && (
            <button
              onClick={(e) => { e.stopPropagation(); onCommit(""); setOpen(false); }}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
            >
              <X size={11}/>
              Remove
            </button>
          )}
        </div>
      )}

      {/* URL input */}
      {urlBoxOpen && (
        <div className="absolute left-1/2 top-full z-40 mt-1 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 shadow-xl">
          <input
            autoFocus
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                if (urlDraft.trim()) onCommit(urlDraft.trim());
                setUrlBoxOpen(false); setUrlDraft(""); setOpen(false);
              }
              if (e.key === "Escape") { setUrlBoxOpen(false); setUrlDraft(""); }
            }}
            placeholder="https://…"
            className="w-[180px] rounded border border-slate-300 px-1.5 py-1 text-[10px] focus:outline-none focus:border-yellow-400"
          />
        </div>
      )}

      {/* Face-position 3×3 picker */}
      {posOpen && (
        <div className="absolute left-1/2 top-full z-40 mt-1 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-slate-500">Face position</div>
          <div className="grid grid-cols-3 gap-0.5">
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                onClick={(e) => { e.stopPropagation(); onPositionChange(p.id); setPosOpen(false); setOpen(false); }}
                className="flex h-6 w-6 items-center justify-center rounded text-[8px] font-bold transition hover:bg-yellow-100"
                style={p.id === position ? { backgroundColor: BRAND_YELLOW, color: BRAND_BLACK } : { color: "#64748B" }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SocialProofAvatarsBlock(): JSX.Element {
  const count = useSlot("count", "500+");
  const label = useSlot("label", "Happy Customers");
  const bg = useSlot("bg", "#FBF6EC");
  const a1 = useSlot("avatar1", "");
  const a2 = useSlot("avatar2", "");
  const a3 = useSlot("avatar3", "");
  const p1 = useSlot("avatar1Pos", "center center");
  const p2 = useSlot("avatar2Pos", "center center");
  const p3 = useSlot("avatar3Pos", "center center");
  const avatarSize = useSlot("avatarSize", "32");
  const size = parseInt(avatarSize.value || "32", 10);

  const avatars = [
    { slot: a1, pos: p1, fallback: "#A0785A" },
    { slot: a2, pos: p2, fallback: "#8B4513" },
    { slot: a3, pos: p3, fallback: "#6B3410" }
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: bg.value }}>
      <div className="flex -space-x-2">
        {avatars.map((av, i) => (
          <AvatarSlot
            key={i}
            value={av.slot.value}
            onCommit={av.slot.set}
            position={av.pos.value}
            onPositionChange={av.pos.set}
            fallbackColor={av.fallback}
            size={size}
          />
        ))}
      </div>
      <div>
        <EditableText value={count.value} onCommit={count.set} editable={count.editable}
          className="text-[15px] font-bold" style={{ color: "#3B2413" }} />
        <EditableText value={label.value} onCommit={label.set} editable={label.editable}
          className="text-[11px]" style={{ color: "#8B4513" }} />
      </div>
    </div>
  );
}

const ACTION_CHOICES: Array<{ id: string; label: string; icon: typeof Phone }> = [
  { id: "none", label: "No action", icon: X },
  { id: "services-drawer", label: "Services drawer", icon: Layers },
  { id: "location-page", label: "Location page", icon: MapPin },
  { id: "business-card", label: "Business card", icon: Briefcase },
  { id: "popup", label: "Popup", icon: Info },
  { id: "call", label: "Call", icon: Phone },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "navigate", label: "Navigate to page", icon: ChevronRight }
];

/** Yellow chip that reads the current action. Clicking it opens a
 *  small in-canvas menu so the user can reassign the action without
 *  hunting through the Properties panel. */
function ActionBadge({
  value, onChange, editable
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (!editable) return null;
  const current = ACTION_CHOICES.find((c) => c.id === value) ?? ACTION_CHOICES[0];
  return (
    <div className="relative mt-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex w-full items-center gap-1 truncate rounded-sm px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider transition hover:brightness-90"
        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        title="Click to change tap action"
      >
        <span>⟶</span>
        <span className="truncate">{current.label}</span>
        <ChevronDown size={9} className="ml-auto shrink-0"/>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-0.5 w-[150px] rounded-md border border-slate-200 bg-white shadow-xl">
          {ACTION_CHOICES.map((c) => {
            const I = c.icon;
            const isCur = c.id === value;
            return (
              <button
                key={c.id}
                onClick={(e) => { e.stopPropagation(); onChange(c.id); setOpen(false); }}
                className="flex w-full items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-700 transition hover:bg-yellow-50 last:border-b-0"
                style={isCur ? { backgroundColor: BRAND_YELLOW, color: BRAND_BLACK } : {}}
              >
                <I size={11}/>
                {c.label}
                {isCur && <Check size={10} className="ml-auto"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Small X button that removes an inner container from the search
 *  card. Only shown when the parent block is selected. */
function InlineDeleteBtn({ onClick, title }: { onClick: () => void; title: string }): JSX.Element {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100"
      style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
      title={title}
    >
      <X size={9} strokeWidth={3}/>
    </button>
  );
}

function SearchCardHeroBlock(): JSX.Element {
  const heading = useSlot("heading", "How can we help you today?");
  const locLabel = useSlot("locLabel", "Your Location");
  const locValue = useSlot("locValue", "New Delhi, India");
  const svcLabel = useSlot("svcLabel", "Select Service");
  const svcValue = useSlot("svcValue", "Carpentry Work");
  const btnLabel = useSlot("btnLabel", "Search");
  const btnBg = useSlot("btnBg", "#8B4513");
  const bg = useSlot("bg", "#FBF6EC");
  const cardBg = useSlot("cardBg", "#FFFFFF");
  const sectionPadding = useSlot("sectionPadding", "md");
  const cardPadding = useSlot("cardPadding", "md");
  const containerHeight = useSlot("containerHeight", "md");
  const locAction = useSlot("locAction", "location-page");
  const svcAction = useSlot("svcAction", "services-drawer");
  const btnAction = useSlot("btnAction", "navigate");
  const showLoc = useSlot("showLoc", "true");
  const showSvc = useSlot("showSvc", "true");
  const showBtn = useSlot("showBtn", "true");

  const secPad: Record<string, string> = { sm: "p-2", md: "p-3", lg: "p-4", xl: "p-6" };
  const cardPad: Record<string, string> = { sm: "p-2", md: "p-3", lg: "p-4", xl: "p-5" };
  const innerPad: Record<string, string> = { sm: "p-1", md: "p-2", lg: "p-3" };
  const innerGap: Record<string, string> = { sm: "gap-0", md: "gap-0.5", lg: "gap-1" };
  const headingMb: Record<string, string> = { sm: "mb-1", md: "mb-2", lg: "mb-3", xl: "mb-4" };

  // Grid template auto-adapts to the visible containers.
  const cols: string[] = [];
  if (showLoc.value === "true") cols.push("1fr");
  if (showSvc.value === "true") cols.push("1fr");
  if (showBtn.value === "true") cols.push("auto");
  const gridTemplate = cols.join(" ") || "1fr";
  const editable = heading.editable;

  return (
    <div className={secPad[sectionPadding.value] ?? "p-3"} style={{ backgroundColor: bg.value }}>
      <div className={`rounded-lg shadow-lg ${cardPad[cardPadding.value] ?? "p-3"}`} style={{ backgroundColor: cardBg.value }}>
        <EditableText value={heading.value} onCommit={heading.set} editable={heading.editable}
          className={`${headingMb[cardPadding.value] ?? "mb-2"} text-[13px] font-bold text-slate-900`} />
        <div className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
          {showLoc.value === "true" && (
            <div className={`group relative rounded-md border border-slate-200 ${innerPad[containerHeight.value] ?? "p-2"} ${editable ? "hover:border-yellow-400" : ""}`}>
              {editable && <InlineDeleteBtn onClick={() => showLoc.set("false")} title="Remove location container"/>}
              <div className={`flex items-center ${innerGap[containerHeight.value] ?? "gap-1"}`}>
                <MapPin size={11} color="#8B4513"/>
                <EditableText value={locLabel.value} onCommit={locLabel.set} editable={locLabel.editable}
                  className="text-[8px] font-semibold uppercase tracking-wide text-slate-500" />
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <EditableText value={locValue.value} onCommit={locValue.set} editable={locValue.editable}
                  className="text-[11px] font-bold text-slate-900" />
                <ChevronRight size={10} className="rotate-90 text-slate-500"/>
              </div>
              <ActionBadge value={locAction.value} onChange={locAction.set} editable={locAction.editable}/>
            </div>
          )}
          {showSvc.value === "true" && (
            <div className={`group relative rounded-md border border-slate-200 ${innerPad[containerHeight.value] ?? "p-2"} ${editable ? "hover:border-yellow-400" : ""}`}>
              {editable && <InlineDeleteBtn onClick={() => showSvc.set("false")} title="Remove service container"/>}
              <div className={`flex items-center ${innerGap[containerHeight.value] ?? "gap-1"}`}>
                <Grid3x3 size={11} color="#8B4513"/>
                <EditableText value={svcLabel.value} onCommit={svcLabel.set} editable={svcLabel.editable}
                  className="text-[8px] font-semibold uppercase tracking-wide text-slate-500" />
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <EditableText value={svcValue.value} onCommit={svcValue.set} editable={svcValue.editable}
                  className="text-[11px] font-bold text-slate-900" />
                <ChevronRight size={10} className="rotate-90 text-slate-500"/>
              </div>
              <ActionBadge value={svcAction.value} onChange={svcAction.set} editable={svcAction.editable}/>
            </div>
          )}
          {showBtn.value === "true" && (
            <div className={`group relative flex ${editable ? "hover:brightness-95" : ""}`}>
              {editable && <InlineDeleteBtn onClick={() => showBtn.set("false")} title="Remove search button"/>}
              <button className="flex items-center gap-1 rounded-md px-3 text-[12px] font-bold text-white"
                style={{ backgroundColor: btnBg.value }} onClick={(e) => e.stopPropagation()}>
                <Search size={12}/>
                <EditableText value={btnLabel.value} onCommit={btnLabel.set} editable={btnLabel.editable} className="inline" />
              </button>
              <div className="absolute -bottom-6 left-0">
                <ActionBadge value={btnAction.value} onChange={btnAction.set} editable={btnAction.editable}/>
              </div>
            </div>
          )}
        </div>

        {/* Restore panel — only shows in editor when any container is hidden */}
        {editable && (showLoc.value !== "true" || showSvc.value !== "true" || showBtn.value !== "true") && (
          <div className="mt-2 flex flex-wrap gap-1 rounded-md border border-dashed border-slate-300 p-1.5">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Restore:</span>
            {showLoc.value !== "true" && (
              <button onClick={(e) => { e.stopPropagation(); showLoc.set("true"); }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                <Plus size={9}/> Location
              </button>
            )}
            {showSvc.value !== "true" && (
              <button onClick={(e) => { e.stopPropagation(); showSvc.set("true"); }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                <Plus size={9}/> Service
              </button>
            )}
            {showBtn.value !== "true" && (
              <button onClick={(e) => { e.stopPropagation(); showBtn.set("true"); }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                <Plus size={9}/> Search button
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CHOCOLATE = "#5B2E0A";
const DARK_GREEN = "#166534";

/** Modal that opens when a Popular-Service card is tapped. Chocolate
 *  rim, chocolate close-X on the image, dark-green Enquire-on-WhatsApp
 *  button. If the block has no WhatsApp number, the button falls back
 *  to "Close window". */
function ServiceCardModal({
  open, onClose, title, description, image, whatsappNumber, prefill
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  image: string;
  whatsappNumber: string;
  prefill: string;
}): JSX.Element | null {
  if (!open) return null;
  const hasWa = whatsappNumber.trim().length > 0;
  const waText = prefill.replaceAll("{service}", title);
  const waHref = hasWa
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waText)}`
    : "#";

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center px-3"
      style={{ backgroundColor: "#00000080" }}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="relative w-full max-w-[280px] overflow-hidden rounded-lg bg-white"
        style={{ border: `2px solid ${CHOCOLATE}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image area */}
        <div
          className="relative flex h-32 items-center justify-center"
          style={{
            backgroundColor: image ? "transparent" : "#EDD4B0",
            backgroundImage: image ? `url('${image}')` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          {!image && <Camera size={28} style={{ color: CHOCOLATE }}/>}
          {/* Chocolate close X on the image */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-md"
            style={{ backgroundColor: CHOCOLATE, color: "#FFFFFF" }}
            title="Close"
          >
            <X size={14} strokeWidth={3}/>
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="text-[13px] font-bold leading-tight" style={{ color: CHOCOLATE }}>{title}</div>
          <div className="mt-1 text-[10px] leading-snug text-slate-600">{description || "No description yet."}</div>

          {/* Dark green WhatsApp / Close CTA */}
          <a
            href={waHref}
            target={hasWa ? "_blank" : undefined}
            rel={hasWa ? "noreferrer noopener" : undefined}
            onClick={(e) => {
              if (!hasWa) {
                e.preventDefault();
                onClose();
              }
              e.stopPropagation();
            }}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-bold text-white"
            style={{ backgroundColor: hasWa ? DARK_GREEN : CHOCOLATE }}
          >
            {hasWa ? <MessageCircle size={13}/> : <X size={13}/>}
            {hasWa ? "Enquire on WhatsApp" : "Close window"}
          </a>
          {!hasWa && (
            <div className="mt-1.5 text-center text-[8px] uppercase tracking-wider text-slate-400">
              Add a WhatsApp number in Properties to enable enquiries
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServicesImageRowBlock(): JSX.Element {
  const heading = useSlot("heading", "Popular Services");
  const viewAll = useSlot("viewAll", "View All");
  const bg = useSlot("bg", "#FBF6EC");
  const cardBg = useSlot("cardBg", "#EDD4B0");
  const whatsapp = useSlot("whatsappNumber", "");
  const prefill = useSlot("whatsappPrefill", "Hi, I'd like a quote for {service}.");
  const c1T = useSlot("c1Title", "Custom Furniture");
  const c1D = useSlot("c1Desc", "Wardrobes, Cabinets, Beds & more");
  const c1Img = useSlot("c1Image", "");
  const c2T = useSlot("c2Title", "Modular Kitchen");
  const c2D = useSlot("c2Desc", "Modern & Functional Kitchen Solutions");
  const c2Img = useSlot("c2Image", "");
  const c3T = useSlot("c3Title", "Interior Work");
  const c3D = useSlot("c3Desc", "TV Units, Wall Panels, False Ceiling & more");
  const c3Img = useSlot("c3Image", "");
  const c4T = useSlot("c4Title", "Doors & Windows");
  const c4D = useSlot("c4Desc", "Custom Doors, Windows & Frames");
  const c4Img = useSlot("c4Image", "");

  const cards = [
    { t: c1T, d: c1D, img: c1Img, I: Box },
    { t: c2T, d: c2D, img: c2Img, I: Wrench },
    { t: c3T, d: c3D, img: c3Img, I: Award },
    { t: c4T, d: c4D, img: c4Img, I: Shield }
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const editable = c1T.editable;

  return (
    <div className="relative p-4" style={{ backgroundColor: bg.value }}>
      <div className="mb-2 flex items-baseline justify-between">
        <EditableText value={heading.value} onCommit={heading.set} editable={heading.editable}
          className="text-[16px] font-bold" style={{ color: "#3B2413" }} />
        <div className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "#8B4513" }}>
          <EditableText value={viewAll.value} onCommit={viewAll.set} editable={viewAll.editable} className="inline" />
          <ChevronRight size={11}/>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {cards.map((c, i) => {
          const I = c.I;
          return (
            <div key={i} className="w-[75px] flex-shrink-0 overflow-hidden rounded-md"
              style={{ backgroundColor: cardBg.value }}>
              {/* Image slot — click to upload / URL / remove */}
              <div className="relative">
                <ImageDropSlot
                  value={c.img.value}
                  onCommit={c.img.set}
                  width="75px"
                  height="75px"
                />
                {/* Round icon badge — bottom-left */}
                <div className="pointer-events-none absolute left-1 bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-white">
                  <I size={11} color="#8B4513"/>
                </div>
              </div>
              {/* Card body — click to open service modal preview */}
              <button
                onClick={(e) => { e.stopPropagation(); setOpenIdx(i); }}
                className="block w-full p-1.5 text-left"
                title="Preview service modal"
              >
                <EditableText value={c.t.value} onCommit={c.t.set} editable={c.t.editable}
                  className="text-[9px] font-bold leading-tight" style={{ color: "#3B2413" }} />
                <EditableText value={c.d.value} onCommit={c.d.set} editable={c.d.editable}
                  className="mt-0.5 text-[7px] leading-tight" style={{ color: "#8B4513" }} />
                {editable && (
                  <div className="mt-1 truncate rounded-sm px-1 text-[7px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                    ⟶ Tap: open card
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal preview — shows chocolate-rim window that runtime users see */}
      {openIdx !== null && cards[openIdx] && (
        <ServiceCardModal
          open={true}
          onClose={() => setOpenIdx(null)}
          title={cards[openIdx].t.value}
          description={cards[openIdx].d.value}
          image={cards[openIdx].img.value}
          whatsappNumber={whatsapp.value}
          prefill={prefill.value}
        />
      )}
    </div>
  );
}

function FeaturesIconCircleBlock(): JSX.Element {
  const f1I = useSlot("f1Icon", "shield");
  const f1L = useSlot("f1Label", "Skilled & Verified Carpenters");
  const f1A = useSlot("f1Action", "none");
  const f2I = useSlot("f2Icon", "award");
  const f2L = useSlot("f2Label", "Quality Workmanship");
  const f2A = useSlot("f2Action", "none");
  const f3I = useSlot("f3Icon", "check");
  const f3L = useSlot("f3Label", "On-Time Service");
  const f3A = useSlot("f3Action", "none");
  const f4I = useSlot("f4Icon", "star");
  const f4L = useSlot("f4Label", "Affordable Pricing");
  const f4A = useSlot("f4Action", "none");
  const iconBg = useSlot("iconBg", "#EDD4B0");
  const iconColor = useSlot("iconColor", "#8B4513");
  const bg = useSlot("bg", "#FBF6EC");
  const sectionPadding = useSlot("sectionPadding", "md");
  const itemHeight = useSlot("itemHeight", "md");
  const itemWidth = useSlot("itemWidth", "auto");

  const secPad: Record<string, string> = { sm: "p-2", md: "p-3", lg: "p-4", xl: "p-6" };
  const circleDim: Record<string, string> = { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-14 w-14" };
  const circleIconSize: Record<string, number> = { sm: 14, md: 20, lg: 26 };
  const gap: Record<string, string> = { sm: "gap-0.5", md: "gap-1.5", lg: "gap-2.5" };
  const labelSize: Record<string, string> = { sm: "text-[9px]", md: "text-[10px]", lg: "text-[11px]" };

  const items = [
    { i: f1I, l: f1L, a: f1A },
    { i: f2I, l: f2L, a: f2A },
    { i: f3I, l: f3L, a: f3A },
    { i: f4I, l: f4L, a: f4A }
  ];
  const width = itemWidth.value === "auto" ? undefined : itemWidth.value;
  return (
    <div className={`grid grid-cols-4 gap-2 ${secPad[sectionPadding.value] ?? "p-3"}`} style={{ backgroundColor: bg.value }}>
      {items.map((f, i) => {
        const I = iconByName(f.i.value);
        return (
          <div key={i} className={`flex flex-col items-center text-center ${gap[itemHeight.value] ?? "gap-1.5"}`}
            style={width ? { width, justifySelf: "center" } : {}}>
            <div className={`flex items-center justify-center rounded-full ${circleDim[itemHeight.value] ?? "h-11 w-11"}`}
              style={{ backgroundColor: iconBg.value }}>
              <I size={circleIconSize[itemHeight.value] ?? 20} color={iconColor.value}/>
            </div>
            <EditableText value={f.l.value} onCommit={f.l.set} editable={f.l.editable}
              className={`${labelSize[itemHeight.value] ?? "text-[10px]"} font-semibold leading-tight`}
              style={{ color: "#3B2413" }}/>
            <ActionBadge value={f.a.value} onChange={f.a.set} editable={f.a.editable}/>
          </div>
        );
      })}
    </div>
  );
}

function ServicesImageCardsBlock(): JSX.Element {
  const heading = useSlot("heading", "Popular Services");
  const viewAllLabel = useSlot("viewAllLabel", "View All");
  const c1T = useSlot("c1Title", "Custom Furniture");
  const c1D = useSlot("c1Desc", "Wardrobes, Cabinets, Beds & more");
  const c2T = useSlot("c2Title", "Modular Kitchen");
  const c2D = useSlot("c2Desc", "Modern & Functional Kitchen Solutions");
  const c3T = useSlot("c3Title", "Interior Work");
  const c3D = useSlot("c3Desc", "TV Units, Wall Panels, False Ceiling & more");
  const c4T = useSlot("c4Title", "Doors & Windows");
  const c4D = useSlot("c4Desc", "Custom Doors, Windows & Frames");
  const cards = [
    { t: c1T, d: c1D, icon: Box }, { t: c2T, d: c2D, icon: Wrench },
    { t: c3T, d: c3D, icon: Award }, { t: c4T, d: c4D, icon: Shield }
  ];

  return (
    <div className="bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <EditableText value={heading.value} onCommit={heading.set} editable={heading.editable}
          className="text-[16px] font-bold text-slate-900"/>
        <div className="flex items-center gap-0.5 text-[11px] font-semibold text-slate-600">
          <EditableText value={viewAllLabel.value} onCommit={viewAllLabel.set} editable={viewAllLabel.editable} className="inline"/>
          <ChevronRight size={12}/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c, i) => {
          const I = c.icon;
          return (
            <div key={i} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="relative flex h-24 items-center justify-center bg-slate-100">
                <Camera size={20} className="text-slate-400"/>
                <div className="absolute left-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "#FBF6EC" }}>
                  <I size={14} color="#8B4513"/>
                </div>
              </div>
              <div className="p-2">
                <EditableText value={c.t.value} onCommit={c.t.set} editable={c.t.editable}
                  className="text-[12px] font-bold text-slate-900"/>
                <EditableText value={c.d.value} onCommit={c.d.set} editable={c.d.editable}
                  className="mt-0.5 text-[9px] leading-tight text-slate-500"/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A circle that can be either an icon (with a colour), an uploaded
 *  image, or a solid colour swatch. Clicking it opens a small popover
 *  with Icon / Image / Colour tabs. */
function CircleSlot({
  size, mode, icon, image, bgColor, iconColor,
  onModeChange, onIconChange, onImageChange, onBgColorChange, onIconColorChange,
  editable,
  border
}: {
  size: number;
  mode: string;   // "icon" | "image" | "color"
  icon: string;
  image: string;
  bgColor: string;
  iconColor: string;
  onModeChange: (v: string) => void;
  onIconChange: (v: string) => void;
  onImageChange: (v: string) => void;
  onBgColorChange: (v: string) => void;
  onIconColorChange: (v: string) => void;
  editable: boolean;
  border?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"icon" | "image" | "color">(mode as "icon" | "image" | "color");
  const [urlBoxOpen, setUrlBoxOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const I = iconByName(icon);

  const COLOR_PRESETS = [
    "#D4A056", "#8B4513", "#FBF6EC", "#4A2C1A", "#166534",
    "#DC2626", "#0EA5E9", "#FBBF24", "#0A0A0A", "#FFFFFF"
  ];

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onImageChange(ev.target?.result as string);
      onModeChange("image");
      setOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const isImg = mode === "image" && image;
  const bgStyle: React.CSSProperties = isImg
    ? { backgroundImage: `url('${image}')`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: mode === "color" ? bgColor : `${iconColor}33` };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (editable) setOpen((v) => !v);
        }}
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full transition hover:brightness-95"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: border ?? "none",
          ...bgStyle
        }}
        title={editable ? "Click to change icon / image / colour" : undefined}
      >
        {!isImg && mode === "icon" && <I size={size / 2} color={iconColor}/>}
      </button>

      {/* Editor popover — Icon / Image / Colour tabs */}
      {open && editable && (
        <div className="absolute left-0 top-full z-40 mt-1 w-[220px] rounded-md border border-slate-200 bg-white shadow-xl">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            {(["icon", "image", "color"] as const).map((t) => (
              <button
                key={t}
                onClick={(e) => { e.stopPropagation(); setTab(t); }}
                className="flex-1 border-r border-slate-200 py-1.5 text-[10px] font-bold uppercase tracking-wider transition last:border-r-0"
                style={t === tab
                  ? { backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }
                  : { color: "#64748B" }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Icon tab */}
          {tab === "icon" && (
            <div className="p-2">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Icon</div>
              <div className="grid grid-cols-6 gap-0.5">
                {PAGE_ICON_CHOICES.map((n) => {
                  const NI = iconByName(n);
                  const isCur = n === icon && mode === "icon";
                  return (
                    <button
                      key={n}
                      onClick={(e) => { e.stopPropagation(); onIconChange(n); onModeChange("icon"); }}
                      className="flex h-6 w-6 items-center justify-center rounded transition hover:bg-yellow-100"
                      style={isCur ? { backgroundColor: BRAND_YELLOW } : {}}
                      title={n}
                    >
                      <NI size={12} className="text-slate-700"/>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Icon colour</div>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={(e) => { e.stopPropagation(); onIconColorChange(c); onModeChange("icon"); }}
                    className="h-5 w-5 rounded border border-slate-200"
                    style={{ backgroundColor: c, boxShadow: c === iconColor ? `0 0 0 2px ${BRAND_YELLOW}` : undefined }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Image tab */}
          {tab === "image" && (
            <div className="p-2">
              {!urlBoxOpen ? (
                <>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-yellow-50">
                    <Upload size={11}/>
                    Upload image
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => onFile(e.target.files?.[0])}/>
                  </label>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUrlBoxOpen(true); }}
                    className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-yellow-50"
                  >
                    <ExternalLink size={11}/>
                    Paste URL
                  </button>
                  {image && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onImageChange(""); onModeChange("icon"); }}
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                    >
                      <X size={11}/>
                      Remove image (back to icon)
                    </button>
                  )}
                </>
              ) : (
                <input
                  autoFocus
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      if (urlDraft.trim()) {
                        onImageChange(urlDraft.trim());
                        onModeChange("image");
                      }
                      setUrlBoxOpen(false); setUrlDraft("");
                    }
                    if (e.key === "Escape") { setUrlBoxOpen(false); setUrlDraft(""); }
                  }}
                  placeholder="https://…"
                  className="w-full rounded border border-slate-300 px-1.5 py-1 text-[10px] focus:outline-none focus:border-yellow-400"
                />
              )}
            </div>
          )}

          {/* Color tab */}
          {tab === "color" && (
            <div className="p-2">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Solid circle colour</div>
              <div className="flex flex-wrap gap-0.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={(e) => { e.stopPropagation(); onBgColorChange(c); onModeChange("color"); }}
                    className="h-6 w-6 rounded border border-slate-200"
                    style={{ backgroundColor: c, boxShadow: c === bgColor && mode === "color" ? `0 0 0 2px ${BRAND_YELLOW}` : undefined }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GuaranteeBannerBlock(): JSX.Element {
  const heading = useSlot("heading", "Quality Work. Guaranteed.");
  const body = useSlot("body", "We use the best tools & materials to deliver durable and beautiful results.");
  const sealText = useSlot("sealText", "100% Satisfaction Guarantee");
  const bg = useSlot("bg", "#4A2C1A");
  const fg = useSlot("fg", "#FBF6EC");
  const accent = useSlot("accent", "#D4A056");

  // Left icon-circle
  const leftMode = useSlot("leftMode", "icon");        // icon|image|color
  const leftIcon = useSlot("leftIcon", "shield");
  const leftImage = useSlot("leftImage", "");
  const leftBg = useSlot("leftBg", "#D4A056");
  const leftIconColor = useSlot("leftIconColor", "#D4A056");

  // Right seal-circle
  const rightMode = useSlot("rightMode", "color");     // icon|image|color (default is the seal)
  const rightIcon = useSlot("rightIcon", "award");
  const rightImage = useSlot("rightImage", "");
  const rightBg = useSlot("rightBg", "#4A2C1A");
  const rightIconColor = useSlot("rightIconColor", "#D4A056");

  const editable = heading.editable;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg p-4"
      style={{ backgroundColor: bg.value }}>
      <div className="flex items-start gap-2">
        <CircleSlot
          size={36}
          mode={leftMode.value}
          icon={leftIcon.value}
          image={leftImage.value}
          bgColor={leftBg.value}
          iconColor={leftIconColor.value}
          onModeChange={leftMode.set}
          onIconChange={leftIcon.set}
          onImageChange={leftImage.set}
          onBgColorChange={leftBg.set}
          onIconColorChange={leftIconColor.set}
          editable={editable}
        />
        <div>
          <EditableText value={heading.value} onCommit={heading.set} editable={heading.editable}
            className="text-[13px] font-bold" style={{ color: accent.value }}/>
          <EditableText value={body.value} onCommit={body.set} editable={body.editable}
            className="mt-0.5 text-[10px] leading-tight" style={{ color: fg.value }}/>
        </div>
      </div>
      {/* Right seal-circle — hosts CircleSlot; when in color mode we still
          show the classic "100%" + sealText overlay if there's no image. */}
      <div className="relative">
        <CircleSlot
          size={64}
          mode={rightMode.value}
          icon={rightIcon.value}
          image={rightImage.value}
          bgColor={rightBg.value}
          iconColor={rightIconColor.value}
          onModeChange={rightMode.set}
          onIconChange={rightIcon.set}
          onImageChange={rightImage.set}
          onBgColorChange={rightBg.set}
          onIconColorChange={rightIconColor.set}
          editable={editable}
          border={`2px solid ${accent.value}`}
        />
        {/* When it's a plain colour circle (default seal look), overlay
            the "100%" text. Skip overlay for icon/image modes. */}
        {rightMode.value === "color" && !rightImage.value && (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
            style={{ color: accent.value }}
          >
            <div className="text-[11px] font-bold leading-tight">100%</div>
            <EditableText value={sealText.value} onCommit={sealText.set} editable={sealText.editable}
              className="pointer-events-auto text-[7px] font-semibold leading-tight px-1" style={{ color: accent.value }}/>
          </div>
        )}
      </div>
    </div>
  );
}

function BottomNavFabBlock(): JSX.Element {
  const t1 = useSlot("tab1", "Home");
  const t2 = useSlot("tab2", "Bookings");
  const fab = useSlot("fabLabel", "Book Now");
  const t4 = useSlot("tab4", "Messages");
  const t5 = useSlot("tab5", "Profile");
  const fabBg = useSlot("fabBg", "#8B4513");
  const bg = useSlot("bg", "#FBF6EC");
  return (
    <div className="relative shadow-inner" style={{ backgroundColor: bg.value }}>
      <div className="grid grid-cols-5 items-center border-t border-slate-200 py-2 px-2">
        <NavTab label={t1} icon={Box} active/>
        <NavTab label={t2} icon={Check}/>
        <div/>
        <NavTab label={t4} icon={MessageCircle}/>
        <NavTab label={t5} icon={Shield}/>
      </div>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3">
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full text-white shadow-lg" style={{ backgroundColor: fabBg.value }}>
          <Plus size={20}/>
        </div>
        <EditableText value={fab.value} onCommit={fab.set} editable={fab.editable}
          className="mt-1 text-center text-[9px] font-bold text-slate-700"/>
      </div>
    </div>
  );
}

function NavTab({ label, icon: I, active }: {
  label: { value: string; set: (v: string) => void; editable: boolean };
  icon: typeof Box; active?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <I size={16} className={active ? "text-slate-900" : "text-slate-500"}/>
      <EditableText value={label.value} onCommit={label.set} editable={label.editable}
        className={`text-[9px] ${active ? "font-bold text-slate-900" : "text-slate-500"}`}/>
    </div>
  );
}

/** Small page-heading strip for interior pages (Gallery, Contact, About). */
function PageHeaderStripBlock(): JSX.Element {
  const eyebrow = useSlot("eyebrow", "OUR WORK");
  const title = useSlot("title", "Gallery");
  const subhead = useSlot("subhead", "Recent projects with real costs — hand-crafted by our team.");
  const eyebrowColor = useSlot("eyebrowColor", "#8B4513");
  const titleColor = useSlot("titleColor", "#3B2413");
  const subheadColor = useSlot("subheadColor", "#8B4513");
  const bg = useSlot("bg", "#FBF6EC");
  return (
    <div className="px-4 pb-4 pt-3" style={{ backgroundColor: bg.value }}>
      <EditableText value={eyebrow.value} onCommit={eyebrow.set} editable={eyebrow.editable}
        className="text-[10px] font-bold uppercase tracking-widest" style={{ color: eyebrowColor.value }}/>
      <EditableText value={title.value} onCommit={title.set} editable={title.editable}
        className="mt-0.5 text-[26px] font-bold leading-tight" style={{ color: titleColor.value }}/>
      <EditableText value={subhead.value} onCommit={subhead.set} editable={subhead.editable}
        className="mt-1 text-[11px] leading-snug" style={{ color: subheadColor.value }}/>
    </div>
  );
}

/** 2-column gallery grid — image + title + description + price + WhatsApp
 *  enquire CTA (green) that falls back to closing if no number set. */
function GalleryGridPricedBlock(): JSX.Element {
  const bg = useSlot("bg", "#FBF6EC");
  const cardBg = useSlot("cardBg", "#FFFFFF");
  const titleColor = useSlot("titleColor", "#3B2413");
  const descColor = useSlot("descColor", "#8B4513");
  const priceColor = useSlot("priceColor", "#8B4513");
  const whatsapp = useSlot("whatsappNumber", "");
  const prefill = useSlot("whatsappPrefill", "Hi, I'd like a quote for {item} ({price}).");

  const defaults = [
    ["Walnut Wardrobe", "Custom 3-door wardrobe, soft-close hinges.", "£1,850"],
    ["Modular Kitchen", "L-shape modern kitchen, quartz worktop.", "£4,600"],
    ["TV Media Wall", "Floating oak unit with cable management.", "£1,200"],
    ["Solid Oak Doors", "Set of 4 internal doors, pre-hung.", "£980"]
  ];

  const slots = [1, 2, 3, 4].map((n) => ({
    img: useSlot(`c${n}Image`, ""),
    title: useSlot(`c${n}Title`, defaults[n - 1]?.[0] ?? ""),
    desc: useSlot(`c${n}Desc`, defaults[n - 1]?.[1] ?? ""),
    price: useSlot(`c${n}Price`, defaults[n - 1]?.[2] ?? "")
  }));

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const editable = slots[0]!.title.editable;

  return (
    <div className="relative p-3" style={{ backgroundColor: bg.value }}>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((s, i) => (
          <div key={i} className="overflow-hidden rounded-lg" style={{ backgroundColor: cardBg.value, border: `1px solid ${cardBg.value === "#FFFFFF" ? "#E2E8F0" : "transparent"}` }}>
            <div className="relative">
              <ImageDropSlot value={s.img.value} onCommit={s.img.set} width="100%" height="100px"/>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setOpenIdx(i); }}
              className="block w-full p-2 text-left"
              title="Preview gallery card modal"
            >
              <EditableText value={s.title.value} onCommit={s.title.set} editable={s.title.editable}
                className="text-[11px] font-bold leading-tight" style={{ color: titleColor.value }}/>
              <EditableText value={s.desc.value} onCommit={s.desc.set} editable={s.desc.editable}
                className="mt-0.5 text-[9px] leading-tight" style={{ color: descColor.value }}/>
              <div className="mt-1.5 flex items-center justify-between">
                <EditableText value={s.price.value} onCommit={s.price.set} editable={s.price.editable}
                  className="text-[13px] font-bold" style={{ color: priceColor.value }}/>
                {editable && (
                  <span className="rounded-sm px-1 text-[7px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                    tap
                  </span>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>
      {openIdx !== null && slots[openIdx] && (
        <ServiceCardModal
          open={true}
          onClose={() => setOpenIdx(null)}
          title={slots[openIdx]!.title.value}
          description={`${slots[openIdx]!.desc.value}\n\nPrice: ${slots[openIdx]!.price.value}`}
          image={slots[openIdx]!.img.value}
          whatsappNumber={whatsapp.value}
          prefill={prefill.value
            .replaceAll("{item}", slots[openIdx]!.title.value)
            .replaceAll("{price}", slots[openIdx]!.price.value)}
        />
      )}
    </div>
  );
}

/** Contact form — Name / Phone / Email / Message + Send-on-WhatsApp CTA.
 *  When the block is not editable (published), the form submits by
 *  opening WhatsApp with all four fields concatenated. In the editor
 *  the Send button is a preview only. */
function ContactFormBlock(): JSX.Element {
  const bg = useSlot("bg", "#FBF6EC");
  const cardBg = useSlot("cardBg", "#FFFFFF");
  const labelColor = useSlot("labelColor", "#8B4513");
  const inputBg = useSlot("inputBg", "#FBF6EC");
  const submitBg = useSlot("submitBg", "#166534");
  const submitLabel = useSlot("submitLabel", "Send on WhatsApp");
  const heading = useSlot("heading", "Get a Free Quote");
  const headingColor = useSlot("headingColor", "#5B2E0A"); // chocolate
  const subhead = useSlot("subhead", "We reply within 24h.");
  const whatsapp = useSlot("whatsappNumber", "");
  const [n, setN] = useState("");
  const [p, setP] = useState("");
  const [e, setE] = useState("");
  const [m, setM] = useState("");

  const submit = () => {
    const parts = [n && `Name: ${n}`, p && `Phone: ${p}`, e && `Email: ${e}`, m && `Message: ${m}`].filter(Boolean);
    const wa = whatsapp.value.replace(/[^0-9]/g, "");
    if (wa) {
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(parts.join("\n"))}`, "_blank", "noreferrer,noopener");
    }
  };

  const stop = (ev: React.SyntheticEvent) => ev.stopPropagation();
  return (
    <div className="p-3" style={{ backgroundColor: bg.value }} onClick={stop}>
      <div className="rounded-lg p-3 shadow-sm" style={{ backgroundColor: cardBg.value }}>
        <EditableText value={heading.value} onCommit={heading.set} editable={heading.editable}
          className="text-[15px] font-bold leading-tight" style={{ color: headingColor.value }}/>
        <EditableText value={subhead.value} onCommit={subhead.set} editable={subhead.editable}
          className="mt-0.5 text-[10px]" style={{ color: labelColor.value }}/>
        <div className="mt-2 space-y-1.5">
          {[
            { label: "Your name", val: n, set: setN, type: "text" },
            { label: "Phone", val: p, set: setP, type: "tel" },
            { label: "Email", val: e, set: setE, type: "email" }
          ].map((f) => (
            <div key={f.label}>
              <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: labelColor.value }}>{f.label}</div>
              <input
                type={f.type}
                value={f.val}
                onClick={stop}
                onChange={(ev) => f.set(ev.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus:outline-none focus:border-yellow-400"
                style={{ backgroundColor: inputBg.value }}
              />
            </div>
          ))}
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: labelColor.value }}>Message</div>
            <textarea
              value={m}
              rows={3}
              onClick={stop}
              onChange={(ev) => setM(ev.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus:outline-none focus:border-yellow-400"
              style={{ backgroundColor: inputBg.value, resize: "none" }}
            />
          </div>
        </div>
        <button
          onClick={(ev) => { ev.stopPropagation(); submit(); }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-bold text-white"
          style={{ backgroundColor: submitBg.value }}
        >
          <MessageCircle size={14}/>
          <EditableText value={submitLabel.value} onCommit={submitLabel.set} editable={submitLabel.editable} className="inline"/>
        </button>
        {!whatsapp.value && heading.editable && (
          <div className="mt-1 text-center text-[8px] uppercase tracking-wider text-slate-400">
            Set a WhatsApp number in Properties to route submissions
          </div>
        )}
      </div>
    </div>
  );
}

/** Contact details strip — phone / email / address / hours icon rows. */
function ContactDetailsBlock(): JSX.Element {
  const bg = useSlot("bg", "#FBF6EC");
  const bubbleBg = useSlot("bubbleBg", "#5B2E0A"); // chocolate
  const iconColor = useSlot("iconColor", "#FBF6EC"); // cream — legible on chocolate
  const textColor = useSlot("textColor", "#3B2413");
  const phone = useSlot("phone", "0161 555 0000");
  const email = useSlot("email", "hello@woodcraft.co.uk");
  const address = useSlot("address", "42 Oakwood Lane, Manchester");
  const hours = useSlot("hours", "Mon–Sat · 8:00–18:00");
  const rows = [
    { I: Phone, val: phone, href: (v: string) => `tel:${v.replace(/[^0-9+]/g, "")}` },
    { I: Mail, val: email, href: (v: string) => `mailto:${v}` },
    { I: MapPin, val: address, href: (v: string) => `https://maps.google.com/?q=${encodeURIComponent(v)}` },
    { I: Calendar, val: hours, href: null }
  ];
  return (
    <div className="p-3" style={{ backgroundColor: bg.value }}>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const I = r.I;
          return (
            <a
              key={i}
              href={r.href ? r.href(r.val.value) : undefined}
              onClick={(ev) => ev.stopPropagation()}
              className="flex items-center gap-2.5 rounded-md bg-white p-2.5 shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: bubbleBg.value }}>
                <I size={14} color={iconColor.value}/>
              </div>
              <EditableText value={r.val.value} onCommit={r.val.set} editable={r.val.editable}
                className="text-[12px] font-semibold" style={{ color: textColor.value }}/>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── Footer + supporting ───────────────────────────────────
function FooterFullBlock(): JSX.Element {
  return (
    <div className="p-6" style={{ backgroundColor: BRAND_BLACK }}>
      <div className="grid grid-cols-4 gap-3">
        {[
          { h: "About", l: ["Story", "Team", "Careers"] },
          { h: "Legal", l: ["Privacy", "Terms", "Refunds"] },
          { h: "Help", l: ["Support", "FAQs", "Contact"] },
          { h: "Trust", l: ["Gas Safe", "NICEIC", "CPCS"] }
        ].map((c) => (
          <div key={c.h}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white">{c.h}</div>
            {c.l.map((li) => <div key={li} className="mb-0.5 text-[11px] text-white/60">{li}</div>)}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/50">© 2026 Manchester Plumbing · Gas Safe #123456</div>
    </div>
  );
}
function FooterMinimalBlock(): JSX.Element {
  const brandName = useSlot("brandName", "Manchester Plumbing");
  const copyright = useSlot("copyright", "© 2026");
  const bg = useSlot("bg", BRAND_BLACK);
  const fg = useSlot("fg", "#FFFFFF");
  return (
    <div className="flex items-center gap-3 p-4" style={{ backgroundColor: bg.value }}>
      <EditableText value={brandName.value} onCommit={brandName.set} editable={brandName.editable}
        className="text-[13px] font-bold" style={{ color: fg.value }} />
      <div className="ml-auto flex gap-2">
        {[1,2,3].map((i) => <div key={i} className="h-6 w-6 rounded-full" style={{ backgroundColor: `${fg.value}20` }}/>)}
      </div>
      <EditableText value={copyright.value} onCommit={copyright.set} editable={copyright.editable}
        className="text-[10px]" style={{ color: `${fg.value}80` }} />
    </div>
  );
}

function LoyaltyPointsBlock(): JSX.Element {
  const label = useSlot("label", "Your points");
  const value = useSlot("value", "2,340");
  const valueColor = useSlot("valueColor", BRAND_AMBER);
  const progress = useSlot("progress", "60");
  const progressColor = useSlot("progressColor", BRAND_YELLOW);
  const subtext = useSlot("subtext", "660 points to Silver tier");
  const showCta = useSlot("showCta", "true");
  const cta1Label = useSlot("cta1Label", "Redeem");
  const cta1Bg = useSlot("cta1Bg", BRAND_YELLOW);
  const cta2Label = useSlot("cta2Label", "Refer");

  return (
    <div className="bg-white p-4">
      <EditableText value={label.value} onCommit={label.set} editable={label.editable}
        className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500" />
      <EditableText value={value.value} onCommit={value.set} editable={value.editable}
        className="mb-2 text-[28px] font-bold" style={{ color: valueColor.value }} />
      <div className="mb-1 h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ backgroundColor: progressColor.value, width: `${progress.value}%` }} />
      </div>
      <EditableText value={subtext.value} onCommit={subtext.set} editable={subtext.editable}
        className="text-[11px] text-slate-500" />
      {showCta.value === "true" && (
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-md py-1.5 text-[12px] font-bold" style={{ backgroundColor: cta1Bg.value, color: BRAND_BLACK }}>
            <EditableText value={cta1Label.value} onCommit={cta1Label.set} editable={cta1Label.editable} className="inline" />
          </button>
          <button className="flex-1 rounded-md border border-slate-300 bg-white py-1.5 text-[12px] font-bold text-slate-900">
            <EditableText value={cta2Label.value} onCommit={cta2Label.set} editable={cta2Label.editable} className="inline" />
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentsRowBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-2 text-[13px] font-bold text-slate-900">Payment methods</div>
      <div className="flex flex-wrap gap-2">
        {["Visa", "MC", "Apple Pay", "PayPal", "Bank"].map((p) => (
          <div key={p} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-800 shadow-sm">{p}</div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
        <Shield size={11} color="#10B981"/>
        <span>All payments secured via Stripe · SCA compliant</span>
      </div>
    </div>
  );
}

function AnalyticsKPIBlock(): JSX.Element {
  const k1L = useSlot("kpi1Label", "REVENUE");
  const k1V = useSlot("kpi1Value", "£12.4k");
  const k1T = useSlot("kpi1Trend", "+18%");
  const k2L = useSlot("kpi2Label", "USERS");
  const k2V = useSlot("kpi2Value", "342");
  const k2T = useSlot("kpi2Trend", "+9%");
  const k3L = useSlot("kpi3Label", "CONVERSION");
  const k3V = useSlot("kpi3Value", "6.8%");
  const k3T = useSlot("kpi3Trend", "-2%");

  const kpis = [
    { l: k1L, v: k1V, t: k1T },
    { l: k2L, v: k2V, t: k2T },
    { l: k3L, v: k3V, t: k3T }
  ];

  return (
    <div className="grid grid-cols-3 gap-2 bg-white p-4">
      {kpis.map((s, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3">
          <EditableText value={s.l.value} onCommit={s.l.set} editable={s.l.editable}
            className="text-[9px] font-bold uppercase tracking-wider text-slate-500" />
          <EditableText value={s.v.value} onCommit={s.v.set} editable={s.v.editable}
            className="mt-1 text-[18px] font-bold text-slate-900" />
          <EditableText value={s.t.value} onCommit={s.t.set} editable={s.t.editable}
            className="text-[11px] font-bold"
            style={{ color: s.t.value.startsWith("-") ? "#DC2626" : "#10B981" }} />
        </div>
      ))}
    </div>
  );
}

function BlogFeaturedBlock(): JSX.Element {
  return (
    <div className="bg-white p-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Latest</div>
      <div className="mb-3 overflow-hidden rounded-lg">
        <div className="flex h-32 items-end p-3" style={{ background: `linear-gradient(135deg, ${BRAND_BLACK}, #475569)` }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BRAND_YELLOW }}>Boiler care</div>
            <div className="text-[14px] font-bold leading-tight text-white">Winter prep — 5 things every boiler needs</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[{ t: "Solar 2026 guide" }, { t: "EV charging grants" }].map((p) => (
          <div key={p.t} className="rounded-md border border-slate-200 p-2">
            <div className="mb-1 h-12 rounded bg-slate-100"/>
            <div className="text-[11px] font-bold text-slate-900">{p.t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline-editable text. When the block is selected, contentEditable
 *  is enabled and a yellow underline appears on hover. Committed on
 *  blur or Enter. */
function EditableText({
  value, onCommit, editable, className, style
}: {
  value: string;
  onCommit: (v: string) => void;
  editable: boolean;
  className?: string;
  style?: React.CSSProperties;
}): JSX.Element {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  if (!editable) {
    return (
      <div className={className} style={style}>
        {value}
      </div>
    );
  }

  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onFocus={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const next = e.currentTarget.textContent ?? "";
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") {
          (e.currentTarget as HTMLElement).textContent = value;
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      className={`${className ?? ""} cursor-text rounded outline-none focus:ring-2 focus:ring-yellow-400/60 hover:bg-white/5`}
      style={{ ...style, minWidth: "1ch" }}
    >
      {local}
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────
function ButtonBlock({ item }: { item: CatalogItem }): JSX.Element {
  const label = (item.payload.config?.label as string | undefined) ?? item.name;
  const bg = item.colorHint ?? BRAND_YELLOW;
  const isLight = bg === "#FFFFFF" || bg === BRAND_YELLOW || bg === "#FFC107";
  const fg = isLight ? BRAND_BLACK : "#FFFFFF";
  const iconFor: Record<string, typeof Phone> = {
    "button.call": Phone,
    "button.whatsapp": MessageCircle,
    "button.book": ChevronRight,
    "button.quote": ChevronRight,
    "button.email": Mail,
    "button.primary": ChevronRight,
    "button.secondary": ChevronRight,
    "button.floating-cta": ChevronRight
  };
  const Icon = iconFor[item.id] ?? ChevronRight;

  // ─── Animation-effect variants ───────────────────────
  if (item.id === "button.pulse") {
    return (
      <div className="flex justify-center bg-white p-6">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-md" style={{ backgroundColor: `${BRAND_YELLOW}55` }} />
          <button
            className="relative flex h-11 items-center gap-2 rounded-md px-5 text-[14px] font-bold"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            <ChevronRight size={16} />
            {label}
          </button>
        </div>
      </div>
    );
  }
  if (item.id === "button.glow") {
    return (
      <div className="flex justify-center bg-white p-6">
        <button
          className="glow-btn flex h-11 items-center gap-2 rounded-md px-5 text-[14px] font-bold"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          <ChevronRight size={16} />
          {label}
        </button>
        <style>{`
          @keyframes glowBreathe { 0%,100% { box-shadow: 0 0 6px 0 ${BRAND_YELLOW}66; } 50% { box-shadow: 0 0 24px 6px ${BRAND_YELLOW}CC; } }
          .glow-btn { animation: glowBreathe 2.4s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }
  if (item.id === "button.ripple") {
    return (
      <div className="flex justify-center bg-white p-6">
        <button
          className="ripple-btn relative overflow-hidden flex h-11 items-center gap-2 rounded-md px-5 text-[14px] font-bold text-white"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          <span className="absolute inset-0 rounded-full opacity-0" style={{ animation: "ripple 1.6s ease-out infinite", backgroundColor: "#FFFFFF33" }} />
          <ChevronRight size={16} />
          {label}
        </button>
        <style>{`@keyframes ripple { 0% { transform: scale(0); opacity: 0.6; } 100% { transform: scale(1.4); opacity: 0; } }`}</style>
      </div>
    );
  }
  if (item.id === "button.slide-fill") {
    return (
      <div className="flex justify-center bg-white p-6">
        <button
          className="slide-btn relative overflow-hidden flex h-11 items-center gap-2 rounded-md border-2 px-5 text-[14px] font-bold"
          style={{ borderColor: BRAND_BLACK, color: BRAND_BLACK }}
        >
          <span className="slide-fill absolute inset-0" style={{ backgroundColor: BRAND_YELLOW, transform: "translateX(-100%)" }} />
          <span className="relative flex items-center gap-2">
            <ChevronRight size={16} />
            {label}
          </span>
        </button>
        <style>{`
          @keyframes slideIn { 0%,100% { transform: translateX(-100%); } 50% { transform: translateX(0); } }
          .slide-btn .slide-fill { animation: slideIn 3s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }
  if (item.id === "button.underline-sweep") {
    return (
      <div className="flex justify-center bg-white p-6">
        <button className="relative pb-1 text-[14px] font-bold" style={{ color: BRAND_BLACK }}>
          {label}
          <span className="sweep absolute inset-x-0 bottom-0 h-0.5 origin-left" style={{ backgroundColor: BRAND_YELLOW }} />
          <style>{`
            @keyframes sweep { 0% { transform: scaleX(0); } 50% { transform: scaleX(1); } 100% { transform: scaleX(0); transform-origin: right; } }
            .sweep { animation: sweep 2.4s ease-in-out infinite; }
          `}</style>
        </button>
      </div>
    );
  }

  // ─── Shape + size + compound variants ───────────────
  if (item.id === "button.pill") {
    return <div className="flex justify-center bg-white p-4">
      <button className="flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <ChevronRight size={16}/>Continue
      </button>
    </div>;
  }
  if (item.id === "button.square") {
    return <div className="flex justify-center bg-white p-4">
      <button className="h-11 px-5 text-[14px] font-bold uppercase tracking-wider" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>Submit</button>
    </div>;
  }
  if (item.id === "button.chip") {
    return <div className="flex justify-center bg-white p-4">
      <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
        <MapPin size={11}/>Manchester<X size={11} className="text-slate-500"/>
      </div>
    </div>;
  }
  if (item.id === "button.tab") {
    return <div className="flex justify-center gap-4 bg-white p-4">
      {["Overview", "Services", "Reviews"].map((l, i) => (
        <div key={l} className={`pb-1 text-[13px] font-semibold ${i === 0 ? "border-b-2" : "text-slate-500"}`}
          style={i === 0 ? { borderColor: BRAND_YELLOW, color: BRAND_BLACK } : {}}>{l}</div>
      ))}
    </div>;
  }
  if (item.id === "button.icon-circle") {
    return <div className="flex justify-center bg-white p-4">
      <button className="flex h-12 w-12 items-center justify-center rounded-full shadow" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <Phone size={18}/>
      </button>
    </div>;
  }
  if (item.id === "button.icon-square") {
    return <div className="flex justify-center bg-white p-4">
      <button className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}>
        <MessageCircle size={18}/>
      </button>
    </div>;
  }
  if (item.id === "button.with-badge") {
    return <div className="flex justify-center bg-white p-4">
      <button className="relative flex h-11 items-center gap-2 rounded-md px-4 text-[14px] font-bold" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
        <Mail size={14}/>Inbox
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#DC2626" }}>3</span>
      </button>
    </div>;
  }
  if (item.id === "button.two-line") {
    return <div className="flex justify-center bg-white p-4">
      <button className="flex flex-col items-center rounded-md px-5 py-2" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
        <div className="text-[14px] font-bold leading-tight">Book Now</div>
        <div className="text-[10px] font-semibold uppercase" style={{ color: BRAND_YELLOW }}>Free callout</div>
      </button>
    </div>;
  }
  if (item.id === "button.split") {
    return <div className="flex justify-center bg-white p-4">
      <div className="flex overflow-hidden rounded-md">
        <button className="flex h-11 items-center gap-2 px-4 text-[14px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
          <Check size={14}/>Save
        </button>
        <button className="flex h-11 items-center justify-center border-l border-black/10 px-2" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
          <ChevronRight size={16} className="rotate-90"/>
        </button>
      </div>
    </div>;
  }
  if (item.id === "button.gradient") {
    return <div className="flex justify-center bg-white p-4">
      <button className="flex h-11 items-center gap-2 rounded-md px-5 text-[14px] font-bold text-white shadow-lg"
        style={{ background: `linear-gradient(90deg, ${BRAND_YELLOW}, ${BRAND_AMBER})` }}>
        <Sparkles size={14}/>Try Premium
      </button>
    </div>;
  }
  if (item.id === "button.glass") {
    return <div className="flex justify-center p-6" style={{ background: `linear-gradient(135deg, ${BRAND_BLACK}, #4B5563)` }}>
      <button className="flex h-11 items-center gap-2 rounded-md border border-white/30 px-5 text-[14px] font-bold text-white backdrop-blur"
        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
        Explore
      </button>
    </div>;
  }
  if (item.id === "button.neumorph") {
    return <div className="flex justify-center p-6" style={{ backgroundColor: "#E2E8F0" }}>
      <button className="rounded-full px-6 py-3 text-[14px] font-bold text-slate-700"
        style={{
          backgroundColor: "#E2E8F0",
          boxShadow: "6px 6px 12px #BEC8D4, -6px -6px 12px #FFFFFF"
        }}>Click</button>
    </div>;
  }
  if (item.id === "button.xs") {
    return <div className="flex justify-center bg-white p-4">
      <button className="flex h-6 items-center gap-1 rounded px-2 text-[10px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <Check size={10}/>OK
      </button>
    </div>;
  }
  if (item.id === "button.lg") {
    return <div className="flex justify-center bg-white p-4">
      <button className="flex h-14 items-center gap-2 rounded-lg px-8 text-[17px] font-bold text-white shadow-lg" style={{ backgroundColor: BRAND_BLACK }}>
        Get Started<ChevronRight size={20}/>
      </button>
    </div>;
  }

  return (
    <div className="flex justify-center bg-white p-4">
      <EditableButton
        icon={Icon}
        defaultLabel={label}
        defaultBg={bg}
        defaultFg={fg}
      />
    </div>
  );
}

function EditableButton({
  icon: Icon,
  defaultLabel,
  defaultBg,
  defaultFg
}: {
  icon: typeof Phone;
  defaultLabel: string;
  defaultBg: string;
  defaultFg: string;
}): JSX.Element {
  const label = useSlot("btnLabel", defaultLabel);
  const bg = useSlot("btnBg", defaultBg);
  const fg = useSlot("btnFg", defaultFg);
  const actionType = useSlot("actionType", "none");
  const actionTarget = useSlot("actionTarget", "");
  const actionLabel = useSlot("actionLabel", "Get in touch");
  const ctx = useContext(BlockOverridesContext);

  const onFire = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ctx.isSelected) return; // editing — don't fire
    fireButtonAction(actionType.value, actionTarget.value, actionLabel.value);
  };

  return (
    <button
      className="flex h-11 items-center gap-2 rounded-md px-5 text-[14px] font-bold shadow"
      style={{ backgroundColor: bg.value, color: fg.value, border: bg.value === "#FFFFFF" ? "1px solid #E2E8F0" : "none" }}
      onClick={onFire}
    >
      <Icon size={16} />
      <EditableText value={label.value} onCommit={label.set} editable={label.editable} className="inline" />
      {actionType.value !== "none" && ctx.isSelected && (
        <span
          className="ml-1 rounded-full px-1 text-[9px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
          title={`Action: ${actionType.value} → ${actionTarget.value || "?"}`}
        >
          ⚡
        </span>
      )}
    </button>
  );
}

/** Broadcast a button-action event so the shell can react — navigate
 *  to a page, open a popup, or fake an external link. Editor mode is
 *  a preview, so external / call / email just show a toast. */
function fireButtonAction(type: string, target: string, popupTitle: string): void {
  const event = new CustomEvent("studio-editor:button-action", {
    detail: { type, target, popupTitle }
  });
  window.dispatchEvent(event);
}

// ─── Container ─────────────────────────────────────────────
function ContainerBlock({ item }: { item: CatalogItem }): JSX.Element {
  if (item.id === "container.single") {
    return (
      <div className="bg-white p-4">
        <div className="rounded-md border-2 border-dashed border-slate-300 p-4 text-center">
          <div className="text-[12px] font-semibold text-slate-500">Single column</div>
          <div className="mt-1 text-[11px] text-slate-400">Drop content here</div>
        </div>
      </div>
    );
  }
  if (item.id === "container.split-2") {
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border-2 border-dashed border-slate-300 p-3 text-center text-[10px] font-semibold text-slate-500">Column 1</div>
          <div className="rounded-md border-2 border-dashed border-slate-300 p-3 text-center text-[10px] font-semibold text-slate-500">Column 2</div>
        </div>
      </div>
    );
  }
  if (item.id === "container.grid-3") {
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-3 gap-2">
          {["Boiler swap", "Leak repair", "Bathroom fit"].map((s) => (
            <div key={s} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-center">
              <Wrench size={16} className="mx-auto text-slate-500" />
              <div className="mt-1 text-[10px] font-semibold text-slate-900">{s}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.id === "container.grid-4") {
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Shield, label: "Gas Safe" },
            { icon: Award, label: "£5m PL" },
            { icon: Star, label: "4.9 · 127" },
            { icon: MapPin, label: "Manchester" }
          ].map(({ icon: I, label }) => (
            <div key={label} className="flex items-center gap-1.5 rounded-md border border-slate-200 p-2">
              <I size={13} color={BRAND_AMBER} />
              <div className="text-[10px] font-bold text-slate-700">{label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.id === "container.hero") {
    return <HeroBlock item={item} />;
  }
  if (item.id === "container.masonry") {
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex h-24 items-center justify-center rounded-md bg-slate-100"><Camera size={20} className="text-slate-400" /></div>
          <div className="flex h-32 items-center justify-center rounded-md bg-slate-100"><Camera size={20} className="text-slate-400" /></div>
          <div className="flex h-32 items-center justify-center rounded-md bg-slate-100"><Camera size={20} className="text-slate-400" /></div>
          <div className="flex h-24 items-center justify-center rounded-md bg-slate-100"><Camera size={20} className="text-slate-400" /></div>
        </div>
      </div>
    );
  }
  if (item.id === "container.timeline") {
    return (
      <div className="bg-white p-4">
        <div className="flex flex-col gap-2">
          {["Book slot", "Site visit", "Quote sent", "Job done"].map((step, i) => (
            <div key={step} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: BRAND_BLACK }}>
                {i + 1}
              </div>
              <div className="text-[12px] font-semibold text-slate-900">{step}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.id === "container.pricing") {
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { name: "Basic", price: "£85" },
            { name: "Standard", price: "£195", pinned: true },
            { name: "Premium", price: "£395" }
          ].map((t) => (
            <div
              key={t.name}
              className="rounded-md border-2 p-2 text-center"
              style={{
                borderColor: t.pinned ? BRAND_YELLOW : "#E2E8F0",
                backgroundColor: t.pinned ? "#FFFCF0" : "white"
              }}
            >
              <div className="text-[10px] font-semibold uppercase text-slate-500">{t.name}</div>
              <div className="mt-1 text-[16px] font-bold text-slate-900">{t.price}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.id === "container.card-2x2") {
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          {["Emergency", "Planned", "Servicing", "Advice"].map((s) => (
            <div key={s} className="rounded-md border border-slate-200 p-2">
              <div className="text-[12px] font-bold text-slate-900">{s}</div>
              <div className="mt-1 text-[10px] text-slate-500">From £65</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.id === "container.wizard") {
    return (
      <div className="bg-white p-4">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n, i) => (
            <>
              <div key={n} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: i === 0 ? BRAND_YELLOW : "#E2E8F0", color: i === 0 ? BRAND_BLACK : "#94A3B8" }}>
                {n}
              </div>
              {i < 4 && <div key={`d-${n}`} className="h-0.5 flex-1 bg-slate-200" />}
            </>
          ))}
        </div>
      </div>
    );
  }
  if (item.id === "container.sidebar-left" || item.id === "container.sidebar-right") {
    const sidebarLeft = item.id === "container.sidebar-left";
    const sidebar = (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
        <div className="text-[10px] font-bold uppercase text-slate-500">Reviews</div>
        <div className="mt-1 flex gap-0.5">
          {[1,2,3,4,5].map(i => <Star key={i} size={10} fill={BRAND_YELLOW} color={BRAND_YELLOW}/>)}
        </div>
        <div className="mt-1 text-[10px] text-slate-700">4.9 · 127</div>
      </div>
    );
    const content = (
      <div className="rounded-md border border-slate-200 p-2">
        <div className="text-[12px] font-bold text-slate-900">Main content</div>
        <div className="mt-1 text-[10px] text-slate-500">Body copy, services, etc.</div>
      </div>
    );
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-[80px_1fr] gap-2">
          {sidebarLeft ? <>{sidebar}{content}</> : <>{content}{sidebar}</>}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white p-4">
      <div className="rounded-md border-2 border-dashed border-slate-300 p-4 text-center text-[11px] font-semibold text-slate-500">
        {item.name}
      </div>
    </div>
  );
}

// ─── Section — trades-native mock content per section type ─────
function SectionBlock({ item }: { item: CatalogItem }): JSX.Element {
  // Hero variants — full-size versions of the sidebar tiles.
  if (item.id === "section.hero-text-left") return <HeroTextLeftBlock item={item} />;
  if (item.id === "section.hero-text-center") return <HeroCenteredBlock item={item} />;
  if (item.id === "section.hero-text-bottom") return <HeroBottomLeftBlock item={item} />;
  if (item.id === "section.hero-text-floating") return <HeroFloatingBlock item={item} />;
  if (item.id === "section.hero-video-bg") return <HeroVideoBlock item={item} />;

  // Marquee / ticker variants — canvas versions.
  if (item.id === "section.marquee-single") return <MarqueeSingleBlock />;
  if (item.id === "section.marquee-logos") return <MarqueeLogosBlock />;
  if (item.id === "section.ticker-reviews") return <TickerReviewsBlock />;

  // Product rail variants.
  if (item.id === "section.product-category-rail") return <ProductCategoryRailBlock />;
  if (item.id === "section.product-grid-scroll") return <ProductGridScrollBlock />;

  // Header variants.
  if (item.id === "section.header-sticky") return <HeaderStickyBlock />;
  if (item.id === "section.header-transparent") return <HeaderTransparentBlock />;
  if (item.id === "section.header-floating") return <HeaderFloatingBlock />;
  if (item.id === "section.header-links") return <HeaderLinksBlock />;
  if (item.id === "section.header-burger") return <HeaderBurgerBlock />;
  if (item.id === "section.header-cart") return <HeaderCartBlock />;
  if (item.id === "section.header-signin") return <HeaderSignInBlock />;
  if (item.id === "section.header-search") return <HeaderSearchBlock />;

  // Carousel + before/after variants.
  if (item.id === "section.gallery-beforeafter") return <GalleryBeforeAfterBlock />;

  // Search variants.
  if (item.id === "section.search-global") return <SearchGlobalBlock />;
  if (item.id === "section.search-location") return <SearchLocationBlock />;
  if (item.id === "section.search-autocomplete") return <SearchAutocompleteBlock />;
  if (item.id === "section.search-ai") return <SearchAIBlock />;

  // Booking variants.
  if (item.id === "section.booking-calendar") return <BookingCalendarBlock />;
  if (item.id === "section.booking-slots") return <BookingSlotsBlock />;
  if (item.id === "section.booking-quote") return <BookingQuoteBlock />;

  // Ecommerce variants.
  if (item.id === "section.ecom-variants") return <EcomVariantsBlock />;
  if (item.id === "section.ecom-add-cart") return <EcomAddCartBlock />;
  if (item.id === "section.ecom-related") return <EcomRelatedBlock />;

  // Restaurant.
  if (item.id === "section.food-menu") return <FoodMenuBlock />;
  if (item.id === "section.food-combos") return <FoodCombosBlock />;

  // Ride-hailing.
  if (item.id === "section.ride-pickup") return <RidePickupBlock />;
  if (item.id === "section.ride-driver") return <RideDriverBlock />;

  // Auth.
  if (item.id === "section.auth-login") return <AuthLoginBlock />;
  if (item.id === "section.auth-otp") return <AuthOTPBlock />;

  // Chat.
  if (item.id === "section.chat-live") return <ChatBlock ai={false} />;
  if (item.id === "section.chat-ai") return <ChatBlock ai={true} />;

  // Empty states.
  if (item.id === "section.empty-orders") return <EmptyStateBlock kind="orders" />;
  if (item.id === "section.empty-messages") return <EmptyStateBlock kind="messages" />;
  if (item.id === "section.empty-error") return <EmptyStateBlock kind="error" />;

  // ─── Woodcraft-template sections (added 2026-07-09) ───
  if (item.id === "section.social-proof-avatars") return <SocialProofAvatarsBlock />;
  if (item.id === "section.search-card-hero") return <SearchCardHeroBlock />;
  if (item.id === "section.services-4-image-row") return <ServicesImageRowBlock />;
  if (item.id === "section.features-4-icons-circle") return <FeaturesIconCircleBlock />;
  if (item.id === "section.services-4-image-cards") return <ServicesImageCardsBlock />;
  if (item.id === "section.guarantee-banner") return <GuaranteeBannerBlock />;
  if (item.id === "section.bottom-nav-fab") return <BottomNavFabBlock />;

  // ─── Multi-page templates: Gallery + Contact ──────
  if (item.id === "section.page-header-strip") return <PageHeaderStripBlock />;
  if (item.id === "section.gallery-grid-priced") return <GalleryGridPricedBlock />;
  if (item.id === "section.contact-form") return <ContactFormBlock />;
  if (item.id === "section.contact-details") return <ContactDetailsBlock />;

  // Footer + supporting.
  if (item.id === "section.footer-full") return <FooterFullBlock />;
  if (item.id === "section.footer-minimal") return <FooterMinimalBlock />;
  if (item.id === "section.footer-appstore") return <FooterAppStoreBlock />;
  if (item.id === "section.loyalty-points") return <LoyaltyPointsBlock />;
  if (item.id === "section.payments-row") return <PaymentsRowBlock />;
  if (item.id === "section.analytics-kpi") return <AnalyticsKPIBlock />;
  if (item.id === "section.blog-featured") return <BlogFeaturedBlock />;

  const cat = (item.searchKeywords[1] ?? item.searchKeywords[0] ?? "").toLowerCase();
  if (cat.includes("hero")) return <HeroBlock item={item} />;
  if (cat.includes("service")) {
    return (
      <div className="bg-white p-4">
        <div className="mb-2 text-[16px] font-bold text-slate-900">Our services</div>
        <div className="flex flex-col gap-2">
          {[
            { title: "Emergency callout", price: "From £85" },
            { title: "Boiler installation", price: "Quoted" },
            { title: "Annual servicing", price: "From £70" }
          ].map((s) => (
            <div key={s.title} className="flex items-center justify-between rounded-md border border-slate-200 p-2">
              <div>
                <div className="text-[13px] font-semibold text-slate-900">{s.title}</div>
                <div className="text-[10px] uppercase text-slate-500">{s.price}</div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (cat.includes("testimonial") || cat.includes("review")) {
    return (
      <div className="bg-white p-4">
        <div className="mb-2 text-[16px] font-bold text-slate-900">What our customers say</div>
        {[
          { name: "Sarah T. · Didsbury", text: "Turned up on time, sorted the leak in 20 minutes. Fair price." },
          { name: "James P. · Chorlton", text: "Gas Safe cert on hand, explained everything, no surprises." }
        ].map((r) => (
          <div key={r.name} className="mb-2 rounded-md border border-slate-200 p-3">
            <div className="mb-1 flex gap-0.5">
              {[1,2,3,4,5].map(i => <Star key={i} size={10} fill={BRAND_YELLOW} color={BRAND_YELLOW}/>)}
            </div>
            <div className="text-[12px] text-slate-700">"{r.text}"</div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500">{r.name}</div>
          </div>
        ))}
      </div>
    );
  }
  if (cat.includes("contact")) {
    return (
      <div className="bg-white p-4">
        <div className="mb-2 text-[16px] font-bold text-slate-900">Get in touch</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
            <Phone size={14} color={BRAND_AMBER} />
            <div className="text-[12px] font-semibold text-slate-900">0161 555 0000</div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
            <MessageCircle size={14} color={BRAND_AMBER} />
            <div className="text-[12px] font-semibold text-slate-900">WhatsApp us</div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
            <Mail size={14} color={BRAND_AMBER} />
            <div className="text-[12px] font-semibold text-slate-900">hello@yours.co.uk</div>
          </div>
        </div>
      </div>
    );
  }
  if (cat.includes("faq")) {
    return (
      <div className="bg-white p-4">
        <div className="mb-2 text-[16px] font-bold text-slate-900">Common questions</div>
        {["Do you charge a callout fee?", "Are you Gas Safe?", "Do you offer a guarantee?"].map((q) => (
          <div key={q} className="mb-1.5 flex items-center justify-between rounded-md border border-slate-200 p-2">
            <div className="text-[12px] font-semibold text-slate-900">{q}</div>
            <ChevronRight size={14} className="text-slate-400" />
          </div>
        ))}
      </div>
    );
  }
  if (cat.includes("trust")) {
    return (
      <div className="bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Shield, label: "Gas Safe" },
            { icon: Award, label: "£5m PL" },
            { icon: Star, label: "4.9 · 127" },
            { icon: MapPin, label: "Manchester" }
          ].map(({ icon: I, label }) => (
            <div key={label} className="flex items-center gap-1.5 rounded-md border border-slate-200 p-2">
              <I size={13} color={BRAND_AMBER} />
              <div className="text-[10px] font-bold text-slate-700">{label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (cat.includes("gallery") || cat.includes("portfolio") || cat.includes("project")) {
    return (
      <div className="bg-white p-4">
        <div className="mb-2 text-[16px] font-bold text-slate-900">Our work</div>
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex aspect-square items-center justify-center rounded-md bg-slate-100">
              <Camera size={20} className="text-slate-400"/>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (cat.includes("cta")) {
    return (
      <div className="p-4" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="rounded-md p-4 text-center">
          <div className="text-[16px] font-bold text-white">Ready to book?</div>
          <div className="mt-1 text-[12px] text-slate-300">Get a free quote within 1 working day.</div>
          <button className="mt-3 rounded-md px-4 py-2 text-[13px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
            Get a Quote
          </button>
        </div>
      </div>
    );
  }
  // Generic — placeholder card with the section name
  return (
    <div className="bg-white p-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Section
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
          {item.name}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">{item.description}</div>
      </div>
    </div>
  );
}

function CatalogTile({
  item, onClick, compact
}: {
  item: CatalogItem;
  onClick: () => void;
  compact: boolean;
}): JSX.Element {
  if (item.category === "hero" && item.thumbnailUrl) {
    return (
      <button
        onClick={onClick}
        className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 transition hover:border-slate-900"
        style={{
          backgroundImage: `url('${item.thumbnailUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
        title={item.description}
      >
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
          <div className="line-clamp-2 text-left text-[10px] font-semibold text-white">
            {item.name}
          </div>
        </div>
        <div
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <Plus size={12} color={BRAND_BLACK} />
        </div>
      </button>
    );
  }
  if (item.category === "button") {
    return (
      <button
        onClick={onClick}
        className="group flex items-center gap-3 rounded-md border border-slate-200 p-2 text-left transition hover:border-slate-900 hover:bg-slate-50"
      >
        <div
          className="h-6 w-6 flex-shrink-0 rounded-full border border-white"
          style={{ backgroundColor: item.colorHint ?? BRAND_YELLOW, boxShadow: "0 0 0 1px #E2E8F0" }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-slate-900">{item.name}</div>
          <div className="line-clamp-1 text-[10px] text-slate-500">{item.description}</div>
        </div>
        <Plus size={14} className="flex-shrink-0 text-slate-400 group-hover:text-slate-900" />
      </button>
    );
  }
  // Containers + Sections — square tiles with a real mini preview
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white text-left transition hover:border-slate-900 hover:shadow"
      title={item.description}
    >
      {/* Mini preview — same visual grammar as the canvas render */}
      <div className="relative h-32 w-full overflow-hidden bg-white">
        <MiniTilePreview item={item} />
        {/* Hover Plus badge */}
        <div
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <Plus size={12} color={BRAND_BLACK} />
        </div>
      </div>
      {/* Label footer */}
      <div className="flex items-center gap-1 border-t border-slate-100 bg-slate-50 px-2 py-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold text-slate-900">{item.name}</div>
        </div>
      </div>
    </button>
  );
}

function PropertiesPanel({
  block,
  onOverride,
  onClose
}: {
  block: CanvasItem;
  onOverride: (slot: string, value: string) => void;
  onClose: () => void;
}): JSX.Element {
  // Which slots we surface controls for. Order matches the block's
  // internal render order so the user's eye tracks.
  const slots = slotDefsFor(block.item);

  return (
    <aside className="flex w-[300px] flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <header
        className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-slate-200 px-3"
        style={{ backgroundColor: BRAND_BLACK, color: "white" }}
      >
        <div className="text-[13px] font-semibold">Properties</div>
        <span
          className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          {block.item.category}
        </span>
        <button
          onClick={onClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Element
          </div>
          <div className="mt-0.5 text-[13px] font-bold text-slate-900">{block.item.name}</div>
        </div>

        {slots.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-[12px] text-slate-600">
            This block doesn't expose editable slots yet. Every text you see on
            the canvas is already inline-editable — just click it.
          </div>
        ) : (
          <GroupedSlots
            slots={slots}
            overrides={block.overrides}
            onOverride={onOverride}
          />
        )}
      </div>
    </aside>
  );
}

function GroupedSlots({
  slots,
  overrides,
  onOverride
}: {
  slots: SlotDef[];
  overrides: BlockOverrides;
  onOverride: (slot: string, value: string) => void;
}): JSX.Element {
  // Group slots by their `group` field, in original order.
  const groups: Array<{ name: string; slots: SlotDef[] }> = [];
  for (const s of slots) {
    const g = s.group ?? "General";
    let bucket = groups.find((x) => x.name === g);
    if (!bucket) {
      bucket = { name: g, slots: [] };
      groups.push(bucket);
    }
    bucket.slots.push(s);
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.name}>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {g.name}
          </div>
          <div className="flex flex-col gap-2">
            {g.slots.map((slot) => (
              <SlotControl
                key={slot.name}
                slot={slot}
                value={overrides[slot.name] ?? slot.default}
                onChange={(v) => onOverride(slot.name, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type SlotDef = {
  name: string;
  label: string;
  kind: "text" | "color" | "image" | "select" | "toggle";
  default: string;
  options?: readonly string[];
  /** Preset colour swatches shown above the picker for `color` slots. */
  presets?: readonly { name: string; value: string }[];
  /** For grouping in the Properties panel. */
  group?: string;
};

// Common CTA color presets — one-click brand colours.
const CTA_COLOR_PRESETS = [
  { name: "Yellow", value: BRAND_YELLOW },
  { name: "WhatsApp", value: "#25D366" },
  { name: "Call", value: BRAND_AMBER },
  { name: "Email", value: "#3B82F6" },
  { name: "Book", value: BRAND_BLACK },
  { name: "White", value: "#FFFFFF" },
  { name: "Success", value: "#10B981" },
  { name: "Danger", value: "#DC2626" }
] as const;

/** Which slots the Properties panel offers for each item category.
 *  Extended per block type. */
function slotDefsFor(item: CatalogItem): SlotDef[] {
  const heroLike =
    item.category === "hero" ||
    item.id === "section.hero-text-left" ||
    item.id === "section.hero-text-center" ||
    item.id === "section.hero-text-bottom" ||
    item.id === "section.hero-text-floating" ||
    item.id === "section.hero-video-bg";

  if (heroLike) {
    return [
      // ─── Content ─────────────────────
      { name: "showEyebrow", label: "Show eyebrow", kind: "toggle", default: "true", group: "Content" },
      { name: "eyebrow", label: "Eyebrow text", kind: "text", default: "Gas Safe · Manchester", group: "Content" },
      { name: "eyebrowColor", label: "Eyebrow colour", kind: "color", default: BRAND_YELLOW,
        presets: CTA_COLOR_PRESETS, group: "Content" },
      { name: "headline", label: "Headline", kind: "text", default: "Emergency plumber — on your doorstep in 45 min.", group: "Content" },
      { name: "showSubhead", label: "Show subhead", kind: "toggle", default: "true", group: "Content" },
      { name: "subhead", label: "Subhead", kind: "text", default: "No callout fee before 8pm. £5m public liability. Family-run since 2008.", group: "Content" },

      // ─── Layout ──────────────────────
      { name: "textAlign", label: "Text alignment", kind: "select", default: "left",
        options: ["left", "center", "right"], group: "Layout" },
      { name: "textPosition", label: "Text position", kind: "select", default: "bottom",
        options: ["top", "middle", "bottom"], group: "Layout" },
      { name: "bg", label: "Hero background", kind: "color", default: "#FFFFFF",
        presets: [
          ...CTA_COLOR_PRESETS,
          { name: "Cream", value: "#FBF6EC" },
          { name: "Tan", value: "#EDD4B0" }
        ] as never, group: "Layout" },
      { name: "bgImage", label: "Hero image", kind: "image", default: item.thumbnailUrl ?? "", group: "Layout" },
      { name: "imageHeight", label: "Image height", kind: "select", default: "220",
        options: ["160", "200", "220", "260", "300", "360"], group: "Layout" },
      { name: "imageWidth", label: "Image column width", kind: "select", default: "50%",
        options: ["30%", "40%", "50%", "60%", "70%", "100%"], group: "Layout" },

      // ─── CTAs ────────────────────────
      { name: "showPrimary", label: "Show primary CTA", kind: "toggle", default: "true", group: "CTAs" },
      { name: "primaryLabel", label: "Primary label", kind: "text", default: "Call 0161 555 0000", group: "CTAs" },
      { name: "primaryBg", label: "Primary colour", kind: "color", default: BRAND_YELLOW,
        presets: CTA_COLOR_PRESETS, group: "CTAs" },
      { name: "primaryFg", label: "Primary text", kind: "color", default: BRAND_BLACK,
        presets: CTA_COLOR_PRESETS, group: "CTAs" },
      { name: "showSecondary", label: "Show secondary CTA", kind: "toggle", default: "true", group: "CTAs" },
      { name: "secondaryLabel", label: "Secondary label", kind: "text", default: "WhatsApp", group: "CTAs" },
      { name: "secondaryBg", label: "Secondary colour", kind: "color", default: "#25D366",
        presets: CTA_COLOR_PRESETS, group: "CTAs" },

      // ─── Running text overlay ────────
      { name: "showMarquee", label: "Show running text", kind: "toggle", default: "false", group: "Running text" },
      { name: "marqueeText", label: "Running text", kind: "text", default: "FREE CALLOUT · GAS SAFE · £5M PL · TODAY ONLY", group: "Running text" },
      { name: "marqueePosition", label: "Position", kind: "select", default: "top",
        options: ["top", "bottom"], group: "Running text" },
      { name: "marqueeBg", label: "Bar background", kind: "color", default: BRAND_YELLOW,
        presets: CTA_COLOR_PRESETS, group: "Running text" },
      { name: "marqueeFg", label: "Bar text colour", kind: "color", default: BRAND_BLACK,
        presets: CTA_COLOR_PRESETS, group: "Running text" },

      // ─── Trust bar — row of icon+word ──
      { name: "showTrustBar", label: "Show trust badges", kind: "toggle", default: "false", group: "Trust badges" },
      { name: "trust1Icon", label: "Badge 1 icon", kind: "select", default: "shield",
        options: ["shield", "award", "star", "phone", "map", "check", "wrench"], group: "Trust badges" },
      { name: "trust1Label", label: "Badge 1 label", kind: "text", default: "Gas Safe", group: "Trust badges" },
      { name: "trust2Icon", label: "Badge 2 icon", kind: "select", default: "award",
        options: ["shield", "award", "star", "phone", "map", "check", "wrench"], group: "Trust badges" },
      { name: "trust2Label", label: "Badge 2 label", kind: "text", default: "£5m Insured", group: "Trust badges" },
      { name: "trust3Icon", label: "Badge 3 icon", kind: "select", default: "star",
        options: ["shield", "award", "star", "phone", "map", "check", "wrench"], group: "Trust badges" },
      { name: "trust3Label", label: "Badge 3 label", kind: "text", default: "4.9 · 127 reviews", group: "Trust badges" }
    ];
  }
  if (item.category === "button") {
    const label = (item.payload.config?.label as string | undefined) ?? item.name;
    const bg = item.colorHint ?? BRAND_YELLOW;
    const isLight = bg === "#FFFFFF" || bg === BRAND_YELLOW || bg === "#FFC107";
    return [
      { name: "btnLabel", label: "Button label", kind: "text", default: label,
        group: "Content" },
      { name: "btnBg", label: "Background", kind: "color", default: bg,
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "btnFg", label: "Text colour", kind: "color", default: isLight ? BRAND_BLACK : "#FFFFFF",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      // ─── Action ─────────────────────
      { name: "actionType", label: "On click", kind: "select", default: "none",
        options: ["none", "navigate", "popup", "external", "call", "whatsapp", "email"], group: "Action" },
      { name: "actionTarget", label: "Target (page id / URL / number)", kind: "text",
        default: "", group: "Action" },
      { name: "actionLabel", label: "Popup title (if popup)", kind: "text",
        default: "Get in touch", group: "Action" }
    ];
  }

  // ─── Page header strip ─────────────────────────────
  if (item.id === "section.page-header-strip") {
    return [
      { name: "eyebrow", label: "Eyebrow", kind: "text", default: "OUR WORK", group: "Content" },
      { name: "title", label: "Page title", kind: "text", default: "Gallery", group: "Content" },
      { name: "subhead", label: "Subhead", kind: "text", default: "Recent projects with real costs — hand-crafted by our team.", group: "Content" },
      { name: "bg", label: "Background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "eyebrowColor", label: "Eyebrow colour", kind: "color", default: "#8B4513",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "titleColor", label: "Title colour", kind: "color", default: "#3B2413",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "subheadColor", label: "Subhead colour", kind: "color", default: "#8B4513",
        presets: CTA_COLOR_PRESETS, group: "Colours" }
    ];
  }

  // ─── Gallery grid — priced ─────────────────────────
  if (item.id === "section.gallery-grid-priced") {
    const slots: SlotDef[] = [
      { name: "bg", label: "Section background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "cardBg", label: "Card background", kind: "color", default: "#FFFFFF",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "titleColor", label: "Title colour", kind: "color", default: "#3B2413",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "descColor", label: "Description colour", kind: "color", default: "#8B4513",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "priceColor", label: "Price colour", kind: "color", default: "#8B4513",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "whatsappNumber", label: "WhatsApp number (E.164)", kind: "text",
        default: "", group: "Enquiry" },
      { name: "whatsappPrefill", label: "Prefill ({item}, {price})", kind: "text",
        default: "Hi, I'd like a quote for {item} ({price}).", group: "Enquiry" }
    ];
    const defaults = [
      ["Walnut Wardrobe", "Custom 3-door wardrobe, soft-close hinges.", "£1,850"],
      ["Modular Kitchen", "L-shape modern kitchen, quartz worktop.", "£4,600"],
      ["TV Media Wall", "Floating oak unit with cable management.", "£1,200"],
      ["Solid Oak Doors", "Set of 4 internal doors, pre-hung.", "£980"]
    ];
    for (const n of [1, 2, 3, 4]) {
      slots.push(
        { name: `c${n}Title`, label: `Card ${n} title`, kind: "text",
          default: defaults[n - 1]?.[0] ?? "", group: `Card ${n}` },
        { name: `c${n}Desc`, label: `Card ${n} description`, kind: "text",
          default: defaults[n - 1]?.[1] ?? "", group: `Card ${n}` },
        { name: `c${n}Price`, label: `Card ${n} price`, kind: "text",
          default: defaults[n - 1]?.[2] ?? "", group: `Card ${n}` },
        { name: `c${n}Image`, label: `Card ${n} image`, kind: "image",
          default: "", group: `Card ${n}` }
      );
    }
    return slots;
  }

  // ─── Contact form ──────────────────────────────────
  if (item.id === "section.contact-form") {
    return [
      { name: "heading", label: "Heading", kind: "text", default: "Get a Free Quote", group: "Content" },
      { name: "subhead", label: "Subhead", kind: "text", default: "We reply within 24h.", group: "Content" },
      { name: "submitLabel", label: "Submit label", kind: "text", default: "Send on WhatsApp", group: "Content" },
      { name: "whatsappNumber", label: "WhatsApp number (E.164)", kind: "text", default: "", group: "Content" },
      { name: "bg", label: "Section background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "cardBg", label: "Card background", kind: "color", default: "#FFFFFF",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "inputBg", label: "Input background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "labelColor", label: "Label colour", kind: "color", default: "#8B4513",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "submitBg", label: "Submit button colour", kind: "color", default: "#166534",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "headingColor", label: "Heading colour", kind: "color", default: "#5B2E0A",
        presets: CTA_COLOR_PRESETS, group: "Colours" }
    ];
  }

  // ─── Contact details strip ─────────────────────────
  if (item.id === "section.contact-details") {
    return [
      { name: "phone", label: "Phone", kind: "text", default: "0161 555 0000", group: "Content" },
      { name: "email", label: "Email", kind: "text", default: "hello@woodcraft.co.uk", group: "Content" },
      { name: "address", label: "Address", kind: "text", default: "42 Oakwood Lane, Manchester", group: "Content" },
      { name: "hours", label: "Hours", kind: "text", default: "Mon–Sat · 8:00–18:00", group: "Content" },
      { name: "bg", label: "Background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "bubbleBg", label: "Icon bubble colour", kind: "color", default: "#5B2E0A",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "iconColor", label: "Icon colour", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "textColor", label: "Text colour", kind: "color", default: "#3B2413",
        presets: CTA_COLOR_PRESETS, group: "Colours" }
    ];
  }

  // ─── Guarantee banner ("Quality Work. Guaranteed.") ──
  if (item.id === "section.guarantee-banner") {
    const CIRCLE_MODES = ["icon", "image", "color"];
    const ICON_OPTS = PAGE_ICON_CHOICES;
    return [
      { name: "heading", label: "Heading", kind: "text", default: "Quality Work. Guaranteed.", group: "Content" },
      { name: "body", label: "Body", kind: "text", default: "We use the best tools & materials to deliver durable and beautiful results.", group: "Content" },
      { name: "sealText", label: "Seal text (color mode only)", kind: "text", default: "100% Satisfaction Guarantee", group: "Content" },
      { name: "bg", label: "Background", kind: "color", default: "#4A2C1A",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "fg", label: "Body text colour", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "accent", label: "Accent colour", kind: "color", default: "#D4A056",
        presets: CTA_COLOR_PRESETS, group: "Colours" },

      { name: "leftMode", label: "Left circle mode", kind: "select", default: "icon",
        options: CIRCLE_MODES, group: "Left circle" },
      { name: "leftIcon", label: "Left icon", kind: "select", default: "shield",
        options: ICON_OPTS, group: "Left circle" },
      { name: "leftImage", label: "Left image", kind: "image", default: "", group: "Left circle" },
      { name: "leftBg", label: "Left solid colour", kind: "color", default: "#D4A056",
        presets: CTA_COLOR_PRESETS, group: "Left circle" },
      { name: "leftIconColor", label: "Left icon colour", kind: "color", default: "#D4A056",
        presets: CTA_COLOR_PRESETS, group: "Left circle" },

      { name: "rightMode", label: "Right circle mode", kind: "select", default: "color",
        options: CIRCLE_MODES, group: "Right circle" },
      { name: "rightIcon", label: "Right icon", kind: "select", default: "award",
        options: ICON_OPTS, group: "Right circle" },
      { name: "rightImage", label: "Right image", kind: "image", default: "", group: "Right circle" },
      { name: "rightBg", label: "Right solid colour", kind: "color", default: "#4A2C1A",
        presets: CTA_COLOR_PRESETS, group: "Right circle" },
      { name: "rightIconColor", label: "Right icon colour", kind: "color", default: "#D4A056",
        presets: CTA_COLOR_PRESETS, group: "Right circle" }
    ];
  }

  // ─── Popular Services (horizontal row) ─────────────
  if (item.id === "section.services-4-image-row") {
    const slots: SlotDef[] = [
      { name: "heading", label: "Section heading", kind: "text", default: "Popular Services", group: "Content" },
      { name: "viewAll", label: "View-all link", kind: "text", default: "View All", group: "Content" },
      { name: "bg", label: "Section background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "cardBg", label: "Card background", kind: "color", default: "#EDD4B0",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "whatsappNumber", label: "WhatsApp number (E.164)", kind: "text",
        default: "", group: "Enquiry" },
      { name: "whatsappPrefill", label: "Prefill message ({service} = card title)", kind: "text",
        default: "Hi, I'd like a quote for {service}.", group: "Enquiry" }
    ];
    const defaults = [
      ["Custom Furniture", "Wardrobes, Cabinets, Beds & more"],
      ["Modular Kitchen", "Modern & Functional Kitchen Solutions"],
      ["Interior Work", "TV Units, Wall Panels, False Ceiling & more"],
      ["Doors & Windows", "Custom Doors, Windows & Frames"]
    ];
    for (const n of [1, 2, 3, 4]) {
      slots.push(
        { name: `c${n}Title`, label: `Card ${n} title`, kind: "text",
          default: defaults[n - 1]?.[0] ?? "", group: `Card ${n}` },
        { name: `c${n}Desc`, label: `Card ${n} description`, kind: "text",
          default: defaults[n - 1]?.[1] ?? "", group: `Card ${n}` },
        { name: `c${n}Image`, label: `Card ${n} image`, kind: "image",
          default: "", group: `Card ${n}` }
      );
    }
    return slots;
  }

  // ─── Social proof avatars ("500+ Happy Customers") ────
  if (item.id === "section.social-proof-avatars") {
    return [
      { name: "count", label: "Number text", kind: "text", default: "500+", group: "Content" },
      { name: "label", label: "Label", kind: "text", default: "Happy Customers", group: "Content" },
      { name: "bg", label: "Background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "avatarSize", label: "Avatar size (px)", kind: "select", default: "32",
        options: ["24", "28", "32", "40", "48"], group: "Layout" },
      { name: "avatar1", label: "Avatar 1 image", kind: "image", default: "", group: "Avatar 1" },
      { name: "avatar1Pos", label: "Avatar 1 face position", kind: "select", default: "center center",
        options: ["left top","center top","right top","left center","center center","right center","left bottom","center bottom","right bottom"], group: "Avatar 1" },
      { name: "avatar2", label: "Avatar 2 image", kind: "image", default: "", group: "Avatar 2" },
      { name: "avatar2Pos", label: "Avatar 2 face position", kind: "select", default: "center center",
        options: ["left top","center top","right top","left center","center center","right center","left bottom","center bottom","right bottom"], group: "Avatar 2" },
      { name: "avatar3", label: "Avatar 3 image", kind: "image", default: "", group: "Avatar 3" },
      { name: "avatar3Pos", label: "Avatar 3 face position", kind: "select", default: "center center",
        options: ["left top","center top","right top","left center","center center","right center","left bottom","center bottom","right bottom"], group: "Avatar 3" }
    ];
  }

  // ─── Search-card hero ("How can we help you today?") ───
  if (item.id === "section.search-card-hero") {
    const ACTION_OPTS = [
      "none", "services-drawer", "location-page", "business-card",
      "popup", "call", "whatsapp", "navigate"
    ];
    return [
      { name: "heading", label: "Card heading", kind: "text", default: "How can we help you today?", group: "Content" },
      { name: "locLabel", label: "Container 1 label", kind: "text", default: "Your Location", group: "Content" },
      { name: "locValue", label: "Container 1 value", kind: "text", default: "New Delhi, India", group: "Content" },
      { name: "svcLabel", label: "Container 2 label", kind: "text", default: "Select Service", group: "Content" },
      { name: "svcValue", label: "Container 2 value", kind: "text", default: "Carpentry Work", group: "Content" },
      { name: "btnLabel", label: "Search button label", kind: "text", default: "Search", group: "Content" },

      { name: "sectionPadding", label: "Section padding", kind: "select", default: "md",
        options: ["sm", "md", "lg", "xl"], group: "Layout" },
      { name: "cardPadding", label: "Card padding", kind: "select", default: "md",
        options: ["sm", "md", "lg", "xl"], group: "Layout" },
      { name: "containerHeight", label: "Inner container height", kind: "select", default: "md",
        options: ["sm", "md", "lg"], group: "Layout" },

      { name: "bg", label: "Section background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "cardBg", label: "Card background", kind: "color", default: "#FFFFFF",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "btnBg", label: "Search button colour", kind: "color", default: "#8B4513",
        presets: CTA_COLOR_PRESETS, group: "Colours" },

      { name: "locAction", label: "Container 1 tap action", kind: "select", default: "location-page",
        options: ACTION_OPTS, group: "Actions" },
      { name: "svcAction", label: "Container 2 tap action", kind: "select", default: "services-drawer",
        options: ACTION_OPTS, group: "Actions" },
      { name: "btnAction", label: "Search button tap action", kind: "select", default: "navigate",
        options: ACTION_OPTS, group: "Actions" },

      { name: "showLoc", label: "Show location container", kind: "toggle", default: "true", group: "Containers" },
      { name: "showSvc", label: "Show service container", kind: "toggle", default: "true", group: "Containers" },
      { name: "showBtn", label: "Show search button", kind: "toggle", default: "true", group: "Containers" }
    ];
  }

  // ─── Features 4-icon circle row ─────────────────
  if (item.id === "section.features-4-icons-circle") {
    const ICON_OPTS = ["shield", "award", "star", "check", "wrench", "phone", "map", "home", "briefcase", "users", "heart", "info", "package", "truck", "coffee", "book", "calendar"];
    const ACTION_OPTS = [
      "none", "services-drawer", "location-page", "business-card",
      "popup", "call", "whatsapp", "navigate"
    ];
    const slots: SlotDef[] = [
      { name: "sectionPadding", label: "Section padding", kind: "select", default: "md",
        options: ["sm", "md", "lg", "xl"], group: "Layout" },
      { name: "itemHeight", label: "Item height", kind: "select", default: "md",
        options: ["sm", "md", "lg"], group: "Layout" },
      { name: "itemWidth", label: "Item column width", kind: "select", default: "auto",
        options: ["auto", "60px", "70px", "80px", "100px"], group: "Layout" },
      { name: "iconBg", label: "Icon background", kind: "color", default: "#EDD4B0",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "iconColor", label: "Icon colour", kind: "color", default: "#8B4513",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "bg", label: "Section background", kind: "color", default: "#FBF6EC",
        presets: CTA_COLOR_PRESETS, group: "Colours" }
    ];
    for (const n of [1, 2, 3, 4]) {
      slots.push(
        { name: `f${n}Icon`, label: `Item ${n} icon`, kind: "select", default: ["shield","award","check","star"][n-1] ?? "shield",
          options: ICON_OPTS, group: `Item ${n}` },
        { name: `f${n}Label`, label: `Item ${n} label`, kind: "text",
          default: ["Skilled & Verified Carpenters","Quality Workmanship","On-Time Service","Affordable Pricing"][n-1] ?? "",
          group: `Item ${n}` },
        { name: `f${n}Action`, label: `Item ${n} tap action`, kind: "select", default: "none",
          options: ACTION_OPTS, group: `Item ${n}` }
      );
    }
    return slots;
  }

  // ─── Header burger — logo, brand, colours ────────
  if (item.id === "section.header-burger") {
    return [
      { name: "brand", label: "Brand name", kind: "text", default: "Brand", group: "Content" },
      { name: "logo", label: "Brand logo", kind: "image", default: "", group: "Content" },
      { name: "logoSize", label: "Logo size", kind: "select", default: "md",
        options: ["sm", "md", "lg", "xl"], group: "Content" },
      { name: "bg", label: "Header background", kind: "color", default: "#FFFFFF",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "brandTextColor", label: "Brand text colour", kind: "color", default: "#0F172A",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "borderColor", label: "Divider colour", kind: "color", default: "#E2E8F0",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "burgerBg", label: "Burger button bg", kind: "color", default: BRAND_YELLOW,
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "burgerIconColor", label: "Burger icon colour", kind: "color", default: BRAND_BLACK,
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "dropdownBg", label: "Menu background", kind: "color", default: "#F8FAFC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "activeItemBg", label: "Active item bg", kind: "color", default: BRAND_YELLOW,
        presets: CTA_COLOR_PRESETS, group: "Colours" },

      { name: "edgeToEdge", label: "Flush to top of screen", kind: "toggle", default: "false", group: "Layout" },
      { name: "topPad", label: "Notch clearance", kind: "select", default: "notch",
        options: ["none", "notch", "generous", "xl"], group: "Layout" },

      { name: "burgerShape", label: "Burger button shape", kind: "select", default: "rounded",
        options: ["square", "rounded", "round"], group: "Burger button" },
      { name: "burgerIconKind", label: "Burger icon design", kind: "select", default: "bars",
        options: ["bars", "menu", "grid", "dots", "plus"], group: "Burger button" }
    ];
  }

  // ─── Loyalty points card ──────────────────────────
  if (item.id === "section.loyalty-points") {
    return [
      { name: "label", label: "Small label", kind: "text", default: "Your points", group: "Content" },
      { name: "value", label: "Points value", kind: "text", default: "2,340", group: "Content" },
      { name: "valueColor", label: "Value colour", kind: "color", default: BRAND_AMBER,
        presets: CTA_COLOR_PRESETS, group: "Content" },
      { name: "progress", label: "Progress %", kind: "select", default: "60",
        options: ["10", "25", "50", "60", "75", "90"], group: "Content" },
      { name: "progressColor", label: "Progress fill", kind: "color", default: BRAND_YELLOW,
        presets: CTA_COLOR_PRESETS, group: "Content" },
      { name: "subtext", label: "Progress subtext", kind: "text", default: "660 points to Silver tier", group: "Content" },
      { name: "showCta", label: "Show buttons", kind: "toggle", default: "true", group: "CTAs" },
      { name: "cta1Label", label: "Button 1", kind: "text", default: "Redeem", group: "CTAs" },
      { name: "cta1Bg", label: "Button 1 bg", kind: "color", default: BRAND_YELLOW,
        presets: CTA_COLOR_PRESETS, group: "CTAs" },
      { name: "cta2Label", label: "Button 2", kind: "text", default: "Refer", group: "CTAs" }
    ];
  }
  // ─── Analytics KPIs ───────────────────────────────
  if (item.id === "section.analytics-kpi") {
    return [
      { name: "kpi1Label", label: "KPI 1 label", kind: "text", default: "REVENUE", group: "KPI 1" },
      { name: "kpi1Value", label: "KPI 1 value", kind: "text", default: "£12.4k", group: "KPI 1" },
      { name: "kpi1Trend", label: "KPI 1 trend", kind: "text", default: "+18%", group: "KPI 1" },
      { name: "kpi2Label", label: "KPI 2 label", kind: "text", default: "USERS", group: "KPI 2" },
      { name: "kpi2Value", label: "KPI 2 value", kind: "text", default: "342", group: "KPI 2" },
      { name: "kpi2Trend", label: "KPI 2 trend", kind: "text", default: "+9%", group: "KPI 2" },
      { name: "kpi3Label", label: "KPI 3 label", kind: "text", default: "CONVERSION", group: "KPI 3" },
      { name: "kpi3Value", label: "KPI 3 value", kind: "text", default: "6.8%", group: "KPI 3" },
      { name: "kpi3Trend", label: "KPI 3 trend", kind: "text", default: "-2%", group: "KPI 3" }
    ];
  }
  // ─── Food menu ────────────────────────────────────
  if (item.id === "section.food-menu") {
    return [
      { name: "heading", label: "Heading", kind: "text", default: "Wood-fired favourites", group: "Content" },
      { name: "m1Name", label: "Item 1 name", kind: "text", default: "Margherita", group: "Item 1" },
      { name: "m1Desc", label: "Item 1 desc", kind: "text", default: "San Marzano · basil", group: "Item 1" },
      { name: "m1Price", label: "Item 1 price", kind: "text", default: "£11", group: "Item 1" },
      { name: "m1Vegan", label: "Item 1 vegan tag", kind: "toggle", default: "true", group: "Item 1" },
      { name: "m2Name", label: "Item 2 name", kind: "text", default: "Salmon Poke", group: "Item 2" },
      { name: "m2Desc", label: "Item 2 desc", kind: "text", default: "sushi rice · avocado", group: "Item 2" },
      { name: "m2Price", label: "Item 2 price", kind: "text", default: "£13", group: "Item 2" },
      { name: "m2Vegan", label: "Item 2 vegan tag", kind: "toggle", default: "false", group: "Item 2" },
      { name: "m3Name", label: "Item 3 name", kind: "text", default: "Vegan Burger", group: "Item 3" },
      { name: "m3Desc", label: "Item 3 desc", kind: "text", default: "beetroot patty · vegan mayo", group: "Item 3" },
      { name: "m3Price", label: "Item 3 price", kind: "text", default: "£10", group: "Item 3" },
      { name: "m3Vegan", label: "Item 3 vegan tag", kind: "toggle", default: "true", group: "Item 3" }
    ];
  }
  // ─── Product grid scroll ──────────────────────────
  if (item.id === "section.product-grid-scroll") {
    return [
      { name: "heading", label: "Heading", kind: "text", default: "Featured", group: "Content" },
      { name: "p1Ref", label: "Ref 1", kind: "text", default: "F045", group: "Product 1" },
      { name: "p1Price", label: "Price 1", kind: "text", default: "£4.85", group: "Product 1" },
      { name: "p2Ref", label: "Ref 2", kind: "text", default: "T1M100", group: "Product 2" },
      { name: "p2Price", label: "Price 2", kind: "text", default: "£38", group: "Product 2" },
      { name: "p3Ref", label: "Ref 3", kind: "text", default: "PLB-A", group: "Product 3" },
      { name: "p3Price", label: "Price 3", kind: "text", default: "£29", group: "Product 3" },
      { name: "p4Ref", label: "Ref 4", kind: "text", default: "BLY100", group: "Product 4" },
      { name: "p4Price", label: "Price 4", kind: "text", default: "£0.68", group: "Product 4" }
    ];
  }
  // ─── Footer minimal ───────────────────────────────
  if (item.id === "section.footer-minimal") {
    return [
      { name: "brandName", label: "Brand name", kind: "text", default: "Manchester Plumbing", group: "Content" },
      { name: "copyright", label: "Copyright", kind: "text", default: "© 2026", group: "Content" },
      { name: "bg", label: "Background", kind: "color", default: BRAND_BLACK,
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "fg", label: "Text colour", kind: "color", default: "#FFFFFF",
        presets: CTA_COLOR_PRESETS, group: "Colours" }
    ];
  }

  // ─── Product category rail ────────────────────────
  if (item.id === "section.product-category-rail") {
    return [
      { name: "heading", label: "Section heading", kind: "text", default: "Categories", group: "Content" },
      { name: "showHeading", label: "Show heading", kind: "toggle", default: "true", group: "Content" },
      { name: "layout", label: "Tile style", kind: "select", default: "bordered",
        options: ["bordered", "borderless", "image-only"], group: "Layout" },
      { name: "tileBg", label: "Tile background", kind: "color", default: "#F8FAFC",
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "tileFg", label: "Label colour", kind: "color", default: BRAND_BLACK,
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "iconColor", label: "Icon colour", kind: "color", default: BRAND_AMBER,
        presets: CTA_COLOR_PRESETS, group: "Colours" },
      { name: "cat1Icon", label: "Category 1 icon", kind: "select", default: "wrench",
        options: ["wrench", "shield", "award", "star", "phone", "map", "check", "box", "camera"],
        group: "Categories" },
      { name: "cat1Label", label: "Category 1 label", kind: "text", default: "Boilers", group: "Categories" },
      { name: "cat2Icon", label: "Category 2 icon", kind: "select", default: "shield",
        options: ["wrench", "shield", "award", "star", "phone", "map", "check", "box", "camera"],
        group: "Categories" },
      { name: "cat2Label", label: "Category 2 label", kind: "text", default: "Safety", group: "Categories" },
      { name: "cat3Icon", label: "Category 3 icon", kind: "select", default: "award",
        options: ["wrench", "shield", "award", "star", "phone", "map", "check", "box", "camera"],
        group: "Categories" },
      { name: "cat3Label", label: "Category 3 label", kind: "text", default: "Deals", group: "Categories" },
      { name: "cat4Icon", label: "Category 4 icon", kind: "select", default: "wrench",
        options: ["wrench", "shield", "award", "star", "phone", "map", "check", "box", "camera"],
        group: "Categories" },
      { name: "cat4Label", label: "Category 4 label", kind: "text", default: "Tools", group: "Categories" },
      { name: "showCat4", label: "Show category 4", kind: "toggle", default: "true", group: "Categories" },
      { name: "cat5Icon", label: "Category 5 icon", kind: "select", default: "star",
        options: ["wrench", "shield", "award", "star", "phone", "map", "check", "box", "camera"],
        group: "Categories" },
      { name: "cat5Label", label: "Category 5 label", kind: "text", default: "Radiators", group: "Categories" },
      { name: "showCat5", label: "Show category 5", kind: "toggle", default: "true", group: "Categories" }
    ];
  }

  // Containers + other sections — inline text edit only for now.
  return [];
}

function SlotControl({
  slot,
  value,
  onChange
}: {
  slot: SlotDef;
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  if (slot.kind === "toggle") {
    const on = value === "true";
    return (
      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-2">
        <label className="text-[12px] font-semibold text-slate-900">{slot.label}</label>
        <button
          onClick={() => onChange(on ? "false" : "true")}
          className="relative flex h-6 w-11 items-center rounded-full transition"
          style={{ backgroundColor: on ? BRAND_BLACK : "#CBD5E1" }}
          aria-label={slot.label}
        >
          <span
            className="h-5 w-5 rounded-full bg-white shadow transition"
            style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>
    );
  }
  if (slot.kind === "select") {
    return (
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {slot.label}
        </label>
        <div className="flex overflow-hidden rounded-md border border-slate-300">
          {(slot.options ?? []).map((opt) => {
            const isActive = value === opt;
            return (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                className="flex-1 border-r border-slate-300 py-1.5 text-[11px] font-semibold last:border-r-0"
                style={
                  isActive
                    ? { backgroundColor: BRAND_BLACK, color: "white" }
                    : { backgroundColor: "white", color: "#334155" }
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (slot.kind === "color") {
    return (
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {slot.label}
        </label>
        {slot.presets && slot.presets.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {slot.presets.map((p) => {
              const isActive = value.toLowerCase() === p.value.toLowerCase();
              return (
                <button
                  key={p.value}
                  onClick={() => onChange(p.value)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 transition"
                  style={{
                    backgroundColor: p.value,
                    borderColor: isActive ? BRAND_BLACK : "#E2E8F0",
                    boxShadow: isActive ? `0 0 0 2px white, 0 0 0 4px ${BRAND_BLACK}` : "none"
                  }}
                  title={p.name}
                  aria-label={p.name}
                />
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-md border border-slate-300"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] font-mono focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>
    );
  }
  if (slot.kind === "image") {
    return (
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {slot.label}
        </label>
        {value && (
          <div
            className="mb-1 h-16 w-full rounded-md border border-slate-200 bg-slate-100"
            style={{
              backgroundImage: `url('${value}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        )}
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] focus:border-slate-900 focus:outline-none"
        />
        <label className="mt-1 flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-700 hover:underline">
          <Upload size={11} />
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => onChange(ev.target?.result as string);
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>
    );
  }
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {slot.label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] leading-relaxed focus:border-slate-900 focus:outline-none"
      />
    </div>
  );
}

/** Tile-sized mini preview of a section or container. Reuses the same
 *  visual grammar as the canvas render so the merchant can identify
 *  what each item is by eye. */
function MiniTilePreview({ item }: { item: CatalogItem }): JSX.Element {
  if (item.category === "container") return <MiniContainer item={item} />;
  return <MiniSection item={item} />;
}

function MiniContainer({ item }: { item: CatalogItem }): JSX.Element {
  if (item.id === "container.single") {
    return (
      <div className="flex h-full items-center justify-center p-2">
        <div className="h-full w-full rounded border-2 border-dashed border-slate-300" />
      </div>
    );
  }
  if (item.id === "container.split-2") {
    return (
      <div className="grid h-full grid-cols-2 gap-1 p-2">
        <div className="rounded border-2 border-dashed border-slate-300" />
        <div className="rounded border-2 border-dashed border-slate-300" />
      </div>
    );
  }
  if (item.id === "container.grid-3") {
    return (
      <div className="grid h-full grid-cols-3 gap-1 p-2">
        {["Boil", "Leak", "Bath"].map((s) => (
          <div key={s} className="flex flex-col items-center justify-center rounded border border-slate-200 bg-slate-50 p-1">
            <Wrench size={10} className="text-slate-500" />
            <div className="mt-0.5 text-[8px] font-bold text-slate-700">{s}</div>
          </div>
        ))}
      </div>
    );
  }
  if (item.id === "container.grid-4") {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-2">
        {[
          { icon: Shield, label: "Gas Safe" },
          { icon: Award, label: "£5m" },
          { icon: Star, label: "4.9" },
          { icon: MapPin, label: "M/cr" }
        ].map(({ icon: I, label }) => (
          <div key={label} className="flex items-center gap-0.5 rounded border border-slate-200 p-1">
            <I size={8} color={BRAND_AMBER} />
            <div className="text-[8px] font-bold text-slate-700">{label}</div>
          </div>
        ))}
      </div>
    );
  }
  if (item.id === "container.hero") {
    return (
      <div
        className="flex h-full flex-col justify-end p-2 text-white"
        style={{
          background: `linear-gradient(135deg, ${BRAND_BLACK} 0%, #1F2937 100%)`
        }}
      >
        <div className="text-[8px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>
          Hero
        </div>
        <div className="text-[11px] font-bold leading-tight">Full-bleed banner</div>
      </div>
    );
  }
  if (item.id === "container.masonry") {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-3 gap-1 p-2">
        <div className="row-span-1 flex items-center justify-center rounded bg-slate-100"><Camera size={10} className="text-slate-400"/></div>
        <div className="row-span-2 flex items-center justify-center rounded bg-slate-100"><Camera size={10} className="text-slate-400"/></div>
        <div className="row-span-2 flex items-center justify-center rounded bg-slate-100"><Camera size={10} className="text-slate-400"/></div>
        <div className="row-span-1 flex items-center justify-center rounded bg-slate-100"><Camera size={10} className="text-slate-400"/></div>
      </div>
    );
  }
  if (item.id === "container.timeline") {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        {["Book", "Visit", "Quote", "Done"].map((s, i) => (
          <div key={s} className="flex items-center gap-1 rounded border border-slate-200 p-1">
            <div className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: BRAND_BLACK }}>
              {i + 1}
            </div>
            <div className="text-[9px] font-bold text-slate-900">{s}</div>
          </div>
        ))}
      </div>
    );
  }
  if (item.id === "container.pricing") {
    return (
      <div className="grid h-full grid-cols-3 gap-1 p-2">
        {[
          { name: "Basic", price: "£85" },
          { name: "Std", price: "£195", pinned: true },
          { name: "Prem", price: "£395" }
        ].map((t) => (
          <div
            key={t.name}
            className="flex flex-col items-center justify-center rounded border-2 p-1"
            style={{ borderColor: t.pinned ? BRAND_YELLOW : "#E2E8F0", backgroundColor: t.pinned ? "#FFFCF0" : "white" }}
          >
            <div className="text-[7px] uppercase text-slate-500">{t.name}</div>
            <div className="text-[10px] font-bold text-slate-900">{t.price}</div>
          </div>
        ))}
      </div>
    );
  }
  if (item.id === "container.card-2x2") {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-2">
        {["Emergency", "Planned", "Servicing", "Advice"].map((s) => (
          <div key={s} className="rounded border border-slate-200 p-1">
            <div className="text-[8px] font-bold text-slate-900">{s}</div>
            <div className="text-[7px] text-slate-500">From £65</div>
          </div>
        ))}
      </div>
    );
  }
  if (item.id === "container.wizard") {
    return (
      <div className="flex h-full items-center gap-0.5 p-2">
        {[1, 2, 3, 4, 5].map((n, i) => (
          <div key={`row-${n}`} className="flex flex-1 items-center">
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ backgroundColor: i === 0 ? BRAND_YELLOW : "#E2E8F0", color: i === 0 ? BRAND_BLACK : "#94A3B8" }}>
              {n}
            </div>
            {i < 4 && <div className="h-0.5 flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>
    );
  }
  if (item.id === "container.sidebar-left" || item.id === "container.sidebar-right") {
    const sidebarLeft = item.id === "container.sidebar-left";
    const sidebar = (
      <div className="rounded border border-slate-200 bg-slate-50 p-1">
        <div className="text-[7px] font-bold uppercase text-slate-500">Rev.</div>
        <div className="mt-0.5 flex gap-0.5">
          {[1,2,3].map(i => <Star key={i} size={6} fill={BRAND_YELLOW} color={BRAND_YELLOW}/>)}
        </div>
      </div>
    );
    const content = (
      <div className="rounded border border-slate-200 p-1">
        <div className="text-[9px] font-bold text-slate-900">Content</div>
        <div className="text-[7px] text-slate-500">Body copy</div>
      </div>
    );
    return (
      <div className="grid h-full grid-cols-[30%_1fr] gap-1 p-2">
        {sidebarLeft ? <>{sidebar}{content}</> : <>{content}{sidebar}</>}
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-2">
      <div className="text-[10px] font-semibold text-slate-500">{item.name}</div>
    </div>
  );
}

function MiniSection({ item }: { item: CatalogItem }): JSX.Element {
  const cat = (item.searchKeywords[1] ?? item.searchKeywords[0] ?? "").toLowerCase();
  const id = item.id.toLowerCase();
  const key = id + " " + cat;

  // ─── Search ──────────────────────────────────────────
  if (id.includes("search-global")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="flex h-6 items-center gap-1 rounded-md border border-slate-300 bg-white px-2">
          <Search size={9} className="text-slate-400"/>
          <div className="text-[8px] text-slate-400">Search…</div>
        </div>
        <div className="text-[7px] font-bold uppercase text-slate-500">Recent</div>
        <div className="flex flex-wrap gap-0.5">
          {["Boiler", "Leak", "Solar"].map((t) => (
            <span key={t} className="rounded bg-slate-100 px-1 py-0.5 text-[7px] font-bold text-slate-700">{t}</span>
          ))}
        </div>
      </div>
    );
  }
  if (id.includes("search-location")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-1">
          <MapPin size={9} color={BRAND_AMBER}/>
          <div className="text-[8px] text-slate-500">M1 4EN</div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-1">
          <Wrench size={9} color={BRAND_AMBER}/>
          <div className="text-[8px] text-slate-500">Plumber</div>
        </div>
        <div className="rounded py-1 text-center text-[8px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Search</div>
      </div>
    );
  }
  if (id.includes("search-autocomplete")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="flex h-6 items-center gap-1 rounded border border-slate-900 bg-white px-2">
          <Search size={9}/>
          <div className="text-[8px] font-semibold text-slate-900">plum</div>
          <div className="ml-0.5 h-2 w-0.5 animate-pulse bg-slate-900" />
        </div>
        <div className="flex flex-col gap-0.5 rounded border border-slate-200 bg-white p-1">
          {["plumber", "plumbing", "plumbers near me"].map((s) => (
            <div key={s} className="text-[8px] text-slate-700 hover:font-bold">{s}</div>
          ))}
        </div>
      </div>
    );
  }
  if (id.includes("search-ai")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="flex items-center gap-1 rounded-md p-1.5" style={{ background: `linear-gradient(90deg, ${BRAND_YELLOW}44, ${BRAND_YELLOW}11)` }}>
          <Sparkles size={10} color={BRAND_AMBER}/>
          <div className="text-[8px] font-semibold text-slate-900">Ask anything…</div>
        </div>
        <div className="rounded bg-slate-100 p-1 text-[7px] italic text-slate-600">
          "Boiler making banging noise — who fixes this?"
        </div>
      </div>
    );
  }
  // ─── Booking ─────────────────────────────────────────
  if (id.includes("booking-calendar")) {
    return (
      <div className="flex h-full flex-col gap-0.5 p-2">
        <div className="text-[7px] font-bold uppercase text-slate-500">March 2026</div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 21 }).map((_, i) => {
            const available = [3, 5, 8, 12, 15, 17, 20].includes(i);
            return (
              <div key={i} className="flex h-5 items-center justify-center rounded text-[7px] font-bold"
                style={{
                  backgroundColor: available ? BRAND_YELLOW : "#F1F5F9",
                  color: available ? BRAND_BLACK : "#94A3B8"
                }}>
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (id.includes("booking-slots")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        {[
          { period: "Morning", slots: ["9:00", "10:30"] },
          { period: "Afternoon", slots: ["1:00", "3:30"] },
          { period: "Evening", slots: ["6:00", "7:30"] }
        ].map((r) => (
          <div key={r.period}>
            <div className="text-[7px] font-bold uppercase text-slate-500">{r.period}</div>
            <div className="mt-0.5 flex gap-0.5">
              {r.slots.map((s) => (
                <div key={s} className="rounded border border-slate-300 px-1 py-0.5 text-[7px] font-bold">{s}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (id.includes("booking-quote")) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 p-2">
        <div className="flex items-center gap-0.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i === 2 ? BRAND_YELLOW : i < 2 ? BRAND_BLACK : "#E2E8F0" }}/>
          ))}
        </div>
        <div className="text-[8px] font-bold text-slate-900">Step 2 of 4</div>
        <div className="text-[7px] text-slate-500">What kind of job?</div>
        <div className="rounded py-1 text-center text-[8px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Continue</div>
      </div>
    );
  }
  // ─── Ecommerce ───────────────────────────────────────
  if (id.includes("ecom-variants")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="text-[8px] font-bold text-slate-900">Size</div>
        <div className="flex gap-0.5">
          {["S", "M", "L", "XL"].map((s, i) => (
            <div key={s} className={`flex h-4 w-5 items-center justify-center rounded border text-[8px] font-bold ${i === 1 ? "text-white" : "text-slate-700"}`}
              style={{ borderColor: i === 1 ? BRAND_BLACK : "#E2E8F0", backgroundColor: i === 1 ? BRAND_BLACK : "white" }}>{s}</div>
          ))}
        </div>
        <div className="text-[8px] font-bold text-slate-900">Colour</div>
        <div className="flex gap-0.5">
          {["#0A0A0A", "#FFB300", "#3B82F6", "#DC2626"].map((c) => (
            <div key={c} className="h-4 w-4 rounded-full" style={{ backgroundColor: c }}/>
          ))}
        </div>
      </div>
    );
  }
  if (id.includes("ecom-add-cart")) {
    return (
      <div className="flex h-full flex-col justify-end p-2">
        <div className="flex-1 rounded bg-slate-100"/>
        <div className="mt-1 flex items-center gap-1 rounded-md p-1.5" style={{ backgroundColor: BRAND_BLACK }}>
          <div className="text-[8px] font-bold text-white">£42.50</div>
          <div className="ml-auto rounded px-2 py-0.5 text-[8px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Add</div>
        </div>
      </div>
    );
  }
  if (id.includes("ecom-related")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="text-[8px] font-bold text-slate-900">You may also like</div>
        <div className="grid grid-cols-3 gap-1">
          {[1,2,3].map(i => (
            <div key={i} className="rounded border border-slate-200">
              <div className="flex h-8 items-center justify-center rounded-t bg-slate-100"><Camera size={8} className="text-slate-400"/></div>
              <div className="p-0.5 text-[7px] font-bold text-slate-900">£{i * 15}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // ─── Restaurant ──────────────────────────────────────
  if (id.includes("food-menu")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        {[
          { n: "Margherita", p: "£11", v: true },
          { n: "Salmon Bowl", p: "£13", v: false }
        ].map((m) => (
          <div key={m.n} className="flex items-center gap-1 rounded border border-slate-200 p-1">
            <div className="flex h-8 w-10 items-center justify-center rounded bg-slate-100"><Camera size={8} className="text-slate-400"/></div>
            <div className="flex-1">
              <div className="text-[8px] font-bold text-slate-900">{m.n}</div>
              {m.v && <div className="text-[6px] font-bold uppercase text-emerald-600">Vegan</div>}
            </div>
            <div className="text-[9px] font-bold text-slate-900">{m.p}</div>
          </div>
        ))}
      </div>
    );
  }
  if (id.includes("food-combos")) {
    return (
      <div className="flex h-full flex-col justify-center p-2">
        <div className="rounded-lg border-2 p-2" style={{ borderColor: BRAND_YELLOW, backgroundColor: "#FFFCF0" }}>
          <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_AMBER }}>Combo · Save £5</div>
          <div className="text-[9px] font-bold text-slate-900">2 for £18</div>
          <div className="text-[7px] text-slate-600">Any 2 pizzas · drinks included</div>
        </div>
      </div>
    );
  }
  // ─── Ride hailing ────────────────────────────────────
  if (id.includes("ride-pickup")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="flex items-center gap-1 rounded border border-slate-300 p-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>
          <div className="text-[8px] font-semibold text-slate-900">M1 4EN</div>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 p-1">
          <div className="h-1.5 w-1.5 rounded-sm bg-red-500"/>
          <div className="text-[8px] font-semibold text-slate-900">M4 3AA</div>
        </div>
        <div className="flex-1 rounded bg-slate-100"/>
      </div>
    );
  }
  if (id.includes("ride-driver")) {
    return (
      <div className="relative flex h-full flex-col p-2">
        <div className="flex-1 rounded bg-slate-100 relative overflow-hidden">
          {[
            { top: "20%", left: "30%" },
            { top: "50%", left: "60%" },
            { top: "70%", left: "20%" }
          ].map((s, i) => (
            <div key={i} className="absolute h-2 w-2 rounded-full" style={{ ...s, backgroundColor: BRAND_BLACK }}/>
          ))}
        </div>
        <div className="mt-1 rounded p-1" style={{ backgroundColor: BRAND_BLACK }}>
          <div className="text-[8px] font-bold text-white">Driver 2 min away</div>
        </div>
      </div>
    );
  }
  // ─── Auth ────────────────────────────────────────────
  if (id.includes("auth-login")) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 p-2">
        <div className="text-[9px] font-bold text-slate-900">Log in</div>
        <div className="h-4 rounded border border-slate-300 bg-white"/>
        <div className="h-4 rounded border border-slate-300 bg-white"/>
        <div className="rounded py-1 text-center text-[8px] font-bold" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>Sign in</div>
        <div className="text-center text-[7px] text-slate-500">or continue with</div>
        <div className="flex justify-center gap-1">
          {["G", "", "f"].map((s, i) => (
            <div key={i} className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[8px] font-bold">{s}</div>
          ))}
        </div>
      </div>
    );
  }
  if (id.includes("auth-otp")) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 p-2">
        <div className="text-center text-[8px] font-bold text-slate-900">Enter code</div>
        <div className="text-center text-[7px] text-slate-500">Sent to 07•••234</div>
        <div className="flex justify-center gap-0.5">
          {[8, 4, 2, "", "", ""].map((n, i) => (
            <div key={i} className="flex h-5 w-4 items-center justify-center rounded border-2 text-[9px] font-bold"
              style={{ borderColor: i < 3 ? BRAND_BLACK : "#E2E8F0" }}>{n}</div>
          ))}
        </div>
      </div>
    );
  }
  // ─── Chat ────────────────────────────────────────────
  if (id.includes("chat-live") || id.includes("chat-ai")) {
    const ai = id.includes("chat-ai");
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="max-w-[80%] rounded-lg rounded-bl-none bg-slate-100 p-1 text-[7px] text-slate-900">
          {ai ? "How can I help?" : "Hi, still available today?"}
        </div>
        <div className="ml-auto max-w-[80%] rounded-lg rounded-br-none p-1 text-[7px]" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
          {ai ? "Book a plumber for Wed AM" : "Yes — 3pm slot free"}
        </div>
        <div className="text-[6px] text-slate-400">{ai ? "AI · typing…" : "typing…"}</div>
      </div>
    );
  }
  // ─── Empty states ────────────────────────────────────
  if (id.includes("empty-orders")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-2">
        <Box size={24} className="text-slate-300"/>
        <div className="text-[9px] font-bold text-slate-900">No orders yet</div>
        <div className="rounded px-2 py-0.5 text-[7px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Browse</div>
      </div>
    );
  }
  if (id.includes("empty-messages")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-2">
        <MessageCircle size={24} className="text-slate-300"/>
        <div className="text-[9px] font-bold text-slate-900">No messages</div>
        <div className="text-[7px] text-slate-500">Start a conversation</div>
      </div>
    );
  }
  if (id.includes("empty-error")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-2">
        <div className="text-[20px] font-bold text-slate-300">404</div>
        <div className="text-[8px] font-bold text-slate-900">Not found</div>
        <div className="rounded px-2 py-0.5 text-[7px] font-bold" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>Retry</div>
      </div>
    );
  }
  // ─── Footer ──────────────────────────────────────────
  if (id.includes("footer-full")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="grid grid-cols-4 gap-1">
          {["About", "Legal", "Help", "Trust"].map((c) => (
            <div key={c} className="flex flex-col gap-0.5">
              <div className="text-[7px] font-bold uppercase text-white">{c}</div>
              <div className="h-1 w-full rounded bg-white/20"/>
              <div className="h-1 w-3/4 rounded bg-white/20"/>
            </div>
          ))}
        </div>
        <div className="mt-1 border-t border-white/10 pt-1 text-[7px] text-white/60">© 2026 · Manchester Plumbing</div>
      </div>
    );
  }
  if (id.includes("footer-minimal")) {
    return (
      <div className="flex h-full items-center gap-2 p-2" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="text-[8px] font-bold text-white">Brand</div>
        <div className="ml-auto flex gap-1">
          {[1,2,3].map(i => <div key={i} className="h-3 w-3 rounded-full bg-white/20"/>)}
        </div>
      </div>
    );
  }
  if (id.includes("footer-appstore")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-2" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="text-[8px] font-bold text-white">Get the app</div>
        <div className="flex gap-1">
          {["App Store", "Play Store"].map((s) => (
            <div key={s} className="rounded border border-white/30 bg-white/5 px-1.5 py-1 text-[6px] font-bold text-white">{s}</div>
          ))}
        </div>
      </div>
    );
  }
  // ─── Loyalty / Payments / Analytics / Blog ──────────
  if (id.includes("loyalty-points")) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 p-2">
        <div className="text-[7px] font-bold uppercase text-slate-500">Your points</div>
        <div className="text-[16px] font-bold" style={{ color: BRAND_AMBER }}>2,340</div>
        <div className="h-1 rounded-full bg-slate-100"><div className="h-full w-3/5 rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/></div>
        <div className="text-[7px] text-slate-500">660 to Silver</div>
      </div>
    );
  }
  if (id.includes("payments-row")) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 p-2">
        <div className="text-[8px] font-bold text-slate-900">Payment methods</div>
        <div className="flex flex-wrap gap-0.5">
          {["Visa", "MC", "Apple", "PayPal"].map((p) => (
            <div key={p} className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[7px] font-bold text-slate-700">{p}</div>
          ))}
        </div>
      </div>
    );
  }
  if (id.includes("analytics-kpi")) {
    return (
      <div className="grid h-full grid-cols-3 gap-1 p-2">
        {[
          { l: "REV", v: "£12.4k", t: "+18%" },
          { l: "USERS", v: "342", t: "+9%" },
          { l: "CONV", v: "6.8%", t: "-2%" }
        ].map((s) => (
          <div key={s.l} className="flex flex-col justify-center rounded border border-slate-200 p-1">
            <div className="text-[6px] font-bold uppercase text-slate-500">{s.l}</div>
            <div className="text-[10px] font-bold text-slate-900">{s.v}</div>
            <div className="text-[7px] font-bold" style={{ color: s.t.startsWith("+") ? "#10B981" : "#DC2626" }}>{s.t}</div>
          </div>
        ))}
      </div>
    );
  }
  if (id.includes("blog-featured")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="flex-1 rounded" style={{ background: `linear-gradient(135deg, ${BRAND_BLACK}, #475569)` }}/>
        <div className="text-[8px] font-bold text-slate-900">Boiler Winter Prep</div>
        <div className="grid grid-cols-2 gap-1">
          <div className="rounded bg-slate-100 p-1 text-[7px] font-bold text-slate-700">Solar 2026</div>
          <div className="rounded bg-slate-100 p-1 text-[7px] font-bold text-slate-700">EV Grants</div>
        </div>
      </div>
    );
  }
  // ─── Marquee / running text ──────────────────────────
  if (id.includes("marquee-single") || id.includes("ticker")) {
    return (
      <div className="flex h-full items-center overflow-hidden p-0" style={{ backgroundColor: BRAND_YELLOW }}>
        <div className="animate-[marquee_6s_linear_infinite] whitespace-nowrap text-[9px] font-bold" style={{ color: BRAND_BLACK }}>
          FREE CALLOUT · GAS SAFE · £5M PL · TODAY ONLY · FREE CALLOUT · GAS SAFE ·
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
      </div>
    );
  }
  if (id.includes("marquee-logos")) {
    return (
      <div className="flex h-full items-center overflow-hidden bg-slate-50">
        <div className="animate-[marquee_8s_linear_infinite] flex whitespace-nowrap gap-3 text-[8px] font-bold text-slate-600">
          {["GAS SAFE", "NICEIC", "CPCS", "TRUSTMARK", "FMB", "GAS SAFE", "NICEIC"].map((l, i) => (
            <span key={i} className="rounded bg-white px-1.5 py-0.5">{l}</span>
          ))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
      </div>
    );
  }
  // ─── Product category rail ──────────────────────────
  if (id.includes("product-category-rail")) {
    return (
      <div className="flex h-full items-center overflow-hidden bg-white p-2">
        <div className="flex gap-1 overflow-hidden">
          {[
            { I: Wrench, l: "Boilers" },
            { I: Shield, l: "Safety" },
            { I: Award, l: "Deals" }
          ].map(({ I, l }) => (
            <div key={l} className="flex flex-col items-center gap-0.5 rounded border border-slate-200 bg-slate-50 p-1">
              <I size={12} color={BRAND_AMBER} />
              <div className="text-[7px] font-bold text-slate-900">{l}</div>
            </div>
          ))}
          <div className="flex flex-col items-center gap-0.5 rounded border border-slate-200 bg-slate-50 p-1">
            <ChevronRight size={12} className="text-slate-500" />
            <div className="text-[7px] font-bold text-slate-500">More</div>
          </div>
        </div>
      </div>
    );
  }
  if (id.includes("product-grid-scroll")) {
    return (
      <div className="flex h-full items-center overflow-hidden bg-white p-2">
        <div className="flex gap-1 overflow-hidden">
          {[
            { r: "F045", p: "£4.85" },
            { r: "T1M", p: "£38" },
            { r: "PLB", p: "£29" }
          ].map((prod) => (
            <div key={prod.r} className="flex flex-col items-center gap-0.5 rounded border border-slate-200 p-1">
              <div className="flex h-8 w-10 items-center justify-center rounded bg-slate-100"><Camera size={10} className="text-slate-400"/></div>
              <div className="text-[7px] font-bold text-slate-900">Ref {prod.r}</div>
              <div className="text-[7px] text-slate-500">{prod.p}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // ─── Header variants ─────────────────────────────────
  if (id.includes("header-sticky")) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex items-center gap-1 border-b border-slate-200 px-1.5 py-1">
          <div className="h-4 w-4 rounded" style={{ backgroundColor: BRAND_BLACK }} />
          <div className="text-[8px] font-bold text-slate-900">Brand</div>
          <div className="ml-auto flex gap-1">
            {["Home", "Work", "About"].map((l) => (
              <span key={l} className="text-[7px] font-semibold text-slate-500">{l}</span>
            ))}
          </div>
          <div className="rounded px-1.5 py-0.5 text-[7px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>CTA</div>
        </div>
        <div className="flex-1 bg-slate-50" />
      </div>
    );
  }
  if (id.includes("header-transparent")) {
    return (
      <div className="flex h-full flex-col" style={{ background: `linear-gradient(180deg, ${BRAND_BLACK} 0%, #1F2937 100%)` }}>
        <div className="flex items-center gap-1 px-1.5 py-1">
          <div className="h-4 w-4 rounded" style={{ backgroundColor: BRAND_YELLOW }} />
          <div className="text-[8px] font-bold text-white">Brand</div>
          <div className="ml-auto flex gap-1">
            {["Home", "About"].map((l) => (
              <span key={l} className="text-[7px] font-semibold text-white/70">{l}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>Hero</div>
        </div>
      </div>
    );
  }
  if (id.includes("header-mega")) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex items-center border-b border-slate-200 px-1.5 py-1">
          <div className="text-[8px] font-bold text-slate-900">Brand</div>
          <div className="ml-1 text-[7px] font-semibold text-slate-900 underline">Services ▾</div>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1 border-b border-slate-200 bg-slate-50 p-1">
          {["Emerg.", "Boiler", "Bath", "Plumb.", "Solar", "EV"].map((l) => (
            <div key={l} className="text-[7px] font-semibold text-slate-700">{l}</div>
          ))}
        </div>
      </div>
    );
  }
  if (id.includes("header-floating")) {
    return (
      <div className="flex h-full flex-col bg-slate-100 p-1">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: BRAND_BLACK }} />
          <div className="ml-1 flex gap-1">
            {["Home", "Work", "About"].map((l) => (
              <span key={l} className="text-[7px] font-semibold text-slate-500">{l}</span>
            ))}
          </div>
          <div className="ml-auto rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Book</div>
        </div>
      </div>
    );
  }
  // ─── Carousels ───────────────────────────────────────
  if (id.includes("carousel-fade")) {
    return (
      <div className="relative h-full overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-400 to-slate-700" />
        <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1">
          {[1,2,3].map(i => <div key={i} className="h-1 w-1 rounded-full bg-white/80"/>)}
        </div>
      </div>
    );
  }
  if (id.includes("carousel-slide")) {
    return (
      <div className="relative h-full overflow-hidden bg-slate-100">
        <div className="flex h-full">
          <div className="w-full flex-shrink-0 bg-slate-300" />
          <div className="w-full flex-shrink-0 bg-slate-400" />
        </div>
        <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1">
          {[1,2,3,4].map(i => <div key={i} className={`h-1 rounded-full ${i === 1 ? "w-3 bg-slate-900" : "w-1 bg-slate-400"}`}/>)}
        </div>
      </div>
    );
  }
  if (id.includes("carousel-coverflow")) {
    return (
      <div className="flex h-full items-center justify-center gap-1 overflow-hidden bg-slate-100 p-2">
        <div className="h-16 w-8 rounded bg-slate-300 opacity-60" style={{ transform: "perspective(60px) rotateY(30deg)" }}/>
        <div className="h-20 w-14 rounded bg-slate-500 shadow-lg" />
        <div className="h-16 w-8 rounded bg-slate-300 opacity-60" style={{ transform: "perspective(60px) rotateY(-30deg)" }}/>
      </div>
    );
  }
  if (id.includes("carousel-zoom")) {
    return (
      <div className="relative h-full overflow-hidden bg-slate-500">
        <div className="absolute inset-0 flex items-center justify-center animate-[zoomKB_4s_ease-in-out_infinite]">
          <Camera size={20} className="text-white/50"/>
        </div>
        <style>{`@keyframes zoomKB { 0%,100% { transform: scale(1); } 50% { transform: scale(1.25); } }`}</style>
      </div>
    );
  }
  if (id.includes("gallery-lightbox")) {
    return (
      <div className="grid h-full grid-cols-3 grid-rows-2 gap-0.5 p-2">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="flex items-center justify-center rounded bg-slate-100"><Camera size={8} className="text-slate-400"/></div>
        ))}
      </div>
    );
  }
  if (id.includes("gallery-beforeafter")) {
    return (
      <div className="relative h-full overflow-hidden bg-white">
        <div className="absolute inset-0 flex">
          <div className="flex flex-1 items-center justify-center bg-slate-300">
            <div className="text-[8px] font-bold text-white">BEFORE</div>
          </div>
          <div className="flex flex-1 items-center justify-center bg-slate-700">
            <div className="text-[8px] font-bold text-white">AFTER</div>
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-0.5" style={{ backgroundColor: BRAND_YELLOW }}/>
      </div>
    );
  }
  // ─── Hero text-layout variants ────────────────────────
  if (id.includes("hero-text-left")) {
    return (
      <div className="grid h-full grid-cols-2 gap-1 p-2">
        <div className="flex flex-col justify-center">
          <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>Gas Safe</div>
          <div className="text-[10px] font-bold leading-tight text-slate-900">Emergency plumber</div>
          <div className="mt-1 rounded px-1.5 py-0.5 text-center text-[7px] font-bold w-fit" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Call</div>
        </div>
        <div className="flex items-center justify-center rounded bg-slate-200"><Camera size={14} className="text-slate-400"/></div>
      </div>
    );
  }
  if (id.includes("hero-text-center")) {
    return (
      <div className="relative flex h-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${BRAND_BLACK}, #1F2937)` }}>
        <div className="text-center">
          <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>Manchester</div>
          <div className="text-[10px] font-bold leading-tight text-white">Emergency plumber</div>
          <div className="mt-1 rounded px-1.5 py-0.5 text-center text-[7px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>Book Now</div>
        </div>
      </div>
    );
  }
  if (id.includes("hero-text-bottom")) {
    return (
      <div className="flex h-full flex-col justify-end p-2" style={{ background: `linear-gradient(135deg, ${BRAND_BLACK}, #4B5563)` }}>
        <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>Editorial</div>
        <div className="text-[10px] font-bold leading-tight text-white">Craft you can see.</div>
      </div>
    );
  }
  if (id.includes("hero-text-floating")) {
    return (
      <div className="relative flex h-full items-center justify-center" style={{ background: `linear-gradient(135deg, #94A3B8, #475569)` }}>
        <div className="rounded-md bg-white p-2 shadow-lg">
          <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>Premium</div>
          <div className="text-[9px] font-bold leading-tight text-slate-900">Bespoke kitchens</div>
        </div>
      </div>
    );
  }
  if (id.includes("hero-video-bg")) {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-600 to-slate-900" />
        <div className="relative z-10 text-center">
          <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>▶ VIDEO</div>
          <div className="text-[9px] font-bold leading-tight text-white">Watch us on site</div>
        </div>
      </div>
    );
  }

  if (key.includes("hero")) {
    return (
      <div
        className="flex h-full flex-col justify-end p-2 text-white"
        style={{ background: `linear-gradient(135deg, ${BRAND_BLACK} 0%, #1F2937 100%)` }}
      >
        <div className="text-[7px] font-bold uppercase" style={{ color: BRAND_YELLOW }}>
          GAS SAFE
        </div>
        <div className="text-[10px] font-bold leading-tight">Emergency plumber</div>
        <div className="mt-1 flex gap-1">
          <div className="rounded px-1.5 py-0.5 text-[7px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
            Call
          </div>
          <div className="rounded border border-white/40 bg-white/10 px-1.5 py-0.5 text-[7px] font-bold text-white">
            WhatsApp
          </div>
        </div>
      </div>
    );
  }
  if (key.includes("service")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="text-[9px] font-bold text-slate-900">Our services</div>
        {["Emergency", "Planned", "Servicing"].map((s) => (
          <div key={s} className="flex items-center justify-between rounded border border-slate-200 p-1">
            <div className="text-[8px] font-bold text-slate-900">{s}</div>
            <ChevronRight size={8} className="text-slate-400" />
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("testimonial") || key.includes("review")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="text-[9px] font-bold text-slate-900">Reviews</div>
        <div className="rounded border border-slate-200 p-1.5">
          <div className="mb-0.5 flex gap-0.5">
            {[1,2,3,4,5].map(i => <Star key={i} size={6} fill={BRAND_YELLOW} color={BRAND_YELLOW}/>)}
          </div>
          <div className="text-[7px] text-slate-700">"Turned up on time, sorted it in 20 min."</div>
          <div className="mt-0.5 text-[7px] font-bold text-slate-500">Sarah T. · Didsbury</div>
        </div>
      </div>
    );
  }
  if (key.includes("contact")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="text-[9px] font-bold text-slate-900">Get in touch</div>
        {[
          { I: Phone, label: "0161 555 0000" },
          { I: MessageCircle, label: "WhatsApp" },
          { I: Mail, label: "hello@…" }
        ].map(({ I, label }) => (
          <div key={label} className="flex items-center gap-1 rounded border border-slate-200 p-1">
            <I size={9} color={BRAND_AMBER} />
            <div className="text-[8px] font-bold text-slate-900">{label}</div>
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("faq")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="text-[9px] font-bold text-slate-900">FAQ</div>
        {["Callout fee?", "Gas Safe?", "Guarantee?"].map((q) => (
          <div key={q} className="flex items-center justify-between rounded border border-slate-200 p-1">
            <div className="text-[8px] font-bold text-slate-900">{q}</div>
            <ChevronRight size={8} className="text-slate-400" />
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("trust") || key.includes("badge") || key.includes("accredit")) {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-2">
        {[
          { I: Shield, label: "Gas Safe" },
          { I: Award, label: "£5m PL" },
          { I: Star, label: "4.9" },
          { I: MapPin, label: "M/cr" }
        ].map(({ I, label }) => (
          <div key={label} className="flex items-center gap-0.5 rounded border border-slate-200 p-1">
            <I size={8} color={BRAND_AMBER} />
            <div className="text-[8px] font-bold text-slate-700">{label}</div>
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("gallery") || key.includes("portfolio") || key.includes("project")) {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex items-center justify-center rounded bg-slate-100">
            <Camera size={12} className="text-slate-400"/>
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("cta")) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-2" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="text-[9px] font-bold text-white">Ready to book?</div>
        <div className="mt-1 rounded px-2 py-1 text-[8px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
          Get a Quote
        </div>
      </div>
    );
  }
  if (key.includes("pricing") || key.includes("price")) {
    return (
      <div className="grid h-full grid-cols-3 gap-1 p-2">
        {[
          { name: "Basic", price: "£85" },
          { name: "Std", price: "£195", pinned: true },
          { name: "Prem", price: "£395" }
        ].map((t) => (
          <div
            key={t.name}
            className="flex flex-col items-center justify-center rounded border-2 p-1"
            style={{ borderColor: t.pinned ? BRAND_YELLOW : "#E2E8F0", backgroundColor: t.pinned ? "#FFFCF0" : "white" }}
          >
            <div className="text-[7px] uppercase text-slate-500">{t.name}</div>
            <div className="text-[9px] font-bold text-slate-900">{t.price}</div>
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("statistic") || key.includes("stat")) {
    return (
      <div className="grid h-full grid-cols-3 gap-1 p-2">
        {[
          { v: "17+", l: "Years" },
          { v: "3.2K", l: "Jobs" },
          { v: "62%", l: "Repeat" }
        ].map((s) => (
          <div key={s.l} className="flex flex-col items-center justify-center rounded border border-slate-200 p-1">
            <div className="text-[12px] font-bold text-slate-900">{s.v}</div>
            <div className="text-[7px] uppercase text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("team") || key.includes("meet")) {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-2">
        {["JB", "SC", "MP", "TR"].map((initials) => (
          <div key={initials} className="flex items-center gap-1 rounded border border-slate-200 p-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: BRAND_BLACK }}>
              {initials}
            </div>
            <div className="text-[8px] font-bold text-slate-900">Team</div>
          </div>
        ))}
      </div>
    );
  }
  if (key.includes("newsletter") || key.includes("signup")) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 p-2">
        <div className="text-[9px] font-bold text-slate-900">Newsletter</div>
        <div className="h-5 rounded border border-slate-300 bg-white" />
        <div className="rounded py-1 text-center text-[8px] font-bold" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
          Subscribe
        </div>
      </div>
    );
  }
  if (key.includes("map") || key.includes("coverage") || key.includes("area")) {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="text-[9px] font-bold text-slate-900">Coverage</div>
        <div className="flex flex-wrap gap-0.5">
          {["Chorlton", "Didsbury", "Salford", "Trafford", "Sale", "Altrincham"].map((a) => (
            <span key={a} className="rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[7px] font-bold text-slate-700">
              {a}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (key.includes("footer")) {
    return (
      <div className="flex h-full flex-col justify-end p-2" style={{ backgroundColor: BRAND_BLACK }}>
        <div className="text-[8px] font-bold text-white">Manchester Plumbing</div>
        <div className="mt-0.5 text-[7px] text-slate-400">© 2026 · Gas Safe · £5m PL</div>
      </div>
    );
  }
  if (key.includes("banner") || key.includes("strip")) {
    return (
      <div className="flex h-full items-center justify-center p-2" style={{ backgroundColor: BRAND_YELLOW }}>
        <div className="text-[9px] font-bold" style={{ color: BRAND_BLACK }}>
          FREE CALLOUT · TODAY ONLY
        </div>
      </div>
    );
  }
  if (key.includes("product") || key.includes("shop")) {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-2">
        {[1,2,3,4].map((i) => (
          <div key={i} className="flex flex-col items-center justify-center rounded border border-slate-200 p-1">
            <Camera size={10} className="text-slate-400" />
            <div className="text-[7px] font-bold text-slate-900">Ref F{i}0{i}</div>
            <div className="text-[7px] text-slate-500">£{i * 12}.85</div>
          </div>
        ))}
      </div>
    );
  }
  // Fallback — labelled placeholder
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-2">
      <div className="text-center">
        <Box size={14} className="mx-auto text-slate-400" />
        <div className="mt-1 text-[9px] font-semibold text-slate-500">{item.name}</div>
      </div>
    </div>
  );
}

function ContainerSchematic({
  schematic
}: {
  schematic: NonNullable<CatalogItem["schematic"]>;
}): JSX.Element {
  return (
    <div
      className="grid gap-0.5 rounded bg-slate-200 p-1"
      style={{
        gridTemplateColumns: `repeat(${schematic.cols}, 1fr)`,
        gridTemplateRows: `repeat(${schematic.rows}, 12px)`
      }}
    >
      {schematic.grid.map((cell, i) => (
        <div
          key={i}
          className="rounded-[2px]"
          style={{
            backgroundColor: cell ? BRAND_BLACK : "transparent"
          }}
        />
      ))}
    </div>
  );
}
