// src/lib/nex-native/info-pages-service.ts
//
// Server-side read + update for nex_business.info_pages (Migration 109).
// Client-safe constants + types live in ./info-pages so cover primitives
// can import them without pulling Supabase into the browser bundle.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";
import {
  NEX_INFO_BODY_MAX,
  NEX_INFO_CUSTOM_ICONS,
  NEX_INFO_FAQ_ANSWER_MAX,
  NEX_INFO_FAQ_QUESTION_MAX,
  NEX_INFO_MAX_CUSTOM_BUTTONS,
  NEX_INFO_MAX_FAQ_ITEMS,
  NEX_INFO_TITLE_MAX,
  type NexInfoCustomButton,
  type NexInfoFaqItem,
  type NexInfoPageKey,
  type NexInfoPagesJson,
} from "./info-pages";

export async function getInfoPages(
  businessId: NexUuid,
): Promise<NexInfoPagesJson | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("info_pages")
    .eq("id", businessId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `info-pages-service.getInfoPages(${businessId}): ${error.message}`,
    );
  }
  return (data?.info_pages as NexInfoPagesJson | null) ?? null;
}

/**
 * Full replacement write. Callers pass the ENTIRE next object · read-
 * then-write pattern lets us skip PATCH-shape complexity in the seller
 * form. Validates every field before persisting so the DB never sees a
 * malformed payload.
 */
export async function updateInfoPages(
  businessId: NexUuid,
  next: NexInfoPagesJson,
): Promise<void> {
  const cleaned = normaliseInfoPages(next);
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ info_pages: cleaned })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `info-pages-service.updateInfoPages(${businessId}): ${error.message}`,
    );
  }
}

/**
 * Strip / clamp fields so the DB payload is always a well-formed
 * NexInfoPagesJson. Silently drops anything invalid rather than
 * throwing · seller UX prefers a "we saved what we could" flash to a
 * hard reject. Caps + icon set enforced.
 */
export function normaliseInfoPages(raw: NexInfoPagesJson): NexInfoPagesJson {
  const enabled: Partial<Record<NexInfoPageKey, boolean>> = {};
  if (raw.enabled && typeof raw.enabled === "object") {
    for (const [k, v] of Object.entries(raw.enabled)) {
      if (typeof v === "boolean") {
        enabled[k as NexInfoPageKey] = v;
      }
    }
  }

  const clampText = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t.length === 0) return null;
    return t.slice(0, max);
  };

  const iconSet = new Set<string>(NEX_INFO_CUSTOM_ICONS);
  const customButtons: NexInfoCustomButton[] = Array.isArray(
    raw.custom_buttons,
  )
    ? raw.custom_buttons
        .slice(0, NEX_INFO_MAX_CUSTOM_BUTTONS)
        .map((btn): NexInfoCustomButton | null => {
          if (!btn || typeof btn !== "object") return null;
          const id =
            typeof btn.id === "string" && btn.id.trim().length > 0
              ? btn.id
              : `cb_${Math.random().toString(36).slice(2, 10)}`;
          const label = clampText(btn.label, NEX_INFO_TITLE_MAX);
          if (!label) return null;
          const icon =
            typeof btn.icon === "string" && iconSet.has(btn.icon)
              ? btn.icon
              : "✨";
          const body = clampText(btn.body, NEX_INFO_BODY_MAX) ?? "";
          const image_url = normaliseHttpsUrl(btn.image_url);
          const external_url = normaliseHttpsUrl(btn.external_url);
          const enabled =
            typeof btn.enabled === "boolean" ? btn.enabled : true;
          return { id, enabled, icon, label, body, image_url, external_url };
        })
        .filter((b): b is NexInfoCustomButton => b !== null)
    : [];

  const faqItems: NexInfoFaqItem[] = Array.isArray(raw.faq_items)
    ? raw.faq_items
        .slice(0, NEX_INFO_MAX_FAQ_ITEMS)
        .map((item): NexInfoFaqItem | null => {
          if (!item || typeof item !== "object") return null;
          const id =
            typeof item.id === "string" && item.id.trim().length > 0
              ? item.id
              : `faq_${Math.random().toString(36).slice(2, 10)}`;
          const question = clampText(item.question, NEX_INFO_FAQ_QUESTION_MAX);
          if (!question) return null;
          const answer =
            clampText(item.answer, NEX_INFO_FAQ_ANSWER_MAX) ?? "";
          const enabled =
            typeof item.enabled === "boolean" ? item.enabled : true;
          return { id, enabled, question, answer };
        })
        .filter((item): item is NexInfoFaqItem => item !== null)
    : [];

  return {
    enabled,
    delivery_details: clampText(raw.delivery_details, NEX_INFO_BODY_MAX),
    custom_orders: clampText(raw.custom_orders, NEX_INFO_BODY_MAX),
    services_scope: clampText(raw.services_scope, NEX_INFO_BODY_MAX),
    custom_buttons: customButtons,
    faq_items: faqItems,
  };
}

function normaliseHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  if (!/^https:\/\//i.test(t)) return null;
  if (t.length > 500) return null;
  return t;
}
