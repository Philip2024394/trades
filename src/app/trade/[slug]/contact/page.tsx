import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { FaqAccordion } from "@/components/xrated/profile/FaqAccordion";
import { TrustAndLogisticsPanel } from "@/components/xrated/profile/TrustAndLogisticsPanel";
import { OfficeHoursMarquee } from "@/components/xrated/profile/OfficeHoursMarquee";
import { ContactFormPanel } from "@/components/xrated/profile/ContactFormPanel";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { TradeSocialIcons } from "@/components/trade-off/TradeSocialIcons";
import { websiteUrl } from "@/lib/tradeOffSocial";

export const revalidate = 300;

async function loadListing(slug: string): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Contact" };
  const primary = tradeLabel(listing.primary_trade);
  return {
    title: `Contact ${listing.display_name} — ${primary} in ${listing.city} | Xrated Trades`,
    description: `Send ${listing.display_name} a message about your ${primary.toLowerCase()} job. Reply by email or WhatsApp.`
  };
}

export default async function TradeContactPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const primary = tradeLabel(listing.primary_trade);
  const hasFaq = (listing.faq_items?.length ?? 0) > 0;
  const waUrl = whatsappQuoteUrl(listing.whatsapp, listing.display_name, primary);

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <XratedHeader />

      {/* Always-on hero + stats — same identity strip the customer sees on
          the public profile, so they never lose context on sub-pages. */}
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" />

      {/* FAQ FIRST — let the customer self-serve before they message.
          Back-to-profile is already covered by the yellow "Home page"
          button in the PremiumHero CTA row. */}
      {hasFaq && (
        <section className="w-full px-4 pt-2 sm:px-6">
          <OfficeHoursMarquee hours={listing.operating_hours ?? null} />
          <FaqAccordion items={listing.faq_items} themeColor="#FFB300" />
        </section>
      )}

      {/* Full "What to know before you message" trust panel — surfaces
          insurance £ cover, qualifications, memberships, DBS / transport
          / tools / free-quote flags, years-in-trade and minimum job
          right before the form. Hero already shows the headline trust
          badges; this is the detailed breakdown. */}
      <TrustAndLogisticsPanel listing={listing} />

      {/* CONTACT FORM — supports Email OR WhatsApp send. */}
      <ContactFormPanel
        listingId={listing.id}
        displayName={listing.display_name}
        themeColor="#FFB300"
        whatsapp={listing.whatsapp}
      />

      {/* "Find us on" — the full coloured social-icon grid lives here
          rather than the home page so the main profile stays calm and
          single-purpose. By the time a customer reaches this page they
          are in "tell me more" mode — that is when the IG / TikTok /
          Facebook / X / Snapchat / Reddit / YouTube / Google taps make
          sense. The website chip stays on the home page as the primary
          trust signal. */}
      <FindUsOnSection listing={listing} />

      <div className="mt-auto">
        <XratedFooter />
      </div>
    </main>
  );
}

function FindUsOnSection({ listing }: { listing: HammerexTradeOffListing }) {
  const anySocial = Boolean(
    listing.instagram ||
      listing.tiktok ||
      listing.facebook ||
      listing.twitter ||
      listing.snapchat ||
      listing.reddit ||
      listing.youtube ||
      listing.google ||
      listing.website
  );
  if (!anySocial) return null;
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 sm:pt-12">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center sm:p-8">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Find us on
        </p>
        <h2 className="mt-2 text-lg font-extrabold text-neutral-900 sm:text-xl">
          {listing.display_name.split(/\s+/)[0] ?? listing.display_name} elsewhere
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Follow our work, message us direct, or check the website.
        </p>
        <div className="mt-5 flex justify-center">
          <TradeSocialIcons listing={listing} variant="coloured" />
        </div>
        {listing.website && (
          <div className="mt-5 flex justify-center">
            <a
              href={websiteUrl(listing.website) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-900 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
              </svg>
              {listing.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
