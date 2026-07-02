"use client";

// AppStoreCard — one App in the browse grid.
//
// Install / Manage / Reinstall / Upgrade CTAs — never a plain
// disabled state. When gated by tier, renders the eligibility's
// upgradeLabel + a link to pricing.

import { useState } from "react";
import Link from "next/link";
import type { FrozenAppManifest } from "@/platform/manifest/types";
import type { EligibilityDecision } from "@/platform/appEligibility";
import { InstallProgressModal } from "./InstallProgressModal";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const NEUTRAL = "#404040";

export type InstallState =
  | { kind: "not-installed" }
  | { kind: "installed"; version: string; installedAt: string }
  | { kind: "previously-installed"; version: string; uninstalledAt: string };

export function AppStoreCard({
  manifest,
  installState,
  eligibility,
  merchantSlug: _merchantSlug,
  onChanged
}: {
  manifest: FrozenAppManifest;
  installState: InstallState;
  eligibility: EligibilityDecision;
  merchantSlug: string;
  onChanged: () => void;
}) {
  const [installOpen, setInstallOpen] = useState(false);

  const isInstalled = installState.kind === "installed";
  const wasInstalled = installState.kind === "previously-installed";
  const eligible = eligibility.eligible;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md">
      <div
        className="relative flex h-32 w-full items-center justify-center"
        style={{ background: "linear-gradient(135deg, #FFB300 0%, #FF9500 100%)" }}
      >
        <span
          className="text-5xl"
          role="img"
          aria-label={manifest.name}
        >
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
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p
            className="text-[9px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {manifest.category}
          </p>
          <h3 className="mt-0.5 text-[15px] font-extrabold text-neutral-900">
            {manifest.name}
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
            {manifest.tagline}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {manifest.appStore.priceLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/studio/apps/${manifest.slug}`}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
            >
              Details
            </Link>
            {renderCta({
              isInstalled,
              wasInstalled,
              eligible,
              eligibility,
              onInstall: () => setInstallOpen(true)
            })}
          </div>
        </div>
      </div>

      {installOpen && (
        <InstallProgressModal
          manifest={manifest}
          onClose={(installed) => {
            setInstallOpen(false);
            if (installed) onChanged();
          }}
        />
      )}
    </article>
  );
}

function renderCta({
  isInstalled,
  wasInstalled,
  eligible,
  eligibility,
  onInstall
}: {
  isInstalled: boolean;
  wasInstalled: boolean;
  eligible: boolean;
  eligibility: EligibilityDecision;
  onInstall: () => void;
}) {
  if (isInstalled) {
    return (
      <button
        type="button"
        onClick={onInstall}
        className="inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
        style={{ background: GREEN }}
      >
        Manage
      </button>
    );
  }
  if (!eligible && !eligibility.eligible) {
    return (
      <Link
        href="/trade-off/pricing"
        className="inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
        style={{ background: BLACK }}
      >
        {eligibility.upgradeLabel}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onInstall}
      className="inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
      style={{ background: YELLOW }}
    >
      {wasInstalled ? "Reinstall" : "Install"}
    </button>
  );
}
