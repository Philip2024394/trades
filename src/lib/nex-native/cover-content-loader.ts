// src/lib/nex-native/cover-content-loader.ts
//
// Turns a nex_business row (+ related tables) into the runtime content
// bundle the sealed cover primitives consume. Consumed by
// /nex-native/[businessSlug]/page.tsx when the seller has picked a
// cover_layout_id (Migration 100).
//
// The bundle intentionally mirrors MockCoverContent (from
// src/app/nex-native/cover/mock-data.ts) so the exact same rendering
// path handles preview + production.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import * as accountService from "./account-service";
import * as productService from "./product-service";
import * as menuService from "./menu-service";
import * as productSectionService from "./product-section-service";
import { listGalleryImages } from "./gallery-image-service";
import type { NexBusinessRow, NexUuid } from "./types";
import { isVenueCategory } from "./types";
import {
  NEX_PAYMENT_METHOD_META,
  type NexPaymentMethod,
} from "./business-service";
import type { CoverLayoutId } from "@/app/nex-native/cover/layout-ids";
import type { MockCoverContent } from "@/app/nex-native/cover/mock-data";
import type { NexInfoPagesJson } from "./info-pages";

/** Product cards passed into the cover layouts. Same shape as
 *  CoverProduct in primitives.tsx so the type flows through. */
export interface RealCoverProduct {
  id: string;
  slug: string | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  stock_status: string | null;
  section_id?: string | null;
  description?: string | null;
}

export interface CoverContentBundle {
  content: MockCoverContent;
  layoutId: CoverLayoutId;
  themeId: string;
}

/**
 * Build the full cover content bundle from a business row. Fetches
 * owner + products + menu items + product sections + menu sections
 * in parallel · maps everything into MockCoverContent shape.
 *
 * Returns null when the business has no cover_layout_id set (caller
 * falls back to the legacy shop landing).
 */
export async function loadCoverContent(
  business: NexBusinessRow,
): Promise<CoverContentBundle | null> {
  const layoutId = business.cover_layout_id as CoverLayoutId | null;
  if (!layoutId) return null;

  const isVenue = isVenueCategory(business.business_category);
  const themeId = "pink-dream"; // default until nex_business.chat_theme
                                // or owner.chat_theme wiring is added

  // Parallel fetch: owner + products + menu items + sections + gallery.
  const [
    owner,
    products,
    menuItems,
    productSectionsRaw,
    menuSectionsRaw,
    galleryRaw,
  ] = await Promise.all([
    accountService.getAccountById(business.owner_account_id).catch(() => null),
    productService
      .listProductsByBusiness(business.id, "live")
      .catch(() => []),
    isVenue
      ? menuService
          .listMenuItemsByBusiness(business.id, { status: "live" })
          .catch(() => [])
      : Promise.resolve([]),
    productSectionService
      .listSectionsByBusiness(business.id)
      .catch(() => []),
    isVenue
      ? menuService.listSectionsByBusiness(business.id).catch(() => [])
      : Promise.resolve([]),
    listGalleryImages(business.id).catch(() => []),
  ]);

  const sections = isVenue
    ? menuSectionsRaw.map((s) => ({
        id: s.id,
        name: s.name,
        sort_order: s.sort_order,
      }))
    : productSectionsRaw.map((s) => ({
        id: s.id,
        name: s.name,
        sort_order: s.sort_order,
      }));

  const productList: RealCoverProduct[] = isVenue
    ? menuItems.map((m) => ({
        id: m.id,
        slug: null,
        name: m.name,
        price_pence: m.price_pence,
        currency: m.currency,
        image_url: m.image_url ?? null,
        stock_status: m.is_available ? "in_stock" : "sold_out",
        section_id: m.section_id ?? null,
        description: m.description ?? null,
      }))
    : products.map((p) => ({
        id: p.id,
        slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: p.name,
        price_pence: p.price_pence,
        currency: p.currency,
        image_url: p.image_url ?? null,
        stock_status: p.stock_status ?? null,
        section_id: p.section_id ?? null,
        description: p.description ?? null,
      }));

  // Payment method labels · human "emoji + label" strings the tray
  // shows above the QR (used only if fallback dynamic listing is ever
  // reintroduced · today the footer is a fixed sentence).
  const acceptedMethods = (business.accepted_payment_methods ?? [
    "cod",
  ]) as string[];
  const paymentMethodLabels: string[] = acceptedMethods
    .filter((m): m is NexPaymentMethod => m in NEX_PAYMENT_METHOD_META)
    .map((m) => {
      const meta = NEX_PAYMENT_METHOD_META[m];
      return `${meta.emoji} ${meta.label}`;
    });

  const acceptsQrisDelivery = acceptedMethods.includes("qris_delivery");

  const social = {
    instagram: business.instagram_handle ?? undefined,
    tiktok: business.tiktok_handle ?? undefined,
    facebook: business.facebook_handle ?? undefined,
    whatsapp: business.public_phone ?? undefined,
    website: business.website_url ?? undefined,
  };

  // Return-policy body · pre-render a compact seller-neutral line
  // when the policy row has anything useful. Keeps the tray free of
  // JSONB parsing at render time.
  const returnPolicyBody =
    business.return_policy && typeof business.return_policy === "object"
      ? renderReturnPolicyBody(business.return_policy)
      : null;

  // Events body from Bridge 23b · same pre-render pattern.
  const eventsBody =
    business.events_profile && typeof business.events_profile === "object"
      ? renderEventsBody(business.events_profile)
      : null;

  const content: MockCoverContent = {
    businessName: business.display_name,
    tagline:
      (business.description ?? "").split(/\s*\.\s*/)[0]?.slice(0, 120) ??
      "",
    handle: business.slug ? `${business.slug}.nex` : owner?.nex_handle ?? "",
    location: business.city ?? "",
    portraitUrl: business.logo_url ?? "",
    ownerAccountId: business.owner_account_id,
    presenceOnline: false,
    social,
    sections,
    countryCode: null,
    shippingScope:
      (business.shipping_scope as MockCoverContent["shippingScope"]) ?? null,
    aboutUs: business.description ?? null,
    paymentMethodLabels,
    qrCodeImageUrl: business.qr_code_image_url ?? null,
    acceptsQrisDelivery,
    returnPolicyBody,
    eventsBody,
    galleryUrls: (business.venue_gallery ?? []).filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    ),
    isVenue,
    yearEstablished: business.year_established ?? null,
    ownerName: owner?.display_name ?? null,
    ownerPosition: null,
    ownerAvatarUrl: null,
    hoursByDay: null,
    infoPages:
      (business.info_pages as NexInfoPagesJson | null | undefined) ?? null,
    products: productList,
    services: [],
    reviews: [],
    galleryImages: galleryRaw.map((row) => ({
      id: row.id,
      imageUrl: row.image_url,
      caption: row.caption,
      longDescription: row.long_description,
    })),
    hours: business.hours_display ?? "",
    address: business.address ?? "",
    atmosphereLine: "",
    locationLat: business.location_lat ?? null,
    locationLng: business.location_lng ?? null,
    sectionEyebrow: null,
    sectionTitle: null,
  };

  return { content, layoutId, themeId };
}

/** Pre-render the return-policy JSONB into a short sentence for the
 *  Info Tray Returns panel. Kept minimal · the seller's structured
 *  fields (window days, ship-cost payer, etc.) become one paragraph. */
function renderReturnPolicyBody(policy: unknown): string | null {
  if (!policy || typeof policy !== "object") return null;
  const p = policy as Record<string, unknown>;
  const parts: string[] = [];
  const windowDays = typeof p.window_days === "number" ? p.window_days : null;
  if (windowDays !== null) {
    parts.push(
      `You can request a return within ${windowDays} day${windowDays === 1 ? "" : "s"} of delivery.`,
    );
  }
  const shipPaidBy =
    typeof p.return_shipping_paid_by === "string"
      ? p.return_shipping_paid_by
      : null;
  if (shipPaidBy === "buyer") {
    parts.push("Return shipping is paid by the buyer.");
  } else if (shipPaidBy === "seller") {
    parts.push("We cover return shipping.");
  } else if (shipPaidBy === "split") {
    parts.push("Return shipping is shared 50/50.");
  }
  if (
    typeof p.refund_processing_days === "number" &&
    p.refund_processing_days > 0
  ) {
    parts.push(
      `Refunds process within ${p.refund_processing_days} day${p.refund_processing_days === 1 ? "" : "s"} of us receiving the return.`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Pre-render the events_profile JSONB into a short sentence for
 *  the Info Tray Catering panel. Bridge 23b shape. */
function renderEventsBody(events: unknown): string | null {
  if (!events || typeof events !== "object") return null;
  const e = events as Record<string, unknown>;
  const parts: string[] = [];
  if (e.hosts_parties === true) parts.push("We host private parties");
  if (e.outside_catering === true) parts.push("outside catering available");
  if (typeof e.seat_capacity === "number" && e.seat_capacity > 0) {
    parts.push(`seats up to ${e.seat_capacity}`);
  }
  if (e.has_live_music_or_dj === true) parts.push("live music / DJ available");
  if (e.has_sound_system_pa === true) parts.push("in-house sound system");
  if (
    typeof e.other_event_info === "string" &&
    e.other_event_info.trim().length > 0
  ) {
    parts.push(e.other_event_info.trim());
  }
  return parts.length > 0
    ? parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" · ") + "."
    : null;
}

export function coverLayoutIdOr(
  business: NexBusinessRow,
  fallback: CoverLayoutId | null,
): CoverLayoutId | null {
  return (business.cover_layout_id as CoverLayoutId | null) ?? fallback;
}
