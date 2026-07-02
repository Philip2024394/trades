"use client";

// PackDetailPanel — /studio/packs/[slug] shareable detail view.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FrozenPackManifest } from "@/platform/packs/types";
import type { FrozenAppManifest } from "@/platform/manifest/types";
import type { InstalledPackRow } from "@/platform/runtime";
import { PackInstallProgressModal } from "./PackInstallProgressModal";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const NEUTRAL = "#404040";

type DetailResponse =
  | {
      ok: true;
      manifest: FrozenPackManifest;
      install: InstalledPackRow | null;
      apps: { slug: string; manifest: FrozenAppManifest | null }[];
    }
  | { ok: false; error: string };

export function PackDetailPanel({
  slug,
  merchantSlug: _merchantSlug
}: {
  slug: string;
  merchantSlug: string;
}) {
  const [state, setState] = useState<DetailResponse | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

  async function refresh() {
    try {
      const res = await fetch(`/api/platform/packs/${slug}`);
      const json = (await res.json()) as DetailResponse;
      setState(json);
    } catch (err) {
      setState({ ok: false, error: (err as Error).message ?? "network" });
    }
  }

  useEffect(() => {
    void refresh();
  }, [slug]);

  if (!state) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-[13px] text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (!state.ok) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p
          role="alert"
          className="rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}
        >
          {state.error}
        </p>
        <Link
          href="/studio/packs"
          className="mt-4 inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
        >
          ← Back to Industry Packs
        </Link>
      </div>
    );
  }

  const { manifest, install, apps } = state;
  const isInstalled = !!install && !install.uninstalled_at;
  const wasInstalled = !!install && !!install.uninstalled_at;
  const availableAppsCount = apps.filter((a) => a.manifest).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <Link
        href="/studio/packs"
        className="inline-flex items-center text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:text-neutral-900"
      >
        ← Industry Packs
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl text-6xl"
          style={{ background: "linear-gradient(135deg, #0A0A0A 0%, #262626 100%)" }}
        >
          {manifest.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {manifest.industry === "*" ? "Any industry" : manifest.industry} Pack
          </p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight text-neutral-900">
            {manifest.name}
          </h1>
          <p className="mt-1 text-[13px] font-bold text-neutral-500">
            {manifest.tagline}
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            v{manifest.version} · {manifest.publisher.name}
            {manifest.publisher.verified && (
              <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
                Verified publisher
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:min-w-[200px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {manifest.packStore.priceLabel}
          </p>
          {isInstalled ? (
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
              style={{ background: GREEN }}
            >
              Manage
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
              style={{ background: YELLOW }}
            >
              {wasInstalled ? "Reinstall pack" : "Install pack"}
            </button>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          About
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-700">
          {manifest.description}
        </p>
      </section>

      {manifest.packStore.benefits.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Benefits
          </h2>
          <ul className="mt-2 space-y-2">
            {manifest.packStore.benefits.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-neutral-800"
              >
                <span style={{ color: GREEN }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Apps in this pack ({availableAppsCount} of {apps.length} available)
        </h2>
        <ul className="mt-3 space-y-2">
          {apps.map(({ slug: appSlug, manifest: appManifest }) => (
            <li
              key={appSlug}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                style={{
                  background: appManifest ? YELLOW : "#F5F5F5",
                  color: appManifest ? BLACK : NEUTRAL
                }}
              >
                {appManifest ? appManifest.icon : "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold text-neutral-900">
                  {appManifest ? appManifest.name : appSlug}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {appManifest
                    ? appManifest.tagline
                    : "This App is coming soon — will be installed when available."}
                </p>
              </div>
              {appManifest && (
                <Link
                  href={`/studio/apps/${appManifest.slug}`}
                  className="inline-flex h-8 items-center rounded-lg border border-neutral-300 px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
                >
                  View
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(manifest.theme || manifest.homeLayout) && (
        <section className="mt-8">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            What else the Pack sets up
          </h2>
          <div className="mt-3 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-[12px]">
            {manifest.theme && (
              <p className="text-neutral-700">
                <span className="font-bold">Brand tokens:</span>{" "}
                {manifest.theme.tokens.length} tokens (colours, typography,
                radii). Preserves any tokens you&rsquo;ve already set.
              </p>
            )}
            {manifest.homeLayout && (
              <p className="text-neutral-700">
                <span className="font-bold">Home page:</span>{" "}
                {manifest.homeLayout.sections.length} starter sections
                (only seeded if your home page is empty).
              </p>
            )}
          </div>
        </section>
      )}

      {installOpen && (
        <PackInstallProgressModal
          manifest={manifest}
          onClose={(mutated) => {
            setInstallOpen(false);
            if (mutated) void refresh();
          }}
        />
      )}
    </div>
  );
}
