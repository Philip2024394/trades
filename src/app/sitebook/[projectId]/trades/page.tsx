// /sitebook/[projectId]/trades — list trades on the project + their status.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookMember, SiteBookProject } from "@/lib/homeowners/types";

export const dynamic = "force-dynamic";

const BRAND_GREEN  = "#166534";

export default async function TradesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const homeowner = (await getHomeownerFromCookie())!;

  const [projRes, memRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("id", projectId).eq("homeowner_id", homeowner.id).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_members").select("*").eq("project_id", projectId).order("invited_at", { ascending: false })
  ]);
  if (projRes.error || !projRes.data) notFound();
  const project = projRes.data as SiteBookProject;
  const members = (memRes.data as SiteBookMember[]) ?? [];

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href={`/sitebook/${projectId}`} className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← {project.title}</Link>
      <h1 className="mt-3 text-2xl font-black text-neutral-900">Trades on this project</h1>
      <p className="mt-1 text-[13px] text-neutral-600">Trades who&rsquo;ve been invited or joined your SiteBook.</p>

      {members.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed bg-white p-8 text-center">
          <p className="text-[14px] font-black text-neutral-900">No trades yet.</p>
          <p className="mx-auto mt-2 max-w-md text-[12.5px] text-neutral-600">
            Publish your project to invite the 3 nearest matching trades in your area.
          </p>
          {project.status === "draft" && (
            <form action={`/api/homeowner/projects/${project.id}/publish`} method="POST" className="mt-4">
              <button className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: BRAND_GREEN }}>Publish + invite →</button>
            </form>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {members.map((m) => (
            <li key={m.id} className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-black text-neutral-900">{m.merchant_name}</p>
                  <p className="text-[11.5px] text-neutral-500">
                    {m.trade_type || "—"} · {m.member_role} · invited {new Date(m.invited_at).toLocaleDateString("en-GB")}
                  </p>
                  {m.quote_amount_gbp !== null && (
                    <p className="mt-2 text-[13px] font-black" style={{ color: BRAND_GREEN }}>Quote: £{m.quote_amount_gbp.toLocaleString()}</p>
                  )}
                  {m.quote_notes && <p className="mt-1 text-[12px] text-neutral-700">{m.quote_notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-neutral-700">{m.status}</span>
                  <Link href={`/${m.merchant_slug}`} className="text-[11px] font-bold text-neutral-600 hover:text-neutral-900">View profile →</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
