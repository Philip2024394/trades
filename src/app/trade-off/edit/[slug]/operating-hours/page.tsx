// Xrated Trades — standalone Operating Hours editor sub-route.
//
// Validates the magic-link edit_token, loads operating_hours from the
// listing, and hands it to <OperatingHoursEditor> (client). Available
// to every tier — the AvailabilityPill on the public profile reads
// these hours regardless of paid status.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { OperatingHoursEditor } from "@/components/trade-off/OperatingHoursEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operating hours | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffOperatingHoursPage({
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
    .select("id, slug, edit_token, display_name, operating_hours")
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token)
    return <InvalidLink reason="bad-token" />;

  const initialHours =
    row.data.operating_hours &&
    typeof row.data.operating_hours === "object"
      ? (row.data.operating_hours as Record<
          string,
          { open: string; close: string } | null
        >)
      : null;

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-[13px] font-bold text-brand-muted transition hover:text-brand-accent"
        >
          &larr; Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-[13px] font-bold uppercase tracking-widest text-brand-accent">
          Profile basics &middot; Operating hours
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          When are you open?
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          Mon–Sun open + close. Customers see a live{" "}
          <span className="font-bold text-brand-text">Available now</span> or{" "}
          <span className="font-bold text-brand-text">
            Back online at 7:00 AM
          </span>{" "}
          badge on the Enquire button based on these hours.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <OperatingHoursEditor
          slug={slug}
          editToken={token}
          initialHours={initialHours}
        />
      </section>

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Xrated — I'm trying to edit my operating hours but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-[13px] font-bold uppercase tracking-widest text-brand-accent">
          Xrated Trades
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-[13px] text-brand-muted">
          The URL you used doesn&rsquo;t match a live profile. Double-check
          the link in your bookmarks &mdash; the token after{" "}
          <code>?token=</code> must be exact.
        </p>
        <p className="mt-2 text-[11px] text-brand-muted">
          Reference: {reason}
        </p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-[13px] font-bold text-white transition hover:opacity-90"
        >
          Message Xrated on WhatsApp
        </a>
      </section>
      <XratedFooter />
    </main>
  );
}
