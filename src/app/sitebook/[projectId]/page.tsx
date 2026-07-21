// /sitebook/[projectId] — project overview page.
// Shows summary + tabs to sub-sections (trades, messages, photos, warranty, settings).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookProject, SiteBookMember, SiteBookMessage, SiteBookPhoto } from "@/lib/homeowners/types";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export default async function ProjectOverviewPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const homeowner = (await getHomeownerFromCookie())!;

  const [projectRes, membersRes, messagesRes, photosRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("id", projectId).eq("homeowner_id", homeowner.id).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_members").select("*").eq("project_id", projectId),
    supabaseAdmin.from("hammerex_sitebook_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(3),
    supabaseAdmin.from("hammerex_sitebook_photos").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(6)
  ]);

  if (projectRes.error || !projectRes.data) notFound();
  const project  = projectRes.data as SiteBookProject;
  const members  = (membersRes.data as SiteBookMember[]) ?? [];
  const messages = (messagesRes.data as SiteBookMessage[]) ?? [];
  const photos   = (photosRes.data as SiteBookPhoto[]) ?? [];

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <Link href="/sitebook" className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← Back to SiteBook</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">{project.status}</p>
          <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">{project.title}</h1>
          {project.description && <p className="mt-1 max-w-2xl text-[13px] text-neutral-600">{project.description}</p>}
        </div>
        {project.status === "draft" && (
          <form action={`/api/homeowner/projects/${project.id}/publish`} method="POST">
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
              Publish + invite trades →
            </button>
          </form>
        )}
      </div>

      {/* Project meta */}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetaCard label="Trades needed" value={project.trade_types.length > 0 ? `${project.trade_types.length}` : "—"}/>
        <MetaCard label="Trades joined" value={String(members.length)}/>
        <MetaCard label="Budget"        value={project.budget_min_gbp !== null && project.budget_max_gbp !== null ? `£${project.budget_min_gbp?.toLocaleString()}-£${project.budget_max_gbp?.toLocaleString()}` : "—"}/>
        <MetaCard label="Timeline"      value={project.timeline || "—"}/>
      </dl>

      {/* Tab nav */}
      <nav className="mt-8 flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        <TabLink href={`/sitebook/${project.id}`}          active>Overview</TabLink>
        <TabLink href={`/sitebook/${project.id}/trades`}>Trades ({members.length})</TabLink>
        <TabLink href={`/sitebook/${project.id}/messages`}>Messages ({messages.length})</TabLink>
        <TabLink href={`/sitebook/${project.id}/photos`}>Photos ({photos.length})</TabLink>
        <TabLink href={`/sitebook/${project.id}/warranty`}>Warranty</TabLink>
        <TabLink href={`/sitebook/${project.id}/settings`}>Settings</TabLink>
      </nav>

      {/* Recent activity + previews */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <PreviewCard title={`Recent messages (${messages.length})`} href={`/sitebook/${project.id}/messages`}>
            {messages.length === 0 ? (
              <p className="text-[12.5px] text-neutral-500">No messages yet. Once trades join they can chat here.</p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-lg bg-neutral-50 p-3 text-[12.5px]">
                    <p className="font-black text-neutral-900">{m.author_name}</p>
                    <p className="mt-0.5 text-neutral-700 line-clamp-2">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </PreviewCard>

          <PreviewCard title={`Recent photos (${photos.length})`} href={`/sitebook/${project.id}/photos`}>
            {photos.length === 0 ? (
              <p className="text-[12.5px] text-neutral-500">No photos yet. Upload before/after or add progress shots as work happens.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {photos.map((p) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={p.id} src={p.storage_url} alt={p.caption || ""} className="aspect-square w-full rounded-md object-cover"/>
                ))}
              </div>
            )}
          </PreviewCard>
        </div>

        <div className="space-y-4">
          <PreviewCard title={`Trades on project (${members.length})`} href={`/sitebook/${project.id}/trades`}>
            {members.length === 0 ? (
              <p className="text-[12.5px] text-neutral-500">No trades yet. Publish this project to invite the nearest trades in your area.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-[12.5px] font-black text-neutral-900">{m.merchant_name}</p>
                    <p className="text-[11px] text-neutral-500">{m.trade_type} · {m.status}</p>
                    {m.quote_amount_gbp !== null && (
                      <p className="mt-1 text-[11.5px] font-black" style={{ color: BRAND_GREEN }}>Quote: £{m.quote_amount_gbp.toLocaleString()}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PreviewCard>
        </div>
      </div>
    </section>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 bg-white p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-[14px] font-black text-neutral-900">{value}</p>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${
        active
          ? "text-neutral-900"
          : "text-neutral-500 hover:text-neutral-900"
      }`}
      style={active ? { backgroundColor: BRAND_YELLOW } : {}}
    >
      {children}
    </Link>
  );
}

function PreviewCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-black text-neutral-900">{title}</h2>
        <Link href={href} className="text-[11px] font-bold text-neutral-500 hover:text-neutral-900">View all →</Link>
      </div>
      {children}
    </section>
  );
}
