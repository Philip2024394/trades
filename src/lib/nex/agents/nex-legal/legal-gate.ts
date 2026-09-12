// src/lib/nex/agents/nex-legal/legal-gate.ts
//
// WAVE-S-8 · Deterministic legal classifier + safety signals
// Founder BEGIN WAVE-S-8 · 2026-09-08

import type {
  LegalRequest,
  LegalRequestKind,
  LegalResponse,
  LegalSafetySignal,
} from "./types";

// ─── Emergency short-circuit ───────────────────────────────────────

const EMERGENCY_KEYWORDS = /\b(?:been arrested|being detained|just detained|police (?:have )?(?:got|arrested) me|deportation notice|removal order|about to be deported|restraining order (?:breach|violated)|domestic violence (?:right now|happening now)|child abduction (?:in progress|right now)|court (?:date|hearing) (?:today|tomorrow) and)\b/i;

function isEmergencyLegal(text: string): boolean {
  return EMERGENCY_KEYWORDS.test(text);
}

// ─── Main classifier ───────────────────────────────────────────────

export function classifyLegalRequest(text: string): LegalRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";

  if (isEmergencyLegal(t)) return "emergency_legal";

  // Family (child arrangements · divorce · custody)
  if (/\b(child (?:custody|arrangements|contact)|divorce|separation agreement|prenup|financial remedy|residence order|parental responsibility|adoption|surrogacy)\b/.test(t)) return "family_law_query";

  // Immigration (visa · asylum · leave to remain · residency · citizenship)
  if (/\b(visa|asylum|leave to remain|indefinite leave|ilr|residency|residence permit|citizenship|naturalisation|naturalization|deport|removal|green card|h.?1b|eb.?[123])\b/.test(t)) return "immigration_query";

  // Employment
  if (/\b(employment (?:contract|dispute|tribunal)|unfair dismissal|redundancy|constructive dismissal|discrimination at work|workplace harass|grievance|acas|ndx|wage theft|wage claim|unpaid overtime|osha complaint|whistleblow)\b/.test(t)) return "employment_law_query";

  // Consumer (refund · warranty · goods · services)
  if (/\b(consumer rights|refund|faulty goods|not fit for purpose|section 75|chargeback|distance selling|consumer contract|warranty claim|magnuson.moss|dsr|ccra)\b/.test(t)) return "consumer_law_query";

  // Criminal
  if (/\b(criminal charge|criminal offence|criminal offense|caution|police interview|bail application|guilty plea|not guilty|criminal defence|criminal defense|criminal record|dbs check|expungement)\b/.test(t)) return "criminal_law_query";

  // Intellectual property
  if (/\b(trademark|copyright|patent|design right|passing off|infringement|licensing agreement|ip assignment|dmca|takedown|prior art)\b/.test(t)) return "intellectual_property_query";

  // Contract interpretation
  if (/\b(contract clause|contract interpretation|contract dispute|breach of contract|force majeure|termination clause|limitation of liability|indemnity clause|governing law clause|arbitration clause)\b/.test(t)) return "contract_interpretation";

  // Legal procedure (courts · filing · deadlines)
  if (/\b(court procedure|filing deadline|limitation period|statute of limitations|service of process|small claims|county court|crown court|magistrates|federal court|state court|pleadings|discovery|disclosure|witness statement)\b/.test(t)) return "legal_procedure_query";

  // Rights query (general "do I have the right to...")
  if (/\b(do i have (?:the |a )?right to|my rights|what rights (?:do i have|does)|know your rights|human rights|civil rights|fundamental rights)\b/.test(t)) return "rights_query";

  return "unknown";
}

// ─── Safety-signal patterns ────────────────────────────────────────

const LEGAL_ADVICE_ASK_RE = /\b(what should i do|what would you do|advise me|your advice|is (?:this|it) legal|is (?:this|it) illegal|can they (?:legally|do this)|will i win|will i lose)\b/i;
const GUARANTEED_OUTCOME_RE = /\b(guaranteed to win|guaranteed win|100% win|definitely win|no way to lose|court will side with|judge will rule|jury will find)\b/i;
const FABRICATED_DAMAGES_RE = /\b(exactly £\d+(?:,\d+)? in damages|precisely \$\d+(?:,\d+)? in damages|will get £\d+|will get \$\d+|guaranteed £\d+ payout|guaranteed \$\d+ payout)\b/i;
const STATUTE_OF_LIMITATIONS_RE = /\b(statute of limitations|limitation period|time.?bar|filing deadline|deadline to (?:file|sue)|six.year rule|three.year rule|two.year rule|one.year rule)\b/i;
const PRIVILEGED_COMM_RE = /\b(attorney.client privilege|solicitor.client privilege|legal professional privilege|litigation privilege|off the record)\b/i;

function emergencyRouteRegime(text: string, jurisdiction?: string): string {
  const jur = (jurisdiction ?? "").toLowerCase();
  const t = text.toLowerCase();
  if (jur.startsWith("uk") || /\b(uk|britain|united kingdom|england|scotland|wales)\b/.test(t)) return "UK: 999 (emergency) · duty solicitor via police (24/7 free) · Law Society find-a-solicitor · Citizens Advice";
  if (jur.startsWith("us") || /\b(us|usa|united states|america)\b/.test(t)) return "US: 911 (emergency) · court-appointed public defender if held · state bar lawyer-referral service";
  if (jur.startsWith("au") || /\baustralia\b/.test(t)) return "AU: 000 (emergency) · Legal Aid (state-specific) · Law Society lawyer-referral";
  if (jur.startsWith("eu") || /\b(europe|eu|schengen)\b/.test(t)) return "EU: 112 (emergency) · national bar referral service in the relevant member state";
  if (jur.startsWith("id") || /\bindonesia\b/.test(t)) return "ID: 112 (emergency) · LBH (Lembaga Bantuan Hukum) legal aid · PERADI advocate association";
  if (jur.startsWith("jp") || /\bjapan\b/.test(t)) return "JP: 110 (police) · Japan Federation of Bar Associations shiho shoshi referral";
  return "route to jurisdiction-appropriate emergency line (UK 999 · US 911 · EU 112 · AU 000 · ID 112 · JP 110) AND find an admitted practitioner in your jurisdiction";
}

export function detectLegalSafetySignals(
  req: LegalRequest,
  kind: LegalRequestKind,
): LegalSafetySignal[] {
  const out: LegalSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();
  const jur = req.jurisdiction;

  // Emergency-legal routing takes priority
  if (kind === "emergency_legal" || isEmergencyLegal(text)) {
    out.push({
      kind: "emergency_route",
      regime_hint: emergencyRouteRegime(text, jur),
      description: "possible legal emergency detected · NEX Phase 3 does not provide legal advice · call emergency line if immediate danger AND find a jurisdiction-admitted practitioner NOW",
    });
    out.push({
      kind: "legal_advice_boundary",
      description: "NEX does not give legal advice · seek an admitted practitioner immediately",
    });
    return out;
  }

  // Every recognised legal question triggers the legal-advice boundary · plus
  // guaranteed-outcome language implicitly asks for advice even when the kind
  // classifier failed to route the request into a specific category.
  const guaranteedOutcomeHit = GUARANTEED_OUTCOME_RE.test(text);
  if (kind !== "unknown" || LEGAL_ADVICE_ASK_RE.test(text) || guaranteedOutcomeHit) {
    out.push({
      kind: "legal_advice_boundary",
      description: "legal question · NEX does not give legal advice · consult a solicitor / attorney / advocate admitted in your jurisdiction",
    });
  }

  // Bar-admission licensing signal on any non-emergency legal query
  if (kind !== "unknown") {
    out.push({
      kind: "bar_admission_licensing_required",
      description: "jurisdiction-admitted legal practitioner required (UK: solicitor/barrister with practicing certificate · US: bar-admitted attorney · AU: practicing certificate · EU: national bar admission · ID: PERADI advocate · JP: bengoshi)",
    });
  }

  if (kind === "criminal_law_query") {
    out.push({
      kind: "criminal_law_boundary",
      description: "criminal matter · risk of custodial sentence / criminal record · specialist criminal defence practitioner strongly recommended · do not attend police interview without legal representation",
    });
  }

  if (kind === "family_law_query") {
    out.push({
      kind: "family_law_boundary",
      description: "family law matter · child welfare / financial disclosure / long-term arrangements have lasting consequences · specialist family law practitioner strongly recommended",
    });
  }

  if (STATUTE_OF_LIMITATIONS_RE.test(text) || kind === "legal_procedure_query") {
    out.push({
      kind: "statute_of_limitations_awareness",
      description: "time-critical action likely · limitation periods vary by claim type and jurisdiction · missing the deadline typically extinguishes the right to sue · verify with an admitted practitioner urgently",
    });
  }

  if (PRIVILEGED_COMM_RE.test(text)) {
    out.push({
      kind: "privileged_communication_risk",
      description: "privileged-communication topic · attorney/solicitor-client privilege protects certain communications but has limits (waiver · crime-fraud exception) · discuss with an admitted practitioner before disclosing anything",
    });
  }

  if (GUARANTEED_OUTCOME_RE.test(text)) {
    out.push({
      kind: "unsupported_case_outcome_claim",
      description: "case-outcome-guarantee language detected · no reputable practitioner guarantees an outcome · outcomes depend on facts · evidence · jurisdiction · judicial discretion · counterparty conduct",
    });
  }

  if (FABRICATED_DAMAGES_RE.test(text)) {
    out.push({
      kind: "unsupported_case_outcome_claim",
      description: "specific damages / payout figure asserted without evidence base · NEX Phase 3 will not fabricate damages estimates · defer to a practitioner's case-specific assessment",
    });
  }

  if (out.length === 0) out.push({ kind: "no_legal_safety_concern" });
  return out;
}

export function respondLegal(req: LegalRequest): LegalResponse {
  const kind = classifyLegalRequest(req.request_text);
  const signals = detectLegalSafetySignals(req, kind);
  const has_serious = signals.some((s) => s.kind !== "no_legal_safety_concern");
  // Phase 3 defers detailed contract drafting / legal-research summary / opinion letters to Phase 4.
  const deferred = kind === "contract_interpretation" || kind === "intellectual_property_query" || kind === "consumer_law_query" || kind === "legal_procedure_query" || kind === "rights_query";
  // Legal is high-stakes · every kind (including unknown) requires human review.
  const requires_review = has_serious || true;   // always true for legal — every legal question needs an admitted practitioner

  const lines: string[] = [];
  lines.push(`Legal request classified as: ${kind}.`);
  if (deferred) lines.push("Phase 3 specialist does not draft contracts / opinion letters / detailed legal research · deferred to Phase 4 (LLM via gateway + qualified practitioner oversight · jurisdiction-specific verification).");
  for (const s of signals) {
    if (s.kind === "no_legal_safety_concern") continue;
    if (s.kind === "emergency_route") lines.push(`🚨 LEGAL EMERGENCY · ${s.regime_hint}`);
    else if (s.kind === "legal_advice_boundary") lines.push(`⚠️ NEX does not give legal advice · consult a solicitor / attorney / advocate admitted in your jurisdiction.`);
    else if (s.kind === "bar_admission_licensing_required") lines.push(`Bar-admission flag · only a jurisdiction-admitted practitioner may advise on your matter.`);
    else if (s.kind === "criminal_law_boundary") lines.push(`Criminal-matter flag · do not attend police interview without legal representation · specialist criminal defence recommended.`);
    else if (s.kind === "family_law_boundary") lines.push(`Family-law flag · specialist family law practitioner strongly recommended · decisions have lasting consequences.`);
    else if (s.kind === "statute_of_limitations_awareness") lines.push(`Time-critical flag · limitation periods vary · verify deadline with a practitioner urgently.`);
    else if (s.kind === "privileged_communication_risk") lines.push(`Privileged-communication flag · discuss with an admitted practitioner before disclosing anything.`);
    else if (s.kind === "unsupported_case_outcome_claim") lines.push(`Unsupported-outcome flag · NEX does not guarantee case outcomes or fabricate damages figures.`);
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
