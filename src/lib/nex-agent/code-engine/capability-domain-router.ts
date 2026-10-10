// src/lib/nex-agent/code-engine/capability-domain-router.ts
//
// NEX1 · Wave 14 · Level-2 Specialist Domain Routing · deterministic · zero LLM.
// Founder-authored 2026-09-20: "The stronger architecture for NEX is Level 1
// core intelligence · Level 2 specialist intelligence activated according to
// subject · Level 3 research/action agents. NEX decides which intelligence
// capability is needed → activates it → retrieves → evaluates → reasons →
// responds."
//
// This module detects when a chat message concerns an external domain
// (healthcare, legal, travel, business, food, construction, transport) and
// routes to the corresponding NEX-native specialist gate in
// `src/lib/nex/agents/nex-{domain}/`. Each specialist runs its own
// deterministic classifier + safety-signal detector. The router composes a
// domain-aware response envelope for the chat-turn to emit.
//
// Priority ordering: healthcare & legal come first because they carry
// life/liberty safety implications. Other domains follow. Zero cross-domain
// routing (one domain at a time). No LLM · no embeddings · no third-party AI.

export type NexDomain =
  | "healthcare"
  | "legal"
  | "travel"
  | "business"
  | "food"
  | "construction"
  | "transport"
  | "finance"
  | "vision";

export interface DomainSafetySignal {
  readonly kind: string;
  readonly description: string;
  readonly regime_hint?: string;
}

export interface DomainRoutingResult {
  readonly domain: NexDomain;
  readonly kind: string;
  readonly safety_signals: readonly DomainSafetySignal[];
  readonly rationale: string;
  readonly matched_keywords: readonly string[];
}

// Priority-ordered domain keyword patterns. Healthcare and legal come FIRST
// because a query that touches both healthcare AND another domain (e.g.
// "food allergy medical advice") should route to healthcare's safety-aware
// pathway. Keywords deliberately require whole-word boundaries and avoid
// generic terms that would over-trigger (e.g. no bare "help" or "advice").
const DOMAIN_KEYWORDS: readonly { domain: NexDomain; re: RegExp }[] = [
  {
    domain: "healthcare",
    re: /\b(?:medical|medication|prescription|prescribe|prescribed|antibiotic|antibiotics|doctor|nurse|hospital|clinic|GP|A&E|ER|emergency room|symptom|symptoms|pain|ache|fever|nausea|vomit|dizzy|dizziness|allergy|allergic|asthma|diabetes|diabetic|blood pressure|hypertension|therapy|therapist|mental health|anxiety|depression|panic attack|pregnant|pregnancy|trimester|prenatal|antenatal|obstetric|paediatric|pediatric|infant|toddler|baby (?:has|is|feels)|headache|migraine|chest pain|breathing|shortness of breath|heart attack|stroke|suicid(?:e|al)|overdose|poison(?:ing|ed)|ambulance|epipen|anaphylax|nhs|999|911|988|sore throat|throat infection)\b/i,
  },
  {
    domain: "legal",
    re: /\b(?:legal advice|lawyer|solicitor|barrister|attorney|court|contract|clause|terms and conditions|T&Cs|inheritance|will|probate|divorce|custody|tenancy|tenant|landlord|eviction|small claims|statute|jurisdiction|liability|sue|sued|sued for|prosecution|prosecuted|criminal charge|magistrate|tribunal|copyright|trademark|patent|GDPR|data protection|company house|LLC|LLP)\b/i,
  },
  {
    domain: "travel",
    re: /\b(?:travel|trip|flight|flights|hotel|hostel|accommodation|itinerary|itineraries|visa|passport|book(?:ing)? (?:a|my) (?:flight|hotel|trip)|vacation|holiday|tour|destination|jet lag|customs|arrivals|departures|check-?in|luggage|baggage)\b/i,
  },
  {
    domain: "business",
    re: /\b(?:invoice|invoicing|VAT|value added tax|sales tax|corporation tax|revenue|profit|profit margin|payroll|paye|employ(?:ee|ing)|hire|hiring|recruit|onboarding|startup|LTD|Ltd|Ltd\.|LLC|LLP|balance sheet|P&L|profit and loss|business plan|market fit|cashflow|cash flow|bookkeeping|accountant|accounting)\b/i,
  },
  {
    domain: "food",
    re: /\b(?:recipe|recipes|cook(?:ing)?|ingredient|ingredients|meal|meals|dinner|breakfast|lunch|allergen|allergens|vegan|vegetarian|halal|kosher|cuisine|kitchen (?:tool|equipment|garnish)|garnish|substitute (?:for )?(?:butter|sugar|flour|egg)|nutrition facts|calorie)\b/i,
  },
  {
    domain: "construction",
    re: /\b(?:construction|renovation|renovate|extension|planning permission|building regs|building regulations|foundation|foundations|roof|roofing|electrical work|plumbing job|carpentry|scaffold|scaffolding|damp proof|damp course|structural (?:engineer|survey)|underpin(?:ning)?|joinery)\b/i,
  },
  {
    domain: "transport",
    re: /\b(?:freight|logistics|shipping quote|shipping cost|shipping company|delivery route|fleet management|HGV|LGV|lorry|truck driver|van driver|route planning|dispatch schedule|load capacity|hazmat transport)\b/i,
  },
  {
    // Finance covers REGULATORY-heavy / specialty terms only. Operational
    // business vocabulary (LTD, invoice, VAT rate, cashflow, P&L, hiring)
    // remains with the business specialist. Finance takes over when the
    // query touches regulated advice · tax optimisation · audit · compliance
    // · investment · specific tax authorities · retirement/pension products.
    domain: "finance",
    re: /\b(?:tax optimi[sz]ation|tax loophole|offshore (?:tax|structure)|tax haven|(?:financial|investment) adviser|investment strategy|portfolio allocation|should i (?:buy|sell|invest)|which stocks|is .* a good investment|when to (?:buy|sell) (?:shares?|stocks?)|401k|superannuation|pension contribution|self.?assessment|hmrc|irs|audit(?:ing)?|compliance|regulatory filing|GAAP|IFRS|SOX)\b/i,
  },
  {
    // K8 · 2026-09-21 · Vision-topic routing · TEXT-ONLY queries about
    // the NEX vision system. Does NOT process images · R1 remains intact ·
    // capability_availability (K13) still reports actual image-processing
    // as BLOCKED_R1. This route handles META questions about vision
    // (image manifest · confidence bands · vision policy · what NEX
    // knows about specific manifested images).
    // Deliberately narrow to avoid catching "can you see this image"
    // (which K13 handles as BLOCKED_R1).
    domain: "vision",
    re: /\b(?:image manifest|vision system|vision policy|manifested image|image dna|image family tree|geometry preservation|image classification confidence|what images (?:do|does) (?:you|nex) (?:know|have))\b/i,
  },
];

/** Deterministic first-match detector. Priority order enforced. Returns null
 *  when no domain keyword hits — caller should fall through to the existing
 *  code-topic-discovery path. */
export function detectDomain(message: string): NexDomain | null {
  if (!message || message.length < 4) return null;
  for (const entry of DOMAIN_KEYWORDS) {
    if (entry.re.test(message)) return entry.domain;
  }
  return null;
}

/** K21 · 2026-09-21 · Cross-domain composition detection.
 *  Returns ALL domains matched (not just first) so cross-domain queries
 *  (e.g. "travelling to Bali - what's the weather + flight options + hotel
 *  count") can be composed. Preserves priority order. When >1 domain hits,
 *  caller should fire ALL of them in parallel and compose the outputs. */
export function detectAllDomains(message: string): readonly NexDomain[] {
  if (!message || message.length < 4) return [];
  const out: NexDomain[] = [];
  for (const entry of DOMAIN_KEYWORDS) {
    if (entry.re.test(message)) out.push(entry.domain);
  }
  return out;
}

/** K21 · Cross-domain composition · fires N domain specialists in parallel
 *  and returns their outputs preserved per-domain (no anonymous collapse). */
export interface CrossDomainRoutingResult {
  readonly domains: readonly DomainRoutingResult[];
  readonly composed_rationale: string;
}
export async function routeToAllDomains(domains: readonly NexDomain[], message: string): Promise<CrossDomainRoutingResult> {
  const results = await Promise.all(domains.map((d) => routeToDomain(d, message)));
  // Compose: name each domain's request kind + safety signals · preserve
  // per-domain provenance · flag if safety signals conflict across domains.
  const parts: string[] = [];
  parts.push(`This request touches ${domains.length} NEX-native domain(s): ${domains.join(" + ")}.`);
  for (const r of results) {
    const safetyLead = r.safety_signals.find((s) => /emergency|crisis|life[- ]safety/i.test(s.kind))
      ?? r.safety_signals.find((s) => /boundary|referral/i.test(s.kind));
    if (safetyLead) {
      parts.push(`⚠️ [${r.domain}] ${safetyLead.description}${safetyLead.regime_hint ? ` · ${safetyLead.regime_hint}` : ""}`);
    } else {
      parts.push(`[${r.domain}] kind=${r.kind}`);
    }
  }
  // Cross-domain warning: highlight when 2+ domains carry safety signals
  const safetyDomainCount = results.filter((r) => r.safety_signals.some((s) => !/no_.+?_safety_concern/i.test(s.kind))).length;
  if (safetyDomainCount >= 2) {
    parts.push(`⚠️ Multiple domain safety signals present · address each domain's boundaries separately · NEX will not silently prioritise one domain's guidance over another.`);
  }
  return { domains: results, composed_rationale: parts.join(" · ") };
}

function collectMatches(re: RegExp, message: string, limit = 4): string[] {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const gre = new RegExp(re.source, flags);
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = gre.exec(message)) !== null) {
    const hit = m[0];
    if (hit && !out.includes(hit)) out.push(hit);
    if (out.length >= limit) break;
    if (m.index === gre.lastIndex) gre.lastIndex++;
  }
  return out;
}

function composeRationale(domain: NexDomain, kind: string, signals: readonly DomainSafetySignal[]): string {
  // Safety signals lead the response when present. Emergency and crisis
  // routes always come first; boundaries come next; other signals follow.
  const emergency = signals.find((s) => /emergency|crisis|life[- ]safety/i.test(s.kind));
  const boundary = signals.find((s) => /boundary|referral/i.test(s.kind));
  const other = signals.filter((s) => s !== emergency && s !== boundary);
  const parts: string[] = [];
  parts.push(`This looks like a **${domain}** question · request kind = ${kind}.`);
  if (emergency) {
    parts.push(`⚠️ ${emergency.description}${emergency.regime_hint ? ` · ${emergency.regime_hint}` : ""}`);
  }
  if (boundary) {
    parts.push(`Boundary: ${boundary.description}`);
  }
  for (const s of other.slice(0, 2)) {
    if (!s.description) continue;
    parts.push(`Note: ${s.description}${s.regime_hint ? ` · ${s.regime_hint}` : ""}`);
  }
  if (signals.length === 0) {
    parts.push(`NEX ${domain} specialist did not raise a safety signal for this kind. Ask a more specific question and NEX can route to the specialist reasoning path.`);
  }
  return parts.join(" ");
}

/** Route a detected-domain message to its specialist gate. Awaited so lazy
 *  imports work; each specialist module is loaded on demand. Returns a
 *  DomainRoutingResult with kind, safety signals, and a composed rationale. */
export async function routeToDomain(domain: NexDomain, message: string): Promise<DomainRoutingResult> {
  const matched_keywords = collectMatches(DOMAIN_KEYWORDS.find((d) => d.domain === domain)!.re, message);
  switch (domain) {
    case "healthcare": {
      const gate = await import("@/lib/nex/agents/nex-healthcare/healthcare-gate");
      const kind = gate.classifyHealthcareRequest(message);
      const signals = gate.detectHealthcareSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "legal": {
      const gate = await import("@/lib/nex/agents/nex-legal/legal-gate");
      const kind = gate.classifyLegalRequest(message);
      const signals = gate.detectLegalSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "travel": {
      const gate = await import("@/lib/nex/agents/nex-travel/travel-gate");
      const kind = gate.classifyTravelRequest(message);
      const signals = gate.detectTravelSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "business": {
      const gate = await import("@/lib/nex/agents/nex-business/business-gate");
      const kind = gate.classifyBusinessRequest(message);
      const signals = gate.detectBusinessSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "food": {
      const gate = await import("@/lib/nex/agents/nex-food/food-gate");
      const kind = gate.classifyFoodRequest(message);
      const signals = gate.detectFoodSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "construction": {
      const gate = await import("@/lib/nex/agents/nex-construction/construction-gate");
      const kind = gate.classifyConstructionRequest(message);
      const signals = gate.detectConstructionSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "transport": {
      const gate = await import("@/lib/nex/agents/nex-transport/transport-gate");
      const kind = gate.classifyTransportRequest(message);
      const signals = gate.detectTransportSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "finance": {
      const gate = await import("@/lib/nex/agents/nex-finance/finance-gate");
      const kind = gate.classifyFinanceRequest(message);
      const signals = gate.detectFinanceSafetySignals({ request_id: "chat-" + Date.now(), request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: s.regime_hint }));
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
    case "vision": {
      // K8 · text-only vision-topic routing. Never processes images ·
      // never activates R1-blocked askVision · reports honest system
      // metadata via the existing vision-gate classifier. If the user
      // actually attaches / references an image for processing, K13
      // capability_availability path takes over with BLOCKED_R1 message.
      const gate = await import("@/lib/nex/agents/nex-vision/vision-gate");
      const kind = gate.classifyRequestKind(message);
      const signals = gate.detectSafetySignals({ request_text: message } as any, kind);
      const mapped: DomainSafetySignal[] = signals.map((s: any) => ({ kind: s.kind, description: s.description, regime_hint: (s as any).regime_hint }));
      // Add explicit R1 boundary reminder to every vision route response.
      mapped.push({ kind: "vision_image_processing_boundary", description: "text-only vision-topic answered · actual image processing remains R1-blocked pending native replacement · use capability query 'can you see this image' for full status" });
      return { domain, kind, safety_signals: mapped, rationale: composeRationale(domain, kind, mapped), matched_keywords };
    }
  }
}
