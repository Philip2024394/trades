"use client";

// PackCard — single Industry Pack in the browse grid.

import { useState } from "react";
import Link from "next/link";
import type { FrozenPackManifest } from "@/platform/packs/types";
import { PackInstallProgressModal } from "./PackInstallProgressModal";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const NEUTRAL = "#404040";

export type PackInstallState =
  | { kind: "not-installed" }
  | { kind: "installed"; version: string; installedAt: string }
  | { kind: "previously-installed"; version: string; uninstalledAt: string };

export function PackCard({
  manifest,
  installState,
  merchantSlug: _merchantSlug,
  onChanged
}: {
  manifest: FrozenPackManifest;
  installState: PackInstallState;
  merchantSlug: string;
  onChanged: () => void;
}) {
  const [installOpen, setInstallOpen] = useState(false);
  const isInstalled = installState.kind === "installed";
  const wasInstalled = installState.kind === "previously-installed";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md">
      <div
        className="relative flex h-40 w-full items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0A0A0A 0%, #262626 100%)" }}
      >
        <span className="text-6xl" role="img" aria-label={manifest.name}>
          {manifest.icon}
        </span>
        {isInstalled && (
          <span
            className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
            style={{ background: GREEN }}
          >
            Installed
          </span>
        )}
        {wasInstalled && (
          <span
            className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
            style={{ background: NEUTRAL }}
          >
            Previously installed
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {manifest.industry === "*" ? "Any industry" : manifest.industry}
          </p>
          <h3 className="mt-0.5 text-[17px] font-extrabold text-neutral-900">
            {manifest.name}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
            {manifest.tagline}
          </p>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
          <span>{manifest.apps.length} Apps</span>
          {manifest.theme && (
            <>
              <span>·</span>
              <span>Theme included</span>
            </>
          )}
          {manifest.homeLayout && (
            <>
              <span>·</span>
              <span>Home layout included</span>
            </>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2">
          <p className="mr-auto text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {manifest.packStore.priceLabel}
          </p>
          <Link
            href={`/studio/packs/${manifest.slug}`}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
          >
            Details
          </Link>
          {isInstalled ? (
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
              style={{ background: GREEN }}
            >
              Manage
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
              style={{ background: YELLOW }}
            >
              {wasInstalled ? "Reinstall" : "Install pack"}
            </button>
          )}
        </div>
      </div>

      {installOpen && (
        <PackInstallProgressModal
          manifest={manifest}
          onClose={(mutated) => {
            setInstallOpen(false);
            if (mutated) onChanged();
          }}
        />
      )}
    </article>
  );
}
