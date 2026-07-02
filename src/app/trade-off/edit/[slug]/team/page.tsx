// xratedtrade.com — Meet the Team editor.
//
// Merchant adds up to 10 team members. First entry is the Boss (pinned
// in slot 0 of TeamGrid). Slots 2-4 auto-rotate through the rest of
// the roster. Each member: avatar upload, name, role, years, up to 5
// skills, optional direct-dial phone.

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TeamEditor } from "@/components/trade-off/TeamEditor";
import type { HammerexTradeOffListing } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meet the Team | xratedtrade.com",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TeamEditPage({
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
    .select("id, slug, edit_token, display_name, team_members")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
  const initial = Array.isArray(row.data.team_members)
    ? (row.data.team_members as HammerexTradeOffListing["team_members"])
    : [];

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
          Add-on &middot; Meet the Team
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Meet the Team
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] text-brand-muted">
          First person on the list is the <strong>Boss</strong> — pinned in
          slot 1 of the on-profile grid, never rotates. Slots 2, 3 and 4
          auto-rotate every 1.7 seconds through the rest of the roster so
          every team member gets airtime. Add photos, skills, years of
          experience, and — if they have one — the team member&rsquo;s direct
          dial line.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/${slug}`}
            target="_blank"
            className="inline-flex h-11 items-center rounded-xl bg-brand-accent px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
          >
            Preview live →
          </Link>
        </div>
      </section>

      <TeamEditor slug={slug} token={token} initial={initial} />

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
