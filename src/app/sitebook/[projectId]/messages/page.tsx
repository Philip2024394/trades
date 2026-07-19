// /sitebook/[projectId]/messages — collaboration chat.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookMessage, SiteBookProject } from "@/lib/homeowners/types";
import { MessageComposer } from "./MessageComposer";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const homeowner = (await getHomeownerFromCookie())!;
  const [projRes, msgRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("id", projectId).eq("homeowner_id", homeowner.id).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true }).limit(200)
  ]);
  if (projRes.error || !projRes.data) notFound();
  const project  = projRes.data as SiteBookProject;
  const messages = (msgRes.data as SiteBookMessage[]) ?? [];

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href={`/sitebook/${projectId}`} className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← {project.title}</Link>
      <h1 className="mt-3 text-2xl font-black text-neutral-900">Messages</h1>
      <p className="mt-1 text-[13px] text-neutral-600">Every message stays in your SiteBook forever. Trades on this project can see everything unless marked private.</p>

      <div className="mt-6 space-y-3">
        {messages.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed bg-white p-6 text-center text-[12.5px] text-neutral-500">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`rounded-2xl border-2 bg-white p-4 ${m.author_type === "homeowner" ? "border-yellow-300" : "border-neutral-200"}`}>
              <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                {m.author_name} · {new Date(m.created_at).toLocaleString("en-GB")}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-neutral-800">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <MessageComposer projectId={projectId} homeownerName={homeowner.first_name || "You"}/>
    </section>
  );
}
