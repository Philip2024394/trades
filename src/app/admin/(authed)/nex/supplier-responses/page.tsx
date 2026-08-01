// /admin/nex/supplier-responses — record supplier responses against enquiries.
//
// Philip 2026-08-02 · Supplier Memory v1. Smallest viable admin surface:
//   - list open enquiries (status prepared / delivered / responded)
//   - one-click response recording: accepted / declined / quoted / completed / no_response
//   - optional decline_reason + admin_notes
//
// Nothing here auto-notifies suppliers. Nothing here surfaces to customers.
// Every recorded response gets source_of_signal='admin_recorded_response'
// forced server-side · only real recorded events influence future matching.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RecordResponseForm } from "./RecordResponseForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supplier Responses · Admin", robots: { index: false } };

type EnquiryRow = {
  enquiry_id:            string;
  conversation_id:       string;
  customer_country:      string | null;
  brief_record:          Record<string, unknown>;
  design_references:     unknown[] | null;
  matched_supplier_ids:  string[];
  status:                string;
  prepared_at:           string;
  delivered_at:          string | null;
  responded_at:          string | null;
};

async function loadOpenEnquiries(): Promise<EnquiryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("nex_supplier_enquiries")
    .select("enquiry_id,conversation_id,customer_country,brief_record,design_references,matched_supplier_ids,status,prepared_at,delivered_at,responded_at")
    .in("status", ["prepared","delivered","responded"])
    .order("prepared_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as EnquiryRow[];
}

async function loadSuppliers(): Promise<Array<{ supplier_id: string; name: string }>> {
  const { data, error } = await supabaseAdmin
    .from("nex_suppliers")
    .select("supplier_id,name")
    .eq("active", true)
    .order("name");
  if (error) return [];
  return (data ?? []) as Array<{ supplier_id: string; name: string }>;
}

function readMaterials(brief: Record<string, unknown>): string[] {
  const m = brief.materials;
  return Array.isArray(m) ? (m as string[]) : [];
}

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toISOString().replace("T"," ").slice(0, 16);
}

export default async function Page() {
  const [enquiries, suppliers] = await Promise.all([loadOpenEnquiries(), loadSuppliers()]);

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Business Brain</p>
            <h1 className="mt-1 text-2xl font-black">Supplier Responses</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Record what happened after each brief was sent · every response feeds the intelligence loop.
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              Trust rule: source_of_signal is forced to <code>admin_recorded_response</code> server-side · AI inference cannot write here.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Nex admin</Link>
          </div>
        </div>

        {enquiries.length === 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-[13px] text-neutral-500">
            No open supplier enquiries. New briefs appear here as customers use the Supplier Preparation Workflow.
          </div>
        )}

        {enquiries.map((e) => {
          const materials = readMaterials(e.brief_record);
          const style      = String(e.brief_record.design_style ?? "—");
          const staircase  = String(e.brief_record.staircase_type ?? "—");
          const projLoc    = String(e.brief_record.project_location ?? "—");
          const projType   = String(e.brief_record.project_type ?? "residential_staircase");
          const quantity   = String(e.brief_record.quantity ?? "—");
          const timeframe  = String(e.brief_record.timeframe ?? "—");
          const country    = e.customer_country ?? "—";
          const designRefs = Array.isArray(e.design_references) ? e.design_references.length : 0;

          return (
            <div key={e.enquiry_id} className="mb-4 rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] font-mono text-neutral-500">{e.enquiry_id}</div>
                  <div className="text-[13px] font-semibold text-neutral-900">
                    {country} · {projType} · {staircase}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    e.status === "responded" ? "bg-blue-100 text-blue-800"
                    : e.status === "delivered" ? "bg-amber-100 text-amber-800"
                    : "bg-neutral-100 text-neutral-700"
                  }`}>{e.status}</div>
                  <div className="mt-1 text-[10px] text-neutral-500">Prepared {fmt(e.prepared_at)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[12px] text-neutral-700 md:grid-cols-4">
                <div><div className="text-[10px] font-black uppercase text-neutral-400">Location</div>{projLoc}</div>
                <div><div className="text-[10px] font-black uppercase text-neutral-400">Style</div>{style}</div>
                <div><div className="text-[10px] font-black uppercase text-neutral-400">Materials</div>{materials.join(", ") || "—"}</div>
                <div><div className="text-[10px] font-black uppercase text-neutral-400">Qty · Timeframe</div>{quantity} · {timeframe}</div>
              </div>

              {designRefs > 0 && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  {designRefs} design reference{designRefs > 1 ? "s" : ""} carried in brief · not a specification · supplier review required
                </div>
              )}

              <div className="mt-4 border-t border-neutral-100 pt-4">
                <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Record Response</div>
                <RecordResponseForm
                  enquiryId={e.enquiry_id}
                  suppliers={suppliers}
                  matchedSupplierIds={e.matched_supplier_ids}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
