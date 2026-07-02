// Server-only loader for studio_pages rows.
//
// Every editor route that needs the merchant's page catalog should go
// through here so we can grow the query (join layout counts, cache,
// etc.) in one place.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StudioPage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_home: boolean;
};

export async function listPagesForBrand(brandId: string): Promise<StudioPage[]> {
  const res = await supabaseAdmin
    .from("studio_pages")
    .select("id, slug, name, description, sort_order, is_home")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (res.error) return [];
  return (res.data ?? []) as StudioPage[];
}

export async function findPage(
  brandId: string,
  slug: string
): Promise<StudioPage | null> {
  const res = await supabaseAdmin
    .from("studio_pages")
    .select("id, slug, name, description, sort_order, is_home")
    .eq("brand_id", brandId)
    .eq("slug", slug)
    .maybeSingle();
  if (res.error) return null;
  return (res.data as StudioPage | null) ?? null;
}
