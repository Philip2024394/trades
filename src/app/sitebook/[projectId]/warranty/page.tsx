// /sitebook/[projectId]/warranty — warranty records for the project.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookProject, SiteBookWarranty } from "@/lib/homeowners/types";

export const dynamic = "force-dynamic";

const BRAND_GREEN = "#166534";

export default async function WarrantyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const homeowner = (await getHomeownerFromCookie())!;

  const [projRes, warRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("id", projectId).eq("homeowner_id", homeowner.id).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_warranties").select("*").eq("project_id", projectId).order("work_completed_at", { ascending: false })
  ]);
  if (projRes.error || !projRes.data) notFound();
  const project    = projRes.data as SiteBookProject;
  const warranties = (warRes.data as SiteBookWarranty[]) ?? [];

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href={`/sitebook/${projectId}`} className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← {project.title}</Link>
      <h1 className="mt-3 text-2xl font-black text-neutral-900">Warranty vault</h1>
      <p className="mt-1 text-[13px] text-neutral-600">Every warranty logged. Reminders sent before expiry. Kept forever.</p>

      {warranties.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed bg-white p-8 text-center text-[13px] text-neutral-500">
          No warranties logged yet. Once trades complete work they can add their warranty here.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {warranties.map((w) => {
            const expiresIn = Math.ceil((new Date(w.warranty_expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            const expired = expiresIn < 0;
            return (
              <li key={w.id} className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-black text-neutral-900">{w.work_description}</p>
                    <p className="mt-0.5 text-[11.5px] text-neutral-500">By {w.trade_name} · completed {new Date(w.work_completed_at).toLocaleDateString("en-GB")}</p>
                    {w.invoice_amount_gbp !== null && (
                      <p className="mt-2 text-[12px] font-bold" style={{ color: BRAND_GREEN }}>Invoice: £{w.invoice_amount_gbp.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[11.5px] font-black" style={{ color: expired ? "#DC2626" : BRAND_GREEN }}>
                      {expired ? "Expired" : `Expires in ${expiresIn} days`}
                    </p>
                    <p className="text-[10px] text-neutral-500">{w.warranty_years}-year warranty</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
