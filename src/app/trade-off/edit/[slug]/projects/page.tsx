// Hammerex Trade Off — verified work gallery editor.
// Server shell. Validates the magic-link edit_token, loads the listing's
// projects, and hands them to <ProjectManager />.
//
// If the token is missing or invalid, we render a friendly error with a
// WhatsApp escape hatch — same pattern as /trade-off/edit/[slug].

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { ProjectManager } from "@/components/trade-off/ProjectManager";
import type { HammerexTradeOffProject } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage your verified work | Hammerex Trade Off",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffProjectsEditPage({
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
    .select("id, slug, edit_token, display_name, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const projectsRes = await supabaseAdmin
    .from("hammerex_trade_off_projects")
    .select("*")
    .eq("listing_id", row.data.id)
    .order("sort_order", { ascending: false });

  const projects = (projectsRes.data ?? []) as HammerexTradeOffProject[];

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Trade Off · Verified work
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          {row.data.display_name}
        </h1>
        <p className="mt-3 text-xs text-brand-muted">
          Show off real projects. Hammerex reviews and verifies them — verified work earns a green
          badge customers can trust.
        </p>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <ProjectManager slug={slug} editToken={token} initialProjects={projects} />
      </section>
      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Hammerex — I'm trying to manage my verified work but my link isn't working. Can you help?"
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
          The URL you used doesn't match a live profile. Double-check the link in your
          bookmarks — the token after <code>?token=</code> must be exact.
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
