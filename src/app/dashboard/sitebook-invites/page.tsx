// /dashboard/sitebook-invites — merchant-side view of SiteBooks they're
// invited to. Shows homeowner projects where the merchant is a member.
//
// This is a SiteBook FIRST TOUCH page for merchants — separate from
// their main dashboard because SiteBook membership is a different
// flow than their merchant surfaces.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { SiteBookMember, SiteBookProject } from "@/lib/homeowners/types";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

async function getMerchantSlugFromCookie(): Promise<string | null> {
  const c = await cookies();
  // Merchant session cookie name — adjust if different in the codebase
  const slug = c.get("tn_merchant_slug")?.value;
  return slug || null;
}

export default async function MerchantSiteBookInvitesPage() {
  const merchantSlug = await getMerchantSlugFromCookie();
  if (!merchantSlug) {
    redirect("/trade-off/login?next=/dashboard/sitebook-invites");
  }

  // Look up the merchant's listing_id
  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, business_name")
    .eq("slug", merchantSlug)
    .maybeSingle();
  if (!listingRes.data) redirect("/trade-off/login");

  const listingId = (listingRes.data as { id: string; business_name: string }).id;

  // Load all SiteBook memberships for this merchant
  const memRes = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("*, hammerex_sitebook_projects(*)")
    .eq("listing_id", listingId)
    .order("invited_at", { ascending: false });

  type MemberWithProject = SiteBookMember & { hammerex_sitebook_projects: SiteBookProject | null };
  const members = (memRes.data as MemberWithProject[]) ?? [];

  const active     = members.filter((m) => ["invited","accepted","quoting","hired","in-progress"].includes(m.status));
  const complete   = members.filter((m) => m.status === "complete");

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>SiteBook invites</p>
        <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">Projects you&rsquo;re on</h1>
        <p className="mt-1 text-[13px] text-neutral-600">
          Homeowners' SiteBooks you&rsquo;ve been invited to. Every message, photo, and warranty on the project stays here forever.
        </p>

        {members.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed bg-white p-8 text-center text-[13px] text-neutral-500">
            No SiteBook invites yet. When homeowners publish a project matching your trade + area, you&rsquo;ll be invited automatically.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {active.length > 0 && <InviteBlock title="Active" members={active}/>}
            {complete.length > 0 && <InviteBlock title="Completed" members={complete}/>}
          </div>
        )}
      </section>
    </main>
  );
}

function InviteBlock({ title, members }: { title: string; members: Array<SiteBookMember & { hammerex_sitebook_projects: SiteBookProject | null }> }) {
  return (
    <div>
      <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => {
          const p = m.hammerex_sitebook_projects;
          return (
            <li key={m.id}>
              <Link href={`/sitebook-project/${m.project_id}`} className="block rounded-2xl border-2 bg-white p-5 transition hover:shadow-md" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{m.status}</p>
                <p className="mt-1.5 text-[15px] font-black text-neutral-900">{p?.title || "Project"}</p>
                <p className="mt-1 text-[11.5px] text-neutral-500">
                  {p?.address_city && `${p.address_city} · `}
                  {p?.trade_types && `${p.trade_types.length} trade${p.trade_types.length === 1 ? "" : "s"}`}
                </p>
                {m.quote_amount_gbp !== null && (
                  <p className="mt-2 text-[12px] font-black text-green-800">Your quote: £{m.quote_amount_gbp.toLocaleString()}</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
