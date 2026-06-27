// Hammerex Trade Off — Shop Mode editor.
// Server shell. Validates the magic-link edit_token, loads the listing's
// products + shipping zones, and hands them to the client components.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { effectiveTier } from "@/lib/xratedTrades";
import { isShopModeOn, isWholesaleModeOn } from "@/lib/xratedAddons";
import { ShopModeEditor } from "@/components/trade-off/ShopModeEditor";
import { ShippingZonesEditor } from "@/components/trade-off/ShippingZonesEditor";
import type {
  HammerexXratedProduct,
  HammerexXratedShippingZone
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop Mode editor | Hammerex Trade Off",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffShopModeEditPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!slug || !token) return <InvalidLink reason="missing-token" />;

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, edit_token, display_name, primary_trade, tier, trial_expires_at, addons_enabled"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid";
  const addonsMap =
    row.data.addons_enabled && typeof row.data.addons_enabled === "object"
      ? (row.data.addons_enabled as Record<string, boolean>)
      : {};
  // Include primary_trade + tier so merchant-grade trades (kitchen-fitter,
  // building-merchant, tool-hire, etc.) read as Shop Mode on automatically
  // — see isShopModeOn in src/lib/xratedAddons.ts.
  const shopOn = isShopModeOn({
    addons_enabled: addonsMap,
    primary_trade: row.data.primary_trade ?? null,
    tier: row.data.tier ?? "standard"
  });
  const wholesaleOn = isWholesaleModeOn({ addons_enabled: addonsMap });

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

  const productsRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", row.data.id)
    .order("status", { ascending: true })
    .order("sort_order", { ascending: true });
  const products = (productsRes.data ?? []) as HammerexXratedProduct[];
  const liveCount = products.filter((p) => p.status === "live").length;

  const zonesRes = await supabaseAdmin
    .from("hammerex_xrated_shipping_zones")
    .select("*")
    .eq("listing_id", row.data.id)
    .order("sort_order", { ascending: true });
  const zones = (zonesRes.data ?? []) as HammerexXratedShippingZone[];

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-xs font-bold text-brand-muted transition hover:text-brand-accent"
        >
          ← Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Add-on · Shop Mode
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Shop Mode — your products
        </h1>
        <p className="mt-3 text-xs text-brand-muted">
          {liveCount} live product{liveCount === 1 ? "" : "s"} ·{" "}
          {isPaid && shopOn
            ? "Add-on £5/mo · active"
            : isPaid
              ? "Toggle Shop Mode on from your dashboard to go live"
              : "Upgrade to enable Shop Mode"}
        </p>
      </section>

      {!isPaid && (
        <section className="mx-auto max-w-3xl px-4 pb-6">
          <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4">
            <p className="text-sm font-bold text-brand-accent">
              Shop Mode is a paid add-on
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              You can set products up now — they go live once you upgrade and
              switch Shop Mode on from your dashboard.
            </p>
            <Link
              href={upgradeHref}
              className="mt-3 inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
            >
              See upgrade options →
            </Link>
          </div>
        </section>
      )}

      {wholesaleOn && (
        <section className="mx-auto max-w-3xl px-4 pb-4">
          <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
              Shipping mode
            </p>
            <p className="mt-2 text-sm font-bold text-brand-text">
              You have Wholesale Mode on — choose how customers see shipping.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="inline-flex h-11 flex-1 items-center rounded-lg border border-brand-accent bg-brand-accent/20 px-3 text-[13px] font-bold text-brand-text">
                <input
                  type="radio"
                  name="shipping_mode_view"
                  checked
                  readOnly
                  className="mr-2 h-4 w-4 accent-brand-accent"
                />
                National shipping (countries / air &amp; sea)
              </div>
              <Link
                href={`/trade-off/edit/${encodeURIComponent(slug)}/wholesale-mode?token=${encodeURIComponent(token)}`}
                className="inline-flex h-11 flex-1 items-center rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
              >
                <input
                  type="radio"
                  name="shipping_mode_view"
                  readOnly
                  className="mr-2 h-4 w-4 accent-brand-accent"
                />
                Local vans (banded distance) &rarr;
              </Link>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-brand-muted">
              Both configs persist — UI switches which one customers see at checkout.
            </p>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-10">
        <ShopModeEditor
          slug={slug}
          editToken={token}
          initialProducts={products}
        />
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <ShippingZonesEditor
          slug={slug}
          editToken={token}
          initialZones={zones}
        />
      </section>
      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Hammerex — I'm trying to edit my Shop Mode but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Trade Off
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-xs text-brand-muted">
          The URL you used doesn&rsquo;t match a live profile. Double-check the
          link in your bookmarks — the token after <code>?token=</code> must be
          exact.
        </p>
        <p className="mt-2 text-[11px] text-brand-muted">Reference: {reason}</p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-xs font-bold text-white transition hover:opacity-90"
        >
          Message Hammerex on WhatsApp
        </a>
      </section>
      <XratedFooter />
    </main>
  );
}
