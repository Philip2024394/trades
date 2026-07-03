// Studio layout loader — resolves the layout for a preview render.
//
// Priority order:
//   1. ?_draft=<base64> URL param (editor-controlled hot draft)
//   2. Latest draft row in studio_layouts
//   3. Latest published row in studio_layouts
//   4. defaultLayoutForPage() — a starter layout so the merchant sees
//      something instead of an empty page on first visit
//
// Draft encoding: JSON.stringify(layout) → Buffer.toString("base64").
// URL-safe because base64 chars are all URL-safe. Kept under a few KB
// so browsers don't complain about URL length; if a layout ever grows
// large enough to warrant chunking, Module 0.6's postMessage bus will
// take over (draft-in-URL becomes a bootstrap-only path).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emptyLayout, studioId, type StudioLayoutJson } from "./schema";

// Draft encoding lives in a client-safe module so the editor bundle can
// share it without importing supabaseAdmin. Re-exported here so the
// existing call sites keep the same import path.
export { encodeDraftParam, decodeDraftParam } from "./draftEncoding";

export async function loadLayoutForPage({
  merchantId,
  brandId,
  pageId,
  breakpoint = "default",
  preferStatus = "draft"
}: {
  merchantId: string;
  brandId: string;
  pageId: string;
  breakpoint?: string;
  preferStatus?: "draft" | "published";
}): Promise<StudioLayoutJson> {
  // Try preferred status first (draft by default — editor context).
  const primary = await supabaseAdmin
    .from("studio_layouts")
    .select("layout_json")
    .eq("merchant_id", merchantId)
    .eq("brand_id", brandId)
    .eq("page_id", pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", preferStatus)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (primary.data?.layout_json) {
    return primary.data.layout_json as StudioLayoutJson;
  }

  // Fallback to the other status.
  const secondary = await supabaseAdmin
    .from("studio_layouts")
    .select("layout_json")
    .eq("merchant_id", merchantId)
    .eq("brand_id", brandId)
    .eq("page_id", pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", preferStatus === "draft" ? "published" : "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (secondary.data?.layout_json) {
    return secondary.data.layout_json as StudioLayoutJson;
  }

  // No stored layout yet — return a page-specific starter so the
  // merchant sees something meaningful on first visit.
  return defaultLayoutForPage(pageId);
}

/** Starter layout used when neither draft nor published rows exist.
 *  Uses only sections registered at load time — sidesteps the whole
 *  "empty page with no way to add" chicken-and-egg. When Module 5+
 *  registers more sections, page defaults expand automatically. */
export function defaultLayoutForPage(pageId: string): StudioLayoutJson {
  const heroInstanceId = studioId("sec");

  if (pageId === "plant-hire" || pageId === "home") {
    return {
      sections: [
        {
          instanceId: heroInstanceId,
          key: "hero.plant_hire_bold_1",
          config: {
            // Values match hero.plant_hire_bold_1 defaultConfig(). Kept
            // literal here so the starter layout is fully self-contained
            // and doesn't depend on the registry being loaded at DB
            // read time.
            eyebrow: "Plant hire",
            heading: "Every Machine You Need. On Your Site.",
            subheading:
              "0.8T micro digger to 14T excavator. CPA-standard machines, 24/7 breakdown line, delivered same day locally.",
            primaryCtaLabel: "See the fleet",
            primaryCtaHref: "/plant-hire/machines",
            secondaryCtaLabel: "WhatsApp quote",
            secondaryCtaHref: "#whatsapp",
            backgroundImageUrl:
              "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
            overlayOpacity: 0,
            showTrustBadge: true,
            trustBadgeText: "CPA-standard · 24/7 breakdown · Insured"
          }
        }
      ],
      rows: [
        {
          id: studioId("row"),
          columns: [heroInstanceId]
        }
      ]
    };
  }

  return emptyLayout();
}
