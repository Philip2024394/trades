// Studio design tokens — server-only DB loader.
//
// Kept out of tokens.ts so BrandTokensEditor (client) can import
// DEFAULT_TOKENS / TOKEN_GROUPS / validation without dragging
// supabaseAdmin into the client bundle. Preview route + Global panel
// route call loadBrandTokens() from their server components.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BrandTokens } from "./sectionTypes";
import { DEFAULT_TOKENS, mergeTokens } from "./tokens";

/** Read every token row for a brand and merge over DEFAULT_TOKENS. */
export async function loadBrandTokens(brandId: string): Promise<BrandTokens> {
  const res = await supabaseAdmin
    .from("studio_brand_tokens")
    .select("kind, key, value_json")
    .eq("brand_id", brandId);

  return mergeTokens(DEFAULT_TOKENS, res.data ?? []);
}
