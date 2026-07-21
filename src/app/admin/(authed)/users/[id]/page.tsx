// /admin/users/[id] — per-homeowner detail + admin actions.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ShieldOff, Mail, MapPin, Calendar, Hammer, MessageCircle } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UserSuspendButton } from "./UserSuspendButton";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await assertAdminRole(["admin", "support"]);
  if (!auth.ok) redirect("/admin/login");

  const { id } = await params;
  const res = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, email, first_name, city, postcode, whatsapp_number, created_at, suspended_at, suspended_reason")
    .eq("id", id)
    .maybeSingle();
  const h = res.data as {
    id: string; email: string; first_name: string | null;
    city: string | null; postcode: string | null;
    whatsapp_number: string | null; created_at: string;
    suspended_at: string | null; suspended_reason: string | null;
  } | null;
  if (!h) notFound();

  // Load related data for context
  const [projects, posts, invites] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("id, title, created_at").eq("homeowner_id", id).order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("hammerex_sitebook_posts").select("id, title, created_at").eq("homeowner_id", id).order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("hammerex_sitebook_invitations").select("id, trade_merchant_name, status, sent_at").eq("homeowner_id", id).order("created_at", { ascending: false }).limit(10)
  ]);

  const projectRows = (projects.data as { id: string; title: string; created_at: string }[]) ?? [];
  const postRows    = (posts.data    as { id: string; title: string | null; created_at: string }[]) ?? [];
  const inviteRows  = (invites.data  as { id: string; trade_merchant_name: string | null; status: string; sent_at: string | null }[]) ?? [];

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-600 hover:text-neutral-900">
          <ArrowLeft size={11}/> All users
        </Link>

        {/* Header */}
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-black text-neutral-900">{h.first_name || h.email.split("@")[0]}</h1>
            <p className="mt-1 text-[12.5px] text-neutral-600">Homeowner · id <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">{h.id.slice(0,8)}</code></p>
          </div>
          {h.suspended_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-red-800">
              <ShieldOff size={11}/> Suspended
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-green-800">
              Active
            </span>
          )}
        </div>

        {/* Identity strip */}
        <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border-2 bg-white p-4 shadow-sm sm:grid-cols-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <Field icon={<Mail size={12}/>}     label="Email"    value={h.email}/>
          <Field icon={<MessageCircle size={12}/>} label="WhatsApp" value={h.whatsapp_number || "—"}/>
          <Field icon={<MapPin size={12}/>}   label="Location" value={[h.city, h.postcode].filter(Boolean).join(" · ") || "—"}/>
          <Field icon={<Calendar size={12}/>} label="Joined"   value={new Date(h.created_at).toLocaleDateString("en-GB")}/>
        </div>

        {/* Suspend action */}
        <div className="mt-3 rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: h.suspended_at ? "#B91C1C" : "rgba(0,0,0,0.08)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">Admin actions</p>
              {h.suspended_at && (
                <p className="mt-1 text-[12px] text-neutral-700">
                  Suspended {new Date(h.suspended_at).toLocaleString("en-GB")}
                  {h.suspended_reason && <> · reason: <span className="italic">{h.suspended_reason}</span></>}
                </p>
              )}
            </div>
            <UserSuspendButton userId={h.id} isSuspended={!!h.suspended_at}/>
          </div>
        </div>

        {/* Projects */}
        <Section title={`Projects · ${projectRows.length}`} icon={<Hammer size={13}/>}>
          {projectRows.length === 0 ? <Empty text="No projects yet."/> : (
            <ul className="space-y-1">
              {projectRows.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-neutral-50">
                  <span className="truncate font-black text-neutral-800">{p.title}</span>
                  <span className="ml-2 shrink-0 text-[10.5px] text-neutral-500">{new Date(p.created_at).toLocaleDateString("en-GB")}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Posts */}
        <Section title={`Posts · ${postRows.length}`} icon={<MessageCircle size={13}/>}>
          {postRows.length === 0 ? <Empty text="No posts yet."/> : (
            <ul className="space-y-1">
              {postRows.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-neutral-50">
                  <span className="truncate">{p.title || "(untitled)"}</span>
                  <span className="ml-2 shrink-0 text-[10.5px] text-neutral-500">{new Date(p.created_at).toLocaleDateString("en-GB")}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Trade invitations */}
        <Section title={`Trade invitations · ${inviteRows.length}`} icon={<MessageCircle size={13}/>}>
          {inviteRows.length === 0 ? <Empty text="No invitations sent."/> : (
            <ul className="space-y-1">
              {inviteRows.map((iv) => (
                <li key={iv.id} className="flex items-baseline justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-neutral-50">
                  <span className="truncate">{iv.trade_merchant_name || "(unnamed trade)"}</span>
                  <span className="ml-2 shrink-0 text-[10.5px] font-bold text-neutral-500">{iv.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
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

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded bg-neutral-50 px-3 py-2 text-[11.5px] text-neutral-500">{text}</p>;
}
