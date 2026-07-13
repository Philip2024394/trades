// NearbyInstallers — "Independent local trades" PDP strip.
//
// Phase A of the Nearby Installers pattern: the product row declares
// `install_service_category`; this component surfaces the 3 nearest
// live services tagged with the same category. Framed strictly as
// discovery + WhatsApp handoff — no endorsement, no vetting badge,
// no "recommended" copy. The disclaimer is inline so a shopper is in
// no doubt about who they're dealing with.
//
// Pre-resolved on the server (see PDP loader) so this component
// stays presentational + easy to skip when the strip has zero
// matches. Renders nothing when the input list is empty.

import Link from "next/link";
import { MessageCircle, MapPin, ArrowRight, ShieldQuestion } from "lucide-react";
import { formatGbp } from "@/lib/xratedCart";
import { serviceCategoryLabel } from "@/lib/serviceCategories";
import { BookFitButton } from "./BookFitButton";

export type InstallerRow = {
  serviceId: string;
  serviceName: string;
  serviceSlug: string | null;
  pricePence: number;
  unit: string | null;
  sellerSlug: string;
  sellerName: string;
  sellerCity: string | null;
  sellerWhatsapp: string;
  reviewCount: number;
  averageRating: number | null;
};

/** Snapshot of the anchor product passed to the BookFitButton so
 *  clicking "Book fit + shop" can add the product to the merchant's
 *  cart without another server fetch. */
export type NearbyInstallersAnchor = {
  productId: string;
  name: string;
  pricePence: number;
  coverUrl: string | null;
  unit: string | null;
  sellerSlug: string;
  sellerName: string;
};

export function NearbyInstallers({
  installers,
  installCategory,
  anchor
}: {
  installers: InstallerRow[];
  installCategory: string;
  anchor: NearbyInstallersAnchor;
}) {
  if (installers.length === 0) return null;
  const categoryLabel = serviceCategoryLabel(installCategory) ?? "install";

  return (
    <section
      id="nearby-installers"
      className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-10"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <header className="mb-4">
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-amber-700">
            Get it fitted nearby
          </p>
          <h2 className="mt-1 text-[20px] font-black leading-tight text-[#1B1A17] md:text-[24px]">
            Independent local trades offering{" "}
            <span className="text-amber-500">{categoryLabel.toLowerCase()}</span>
          </h2>
        </header>

        {/* Non-endorsement disclaimer — sits ABOVE the cards so the
            shopper reads it before clicking through. Uses plain,
            direct wording rather than legalese so it stays trustworthy. */}
        <div
          className="mb-4 flex items-start gap-2 rounded-xl border border-[#1B1A17]/10 bg-white px-3 py-2.5 text-[12px] leading-[1.5] text-[#1B1A17]/75"
          role="note"
        >
          <ShieldQuestion
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden
          />
          <p>
            These are independent trades on The Network. We don&apos;t
            vet, verify or guarantee their work. Message on WhatsApp to
            check availability, insurance and reviews before booking.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {installers.map((i) => {
            const digits = i.sellerWhatsapp.replace(/\D/g, "");
            // Plain WhatsApp escape-hatch — used when the shopper
            // doesn't want to add the anchor product to their cart
            // but still wants to message the installer directly. The
            // BookFitButton below covers the bundled flow.
            const waMessage =
              `Hi ${i.sellerName.split(/\s+/)[0]} — I'm looking at "${anchor.name}" ` +
              `from ${anchor.sellerName} and considering having you fit it. ` +
              `Your listed rate is ${formatGbp(i.pricePence)}. Are you available?`;
            const waHref = digits
              ? `https://wa.me/${digits}?text=${encodeURIComponent(waMessage)}`
              : null;
            const profileHref = `/${encodeURIComponent(i.sellerSlug)}`;
            const priceLabel = formatGbp(i.pricePence);
            return (
              <li
                key={i.serviceId}
                className="flex flex-col rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={profileHref}
                    className="min-w-0 text-[14px] font-black text-[#1B1A17] hover:text-amber-700"
                  >
                    <span className="block truncate">{i.sellerName}</span>
                  </Link>
                  <span className="shrink-0 text-[16px] font-black text-[#1B1A17] tabular-nums">
                    {priceLabel}
                    {i.unit && (
                      <span className="text-[11px] font-semibold text-[#1B1A17]/50">
                        {" "}
                        / {i.unit}
                      </span>
                    )}
                  </span>
                </div>

                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] font-semibold text-[#1B1A17]/55">
                  {i.sellerCity && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin
                        className="h-3 w-3 text-[#1B1A17]/40"
                        aria-hidden
                      />
                      {i.sellerCity}
                    </span>
                  )}
                  {i.averageRating !== null && i.reviewCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className="text-amber-500">
                        ★
                      </span>
                      {i.averageRating.toFixed(1)}
                      <span className="text-[#1B1A17]/40">
                        ({i.reviewCount})
                      </span>
                    </span>
                  )}
                </p>

                <p className="mt-2 line-clamp-2 text-[12.5px] leading-[1.45] text-[#1B1A17]/70">
                  {i.serviceName}
                </p>

                <div className="mt-auto flex flex-col gap-1.5 pt-3">
                  {/* Primary: bundled one-tap flow. Adds anchor product
                      to cart, logs the pairing lead, opens WhatsApp
                      pre-composed with the merchant + product context. */}
                  <BookFitButton
                    anchor={anchor}
                    installer={{
                      serviceId: i.serviceId,
                      serviceName: i.serviceName,
                      pricePence: i.pricePence,
                      sellerName: i.sellerName,
                      sellerWhatsapp: i.sellerWhatsapp
                    }}
                  />
                  {/* Secondary: message-only escape hatch — no cart
                      write, no lead log. For shoppers who want to
                      chat first. */}
                  {waHref ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#1B1A17]/15 bg-white px-3 text-[11.5px] font-black text-[#0F7A3D] hover:border-[#0F7A3D]"
                    >
                      <MessageCircle className="h-3 w-3" aria-hidden />
                      Just message
                    </a>
                  ) : (
                    <Link
                      href={profileHref}
                      className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#1B1A17]/15 bg-white px-3 text-[11.5px] font-black text-[#1B1A17]/80 hover:border-amber-400"
                    >
                      View trade profile
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
