"use client";

// StudioPageClient — the client shell that renders a page's sections
// reactively inside the preview iframe.
//
// Responsibilities:
//   • Own the working layout state (starts from `initialLayout`).
//   • Subscribe to the parent bus for apply-layout / set-selected /
//     set-mode / set-tokens / set-hover / scroll-to messages.
//   • Emit `select` / `move` / `remove` back to the parent via
//     iframeEmit.
//   • Render each SectionInstance via its Section Registry renderer.
//   • Mount PageChromeClient when mode === "edit".
//
// All bus plumbing lives in @/lib/studio/bus. This file is only about
// layout, rendering, and connecting UI to the bus emitters.

import { useEffect, useState } from "react";
import { iframeEmit, useBusFromParent } from "@/lib/studio/bus";
import { pageRootAttrs } from "@/lib/studio/treeIds";
import { buildTreeSnapshot, scrollToTreeNode } from "@/lib/studio/treeSnapshot";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
// Side-effect import: registers every section into the registry.
import "@/lib/studio/sections";
import type {
  BrandTokens,
  MerchantData,
  SectionRenderMode
} from "@/lib/studio/sectionTypes";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import { PageChromeClient } from "./PageChromeClient";
import { useStudioAnalytics } from "@/lib/studio/analytics/useStudioAnalytics";
import {
  resolveExperiments,
  type ExperimentRow,
  type ResolvedExperiment
} from "@/lib/studio/experiments/bucketing";

export function StudioPageClient({
  initialLayout,
  initialSelected,
  initialMode,
  tokens: initialTokens,
  data,
  brandId = null,
  pageId = null
}: {
  initialLayout: StudioLayoutJson;
  initialSelected: string | null;
  initialMode: SectionRenderMode;
  tokens: BrandTokens;
  data: MerchantData;
  brandId?: string | null;
  pageId?: string | null;
}) {
  const [layout, setLayout] = useState<StudioLayoutJson>(initialLayout);
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [mode, setMode] = useState<SectionRenderMode>(initialMode);
  const [tokens, setTokens] = useState<BrandTokens>(initialTokens);
  const [breakpoint, setBreakpoint] = useState<
    "mobile" | "tablet" | "desktop"
  >("mobile");

  // Analytics beacon — customer-side telemetry. Only active in preview
  // mode; edit-mode noise (merchant clicking around) is muted so the
  // merchant's own poking never pollutes their real analytics.
  useStudioAnalytics({
    enabled: mode === "preview",
    brandId,
    pageId,
    layout
  });

  // Running A/B experiments — fetch once, bucket the visitor, apply the
  // matched variant's config overlay per section at render time. Edit
  // mode is intentionally muted so merchants always see their real
  // draft, never a random A/B branch.
  const experiments = useResolvedExperiments({
    enabled: mode === "preview",
    brandId,
    pageId
  });

  // ─── Parent → iframe bus ─────────────────────────────────────
  useBusFromParent((msg) => {
    switch (msg.type) {
      case "apply-layout":
        setLayout(msg.payload.layout);
        break;
      case "set-selected":
        setSelected(msg.payload.treeId);
        break;
      case "set-mode":
        setMode(msg.payload.mode);
        break;
      case "set-tokens":
        setTokens(msg.payload.tokens);
        break;
      case "set-hover":
        // Hover overlay lands in Module 1 — silently ignore for now.
        break;
      case "set-breakpoint":
        setBreakpoint(msg.payload.breakpoint);
        break;
      case "scroll-to":
        scrollToTreeNode(
          msg.payload.treeId,
          msg.payload.behavior ?? "smooth",
          msg.payload.block ?? "start"
        );
        break;
      case "swap-registration":
        setLayout((prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.instanceId === msg.payload.instanceId
              ? { ...s, key: msg.payload.nextRegistrationId }
              : s
          )
        }));
        break;
      case "request-tree": {
        // On-demand snapshot request from the Navigator. Build fresh
        // (DOM is already committed) and reply.
        const snapshot = buildTreeSnapshot();
        iframeEmit.tree(snapshot);
        break;
      }
      case "undo":
      case "redo":
        // Wired in Module 3.
        break;
      default:
        // Future message types — ignore gracefully so old iframes never
        // crash a new editor.
        break;
    }
  });

  // Announce ready + baseline capabilities exactly once.
  useEffect(() => {
    iframeEmit.ready([
      "layout",
      "selection",
      "chrome",
      "scroll-to",
      "hover",
      "tree"
    ]);
  }, []);

  // Emit tree snapshots to the parent editor:
  //   • Immediately on mount so the Navigator has data before the
  //     editor even requests it.
  //   • On every DOM structural change (childList mutations) — catches
  //     React-driven layout updates AND non-React changes (image
  //     lazy-loads adding wrapper divs, third-party scripts, browser
  //     accessibility injections, hot-reload swaps).
  //
  // Attribute mutations are filtered out on purpose: chrome writes
  // data-studio-selected on every selection change, and echoing that
  // through the observer would loop the whole system. Text content
  // changes (characterData) don't affect tree structure — skipped too.
  //
  // Debounced 150ms so a burst of mutations (e.g. React re-committing
  // 10 sections at once) collapses into one snapshot emit. Editor tab
  // shows the fresh tree within ~1 frame of the burst finishing.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root =
      document.querySelector<HTMLElement>('[data-tree-id="page"]') ??
      document.body;

    const emit = (reason: "manual" | "mutation") => {
      const snapshot = buildTreeSnapshot();
      iframeEmit.treeChanged(snapshot, reason);
    };

    // Initial snapshot — redundant with the request-tree reply, but
    // sending here first means the Navigator populates without waiting
    // for the editor's request round-trip.
    emit("manual");

    if (typeof MutationObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver((mutations) => {
      const structural = mutations.some(
        (m) =>
          m.type === "childList" &&
          (m.addedNodes.length > 0 || m.removedNodes.length > 0)
      );
      if (!structural) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        emit("mutation");
        timer = null;
      }, 150);
    });

    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div {...pageRootAttrs()}>
      {layout.rows.length === 0 ? (
        <EmptyPage />
      ) : (
        layout.rows.map((row) => (
          <RowRenderer
            key={row.id}
            row={row}
            layout={layout}
            tokens={tokens}
            data={data}
            mode={mode}
            breakpoint={breakpoint}
            experiments={experiments}
          />
        ))
      )}

      {mode === "edit" && (
        <PageChromeClient
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            iframeEmit.select(id);
          }}
          onMove={(instanceId, direction) =>
            iframeEmit.move(instanceId, direction)
          }
          onRemove={(instanceId) => iframeEmit.remove(instanceId)}
        />
      )}
    </div>
  );
}

// ─── A/B experiment resolver hook ────────────────────────────
//
// Fetches running experiments for the current page once, resolves the
// visitor's bucket per experiment, and returns a lookup keyed by
// instance_id so RowRenderer can overlay + decorate in O(1).
//
// The visitor id is the same one the analytics beacon uses (localStorage
// / crypto.randomUUID fallback) — bucketing and telemetry share the
// same identity, which is how per-variant CTR analysis works.
function useResolvedExperiments({
  enabled,
  brandId,
  pageId
}: {
  enabled: boolean;
  brandId: string | null;
  pageId: string | null;
}): Map<string, ResolvedExperiment> {
  const [map, setMap] = useState<Map<string, ResolvedExperiment>>(
    () => new Map()
  );

  useEffect(() => {
    if (!enabled || !brandId || !pageId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/studio/experiments/public?brandId=${encodeURIComponent(brandId)}&pageId=${encodeURIComponent(pageId)}`
        );
        const json = (await res.json()) as
          | { ok: true; experiments: ExperimentRow[] }
          | { ok: false };
        if (!res.ok || !json.ok) return;
        if (cancelled) return;
        const visitor = readVisitorId();
        const resolved = resolveExperiments(json.experiments, visitor);
        const next = new Map<string, ResolvedExperiment>();
        for (const r of resolved) next.set(r.instance_id, r);
        setMap(next);
      } catch {
        /* best-effort */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, brandId, pageId]);

  return map;
}

// Mirrors the beacon's visitor-id policy — same localStorage key so
// bucketing and telemetry share identity.
function readVisitorId(): string {
  const KEY = "studio_visitor_id";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

function RowRenderer({
  row,
  layout,
  tokens,
  data,
  mode,
  breakpoint,
  experiments
}: {
  row: StudioLayoutJson["rows"][number];
  layout: StudioLayoutJson;
  tokens: BrandTokens;
  data: MerchantData;
  mode: SectionRenderMode;
  breakpoint: "mobile" | "tablet" | "desktop";
  experiments: Map<string, ResolvedExperiment>;
}) {
  const cols = row.columns
    .map((instanceId) => layout.sections.find((s) => s.instanceId === instanceId))
    .filter((s): s is (typeof layout.sections)[number] => isDefined(s));

  if (cols.length === 0) return null;

  const gridCols =
    cols.length >= 3
      ? "grid-cols-1 lg:grid-cols-3"
      : cols.length === 2
        ? "grid-cols-1 lg:grid-cols-2"
        : "";

  return (
    <div className={gridCols ? `grid gap-0 ${gridCols}` : ""}>
      {cols.map((instance) => {
        // Module 9 Hide (global) — skip entirely in preview / published.
        // Module 12 hiddenOn (per breakpoint) — same treatment when
        // the current simulated device matches. Edit mode keeps the
        // section visible + dimmed so the merchant can un-hide.
        const hiddenGlobal = Boolean(instance.hidden);
        const hiddenAtBp = Boolean(instance.hiddenOn?.includes(breakpoint));
        const hidden = hiddenGlobal || hiddenAtBp;
        if (hidden && mode !== "edit") return null;

        const reg = sectionRegistry.get(instance.key);
        if (!reg) {
          return (
            <UnregisteredPlaceholder
              key={instance.instanceId}
              sectionKey={instance.key}
            />
          );
        }
        const Renderer = reg.renderer;
        // Per-instance token overrides (Module 6 typography modal
        // writes these) shadow the brand-scoped tokens. Renderers see
        // one merged map — no lookup fallthrough at render time.
        const effectiveTokens = instance.tokenOverrides
          ? { ...tokens, ...instance.tokenOverrides }
          : tokens;

        // A/B experiment overlay — if this instance has a running
        // experiment, spread the matched variant's config over the
        // live config. The beacon reads the decoration attrs to
        // attribute view / click / convert events to the right
        // bucket in the same request.
        const experiment = experiments.get(instance.instanceId);
        const effectiveConfig = experiment
          ? { ...instance.config, ...experiment.config_overlay }
          : instance.config;
        const rendered = (
          <div
            key={instance.instanceId}
            data-experiment-id={experiment?.id ?? undefined}
            data-variant-bucket={experiment?.variant_bucket ?? undefined}
          >
            <Renderer
              instanceId={instance.instanceId}
              config={effectiveConfig}
              tokens={effectiveTokens}
              data={data}
              mode={mode}
            />
          </div>
        );
        if (!hidden) return rendered;
        // Hidden in edit mode — wrap with dim + chip overlay explaining
        // WHY (global hide vs per-breakpoint hide on current device).
        const chipLabel = hiddenGlobal
          ? "Hidden everywhere"
          : `Hidden on ${breakpoint}`;
        return (
          <div key={instance.instanceId} className="relative" style={{ opacity: 0.35 }}>
            {rendered}
            <span
              className="pointer-events-none absolute right-3 top-3 z-40 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md"
              style={{ background: "#0A0A0A" }}
            >
              {chipLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function isDefined<T>(v: T | undefined): v is T {
  return Boolean(v);
}

function EmptyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Empty page
      </p>
      <h1 className="mt-2 text-3xl font-extrabold text-neutral-900">
        Start with a section
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
        Open the Templates library to add a hero, product grid or CTA.
        Everything on this page starts from a template.
      </p>
    </div>
  );
}

function UnregisteredPlaceholder({ sectionKey }: { sectionKey: string }) {
  return (
    <div className="mx-auto my-4 max-w-lg rounded-2xl border-2 border-dashed border-red-300 bg-red-50 p-4 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-500">
        Section not available
      </p>
      <p className="mt-1 text-[12px] text-red-700">
        <code className="font-mono">{sectionKey}</code>
      </p>
      <p className="mt-1 text-[11px] text-red-600">
        Ship the module that registers this section, or remove it from
        the layout.
      </p>
    </div>
  );
}
