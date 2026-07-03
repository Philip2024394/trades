"use client";

// StudioAppStore — the browse surface.
//
// Reads /api/platform/apps/list on mount, renders a filterable grid of
// AppStoreCards. Filters (category tabs, installed toggle) are client-
// side against the loaded list — the API only re-runs when the
// merchant explicitly changes a facet.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FrozenAppManifest } from "@/platform/manifest/types";
import type { EligibilityDecision } from "@/platform/appEligibility";
import { AppStoreCard, type InstallState, type Readiness } from "./AppStoreCard";
import { useNotify } from "./Toaster";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

type ListItem = {
  manifest: FrozenAppManifest;
  installState: InstallState;
  eligibility: EligibilityDecision;
};

type ListResponse =
  | {
      ok: true;
      items: ListItem[];
      totalRegistered: number;
      facets: { categories: string[] };
    }
  | { ok: false; error: string };

type Tab = "browse" | "installed";

export function StudioAppStore({
  brandName,
  merchantSlug
}: {
  brandName: string;
  merchantSlug: string;
}) {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalRegistered, setTotalRegistered] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [error, setError] = useState<string | null>(null);
  const notify = useNotify();

  async function refresh() {
    setError(null);
    try {
      const res = await fetch("/api/platform/apps/list");
      const json = (await res.json()) as ListResponse;
      if (!json.ok) throw new Error(json.error);
      setItems(json.items);
      setCategories(json.facets.categories);
      setTotalRegistered(json.totalRegistered);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }

  // Optimistic reflection: flip the local item's installState the
  // instant the modal confirms a mutation. Removes the "did that
  // work?" gap between mutation success and refresh() completing.
  // Server refresh still runs to reconcile version + installed_at.
  function applyOptimistic(slug: string, kind: "installed" | "uninstalled") {
    setItems((prev) => {
      if (!prev) return prev;
      return prev.map((item) => {
        if (item.manifest.slug !== slug) return item;
        if (kind === "installed") {
          return {
            ...item,
            installState: {
              kind: "installed",
              version: item.manifest.version,
              installedAt: new Date().toISOString()
            }
          };
        }
        return {
          ...item,
          installState: {
            kind: "previously-installed",
            version:
              item.installState.kind === "installed"
                ? item.installState.version
                : item.manifest.version,
            uninstalledAt: new Date().toISOString()
          }
        };
      });
    });
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(() => {
    if (!items) return [];
    let out = items;
    if (tab === "installed") {
      out = out.filter((i) => i.installState.kind === "installed");
    }
    if (activeCategory) {
      out = out.filter((i) => i.manifest.category === activeCategory);
    }
    return out;
  }, [items, activeCategory, tab]);

  const installedCount = useMemo(
    () =>
      items?.filter((i) => i.installState.kind === "installed").length ?? 0,
    [items]
  );

  // Lookup used by every card to derive pre-flight readiness — missing
  // dependencies, active conflicts. Cheaper to compute once than per
  // card render.
  const installedSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const i of items ?? []) {
      if (i.installState.kind === "installed") set.add(i.manifest.slug);
    }
    return set;
  }, [items]);

  const nameLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items ?? []) m.set(i.manifest.slug, i.manifest.name);
    return m;
  }, [items]);

  function readinessFor(manifest: FrozenAppManifest): Readiness {
    const missingDeps = manifest.requirements.dependencies.filter(
      (slug) => !installedSlugs.has(slug)
    );
    const activeConflicts = manifest.requirements.conflicts.filter((slug) =>
      installedSlugs.has(slug)
    );
    if (activeConflicts.length > 0) {
      return {
        kind: "blocked-conflict",
        conflicts: activeConflicts.map((s) => ({
          slug: s,
          name: nameLookup.get(s) ?? s
        }))
      };
    }
    if (missingDeps.length > 0) {
      return {
        kind: "needs-prerequisites",
        missing: missingDeps.map((s) => ({
          slug: s,
          name: nameLookup.get(s) ?? s
        }))
      };
    }
    return { kind: "ready" };
  }

  // Chain-install a prerequisite: user hits the "Install X first" chip on
  // a card, we install the dep + refresh + toast so they can see progress.
  async function installPrerequisite(slug: string) {
    const name = nameLookup.get(slug) ?? slug;
    notify.info({ title: `Installing ${name}…` });
    try {
      const res = await fetch("/api/platform/apps/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      });
      const json = (await res.json()) as
        | { ok: true }
        | { ok: false; error: { code: string; reason?: string } };
      if (!json.ok) {
        notify.error({
          title: `Couldn't install ${name}`,
          detail: json.error.reason ?? json.error.code
        });
        return;
      }
      notify.success({
        title: `${name} installed`,
        detail: "You can now install anything that depends on it."
      });
      applyOptimistic(slug, "installed");
      void refresh();
    } catch (err) {
      notify.error({
        title: `Couldn't install ${name}`,
        detail: (err as Error).message ?? "Network error"
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        {brandName} · App Store
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Install Apps for your business
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Every visual feature on your app comes from here. Meet the Team,
        Newsletter, Trade Circle, Delivery Zones, Video Centre — pick what
        fits, install, tweak the appearance in Studio, and publish. Uninstalling
        preserves your content so you can bring an App back any time.
      </p>

      {/* Tabs */}
      <div className="mt-8 flex items-center gap-4 border-b border-neutral-200 pb-1">
        <TabButton
          active={tab === "browse"}
          onClick={() => setTab("browse")}
          label="Browse"
          count={totalRegistered}
        />
        <TabButton
          active={tab === "installed"}
          onClick={() => setTab("installed")}
          label="Installed"
          count={installedCount}
        />
      </div>

      {/* Category filter — only in browse tab */}
      {tab === "browse" && categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <CategoryPill
            label="All"
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c}
              label={c[0].toUpperCase() + c.slice(1)}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}
        >
          {error}
        </p>
      )}

      {items === null ? (
        <p className="mt-12 text-center text-[13px] text-neutral-500">
          Loading…
        </p>
      ) : totalRegistered === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <EmptyFiltered
          tab={tab}
          category={activeCategory}
          onReset={() => {
            setActiveCategory(null);
            setTab("browse");
          }}
        />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.manifest.slug}>
              <AppStoreCard
                manifest={item.manifest}
                installState={item.installState}
                eligibility={item.eligibility}
                readiness={readinessFor(item.manifest)}
                merchantSlug={merchantSlug}
                onChanged={() => void refresh()}
                onOptimistic={applyOptimistic}
                onInstallPrerequisite={installPrerequisite}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex items-center gap-2 pb-2 text-[12px] font-extrabold uppercase tracking-widest transition"
      style={{
        color: active ? BLACK : "#737373"
      }}
    >
      <span>{label}</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px]"
        style={{
          background: active ? BLACK : "#E5E5E5",
          color: active ? "#FFFFFF" : "#525252"
        }}
      >
        {count}
      </span>
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
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest transition"
      style={{
        background: active ? BLACK : "transparent",
        color: active ? "#FFFFFF" : "#525252",
        borderColor: active ? BLACK : "#D4D4D4"
      }}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center">
      <p className="text-[14px] font-bold text-neutral-700">
        First-party Apps launching soon.
      </p>
      <p className="max-w-md text-[12px] leading-relaxed text-neutral-500">
        We&rsquo;re migrating every visual feature into installable Apps.
        Meet the Team, Newsletter, Trade Circle and Trade Connections are
        first out of the gate. Check back next release.
      </p>
      <Link
        href="/studio/home"
        className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white"
        style={{ background: BLACK }}
      >
        Back to Studio →
      </Link>
    </div>
  );
}

function EmptyFiltered({
  tab,
  category,
  onReset
}: {
  tab: Tab;
  category: string | null;
  onReset: () => void;
}) {
  const msg =
    tab === "installed"
      ? "You haven't installed any Apps yet."
      : category
        ? `No Apps in "${category}" match this filter.`
        : "No Apps match this filter.";
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white p-12 text-center">
      <p className="text-[13px] font-bold text-neutral-600">{msg}</p>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
        style={{ background: YELLOW }}
      >
        Reset filters
      </button>
    </div>
  );
}
