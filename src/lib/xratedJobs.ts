// Xrated Trades — customer jobs feed helpers.
// Customers post a project, it lands as 'pending', admin glances and flips
// to 'live'. Tradies WhatsApp the customer directly via the contact button.

import { TRADE_OFF_TRADES, tradeOffSlugify, whatsappDigits, whatsappQuoteUrl } from "./tradeOff";
import type { HammerexXratedJob } from "./supabase";

export const XRATED_JOBS_MIN_DESCRIPTION = 50;
export const XRATED_JOBS_MAX_DESCRIPTION = 800;
export const XRATED_JOBS_MAX_PHOTOS = 5;

// Carousel on the landing page stays dark until you've got real density.
// Flip the env var to "on" to unhide it; default off respects the
// agreed-upon empty-state behaviour.
export function jobsCarouselEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_XRATED_JOBS_CAROUSEL ?? "off").toLowerCase() === "on";
}

export function isJobTradeKnown(slug: string): boolean {
  return TRADE_OFF_TRADES.some((t) => t.slug === slug);
}

export function buildJobSlug(tradeSlug: string, city: string, suffix?: string): string {
  const base = tradeOffSlugify([tradeSlug, city].filter(Boolean).join("-")) || "job";
  return suffix ? `${base}-${suffix}` : base;
}

// Build the WhatsApp deep-link a tradesperson taps to message a customer.
// Pre-fills a clear "I can help" opener that names the trade and city so the
// customer recognises the inbound message immediately. Returns null for
// example posts — example jobs never link out (the whole point of the tag).
export function jobContactWhatsappUrl(
  job: Pick<HammerexXratedJob, "customer_whatsapp" | "customer_name" | "trade_slug" | "city" | "is_example">
): string | null {
  if (job.is_example) return null;
  const digits = whatsappDigits(job.customer_whatsapp);
  if (!digits) return null;
  const tradeLabel = TRADE_OFF_TRADES.find((t) => t.slug === job.trade_slug)?.label ?? job.trade_slug;
  const msg =
    `Hi ${job.customer_name}, I saw your ${tradeLabel.toLowerCase()} job on Xrated Trades.\n` +
    `I can help — happy to discuss the details.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

// Re-export so the pages can import the existing helper without
// double-imports across multiple lib modules.
export { whatsappQuoteUrl };

export const XRATED_JOB_BUDGET_PRESETS: string[] = [
  "Under £100",
  "£100 – £300",
  "£300 – £600",
  "£600 – £1,000",
  "£1,000 – £2,500",
  "£2,500 – £5,000",
  "£5,000+",
  "Quote needed"
];
