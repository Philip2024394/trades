// TradeCircleRail — the V2 replacement for RecommendedTrades / TrustedTradesGrid.
//
// Renders a merchant's Trade Circle: curated members first (source =
// curated | reciprocal | invited), then auto-populated fills from the
// paid pool of nearby merchants in complementary trades — daily-seeded
// rotation. If the host has opted out of the ecosystem, only their
// curated network is shown.
//
// Cards link to the target's public app with ?from=<host-slug> so the
// existing FloatingBackToMerchant chip appears on the destination.

import Link from "next/link";
import { CheckCircle2, Users, ChevronRight, MapPin } from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import { loadTradeCircle } from "@/lib/os/vault/tradeCircle";

export async function TradeCircleRail({
  slug,
  variant = "carousel",
  limit = 12
}: {
  slug: string;
  variant?: "carousel" | "grid";
  limit?: number;
}) {
  const { members, host } = await loadTradeCircle(slug, limit);
  if (!host || members.length === 0) return null;

  const seeMoreHref = `/trade/${host.hostSlug}/trade-circle`;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Trade Circle
          </div>
          <h2 className="mt-0.5 text-[16px] font-bold text-neutral-900 md:text-lg">
            Businesses {host.hostDisplayName} works with
          </h2>
        </div>
        <Link
          href={seeMoreHref}
          className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-amber-800 hover:text-amber-900"
        >
          See all
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div
        className={
          variant === "grid"
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            : "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4"
        }
      >
        {members.map((m) => (
          <Link
            key={m.businessId}
            href={`/trade/${m.slug}?from=${encodeURIComponent(host.hostSlug)}`}
            className={
              variant === "grid"
                ? "block"
                : "block w-[62vw] shrink-0 snap-start sm:w-[38vw] md:w-full"
            }
          >
            <SurfaceCard variant="primary" padding="none">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-neutral-100">
                {m.avatarUrl || m.photos[0] ? (
                  <img
                    src={m.avatarUrl ?? m.photos[0]}
                    alt=""
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
                    {m.displayName.slice(0, 24)}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-baseline gap-1.5">
                  <div className="truncate text-[14px] font-semibold text-neutral-900">
                    {m.displayName}
                  </div>
                  {m.verified ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-blue-600"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className="mt-0.5 text-[13px] text-neutral-600">
                  {m.primaryTrade.replace(/-/g, " ")}
                </div>
                {m.city ? (
                  <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-neutral-500">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {m.city}
                  </div>
                ) : null}
                {m.categoryLabel ? (
                  <div className="mt-1 text-[13px] text-amber-800">
                    In: {m.categoryLabel}
                  </div>
                ) : null}
                {m.isAutoPopulated ? (
                  <div className="mt-1 text-[13px] italic text-neutral-500">
                    Nearby trusted trade
                  </div>
                ) : m.isReciprocal ? (
                  <div className="mt-1 text-[13px] font-semibold text-emerald-700">
                    Mutual recommendation
                  </div>
                ) : m.isInvited ? (
                  <div className="mt-1 text-[13px] text-neutral-600">
                    Invited to XRatedTrade by {host.hostDisplayName}
                  </div>
                ) : (
                  <div className="mt-1 text-[13px] text-neutral-600">
                    Recommended by {host.hostDisplayName}
                  </div>
                )}
              </div>
            </SurfaceCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
