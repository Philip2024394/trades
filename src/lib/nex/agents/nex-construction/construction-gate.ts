// src/lib/nex/agents/nex-construction/construction-gate.ts
//
// WAVE-S-5 · Deterministic construction classifier + safety signals
// Founder BEGIN WAVE-S-5 · 2026-09-08
// Founder correction 2026-09-08: general (all countries) + NEX-scoped
// Founder addition 2026-09-08: staircase-aware (defers detail to
// existing staircase-advisor / staircase-components / staircase-geometry
// modules · this specialist only recognises + surfaces the query)

import type {
  ConstructionRequest,
  ConstructionRequestKind,
  ConstructionResponse,
  ConstructionSafetySignal,
} from "./types";

export function classifyConstructionRequest(text: string): ConstructionRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";

  // Staircase check first — NEX has dedicated staircase modules · route to a
  // staircase_query kind so the caller can hand off to those modules for detail.
  if (/\b(stair(?:s|case)?|steps?|flight of stairs|helical stair|spiral stair|winder|going|riser|nosing|balustrade|handrail|newel|stringer|pitch of (?:the )?stair)\b/.test(t)) return "staircase_query";

  // Shared-wall dispute (party-wall in UK · analog frameworks elsewhere)
  if (/\b(party wall|party.wall|shared wall|neighbou?r('s)? wall|adjoining (?:owner|property)|dividing wall|boundary wall)\b/.test(t)) return "shared_wall_dispute";

  // Trade licensing boundary: gas / electrical / asbestos · region-specific licences
  if (/\b(gas safe|gas engineer|gas installation|gas licence|f.gas|part p|electrical licence|licensed electrician|asbestos licen[cs]e|licensed asbestos|master plumber|master electrician|hvac licence)\b/.test(t)) return "trade_licensing_boundary";

  // Regulatory check · recognises many jurisdictions' framework names
  if (/\b(building reg(?:s|ulations)?|building code|ibc\b|nfpa|part [a-p]\b|cdm 2015|cdm regs|riddor|planning permission|planning consent|zoning|approved document|listed building consent|as\/nzs \d+|iso \d+ construction|en \d+|astm [ce]?\d+|nbcc|iras|osha construction|permit to work|building permit|construction permit)\b/.test(t)) return "regulatory_check";

  // Safety / risk assessment
  if (/\b(risk assessment|method statement|working at height|scaffold|scaffolding|harness|confined space|permit to work|toolbox talk|jsa\b|jha\b|swms)\b/.test(t)) return "safety_risk_assessment";

  // Material quantity
  if (/\b(how much|how many|quantity of|estimate .* (bricks|blocks|bags|litres|gallons|m[²2]|ft[²2]|square metres|square feet|cubic metres|cubic yards|tonnes|kg|lbs)|per m[²2]|per square metre|per square foot)\b/.test(t)) return "material_quantity";

  // Structural
  if (/\b(remove (?:a |the )?wall|load bearing|lintel|steel beam|rsj|rolled steel joist|foundation|underpin|structural (?:engineer|survey|calculation|analysis))\b/.test(t)) return "structural_query";

  // Quotation advice
  if (/\b(quote|quotation|price for|day rate|labour rate|labor rate|priced schedule|schedule of rates|bid|tender)\b/.test(t)) return "quotation_advice";

  // Method statement (specific · runs after safety_risk_assessment to avoid overlap)
  if (/\b(sequence of work|work sequence|installation method|construction method|construction sequence)\b/.test(t)) return "method_statement";

  return "unknown";
}

// ─── Safety-signal patterns · country-agnostic ─────────────────────

const ASBESTOS_RE = /\b(asbestos|acm|artex|popcorn ceiling|pipe lagging|insulation board|pre.?2000 (?:build|property|house|ceiling|pipe)|pre.1999|pre.2000)\b/i;
const LICENSED_ASBESTOS_CTX_RE = /\b(?:remove|scrape|drill|cut|sand|break) .*(?:asbestos|artex|popcorn ceiling|pipe lagging|insulation board)\b/i;
const GAS_WORK_RE = /\b(install(?:ing)? (?:a )?boiler|gas cooker|gas hob|gas fire|change (?:a )?boiler|move (?:a )?boiler|gas pipework|gas connection|combi swap|flue installation|gas line|new gas)\b/i;
const ELECTRICAL_RE = /\b(consumer unit|fuse box|breaker panel|main panel|rewire|part p work|kitchen circuit|bathroom circuit|new circuit|shower circuit|outdoor socket|outdoor outlet|240v install|110v new circuit)\b/i;
const HEIGHT_RE = /\b(work(?:ing)? at height|on the roof|three storey|three story|scaffold(?:less|less)?|no scaffold|ladder to (?:the )?(?:roof|gutter|chimney|eaves)|chimney (?:repair|removal|access)|edge protection missing|working on eaves|standing on ridge)\b/i;
const STRUCTURAL_LOAD_RE = /\b(remove (?:a |the )?(?:(?:supporting|load.bearing|internal|structural)\s+)+wall|remove chimney breast|remove lintel|add(?:ing)? (?:a )?loft conversion|extend upwards|dormer without|beam without|remove structural)\b/i;
const PARTY_WALL_RE = /\b(party wall|party.wall|shared wall|neighbou?r('s)? wall|adjoining (?:owner|property)|dividing wall|boundary wall)\b/i;
const FABRICATED_QTY_RE = /\b(exactly \d+ (?:bricks|blocks|bags|litres|gallons)|precisely \d+ (?:bags|m[²2]|ft[²2])|guaranteed \d+ (?:m[²2]|ft[²2])|£\d+ per (?:day|hour|m[²2])|\$\d+ per (?:day|hour|sqft|m[²2]))\b/i;
// Broader "guaranteed rate" heuristic: any mention of "guaranteed" together
// with a currency-per-unit price (in either order) is treated as unsupported.
const FABRICATED_QTY_LOOSE_RE = /\bguaranteed\b/i;
// `\b` does not fire adjacent to £/$/€/² in JS regex (both sides are \W) ·
// use explicit non-word / start / end boundaries on both sides.
const CURRENCY_RATE_RE = /(?:^|[^A-Za-z0-9])(?:£|\$|€)\s?\d+(?:\.\d+)?\s?(?:per|\/)\s?(?:day|hour|m[²2]|sqft|ft[²2])(?:$|[^A-Za-z0-9])/i;

// Regulatory-context detector · returns matched regime name or null
function detectRegulatoryRegime(text: string): string | null {
  const m = text.match(/\b(part [a-p]\b|cdm 2015|cdm regs|riddor|building reg(?:s|ulations)?|building code|ibc\b|nfpa|planning permission|planning consent|zoning|listed building consent|approved document [a-z]|as\/nzs \d+|iso \d+ construction|en \d+|astm [ce]?\d+|nbcc|osha construction|building permit|construction permit)\b/i);
  return m ? m[0].toUpperCase() : null;
}

export function detectConstructionSafetySignals(
  req: ConstructionRequest,
  _kind: ConstructionRequestKind,
): ConstructionSafetySignal[] {
  const out: ConstructionSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();
  const jur = (req.jurisdiction ?? "").trim();

  if (ASBESTOS_RE.test(text)) {
    const diyContext = LICENSED_ASBESTOS_CTX_RE.test(text);
    out.push({
      kind: "asbestos_risk",
      description: diyContext
        ? "asbestos-containing material (ACM) work described · almost every jurisdiction requires a LICENSED asbestos removal contractor for HSE / OSHA / regulator-defined work · never DIY-scrape/drill/sand/cut ACMs · commission survey first"
        : "asbestos-containing material (ACM) possibly present · properties built before ~2000 may contain ACMs in ceilings · pipes · insulation boards · always survey before disturbing any material",
    });
  }

  if (GAS_WORK_RE.test(text)) {
    const jurNote = jur ? ` (jurisdiction context: ${jur})` : "";
    out.push({
      kind: "gas_work_licensing_required",
      description: `gas installation / alteration described${jurNote} · all major jurisdictions require a LICENSED gas fitter (UK: Gas Safe · AU: licensed gas fitter · US: licensed plumber/gas fitter varies by state · ID: SNI-certified) · unlicensed gas work is typically a criminal offence and voids insurance`,
    });
  }

  if (ELECTRICAL_RE.test(text)) {
    const jurNote = jur ? ` (jurisdiction context: ${jur})` : "";
    out.push({
      kind: "electrical_work_licensing_required",
      description: `electrical work in wet locations / new circuits / consumer unit / breaker panel typically requires a LICENSED electrician${jurNote} · UK: Part P notifiable · AU: licensed electrician mandatory · US: master electrician + permit varies · ID: SNI-certified · verify local licensing regime before work`,
    });
  }

  if (HEIGHT_RE.test(text)) {
    out.push({
      kind: "working_at_height_risk",
      description: "working-at-height described · universal principles: plan · avoid where reasonable · use edge protection / fall arrest · never sole-worker on a roof · scaffold + qualified erector for anything beyond basic ladder work · UK: Work at Height Regs 2005 · US: OSHA 1926 Subpart M · AU: WHS Regulations · EU: Directive 2001/45/EC",
    });
  }

  if (STRUCTURAL_LOAD_RE.test(text)) {
    out.push({
      kind: "structural_load_risk",
      description: "load-bearing / structural modification described · qualified structural engineer calculation + permit / Building Control notice required in every major jurisdiction · never remove supporting elements without engineered sign-off",
    });
  }

  const regime = detectRegulatoryRegime(text);
  if (regime) {
    out.push({
      kind: "regulatory_compliance_risk",
      regime,
      description: `request touches a regulatory regime (${regime}) · specialised professional review required · Building Control / planning authority / permit notification may be mandatory in the relevant jurisdiction`,
    });
  }

  if (PARTY_WALL_RE.test(text)) {
    out.push({
      kind: "shared_wall_notice_required",
      description: "notifiable work adjacent to / on a shared wall · UK: Party Wall etc. Act 1996 requires notice ≥2 months in advance · other jurisdictions have analog frameworks (US: local ordinance / easement law · AU: state-specific dividing-wall acts · EU: national civil-code servitude rules) · serve appropriate notice and secure adjoining-owner consent before work",
    });
  }

  const strictHit = FABRICATED_QTY_RE.test(text);
  const looseHit = FABRICATED_QTY_LOOSE_RE.test(text) && CURRENCY_RATE_RE.test(text);
  if (strictHit || looseHit) {
    out.push({
      kind: "unsupported_quantity_or_price",
      description: "specific quantities / £ or $ or € rates / m² or ft² figures asserted (often with 'guaranteed') without evidence base · NEX Phase 3 will not fabricate quantity or price data · defer to a real take-off / quantity surveyor / priced schedule",
    });
  }

  if (out.length === 0) out.push({ kind: "no_construction_safety_concern" });
  return out;
}

export function respondConstruction(req: ConstructionRequest): ConstructionResponse {
  const kind = classifyConstructionRequest(req.request_text);
  const signals = detectConstructionSafetySignals(req, kind);
  const has_serious = signals.some((s) => s.kind !== "no_construction_safety_concern");
  // Phase 3 defers LLM-generated method statements · real quantity take-offs ·
  // structural calculations · staircase detail work · to Phase 4 / dedicated
  // subsystems.
  const deferred = kind === "method_statement" || kind === "material_quantity" || kind === "quotation_advice" || kind === "structural_query" || kind === "staircase_query";
  const requires_review = has_serious || kind === "unknown" || kind === "trade_licensing_boundary" || kind === "shared_wall_dispute";

  const lines: string[] = [];
  lines.push(`Construction request classified as: ${kind}.`);
  if (kind === "staircase_query") {
    lines.push("NEX has dedicated staircase knowledge modules (staircase-advisor · staircase-components · staircase-geometry · staircase-bridge) · route detail work through those rather than duplicating here.");
  }
  if (deferred) lines.push("Phase 3 specialist does not generate detailed method statements / quantity take-offs / structural calculations / priced quotations / detailed staircase advice · deferred to Phase 4 (LLM via gateway + real data sources · qualified professional oversight · dedicated NEX subsystems where applicable).");
  for (const s of signals) {
    if (s.kind === "no_construction_safety_concern") continue;
    if (s.kind === "asbestos_risk") lines.push(`⚠️ Asbestos-risk flag · never DIY-disturb suspected ACMs · survey first · use licensed removal where required.`);
    else if (s.kind === "gas_work_licensing_required") lines.push(`⚠️ Gas-work licensing flag · gas work must be carried out by a licensed gas fitter in the relevant jurisdiction.`);
    else if (s.kind === "electrical_work_licensing_required") lines.push(`Electrical-work licensing flag · notifiable work typically requires a licensed electrician + permit in the relevant jurisdiction.`);
    else if (s.kind === "working_at_height_risk") lines.push(`Working-at-height flag · universal safe-at-height principles apply · scaffold + qualified erector where appropriate.`);
    else if (s.kind === "structural_load_risk") lines.push(`Structural-load flag · qualified structural engineer calculation + permit required before altering load-bearing elements.`);
    else if (s.kind === "regulatory_compliance_risk") lines.push(`Regulatory flag · ${s.regime} · specialised professional review · permit / notification may be required.`);
    else if (s.kind === "shared_wall_notice_required") lines.push(`Shared-wall notice flag · serve jurisdiction-appropriate notice on adjoining owner(s) before notifiable works.`);
    else if (s.kind === "unsupported_quantity_or_price") lines.push(`Unsupported-quantity flag · NEX will not fabricate m² / ft² / bag counts / rates · defer to a real take-off or QS.`);
  }

  return {
    request_id: req.request_id,
    detected_kind: kind,
    safety_signals: signals,
    advisory_text: lines.join(" "),
    requires_human_review: requires_review,
    deferred_to_phase_4: deferred,
  };
}
