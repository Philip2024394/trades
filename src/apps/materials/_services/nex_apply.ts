// nex_apply · execute a confirmed Add-Stock draft
//
// This is the ONLY writer in the NEX workflow. It stitches together
// the existing services (memory · packs · boards · audit) — never
// calls the database directly and never invents any business rule.
//
// Called by the /api/materials/nex/apply route after the owner has
// confirmed the draft on the confirmation screen.

import "server-only";
import { createBoards } from "./boards";
import { createPack } from "./packs";
import { audit } from "./_audit";
import {
  createMemory as createMemoryRow,
  getMemory,
  touchMemoryUsage,
  updateMemory,
} from "./memory";
import { MaterialsError, type HardwoodPackRow } from "../_schema/types";
import type {
  MemoryRow,
  NexAddStockDraft,
} from "../_schema/memory_types";

export type ApplyResult = {
  /** null when the owner chose to skip Materials Memory for this pack
   *  (one-off purchase). All other actions produce a row. */
  memory: MemoryRow | null;
  pack: HardwoodPackRow;
  boards_created: number;
};

/**
 * Apply a confirmed Add-Stock draft.
 *
 * Steps:
 *   1. Resolve or create the Memory row per draft.memory_action
 *   2. If the intent is hardwood (species set), create a hardwood pack
 *      using existing services · else return an error the UI can act on
 *      (non-hardwood flows will land in a later slice)
 *   3. Create N boards for that pack
 *   4. Increment Memory usage
 *   5. Return the new IDs so the caller can redirect to the pack page
 */
export async function applyAddStockDraft(
  ownerId: string,
  actorEmail: string,
  draft: NexAddStockDraft,
): Promise<ApplyResult> {
  const intent    = draft.intent;
  const overrides = draft.overrides ?? {};

  // Effective values — overrides win over intent, which wins over Memory match
  const materialName = overrides.material_name
    ?? (draft.memory_match.kind !== "none" ? draft.memory_match.row.name : intent.material_query);
  const quantity       = overrides.quantity      ?? intent.quantity;
  const speciesId      = overrides.species_id    ?? (draft.memory_match.kind !== "none" ? draft.memory_match.row.species_id : null);
  const grade          = overrides.typical_grade ?? intent.grade                  ?? null;
  const supplierName   = overrides.supplier_name ?? intent.supplier_name          ?? null;
  const pricePerUnit   = overrides.price_per_unit ?? intent.price_per_unit        ?? null;
  const priceCurrency  = overrides.price_currency ?? intent.price_currency        ?? "GBP";
  const reference      = overrides.reference     ?? intent.reference              ?? null;

  const length_mm     = overrides.length_mm    ?? intent.dimensions?.length_mm    ?? null;
  const width_mm      = overrides.width_mm     ?? intent.dimensions?.width_mm     ?? null;
  const thickness_mm  = overrides.thickness_mm ?? intent.dimensions?.thickness_mm ?? null;

  if (!quantity || quantity <= 0) {
    throw new MaterialsError("invalid_input", "Quantity must be a positive integer.", 422);
  }
  if (!materialName?.trim()) {
    throw new MaterialsError("invalid_input", "Material name is required.", 422);
  }
  if (!speciesId) {
    throw new MaterialsError(
      "invalid_input",
      "This slice supports hardwood packs only — the Memory item must reference a species.",
      422,
    );
  }

  // ── 1. Memory ────────────────────────────────────────────────
  let memory: MemoryRow | null = null;
  if (draft.memory_action === "create_new") {
    memory = await createMemoryRow(ownerId, actorEmail, {
      name:                    materialName.trim(),
      category:                overrides.category ?? "hardwood",
      species_id:              speciesId,
      default_length_mm:       length_mm,
      default_width_mm:        width_mm,
      default_thickness_mm:    thickness_mm,
      typical_grade:           grade,
      typical_price_per_unit:  pricePerUnit,
      price_currency:          priceCurrency,
    });
  } else if (draft.memory_action === "use_existing") {
    if (draft.memory_match.kind === "none") {
      throw new MaterialsError("invalid_input", "No Memory match to use.", 422);
    }
    memory = draft.memory_match.row;
  } else if (draft.memory_action === "update_existing") {
    if (draft.memory_match.kind === "none") {
      throw new MaterialsError("invalid_input", "No Memory match to update.", 422);
    }
    memory = await updateMemory(ownerId, actorEmail, draft.memory_match.row.id, {
      default_length_mm:       length_mm       ?? draft.memory_match.row.default_length_mm,
      default_width_mm:        width_mm        ?? draft.memory_match.row.default_width_mm,
      default_thickness_mm:    thickness_mm    ?? draft.memory_match.row.default_thickness_mm,
      typical_grade:           grade           ?? draft.memory_match.row.typical_grade,
      typical_price_per_unit:  pricePerUnit    ?? draft.memory_match.row.typical_price_per_unit,
      price_currency:          priceCurrency,
    });
  } else if (draft.memory_action === "skip_memory") {
    // One-off purchase — owner explicitly chose not to record this
    // material in Materials Memory. Pack still gets created; Memory
    // is left untouched. Recorded in audit so we can offer to
    // remember it later if the same material shows up again.
    memory = null;
  }

  // ── 2. Pack ──────────────────────────────────────────────────
  const packRef  = generatePackRef();
  const noteBits: string[] = [];
  if (length_mm && width_mm && thickness_mm) {
    const source = memory ? `Materials Memory: ${memory.name}` : `one-off (skip_memory)`;
    noteBits.push(`Default dimensions: ${length_mm} × ${width_mm} × ${thickness_mm} mm (from ${source})`);
  }
  if (supplierName) noteBits.push(`Supplier: ${supplierName}`);
  if (reference)    noteBits.push(`Reference: ${reference}`);
  noteBits.push(`Added via NEX workflow · ${new Date().toISOString().split("T")[0]}`);
  const notes = noteBits.join(" · ");

  const pack = await createPack(ownerId, actorEmail, {
    pack_ref:              packRef,
    species_id:            speciesId,
    grade:                 grade,
    board_count_expected:  quantity,
    purchase_date:         intent.delivery_date ?? new Date().toISOString().split("T")[0],
    purchase_reference:    reference,
    cost_at_purchase:      pricePerUnit != null ? +(pricePerUnit * quantity).toFixed(2) : null,
    cost_currency:         priceCurrency,
    notes,
  });

  // ── 3. Boards ────────────────────────────────────────────────
  const boards = await createBoards(ownerId, actorEmail, pack.id, { count: quantity });

  // ── 4. Memory usage ──────────────────────────────────────────
  if (memory) touchMemoryUsage(memory.id);

  // ── 5. Audit trail ───────────────────────────────────────────
  // We record the ORIGINAL user request (intent.raw) verbatim alongside
  // the full structured intent snapshot. Two reasons Philip flagged:
  //   1. Troubleshooting — a future maintainer can see exactly what the
  //      owner typed vs how NEX interpreted it.
  //   2. Improving intent recognition — the raw ↔ structured pairs are
  //      the training corpus for tightening prompts later.
  //   3. User trust — the owner can review past actions and see "NEX
  //      thought I said X" without having to remember.
  await audit({
    entity_type: "pack",
    entity_id:   pack.id,
    event_type:  "nex_add_stock_applied",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    metadata:    {
      memory_id:       memory?.id ?? null,
      memory_action:   draft.memory_action,
      boards_created:  boards.length,
      original_query:  intent.raw,          // ← the owner's exact wording
      intent_snapshot: intent,              // ← full structured intent (for later analysis)
      memory_match_kind: draft.memory_match.kind,
      memory_match_similarity: draft.memory_match.kind === "fuzzy" ? draft.memory_match.similarity : null,
    },
  });

  return { memory, pack, boards_created: boards.length };
}

function generatePackRef(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(now.getUTCDate()).padStart(2, "0");
  const rnd  = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PACK-${yyyy}${mm}${dd}-${rnd}`;
}
