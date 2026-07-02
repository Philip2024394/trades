"use client";

// StudioPackBrowser — Industry Pack browse surface.
//
// Fetches /api/platform/packs/list, filters by industry (defaults to
// the merchant's primary_trade, with a "See all industries" toggle),
// renders cards that install the whole pack in one click.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FrozenPackManifest } from "@/platform/packs/types";
import { PackCard, type PackInstallState } from "./PackCard";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

type ListItem = {
  manifest: FrozenPackManifest;
  installState: PackInstallState;
};

type ListResponse =
  | {
      ok: true;
      items: ListItem[];
      totalRegistered: number;
      facets: { industries: string[] };
    }
  | { ok: false; error: string };

export function StudioPackBrowser({
  brandName,
  merchantSlug,
  primaryTrade
}: {
  brandName: string;
  merchantSlug: string;
  primaryTrade: string;
}) {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [totalRegistered, setTotalRegistered] = useState<number>(0);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const res = await fetch("/api/platform/packs/list");
      const json = (await res.json()) as ListResponse;
      if (!json.ok) throw new Error(json.error);
      setItems(json.items);
      setIndustries(json.facets.industries);
      setTotalRegistered(json.totalRegistered);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(() => {
    if (!items) return [];
    if (showAll) return items;
    return items.filter(
      (i) =>
        i.manifest.industry === primaryTrade ||
        i.manifest.industry === "*"
    );
  }, [items, showAll, primaryTrade]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        {brandName} · Industry Packs
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Complete starter apps by industry
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        A Pack installs the Apps, brand tokens, and starter home layout
        that fit your trade. No blank canvas — you land on a
        professionally-configured app that just needs your logo,
        colours, and content.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Your industry: {primaryTrade}
        </p>
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-extrabold uppercase tracking-widest transition"
          style={{
            background: showAll ? BLACK : "transparent",
            color: showAll ? "#FFFFFF" : "#525252",
            borderColor: showAll ? BLACK : "#D4D4D4"
          }}
        >
          {showAll
            ? `Filtered to ${industries.length} industries`
            : "See all industries"}
        </button>
      </div>

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
          primaryTrade={primaryTrade}
          onShowAll={() => setShowAll(true)}
        />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {visible.map((item) => (
            <li key={item.manifest.slug}>
              <PackCard
                manifest={item.manifest}
                installState={item.installState}
                merchantSlug={merchantSlug}
                onChanged={() => void refresh()}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center">
      <p className="text-[14px] font-bold text-neutral-700">
        Industry Packs launching soon.
      </p>
      <p className="max-w-md text-[12px] leading-relaxed text-neutral-500">
        The first Packs — Plant Hire, Building Merchant, Plumber — go
        live once we finish converting our reference apps to the
        manifest system. Until then, browse the App Store to install
        Apps individually.
      </p>
      <Link
        href="/studio/apps"
        className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white"
        style={{ background: BLACK }}
      >
        Browse App Store →
      </Link>
    </div>
  );
}

function EmptyFiltered({
  primaryTrade,
  onShowAll
}: {
  primaryTrade: string;
  onShowAll: () => void;
}) {
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white p-12 text-center">
      <p className="text-[13px] font-bold text-neutral-600">
        No Packs specifically for &ldquo;{primaryTrade}&rdquo; yet.
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className="inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
        style={{ background: YELLOW }}
      >
        See all industries →
      </button>
    </div>
  );
}
