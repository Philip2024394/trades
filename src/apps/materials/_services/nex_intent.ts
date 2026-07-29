// nex_intent · natural language → structured NexIntent
//
// Orchestration layer only. No business rules · no direct DB writes ·
// no memory lookups. Given a piece of free text, calls the existing
// Anthropic wrapper and returns the intent as a typed object. Callers
// (routes) do the memory resolution + confirmation flow.

import "server-only";
import { completeWithUsage } from "@/lib/llm/anthropic";
import type { NexIntent } from "../_schema/memory_types";

const SYSTEM_PROMPT = `You are NEX, the materials assistant for a staircase manufacturing company.
Your job is to convert one line of natural language into a structured JSON intent.

You only recognise the "add_stock" action right now. For every other kind of request (checking stock, reserving, purchasing, questions), return the "unsupported" action with a short helpful message.

For add_stock, extract as many of these fields as the input mentions:
- quantity (integer · required)
- material_query (natural-language material description · required · verbatim from the input, do not paraphrase)
- species_hint (a wood species if named: "oak", "european oak", "walnut", "ash", "beech", …)
- dimensions.length_mm · dimensions.width_mm · dimensions.thickness_mm (integers · only if dimensions are stated)
- supplier_name (string · only if a supplier is named)
- price_per_unit (number · only if a price is stated)
- price_currency (ISO code · GBP if £ · USD if $ · EUR if €)
- grade (string · only if a grade is stated)
- unit (one of: board, sheet, length, unit, pack, linear_metre, litre, kg — omit if not clear)
- reference (any invoice/PO reference)
- delivery_date (ISO date · only if mentioned)

Rules:
1. Never invent values. If a field isn't in the input, omit it (do NOT set it to null or 0).
2. Keep material_query concise but complete. "Add 20 oak flooring boards" → material_query = "oak flooring boards".
3. Always include the raw input in the "raw" field.
4. Respond with a single JSON object. No prose, no code fences.

Response schema for add_stock:
{
  "action": "add_stock",
  "quantity": <int>,
  "material_query": "<string>",
  "species_hint": <string?>,
  "dimensions": { "length_mm": <int?>, "width_mm": <int?>, "thickness_mm": <int?> } | null,
  "supplier_name": <string?>,
  "price_per_unit": <number?>,
  "price_currency": <string?>,
  "grade": <string?>,
  "unit": <string?>,
  "reference": <string?>,
  "delivery_date": <string?>,
  "raw": "<original input>"
}

Response schema for unsupported:
{
  "action": "unsupported",
  "message": "<short explanation of what NEX can do so far>",
  "raw": "<original input>"
}`;

export async function parseIntent(text: string): Promise<NexIntent> {
  const raw = text.trim();
  if (!raw) {
    return { action: "unsupported", message: "Please tell me what to do.", raw: "" };
  }

  const res = await completeWithUsage({
    system:      SYSTEM_PROMPT,
    messages:    [{ role: "user", content: raw }],
    maxTokens:   500,
    temperature: 0,
  });

  if (!res) {
    // No API key or transport failure — degrade gracefully by returning
    // an unsupported response the UI can act on.
    return {
      action:  "unsupported",
      message: "NEX intent service unavailable (missing API key or network). Ask an admin to check the ANTHROPIC_API_KEY environment variable.",
      raw,
    };
  }

  const parsed = safeParseJson(res.text);
  if (!parsed) {
    return {
      action:  "unsupported",
      message: `NEX couldn't parse that. Try something like "Add 20 oak flooring boards".`,
      raw,
    };
  }

  return normaliseIntent(parsed, raw);
}

function safeParseJson(text: string): unknown {
  try {
    const cleaned = text
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normaliseIntent(obj: unknown, raw: string): NexIntent {
  if (!obj || typeof obj !== "object") {
    return { action: "unsupported", message: "NEX returned an unexpected shape.", raw };
  }
  const o = obj as Record<string, unknown>;
  const action = o.action;

  if (action === "unsupported") {
    return {
      action:  "unsupported",
      message: typeof o.message === "string" ? o.message : "Not yet supported.",
      raw,
    };
  }

  if (action === "add_stock") {
    const quantity = toInt(o.quantity);
    const materialQuery = typeof o.material_query === "string" ? o.material_query.trim() : "";
    if (!quantity || quantity <= 0 || !materialQuery) {
      return {
        action:  "unsupported",
        message: "I need a quantity and a material name — try 'Add 20 oak flooring boards'.",
        raw,
      };
    }

    const dimsRaw = o.dimensions as Record<string, unknown> | null | undefined;
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
      species_hint:    toStrOrNull(o.species_hint),
      dimensions:      dims,
      supplier_name:   toStrOrNull(o.supplier_name),
      price_per_unit:  toNumberOrNull(o.price_per_unit),
      price_currency:  toStrOrNull(o.price_currency),
      grade:           toStrOrNull(o.grade),
      unit:            toUnitOrNull(o.unit),
      reference:       toStrOrNull(o.reference),
      delivery_date:   toStrOrNull(o.delivery_date),
      raw,
    };
  }

  return { action: "unsupported", message: "Unrecognised action.", raw };
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
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
