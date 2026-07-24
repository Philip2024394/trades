// /admin/nex/marketing — platform-wide social health.
// Counts of connected businesses, posts by state, published, failed,
// auto-publish adoption.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nex Marketing · Admin", robots: { index: false } };

export default async function Page() {
  const [
    { count: connected = 0 },
    { count: autoOn    = 0 },
    { data: postCounts = [] },
    { data: recentPublished = [] },
    { data: recentFailed = [] }
  ] = await Promise.all([
    supabaseAdmin.from("hammerex_nex_social_accounts").select("*", { count: "exact", head: true }).eq("status", "connected"),
    supabaseAdmin.from("hammerex_trade_off_listings").select("*", { count: "exact", head: true }).eq("auto_publish_enabled", true),
    supabaseAdmin.rpc("fn_nothing_here_yet").then(() => ({ data: [] as { status: string; count: number }[] })).catch(() => ({ data: [] })),
    supabaseAdmin.from("hammerex_nex_social_posts").select("id, merchant_slug, platform, headline, caption, published_at").eq("status", "published").order("published_at", { ascending: false }).limit(10),
    supabaseAdmin.from("hammerex_nex_social_posts").select("id, merchant_slug, platform, publish_error, updated_at").eq("status", "failed").order("updated_at", { ascending: false }).limit(10)
  ]);

  // Counts per status via a plain query since we don't have an RPC.
  const { data: statusRows } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("status");
  const bucket: Record<string, number> = {};
  for (const r of statusRows ?? []) bucket[r.status] = (bucket[r.status] ?? 0) + 1;

  void postCounts;

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Marketing</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Platform-wide view of social posting. Approval + auto-publish gates apply per merchant.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/review"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Review</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Connected accounts" value={connected}/>
          <Stat label="Auto-publish on"    value={autoOn}/>
          <Stat label="Awaiting approval"  value={bucket.awaiting_approval ?? 0}/>
          <Stat label="Scheduled"          value={bucket.scheduled ?? 0}/>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">Recent published</p>
            {recentPublished.length === 0 && <p className="text-[12px] text-neutral-500">Nothing published yet.</p>}
            {recentPublished.map((p) => (
              <div key={p.id} className="border-t border-neutral-100 py-1 text-[12px]">
                <p className="font-black">{p.merchant_slug} · {p.platform}</p>
                <p className="text-neutral-600 line-clamp-1">{p.headline ?? p.caption}</p>
                <p className="text-[10px] text-neutral-500">{p.published_at && new Date(p.published_at).toLocaleString("en-GB")}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">Recent failures</p>
            {recentFailed.length === 0 && <p className="text-[12px] text-neutral-500">No failures. Good.</p>}
            {recentFailed.map((p) => (
              <div key={p.id} className="border-t border-neutral-100 py-1 text-[12px]">
                <p className="font-black">{p.merchant_slug} · {p.platform}</p>
                <p className="text-red-700 line-clamp-1">{p.publish_error ?? "unknown"}</p>
                <p className="text-[10px] text-neutral-500">{new Date(p.updated_at).toLocaleString("en-GB")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-[22px] font-black">{value}</p>
    </div>
  );
}
