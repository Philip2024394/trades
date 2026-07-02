// Platform Runtime — brand token seeder.
//
// Writes pack-declared brand tokens to studio_brand_tokens.
// PRESERVATION-ORIENTED: only inserts tokens the merchant doesn't
// already have. A merchant who tuned their primary colour before
// reinstalling a pack never loses it.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PackThemeSeed } from "@/platform/packs/types";

export async function seedBrandTokens(args: {
  brandId: string;
  theme: PackThemeSeed;
}): Promise<{ inserted: number; skipped: number }> {
  const existingRes = await supabaseAdmin
    .from("studio_brand_tokens")
    .select("kind, key")
    .eq("brand_id", args.brandId);

  const existing = new Set(
    ((existingRes.data ?? []) as { kind: string; key: string }[]).map(
      (r) => `${r.kind}.${r.key}`
    )
  );

  const toInsert = args.theme.tokens
    .filter((t) => !existing.has(`${t.kind}.${t.key}`))
    .map((t) => ({
      brand_id: args.brandId,
      kind: t.kind,
      key: t.key,
      value_json: t.value
    }));

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: args.theme.tokens.length };
  }

  const res = await supabaseAdmin
    .from("studio_brand_tokens")
    .insert(toInsert);
  if (res.error) {
    throw new Error(`seedBrandTokens: ${res.error.message}`);
  }

  return {
    inserted: toInsert.length,
    skipped: args.theme.tokens.length - toInsert.length
  };
}
