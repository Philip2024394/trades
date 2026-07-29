// nex_document · image/document → structured NexIntent
//
// Wraps the existing askVisionJson helper. Same intent shape as
// nex_intent so downstream code doesn't care whether the workflow
// started from typed text or an uploaded delivery note.
//
// No DB writes · no memory lookups · no business rules. Pure LLM call.

import "server-only";
import { askVisionJson } from "@/lib/llm/multimodal";
import type { NexIntent } from "../_schema/memory_types";

const SYSTEM_PROMPT = `You are NEX, the materials assistant for a staircase manufacturing company.
You will be shown an image of a supplier delivery note, invoice, receipt, or supplier email screenshot.

Your job is to extract the structured intent — always "add_stock" — with as many of these fields as the document reveals:
- quantity (integer · required · from a line item)
- material_query (concise material name as printed on the document · required)
- species_hint (wood species if identifiable)
- dimensions.length_mm · dimensions.width_mm · dimensions.thickness_mm (integers · convert from cm/inches if needed)
- supplier_name (from the letterhead)
- price_per_unit (per-unit price · unit price not line total)
- price_currency (ISO — GBP if £ · USD if $ · EUR if €)
- grade (if a grade is printed: Prime, Select, FAS, Character, etc.)
- unit (board, sheet, length, unit, pack, linear_metre, litre, kg)
- reference (invoice number · PO number · delivery ref)
- delivery_date (ISO date if a date is printed)

Rules:
1. Never invent values. Omit any field you cannot read.
2. If the document contains multiple line items, extract the LARGEST (highest quantity or highest value) line.
3. If nothing usable is visible, return {"action":"unsupported","message":"Couldn't read a stock entry from this document.","raw":"<document>"}.
4. Respond with a single JSON object. No prose, no code fences.
5. Set "raw" to a short human description of what you saw (e.g. "Delivery note from James Latham, 20 oak PAR boards").

Response schema (same as nex_intent): add_stock or unsupported.`;

export async function extractIntentFromDocument(
  imageBase64: string,
  mime: string,
): Promise<NexIntent> {
  const parsed = await askVisionJson<Record<string, unknown>>({
    imageBase64,
    imageMimeType: mime,
    system:        SYSTEM_PROMPT,
    userText:      "Extract the stock entry from this document. Return JSON only.",
    maxTokens:     900,
  });

  if (!parsed) {
    return {
      action:  "unsupported",
      message: "NEX couldn't read that document. Try a clearer photo or type the details.",
      raw:     "(document upload)",
    };
  }

  return normaliseFromVision(parsed);
}

function normaliseFromVision(obj: Record<string, unknown>): NexIntent {
  const raw = typeof obj.raw === "string" ? obj.raw : "(document upload)";
  if (obj.action === "unsupported") {
    return { action: "unsupported", message: typeof obj.message === "string" ? obj.message : "Couldn't parse.", raw };
  }
  if (obj.action !== "add_stock") {
    return { action: "unsupported", message: "Unrecognised action.", raw };
  }

  const quantity = toInt(obj.quantity);
  const materialQuery = typeof obj.material_query === "string" ? obj.material_query.trim() : "";
  if (!quantity || quantity <= 0 || !materialQuery) {
    return { action: "unsupported", message: "The document didn't have a readable quantity + material line.", raw };
  }

  const dimsRaw = obj.dimensions as Record<string, unknown> | null | undefined;
  const dims = dimsRaw && typeof dimsRaw === "object"
    ? {
        length_mm:    toInt(dimsRaw.length_mm),
        width_mm:     toInt(dimsRaw.width_mm),
        thickness_mm: toInt(dimsRaw.thickness_mm),
      }
    : null;

  return {
    action:          "add_stock",
    quantity,
    material_query:  materialQuery,
    species_hint:    toStrOrNull(obj.species_hint),
    dimensions:      dims,
    supplier_name:   toStrOrNull(obj.supplier_name),
    price_per_unit:  toNumberOrNull(obj.price_per_unit),
    price_currency:  toStrOrNull(obj.price_currency),
    grade:           toStrOrNull(obj.grade),
    unit:            toUnitOrNull(obj.unit),
    reference:       toStrOrNull(obj.reference),
    delivery_date:   toStrOrNull(obj.delivery_date),
    raw,
  };
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function toStrOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function toUnitOrNull(v: unknown): "board"|"sheet"|"length"|"unit"|"pack"|"linear_metre"|"litre"|"kg"|null {
  const allowed = ["board","sheet","length","unit","pack","linear_metre","litre","kg"] as const;
  if (typeof v !== "string") return null;
  const lower = v.toLowerCase();
  return (allowed as readonly string[]).includes(lower) ? (lower as (typeof allowed)[number]) : null;
}
