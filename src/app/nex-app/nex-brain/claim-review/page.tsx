// M6.2 · Admin claim review page (Philip 2026-08-15)
// /nex-app/nex-brain/claim-review
//
// Server component: lists pending claim_requests + shows funnel counters.
// Each request has Approve / Reject actions wired to /api/nex/claim/admin-action.
//
// Funnel (Philip's counters):
//   Listed → Claim requested → Approved (claimed) → Paid Member (M6.3 later)
//
// Language discipline: internal admin surface · technical labels fine.
// Never sets verified=true from this UI · that's a commercial-event trigger.

import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, Mail, Phone, Clock, X, ExternalLink } from "lucide-react";
import { ClaimReviewActions } from "./ClaimReviewActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Brain · Claim Review" };

type ClaimRequestRow = {
  id: string;
  listing_id: string | null;
  company_name_snapshot: string;
  claimant_name: string | null;
  claimant_email: string;
  claimant_role: string | null;
  reason: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
};

type ListingLite = {
  id: string;
  slug: string;
  business_name: string;
  town: string | null;
  website: string | null;
  telephone: string | null;
  region: string | null;
  business_type: string | null;
  internal_verification_state: string | null;
};

async function loadClaimRequests() {
  const res = await supabaseNexAdmin
    .from("claim_requests")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (res.error) {
    console.error("[claim-review] load error", res.error);
    return { rows: [] as ClaimRequestRow[], error: res.error.message };
  }
  return { rows: (res.data ?? []) as ClaimRequestRow[], error: null };
}

async function loadListings(ids: string[]) {
  if (ids.length === 0) return new Map<string, ListingLite>();
  const res = await supabaseNexAdmin
    .from("directory_seeds")
    .select("id, slug, business_name, town, website, telephone, region, business_type, internal_verification_state")
    .in("id", ids);
  const map = new Map<string, ListingLite>();
  for (const r of (res.data ?? []) as ListingLite[]) map.set(r.id, r);
  return map;
}

async function loadFunnelCounters() {
  // Directory-level totals
  const listed = await supabaseNexAdmin.from("directory_seeds").select("*", { count: "exact", head: true });
  const requested = await supabaseNexAdmin.from("directory_seeds").select("*", { count: "exact", head: true }).eq("lifecycle_status", "claim_requested");
  const pending = await supabaseNexAdmin.from("directory_seeds").select("*", { count: "exact", head: true }).eq("lifecycle_status", "claim_pending");
  const claimed = await supabaseNexAdmin.from("directory_seeds").select("*", { count: "exact", head: true }).eq("directory_state", "claimed");
  const paidMember = await supabaseNexAdmin.from("directory_seeds").select("*", { count: "exact", head: true }).eq("directory_state", "paid_member");
  return {
    listed: listed.count ?? 0,
    requested: requested.count ?? 0,
    pending: pending.count ?? 0,
    claimed: claimed.count ?? 0,
    paid_member: paidMember.count ?? 0,
  };
}

export default async function ClaimReviewPage() {
  const { rows, error } = await loadClaimRequests();
  const listingIds = [...new Set(rows.map(r => r.listing_id).filter((x): x is string => !!x))];
  const listings = await loadListings(listingIds);
  const funnel = await loadFunnelCounters();

  const pending = rows.filter(r => r.status === "pending");
  const decided = rows.filter(r => r.status !== "pending");

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/nex-app/nex-brain" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
            <ArrowLeft size={14} strokeWidth={2} /> NEX Brain
          </Link>
          <Link href="/nex-app" aria-label="NEX home" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/nex-logo.png" alt="NEX" className="h-6 w-auto object-contain" />
          </Link>
        </div>

        <h1 className="text-2xl font-black tracking-tight">Claim review</h1>
        <p className="mt-1 text-sm text-black/60">
          Approve or reject business claim requests. Approved claims move the listing to <code className="rounded bg-black/[0.05] px-1 py-0.5 text-[11px]">directory_state=&quot;claimed&quot;</code> and set <code className="rounded bg-black/[0.05] px-1 py-0.5 text-[11px]">claimed=true</code>. Never sets <code>verified=true</code>.
        </p>

        {/* Funnel counters */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <FunnelCard label="Listed" count={funnel.listed} accent="black" />
          <FunnelCard label="Claim requested" count={funnel.requested} accent="amber" />
          <FunnelCard label="Claim pending" count={funnel.pending} accent="amber" />
          <FunnelCard label="Claimed" count={funnel.claimed} accent="emerald" />
          <FunnelCard label="Paid member" count={funnel.paid_member} accent="orange" hint="Stripe · M6.3" />
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load claim_requests: {error}
            <div className="mt-2 text-[12px] text-red-800/80">
              If the table doesn&apos;t exist yet, apply <code>deploy/postgres/init/052_claim_requests.sql</code> in Supabase Dashboard.
            </div>
          </div>
        )}

        {/* Pending queue */}
        <section className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-black/60">
            Pending review · {pending.length}
          </h2>
          {pending.length === 0 ? (
            <div className="mt-3 rounded-xl border border-black/10 bg-white p-6 text-center text-sm text-black/50">
              No pending claim requests.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {pending.map(r => {
                const listing = r.listing_id ? listings.get(r.listing_id) : null;
                return <PendingClaimCard key={r.id} claim={r} listing={listing ?? null} />;
              })}
            </div>
          )}
        </section>

        {/* Decided log */}
        {decided.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-black uppercase tracking-wider text-black/60">
              Decided · {decided.length} (last 200)
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-black/10 bg-white">
              <table className="w-full text-[13px]">
                <thead className="bg-black/[0.03] text-black/60">
                  <tr>
                    <th className="p-3 text-left font-semibold">Business</th>
                    <th className="p-3 text-left font-semibold">Claimant</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-left font-semibold">Reviewed</th>
                    <th className="p-3 text-left font-semibold">By</th>
                    <th className="p-3 text-left font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {decided.map(r => (
                    <tr key={r.id}>
                      <td className="p-3 font-medium">{r.company_name_snapshot}</td>
                      <td className="p-3">
                        <div className="text-black/85">{r.claimant_name ?? "—"}</div>
                        <div className="text-[11px] text-black/50">{r.claimant_email}</div>
                      </td>
                      <td className="p-3">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="p-3 text-[12px] text-black/60">
                        {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-[12px] text-black/60">{r.reviewed_by ?? "—"}</td>
                      <td className="p-3 text-[12px] text-black/70">{r.admin_note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function FunnelCard({ label, count, accent, hint }: { label: string; count: number; accent: "black" | "amber" | "emerald" | "orange"; hint?: string }) {
  const accentClass = accent === "black" ? "bg-black text-white" :
                      accent === "amber" ? "bg-amber-100 text-amber-900 border border-amber-200" :
                      accent === "emerald" ? "bg-emerald-100 text-emerald-900 border border-emerald-200" :
                      "bg-orange-100 text-orange-900 border border-orange-200";
  return (
    <div className={`rounded-xl px-4 py-3 ${accentClass}`}>
      <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-black">{count.toLocaleString()}</div>
      {hint && <div className="text-[10px] opacity-60 mt-0.5">{hint}</div>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-800 border-amber-200",
    approved:  "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected:  "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };
  const style = styles[status] ?? "bg-black/10 text-black/70";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${style}`}>
      {status}
    </span>
  );
}

function PendingClaimCard({ claim, listing }: { claim: ClaimRequestRow; listing: ListingLite | null }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Business row */}
          <div className="flex items-center gap-2">
            <Building2 size={16} strokeWidth={2} className="text-black/45 shrink-0" />
            <h3 className="text-base font-black tracking-tight truncate">{claim.company_name_snapshot}</h3>
          </div>
          {listing && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-black/55">
              {listing.town && <span>{listing.town}</span>}
              {listing.region && <span>· {listing.region}</span>}
              {listing.business_type && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60">{listing.business_type.replace(/_/g, " ").toLowerCase()}</span>}
              {listing.website && (
                <a href={listing.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-600 hover:underline">
                  {listing.website.replace(/^https?:\/\/(www\.)?/, "")}
                  <ExternalLink size={10} strokeWidth={2} />
                </a>
              )}
              {listing.telephone && (
                <a href={`tel:${listing.telephone}`} className="inline-flex items-center gap-1 text-black/70 hover:text-orange-600">
                  <Phone size={10} strokeWidth={2} />
                  {listing.telephone}
                </a>
              )}
            </div>
          )}

          {/* Claimant row */}
          <div className="mt-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 text-[13px]">
            <div className="text-[10px] font-black uppercase tracking-wider text-black/50">Claimant</div>
            <div className="mt-1 space-y-0.5">
              <div><span className="text-black/60">Name:</span> <span className="font-medium text-black/85">{claim.claimant_name ?? "—"}</span></div>
              <div><span className="text-black/60">Email:</span> <a href={`mailto:${claim.claimant_email}`} className="text-orange-600 hover:underline">{claim.claimant_email}</a></div>
              {claim.claimant_role && (
                <div><span className="text-black/60">Role:</span> <span className="text-black/85">{claim.claimant_role}</span></div>
              )}
              {claim.reason && (
                <div className="mt-2"><span className="text-black/60">Note:</span> <span className="text-black/85 italic">&quot;{claim.reason}&quot;</span></div>
              )}
            </div>
          </div>

          {/* Signals */}
          {listing && (
            <div className="mt-3 text-[11px] text-black/55">
              <span className="font-semibold">Domain match check:</span>{" "}
              <DomainMatchIndicator claimantEmail={claim.claimant_email} listingWebsite={listing.website ?? null} />
            </div>
          )}

          <div className="mt-2 text-[11px] text-black/45">
            <Clock size={10} strokeWidth={2} className="inline mr-1" />
            Submitted {new Date(claim.submitted_at).toLocaleString()}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0">
          <ClaimReviewActions
            claimRequestId={claim.id}
            businessName={claim.company_name_snapshot}
            listingSlug={listing?.slug ?? null}
          />
        </div>
      </div>
    </div>
  );
}

function DomainMatchIndicator({ claimantEmail, listingWebsite }: { claimantEmail: string; listingWebsite: string | null }) {
  if (!listingWebsite) return <span className="text-black/50">no listing website · manual check</span>;
  const emailDomain = claimantEmail.split("@")[1]?.toLowerCase().trim();
  let siteDomain = "";
  try {
    siteDomain = new URL(listingWebsite.startsWith("http") ? listingWebsite : "https://" + listingWebsite).hostname.replace(/^www\./i, "").toLowerCase();
  } catch { siteDomain = ""; }
  if (!emailDomain || !siteDomain) return <span className="text-black/50">cannot compare</span>;

  const match = emailDomain === siteDomain || siteDomain.endsWith(emailDomain) || emailDomain.endsWith(siteDomain);
  if (match) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800"><CheckCircle2 size={9} strokeWidth={2.5} />Email matches company domain</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800"><X size={9} strokeWidth={2.5} />Email domain differs · verify manually</span>;
}
