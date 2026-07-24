// Basket parser — "120 concrete blocks" → ProductRequest.
//
// Extracts qty + unit + keyword from a natural sentence. When the
// user asks in AREA terms ("plasterboard for 42m² of ceiling") we
// still surface an area hint so callers can pipe it into Phase 7
// estimator if they want a precise quantity.

export type ParsedBasket = {
  keyword:            string;
  qty:                number | null;
  unit:               string | null;
  hint_area_m2:       number | null;
  parsed_confidence:  "high" | "medium" | "low";
  parse_reason:       string;
};

/** Common material nouns we recognise + their default units. */
const MATERIAL_NOUNS: Array<{ re: RegExp; keyword: string; unit: string | null }> = [
  { re: /\b(concrete\s+)?blocks?\b/i,           keyword: "concrete block", unit: "each" },
  { re: /\bbricks?\b/i,                          keyword: "brick",           unit: "each" },
  { re: /\bplasterboard(s)?\b/i,                keyword: "plasterboard",    unit: "board" },
  { re: /\bplaster\s+bags?\b|\bbags?\s+of\s+plaster\b/i, keyword: "plaster", unit: "bag" },
  { re: /\btimber|wood|joists?\b/i,              keyword: "timber",          unit: "m" },
  { re: /\binsulation\b/i,                        keyword: "insulation",      unit: "m2" },
  { re: /\bpaint\b/i,                             keyword: "paint",           unit: "each" },
  { re: /\btiles?\b/i,                            keyword: "tile",            unit: "m2" },
  { re: /\bcement\b/i,                            keyword: "cement",          unit: "bag" },
  { re: /\bsand\b/i,                              keyword: "sand",            unit: "tonne" },
  { re: /\baggregate\b/i,                         keyword: "aggregate",       unit: "tonne" },
  { re: /\broof\s+tiles?\b|\bslate\b/i,           keyword: "roof tile",       unit: "each" },
  { re: /\bcopper\s+pipe|\bpipes?\b/i,            keyword: "pipe",            unit: "m" },
  { re: /\bcable\b|\bwiring\b/i,                  keyword: "electrical cable", unit: "m" }
];

const AREA_RE = /(\d+(?:\.\d+)?)\s*(?:m2|m²|sq\.?\s*m|square\s+met(?:re|er)s?|sqm)/i;
// Match a qty ANYWHERE followed by a unit-like noun. Don't require the
// number to be at the start of the ask.
const QTY_RE  = /\b(\d+(?:\.\d+)?)\s*(?:x\s+)?(?:concrete\s+blocks?|blocks?|bricks?|plasterboards?|boards?|bags?|tiles?|litres?|tins?|packs?|tonnes?|rolls?|pieces?|pcs|widgets?|units?|m\b)/i;

export function parseBasketRequest(text: string): ParsedBasket {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. Try area form first — beats qty parsing since 42m² of plasterboard
  //    is an AREA hint, not "42 boards".
  const areaMatch = lower.match(AREA_RE);
  const area = areaMatch ? Number(areaMatch[1]) : null;

  // 2. Recognise the material keyword.
  const material = MATERIAL_NOUNS.find((m) => m.re.test(lower));

  // 3. Extract explicit qty at start ("120 blocks", "40 boards").
  const qtyMatch = raw.match(QTY_RE);
  const qty = qtyMatch ? Number(qtyMatch[1]) : null;

  if (material) {
    if (area !== null) {
      return {
        keyword:           material.keyword,
        qty:               null,
        unit:              material.unit ?? null,
        hint_area_m2:      area,
        parsed_confidence: "medium",
        parse_reason:      `Recognised "${material.keyword}" with ${area} m² area hint. Route through the estimator for a precise per-unit quantity.`
      };
    }
    if (qty !== null && qty > 0 && qty < 100_000) {
      return {
        keyword:           material.keyword,
        qty,
        unit:              material.unit ?? null,
        hint_area_m2:      null,
        parsed_confidence: "high",
        parse_reason:      `Recognised "${material.keyword}" with an explicit quantity of ${qty}.`
      };
    }
    return {
      keyword:           material.keyword,
      qty:               null,
      unit:              material.unit ?? null,
      hint_area_m2:      null,
      parsed_confidence: "low",
      parse_reason:      `Recognised "${material.keyword}" but no quantity in the ask.`
    };
  }

  // 4. Fallback — try to pull the last noun-ish token as keyword.
  const tail = raw.match(/\b([a-z][a-z\s-]{2,40})$/i);
  const keyword = tail ? tail[1].trim() : raw;
  return {
    keyword,
    qty,
    unit:              null,
    hint_area_m2:      area,
    parsed_confidence: "low",
    parse_reason:      `Couldn't recognise a known material keyword — searching by "${keyword}" verbatim.`
  };
}
