"use client";

// CanteenVisitUs — auto-adapts between two modes based on trade type:
//
//   PREMISES trades (kitchen showroom, tool shop, plant hire, timber
//   merchant, etc.) get "Visit us" with an address, Google Maps embed,
//   and a "Get directions" CTA.
//
//   VAN-BASED trades (plumber, sparky, roofer, kitchen fitter) get
//   "Where we work" with a service area label + a coverage map centred
//   on the host's postcode.
//
// The component decides which mode to render from the tradeSlug (via
// the PREMISES_TRADES set) — no manual toggle needed. Honest empty
// state when the host has published neither an address nor a city.

import Link from "next/link";
import { MapPin, ExternalLink, Clock, Mail } from "lucide-react";
import { BRAND_BLACK } from "@/lib/brand/tokens";

const TAN = "#B8860B";
const TAN_SOFT = "#F5E9D3";

// Trades whose customers physically visit the trade's premises. Any
// slug in this set switches the UI from "Where we work" to "Visit us".
const PREMISES_TRADES = new Set<string>([
  // Showrooms & retail
  "kitchen-showroom", "bathroom-showroom", "door-showroom", "window-showroom",
  "furniture-showroom", "lighting-showroom", "fireplace-showroom",
  "sofa-shop", "bed-and-mattress-shop", "curtain-and-blind-shop",
  "sanitaryware-shop", "radiator-shop", "kitchenware-shop", "carpet-shop",
  "tile-shop", "flooring-shop",
  // Merchants & wholesalers
  "building-merchant", "timber-merchant", "plumbing-merchant",
  "electrical-wholesaler", "paint-merchant", "ironmongery",
  "ppe-supplier", "tool-shop", "landscape-supplies", "aggregate-supplier",
  "roofing-supplies", "insulation-supplies", "builders-supplies",
  "kitchen-supplier", "bathroom-supplier", "door-supplier", "window-supplier",
  // Yards & specialist sites
  "stone-yard", "reclamation-yard", "salvage-yard", "garden-centre",
  // Manufacturing workshops (open to visits)
  "kitchen-manufacturer", "staircase-manufacturer", "door-manufacturer",
  "window-manufacturer", "flooring-manufacturer", "joinery-workshop",
  "steel-fabricator", "worktop-manufacturer",
  // Hire yards
  "plant-hire", "tool-hire", "scaffolding-hire", "generator-hire",
  "minidigger-hire", "crane-hire", "van-hire"
]);

export function CanteenVisitUs({
  canteenSlug,
  tradeSlug,
  tradeLabel,
  hostDisplayName,
  city,
  addressLine,
  postcode,
  postcodeArea,
  serviceAreas = [],
  openingHours = null,
  serviceRadiusKm = null
}: {
  /** Powers the "View map" and "Contact us" button hrefs. */
  canteenSlug: string;
  tradeSlug?: string | null;
  tradeLabel: string;
  hostDisplayName: string;
  city: string | null;
  addressLine?: string | null;
  postcode?: string | null;
  postcodeArea?: string | null;
  serviceAreas?: string[];
  openingHours?: string | null;
  serviceRadiusKm?: number | null;
}) {
  const premises = tradeSlug ? PREMISES_TRADES.has(tradeSlug) : false;

  // Honest empty state — never fabricate an address.
  const hasPremisesData = premises && Boolean(addressLine || postcode);
  const hasCoverageData = !premises && Boolean(city || postcodeArea || serviceAreas.length > 0);
  if (!hasPremisesData && !hasCoverageData) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-3 pt-4 md:px-6 md:pt-6">
      <div className="mb-2 px-1">
        <span className="text-[14px] font-black text-neutral-900 md:text-[15px]">
          {premises ? "Visit us" : "Where we work"}
        </span>
      </div>
      {premises
        ? <PremisesCard
            canteenSlug={canteenSlug}
            hostDisplayName={hostDisplayName}
            tradeLabel={tradeLabel}
            addressLine={addressLine ?? null}
            postcode={postcode ?? null}
            city={city}
            openingHours={openingHours}
          />
        : <CoverageCard
            canteenSlug={canteenSlug}
            hostDisplayName={hostDisplayName}
            city={city}
            postcodeArea={postcodeArea ?? null}
            serviceAreas={serviceAreas}
            serviceRadiusKm={serviceRadiusKm}
          />
      }
    </section>
  );
}

// ─── PREMISES — Visit us ──────────────────────────────────

function PremisesCard({
  canteenSlug,
  hostDisplayName,
  tradeLabel,
  addressLine,
  postcode,
  city,
  openingHours
}: {
  canteenSlug: string;
  hostDisplayName: string;
  tradeLabel: string;
  addressLine: string | null;
  postcode: string | null;
  city: string | null;
  openingHours: string | null;
}) {
  const fullAddress = [addressLine, postcode, city].filter(Boolean).join(", ");
  const mapHref = `/trade-off/yard/canteens/${canteenSlug}/map`;
  const contactHref = `/trade-off/yard/canteens/${canteenSlug}/contact`;
  return (
    <div
      className="rounded-2xl border bg-white p-3 shadow-md md:p-4"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full shadow-md"
          style={{ backgroundColor: BRAND_BLACK, color: "#FFFFFF" }}
          aria-hidden
        >
          <MapPin size={18} strokeWidth={2.3}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            {tradeLabel}
          </div>
          <div className="text-[13px] font-black text-neutral-900 md:text-[14px]">
            {hostDisplayName}
          </div>
          <div className="mt-1 text-[11.5px] leading-snug text-neutral-700 md:text-[12px]">
            {fullAddress}
          </div>
          {openingHours && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-bold text-neutral-600 md:text-[11px]">
              <Clock size={11} strokeWidth={2.3}/>
              {openingHours}
            </div>
          )}
        </div>
      </div>
      {/* Actions row — View map (own page) + Contact us (own page) */}
      <div className="mt-3 flex gap-2">
        <Link
          href={mapHref}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
          style={{ backgroundColor: TAN }}
        >
          <ExternalLink size={12} strokeWidth={2.5}/>
          View map
        </Link>
        <Link
          href={contactHref}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          <Mail size={12} strokeWidth={2.5}/>
          Contact us
        </Link>
      </div>
    </div>
  );
}

// ─── VAN-BASED — Where we work ────────────────────────────

function CoverageCard({
  canteenSlug,
  hostDisplayName,
  city,
  postcodeArea,
  serviceAreas,
  serviceRadiusKm
}: {
  canteenSlug: string;
  hostDisplayName: string;
  city: string | null;
  postcodeArea: string | null;
  serviceAreas: string[];
  serviceRadiusKm: number | null;
}) {
  const anchor = city || postcodeArea || "the UK";
  const areas = serviceAreas.length > 0 ? serviceAreas : city ? [city] : [];
  const firstName = hostDisplayName.split(/\s+/)[0] ?? hostDisplayName;
  const mapHref = `/trade-off/yard/canteens/${canteenSlug}/map`;
  const contactHref = `/trade-off/yard/canteens/${canteenSlug}/contact`;
  return (
    <div
      className="rounded-2xl border bg-white p-3 shadow-md md:p-4"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full shadow-md"
          style={{ backgroundColor: BRAND_BLACK, color: "#FFFFFF" }}
          aria-hidden
        >
          <MapPin size={18} strokeWidth={2.3}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Service area
          </div>
          <div className="text-[13px] font-black text-neutral-900 md:text-[14px]">
            Based in {anchor}
          </div>
          {areas.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {areas.slice(0, 6).map((a) => (
                <span
                  key={a}
                  className="rounded-full px-2 py-0.5 text-[10px] font-black leading-tight"
                  style={{ backgroundColor: TAN_SOFT, color: TAN }}
                >
                  {a}
                </span>
              ))}
            </div>
          )}
          {serviceRadiusKm !== null && (
            <div className="mt-1.5 text-[10.5px] font-bold text-neutral-600 md:text-[11px]">
              {firstName} travels up to {serviceRadiusKm}km from base
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href={mapHref}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
          style={{ backgroundColor: TAN }}
        >
          <ExternalLink size={12} strokeWidth={2.5}/>
          View map
        </Link>
        <Link
          href={contactHref}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          <Mail size={12} strokeWidth={2.5}/>
          Contact us
        </Link>
      </div>
    </div>
  );
}
