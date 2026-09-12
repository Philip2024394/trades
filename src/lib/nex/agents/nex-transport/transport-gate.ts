// src/lib/nex/agents/nex-transport/transport-gate.ts
//
// WAVE-S-7 · Deterministic transport/logistics classifier + safety signals
// Founder BEGIN WAVE-S-7 · 2026-09-08

import type {
  TransportRequest,
  TransportRequestKind,
  TransportResponse,
  TransportSafetySignal,
} from "./types";

// ─── Emergency short-circuit (runs first · non-negotiable) ─────────

const EMERGENCY_KEYWORDS = /\b(?:crash|collision|rolled over|jack.?knifed|overturned|vehicle fire|lorry fire|truck fire|van fire|hazmat spill|chemical spill|fuel spill|tanker (?:is )?(?:leak|spill|leaking)|leaking chemicals|driver (?:collapsed|unconscious|injured)|need an ambulance for (?:the )?(?:driver|passenger)|call emergency services)\b/i;

function isEmergencyLike(text: string): boolean {
  return EMERGENCY_KEYWORDS.test(text);
}

// ─── Main classifier ───────────────────────────────────────────────

export function classifyTransportRequest(text: string): TransportRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";

  if (isEmergencyLike(t)) return "emergency_incident";

  // Driver hours · runs before generic driving/route (WTD 561/2006 · HOS · CoR · fatigue)
  if (/\b(driver hours|hours of service|hos|working time directive|wtd|tachograph|chain of responsibility|cor fatigue|rest break|11.hour break|9.hour daily|driving limit|drove for \d+ hours?|fatigued driver)\b/.test(t)) return "driver_hours_query";

  // Hazmat · dangerous goods · specific
  if (/\b(hazmat|hazardous (?:goods|materials)|dangerous goods|adr\b|imdg|iata dgr|49 cfr|class 1 explosive|class 3 flammable|class 8 corrosive|un\d{4})\b/.test(t)) return "hazmat_transport_query";

  // Customs / cross-border
  if (/\b(customs|import declaration|export declaration|hs code|tariff|duty|manifest|bill of lading|cmr|carnet|import license|export license|cross.border|border crossing)\b/.test(t)) return "customs_declaration_query";

  // Vehicle maintenance / roadworthiness · includes basic defect language
  if (/\b(mot|dvsa|dot inspection|roadworthy|tyre depth|bald tyres?|worn tyres?|brake test|brake (?:failing|failed|slipping)|preventative maintenance|inspection interval|annual test|walk.round check|defect report|nrs|pmi|cracked windscreen|missing mirror|headlight (?:not working|broken))\b/.test(t)) return "vehicle_maintenance_query";

  // Passenger transport (child seat · minibus · school bus · PSV)
  if (/\b(passenger transport|psv|minibus|school bus|school transport|coach hire|child seat|booster seat|isofix|taxi licence|private hire)\b/.test(t)) return "passenger_transport";

  // Fleet management
  if (/\b(fleet management|fleet size|vehicle utilisation|utilization rate|telematics|driver score|dvir|electronic logging|eld)\b/.test(t)) return "fleet_management";

  // Freight pricing / quotes
  if (/\b(freight (?:rate|quote|pricing)|per mile|per kilometre|per km|price per (?:load|container|pallet)|day rate for haulage|haulage rate|shipping rate|quote for freight)\b/.test(t)) return "freight_pricing";

  // Route planning
  if (/\b(route (?:planning|optimisation|optimization)|delivery route|best route|shortest route|multi.drop|drop sequence|route sheet)\b/.test(t)) return "route_planning";

  // Cargo general (catch-all shipping/haulage discussion)
  if (/\b(cargo|shipment|shipment tracking|palletised freight|palletized freight|full truckload|less than truckload|ftl|ltl|container shipping|haulage)\b/.test(t)) return "cargo_general";

  return "unknown";
}

// ─── Safety-signal patterns ────────────────────────────────────────

const DRIVER_HOURS_UNSAFE_RE = /\b(drove for \d+ hours?|driven \d+ hours? without break|skipped (?:my |the )?rest|no break in \d+ hours?|falsify (?:my )?tachograph|fake tachograph|tampered? tachograph|fatigued but need to (?:drive|continue))\b/i;
const HAZMAT_ANY_MENTION_RE = /\b(hazmat|hazardous (?:goods|materials)|dangerous goods|adr\b|imdg|iata dgr|49 cfr|class 1 explosive|class 3 flammable|class 8 corrosive|un\d{4}|petrol tanker|diesel tanker|chemical tanker|lpg tanker)\b/i;
const ROADWORTHINESS_RISK_RE = /\b(bald tyres?|worn tyres?|brakes? (?:failing|failed|slipping|not (?:great|working))|mot expired|driving with expired mot|driving without mot|no valid mot|missing mirror|cracked windscreen (?:blocking view|obstructing)|steering pulls hard|headlight (?:not working|broken))\b/i;
const CUSTOMS_ANY_MENTION_RE = /\b(customs|import declaration|export declaration|hs code|tariff|carnet|cross.border|border crossing)\b/i;
const UNLICENSED_CARRIER_RE = /\b(without (?:an )?operator licence|no operator licence|without cpc|no cpc|without (?:vocational|hgv|psv|pcv) licence|no (?:vocational|hgv|psv|pcv) licence|drive commercially without licence|self.dispatch without licence)\b/i;
const PASSENGER_SAFETY_RE = /\b(child (?:seat|restraint)|booster seat|no seatbelt|standing passengers|overloaded (?:bus|coach|minibus)|child in front seat)\b/i;
const FABRICATED_QUOTE_RE = /\b(guaranteed £\d+ per (?:mile|km|load|container|pallet)|guaranteed \$\d+ per (?:mile|km|load|container|pallet)|precisely £\d+ per|exactly \d+ per mile)\b/i;
// Loose currency-per-unit check needs same £/$/€ boundary trick as construction
const CURRENCY_HAULAGE_RATE_RE = /(?:^|[^A-Za-z0-9])(?:£|\$|€)\s?\d+(?:\.\d+)?\s?(?:per|\/)\s?(?:mile|km|kilometre|load|container|pallet|day)(?:$|[^A-Za-z0-9])/i;

function emergencyRouteRegime(text: string, jurisdiction?: string): string {
  const jur = (jurisdiction ?? "").toLowerCase();
  const t = text.toLowerCase();
  if (jur.startsWith("uk") || /\b(uk|britain|united kingdom|england|scotland|wales)\b/.test(t)) return "UK: 999 (emergency)";
  if (jur.startsWith("us") || /\b(us|usa|united states|america)\b/.test(t)) return "US: 911";
  if (jur.startsWith("au") || /\baustralia\b/.test(t)) return "AU: 000";
  if (jur.startsWith("eu") || /\b(europe|eu|schengen)\b/.test(t)) return "EU: 112";
  if (jur.startsWith("id") || /\bindonesia\b/.test(t)) return "ID: 112 (emergency) · 119 (ambulance)";
  if (jur.startsWith("jp") || /\bjapan\b/.test(t)) return "JP: 119 (fire/ambulance) · 110 (police)";
  return "route to jurisdiction-appropriate emergency line (UK 999 · US 911 · EU 112 · AU 000 · ID 112/119 · JP 119)";
}

export function detectTransportSafetySignals(
  req: TransportRequest,
  kind: TransportRequestKind,
): TransportSafetySignal[] {
  const out: TransportSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();
  const jur = req.jurisdiction;

  // Emergency routing takes priority · always attached when emergency-shaped
  if (kind === "emergency_incident" || isEmergencyLike(text)) {
    out.push({
      kind: "emergency_route",
      regime_hint: emergencyRouteRegime(text, jur),
      description: "possible transport emergency detected · NEX Phase 3 does not respond to incidents · call the appropriate emergency line NOW · secure the scene · protect casualties",
    });
    // Emergency does NOT suppress other flags · continue detecting
  }

  // Driver hours: any driver-hours-query kind emits regulatory flag; unsafe patterns emit stronger warning
  if (kind === "driver_hours_query" || /\b(driver hours|hours of service|tachograph|working time directive|rest break)\b/.test(text)) {
    out.push({
      kind: "driver_hours_regulation_risk",
      description: "driver-hours topic · UK/EU: Regulation (EC) 561/2006 + Working Time Directive · US: FMCSA HOS (49 CFR 395) · AU: HVNL Chain of Responsibility · fatigue-related driving is dangerous AND unlawful · never drive over legal limits",
    });
  }
  if (DRIVER_HOURS_UNSAFE_RE.test(text)) {
    // Additional strong flag layered on top
    out.push({
      kind: "driver_hours_regulation_risk",
      description: "specific unsafe/unlawful driver-hours language detected (long stretch without break · tachograph tampering · fatigued-but-continuing) · NEX will not advise on how to work around driver-hours limits · take the required rest break",
    });
  }

  if (HAZMAT_ANY_MENTION_RE.test(text)) {
    out.push({
      kind: "hazmat_handling_boundary",
      description: "hazardous / dangerous-goods transport described · ADR (EU/UK road) · IMDG (sea) · IATA DGR (air) · 49 CFR (US road) · dangerous-goods driver certificate + placarding + segregation + emergency-response documentation required · never transport DG without certified training",
    });
  }

  if (ROADWORTHINESS_RISK_RE.test(text)) {
    out.push({
      kind: "vehicle_roadworthiness_risk",
      description: "vehicle-roadworthiness concern (bald tyres · brake defect · expired inspection · etc.) · defect must be repaired before use · driving an unroadworthy vehicle is unlawful in every major jurisdiction · UK DVSA · US DOT · AU NHVR enforcement",
    });
  }

  if (CUSTOMS_ANY_MENTION_RE.test(text)) {
    out.push({
      kind: "cross_border_customs_boundary",
      description: "cross-border customs topic · correct HS code + tariff + declaration + manifest required · restricted-goods rules apply · engage a licensed customs broker for complex loads · declarations under wrong HS code carry penalties",
    });
  }

  if (UNLICENSED_CARRIER_RE.test(text)) {
    out.push({
      kind: "unlicensed_carrier_boundary",
      description: "unlicensed-carrier / unlicensed-driver operation described · UK: Operator Licence + Driver CPC + vocational entitlement required for commercial carriage · US: FMCSA operating authority · AU: NHVR accreditation · operating without required licences is unlawful",
    });
  }

  if (kind === "passenger_transport" || PASSENGER_SAFETY_RE.test(text)) {
    out.push({
      kind: "passenger_safety_risk",
      description: "passenger-transport safety concern · child restraints (UK i-Size / US FMVSS 213 / EU R129 / AU AS/NZS 1754) · seatbelt use · standing-passenger limits · overloading · PSV/PCV vocational entitlement required · school-transport rules jurisdiction-specific",
    });
  }

  const strictQuoteHit = FABRICATED_QUOTE_RE.test(text);
  const looseQuoteHit = /\bguaranteed\b/i.test(text) && CURRENCY_HAULAGE_RATE_RE.test(text);
  if (strictQuoteHit || looseQuoteHit) {
    out.push({
      kind: "unsupported_freight_quote",
      description: "guaranteed £/$/€ per mile / km / load / container / pallet / day figures asserted without evidence base · NEX Phase 3 will not fabricate haulage rates · defer to a live freight-broker quote or priced schedule",
    });
  }

  if (out.length === 0) out.push({ kind: "no_transport_safety_concern" });
  return out;
}

export function respondTransport(req: TransportRequest): TransportResponse {
  const kind = classifyTransportRequest(req.request_text);
  const signals = detectTransportSafetySignals(req, kind);
  const has_serious = signals.some((s) => s.kind !== "no_transport_safety_concern");
  // Phase 3 defers real freight-broker rates · route optimisation · fleet analytics · LLM-generated content to Phase 4.
  const deferred = kind === "freight_pricing" || kind === "route_planning" || kind === "fleet_management" || kind === "cargo_general";
  const requires_review = has_serious
    || kind === "unknown"
    || kind === "driver_hours_query"
    || kind === "hazmat_transport_query"
    || kind === "customs_declaration_query"
    || kind === "vehicle_maintenance_query"
    || kind === "passenger_transport"
    || kind === "emergency_incident";

  const lines: string[] = [];
  lines.push(`Transport request classified as: ${kind}.`);
  if (deferred) lines.push("Phase 3 specialist does not generate live freight rates / route optimisation / fleet analytics · deferred to Phase 4 (LLM via gateway + real broker/telematics data · qualified operator oversight).");
  for (const s of signals) {
    if (s.kind === "no_transport_safety_concern") continue;
    if (s.kind === "emergency_route") lines.push(`🚨 EMERGENCY · call ${s.regime_hint} · secure scene · protect casualties.`);
    else if (s.kind === "driver_hours_regulation_risk") lines.push(`⚠️ Driver-hours flag · never drive over legal limits · fatigue causes fatal collisions.`);
    else if (s.kind === "hazmat_handling_boundary") lines.push(`⚠️ Hazmat / dangerous-goods flag · certified training + documentation required · never transport DG without proper credentials.`);
    else if (s.kind === "vehicle_roadworthiness_risk") lines.push(`Roadworthiness flag · defect must be repaired · driving unroadworthy is unlawful.`);
    else if (s.kind === "cross_border_customs_boundary") lines.push(`Customs flag · correct HS code + tariff + declaration · engage licensed broker for complex loads.`);
    else if (s.kind === "unlicensed_carrier_boundary") lines.push(`Unlicensed-carrier flag · required operator + vocational licences before commercial carriage.`);
    else if (s.kind === "passenger_safety_risk") lines.push(`Passenger-safety flag · restraints / seatbelt / vocational entitlement rules apply.`);
    else if (s.kind === "unsupported_freight_quote") lines.push(`Unsupported-quote flag · NEX will not fabricate haulage rates · use a live broker quote.`);
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
