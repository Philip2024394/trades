// /beacon-join/[slug] — Public bait landing for prospective merchants.
//
// A shareable URL admin sends to non-joined trades. Renders the
// anonymised enquiry (trade + city + brief) with a "join in 60
// seconds and claim this lead" CTA. Contact details ONLY unlock
// after the trade joins.
//
// SEO: robots noindex — bait links are private outreach, not for
// Google indexing.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tradeLabel } from "@/lib/tradeOff";

export const revalidate = 60;

export const metadata: Metadata = {
  title:  "Real job on The Network — join to claim",
  robots: { index: false, follow: false }
};

type LandingData = {
  tradeSlug:   string;
  tradeLabel:  string;
  city:        string | null;
  brief:       string;
  hoursOld:    number;
  fresh:       boolean;
};

async function loadLanding(slug: string): Promise<LandingData | null> {
  const res = await supabaseAdmin
    .from("hammerex_beacon_admin_residuals")
    .select(`
      escalated_at,
      beacon:hammerex_xrated_project_beacons!inner (
        trade_slug, customer_city, project_description, sent_at
      )
    `)
    .eq("bait_link_slug", slug)
    .maybeSingle();
  if (res.error || !res.data) return null;
  const b = (res.data as { beacon: { trade_slug: string; customer_city: string | null; project_description: string; sent_at: string } }).beacon;
  const hoursOld = Math.round((Date.now() - new Date(b.sent_at).getTime()) / 3600000);
  return {
    tradeSlug:  b.trade_slug,
    tradeLabel: tradeLabel(b.trade_slug),
    city:       b.customer_city,
    brief:      b.project_description.slice(0, 220),
    hoursOld,
    fresh:      hoursOld < 48
  };
}

export default async function BeaconJoinLanding({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadLanding(slug);
  if (!data) notFound();

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="mb-2 inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
          <span className="text-[12px] font-black text-neutral-900">The Network</span>
        </div>

        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#B8860B]">
          {data.fresh ? "Live enquiry" : "Recent enquiry"} · {data.hoursOld}h ago
        </p>
        <h1 className="mt-2 text-[26px] font-black leading-tight text-neutral-900">
          Real {data.tradeLabel.toLowerCase()} job {data.city ? `in ${data.city}` : "in the UK"}
        </h1>
        <p className="mt-3 rounded-2xl border bg-white p-4 text-[14px] leading-relaxed text-neutral-800" style={{ borderColor: "rgba(184,134,11,0.30)" }}>
          &quot;{data.brief}{data.brief.length >= 220 ? "…" : ""}&quot;
        </p>

        <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "rgba(22,101,52,0.30)", backgroundColor: "#ECFDF5" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#166534]">
            Join to claim
          </p>
          <p className="mt-1 text-[14px] font-black text-neutral-900">
            Sign up in under 2 minutes
          </p>
          <ul className="mt-3 space-y-1.5 text-[12px] text-neutral-700">
            <li>· Free for life — your own trade page + URL</li>
            <li>· No lead fees, no bidding wars, no commission</li>
            <li>· {data.fresh ? "Get this enquiry's contact when you sign up" : "See how it works with real jobs"}</li>
          </ul>
          <Link
            href={`/trade-off/signup?trade=${encodeURIComponent(data.tradeSlug)}${data.city ? `&city=${encodeURIComponent(data.city)}` : ""}&mref=beacon-${slug}`}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full text-[13px] font-black uppercase tracking-wider text-white transition hover:brightness-95"
            style={{ backgroundColor: "#166534" }}
          >
            Join The Network — free →
          </Link>
        </div>

        <p className="mt-6 text-[11px] leading-snug text-neutral-500">
          {data.fresh
            ? "Sign up in the next 48h and this enquiry's contact will be routed to your inbox as your first lead."
            : "This specific enquiry may already be claimed, but you'll see how The Network sends real jobs to trades every day."}
        </p>
      </div>
    </main>
  );
}
