// Xrated Trades — FAQ Page editor.
//
// Server shell. Validates the magic-link edit_token, loads the listing's
// FAQ items + images, and hands them to <FaqPageEditor> (client). The
// editor surface mirrors DownloadsEditor: yellow eyebrow + h1, top-of-
// page upgrade nudge for free profiles, FAQ list with drag-reorder,
// per-FAQ form with image upload.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { effectiveTier } from "@/lib/xratedTrades";
import { isFaqPageOn } from "@/lib/xratedAddons";
import { FaqPageEditor } from "@/components/trade-off/FaqPageEditor";
import type {
  HammerexXratedFaqItem,
  HammerexXratedFaqImage
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ Page editor | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffFaqPageEditPage({
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
      "id, slug, edit_token, display_name, tier, trial_expires_at, addons_enabled"
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
  const faqOn = isFaqPageOn({
    addons_enabled:
      row.data.addons_enabled && typeof row.data.addons_enabled === "object"
        ? (row.data.addons_enabled as Record<string, boolean>)
        : {}
  });

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

  const faqRes = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("*")
    .eq("listing_id", row.data.id)
    .order("status", { ascending: true })
    .order("sort_order", { ascending: true });
  const faqs = (faqRes.data ?? []) as HammerexXratedFaqItem[];

  let imagesByFaq: Record<string, HammerexXratedFaqImage[]> = {};
  if (faqs.length > 0) {
    const imgRes = await supabaseAdmin
      .from("hammerex_xrated_faq_images")
      .select("*")
      .in("faq_id", faqs.map((f) => f.id))
      .order("sort_order", { ascending: true });
    imagesByFaq = ((imgRes.data ?? []) as HammerexXratedFaqImage[]).reduce<
      Record<string, HammerexXratedFaqImage[]>
    >((acc, img) => {
      (acc[img.faq_id] = acc[img.faq_id] ?? []).push(img);
      return acc;
    }, {});
  }

  const initialFaqs = faqs.map((f) => ({
    ...f,
    images: imagesByFaq[f.id] ?? []
  }));
  const liveCount = initialFaqs.filter((f) => f.status === "live").length;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-xs font-bold text-brand-muted transition hover:text-brand-accent"
        >
          &larr; Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Add-on &middot; FAQ Page
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Your visual knowledge base
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          {liveCount} live FAQ{liveCount === 1 ? "" : "s"} &middot;{" "}
          {isPaid && faqOn
            ? "Add-on £2/mo · active"
            : isPaid
              ? "Toggle FAQ Page on from your dashboard to go live"
              : "Upgrade to enable FAQ Page"}
        </p>
      </section>

      {!isPaid && (
        <section className="mx-auto max-w-3xl px-4 pb-6">
          <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4">
            <p className="text-sm font-bold text-brand-accent">
              FAQ Page is a paid add-on
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              You can draft FAQs now &mdash; they go live once you upgrade
              and switch FAQ Page on from your dashboard.
            </p>
            <Link
              href={upgradeHref}
              className="mt-3 inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
            >
              See upgrade options &rarr;
            </Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <FaqPageEditor
          slug={slug}
          editToken={token}
          initialFaqs={initialFaqs}
        />
      </section>

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Xrated — I'm trying to edit my FAQ Page but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Xrated Trades
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-xs text-brand-muted">
          The URL you used doesn&rsquo;t match a live profile. Double-check
          the link in your bookmarks &mdash; the token after{" "}
          <code>?token=</code> must be exact.
        </p>
        <p className="mt-2 text-[11px] text-brand-muted">Reference: {reason}</p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-xs font-bold text-white transition hover:opacity-90"
        >
          Message Xrated on WhatsApp
        </a>
      </section>
      <XratedFooter />
    </main>
  );
}
