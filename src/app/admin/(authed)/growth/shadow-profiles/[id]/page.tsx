// /admin/growth/shadow-profiles/[id] — single shadow profile inspector.
//
// Full record view + email event log + preview of each drip template
// with this merchant's personalization applied. Useful for debugging
// tone/personalization before scaling sends.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TEMPLATES } from "@/lib/shadowMerchants/templates";
import { buildEmailContext } from "@/lib/shadowMerchants/personalizer";
import type { ShadowMerchant } from "@/lib/shadowMerchants/types";

export const dynamic = "force-dynamic";

export default async function ShadowProfileDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthed())) {
    const { id } = await params;
    redirect(`/admin/login?next=/admin/growth/shadow-profiles/${id}`);
  }
  const { id } = await params;

  const [merchantRes, eventsRes] = await Promise.all([
    supabaseAdmin.from("hammerex_shadow_merchants").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("hammerex_shadow_email_events")
      .select("*")
      .eq("shadow_merchant_id", id)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  if (merchantRes.error || !merchantRes.data) notFound();
  const merchant = merchantRes.data as ShadowMerchant;
  const events   = (eventsRes.data as Array<{ id: string; step_index: number; event_type: string; message_id: string | null; created_at: string; metadata: Record<string, unknown> | null }>) ?? [];

  const ctx = await buildEmailContext(merchant);
  const previews = TEMPLATES.map((t) => ({
    stepIndex: t.stepIndex,
    slug:      t.slug,
    subject:   t.subject(ctx),
    body:      t.body(ctx)
  }));

  return (
    <main className="min-h-screen bg-neutral-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Admin · Shadow scraper · Profile</p>
            <h1 className="mt-1 text-2xl font-black text-neutral-900">{merchant.business_name}</h1>
            <p className="mt-1 text-[12px] text-neutral-500">
              <code className="rounded bg-neutral-100 px-1">{merchant.reserved_slug}</code> · {merchant.trade_type || "—"} · {merchant.city || "—"}
            </p>
          </div>
          <Link href="/admin/growth/shadow-profiles/queue" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider hover:bg-neutral-100">← Queue</Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Record */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Record</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px]">
              <Row k="Status"          v={merchant.status}/>
              <Row k="Source"          v={merchant.source}/>
              <Row k="Source ref"      v={merchant.source_ref || "—"}/>
              <Row k="Email"           v={merchant.email || "—"}/>
              <Row k="Phone"           v={merchant.phone || "—"}/>
              <Row k="Website"         v={merchant.website || "—"}/>
              <Row k="Postcode"        v={merchant.postcode || "—"}/>
              <Row k="Address"         v={merchant.address_line || "—"}/>
              <Row k="Companies House" v={merchant.companies_house_number || "—"}/>
              <Row k="Years established" v={merchant.years_established?.toString() || "—"}/>
              <Row k="Next step"       v={`${merchant.next_step_index} / 6`}/>
              <Row k="Next due"        v={merchant.next_step_due_at ? new Date(merchant.next_step_due_at).toLocaleString("en-GB") : "—"}/>
              <Row k="Last sent"       v={merchant.last_step_sent_at ? new Date(merchant.last_step_sent_at).toLocaleString("en-GB") : "—"}/>
              <Row k="Claimed at"      v={merchant.claimed_at ? new Date(merchant.claimed_at).toLocaleString("en-GB") : "—"}/>
            </dl>
          </section>

          {/* Event log */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Email events ({events.length})</p>
            {events.length === 0 ? (
              <p className="mt-3 text-[12px] text-neutral-500">No events logged yet.</p>
            ) : (
              <ul className="mt-3 max-h-96 divide-y divide-neutral-100 overflow-y-auto">
                {events.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3 py-2 text-[11.5px]">
                    <div className="min-w-0">
                      <span className="font-black text-neutral-900">{e.event_type}</span>
                      <span className="ml-2 text-neutral-500">step {e.step_index}</span>
                      {e.message_id && <span className="ml-2 truncate text-[10px] text-neutral-400">{e.message_id}</span>}
                    </div>
                    <span className="whitespace-nowrap text-[10.5px] text-neutral-500">
                      {new Date(e.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Template previews */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Sequence previews (personalized for this merchant)</p>
          <div className="mt-4 space-y-4">
            {previews.map((p) => (
              <details key={p.stepIndex} className="rounded-lg border border-neutral-200 p-3">
                <summary className="cursor-pointer text-[12px] font-black text-neutral-900">
                  Step {p.stepIndex} · {p.slug} · <span className="font-normal text-neutral-600">{p.subject}</span>
                </summary>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed text-neutral-800">
                  {p.body}
                </pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">{k}</dt>
      <dd className="text-[11.5px] text-neutral-900 break-words">{v}</dd>
    </>
  );
}
