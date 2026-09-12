// src/lib/nex/agents/nex-healthcare/healthcare-gate.ts
//
// WAVE-S-6 · Deterministic healthcare classifier + safety signals
// Founder BEGIN WAVE-S-6 · 2026-09-08
//
// STRICT DISCIPLINE (see types.ts). Emergency routing takes priority.

import type {
  HealthcareRequest,
  HealthcareRequestKind,
  HealthcareResponse,
  HealthcareSafetySignal,
} from "./types";

// ─── Emergency detector · runs FIRST · non-negotiable ──────────────

const EMERGENCY_KEYWORDS = /\b(?:chest pain (?:radiat|for|now)|crushing chest|heart attack|difficulty breathing|can'?t breathe|cannot breathe|not breathing|unconscious|unresponsive|severe bleeding|arterial bleed|major bleeding|stroke symptoms?|slurred speech|face droop|arm weakness|anaphylax(?:is|ic)|epipen|severe allerg(?:ic|y) reaction|choking|not able to swallow|overdose|took too many|swallowed pills|poisoning|call an ambulance|call 9(?:11|99)|need an ambulance)\b/i;

// Mental-health crisis · runs second · specifically before general mental-health
const MENTAL_CRISIS_KEYWORDS = /\b(?:suicid(?:e|al)|kill (?:my|him|her)self|end my life|self.harm|cutting myself|want to die|no reason to live|hurting myself)\b/i;

function classifyEmergencyLike(text: string): HealthcareRequestKind | null {
  if (EMERGENCY_KEYWORDS.test(text)) return "emergency_query";
  if (MENTAL_CRISIS_KEYWORDS.test(text)) return "mental_health_query";
  return null;
}

// ─── Main classifier ───────────────────────────────────────────────

export function classifyHealthcareRequest(text: string): HealthcareRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";

  const emergency = classifyEmergencyLike(t);
  if (emergency) return emergency;

  // Prescription request (specific · before generic medication)
  if (/\b(prescribe|prescription (?:for|please)|can you prescribe|give me a prescription|write a prescription)\b/.test(t)) return "prescription_request";

  // Medication interaction (specific · before generic medication)
  if (/\b(interaction|interact with|take .* with .* (?:medication|drug|pill|tablet)|combine .* with .* (?:medication|drug)|safe to take .* with|mixing .* (?:medication|drug))\b/.test(t)) return "medication_interaction";

  // Pediatric (specific · before general symptom)
  if (/\b(my (?:baby|infant|toddler|child|kid|newborn|son|daughter)|child (?:has|is|feels)|infant (?:has|is)|paediatric|pediatric|toddler symptoms?)\b/.test(t)) return "pediatric_query";

  // Pregnancy (specific)
  if (/\b(pregnant|pregnancy|expecting|trimester|obstetric|ob.gyn|prenatal|antenatal|postpartum|breastfeed|breastfeeding|folate for pregnancy)\b/.test(t)) return "pregnancy_query";

  // Mental health (non-crisis)
  if (/\b(anxiety|depression|panic (?:attack|attacks)|therapy|mental health|psychiatric|adhd|autism|ptsd|bipolar|ocd)\b/.test(t)) return "mental_health_query";

  // Medication (general)
  if (/\b(medication|medicine|drug|pill|tablet|dose|dosage|paracetamol|ibuprofen|aspirin|antibiotic|inhaler|insulin)\b/.test(t)) return "medication_question";

  // Symptom query
  if (/\b(symptom|symptoms|why does it hurt|i (?:have|feel|got) (?:a )?(?:pain|ache|rash|fever|nausea|dizz|swelling|lump|cough|headache|sore throat|stomach ache)|what.?s wrong with me|what could it be)\b/.test(t)) return "symptom_query";

  // Wellness / lifestyle
  if (/\b(wellness|lifestyle|healthy (?:diet|eating|habits)|exercise routine|sleep hygiene|stress management|meditation|yoga|mindfulness)\b/.test(t)) return "wellness_lifestyle";

  // Public health info
  if (/\b(public health|vaccine (?:schedule|programme|program)|nhs|cdc|who guideline|flu jab|covid|influenza vaccination|screening programme|screening program)\b/.test(t)) return "public_health_info";

  return "unknown";
}

// ─── Safety-signal patterns ────────────────────────────────────────

const SYMPTOM_LIKE_RE = /\b(pain|ache|rash|fever|nausea|dizz|swelling|lump|cough|headache|sore throat|stomach ache|shortness of breath|palpitations?|numbness|tingling|blurred vision|blood in (?:stool|urine|vomit)|discharge|cramping)\b/i;
const PRESCRIPTION_ASK_RE = /\b(prescribe|prescription|give me (?:antibiotics|amoxicillin|codeine|opioid|opiate|painkiller|sleeping pill)|need (?:antibiotics|amoxicillin))\b/i;
const UNSUPPORTED_MEDICAL_RE = /\b(cures? (?:cancer|diabetes|arthritis|autism|any disease)|guaranteed weight loss|melts? fat|detox(?:es|ify|ifying)? (?:your |the )?body|superfood that (?:cures?|prevents?|treats?)|miracle (?:cure|remedy|drug)|homeopathy cures|essential oils? cures?)\b/i;

// Emergency routing table · jurisdiction-hint from request text or context
function emergencyRouteRegime(text: string, jurisdiction?: string): string {
  const jur = (jurisdiction ?? "").toLowerCase();
  const t = text.toLowerCase();
  if (jur.startsWith("uk") || /\b(uk|britain|united kingdom|england|scotland|wales)\b/.test(t)) return "UK: 999 (emergency) · 111 (non-emergency NHS)";
  if (jur.startsWith("us") || /\b(us|usa|united states|america)\b/.test(t)) return "US: 911 (emergency)";
  if (jur.startsWith("au") || /\baustralia\b/.test(t)) return "AU: 000 (emergency)";
  if (jur.startsWith("id") || /\bindonesia\b/.test(t)) return "ID: 112 (emergency) · 119 (ambulance)";
  if (jur.startsWith("eu") || /\b(europe|eu|schengen)\b/.test(t)) return "EU: 112 (emergency)";
  if (jur.startsWith("jp") || /\bjapan\b/.test(t)) return "JP: 119 (ambulance/fire) · 110 (police)";
  return "route to jurisdiction-appropriate emergency line (UK 999 · US 911 · EU 112 · AU 000 · ID 112/119 · JP 119)";
}

function mentalCrisisRouteRegime(text: string, jurisdiction?: string): string {
  const jur = (jurisdiction ?? "").toLowerCase();
  const t = text.toLowerCase();
  if (jur.startsWith("uk") || /\b(uk|britain|united kingdom)\b/.test(t)) return "UK: 116 123 (Samaritans · free · 24/7) · 999 if immediate danger";
  if (jur.startsWith("us") || /\b(us|usa|united states|america)\b/.test(t)) return "US: 988 (Suicide & Crisis Lifeline) · 911 if immediate danger";
  if (jur.startsWith("au") || /\baustralia\b/.test(t)) return "AU: 13 11 14 (Lifeline) · 000 if immediate danger";
  if (jur.startsWith("id") || /\bindonesia\b/.test(t)) return "ID: 119 ext 8 (Kementerian Kesehatan mental-health crisis) · 112 if immediate danger";
  return "route to jurisdiction-appropriate crisis line (UK 116 123 · US 988 · AU 13 11 14 · ID 119 ext 8 · consult local resources)";
}

export function detectHealthcareSafetySignals(
  req: HealthcareRequest,
  kind: HealthcareRequestKind,
): HealthcareSafetySignal[] {
  const out: HealthcareSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();
  const jur = req.jurisdiction;

  // Emergency routing · highest priority
  if (kind === "emergency_query") {
    out.push({
      kind: "emergency_route",
      regime_hint: emergencyRouteRegime(text, jur),
      description: "possible medical emergency detected · NEX Phase 3 does not provide medical advice · call the appropriate emergency line NOW",
    });
    // Emergency still triggers diagnosis boundary (never diagnose)
    out.push({
      kind: "medical_diagnosis_boundary",
      description: "NEX does not diagnose · seek immediate qualified medical assessment via the emergency route above",
    });
    if (out.length === 0) out.push({ kind: "no_healthcare_safety_concern" });
    return out;
  }

  // Mental-health crisis routing
  if (kind === "mental_health_query" && MENTAL_CRISIS_KEYWORDS.test(text)) {
    out.push({
      kind: "mental_health_crisis_route",
      regime_hint: mentalCrisisRouteRegime(text, jur),
      description: "possible mental-health crisis detected · NEX Phase 3 is not a mental-health provider · please reach a crisis line NOW · you are not alone",
    });
    return out;
  }

  // Symptom query → medical diagnosis boundary
  if (kind === "symptom_query" || (SYMPTOM_LIKE_RE.test(text) && kind !== "wellness_lifestyle" && kind !== "public_health_info")) {
    out.push({
      kind: "medical_diagnosis_boundary",
      description: "symptom-shaped question · NEX does not diagnose · consult a qualified clinician / GP / registered nurse / urgent-care service in your jurisdiction",
    });
  }

  // Prescription request → prescription boundary
  if (kind === "prescription_request" || PRESCRIPTION_ASK_RE.test(text)) {
    out.push({
      kind: "medical_prescription_boundary",
      description: "prescription request · NEX does not prescribe · only a licensed clinician (physician / nurse practitioner / pharmacist prescriber in some jurisdictions) may issue a prescription",
    });
  }

  // Medication interaction → pharmacist referral
  if (kind === "medication_interaction") {
    out.push({
      kind: "medication_interaction_pharmacist_referral",
      description: "medication-interaction question · defer to a registered pharmacist or clinician · interaction databases require professional interpretation with patient-specific context",
    });
  }

  // Pregnancy → obstetric care
  if (kind === "pregnancy_query") {
    out.push({
      kind: "pregnancy_medical_boundary",
      description: "pregnancy-related question · obstetric / midwife care required · pregnancy alters medication safety · dosage · nutritional needs · risk profiles",
    });
  }

  // Pediatric → paediatrician
  if (kind === "pediatric_query") {
    out.push({
      kind: "pediatric_medical_boundary",
      description: "pediatric medical topic · paediatrician / child health nurse required · child physiology · dosages · developmental factors differ substantially from adults",
    });
  }

  // Unsupported medical claim heuristic
  if (UNSUPPORTED_MEDICAL_RE.test(text)) {
    out.push({
      kind: "unsupported_medical_claim",
      description: "medical claim implies a health outcome NEX cannot verify (cures / detox / miracle) · rephrase without unsupported certainty · seek evidence-based information from a qualified clinician",
    });
  }

  if (out.length === 0) out.push({ kind: "no_healthcare_safety_concern" });
  return out;
}

export function respondHealthcare(req: HealthcareRequest): HealthcareResponse {
  const kind = classifyHealthcareRequest(req.request_text);
  const signals = detectHealthcareSafetySignals(req, kind);
  const has_serious = signals.some((s) => s.kind !== "no_healthcare_safety_concern");
  // Phase 3 defers wellness copy · public-health-info retrieval · medication-lookup
  // detail work to Phase 4 (LLM via gateway + real health-data sources).
  const deferred = kind === "wellness_lifestyle" || kind === "public_health_info" || kind === "medication_question";
  // Almost every kind requires human review because healthcare is high-stakes.
  const requires_review = has_serious
    || kind === "unknown"
    || kind === "symptom_query"
    || kind === "prescription_request"
    || kind === "medication_interaction"
    || kind === "emergency_query"
    || kind === "mental_health_query"
    || kind === "pregnancy_query"
    || kind === "pediatric_query"
    || kind === "medication_question";

  const lines: string[] = [];
  lines.push(`Healthcare request classified as: ${kind}.`);
  if (deferred) lines.push("Phase 3 specialist does not generate specific medication information / wellness content / public-health guidance · deferred to Phase 4 (LLM via gateway + curated public-health data sources · qualified clinician oversight).");
  for (const s of signals) {
    if (s.kind === "no_healthcare_safety_concern") continue;
    if (s.kind === "emergency_route") lines.push(`🚨 EMERGENCY · call ${s.regime_hint} · NEX cannot substitute for emergency medical response.`);
    else if (s.kind === "mental_health_crisis_route") lines.push(`💙 MENTAL-HEALTH CRISIS · please reach out NOW: ${s.regime_hint} · you are not alone · trained help is available.`);
    else if (s.kind === "medical_diagnosis_boundary") lines.push(`⚠️ NEX does not diagnose · consult a qualified clinician / GP / registered nurse in your jurisdiction.`);
    else if (s.kind === "medical_prescription_boundary") lines.push(`⚠️ NEX does not prescribe · only a licensed clinician may issue a prescription.`);
    else if (s.kind === "pregnancy_medical_boundary") lines.push(`Pregnancy flag · obstetric / midwife care required for pregnancy-related medical guidance.`);
    else if (s.kind === "pediatric_medical_boundary") lines.push(`Pediatric flag · paediatrician / child health nurse required for child-specific medical guidance.`);
    else if (s.kind === "medication_interaction_pharmacist_referral") lines.push(`Medication-interaction flag · defer to a registered pharmacist or clinician.`);
    else if (s.kind === "unsupported_medical_claim") lines.push(`Medical-claim flag · claims implying cures / detox / miracles are not supported by NEX · seek evidence-based information from a qualified clinician.`);
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
