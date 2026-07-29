// Stock service · aggregates across packs to answer "how much do we have?"
//
// This is the surface that a future NEX orchestrator will read when
// composing cross-layer answers ("do I have enough oak for this
// staircase?"). Keep it lean · pure aggregation · no side effects.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProvider } from "../_providers";
import {
  MaterialsError,
  type BoardMeasurementRow,
  type HardwoodBoardRow,
  type HardwoodPackRow,
  type SpeciesRow,
  type StockSummaryRow,
} from "../_schema/types";

export async function stockSummaryForOwner(ownerId: string): Promise<StockSummaryRow[]> {
  const packsRes = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("*")
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (packsRes.error) throw new MaterialsError("internal", packsRes.error.message, 500);
  const packs = (packsRes.data ?? []) as HardwoodPackRow[];

  if (packs.length === 0) return [];

  const packIds = packs.map(p => p.id);
  const speciesIds = Array.from(new Set(packs.map(p => p.species_id)));

  const [speciesRes, boardsRes] = await Promise.all([
    supabaseAdmin
      .from("nex_materials_species")
      .select("*")
      .in("id", speciesIds),
    supabaseAdmin
      .from("nex_materials_hardwood_boards")
      .select("*")
      .in("pack_id", packIds)
      .is("deleted_at", null),
  ]);
  if (speciesRes.error) throw new MaterialsError("internal", speciesRes.error.message, 500);
  if (boardsRes.error)  throw new MaterialsError("internal", boardsRes.error.message, 500);
  const species = (speciesRes.data ?? []) as SpeciesRow[];
  const boards  = (boardsRes.data ?? []) as HardwoodBoardRow[];

  const boardIds = boards.map(b => b.id);
  let currentMeasurements: BoardMeasurementRow[] = [];
  if (boardIds.length > 0) {
    const measRes = await supabaseAdmin
      .from("nex_materials_hardwood_board_measurements")
      .select("*")
      .eq("is_current", true)
      .in("board_id", boardIds);
    if (measRes.error) throw new MaterialsError("internal", measRes.error.message, 500);
    currentMeasurements = (measRes.data ?? []) as BoardMeasurementRow[];
  }

  const measurementByBoard = new Map(currentMeasurements.map(m => [m.board_id, m]));
  const packById = new Map(packs.map(p => [p.id, p]));
  const speciesById = new Map(species.map(s => [s.id, s]));

  // Group by species
  const bySpecies = new Map<string, StockSummaryRow>();

  for (const s of species) {
    bySpecies.set(s.id, {
      species_id:                 s.id,
      species_display_name:       s.display_name,
      pack_count:                 0,
      board_count:                0,
      measured_board_count:       0,
      awaiting_measurement_count: 0,
      allocated_count:            0,
      offcut_count:               0,
      total_volume_m3:            0,
    });
  }

  // Count packs per species
  for (const p of packs) {
    const row = bySpecies.get(p.species_id);
    if (row) row.pack_count += 1;
  }

  // Roll up boards
  const provider = getProvider("hardwood");
  for (const b of boards) {
    const pack = packById.get(b.pack_id);
    if (!pack) continue;
    const row = bySpecies.get(pack.species_id);
    if (!row) continue;

    row.board_count += 1;
    if (b.status === "awaiting_measurement") row.awaiting_measurement_count += 1;
    if (b.status === "measured" || b.status === "allocated" || b.status === "machined" || b.status === "installed") {
      row.measured_board_count += 1;
    }
    if (b.status === "allocated" || b.status === "machined" || b.status === "installed") {
      row.allocated_count += 1;
    }
    if (b.status === "offcut") row.offcut_count += 1;

    const m = measurementByBoard.get(b.id);
    if (m) {
      row.total_volume_m3 += provider.computeVolume(m).volume_m3;
    }
  }

  // Return only species that actually have packs
  return Array.from(bySpecies.values()).filter(r => r.pack_count > 0).sort((a, b) => {
    return b.total_volume_m3 - a.total_volume_m3;
  });
}
