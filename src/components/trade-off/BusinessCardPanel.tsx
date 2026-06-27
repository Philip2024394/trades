// Xrated Trades dashboard — "My business card" panel.
// High-visibility section (near the top of the edit dashboard) that
// promotes the free one-tap WhatsApp business card. Renders:
//   - yellow eyebrow + headline + subhead
//   - live preview thumbnail of /api/trade-off/card-image?slug=<slug>
//   - primary yellow "Share to WhatsApp" button (variant='dashboard')
//   - tiny "Download as PNG" link (direct route + ?download=1)
//
// Server component shell — the share button itself is a client component.

import { ShareCardButton } from "@/components/xrated/profile/ShareCardButton";
import { tradeLabel } from "@/lib/tradeOff";

export function BusinessCardPanel({
  slug,
  displayName,
  primaryTrade,
  city,
  whatsapp,
  tradingName
}: {
  slug: string;
  displayName: string;
  primaryTrade: string;
  city: string;
  whatsapp: string;
  tradingName?: string | null;
}) {
  const cardSrc = `/api/trade-off/card-image?slug=${encodeURIComponent(slug)}`;
  const downloadHref = `${cardSrc}&download=1`;
  const tradeLabelText = tradeLabel(primaryTrade);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-brand-line bg-brand-surface">
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,300px),1fr] sm:items-center sm:gap-6 sm:p-6">
        {/* Preview thumbnail — server-generated card, refreshes whenever
            display name / city / trade / hero changes. */}
        <div className="overflow-hidden rounded-xl border border-brand-line bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardSrc}
            alt={`${displayName} business card preview`}
            width={300}
            height={201}
            className="block aspect-[1075/720] w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[13px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            My business card
          </p>
          <h2 className="mt-1 text-xl font-extrabold leading-tight text-brand-text sm:text-2xl">
            Share your card in one tap.
          </h2>
          <p className="mt-2 text-[13px] leading-snug text-brand-muted sm:text-sm">
            Same banner as your profile, your details baked in. Send it to
            a customer&apos;s WhatsApp — no design needed.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ShareCardButton
              slug={slug}
              displayName={displayName}
              primaryTrade={tradeLabelText}
              city={city}
              tradingName={tradingName}
              whatsapp={whatsapp}
              variant="dashboard"
            />
            <a
              href={downloadHref}
              className="text-[13px] font-bold text-brand-muted underline-offset-4 transition hover:text-brand-accent hover:underline"
            >
              Download card as PNG
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessCardPanel;
