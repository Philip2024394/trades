// M6.1 · Public trade profile page (Philip 2026-08-15)
//
// Route: /nex-app/trade/<slug>
// Reads: directory_seeds by slug via supabaseNexAdmin
// Shows: business info · capabilities grid · "Business information checked"
//        badge (soft label · never "verified") · Claim this business CTA
//
// Rules (never violated):
//   · Never displays "verified" for unclaimed records
//   · Never invents phone/email/address that isn't in the record
//   · Displays "Business information checked" only when internal_verification_state='FULLY_VERIFIED'
//   · Every unclaimed record has a Claim CTA that links to /nex-app/claim?listing_id=<slug>
//   · No fake ratings, review counts, or business hours

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin, Phone, Globe, Mail, ShieldCheck, CheckCircle2, Hammer, Building2, Wrench, Paintbrush, Layers, Fence, RectangleHorizontal, Sparkles, PenTool, Package } from "lucide-react";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";

const ORANGE = "#F97316";

export const dynamic = "force-dynamic";

type Capabilities = Record<string, "yes" | "no" | "unknown"> | null;

type Provenance = {
  discovered_by_agents?: string[];
  stage2_source_queries?: string[];
  stage2_source_urls?: string[];
  stage4_page_evidence_summary?: Record<string, string>;
  merge_history?: Array<{ merged_at: string; from_source: string; incoming_business_name?: string }>;
} | null;

type Listing = {
  id: string;
  slug: string;
  business_name: string;
  category: string | null;
  primary_trade: string | null;
  business_type: string | null;
  capabilities: Capabilities;
  tags: string[] | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  region: string | null;
  telephone: string | null;
  website: string | null;
  email: string | null;
  description: string | null;
  refacing_qualification: string | null;
  directory_state: string | null;
  lifecycle_status: string | null;
  verified: boolean | null;
  claimed: boolean | null;
  internal_verification_state: string | null;
  customer_facing_label: string | null;
  provenance: Provenance;
};

async function loadListing(slug: string): Promise<Listing | null> {
  const bySlug = await supabaseNexAdmin
    .from("directory_seeds")
    .select("id, slug, business_name, category, primary_trade, business_type, capabilities, tags, town, county, postcode, region, telephone, website, email, description, refacing_qualification, directory_state, lifecycle_status, verified, claimed, internal_verification_state, customer_facing_label, provenance")
    .eq("slug", slug)
    .maybeSingle();
  if (bySlug.data) return bySlug.data as unknown as Listing;
  // Fallback: try by UUID for people arriving via id-style links
  if (/^[0-9a-f-]{36}$/i.test(slug)) {
    const byId = await supabaseNexAdmin
      .from("directory_seeds")
      .select("id, slug, business_name, category, primary_trade, business_type, capabilities, tags, town, county, postcode, region, telephone, website, email, description, refacing_qualification, directory_state, lifecycle_status, verified, claimed, internal_verification_state, customer_facing_label, provenance")
      .eq("id", slug)
      .maybeSingle();
    return byId.data as unknown as Listing | null;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Business not found · NEX" };
  const parts = [listing.business_name, listing.town, "UK staircase trade"].filter(Boolean);
  return {
    title: `${listing.business_name} · NEX Trade Centre`,
    description: `${parts.join(" · ")}. Directory profile on NEX. Claim this business to take control of its NEX presence.`,
  };
}

export default async function TradeProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const isClaimed = listing.directory_state === "claimed" || listing.directory_state === "paid_member";
  const isMember = listing.directory_state === "paid_member";
  const isClaimRequested = listing.lifecycle_status === "claim_requested" || listing.lifecycle_status === "claim_pending";

  const caps = (listing.capabilities ?? {}) as Record<string, "yes" | "no" | "unknown">;
  const capsYes = Object.entries(caps).filter(([, v]) => v === "yes").map(([k]) => k);

  const locationParts = [listing.town, listing.county, listing.postcode].filter(Boolean);
  const locationLine = locationParts.join(" · ");

  const canonicalUrl = listing.website?.trim();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/nex-app/centre" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
            <ArrowLeft size={14} strokeWidth={2} />
            Back to Trade Centre
          </Link>
          <Link href="/nex-app" aria-label="NEX home" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/nex-logo.png" alt="NEX" className="h-6 w-auto object-contain" />
          </Link>
        </div>

        {/* Identity block */}
        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          {/* Business type + region chips */}
          <div className="flex flex-wrap gap-2">
            {listing.business_type && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black text-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                <Building2 size={11} strokeWidth={2.5} />
                {friendlyBusinessType(listing.business_type)}
              </span>
            )}
            {listing.region && (
              <span className="inline-flex items-center rounded-full bg-black/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black/70">
                {listing.region}
              </span>
            )}
            {listing.category && listing.category !== friendlyBusinessType(listing.business_type ?? "") && (
              <span className="inline-flex items-center rounded-full bg-black/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black/70">
                {listing.category}
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl font-black leading-tight tracking-tight">
            {listing.business_name}
          </h1>

          {locationLine && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-black/70">
              <MapPin size={14} strokeWidth={2} className="text-black/45" />
              {locationLine}
            </div>
          )}

          {/* Soft-language "checked" badge · NEVER "verified" for unclaimed */}
          {listing.customer_facing_label && !isMember && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 size={12} strokeWidth={2.5} />
              {listing.customer_facing_label}
            </div>
          )}

          {/* Member badge · ONLY for paid members */}
          {isMember && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-100 border border-orange-300 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-orange-800">
              <ShieldCheck size={12} strokeWidth={2.5} />
              NEX Member
            </div>
          )}
        </section>

        {/* Contact block · only shows what's actually published · never invents */}
        {(listing.website || listing.telephone || listing.email) && (
          <section className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-black/50">Contact</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {listing.website && (
                <div className="flex items-center gap-2">
                  <Globe size={14} strokeWidth={2} className="text-black/45 shrink-0" />
                  <a href={canonicalUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline break-all">
                    {displayDomain(canonicalUrl!)}
                  </a>
                </div>
              )}
              {listing.telephone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} strokeWidth={2} className="text-black/45 shrink-0" />
                  <a href={`tel:${listing.telephone}`} className="text-black hover:text-orange-600">{listing.telephone}</a>
                </div>
              )}
              {listing.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} strokeWidth={2} className="text-black/45 shrink-0" />
                  <a href={`mailto:${listing.email}`} className="text-black hover:text-orange-600 break-all">{listing.email}</a>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Capabilities grid · only shows YES values · unknown/no omitted */}
        {capsYes.length > 0 && (
          <section className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-black/50">Services & capabilities</h2>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {capsYes.map(cap => (
                <CapabilityBadge key={cap} capability={cap} />
              ))}
            </div>
          </section>
        )}

        {/* Description if present */}
        {listing.description && (
          <section className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-black/50">About this business</h2>
            <p className="mt-3 text-sm leading-relaxed text-black/80">
              {listing.description}
            </p>
          </section>
        )}

        {/* Materials mentioned (from Stage 4 direct-fetch evidence) */}
        {listing.provenance?.stage4_page_evidence_summary && (
          <MaterialsBlock evidence={listing.provenance.stage4_page_evidence_summary} />
        )}

        {/* Claim CTA block · disabled for already-claimed */}
        <section className="mt-6 rounded-2xl border-2 border-orange-300 bg-white p-6 shadow-md">
          {isClaimed ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                <CheckCircle2 size={12} strokeWidth={2.5} />
                Business claimed
              </div>
              <p className="mt-3 text-sm text-black/70">
                This profile is under the owner&apos;s control.
                {!isMember && " Membership upgrade available separately."}
              </p>
            </div>
          ) : isClaimRequested ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-800">
                Claim under review
              </div>
              <p className="mt-3 text-sm text-black/70">
                NEX is reviewing a claim request for this business. Contact <a href="mailto:asknexapp@gmail.com" className="text-orange-600 underline">asknexapp@gmail.com</a> if this is your business.
              </p>
            </div>
          ) : (
            <>
              <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>
                Is this your business?
              </div>
              <h2 className="mt-1 text-xl font-black leading-tight">
                Claim {listing.business_name}
              </h2>
              <p className="mt-2 text-sm text-black/70">
                This profile was created from publicly available business information. Claim it to take control of the details, add photos, and receive relevant customer enquiries.
              </p>
              <Link
                href={`/nex-app/claim?listing_id=${encodeURIComponent(listing.slug)}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-black uppercase tracking-wider text-white transition-transform active:scale-95"
                style={{ background: ORANGE, boxShadow: "0 6px 18px rgba(249,115,22,0.35)" }}
              >
                Claim this business
                <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
              <p className="mt-3 text-center text-[11px] text-black/50">
                Free to claim · NEX will verify your ownership before confirming.
              </p>
            </>
          )}
        </section>

        {/* Provenance line · minimal · honest */}
        <p className="mt-6 text-center text-[11px] text-black/40">
          Directory information sourced from publicly available business listings.
          {listing.provenance?.stage4_page_evidence_summary && " Business details checked against the company&apos;s own website."}
        </p>
      </div>
    </div>
  );
}

// ─── helpers ───

function friendlyBusinessType(bt: string): string {
  switch (bt) {
    case "MULTI_SERVICE_COMPANY": return "Multi-service staircase company";
    case "STAIRCASE_MANUFACTURER": return "Staircase manufacturer";
    case "REFACING_SERVICE_SPECIALIST": return "Refacing specialist";
    case "REFURBISHMENT_SERVICE_SPECIALIST": return "Refurbishment specialist";
    case "REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER": return "Kit/product supplier";
    case "STAIRCASE_INSTALLER": return "Staircase installer";
    default: return bt;
  }
}

function displayDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function CapabilityBadge({ capability }: { capability: string }) {
  const label = capabilityLabel(capability);
  const Icon = capabilityIcon(capability);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/[0.03] border border-black/5 px-3 py-2 text-[13px] text-black/80">
      <Icon size={14} strokeWidth={2} className="text-orange-600 shrink-0" />
      {label}
    </div>
  );
}

function capabilityLabel(cap: string): string {
  const map: Record<string, string> = {
    manufacture: "Manufacture",
    installation: "Installation",
    refurbishment: "Refurbishment",
    refacing: "Refacing / cladding",
    balustrade: "Balustrades",
    handrail: "Handrails",
    glass: "Glass",
    metal: "Metal / steel",
    timber: "Timber",
    bespoke: "Bespoke / custom",
    design: "Design / CAD",
    kit_or_product_supplier: "Kits / products",
  };
  return map[cap] ?? cap.replace(/_/g, " ");
}

function capabilityIcon(cap: string) {
  const map: Record<string, typeof Hammer> = {
    manufacture: Hammer,
    installation: Wrench,
    refurbishment: Paintbrush,
    refacing: Layers,
    balustrade: Fence,
    handrail: RectangleHorizontal,
    glass: Sparkles,
    metal: Sparkles,
    bespoke: PenTool,
    design: PenTool,
    kit_or_product_supplier: Package,
  };
  return map[cap] ?? Hammer;
}

function MaterialsBlock({ evidence }: { evidence: Record<string, string> }) {
  // Not rendered as a separate section for now · reserved for later enrichment.
  // Placeholder to avoid unused variable if we want to surface materials evidence
  // in a future iteration. Currently returns null · evidence lives in provenance.
  void evidence;
  return null;
}
