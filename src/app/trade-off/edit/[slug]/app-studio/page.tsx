// App Studio — visual customisation sub-page.
// Token-validates like the parent edit page, then renders the
// AppStudioPanel inside the shared dashboard chrome (header +
// drawer + footer). Lives at /trade-off/edit/[slug]/app-studio.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { DashboardDrawer } from "@/components/trade-off/DashboardDrawer";
import { LivePreviewIframe } from "@/components/trade-off/LivePreviewIframe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";
import { AppStudioPanel } from "./AppStudioPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "App Studio | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function AppStudioPage({
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

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <DashboardDrawer slug={slug} token={token} current="app-studio" />

      <section className="mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          App Studio
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Make {row.data.display_name} look like yours
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-500 sm:text-sm">
          Everything that changes how your profile <em>looks</em> lives
          here. Edit hero text, animations, colours, and tickers — your
          services, prices, hours and trust details stay on the main
          dashboard. Changes save instantly to your live profile.
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

      {/* Two-column workspace — form left, live preview right on lg+.
          Mobile / tablet stack: the iframe self-hides (`hidden lg:block`)
          and tradespeople tap "View live" in the sticky save bar
          instead. */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
          <AppStudioPanel
            slug={slug}
            editToken={token}
            liveHref={`/${slug}`}
            initial={{
            theme_color: row.data.theme_color ?? "#FFB300",
            body_text_color: row.data.body_text_color ?? "#0A0A0A",
            font_family: row.data.font_family ?? "system",
            font_scale: row.data.font_scale ?? "normal",
            button_text_color: row.data.button_text_color ?? "#FFFFFF",
            cta_button_effect: row.data.cta_button_effect ?? "none",
            hero_text_line1: row.data.hero_text_line1 ?? "",
            hero_text_line2: row.data.hero_text_line2 ?? "",
            hero_text_line2_color: row.data.hero_text_line2_color ?? "#FFB300",
            hero_text_tagline: row.data.hero_text_tagline ?? "",
            hero_text_effect: row.data.hero_text_effect ?? "none",
            avatar_frame_style: row.data.avatar_frame_style ?? "none",
            profile_placement: row.data.profile_placement ?? "center",
            running_marquee: row.data.running_marquee ?? "",
            promo_text: row.data.promo_text ?? ""
          }}
        />
          <LivePreviewIframe slug={slug} />
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: "missing-token" | "not-found" | "bad-token" }) {
  const adminWaDigits = whatsappDigits(adminWhatsapp());
  const waUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    "Hi Xrated Trades — I need help opening the App Studio."
  )}`;
  const reasonCopy: Record<typeof reason, string> = {
    "missing-token":
      "This App Studio link is missing its secure token. Use the link in your welcome email or message us to get a new one.",
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
          App Studio
        </p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
          We need a valid link.
        </h1>
        <p className="mt-3 text-[13px] text-neutral-500">{reasonCopy[reason]}</p>
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
