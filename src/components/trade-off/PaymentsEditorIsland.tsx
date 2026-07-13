"use client";

// PaymentsEditorIsland — bring-your-own-keys payments dashboard.
//
// The merchant creates their own Stripe/PayPal/Square account (5 min,
// one-time), grabs their API credentials from their provider's own
// dashboard, and pastes them here. We:
//   1. Test-fire the credentials against the provider's API on save
//      so the merchant knows instantly they work
//   2. Encrypt them at rest via AES-256-GCM
//   3. Route the cart's Pay Now button through the credentials the
//      merchant chose as active
//
// thenetworkers.app never registered as a "platform" with any provider.
// We take zero commission. Money settles direct to the merchant's own
// provider account.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  POPULAR_UK_LINK_PROVIDERS,
  buildPaymentLink,
  validatePaymentLinkTemplate
} from "@/lib/paymentProviders";

type ProviderKey = "stripe" | "paypal" | "square" | "payment_link" | null;

type StripeInfo = {
  saved: boolean;
  account_name?: string | null;
  country?: string | null;
  charges_enabled?: boolean;
  mode?: "live" | "test";
  masked?: string;
};
type PaypalInfo = {
  saved: boolean;
  client_id?: string;
  env?: "sandbox" | "live";
};
type SquareInfo = {
  saved: boolean;
  location_name?: string | null;
  location_id?: string | null;
  country?: string | null;
  env?: "sandbox" | "production";
};

export function PaymentsEditorIsland({
  slug,
  token,
  addonOn,
  isPaid,
  upgradeHref,
  initialProvider,
  initialLinkTemplate,
  initialLinkProviderName,
  initialStripeInfo,
  initialPaypalInfo,
  initialSquareInfo
}: {
  slug: string;
  token: string;
  addonOn: boolean;
  isPaid: boolean;
  upgradeHref: string;
  initialProvider: string | null;
  initialLinkTemplate: string;
  initialLinkProviderName: string;
  initialStripeInfo?: StripeInfo;
  initialPaypalInfo?: PaypalInfo;
  initialSquareInfo?: SquareInfo;
}) {
  const [provider, setProvider] = useState<ProviderKey>(initialProvider as ProviderKey);
  const [addonEnabled, setAddonEnabled] = useState(addonOn);
  const [linkTemplate, setLinkTemplate] = useState(initialLinkTemplate);
  const [linkProviderName, setLinkProviderName] = useState(initialLinkProviderName || "");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [stripe, setStripe] = useState<StripeInfo>(initialStripeInfo ?? { saved: false });
  const [paypal, setPaypal] = useState<PaypalInfo>(initialPaypalInfo ?? { saved: false });
  const [square, setSquare] = useState<SquareInfo>(initialSquareInfo ?? { saved: false });

  async function saveGeneral() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/trade-off/payments/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          token,
          addon_enabled: addonEnabled,
          payment_provider: provider,
          payment_link_template: linkTemplate.trim(),
          payment_link_provider_name: linkProviderName.trim()
        })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok || !j.ok) {
        setToast(j.detail ?? j.error ?? "Save failed");
      } else {
        setToast("Saved.");
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(null), 3500);
    }
  }

  const overallStatus: "not_connected" | "live" = useMemo(() => {
    if (!addonEnabled) return "not_connected";
    if (provider === "stripe" && stripe.saved) return "live";
    if (provider === "paypal" && paypal.saved) return "live";
    if (provider === "square" && square.saved) return "live";
    if (provider === "payment_link" && linkTemplate.trim().length > 0) return "live";
    return "not_connected";
  }, [addonEnabled, provider, stripe.saved, paypal.saved, square.saved, linkTemplate]);

  const activeProviderLabel =
    provider === "stripe" ? "Stripe"
    : provider === "paypal" ? "PayPal"
    : provider === "square" ? "Square"
    : provider === "payment_link" ? (linkProviderName || "Payment Link")
    : null;

  if (!isPaid) {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-24">
        <UpgradeGate upgradeHref={upgradeHref} />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 pb-24">
      <StatusHero
        status={overallStatus}
        activeLabel={activeProviderLabel}
        slug={slug}
        token={token}
      />

      <AddonToggleCard enabled={addonEnabled} onToggle={() => setAddonEnabled((v) => !v)} />

      <StripeCard
        info={stripe}
        onSaved={(next) => {
          setStripe(next);
          setProvider("stripe");
        }}
        onDisconnected={() => {
          setStripe({ saved: false });
          if (provider === "stripe") setProvider(null);
        }}
        slug={slug}
        token={token}
        setActive={() => setProvider("stripe")}
        isActive={provider === "stripe"}
      />

      <PaypalCard
        info={paypal}
        onSaved={(next) => {
          setPaypal(next);
          setProvider("paypal");
        }}
        onDisconnected={() => {
          setPaypal({ saved: false });
          if (provider === "paypal") setProvider(null);
        }}
        slug={slug}
        token={token}
        setActive={() => setProvider("paypal")}
        isActive={provider === "paypal"}
      />

      <SquareCard
        info={square}
        onSaved={(next) => {
          setSquare(next);
          setProvider("square");
        }}
        onDisconnected={() => {
          setSquare({ saved: false });
          if (provider === "square") setProvider(null);
        }}
        slug={slug}
        token={token}
        setActive={() => setProvider("square")}
        isActive={provider === "square"}
      />

      <PaymentLinkCard
        provider={provider}
        setProvider={setProvider}
        linkTemplate={linkTemplate}
        setLinkTemplate={setLinkTemplate}
        linkProviderName={linkProviderName}
        setLinkProviderName={setLinkProviderName}
      />

      <TrustBar />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveGeneral}
          disabled={saving}
          className="inline-flex h-12 items-center rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-wider text-black transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "#FFB300" }}
        >
          {saving ? "Saving…" : "Save active gateway"}
        </button>
        {toast && <p className="text-[12px] font-bold text-brand-muted">{toast}</p>}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────

function StatusHero({
  status,
  activeLabel,
  slug,
  token
}: {
  status: "not_connected" | "live";
  activeLabel: string | null;
  slug: string;
  token: string;
}) {
  const config =
    status === "live"
      ? {
          badge: "LIVE",
          badgeBg: "#0F7A3F",
          title: `Your cart is accepting ${activeLabel} payments`,
          subtitle: `Customers see "Pay now" on the cart. Money settles direct to your ${activeLabel} account. We never touch it.`
        }
      : {
          badge: "NOT LIVE",
          badgeBg: "#525252",
          title: "Add a gateway to accept payments",
          subtitle: "Bring your own Stripe / PayPal / Square account, or paste a hosted-pay link from any UK provider. Zero platform fee, zero approval, funds direct to your bank."
        };
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white"
        style={{ background: config.badgeBg }}
      >
        ● {config.badge}
      </span>
      <h1 className="mt-3 text-[22px] font-extrabold leading-tight text-brand-text sm:text-[26px]">
        {config.title}
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-brand-muted">{config.subtitle}</p>
      {status === "live" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/${slug}/cart`}
            target="_blank"
            className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition hover:opacity-90"
            style={{ background: "#FFB300", color: "#0A0A0A" }}
          >
            Preview cart →
          </Link>
          <Link
            href={`/trade-off/edit/${slug}/orders?token=${encodeURIComponent(token)}`}
            className="inline-flex h-11 items-center rounded-xl border border-brand-line px-4 text-[12px] font-extrabold uppercase tracking-widest text-brand-text transition hover:border-brand-accent"
          >
            View orders →
          </Link>
        </div>
      )}
    </div>
  );
}

function AddonToggleCard({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-line bg-brand-surface p-4">
      <div>
        <p className="text-[13px] font-extrabold text-brand-text">Show &ldquo;Pay Now&rdquo; on cart</p>
        <p className="mt-1 text-[12px] text-brand-muted">Off = WhatsApp Enquire only. On = Pay Now shows alongside it.</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className="inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-brand-line transition"
        style={{ background: enabled ? "#FFB300" : "transparent" }}
      >
        <span
          className="inline-block h-7 w-7 rounded-full bg-white shadow transition"
          style={{ transform: enabled ? "translateX(28px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

// ─── STRIPE CARD ───────────────────────────────────────────────

function StripeCard({
  info,
  onSaved,
  onDisconnected,
  slug,
  token,
  setActive,
  isActive
}: {
  info: StripeInfo;
  onSaved: (i: StripeInfo) => void;
  onDisconnected: () => void;
  slug: string;
  token: string;
  setActive: () => void;
  isActive: boolean;
}) {
  const [secretKey, setSecretKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/payments/byo-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "stripe", slug, token, secret_key: secretKey.trim() })
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        account_name?: string | null;
        country?: string | null;
        charges_enabled?: boolean;
      };
      if (!res.ok || !j.ok) {
        setError(j.detail ?? j.error ?? "Save failed");
        return;
      }
      onSaved({
        saved: true,
        account_name: j.account_name,
        country: j.country,
        charges_enabled: j.charges_enabled,
        mode: secretKey.startsWith("sk_live_") ? "live" : "test",
        masked: `••••${secretKey.slice(-4)}`
      });
      setSecretKey("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Remove Stripe credentials from this app? Your Stripe account is untouched.")) return;
    await fetch("/api/trade-off/payments/byo-disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, token, provider: "stripe" })
    });
    onDisconnected();
  }

  return (
    <ProviderCardShell
      brand="Stripe"
      color="#635BFF"
      glyph={<StripeGlyph />}
      subtitle="Cards + Apple Pay + Google Pay + Klarna + Clearpay via Stripe's hosted checkout"
      isActive={isActive}
      saved={info.saved}
    >
      {info.saved ? (
        <div className="space-y-3">
          <ConnectedSummary
            lines={[
              `${info.account_name ?? "Stripe account"} · ${info.mode === "live" ? "Live mode" : "Test mode"}`,
              info.country ? `Country: ${info.country}` : null,
              info.charges_enabled ? "✓ Charges enabled" : "⚠ Charges not enabled — finish setup in Stripe dashboard"
            ].filter(Boolean) as string[]}
          />
          <ActiveActions
            isActive={isActive}
            onSetActive={setActive}
            onDisconnect={disconnect}
            dashboardHref="https://dashboard.stripe.com/apikeys"
            dashboardLabel="Stripe dashboard"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
              Your Stripe secret key
            </span>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sk_live_… or sk_test_…"
              className="mt-2 block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || secretKey.trim().length === 0}
              className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#635BFF" }}
            >
              {saving ? "Testing key…" : "Connect Stripe"}
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-[12px] font-bold text-brand-muted underline"
            >
              How to find my key
            </button>
          </div>
          {showHelp && (
            <HelpBlock
              steps={[
                <>Log in to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="underline">dashboard.stripe.com/apikeys</a>. If you don&rsquo;t have a Stripe account, create one first (5 min, free).</>,
                <>Under <strong>Standard keys</strong>, click <strong>Reveal live key</strong> (or use test key for sandbox).</>,
                <>Copy the key that starts with <code className="font-mono">sk_live_…</code> or <code className="font-mono">sk_test_…</code>.</>,
                <>Paste it above and click Connect. We test it against Stripe on save, encrypt it before storing, and never show it in full again.</>
              ]}
            />
          )}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </ProviderCardShell>
  );
}

// ─── PAYPAL CARD ───────────────────────────────────────────────

function PaypalCard({
  info,
  onSaved,
  onDisconnected,
  slug,
  token,
  setActive,
  isActive
}: {
  info: PaypalInfo;
  onSaved: (i: PaypalInfo) => void;
  onDisconnected: () => void;
  slug: string;
  token: string;
  setActive: () => void;
  isActive: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [env, setEnv] = useState<"sandbox" | "live">("sandbox");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/payments/byo-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "paypal",
          slug,
          token,
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          env
        })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok || !j.ok) {
        setError(j.detail ?? j.error ?? "Save failed");
        return;
      }
      onSaved({ saved: true, client_id: clientId, env });
      setClientId("");
      setClientSecret("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Remove PayPal credentials from this app?")) return;
    await fetch("/api/trade-off/payments/byo-disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, token, provider: "paypal" })
    });
    onDisconnected();
  }

  return (
    <ProviderCardShell
      brand="PayPal"
      color="#003087"
      glyph={<PaypalGlyph />}
      subtitle="PayPal balance + linked cards on PayPal's hosted checkout"
      isActive={isActive}
      saved={info.saved}
    >
      {info.saved ? (
        <div className="space-y-3">
          <ConnectedSummary
            lines={[
              `Client ID ${info.client_id?.slice(0, 10)}…${info.client_id?.slice(-4)}`,
              info.env === "live" ? "Live mode" : "Sandbox mode"
            ]}
          />
          <ActiveActions
            isActive={isActive}
            onSetActive={setActive}
            onDisconnect={disconnect}
            dashboardHref="https://developer.paypal.com/dashboard/applications/live"
            dashboardLabel="PayPal Developer"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
                Client ID
              </span>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="A…"
                className="mt-2 block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
                Secret
              </span>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="E…"
                className="mt-2 block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
          </div>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Environment</legend>
            <EnvRadio value="sandbox" active={env} onChange={setEnv} label="Sandbox" />
            <EnvRadio value="live" active={env} onChange={setEnv} label="Live" />
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !clientId || !clientSecret}
              className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#003087" }}
            >
              {saving ? "Testing keys…" : "Connect PayPal"}
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-[12px] font-bold text-brand-muted underline"
            >
              How to find my credentials
            </button>
          </div>
          {showHelp && (
            <HelpBlock
              steps={[
                <>Log in to <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noreferrer" className="underline">developer.paypal.com/dashboard</a>. Sign in with your PayPal Business account.</>,
                <>Under <strong>Apps &amp; Credentials</strong>, pick <strong>Sandbox</strong> for testing or <strong>Live</strong> for real payments.</>,
                <>Click <strong>Create App</strong> if you don&rsquo;t have one. Name it &ldquo;xratedtrade&rdquo;. Product type: <strong>Merchant</strong>.</>,
                <>Copy <strong>Client ID</strong> and <strong>Secret</strong>. Paste them above.</>
              ]}
            />
          )}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </ProviderCardShell>
  );
}

// ─── SQUARE CARD ───────────────────────────────────────────────

function SquareCard({
  info,
  onSaved,
  onDisconnected,
  slug,
  token,
  setActive,
  isActive
}: {
  info: SquareInfo;
  onSaved: (i: SquareInfo) => void;
  onDisconnected: () => void;
  slug: string;
  token: string;
  setActive: () => void;
  isActive: boolean;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/payments/byo-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "square",
          slug,
          token,
          access_token: accessToken.trim(),
          location_id: locationId.trim(),
          env
        })
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        location_name?: string | null;
      };
      if (!res.ok || !j.ok) {
        setError(j.detail ?? j.error ?? "Save failed");
        return;
      }
      onSaved({ saved: true, location_id: locationId, location_name: j.location_name, env });
      setAccessToken("");
      setLocationId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Remove Square credentials from this app?")) return;
    await fetch("/api/trade-off/payments/byo-disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, token, provider: "square" })
    });
    onDisconnected();
  }

  return (
    <ProviderCardShell
      brand="Square"
      color="#000000"
      glyph={<SquareGlyph />}
      subtitle="Cards + Apple Pay + Google Pay + Cash App Pay via Square's hosted checkout"
      isActive={isActive}
      saved={info.saved}
    >
      {info.saved ? (
        <div className="space-y-3">
          <ConnectedSummary
            lines={[
              info.location_name ?? "Square location",
              info.env === "production" ? "Production mode" : "Sandbox mode",
              info.country ? `Country: ${info.country}` : null
            ].filter(Boolean) as string[]}
          />
          <ActiveActions
            isActive={isActive}
            onSetActive={setActive}
            onDisconnect={disconnect}
            dashboardHref="https://developer.squareup.com/apps"
            dashboardLabel="Square Developer"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
              Access token
            </span>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAAE…"
              className="mt-2 block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
              Location ID
            </span>
            <input
              type="text"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="LXK…"
              className="mt-2 block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Environment</legend>
            <EnvRadio value="sandbox" active={env} onChange={setEnv} label="Sandbox" />
            <EnvRadio value="production" active={env} onChange={setEnv} label="Production" />
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !accessToken || !locationId}
              className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#000000" }}
            >
              {saving ? "Testing keys…" : "Connect Square"}
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-[12px] font-bold text-brand-muted underline"
            >
              How to find my keys
            </button>
          </div>
          {showHelp && (
            <HelpBlock
              steps={[
                <>Log in to <a href="https://developer.squareup.com/apps" target="_blank" rel="noreferrer" className="underline">developer.squareup.com/apps</a> with your Square account.</>,
                <>Click <strong>+ Create your first app</strong> if you have none. Name it &ldquo;xratedtrade&rdquo;.</>,
                <>Open the app → <strong>Credentials</strong> tab → toggle <strong>Sandbox</strong> or <strong>Production</strong>.</>,
                <>Copy <strong>Access Token</strong> (long string starting EAAA…) and <strong>Default Location ID</strong> (in the Locations tab). Paste both above.</>
              ]}
            />
          )}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </ProviderCardShell>
  );
}

// ─── PAYMENT LINK CARD ─────────────────────────────────────────

function PaymentLinkCard({
  provider,
  setProvider,
  linkTemplate,
  setLinkTemplate,
  linkProviderName,
  setLinkProviderName
}: {
  provider: ProviderKey;
  setProvider: (p: ProviderKey) => void;
  linkTemplate: string;
  setLinkTemplate: (v: string) => void;
  linkProviderName: string;
  setLinkProviderName: (v: string) => void;
}) {
  const isActive = provider === "payment_link";
  const err = linkTemplate.length > 0 ? validatePaymentLinkTemplate(linkTemplate) : null;
  const preview =
    !err && linkTemplate.length > 0
      ? buildPaymentLink({ template: linkTemplate, amountPence: 24750, ref: "ORD-DEMO" })
      : null;
  return (
    <ProviderCardShell
      brand="Any other provider"
      color="#666666"
      glyph={<LinkGlyph />}
      subtitle="Worldpay, SumUp, Mollie, Revolut, Klarna, GoCardless… — paste any hosted-pay link"
      isActive={isActive}
      saved={linkTemplate.trim().length > 0}
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
            Provider name
          </span>
          <input
            list="popular-providers"
            type="text"
            value={linkProviderName}
            onChange={(e) => setLinkProviderName(e.target.value)}
            placeholder="e.g. SumUp"
            className="mt-2 block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
          <datalist id="popular-providers">
            {POPULAR_UK_LINK_PROVIDERS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
            Hosted pay link template
          </span>
          <textarea
            value={linkTemplate}
            onChange={(e) => {
              setLinkTemplate(e.target.value);
              if (e.target.value.trim().length > 0) setProvider("payment_link");
            }}
            rows={3}
            placeholder="https://pay.sumup.com/b2c/MERCHANT?amount={{amount}}&description={{ref}}"
            className="mt-2 block w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
          <p className="mt-2 text-[12px] text-brand-muted">
            Use <code className="font-mono">{`{{amount}}`}</code> for pounds.pence, or{" "}
            <code className="font-mono">{`{{amount_pence}}`}</code> for integer pence. Include{" "}
            <code className="font-mono">{`{{ref}}`}</code> for the order reference.
          </p>
          {err && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">{err}</p>
          )}
        </label>
        {preview && (
          <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
              Preview — where a £247.50 cart sends the customer
            </p>
            <p className="mt-1 break-all font-mono text-[12px] text-brand-text">{preview}</p>
          </div>
        )}
      </div>
    </ProviderCardShell>
  );
}

// ─── SHARED PIECES ─────────────────────────────────────────────

function ProviderCardShell({
  brand,
  color,
  glyph,
  subtitle,
  isActive,
  saved,
  children
}: {
  brand: string;
  color: string;
  glyph: React.ReactNode;
  subtitle: string;
  isActive: boolean;
  saved: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-brand-surface"
      style={{ borderColor: isActive ? "#FFB300" : undefined }}
    >
      <div className="border-b border-brand-line px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg text-white"
              style={{ background: color }}
            >
              {glyph}
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold text-brand-text">{brand}</h2>
              <p className="text-[12px] text-brand-muted">{subtitle}</p>
            </div>
          </div>
          {saved && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: isActive ? "#0F7A3F" : "#404040" }}
            >
              {isActive ? "● Active" : "● Ready"}
            </span>
          )}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function ConnectedSummary({ lines }: { lines: string[] }) {
  return (
    <ul className="rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[12px] text-brand-text">
      {lines.map((l, i) => (
        <li key={i} className="py-0.5">
          {l}
        </li>
      ))}
    </ul>
  );
}

function ActiveActions({
  isActive,
  onSetActive,
  onDisconnect,
  dashboardHref,
  dashboardLabel
}: {
  isActive: boolean;
  onSetActive: () => void;
  onDisconnect: () => void;
  dashboardHref: string;
  dashboardLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSetActive}
        disabled={isActive}
        className="inline-flex h-10 items-center rounded-xl px-3 text-[12px] font-extrabold uppercase tracking-widest transition"
        style={{
          background: isActive ? "#0F7A3F" : "#FFB300",
          color: isActive ? "#FFFFFF" : "#0A0A0A"
        }}
      >
        {isActive ? "✓ Active gateway" : "Set as active"}
      </button>
      <a
        href={dashboardHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center rounded-xl border border-brand-line px-3 text-[12px] font-extrabold uppercase tracking-widest text-brand-text transition hover:border-brand-accent"
      >
        {dashboardLabel} →
      </a>
      <button
        type="button"
        onClick={onDisconnect}
        className="inline-flex h-10 items-center rounded-xl border border-brand-line px-3 text-[12px] font-extrabold uppercase tracking-widest text-red-700 transition hover:border-red-700"
      >
        Disconnect
      </button>
    </div>
  );
}

function EnvRadio<T extends string>({
  value,
  active,
  onChange,
  label
}: {
  value: T;
  active: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const on = value === active;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={on}
      className="inline-flex h-9 items-center rounded-full border px-3 text-[12px] font-extrabold uppercase tracking-widest transition"
      style={{
        background: on ? "#FFB300" : "transparent",
        borderColor: on ? "#FFB300" : "#333",
        color: on ? "#0A0A0A" : "#999"
      }}
    >
      {label}
    </button>
  );
}

function HelpBlock({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="rounded-lg border border-brand-line bg-brand-bg p-3 text-[12px] leading-relaxed text-brand-text">
      {steps.map((s, i) => (
        <li key={i} className="py-1">
          <span className="mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFB300] text-[10px] font-extrabold text-black">
            {i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function TrustBar() {
  const bullets: { title: string; body: string }[] = [
    {
      title: "0% platform fee",
      body: "You pay only your provider&rsquo;s standard fee. We take nothing."
    },
    {
      title: "Direct to you",
      body: "Money settles into your own provider account. Never through xratedtrade."
    },
    {
      title: "Your keys, your control",
      body: "Encrypted AES-256 at rest. You disconnect anytime — one click, keys wiped."
    }
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {bullets.map((b) => (
        <div key={b.title} className="rounded-2xl border border-brand-line bg-brand-surface p-4">
          <p className="text-[12px] font-extrabold uppercase tracking-widest text-[#FFB300]">
            {b.title}
          </p>
          <p
            className="mt-2 text-[12px] leading-relaxed text-brand-muted"
            dangerouslySetInnerHTML={{ __html: b.body }}
          />
        </div>
      ))}
    </div>
  );
}

function UpgradeGate({ upgradeHref }: { upgradeHref: string }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB300]">
        Merchant Pro
      </p>
      <h2 className="mt-2 text-[20px] font-extrabold text-brand-text">
        Online Payments is included in Merchant Pro
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[13px] text-brand-muted">
        £14.99/mo unlocks every merchant add-on including bring-your-own-keys Stripe / PayPal / Square + universal Payment Link mode.
      </p>
      <Link
        href={upgradeHref}
        className="mt-5 inline-flex h-11 items-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-wider text-black transition hover:opacity-90"
        style={{ background: "#FFB300" }}
      >
        Upgrade to Merchant Pro
      </Link>
    </div>
  );
}

// ─── GLYPHS ────────────────────────────────────────────────────

function StripeGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.5 8.5c0-.7.6-1 1.5-1c1.3 0 3 .4 4.3 1.1V4.4c-1.4-.5-2.8-.7-4.3-.7c-3.5 0-5.8 1.8-5.8 4.9c0 4.7 6.5 3.9 6.5 5.9c0 .8-.7 1.1-1.7 1.1c-1.4 0-3.2-.6-4.6-1.4v4.3c1.6.7 3.2 1 4.6 1c3.6 0 6-1.8 6-5c0-5-6.5-4-6.5-6z"
        fill="currentColor"
      />
    </svg>
  );
}

function PaypalGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9.5 3h6.3c2.8 0 4.7 1.5 4 4.7c-.7 3.7-3.4 5.5-6.8 5.5h-2l-.9 5.3c-.1.4-.4.7-.8.7H7.5c-.5 0-.9-.5-.8-1L9 3.6c.1-.4.3-.6.5-.6zm.6 8.3h1.8c1.8 0 3-.9 3.3-2.6c.2-1.1-.5-1.9-1.7-1.9h-2l-.6 4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function SquareGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="rgba(0,0,0,0.4)" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
