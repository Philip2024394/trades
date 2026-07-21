// /admin/merchants/[slug] — merchant/trade detail + admin actions.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ShieldOff, MapPin, Calendar, Wrench, ExternalLink } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MerchantSuspendButton } from "./MerchantSuspendButton";

export const dynamic = "force-dynamic";

export default async function AdminMerchantDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const auth = await assertAdminRole(["admin", "moderator", "support"]);
  if (!auth.ok) redirect("/admin/login");

  const { slug } = await params;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, business_name, primary_trade, city, status, tier, created_at, updated_at, suspended_at, suspended_reason")
    .eq("slug", slug)
    .maybeSingle();
  const m = res.data as {
    id: string; slug: string; business_name: string | null;
    primary_trade: string | null; city: string | null;
    status: string | null; tier: string | null;
    created_at: string; updated_at: string | null;
    suspended_at: string | null; suspended_reason: string | null;
  } | null;
  if (!m) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin/merchants" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-600 hover:text-neutral-900">
          <ArrowLeft size={11}/> All merchants
        </Link>

        <div className="mt-3 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-black text-neutral-900">{m.business_name || m.slug}</h1>
            <p className="mt-1 text-[12.5px] text-neutral-600">
              /{m.slug} ·{" "}
              <Link href={`/${m.slug}`} target="_blank" className="inline-flex items-center gap-0.5 underline">
                View live <ExternalLink size={10}/>
              </Link>
            </p>
          </div>
          {m.suspended_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-red-800">
              <ShieldOff size={11}/> Suspended
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-green-800">
              Active
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border-2 bg-white p-4 shadow-sm sm:grid-cols-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <Field icon={<Wrench size={12}/>}   label="Trade"    value={m.primary_trade || "—"}/>
          <Field icon={<MapPin size={12}/>}   label="City"     value={m.city || "—"}/>
          <Field icon={<Calendar size={12}/>} label="Joined"   value={new Date(m.created_at).toLocaleDateString("en-GB")}/>
          <Field icon={<Wrench size={12}/>}   label="Tier"     value={m.tier || "free"}/>
          <Field icon={<Wrench size={12}/>}   label="Status"   value={m.status || "—"}/>
          <Field icon={<Calendar size={12}/>} label="Updated"  value={m.updated_at ? new Date(m.updated_at).toLocaleDateString("en-GB") : "—"}/>
        </div>

        <div className="mt-3 rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: m.suspended_at ? "#B91C1C" : "rgba(0,0,0,0.08)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">Admin actions</p>
              {m.suspended_at && (
                <p className="mt-1 text-[12px] text-neutral-700">
                  Suspended {new Date(m.suspended_at).toLocaleString("en-GB")}
                  {m.suspended_reason && <> · reason: <span className="italic">{m.suspended_reason}</span></>}
                </p>
              )}
            </div>
            <MerchantSuspendButton slug={m.slug} isSuspended={!!m.suspended_at}/>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[12.5px]">
      <span className="text-neutral-400">{icon}</span>
      <span className="w-20 text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="min-w-0 flex-1 truncate font-black text-neutral-800">{value}</span>
    </div>
  );
}
