// thenetworkers.app — Key Cutting service editor.
//
// Merchant enables / prices the 8 key categories, picks fulfilment
// modes (walk-in / photo-scan / postal), sets machine brand, years,
// postal address + turnaround, restricted-key dealer status, banner
// image and any custom copy.

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { KeyCuttingEditor } from "@/components/trade-off/KeyCuttingEditor";
import { normaliseKeyCuttingConfig } from "@/lib/keyCutting";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Key Cutting | thenetworkers.app",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function KeyCuttingEditPage({
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
    .select("id, slug, edit_token, display_name, key_cutting")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
  const initial = normaliseKeyCuttingConfig(row.data.key_cutting);

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
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
          Add-on &middot; Key Cutting
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Key Cutting
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] text-brand-muted">
          Enable the categories you actually cut, set a &ldquo;from&rdquo;
          price on each, and pick your fulfilment modes. Everything else
          is optional — banner, machine brand, years of experience,
          restricted-key dealer status, postal address and custom copy
          all render on your public /<span className="font-mono">{slug}</span>/key-cutting page.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/${slug}/key-cutting`}
            target="_blank"
            className="inline-flex h-11 items-center rounded-xl bg-brand-accent px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
          >
            Preview live →
          </Link>
        </div>
      </section>

      <KeyCuttingEditor slug={slug} token={token} initial={initial} />

      <DashboardFooter slug={slug} token={token} />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-md px-4 pb-24 pt-16 text-center">
        <h1 className="text-2xl font-extrabold">Link expired or invalid</h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          Re-open your dashboard from the link in your email. ({reason})
        </p>
      </section>
    </main>
  );
}
