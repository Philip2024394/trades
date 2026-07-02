"use client";

// AppDetailPanel — shareable /studio/apps/[slug] detail view.
//
// Full manifest surface: screenshots, benefits, description, publisher,
// version, capabilities/permissions transparency, dependencies, install
// action. Every field is derived from the manifest — nothing is
// hardcoded to a specific App.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FrozenAppManifest } from "@/platform/manifest/types";
import type { EligibilityDecision } from "@/platform/appEligibility";
import type { InstalledAppRow } from "@/platform/runtime";
import { InstallProgressModal } from "./InstallProgressModal";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const NEUTRAL = "#404040";

type DetailResponse =
  | {
      ok: true;
      manifest: FrozenAppManifest;
      install: InstalledAppRow | null;
      eligibility: EligibilityDecision;
      dependencies: FrozenAppManifest[];
    }
  | { ok: false; error: string };

export function AppDetailPanel({
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
      const res = await fetch(`/api/platform/apps/${slug}`);
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
          href="/studio/apps"
          className="mt-4 inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
        >
          ← Back to App Store
        </Link>
      </div>
    );
  }

  const { manifest, install, eligibility, dependencies } = state;
  const isInstalled = !!install && !install.uninstalled_at;
  const wasInstalled = !!install && !!install.uninstalled_at;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <Link
        href="/studio/apps"
        className="inline-flex items-center text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:text-neutral-900"
      >
        ← App Store
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl text-5xl"
          style={{ background: "linear-gradient(135deg, #FFB300 0%, #FF9500 100%)" }}
        >
          {manifest.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {manifest.category}
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
        <div className="flex flex-col items-stretch gap-2 sm:min-w-[180px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {manifest.appStore.priceLabel}
          </p>
          {renderPrimaryCta({
            isInstalled,
            wasInstalled,
            eligibility,
            onInstall: () => setInstallOpen(true)
          })}
        </div>
      </div>

      {/* Description */}
      <section className="mt-10">
        <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          About
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-700">
          {manifest.description}
        </p>
      </section>

      {/* Benefits */}
      {manifest.appStore.benefits.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Benefits
          </h2>
          <ul className="mt-2 space-y-2">
            {manifest.appStore.benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-800">
                <span style={{ color: GREEN }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Screenshots */}
      {manifest.appStore.screenshots.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Screenshots
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {manifest.appStore.screenshots.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`${manifest.name} screenshot ${i + 1}`}
                className="w-full rounded-xl border border-neutral-200"
              />
            ))}
          </div>
        </section>
      )}

      {/* Compatibility */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoBlock
          label="Compatible industries"
          items={manifest.compatibility.industries}
        />
        <InfoBlock
          label="Compatible pages"
          items={manifest.compatibility.pages}
        />
        {manifest.compatibility.createsPages.length > 0 && (
          <InfoBlock
            label="Creates pages"
            items={manifest.compatibility.createsPages.map(
              (p) => `${p.title} (${p.path})`
            )}
          />
        )}
        {dependencies.length > 0 && (
          <InfoBlock
            label="Requires"
            items={dependencies.map((d) => d.name)}
          />
        )}
      </section>

      {/* Transparency */}
      <section className="mt-8">
        <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          What this App can access
        </h2>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-[12px]">
          <p className="font-bold text-neutral-800">Capabilities:</p>
          <p className="mt-1 text-neutral-600">
            {manifest.requirements.capabilities.length === 0
              ? "None declared"
              : manifest.requirements.capabilities.join(" · ")}
          </p>
          <p className="mt-3 font-bold text-neutral-800">Permissions:</p>
          <p className="mt-1 text-neutral-600">
            {manifest.requirements.permissions.length === 0
              ? "None declared"
              : manifest.requirements.permissions.join(" · ")}
          </p>
        </div>
      </section>

      {installOpen && (
        <InstallProgressModal
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

function InfoBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-[12px] text-neutral-800">
        {items.length === 0 ? "—" : items.join(", ")}
      </p>
    </div>
  );
}

function renderPrimaryCta({
  isInstalled,
  wasInstalled,
  eligibility,
  onInstall
}: {
  isInstalled: boolean;
  wasInstalled: boolean;
  eligibility: EligibilityDecision;
  onInstall: () => void;
}) {
  if (isInstalled) {
    return (
      <button
        type="button"
        onClick={onInstall}
        className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
        style={{ background: GREEN }}
      >
        Manage
      </button>
    );
  }
  if (!eligibility.eligible) {
    return (
      <Link
        href="/trade-off/pricing"
        className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
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
      className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
      style={{ background: YELLOW }}
    >
      {wasInstalled ? "Reinstall" : "Install"}
    </button>
  );
}
