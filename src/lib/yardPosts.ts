// The Yard — shared helpers for posts. Format dates, label kinds, build
// WhatsApp deep-links from a post + the poster's listing.

import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import { whatsappDigits } from "@/lib/tradeOff";

export const YARD_KIND_LABELS: Record<HammerexTradeOffYardPost["kind"], string> = {
  available: "Available",
  needed: "Hiring",
  chat: "Trade Chat",
  product: "For Sale"
};

export const YARD_KIND_BG: Record<HammerexTradeOffYardPost["kind"], string> = {
  available: "#0F7A3F",
  needed: "#0A0A0A",
  chat: "#FFB300",
  product: "#0A0A0A"
};

export const YARD_KIND_FG: Record<HammerexTradeOffYardPost["kind"], string> = {
  available: "#ffffff",
  needed: "#FFB300",
  chat: "#0A0A0A",
  product: "#FFB300"
};

// Kinds whose creation should fire push / email alerts to subscribers
// in the same trade or area. By design we only ping members for the
// load-bearing "looking for work / offering work" posts — chat and
// product posts are scroll-and-discover, not alert-worthy.
export const YARD_ALERT_KINDS: ReadonlySet<HammerexTradeOffYardPost["kind"]> =
  new Set(["available", "needed"]);

export function formatPostPrice(pence: number | null): string {
  if (pence === null || pence === undefined) return "";
  const gbp = pence / 100;
  return `£${gbp.toLocaleString("en-GB", {
    minimumFractionDigits: gbp % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

export function buildYardPurchaseUrl(args: {
  whatsapp: string;
  posterName: string;
  postTitle: string;
  price: number | null;
}): string {
  const digits = whatsappDigits(args.whatsapp);
  const priceText = args.price ? ` at ${formatPostPrice(args.price)}` : "";
  const text = `Hi ${args.posterName}, interested in your Yard listing: "${args.postTitle}"${priceText}. Still available?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function isYardPostLive(p: Pick<HammerexTradeOffYardPost, "status" | "expires_at">): boolean {
  if (p.status !== "live") return false;
  const ms = Date.parse(p.expires_at);
  if (Number.isNaN(ms)) return false;
  return ms > Date.now();
}

// Friendly relative time: "2h ago", "yesterday", "3d ago".
export function timeAgoShort(iso: string, now: Date = new Date()): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const seconds = Math.max(0, Math.floor((now.getTime() - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

// Render a UK-friendly date range. "Mon 6 Jul – Fri 10 Jul" or "Mon 6 Jul"
// if only the start is set; "" if neither.
export function formatPostDateRange(
  startIso: string | null,
  endIso: string | null
): string {
  if (!startIso) return "";
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC"
    });
  };
  if (!endIso || endIso === startIso) return fmt(startIso);
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

export function formatDayRate(pence: number | null): string {
  if (pence === null || pence === undefined) return "";
  const gbp = pence / 100;
  return `£${gbp.toLocaleString("en-GB")}/day`;
}

export function buildYardWhatsappUrl(args: {
  whatsapp: string;
  posterName: string;
  postTitle: string;
}): string {
  const digits = whatsappDigits(args.whatsapp);
  const text = `Hi ${args.posterName}, saw your Xrated Yard post: "${args.postTitle}". Interested — can we talk?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Field-level validators for create/update.
export const YARD_TITLE_MAX = 80;
export const YARD_BODY_MAX = 600;
export const YARD_TITLE_MIN = 6;
export const YARD_BODY_MIN = 30;
