// /sitebook-project/[projectId] — MERCHANT-side view of a SiteBook.
// A trade lands here from either the beacon notification or their
// /dashboard/sitebook-invites list.
//
// What the merchant can do:
//   - Accept the invite (become a member with status='accepted')
//   - Submit a quote (moves to status='quoting' → homeowner sees the quote)
//   - Decline the invite
//   - Post messages (once accepted)
//   - Upload photos (once accepted)
//
// The merchant sees the FULL project brief. Homeowner PII (full
// address, contact details) is only exposed when status='hired'.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookProject, SiteBookMember, SiteBookMessage, SiteBookPhoto } from "@/lib/homeowners/types";
import { MerchantQuoteForm, MerchantAcceptButton, MerchantDeclineButton } from "./MerchantActions";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

async function getMerchantListing(): Promise<{ id: string; business_name: string; slug: string } | null> {
  const c = await cookies();
  const slug = c.get("tn_merchant_slug")?.value;
  if (!slug) return null;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, business_name, slug")
    .eq("slug", slug)
    .maybeSingle();
  return (res.data as { id: string; business_name: string; slug: string } | null);
}

export default async function MerchantSiteBookProjectPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const listing = await getMerchantListing();
  if (!listing) {
    redirect(`/trade-off/login?next=/sitebook-project/${projectId}`);
  }

  const [projRes, memberRes, messagesRes, photosRes, homeownerRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("id", projectId).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_members").select("*").eq("project_id", projectId).eq("listing_id", listing.id).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true }).limit(30),
    supabaseAdmin.from("hammerex_sitebook_photos").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(9),
    // Homeowner data (limited fields — full contact only when hired)
    (async () => {
      const p = await supabaseAdmin.from("hammerex_sitebook_projects").select("homeowner_id").eq("id", projectId).maybeSingle();
      if (!p.data) return null;
      return supabaseAdmin.from("hammerex_homeowners").select("first_name, city, postcode, whatsapp_number").eq("id", (p.data as { homeowner_id: string }).homeowner_id).maybeSingle();
    })()
  ]);

  if (projRes.error || !projRes.data) notFound();
  const project    = projRes.data as SiteBookProject;
  const member     = (memberRes.data as SiteBookMember | null) || null;
  const messages   = (messagesRes.data as SiteBookMessage[]) ?? [];
  const photos     = (photosRes.data as SiteBookPhoto[]) ?? [];
  const homeowner  = homeownerRes && !("error" in homeownerRes) ? (homeownerRes.data as { first_name: string | null; city: string | null; postcode: string | null; whatsapp_number: string | null } | null) : null;

  const isHired    = member?.status === "hired" || member?.status === "in-progress" || member?.status === "complete";
  const isDeclined = member?.status === "declined";

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/dashboard/sitebook-invites" className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← My SiteBook invites</Link>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>SiteBook invite</p>
          <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">{project.title}</h1>
          {project.description && <p className="mt-1 max-w-2xl text-[13px] text-neutral-600">{project.description}</p>}
        </div>

        {/* Status banner */}
        {member && (
          <div className="mt-4 rounded-2xl border-2 bg-white p-4" style={{ borderColor: BRAND_YELLOW }}>
            <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Your status on this project</p>
            <p className="mt-1 text-[16px] font-black text-neutral-900">{member.status.toUpperCase()}</p>
            {member.quote_amount_gbp !== null && (
              <p className="mt-1 text-[13px] font-black text-green-800">Your quote: £{member.quote_amount_gbp.toLocaleString()}</p>
            )}
          </div>
        )}

        {/* Project brief */}
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetaCard label="Trades needed" value={project.trade_types.join(", ") || "—"}/>
          <MetaCard label="Area"          value={project.address_city || "—"}/>
          <MetaCard label="Postcode"      value={isHired ? (project.address_postcode || "—") : (project.address_postcode?.split(" ")[0] || "—")}/>
          <MetaCard label="Timeline"      value={project.timeline || "—"}/>
          <MetaCard label="Budget"        value={project.budget_min_gbp !== null && project.budget_max_gbp !== null ? `£${project.budget_min_gbp?.toLocaleString()}-£${project.budget_max_gbp?.toLocaleString()}` : "—"}/>
          <MetaCard label="Homeowner"     value={homeowner?.first_name || "Homeowner"}/>
        </dl>

        {isHired && homeowner?.whatsapp_number && (
          <div className="mt-4 rounded-2xl border-2 p-4" style={{ borderColor: BRAND_GREEN, backgroundColor: "#ECFDF5" }}>
            <p className="text-[10.5px] font-black uppercase tracking-wider" style={{ color: BRAND_GREEN }}>You&rsquo;re hired</p>
            <p className="mt-1 text-[13px] text-neutral-800">Homeowner WhatsApp: <a href={`https://wa.me/${homeowner.whatsapp_number.replace(/\D/g,"")}`} className="font-black underline">{homeowner.whatsapp_number}</a></p>
          </div>
        )}

        {/* Actions */}
        {!member && (
          <div className="mt-6 rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[14px] font-black text-neutral-900">Join this SiteBook?</p>
            <p className="mt-1 text-[12.5px] text-neutral-600">
              Accepting adds you to the homeowner&rsquo;s SiteBook. You can post messages, upload photos, submit a quote. You&rsquo;re only hired when the homeowner picks you.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MerchantAcceptButton projectId={projectId}/>
              <MerchantDeclineButton projectId={projectId}/>
            </div>
          </div>
        )}

        {member && !isDeclined && !isHired && member.status !== "complete" && (
          <div className="mt-6 rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[14px] font-black text-neutral-900">
              {member.quote_amount_gbp === null ? "Submit your quote" : "Update your quote"}
            </p>
            <MerchantQuoteForm projectId={projectId} currentAmount={member.quote_amount_gbp} currentNotes={member.quote_notes}/>
          </div>
        )}

        {/* Recent chat + photos */}
        {member && !isDeclined && (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Recent chat ({messages.length})</p>
              {messages.length === 0 ? (
                <p className="mt-3 text-[12px] text-neutral-500">No messages yet.</p>
              ) : (
                <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
                  {messages.map((m) => (
                    <li key={m.id} className="rounded-lg bg-neutral-50 p-3 text-[12px]">
                      <p className="font-black text-neutral-900">{m.author_name}</p>
                      <p className="mt-0.5 text-neutral-700">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Photos ({photos.length})</p>
              {photos.length === 0 ? (
                <p className="mt-3 text-[12px] text-neutral-500">No photos yet.</p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={p.id} src={p.storage_url} alt={p.caption || ""} className="aspect-square w-full rounded object-cover"/>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 bg-white p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-[13px] font-black text-neutral-900">{value}</p>
    </div>
  );
}
