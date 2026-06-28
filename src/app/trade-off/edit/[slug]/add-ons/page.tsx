// Add-ons sub-page. Hosts the AddOnsHub away from the main Profile
// dashboard so the create / edit flow stays focused on essentials —
// add-ons are progressive enhancement, not part of getting your first
// app live. Reachable via the side drawer on any dashboard page.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { DashboardDrawer } from "@/components/trade-off/DashboardDrawer";
import { AddOnsHub } from "@/components/trade-off/AddOnsHub";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { maybeExpireListingTier } from "@/lib/xratedTier";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add-ons | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function AddOnsEditPage({
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
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  await maybeExpireListingTier(row.data.id);
  const refreshed = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("id", row.data.id)
    .maybeSingle();
  if (refreshed.data) row.data = refreshed.data;

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <DashboardDrawer slug={slug} token={token} current="add-ons" />

      <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Add-ons
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Make {row.data.display_name} do more
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-500 sm:text-sm">
          Your base profile already works. Add-ons layer on top — sell
          products, point your own domain, get SMS lead alerts. Stack
          any combination. Toggle on, pay only for what&rsquo;s on.
        </p>
        <p className="mt-3 text-[13px] text-neutral-500">
          <Link
            href={`/trade-off/edit/${slug}?token=${encodeURIComponent(token)}`}
            className="font-bold text-neutral-900 underline-offset-4 hover:underline"
          >
            ← Back to profile dashboard
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <AddOnsHub listing={row.data} editToken={token} tier={tier} />
      </section>

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: "missing-token" | "not-found" | "bad-token" }) {
  const adminWaDigits = whatsappDigits(adminWhatsapp());
  const waUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    "Hi Xrated Trades — I need help opening Add-ons."
  )}`;
  const copy: Record<typeof reason, string> = {
    "missing-token":
      "This Add-ons link is missing its secure token. Use the link in your welcome email or message us to get a new one.",
    "not-found":
      "We couldn't find this listing. Double-check the URL or message us.",
    "bad-token":
      "This token doesn't match. Use the original link in your welcome email, or message us for a fresh one."
  };
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Add-ons
        </p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
          We need a valid link.
        </h1>
        <p className="mt-3 text-[13px] text-neutral-500">{copy[reason]}</p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-extrabold text-white shadow-lg"
          style={{ background: "#0F7A3F" }}
        >
          Message us on WhatsApp
        </a>
      </section>
      <XratedFooter />
    </main>
  );
}
