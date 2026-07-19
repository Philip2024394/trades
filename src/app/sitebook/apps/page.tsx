// /sitebook/apps — the SiteBook App Store.
//
// Grid of every registered SiteBook app. Homeowner-scoped install
// state; install/uninstall via /api/homeowner/apps/[slug].
//
// Reads solely from the registry — never hard-code app info here.
// Adding a new app to src/apps/sitebook/registry.ts surfaces it on
// this page automatically.

import Link from "next/link";
import * as LucideIcons from "lucide-react";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { redirect } from "next/navigation";
import { allApps, type SITEBOOK_APPS } from "@/apps/sitebook/registry";
import { loadInstalledAppSlugs } from "@/lib/homeowners/apps";
import { formatCost, type SiteBookAppCategory, type SiteBookAppManifest } from "@/apps/sitebook/_shared/manifest";
import { AppInstallButton } from "@/components/homeowners/AppInstallButton";

export const dynamic = "force-dynamic";

// Silence: lint prefers named imports get used
void ({} as typeof SITEBOOK_APPS);

const BRAND_YELLOW = "#FFB300";

const CATEGORY_LABEL: Record<SiteBookAppCategory, string> = {
  essential:   "Essentials",
  money:       "Money",
  quality:     "Quality",
  maintenance: "Maintenance",
  reports:     "Reports"
};

export default async function SiteBookAppStorePage() {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) redirect("/homeowners/sign-in?next=/sitebook/apps");

  const installed = await loadInstalledAppSlugs(homeowner.id);
  const apps = allApps();

  // Bucket by category, preserve registry order within each bucket
  const byCategory = new Map<SiteBookAppCategory, SiteBookAppManifest[]>();
  for (const a of apps) {
    const arr = byCategory.get(a.category) ?? [];
    arr.push(a);
    byCategory.set(a.category, arr);
  }

  const CATEGORY_ORDER: SiteBookAppCategory[] =
    ["essential", "money", "quality", "maintenance", "reports"];

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Back link + title */}
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <Link
              href="/sitebook"
              className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-600 hover:text-neutral-900"
            >
              <ArrowLeft size={11} strokeWidth={2.5}/> Back to SiteBook
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-[26px] font-black leading-tight text-neutral-900">
              <LayoutGrid size={22} strokeWidth={2.4} style={{ color: BRAND_YELLOW }}/>
              App Store
            </h1>
            <p className="mt-1 text-[13px] text-neutral-600">
              Build your SiteBook to suit how you work. Every app is free or clears its own cost — install what you need, ignore the rest.
            </p>
          </div>
          <div className="rounded-full border-2 border-neutral-200 bg-white px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-700">
            {installed.size} installed / {apps.length} available
          </div>
        </div>

        {/* Category sections */}
        <div className="space-y-8">
          {CATEGORY_ORDER.map((cat) => {
            const rows = byCategory.get(cat);
            if (!rows || rows.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-3 text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((app) => (
                    <AppCard
                      key={app.slug}
                      app={app}
                      installed={installed.has(app.slug)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Empty-state — no apps registered yet (dev-time only) */}
        {apps.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed bg-white p-8 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[14px] font-black text-neutral-900">No apps registered yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
              Add a manifest to <code>src/apps/sitebook/registry.ts</code> and it will appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function AppCard({ app, installed }: { app: SiteBookAppManifest; installed: boolean }) {
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

      <div className="mt-3 flex items-center justify-end border-t border-neutral-100 pt-3">
        <AppInstallButton slug={app.slug} installed={installed}/>
      </div>
    </article>
  );
}
