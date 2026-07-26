"use client";

// Nex Staircase Configurator — demo shell for the StaircaseConfiguratorDrawer.
// Real integration wires the drawer's `onChange` into a 3D preview canvas +
// backend catalogue. This page proves the drawer works standalone and shows
// current selection state so Philip can validate UX before we hook it in.

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, LayoutGrid, Share2 } from "lucide-react";
import {
  StaircaseConfiguratorDrawer,
  SAMPLE_STAIRCASE_CATEGORIES,
} from "@/components/nex-app/staircase-configurator/StaircaseConfiguratorDrawer";
import { StaircaseConfiguratorChat } from "@/components/nex-app/staircase-configurator/StaircaseConfiguratorChat";
import {
  StaircaseDesignSheet,
  SAMPLE_NEX_DESIGNS,
  type StaircaseDesign,
} from "@/components/nex-app/staircase-configurator/StaircaseDesignSheet";
import {
  StaircasePreviewFrame,
  type StaircasePreviewHandle,
} from "@/components/nex-app/staircase-configurator/StaircasePreviewFrame";
import { useSavedDesigns } from "@/components/nex-app/staircase-configurator/useSavedDesigns";

const DEFAULT_SELECTION: Record<string, string> = {
  layout:    "straight",
  strings:   "housed-closed",
  steps:     "oak-40",
  risers:    "matching",
  newels:    "square-90",
  handrails: "profile-41",
  balusters: "oak-chamfered",
  sheeting:  "tg",
  lighting:  "off",
  finish:    "varnish-clear",
};

/** Read config from URL query params, filtering out anything that isn't a
 *  known category → option pair. Ensures pasted / edited URLs can't inject
 *  arbitrary strings into state. */
function readConfigFromUrl(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_SELECTION;
  const params = new URLSearchParams(window.location.search);
  const config: Record<string, string> = { ...DEFAULT_SELECTION };
  for (const cat of SAMPLE_STAIRCASE_CATEGORIES) {
    const v = params.get(cat.id);
    if (v && cat.options.some((o) => o.id === v)) config[cat.id] = v;
  }
  return config;
}

/** Push the current config into the URL query string. Uses replaceState so
 *  the browser back button doesn't fill up with every option change. */
function writeConfigToUrl(config: Record<string, string>) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(config)) {
    // Skip defaults to keep the URL short. A missing param falls back to default.
    if (DEFAULT_SELECTION[k] !== v) params.set(k, v);
  }
  const query = params.toString();
  const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", next);
}

export default function StaircaseConfiguratorPage() {
  const [open, setOpen] = useState(false);
  const [designsOpen, setDesignsOpen] = useState(false);
  const [selected, setSelected] = useState(DEFAULT_SELECTION);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const { designs: savedDesigns, saveDesign, deleteDesign, renameDesign } = useSavedDesigns();
  const previewRef = useRef<StaircasePreviewHandle | null>(null);

  // Hydrate from URL on mount so a shared link loads the same configuration
  // the sender was looking at. Runs once — server-side always renders defaults.
  useEffect(() => {
    setSelected(readConfigFromUrl());
  }, []);

  // Reflect the current config in the URL so the address bar is always a
  // shareable link. Skip the very first render (before URL hydration ran).
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    writeConfigToUrl(selected);
  }, [selected]);

  const setValue = (categoryId: string, optionId: string) =>
    setSelected((prev) => ({ ...prev, [categoryId]: optionId }));

  const applyBulkChanges = (changes: { categoryId: string; optionId: string }[]) =>
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of changes) next[c.categoryId] = c.optionId;
      return next;
    });

  const applyDesign = (d: StaircaseDesign) =>
    setSelected((prev) => ({ ...prev, ...d.config }));

  const handleSaveDesign = async () => {
    const name =
      typeof window !== "undefined"
        ? window.prompt("Name this design", `My design ${savedDesigns.length + 1}`)?.trim()
        : undefined;
    if (name === undefined || name === "") {
      // User cancelled prompt (undefined) or supplied empty string — bail out
      // rather than saving an anonymous entry that clutters the list.
      if (name === "") window.alert("Design not saved — a name is required.");
      return;
    }
    // Snapshot the current 3D canvas before saving so the design card in the
    // sheet shows what the user actually configured. Fire-and-continue: if the
    // capture fails / times out (2.5s), the design still saves without a thumb.
    const thumbnailUrl = (await previewRef.current?.captureThumbnail()) ?? undefined;
    saveDesign(selected, name, undefined, thumbnailUrl);
    setDesignsOpen(true); // reveal the saved design in the sheet
  };

  const handleRenameSaved = (id: string) => {
    const current = savedDesigns.find((d) => d.id === id);
    const nextName = window.prompt("Rename this design", current?.name ?? "")?.trim();
    if (!nextName) return;
    renameDesign(id, nextName);
  };
  const handleDeleteSaved = (id: string) => {
    const current = savedDesigns.find((d) => d.id === id);
    if (!window.confirm(`Delete "${current?.name ?? "this design"}"?`)) return;
    deleteDesign(id);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    // Always compute a fresh URL — writeConfigToUrl may not have run yet on a
    // brand-new render, and the address bar reflects the last committed change.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(selected)) {
      if (DEFAULT_SELECTION[k] !== v) params.set(k, v);
    }
    const query = params.toString();
    const url = query
      ? `${window.location.origin}${window.location.pathname}?${query}`
      : `${window.location.origin}${window.location.pathname}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 1600);
    } catch {
      // Clipboard blocked (permission / http) — fall back to prompt so the
      // user can copy manually.
      window.prompt("Copy this design link", url);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <p className="text-eyebrow uppercase text-muted-foreground">Nex · Staircase</p>
        <h1 className="text-display-sm font-heading mt-1">Configurator</h1>
        <p className="text-body-md text-muted-foreground mt-2 max-w-2xl">
          Drawer + design sheet + Ask Nex chat all drive the live 3D preview below.
          Balusters, sheeting, lighting, and finish (varnish) sync in real time via
          postMessage — no reload. Other categories drive state but don't yet change
          the visual (geometry engine coverage pending).
        </p>

        <div className="mt-6 relative">
          <StaircasePreviewFrame ref={previewRef} config={selected} />

          {/* Floating action buttons — top-right corner of the preview.
              Always visible while the user orbits, glassy pill shape so the 3D
              scene remains the visual hero. Mirror the drawer + design-sheet
              buttons; on desktop they float alongside the preview instead of
              sitting in a separate row below. */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2">
            {/* Primary CTA — opens the side drawer of every customisable
                component. Orange fill so it's unmissable against the 3D scene. */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open configurator"
              className="inline-flex items-center gap-2 h-12 px-5 rounded-full bg-primary text-primary-foreground shadow-xl text-body-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span>Configure</span>
            </button>
            {/* Secondary — Nex Designs / saved designs bottom sheet. */}
            <button
              type="button"
              onClick={() => setDesignsOpen(true)}
              aria-label="Browse designs"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-card text-foreground border border-border shadow-lg text-body-sm font-medium hover:bg-muted transition-colors"
            >
              <LayoutGrid className="w-5 h-5" />
              <span>Designs</span>
            </button>
            {/* Share — copies a URL-encoded snapshot of the current config to
                the clipboard. Recipient opens the link and sees the same
                configured staircase. */}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share this design"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-card text-foreground border border-border shadow-lg text-body-sm font-medium hover:bg-muted transition-colors"
            >
              <Share2 className="w-5 h-5" />
              <span>{shareStatus === "copied" ? "Copied!" : "Share"}</span>
            </button>
          </div>

          {/* Chat overlaid at the bottom of the 3D preview — replaces the
              "DRAG to orbit / SCROLL to zoom" hint that only serves power users.
              Non-tech users describe what they want and Nex updates the config. */}
          <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 pointer-events-none">
            <div className="pointer-events-auto">
              <StaircaseConfiguratorChat
                categories={SAMPLE_STAIRCASE_CATEGORIES}
                currentConfig={selected}
                onApplyChanges={applyBulkChanges}
              />
            </div>
          </div>
        </div>

        <p className="text-caption text-muted-foreground mt-3">
          Try in the chat above: "make the balusters cream" · "add LED lighting" · "no sheeting"
        </p>

        <section className="mt-10">
          <h2 className="text-heading-sm font-heading">Current selection</h2>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-body-sm">
            {SAMPLE_STAIRCASE_CATEGORIES.map((cat) => {
              const chosen = cat.options.find((o) => o.id === selected[cat.id]);
              return (
                <li
                  key={cat.id}
                  className="flex items-center justify-between border-b border-border py-2"
                >
                  <span className="text-muted-foreground">{cat.label}</span>
                  <span className="font-medium truncate ml-3">
                    {chosen?.label ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <StaircaseConfiguratorDrawer
        open={open}
        onOpenChange={setOpen}
        categories={SAMPLE_STAIRCASE_CATEGORIES}
        selected={selected}
        onChange={setValue}
        onSaveDesign={handleSaveDesign}
        onReset={() => setSelected(DEFAULT_SELECTION)}
      />

      <StaircaseDesignSheet
        open={designsOpen}
        onOpenChange={setDesignsOpen}
        designs={[...savedDesigns, ...SAMPLE_NEX_DESIGNS]}
        currentConfig={selected}
        onApplyDesign={applyDesign}
        onRenameSavedDesign={handleRenameSaved}
        onDeleteSavedDesign={handleDeleteSaved}
      />
    </main>
  );
}
