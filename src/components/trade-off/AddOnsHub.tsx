"use client";

// AddOnsHub — dashboard panel listing every Xrated add-on. Iterates over
// XRATED_ADDONS so a new entry in the registry shows up here automatically.
//
// Wiring:
//   - Free add-ons (pricing.kind === "free") + add-ons included with paid
//     (includedWithPaid === true): fire against /api/trade-off/addons/toggle.
//   - Paid add-ons on a free profile: tell the user to upgrade and link to
//     /trade-off/upgrade.
//   - Paid add-ons on a paying profile WITHOUT an active subscription
//     (e.g. trial-only): redirect through Stripe Checkout so we create a
//     fresh subscription bundled with the add-on.
//   - Paid add-ons on a paying profile WITH an active subscription: call
//     /api/stripe/addon-attach to mutate the existing subscription
//     (proration handled by Stripe). Disabling fires /api/stripe/addon-detach.
//
// The webhook is the eventual source of truth — after attach/detach we
// reload so the server-rendered tier card + addons_enabled refresh.

import { useState } from "react";
import Link from "next/link";
import {
  XRATED_ADDONS,
  formatAddonPrice,
  isAddonIncludedForListing,
  type XratedAddon
} from "@/lib/xratedAddons";
import { isMerchantGradeTrade, isMerchantProTrade } from "@/lib/tradeOff";
import type { HammerexTradeOffListing } from "@/lib/supabase";

type Tier = "standard" | "app_trial" | "app_paid" | "app_expired" | "app_verified";

export function AddOnsHub({
  listing,
  editToken,
  tier
}: {
  listing: HammerexTradeOffListing;
  editToken: string;
  tier: Tier;
}) {
  const isPaid =
    tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  const hasActiveSub = Boolean(listing.stripe_subscription_id);
  const initialMap =
    listing.addons_enabled && typeof listing.addons_enabled === "object"
      ? (listing.addons_enabled as Record<string, boolean>)
      : {};
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(initialMap);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** Free add-on path — flip the bit server-side, no Stripe. */
  async function toggleFree(addon: XratedAddon, next: boolean) {
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

  /** Paid add-on attach path — three branches:
   *  1. No paid tier → punt to /trade-off/upgrade (this UI shouldn't
   *     even surface a clickable toggle, but defend anyway).
   *  2. Paid tier + active subscription → attach line-item via
   *     /api/stripe/addon-attach.
   *  3. Paid tier but no subscription on file (e.g. trial-only) → run
   *     a fresh Stripe Checkout that bundles the add-on. */
  async function attachPaid(addon: XratedAddon) {
    setErr(null);
    setBusySlug(addon.slug);
    try {
      if (!isPaid) {
        window.location.href = upgradeHref;
        return;
      }
      if (hasActiveSub) {
        const res = await fetch("/api/stripe/addon-attach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            listing_slug: listing.slug,
            edit_token: editToken,
            addon_slug: addon.slug
          })
        });
        const json: { ok?: boolean; error?: string; needs_checkout?: boolean } =
          await res.json();
        if (!json.ok) {
          if (json.needs_checkout) {
            // Fall through to the Checkout flow below.
            await checkoutForAddon(addon);
            return;
          }
          setErr(json.error ?? "Couldn't attach add-on.");
          return;
        }
        // Optimistically flip the toggle; webhook will reconcile shortly.
        setEnabledMap((m) => ({ ...m, [addon.slug]: true }));
        // Reload so server-rendered surfaces (header tier card, paid
        // summary) reflect the new add-on once the webhook lands.
        setTimeout(() => window.location.reload(), 800);
      } else {
        await checkoutForAddon(addon);
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusySlug(null);
    }
  }

  /** Paid add-on detach path — call /api/stripe/addon-detach. */
  async function detachPaid(addon: XratedAddon) {
    setErr(null);
    setBusySlug(addon.slug);
    try {
      const res = await fetch("/api/stripe/addon-detach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listing_slug: listing.slug,
          edit_token: editToken,
          addon_slug: addon.slug
        })
      });
      const json: { ok?: boolean; error?: string } = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Couldn't remove add-on.");
        return;
      }
      setEnabledMap((m) => ({ ...m, [addon.slug]: false }));
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusySlug(null);
    }
  }

  /** Fresh-Checkout fallback — used when the listing is on a paid tier
   *  but doesn't yet have a Stripe subscription on file (e.g. they're
   *  inside the free trial window). We create a new subscription with
   *  the paid tier + this add-on bundled together. */
  async function checkoutForAddon(addon: XratedAddon) {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tier: tier === "app_verified" ? "verified" : "paid",
        billing: listing.last_payment_plan === "annual" ? "annual" : "monthly",
        listing_slug: listing.slug,
        addon_slugs: [addon.slug]
      })
    });
    const json: { url?: string; error?: string } = await res.json();
    if (!res.ok || !json.url) {
      setErr(json.error ?? "Checkout failed — try again.");
      return;
    }
    window.location.href = json.url;
  }

  async function openPortal() {
    setBusySlug("__portal__");
    setErr(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listing_slug: listing.slug,
          edit_token: editToken
        })
      });
      const json: { url?: string; error?: string } = await res.json();
      if (!res.ok || !json.url) {
        setErr(json.error ?? "Couldn't open billing portal.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusySlug(null);
    }
  }

  async function toggle(addon: XratedAddon, next: boolean) {
    if (addon.availability === "coming_soon") return;
    // Free or included-with-paid → straight to the JSONB flip.
    const isFreePath =
      addon.pricing.kind === "free" || addon.includedWithPaid === true;
    if (isFreePath) {
      await toggleFree(addon, next);
      return;
    }
    // Paid → Stripe path.
    if (next) {
      await attachPaid(addon);
    } else {
      await detachPaid(addon);
    }
  }

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(listing.slug)}&token=${encodeURIComponent(editToken)}`;

  // Audience filter — hide merchant-only add-ons from service trades
  // and service-only add-ons from merchant-grade trades. Undefined
  // audience ⇒ shown to everyone.
  const isMerchant = isMerchantGradeTrade(listing.primary_trade);
  const isMerchantPro = isMerchantProTrade(listing.primary_trade);
  const visibleAddons = XRATED_ADDONS.filter((addon) => {
    if (addon.audience === "merchant" && !isMerchant) return false;
    if (addon.audience === "service" && isMerchant) return false;
    return true;
  });

  return (
    <div className="rounded-3xl border border-brand-line bg-brand-surface p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
        {isMerchantPro ? "Your features" : "Add-ons"}
      </p>
      <h2 className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">
        {isMerchantPro
          ? "Everything's included — fill what you'll use"
          : "Make your profile do more"}
      </h2>
      <p className="mt-2 text-xs text-brand-muted">
        {isMerchantPro
          ? "Your £14.99/mo Merchant Pro plan bundles every feature below. Each one only shows on your public profile once you've added content — empty sections stay hidden."
          : "Switch on the features that match how you work. Each add-on layers on top of your existing profile — no separate setup."}
      </p>

      {err && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleAddons.map((addon) => (
          <AddonTile
            key={addon.slug}
            addon={addon}
            slug={listing.slug}
            editToken={editToken}
            enabled={
              enabledMap[addon.slug] === true ||
              (addon.includedWithPaid && isPaid) ||
              (isMerchantPro && isPaid && isAddonIncludedForListing(addon, listing))
            }
            busy={busySlug === addon.slug}
            isPaid={isPaid}
            hasActiveSub={hasActiveSub}
            upgradeHref={upgradeHref}
            bundledIncluded={
              isMerchantPro && isAddonIncludedForListing(addon, listing)
            }
            onToggle={(next) => toggle(addon, next)}
            onOpenPortal={openPortal}
            portalBusy={busySlug === "__portal__"}
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
  hasActiveSub,
  upgradeHref,
  bundledIncluded,
  onToggle,
  onOpenPortal,
  portalBusy
}: {
  addon: XratedAddon;
  slug: string;
  editToken: string;
  enabled: boolean;
  busy: boolean;
  isPaid: boolean;
  hasActiveSub: boolean;
  upgradeHref: string;
  /** Merchant Pro override — when true this paid add-on is bundled into
   *  the listing's tier (no separate Stripe line, no upgrade gate). UI
   *  collapses to an "Included" chip + Manage link. */
  bundledIncluded?: boolean;
  onToggle: (next: boolean) => void;
  onOpenPortal: () => void;
  portalBusy: boolean;
}) {
  const isComingSoon = addon.availability === "coming_soon";
  const includedChip =
    (addon.includedWithPaid && isPaid) || (bundledIncluded === true && isPaid);
  const requiresUpgrade =
    addon.pricing.kind === "paid" &&
    !addon.includedWithPaid &&
    !bundledIncluded &&
    !isPaid;
  const isPaidAddon =
    addon.pricing.kind === "paid" &&
    !addon.includedWithPaid &&
    !bundledIncluded;
  // "Active — manage in subscription" surface — only when this is a
  // paid add-on the customer has actually attached to their Stripe sub.
  // Free + included add-ons keep the simple toggle / chip UI.
  const showSubscriptionManage =
    isPaidAddon && enabled && isPaid && hasActiveSub;
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
        {/* Price chip suppressed for bundled-included add-ons — Merchant
         *  Pro tradies shouldn't see "£7/mo" on a feature their tier
         *  already covers. Free add-ons still show "Free". */}
        {!(bundledIncluded && isPaid) && (
          <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-surface px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-text">
            {isComingSoon ? "Coming soon" : formatAddonPrice(addon)}
          </span>
        )}
        {includedChip && (
          <span className="inline-flex items-center rounded-full border border-brand-accent/60 bg-brand-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-accent">
            Included
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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
            Subscribe to Paid first →
          </Link>
        ) : showSubscriptionManage ? (
          // Paid add-on already attached — show "Active" chip + open the
          // Stripe billing portal (so the tradesperson can remove it or
          // change billing details). The toggle still controls detach
          // via the chevron-style red remove button.
          <span className="inline-flex h-11 items-center rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-300">
            Active
          </span>
        ) : isPaidAddon && isPaid && !hasActiveSub ? (
          // Paid tier but no subscription on file (trial-only). Clicking
          // the toggle will run a fresh Checkout to bundle the add-on
          // into a new subscription.
          <button
            type="button"
            onClick={() => onToggle(true)}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-full bg-brand-accent px-3 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Opening Stripe…" : "Add to subscription →"}
          </button>
        ) : isPaidAddon && isPaid ? (
          // Paid tier WITH subscription → attach via /api/stripe/addon-attach.
          <button
            type="button"
            onClick={() => onToggle(true)}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-full bg-brand-accent px-3 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add to subscription →"}
          </button>
        ) : (
          // Free add-on — straight toggle pill.
          <TogglePill enabled={enabled} busy={busy} onChange={onToggle} />
        )}

        {showSubscriptionManage && (
          <button
            type="button"
            onClick={onOpenPortal}
            disabled={portalBusy}
            className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
          >
            {portalBusy ? "Opening…" : "Billing portal →"}
          </button>
        )}

        {showSubscriptionManage && (
          <button
            type="button"
            onClick={() => onToggle(false)}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-full border border-red-500/50 bg-red-500/10 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy ? "Removing…" : "Remove"}
          </button>
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
