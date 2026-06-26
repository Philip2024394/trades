"use client";

// AddOnsHub — dashboard panel listing every Xrated add-on. Iterates over
// XRATED_ADDONS so a new entry in the registry shows up here automatically.
// Toggles fire optimistically against /api/trade-off/addons/toggle.

import { useState } from "react";
import Link from "next/link";
import {
  XRATED_ADDONS,
  formatAddonPrice,
  type XratedAddon
} from "@/lib/xratedAddons";
import type { HammerexTradeOffListing } from "@/lib/supabase";

type Tier = "standard" | "app_trial" | "app_paid" | "app_expired";

export function AddOnsHub({
  listing,
  editToken,
  tier
}: {
  listing: HammerexTradeOffListing;
  editToken: string;
  tier: Tier;
}) {
  const isPaid = tier === "app_trial" || tier === "app_paid";
  const initialMap =
    listing.addons_enabled && typeof listing.addons_enabled === "object"
      ? (listing.addons_enabled as Record<string, boolean>)
      : {};
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(initialMap);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(addon: XratedAddon, next: boolean) {
    if (addon.availability === "coming_soon") return;
    if (addon.pricing.kind === "paid" && next && !isPaid) return;
    setErr(null);
    const prev = enabledMap[addon.slug] === true;
    setEnabledMap((m) => ({ ...m, [addon.slug]: next }));
    setBusySlug(addon.slug);
    try {
      const res = await fetch("/api/trade-off/addons/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: listing.slug,
          edit_token: editToken,
          addon_slug: addon.slug,
          enabled: next
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setEnabledMap((m) => ({ ...m, [addon.slug]: prev }));
        setErr(json.error ?? "Couldn't update add-on.");
      } else if (json.addons_enabled && typeof json.addons_enabled === "object") {
        setEnabledMap(json.addons_enabled as Record<string, boolean>);
      }
    } catch {
      setEnabledMap((m) => ({ ...m, [addon.slug]: prev }));
      setErr("Network error — try again.");
    } finally {
      setBusySlug(null);
    }
  }

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(listing.slug)}&token=${encodeURIComponent(editToken)}`;

  return (
    <div className="rounded-3xl border border-brand-line bg-brand-surface p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
        Add-ons
      </p>
      <h2 className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">
        Make your profile do more
      </h2>
      <p className="mt-2 text-xs text-brand-muted">
        Switch on the features that match how you work. Each add-on layers on
        top of your existing profile — no separate setup.
      </p>

      {err && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {XRATED_ADDONS.map((addon) => (
          <AddonTile
            key={addon.slug}
            addon={addon}
            slug={listing.slug}
            editToken={editToken}
            enabled={
              enabledMap[addon.slug] === true ||
              (addon.includedWithPaid && isPaid)
            }
            busy={busySlug === addon.slug}
            isPaid={isPaid}
            upgradeHref={upgradeHref}
            onToggle={(next) => toggle(addon, next)}
          />
        ))}
      </div>
    </div>
  );
}

function AddonTile({
  addon,
  slug,
  editToken,
  enabled,
  busy,
  isPaid,
  upgradeHref,
  onToggle
}: {
  addon: XratedAddon;
  slug: string;
  editToken: string;
  enabled: boolean;
  busy: boolean;
  isPaid: boolean;
  upgradeHref: string;
  onToggle: (next: boolean) => void;
}) {
  const isComingSoon = addon.availability === "coming_soon";
  const includedChip = addon.includedWithPaid && isPaid;
  const requiresUpgrade =
    addon.pricing.kind === "paid" && !addon.includedWithPaid && !isPaid;
  const ringCls = enabled
    ? "border-brand-accent/60 ring-1 ring-brand-accent/40"
    : "border-brand-line";

  // Manage link — Trusted Trades has no dedicated editor; we point at the
  // main edit page so the user lands back on the recommendations field
  // inside PremiumCustomisationPanel.
  const manageHref = !addon.hasEditor
    ? null
    : addon.editorPath === "trusted-trades"
      ? `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(editToken)}#trusted-trades`
      : `/trade-off/edit/${encodeURIComponent(slug)}/${addon.editorPath}?token=${encodeURIComponent(editToken)}`;

  return (
    <div className={`rounded-2xl border bg-brand-bg p-4 transition ${ringCls}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-accent text-xl text-black">
          <span aria-hidden="true">{addon.glyph}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-tight text-brand-text sm:text-base">
            {addon.name}
          </p>
          <p className="mt-1 text-xs text-brand-muted">{addon.tagline}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-surface px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-text">
          {isComingSoon ? "Coming soon" : formatAddonPrice(addon)}
        </span>
        {includedChip && (
          <span className="inline-flex items-center rounded-full border border-brand-accent/60 bg-brand-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-accent">
            Included
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {isComingSoon ? (
          <span className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-muted">
            Notify me soon
          </span>
        ) : includedChip ? (
          <span className="inline-flex h-11 items-center rounded-full border border-brand-accent/60 bg-brand-accent/15 px-3 text-xs font-bold text-brand-accent">
            On — included
          </span>
        ) : requiresUpgrade ? (
          <Link
            href={upgradeHref}
            className="inline-flex h-11 items-center rounded-full bg-brand-accent px-3 text-xs font-bold text-black transition hover:opacity-90"
          >
            Upgrade to unlock →
          </Link>
        ) : (
          <TogglePill enabled={enabled} busy={busy} onChange={onToggle} />
        )}

        {manageHref && (enabled || includedChip) && (
          <Link
            href={manageHref}
            className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            Manage →
          </Link>
        )}
      </div>

      <details className="group mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-brand-muted transition hover:text-brand-accent">
          What you get
        </summary>
        <ul className="mt-2 space-y-1">
          {addon.benefits.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-xs leading-snug text-brand-text"
            >
              <span aria-hidden="true" className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function TogglePill({
  enabled,
  busy,
  onChange
}: {
  enabled: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={busy}
      aria-pressed={enabled}
      className={`relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border px-1 transition ${
        enabled
          ? "border-brand-accent bg-brand-accent/30"
          : "border-brand-line bg-brand-bg"
      } ${busy ? "opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-8 w-8 transform rounded-full transition ${
          enabled ? "translate-x-9 bg-brand-accent" : "translate-x-0 bg-brand-muted"
        }`}
      />
      <span className="sr-only">{enabled ? "On" : "Off"}</span>
    </button>
  );
}
