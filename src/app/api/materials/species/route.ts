// GET /api/materials/species  · list active species from the seeded catalogue.
// Read-only. Used by the Add-Stock workflow to populate the species picker.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";
import type { SpeciesRow } from "@/apps/materials/_schema/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("nex_materials_species")
      .select("*")
      .eq("active", true)
      .order("category")
      .order("display_name");
    if (error) throw error;
    return okResponse((data ?? []) as SpeciesRow[]);
  } catch (e) {
    return errorResponse(e);
  }
}
