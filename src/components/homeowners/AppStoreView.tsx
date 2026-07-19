"use client";

// AppStoreView — reusable App Store grid.
//
// Rendered by:
//   • /sitebook/apps (standalone page — full-width surface)
//   • /sitebook?view=apps (inline feed-area takeover)
//   • /sitebook-showcase/the-old-rectory?view=apps (mock preview)
//
// All manifest metadata comes from the registry — never hard-code an
// app name or icon here.

import * as LucideIcons from "lucide-react";
import { LayoutGrid } from "lucide-react";
import type {
  SiteBookAppCategory,
  SiteBookAppManifest,
  SiteBookAppSlug
} from "@/apps/sitebook/_shared/manifest";
import { formatCost } from "@/apps/sitebook/_shared/manifest";
import { AppInstallButton } from "./AppInstallButton";

const BRAND_YELLOW = "#FFB300";

const CATEGORY_LABEL: Record<SiteBookAppCategory, string> = {
  essential:   "Essentials",
  money:       "Money",
  quality:     "Quality",
  maintenance: "Maintenance",
  reports:     "Reports"
};

const CATEGORY_ORDER: SiteBookAppCategory[] =
  ["essential", "money", "quality", "maintenance", "reports"];

export function AppStoreView({
  apps,
  installedSlugs,
  demoMode = false
}: {
  apps:           SiteBookAppManifest[];
  installedSlugs: SiteBookAppSlug[];
  /** Disables install button (fires a friendly error via a stub). */
  demoMode?:      boolean;
}) {
  const installed = new Set(installedSlugs);
  const byCategory = new Map<SiteBookAppCategory, SiteBookAppManifest[]>();
  for (const a of apps) {
    const arr = byCategory.get(a.category) ?? [];
    arr.push(a);
    byCategory.set(a.category, arr);
  }

  return (
    <section>
      {/* Header — matches the FullGalleryView / CostLedgerView shell so
          the three feed-area takeovers feel like siblings. */}
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900">
          <LayoutGrid size={20} strokeWidth={2.4} style={{ color: BRAND_YELLOW }}/>
          App Store
          <span className="ml-1 text-[13px] font-bold text-neutral-500 tabular-nums">
            {installed.size} / {apps.length}
          </span>
        </h1>
      </div>
      <p className="mt-1 text-[12.5px] text-neutral-600">
        Build your SiteBook to suit how you work. Every app is free or clears its own cost. Install what you need, ignore the rest.
      </p>

      {apps.length === 0 ? (
        <div className="mt-5 rounded-2xl border-2 border-dashed bg-white p-8 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="text-[14px] font-black text-neutral-900">No apps registered yet</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
            Add a manifest to <code>src/apps/sitebook/registry.ts</code> and it will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const rows = byCategory.get(cat);
            if (!rows || rows.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-2 text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {rows.map((app) => (
                    <AppCard
                      key={app.slug}
                      app={app}
                      installed={installed.has(app.slug)}
                      demoMode={demoMode}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AppCard({
  app, installed, demoMode
}: {
  app:       SiteBookAppManifest;
  installed: boolean;
  demoMode:  boolean;
}) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; color?: string }>>)[app.icon]
    ?? LucideIcons.Sparkles;

  return (
    <article
      className="flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: app.brandColour ? `${app.brandColour}22` : "rgba(255,179,0,0.15)", color: app.brandColour ?? "#B45309" }}
        >
          <Icon size={20} strokeWidth={2.3}/>
        </span>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-700">
            {formatCost(app.cost)}
          </span>
          {app.defaultInstalled && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#166534" }}>
              Default
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex-1">
        <p className="text-[14px] font-black text-neutral-900">{app.name}</p>
        <p className="mt-1 text-[12px] leading-snug text-neutral-600">{app.description}</p>
        {app.badges && app.badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {app.badges.map((b) => (
              <span key={b} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-700">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
        {demoMode ? (
          <span className="text-[10.5px] font-bold text-neutral-500">Preview</span>
        ) : <span/>}
        <AppInstallButton slug={app.slug} installed={installed} demoMode={demoMode}/>
      </div>
    </article>
  );
}
