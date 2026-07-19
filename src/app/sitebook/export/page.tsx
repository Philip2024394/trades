// /sitebook/export — buy an export bundle (£9.99).
//
// Simple stub — real Stripe checkout wired in the API endpoint.
// PDF generation happens after payment webhook confirms.

import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export default async function ExportPage() {
  const homeowner = (await getHomeownerFromCookie())!;
  const [projRes, expRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("id,title,status").eq("homeowner_id", homeowner.id),
    supabaseAdmin.from("hammerex_sitebook_exports").select("*").eq("homeowner_id", homeowner.id).order("created_at", { ascending: false }).limit(10)
  ]);
  const projects = (projRes.data ?? []) as Array<{ id: string; title: string; status: string }>;
  const exports_ = (expRes.data ?? []) as Array<{ id: string; status: string; created_at: string; download_url: string | null; download_expires_at: string | null }>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/sitebook" className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← Back to SiteBook</Link>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Export</p>
        <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">Take your SiteBook with you.</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-neutral-600">
          Download your complete SiteBook as a PDF + photo ZIP. Transfer it to a house buyer when you sell. Keep it forever.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border-2 bg-white p-6" style={{ borderColor: BRAND_YELLOW }}>
        <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Full export bundle</p>
        <p className="mt-1 text-[32px] font-black text-neutral-900">£9.99</p>
        <p className="mt-1 text-[11.5px] text-neutral-500">One-off. Includes ALL {projects.length} projects.</p>
        <ul className="mt-4 space-y-1.5 text-[12.5px] text-neutral-700">
          <li>· Complete PDF with every project, quote, message, warranty, invoice</li>
          <li>· ZIP of all photos in original resolution</li>
          <li>· Notarised timestamp (proof of records at export date)</li>
          <li>· Redownload for 12 months</li>
        </ul>
        <form action="/api/homeowner/export/checkout" method="POST" className="mt-5">
          <button className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-sm" style={{ backgroundColor: BRAND_GREEN }}>
            Buy export — £9.99 →
          </button>
        </form>
      </div>

      {exports_.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">Past exports</h2>
          <ul className="mt-3 space-y-2">
            {exports_.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between rounded-xl border-2 bg-white p-3 text-[12px]" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <span>{new Date(e.created_at).toLocaleDateString("en-GB")} · <span className="font-black">{e.status}</span></span>
                {e.download_url && e.status !== "expired" && (
                  <a href={e.download_url} className="font-black text-neutral-900 underline">Download →</a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
