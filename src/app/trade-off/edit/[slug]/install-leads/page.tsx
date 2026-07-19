// /trade-off/edit/[slug]/install-leads — Phase Bb dashboard inbox for
// the Nearby Installers pattern.
//
// Two sections on one page:
//   1. "Inbound leads" — leads where THIS listing owns the installer
//      service (a shopper picked one of your services from another
//      merchant's product PDP).
//   2. "Leads driven by your SKUs" — leads where THIS listing owns
//      the anchor product (your SKU triggered a lead for another
//      trade to fit it).
//
// Auth: same magic-link + session-cookie fallback pattern the rest
// of /trade-off/edit uses. Fails-safe with a sign-in nudge.

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { ArrowRight, ArrowLeft, Package, Wrench, Info, MessageCircle } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";
import { serviceCategoryLabel } from "@/lib/serviceCategories";
import { LeadStatusActions } from "./LeadStatusActions";
import { BeaconClaimsSection, type BeaconClaimRow } from "./BeaconClaimsSection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Install leads · The Construction Notebook",
  robots: { index: false, follow: false }
};

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RouteParams = Promise<{ slug: string }>;

function readParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default async function InstallLeadsPage({
  params,
  searchParams
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const token = readParam(sp.token);

  // Resolve the listing via magic-link OR session cookie — same
  // pattern as /trade-off/sell + /trade-off/yard/manage.
  let listing: {
    id: string;
    slug: string;
    display_name: string;
    edit_token: string;
    whatsapp: string | null;
  } | null = null;
  if (slug && token) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, edit_token, whatsapp, status")
      .eq("slug", slug)
      .maybeSingle();
    if (data && data.status === "live" && constantTimeEq(data.edit_token, token)) {
      listing = {
        id: data.id,
        slug: data.slug,
        display_name: data.display_name,
        edit_token: data.edit_token,
        whatsapp: data.whatsapp ?? null
      };
    }
  }
  if (!listing) {
    const jar = await cookies();
    const raw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
    const session = verifyTradeSession(raw);
    if (session) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, display_name, edit_token, whatsapp, status")
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data && data.status === "live" && data.slug === slug) {
        listing = {
          id: data.id,
          slug: data.slug,
          display_name: data.display_name,
          edit_token: data.edit_token,
          whatsapp: data.whatsapp ?? null
        };
      }
    }
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-[#FBF6EC] px-4 pt-16 text-[#1B1A17]">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-400/40 bg-[#FFF7E0] p-6">
          <p className="text-[14px] font-black text-[#1B1A17]">
            Sign in to see your install leads.
          </p>
          <p className="mt-1 text-[12.5px] text-[#1B1A17]/70">
            Open your dashboard from the magic-link email, then click
            &ldquo;Install leads&rdquo; from the drawer.
          </p>
          <Link
            href={`/trade-off/login?next=/trade-off/edit/${encodeURIComponent(slug)}/install-leads`}
            className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-black text-[#0A0A0A] hover:bg-amber-300"
          >
            Sign in
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </main>
    );
  }

  // Beacon claims — homeowner enquiries routed to THIS merchant by
  // the 3-tier beacon fanout. Include assigned + claimed + timed_out
  // (last 7 days for timed_out — the FOMO signal shouldn't linger
  // forever). Joined to the beacon row for customer name/city/desc.
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const beaconClaimsRes = await supabaseAdmin
    .from("hammerex_beacon_claims")
    .select(`
      id, beacon_id, status, assigned_at, sla_expires_at, claimed_at,
      timed_out_at, readiness_tier,
      beacon:hammerex_xrated_project_beacons!inner (
        customer_name, customer_city, customer_whatsapp, trade_slug, project_description
      )
    `)
    .eq("merchant_slug", listing.slug)
    .or(`status.in.(assigned,claimed),and(status.eq.timed_out,timed_out_at.gte.${sevenDaysAgo})`)
    .order("assigned_at", { ascending: false })
    .limit(100);
  const beaconClaims: BeaconClaimRow[] = ((beaconClaimsRes.data ?? []) as Array<{
    id: string; beacon_id: string; status: string; assigned_at: string;
    sla_expires_at: string; claimed_at: string | null; timed_out_at: string | null;
    readiness_tier: number;
    beacon: { customer_name: string; customer_city: string | null; customer_whatsapp: string | null; trade_slug: string; project_description: string };
  }>).map((r) => ({
    id:              r.id,
    beaconId:        r.beacon_id,
    status:          (r.status ?? "assigned") as BeaconClaimRow["status"],
    assignedAt:      r.assigned_at,
    slaExpiresAt:    r.sla_expires_at,
    claimedAt:       r.claimed_at,
    timedOutAt:      r.timed_out_at,
    readinessTier:   (r.readiness_tier ?? 1) as 1 | 2 | 3,
    customerName:    r.beacon?.customer_name ?? "Customer",
    customerCity:    r.beacon?.customer_city ?? null,
    customerWhatsapp:r.beacon?.customer_whatsapp ?? null,
    tradeSlug:       r.beacon?.trade_slug ?? "",
    description:     r.beacon?.project_description ?? ""
  }));

  // Ownership queries — two directions.
  // (a) I'm the INSTALLER: leads where installer_service is one of
  //     my products. Join to fetch anchor product + merchant name.
  // (b) I'm the MERCHANT: leads where anchor_product is one of my
  //     products. Join to fetch installer service + installer name.
  const myProductsRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, kind")
    .eq("listing_id", listing.id);
  const myProductIds = new Set(
    (myProductsRes.data ?? []).map((p) => p.id as string)
  );
  const myServiceIds = new Set(
    (myProductsRes.data ?? [])
      .filter((p) => p.kind === "service")
      .map((p) => p.id as string)
  );
  const myAnchorIds = new Set(
    (myProductsRes.data ?? [])
      .filter((p) => p.kind === "product")
      .map((p) => p.id as string)
  );

  type LeadRow = {
    id: string;
    anchor_product_id: string;
    installer_service_id: string;
    buyer_contact: string | null;
    source: string;
    created_at: string;
    lead_status: "open" | "follow_up" | "won" | "lost";
    status_note: string | null;
  };

  // Bulk-fetch every lead touching one of my products (either side)
  // in one query — the total universe of leads for a single trade
  // stays small and this beats two round-trips.
  const relevantIds = Array.from(
    new Set([...myServiceIds, ...myAnchorIds])
  );
  let inbound: LeadRow[] = [];
  let outbound: LeadRow[] = [];
  if (relevantIds.length > 0) {
    const [inboundRes, outboundRes] = await Promise.all([
      supabaseAdmin
        .from("hammerex_xrated_install_leads")
        .select(
          "id, anchor_product_id, installer_service_id, buyer_contact, source, created_at, lead_status, status_note"
        )
        .in("installer_service_id", Array.from(myServiceIds))
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("hammerex_xrated_install_leads")
        .select(
          "id, anchor_product_id, installer_service_id, buyer_contact, source, created_at, lead_status, status_note"
        )
        .in("anchor_product_id", Array.from(myAnchorIds))
        .order("created_at", { ascending: false })
        .limit(100)
    ]);
    inbound = (inboundRes.data ?? []) as LeadRow[];
    outbound = (outboundRes.data ?? []) as LeadRow[];
  }

  // Enrich both sides with product + listing data in one shot.
  const enrichIds = Array.from(
    new Set([
      ...inbound.map((r) => r.anchor_product_id),
      ...inbound.map((r) => r.installer_service_id),
      ...outbound.map((r) => r.anchor_product_id),
      ...outbound.map((r) => r.installer_service_id)
    ])
  );
  const enrichRes =
    enrichIds.length > 0
      ? await supabaseAdmin
          .from("hammerex_xrated_products")
          .select(
            "id, name, price_pence, listing_id, service_category, install_service_category"
          )
          .in("id", enrichIds)
      : { data: [] };
  const productMap = new Map(
    (enrichRes.data ?? []).map((p) => [p.id as string, p])
  );
  const enrichListingIds = Array.from(
    new Set(
      (enrichRes.data ?? []).map((p) => p.listing_id as string)
    )
  );
  const listingsRes =
    enrichListingIds.length > 0
      ? await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .select("id, slug, display_name, trading_name, whatsapp, city")
          .in("id", enrichListingIds)
      : { data: [] };
  const listingMap = new Map(
    (listingsRes.data ?? []).map((l) => [l.id as string, l])
  );

  return (
    <main className="min-h-screen bg-[#FBF6EC] pb-24 pt-6 text-[#1B1A17] md:pt-10">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/trade-off/edit/${encodeURIComponent(listing.slug)}?token=${encodeURIComponent(listing.edit_token)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
            <Wrench className="h-3 w-3" aria-hidden />
            Install leads
          </span>
        </div>

        <h1 className="text-[26px] font-black leading-tight tracking-tight md:text-[36px]">
          Install leads.
        </h1>
        <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.55] text-[#1B1A17]/70 md:text-[15px]">
          Every time a shopper tapped &ldquo;Book fit + shop&rdquo; on a
          product page and it involved one of your listings. Two lists:
          people asking YOU to fit, and other trades who got work
          because a shopper started from one of your products.
        </p>

        <SummaryStrip
          inboundCount={inbound.length}
          outboundCount={outbound.length}
        />

        {/* Section 0 — Community Job Requests (beacon claims). Renders
            first because these are time-sensitive (2h SLA). Homeowners
            posted an enquiry; the fanout routed it to this merchant. */}
        <section className="mt-8">
          <SectionHeader
            title="Community job requests"
            hint="Homeowner enquiries the beacon sent to you. Claim within 2 hours to lock the lead — costs 1 washer. Missed leads stay visible so you can see what you lost."
            icon={<MessageCircle className="h-4 w-4" aria-hidden />}
            count={beaconClaims.filter((c) => c.status === "assigned").length}
          />
          <BeaconClaimsSection
            claims={beaconClaims}
            merchantSlug={listing.slug}
            editToken={listing.edit_token}
            merchantDisplayName={listing.display_name}
          />
        </section>

        {/* Section 1 — Inbound (I'm the installer) */}
        <section className="mt-8">
          <SectionHeader
            title="Inbound leads"
            hint="Shoppers who tapped to book you as the installer for a product on another merchant's PDP."
            icon={<Wrench className="h-4 w-4" aria-hidden />}
            count={inbound.length}
          />
          {inbound.length === 0 ? (
            <EmptyPanel copy="No inbound leads yet. When shoppers pick you from a product PDP, they'll land here." />
          ) : (
            <ul className="mt-3 space-y-2">
              {inbound.map((row) => {
                const service = productMap.get(row.installer_service_id);
                const anchor = productMap.get(row.anchor_product_id);
                const anchorListing = anchor
                  ? listingMap.get(anchor.listing_id as string)
                  : null;
                const merchantName =
                  (anchorListing?.trading_name as string | null)?.trim() ||
                  (anchorListing?.display_name as string | null) ||
                  "Unknown merchant";
                const anchorName = (anchor?.name as string) ?? "Unknown product";
                const serviceName = (service?.name as string) ?? "Your service";
                const categorySlug =
                  (service?.service_category as string | null) ?? null;
                const categoryLabel =
                  serviceCategoryLabel(categorySlug) ?? "install";
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13.5px] font-black text-[#1B1A17]">
                        {serviceName}
                      </p>
                      <span className="shrink-0 text-[11px] font-semibold text-[#1B1A17]/50">
                        {timeAgo(row.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-[1.5] text-[#1B1A17]/70">
                      Anchor product: <b>{anchorName}</b> from{" "}
                      <b>{merchantName}</b>
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#1B1A17]/50">
                      Category: {categoryLabel} · Ref{" "}
                      <span className="font-mono">
                        {row.id.slice(0, 8)}
                      </span>
                    </p>
                    {row.buyer_contact && (
                      <p className="mt-2 rounded-lg border border-[#1B1A17]/8 bg-[#FBF6EC] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1B1A17]/80">
                        Shopper contact: {row.buyer_contact}
                      </p>
                    )}
                    <LeadStatusActions
                      leadId={row.id}
                      slug={listing.slug}
                      editToken={listing.edit_token}
                      initialStatus={row.lead_status}
                      initialNote={row.status_note}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Section 2 — Outbound (my SKU sent someone else work) */}
        <section className="mt-10">
          <SectionHeader
            title="Leads driven by your SKUs"
            hint="Shoppers who tapped to book a fitter from one of YOUR product pages. The fitter gets the WhatsApp; you get the SKU credit."
            icon={<Package className="h-4 w-4" aria-hidden />}
            count={outbound.length}
          />
          {outbound.length === 0 ? (
            <EmptyPanel copy="No outbound leads yet. Tag your products with an install category from Shop-mode to start driving them." />
          ) : (
            <ul className="mt-3 space-y-2">
              {outbound.map((row) => {
                const service = productMap.get(row.installer_service_id);
                const anchor = productMap.get(row.anchor_product_id);
                const serviceListing = service
                  ? listingMap.get(service.listing_id as string)
                  : null;
                const installerName =
                  (serviceListing?.trading_name as string | null)?.trim() ||
                  (serviceListing?.display_name as string | null) ||
                  "Unknown installer";
                const installerSlug = serviceListing?.slug as string | undefined;
                const anchorName = (anchor?.name as string) ?? "Your product";
                const serviceName = (service?.name as string) ?? "Install";
                const installerCity =
                  (serviceListing?.city as string | null) ?? null;
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13.5px] font-black text-[#1B1A17]">
                        {anchorName}
                      </p>
                      <span className="shrink-0 text-[11px] font-semibold text-[#1B1A17]/50">
                        {timeAgo(row.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-[1.5] text-[#1B1A17]/70">
                      Booked with{" "}
                      {installerSlug ? (
                        <Link
                          href={`/${installerSlug}`}
                          className="font-black text-amber-700 hover:underline"
                        >
                          {installerName}
                        </Link>
                      ) : (
                        <b>{installerName}</b>
                      )}
                      {installerCity && (
                        <span className="text-[#1B1A17]/50"> · {installerCity}</span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#1B1A17]/50">
                      Service: {serviceName} · Ref{" "}
                      <span className="font-mono">
                        {row.id.slice(0, 8)}
                      </span>
                    </p>
                    <LeadStatusActions
                      leadId={row.id}
                      slug={listing.slug}
                      editToken={listing.edit_token}
                      initialStatus={row.lead_status}
                      initialNote={row.status_note}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div
          className="mt-8 flex items-start gap-3 rounded-2xl border p-4"
          style={{
            borderColor: "rgba(27,26,23,0.10)",
            background: "white"
          }}
        >
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-[#1B1A17]/60"
            aria-hidden
          />
          <div>
            <p className="text-[13px] font-black text-[#1B1A17]">
              How leads land here
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-[#1B1A17]/70">
              We log a lead the moment a shopper taps &ldquo;Book fit +
              shop&rdquo; on a product PDP. Neither side is billed for
              the lead — the value is the introduction. Actual
              scheduling and payment run through your direct WhatsApp
              thread with the shopper.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryStrip({
  inboundCount,
  outboundCount
}: {
  inboundCount: number;
  outboundCount: number;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      <SummaryTile
        label="Inbound this run"
        value={inboundCount}
        hint="Shoppers picking you as their installer"
      />
      <SummaryTile
        label="Outbound this run"
        value={outboundCount}
        hint="Your SKUs sending work to other trades"
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm">
      <p className="text-[10.5px] font-black uppercase tracking-[0.20em] text-amber-700">
        {label}
      </p>
      <p className="mt-1 text-[26px] font-black leading-none text-[#1B1A17] tabular-nums">
        {value.toLocaleString("en-GB")}
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-[#1B1A17]/55">
        {hint}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  icon,
  count
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  count: number;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-[16px] font-black text-[#1B1A17] md:text-[18px]">
            {title}
          </h2>
          <p className="mt-0.5 max-w-[52ch] text-[11.5px] leading-snug text-[#1B1A17]/55">
            {hint}
          </p>
        </div>
      </div>
      <span
        className="shrink-0 rounded-full bg-[#1B1A17]/8 px-2.5 py-0.5 text-[11px] font-black text-[#1B1A17]/75"
        aria-label={`${count} rows`}
      >
        {count}
      </span>
    </header>
  );
}

function EmptyPanel({ copy }: { copy: string }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white px-4 py-4 text-[12.5px] text-[#1B1A17]/60">
      <MessageCircle
        className="mt-0.5 h-4 w-4 shrink-0 text-[#1B1A17]/40"
        aria-hidden
      />
      {copy}
    </p>
  );
}
