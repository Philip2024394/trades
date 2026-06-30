"use client";

// Merchant Pro — section grid.
//
// Replaces AddOnsHub for building-merchant and builders-supplies on the
// £14.99/mo tier. Every section is bundled, so there's no pricing chip,
// no upgrade gate, no Stripe attach/detach. The card model:
//
//   - Toggle ON/OFF — flips listing.addons_enabled[<key>].
//   - "Manage" link — opens the dedicated editor for that section.
//   - Status chip — "12 / 200", "Empty — hidden", "Live — 12 items".
//
// The "Next best step" yellow card on the dashboard above this grid is
// rendered server-side from nextBestStep(); this client component owns
// just the toggle interactivity.

import { useState } from "react";
import Link from "next/link";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import {
  MERCHANT_PRO_SECTIONS,
  isSectionOn,
  type MerchantProSection,
  type MerchantProSectionCounts
} from "@/lib/merchantProDashboard";

export function MerchantProSectionGrid({
  listing,
  editToken,
  counts,
  adminWhatsappDigits
}: {
  listing: HammerexTradeOffListing;
  editToken: string;
  counts: MerchantProSectionCounts;
  /** Digits-only admin WhatsApp number (e.g. "447449023049") used by the
   *  "Suggest a feature" CTA. Passed from the server so we don't bake an
   *  env-derived value into the client bundle. */
  adminWhatsappDigits: string;
}) {
  const initialEnabled: Record<string, boolean> = {};
  for (const section of MERCHANT_PRO_SECTIONS) {
    initialEnabled[section.key] = isSectionOn(listing, section);
  }
  const [enabled, setEnabled] = useState<Record<string, boolean>>(initialEnabled);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onToggle(section: MerchantProSection, next: boolean) {
    setErr(null);
    const prev = enabled[section.key];
    setEnabled((e) => ({ ...e, [section.key]: next }));
    setBusyKey(section.key);
    try {
      const res = await fetch("/api/trade-off/addons/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: listing.slug,
          edit_token: editToken,
          addon_slug: section.key,
          enabled: next
        })
      });
      const json: {
        ok?: boolean;
        error?: string;
        addons_enabled?: Record<string, boolean>;
      } = await res.json();
      if (!json.ok) {
        setEnabled((e) => ({ ...e, [section.key]: prev }));
        setErr(json.error ?? "Couldn't update — try again.");
      } else if (json.addons_enabled) {
        const merged: Record<string, boolean> = {};
        for (const s of MERCHANT_PRO_SECTIONS) {
          merged[s.key] =
            s.key in json.addons_enabled
              ? json.addons_enabled[s.key] === true
              : s.defaultOn;
        }
        setEnabled(merged);
      }
    } catch {
      setEnabled((e) => ({ ...e, [section.key]: prev }));
      setErr("Network error — try again.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      {err && (
        <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MERCHANT_PRO_SECTIONS.map((section) => (
          <SectionCard
            key={section.key}
            slug={listing.slug}
            editToken={editToken}
            section={section}
            enabled={enabled[section.key] === true}
            filled={section.isFilled(counts)}
            countLabel={section.countLabel(counts)}
            busy={busyKey === section.key}
            onToggle={(next) => onToggle(section, next)}
          />
        ))}
      </div>

      {/* Suggest a feature — placeholder for the user-driven roadmap.
       *  Opens a WhatsApp draft to the admin number so feedback lands
       *  in the same channel the rest of Site Office uses. */}
      <div className="mt-6 rounded-2xl border border-dashed border-brand-line bg-brand-bg p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
          Roadmap
        </p>
        <h3 className="mt-2 text-base font-extrabold text-brand-text">
          + Suggest a new feature
        </h3>
        <p className="mt-1 text-xs text-brand-muted">
          Merchant Pro grows with your feedback. Tell us what's missing
          and we'll ship it.
        </p>
        <SuggestFeatureLink
          displayName={listing.display_name ?? ""}
          adminWhatsappDigits={adminWhatsappDigits}
        />
      </div>
    </div>
  );
}

function SectionCard({
  slug,
  editToken,
  section,
  enabled,
  filled,
  countLabel,
  busy,
  onToggle
}: {
  slug: string;
  editToken: string;
  section: MerchantProSection;
  enabled: boolean;
  filled: boolean;
  countLabel: string;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  // Trusted Trades has no dedicated editor sub-page — the recommendations
  // field lives inline on the main edit page inside PremiumCustomisationPanel.
  // The original AddOnsHub special-cased this; we mirror that here so the
  // section card lands the user on the right field.
  const manageHref =
    section.editorPath === "trusted-trades"
      ? `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(editToken)}#trusted-trades`
      : `/trade-off/edit/${encodeURIComponent(slug)}/${section.editorPath}?token=${encodeURIComponent(editToken)}`;
  const ring =
    enabled && filled
      ? "border-brand-accent/60 ring-1 ring-brand-accent/40"
      : enabled
        ? "border-brand-line"
        : "border-brand-line opacity-70";
  // Status badge — three states:
  //   ON + filled  → "● Live"  (yellow)
  //   ON + empty   → "○ Hidden — add content" (muted)
  //   OFF          → "✕ Off"  (muted)
  const status: { glyph: string; label: string; cls: string } = !enabled
    ? {
        glyph: "✕",
        label: "Off",
        cls: "border-brand-line bg-brand-bg text-brand-muted"
      }
    : filled
      ? {
          glyph: "●",
          label: "Live",
          cls: "border-brand-accent/60 bg-brand-accent/15 text-brand-accent"
        }
      : {
          glyph: "○",
          label: "Hidden until filled",
          cls: "border-brand-line bg-brand-bg text-brand-muted"
        };

  return (
    <div className={`rounded-2xl border bg-brand-bg p-4 transition ${ring}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-accent text-xl text-black">
          <span aria-hidden="true">{section.glyph}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-tight text-brand-text sm:text-base">
            {section.name}
          </p>
          <p className="mt-1 text-xs text-brand-muted">{section.tagline}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${status.cls}`}
        >
          <span aria-hidden="true">{status.glyph}</span> {status.label}
        </span>
        <span className="text-[11px] text-brand-muted">{countLabel}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={manageHref}
          className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-bg px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          {filled ? "Manage →" : "Set up →"}
        </Link>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? "Turn off" : "Turn on"} ${section.name}`}
          disabled={busy}
          onClick={() => onToggle(!enabled)}
          className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
            enabled
              ? "border-brand-accent bg-brand-accent"
              : "border-brand-line bg-brand-bg"
          } ${busy ? "opacity-50" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`block h-5 w-5 rounded-full bg-black shadow transition ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function SuggestFeatureLink({
  displayName,
  adminWhatsappDigits
}: {
  displayName: string;
  adminWhatsappDigits: string;
}) {
  const msg = encodeURIComponent(
    `Hi Xrated Trades — I'm running ${displayName || "a Merchant Pro storefront"} and I'd like to suggest a new feature: `
  );
  const href = `https://wa.me/${adminWhatsappDigits}?text=${msg}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-4 text-[13px] font-bold text-white transition hover:opacity-90"
    >
      Tell us on WhatsApp →
    </a>
  );
}
