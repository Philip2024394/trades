// /trade-off/yard/canteens/[slug]/map — dedicated map page.
//
// Reached from the "View map" button on the CanteenVisitUs card and
// from the /contact page. Renders a full-screen Google Maps embed for
// the trade's premises (or coverage area for van-based trades), with
// a sticky top-left "Back" pill and a sticky bottom "Contact us" pill
// so the user has a one-tap return path in either direction.
//
// Google Maps embed via the `q=` URL — no API key required. Address
// falls back to city / postcode when the host hasn't published a full
// premises address (van-based trades).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Mail, ExternalLink } from "lucide-react";
import { canteenBySlugFromDb, adminForCanteenFromDb } from "@/lib/canteens.server";
import { BRAND } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CREAM = "#FBF6EC";
const BRAND_BLACK = "#0A0A0A";
const TAN = "#B8860B";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) return { title: `Find us | ${BRAND.name}` };
  return {
    title: `Find ${canteen.hostDisplayName} | ${BRAND.name}`,
    description: `Directions and location for ${canteen.hostDisplayName} — ${canteen.tradeLabel}.`,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/map` }
  };
}

export default async function CanteenMapPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();
  const admin = await adminForCanteenFromDb(canteen.id);

  const addressLine = admin?.showroom?.addressLine ?? null;
  const postcode = admin?.showroom?.postcode ?? admin?.postcodeArea ?? null;
  const city = admin?.city ?? null;
  const fullAddress = [addressLine, postcode, city].filter(Boolean).join(", ");
  const anchor = fullAddress || city || postcode || "the UK";
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(anchor)}&z=${fullAddress ? 15 : 10}&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(anchor)}`;

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ backgroundColor: CREAM }}>
      {/* Full-screen map. Uses viewport height minus header/footer chrome. */}
      <iframe
        title={`Map for ${canteen.hostDisplayName}`}
        src={mapSrc}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="fixed inset-0 h-full w-full"
        style={{ border: 0 }}
      />

      {/* Sticky top-left back pill */}
      <div className="pointer-events-none fixed left-3 top-3 z-10 md:left-6 md:top-6">
        <Link
          href={`/trade-off/yard/canteens/${slug}`}
          className="pointer-events-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-white/95 px-4 text-[11.5px] font-black uppercase tracking-[0.14em] text-neutral-800 shadow-lg backdrop-blur"
        >
          <ArrowLeft size={13} strokeWidth={2.6}/>
          Back
        </Link>
      </div>

      {/* Sticky top-right title chip */}
      <div className="pointer-events-none fixed right-3 top-3 z-10 max-w-[calc(100vw-140px)] md:right-6 md:top-6">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND_BLACK, color: "#FFFFFF" }}
            aria-hidden
          >
            <MapPin size={13} strokeWidth={2.4}/>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-black leading-tight text-neutral-900">
              {canteen.hostDisplayName}
            </div>
            <div className="truncate text-[9.5px] font-bold text-neutral-500">
              {anchor}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar — Contact us + Directions.
          The "Contact us" pill is the round-trip back to the /contact
          page's email form; "Directions" bounces to Google Maps proper. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-5 md:pb-8">
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-full bg-white/95 p-1.5 shadow-2xl backdrop-blur">
          <Link
            href={`/trade-off/yard/canteens/${slug}/contact`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            <Mail size={13} strokeWidth={2.5}/>
            Contact us
          </Link>
          <a
            href={directionsHref}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
            style={{ backgroundColor: TAN }}
          >
            <ExternalLink size={13} strokeWidth={2.5}/>
            Directions
          </a>
        </div>
      </div>
    </main>
  );
}
