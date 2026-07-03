"use client";

// AppStoreCard — one App in the browse grid.
//
// Install / Manage / Reinstall / Upgrade CTAs — never a plain
// disabled state. When gated by tier, renders the eligibility's
// upgradeLabel + a link to pricing.

import { useRef, useState } from "react";
import Link from "next/link";
import type { FrozenAppManifest } from "@/platform/manifest/types";
import type { EligibilityDecision } from "@/platform/appEligibility";
import { InstallProgressModal } from "./InstallProgressModal";
import { useNotify } from "./Toaster";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const NEUTRAL = "#404040";
const AMBER = "#F59E0B";
const RED = "#DC2626";

export type InstallState =
  | { kind: "not-installed" }
  | { kind: "installed"; version: string; installedAt: string }
  | { kind: "previously-installed"; version: string; uninstalledAt: string };

// Pre-flight signal that the parent list computes from the full items
// set. Lets the card show honest state BEFORE the merchant clicks
// Install — no more "click, wait for modal, learn it can't happen".
export type Readiness =
  | { kind: "ready" }
  | { kind: "needs-prerequisites"; missing: { slug: string; name: string }[] }
  | { kind: "blocked-conflict"; conflicts: { slug: string; name: string }[] };

export function AppStoreCard({
  manifest,
  installState,
  eligibility,
  readiness,
  merchantSlug: _merchantSlug,
  onChanged,
  onOptimistic,
  onInstallPrerequisite
}: {
  manifest: FrozenAppManifest;
  installState: InstallState;
  eligibility: EligibilityDecision;
  /** Computed by the parent from the full items list. Undefined
   *  treated as "ready" so any legacy caller keeps working. */
  readiness?: Readiness;
  merchantSlug: string;
  onChanged: () => void;
  /** Fires the instant the modal confirms a mutation, before the
   *  parent's refresh() resolves. Parents flip badge / CTA state
   *  optimistically so the merchant never sees a stale "Install"
   *  button after a successful install. */
  onOptimistic?: (slug: string, kind: "installed" | "uninstalled") => void;
  /** Chain-install a missing prerequisite in one tap. */
  onInstallPrerequisite?: (slug: string) => void;
}) {
  const notify = useNotify();
  const [installOpen, setInstallOpen] = useState(false);
  // Warm the /api/platform/apps/<slug> route on hover intent so the
  // modal's "current install state" query is already in cache when
  // the merchant clicks. Same 150ms threshold as the templates
  // library — filters out mouse fly-overs.
  const detailPrefetched = useRef(false);
  const hoverTimer = useRef<number | null>(null);
  const onHoverStart = () => {
    if (detailPrefetched.current) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      detailPrefetched.current = true;
      void fetch(`/api/platform/apps/${manifest.slug}`, {
        credentials: "same-origin"
      }).catch(() => {});
    }, 150);
  };
  const onHoverEnd = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const isInstalled = installState.kind === "installed";
  const wasInstalled = installState.kind === "previously-installed";
  const eligible = eligibility.eligible;
  const ready = readiness?.kind ?? "ready";

  return (
    <article
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md"
    >
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
          {!isInstalled && readiness && readiness.kind !== "ready" && (
            <ReadinessChip
              readiness={readiness}
              onInstallPrerequisite={onInstallPrerequisite}
              onNotify={(kind, title, detail) =>
                kind === "warning"
                  ? notify.warning({ title, detail })
                  : notify.info({ title, detail })
              }
            />
          )}
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
              ready,
              onInstall: () => setInstallOpen(true),
              onBlocked: () => {
                if (readiness?.kind === "needs-prerequisites") {
                  notify.warning({
                    title: `Install ${readiness.missing.map((m) => m.name).join(" + ")} first`,
                    detail: `${manifest.name} needs ${readiness.missing.length === 1 ? "it" : "them"} to work.`
                  });
                }
                if (readiness?.kind === "blocked-conflict") {
                  notify.error({
                    title: `${manifest.name} conflicts with ${readiness.conflicts.map((c) => c.name).join(", ")}`,
                    detail: "Uninstall the conflicting App from its card first."
                  });
                }
              }
            })}
          </div>
        </div>
      </div>

      {installOpen && (
        <InstallProgressModal
          manifest={manifest}
          onOptimistic={(kind) => onOptimistic?.(manifest.slug, kind)}
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
  ready,
  onInstall,
  onBlocked
}: {
  isInstalled: boolean;
  wasInstalled: boolean;
  eligible: boolean;
  eligibility: EligibilityDecision;
  ready: Readiness["kind"];
  onInstall: () => void;
  onBlocked: () => void;
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
  if (ready === "blocked-conflict") {
    return (
      <button
        type="button"
        onClick={onBlocked}
        aria-label="This App conflicts with an installed App"
        className="inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
        style={{ background: RED }}
      >
        Conflict
      </button>
    );
  }
  if (ready === "needs-prerequisites") {
    return (
      <button
        type="button"
        onClick={onBlocked}
        aria-label="This App needs prerequisites installed first"
        className="inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
        style={{ background: AMBER, color: "#fff" }}
      >
        Needs setup
      </button>
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

function ReadinessChip({
  readiness,
  onInstallPrerequisite,
  onNotify
}: {
  readiness: Readiness;
  onInstallPrerequisite?: (slug: string) => void;
  onNotify: (kind: "warning" | "info", title: string, detail?: string) => void;
}) {
  if (readiness.kind === "ready") return null;
  if (readiness.kind === "blocked-conflict") {
    const label = readiness.conflicts.map((c) => c.name).join(", ");
    return (
      <div
        className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
        style={{
          borderColor: RED,
          background: "rgba(220,38,38,0.06)",
          color: RED
        }}
        role="note"
      >
        <span aria-hidden="true">×</span>
        <span className="flex-1">
          <strong>Conflicts with {label}.</strong> Uninstall it first, then
          come back.
        </span>
      </div>
    );
  }
  // needs-prerequisites
  const missing = readiness.missing;
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: AMBER,
        background: "rgba(245,158,11,0.08)",
        color: "#78350F"
      }}
      role="note"
    >
      <p className="text-[11px] leading-relaxed">
        <span aria-hidden="true">! </span>
        Needs <strong>{missing.map((m) => m.name).join(" + ")}</strong>{" "}
        installed first.
      </p>
      {onInstallPrerequisite && (
        <div className="flex flex-wrap gap-1.5">
          {missing.map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => {
                onNotify(
                  "info",
                  `Installing ${m.name}…`,
                  "Chained from the prerequisite chip."
                );
                onInstallPrerequisite(m.slug);
              }}
              className="inline-flex h-7 items-center rounded-md px-2 text-[10px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
              style={{ background: AMBER }}
            >
              Install {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
