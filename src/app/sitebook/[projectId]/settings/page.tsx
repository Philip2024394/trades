// /sitebook/[projectId]/settings — edit / archive / delete project.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookProject } from "@/lib/homeowners/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const homeowner = (await getHomeownerFromCookie())!;
  const res = await supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("id", projectId).eq("homeowner_id", homeowner.id).maybeSingle();
  if (res.error || !res.data) notFound();
  const project = res.data as SiteBookProject;

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href={`/sitebook/${projectId}`} className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← {project.title}</Link>
      <h1 className="mt-3 text-2xl font-black text-neutral-900">Project settings</h1>

      <div className="mt-6 space-y-4">
        <SettingCard title="Mark as complete" body="Once complete, warranties become the primary tab. Project is preserved in your SiteBook forever.">
          {project.status !== "complete" && (
            <form action={`/api/homeowner/projects/${project.id}/complete`} method="POST">
              <button className="rounded-full bg-green-700 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">Mark complete</button>
            </form>
          )}
        </SettingCard>

        <SettingCard title="Archive project" body="Hide from active views. Preserved in export bundle. Reversible.">
          <form action={`/api/homeowner/projects/${project.id}/archive`} method="POST">
            <button className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50">Archive</button>
          </form>
        </SettingCard>

        <SettingCard title="Delete project" body="Permanently remove from your SiteBook. Cannot be undone. Warranties are lost.">
          <form action={`/api/homeowner/projects/${project.id}/delete`} method="POST">
            <button className="rounded-full bg-red-100 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-red-800 hover:bg-red-200">Delete forever</button>
          </form>
        </SettingCard>
      </div>
    </section>
  );
}

function SettingCard({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[14px] font-black text-neutral-900">{title}</p>
      <p className="mt-1 text-[12px] text-neutral-600">{body}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
