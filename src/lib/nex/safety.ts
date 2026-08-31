// NEX Tourist Guardian · Safety Mode.
//
// A high-priority intent gate that runs BEFORE the conversation
// classifier. If the user's message signals a medical emergency,
// injury, illness, being lost, or a serious incident (theft, assault,
// natural disaster), NEX must NOT continue restaurant chatter — it
// must switch into safety mode and provide emergency guidance.
//
// This is deterministic. A machine that can only recommend food
// while a user says "I'm bleeding" is not a tourist guardian; it's a
// menu.
//
// Priority order in the full request pipeline (Philip 2026-08-30):
//   1. Safety Mode (this file)       ← BEATS EVERYTHING ELSE
//   2. classifyConversationIntent()  ← greetings/tourism/food/…
//   3. pickRole()                    ← model selection
//   4. decideRag()                   ← knowledge attachment
//
// If Safety Mode fires, the route should return the safety response
// synchronously (do NOT call the LLM). The response is authored,
// deterministic, and includes the emergency numbers + a nudge to the
// hospital knowledge records already in the corpus.

export type SafetySignal =
  | "medical_emergency"    // "chest pain", "can't breathe", "seizure"
  | "medical_illness"      // "I'm sick", "fever", "food poisoning"
  | "medical_injury"       // "cut myself", "twisted my ankle", "burned my hand"
  | "lost"                 // "I'm lost", "don't know where I am"
  | "theft_or_assault"     // "wallet stolen", "someone attacked me"
  | "natural_disaster"     // "earthquake", "flooding"
  | "safe_but_worried"     // "is it safe to…" (informational only)
  | "none";

export type SafetyClassification = {
  signal: SafetySignal;
  /** True if NEX MUST enter safety mode (all signals except "none"
   *  and "safe_but_worried"). */
  requiresSafetyResponse: boolean;
  /** Machine-readable reason · shows up in telemetry. */
  reason: string;
};

// Deterministic packs. Order matters: emergency > illness > injury >
// lost > theft > disaster > safety-question > none.
// Every pattern uses word boundaries where feasible.

const MEDICAL_EMERGENCY = [
  /\b(can't|cannot|can not)\s+breathe\b/i,
  /\b(chest pain|heart attack|stroke|seizure|convulsion)\b/i,
  /\b(unconscious|not responding|not breathing)\b/i,
  /\bbleeding\s+(a lot|heavily|badly)\b/i,
  /\b(anaphylaxis|allergic reaction|anafilaksis)\b/i,
  /\b(overdose|overdosed|keracunan|racun)\b/i,
  /\bemergency\b.*\b(help|now)\b/i,
  /\bcall (an )?ambulance\b/i,
  /\bpanggil ambulans\b/i,
  /\b(life[- ]threatening|dying)\b/i,
];

const MEDICAL_ILLNESS = [
  /\bi'?m sick\b/i,
  /\bsaya sakit\b/i,
  /\b(food poisoning|keracunan makanan)\b/i,
  /\bhigh fever\b/i,
  /\bdemam tinggi\b/i,
  /\b(vomiting|throwing up|muntah)\b/i,
  /\b(diarr?h?oea|diare|bali belly)\b/i,
  /\b(dengue|dengu|demam berdarah|malaria|typhoid|tifus)\b/i,
  /\bi feel (really |very )?(unwell|ill|bad)\b/i,
];

const MEDICAL_INJURY = [
  /\bi (cut|burned?|burnt|hurt|broke|sprained|twisted)\b/i,
  /\bsaya (terluka|terpotong|patah|terkilir|kepleset)\b/i,
  /\b(bitten|stung|snake bite|scorpion|jellyfish sting)\b/i,
  /\b(digigit|disengat|ular|kalajengking)\b/i,
  /\bmotorbike (accident|crash)\b/i,
  /\bkecelakaan\b/i,
];

const LOST = [
  /\bi'?m lost\b/i,
  /\bsaya (tersesat|kesasar)\b/i,
  /\bi don'?t know where i am\b/i,
  /\bcan'?t find (my|the) (way|hotel|home)\b/i,
];

const THEFT_OR_ASSAULT = [
  /\b(stolen|robbed|pickpocket(ed)?)\b/i,
  /\b(kecopetan|kemalingan|dicuri|dirampok)\b/i,
  /\bsomeone (attacked|hit|threatened) me\b/i,
  /\b(diserang|dipukul|diancam)\b/i,
  /\b(passport|wallet|phone) (lost|stolen|missing|hilang|dicuri)\b/i,
];

const NATURAL_DISASTER = [
  /\b(earthquake|gempa|tsunami)\b/i,
  /\b(volcanic eruption|erupsi|letusan)\b/i,
  /\b(flooding|banjir|landslide|tanah longsor)\b/i,
];

const SAFE_QUESTION = [
  /\bis it safe\b/i,
  /\bapakah (aman|berbahaya)\b/i,
  /\bhow safe is\b/i,
];

export function classifySafetySignal(message: string): SafetyClassification {
  const raw = message.trim();
  if (raw.length === 0) return { signal: "none", requiresSafetyResponse: false, reason: "empty_message" };

  for (const rx of MEDICAL_EMERGENCY) if (rx.test(raw)) return { signal: "medical_emergency", requiresSafetyResponse: true, reason: `emergency:${firstMatch(raw, MEDICAL_EMERGENCY)}` };
  for (const rx of MEDICAL_ILLNESS) if (rx.test(raw)) return { signal: "medical_illness", requiresSafetyResponse: true, reason: `illness:${firstMatch(raw, MEDICAL_ILLNESS)}` };
  for (const rx of MEDICAL_INJURY) if (rx.test(raw)) return { signal: "medical_injury", requiresSafetyResponse: true, reason: `injury:${firstMatch(raw, MEDICAL_INJURY)}` };
  for (const rx of LOST) if (rx.test(raw)) return { signal: "lost", requiresSafetyResponse: true, reason: `lost:${firstMatch(raw, LOST)}` };
  for (const rx of THEFT_OR_ASSAULT) if (rx.test(raw)) return { signal: "theft_or_assault", requiresSafetyResponse: true, reason: `theft:${firstMatch(raw, THEFT_OR_ASSAULT)}` };
  for (const rx of NATURAL_DISASTER) if (rx.test(raw)) return { signal: "natural_disaster", requiresSafetyResponse: true, reason: `disaster:${firstMatch(raw, NATURAL_DISASTER)}` };
  for (const rx of SAFE_QUESTION) if (rx.test(raw)) return { signal: "safe_but_worried", requiresSafetyResponse: false, reason: `safety_question:${firstMatch(raw, SAFE_QUESTION)}` };

  return { signal: "none", requiresSafetyResponse: false, reason: "no_safety_signal" };
}

/** Authored safety response · never uses the LLM. Includes 112 +
 *  hospital pointer + calm actionable next step. */
export function composeSafetyResponse(signal: SafetyClassification): {
  reply: string;
  suggestions: Array<{ label: string; href: string }>;
} {
  const embassy = "Save your embassy's 24-hour line before travel.";
  const nex112 = "**Indonesia unified emergency: 112** (works from any mobile). Police 110 · Fire 113 · Ambulance 118/119.";

  switch (signal.signal) {
    case "medical_emergency":
      return {
        reply:
          `This sounds like an emergency. **Call 112 now**, or ambulance 118/119. If you're in Bali, BIMC Hospital Kuta or Nusa Dua has 24/7 emergency (English-speaking staff). In Jakarta, International SOS Clinic (Mega Kuningan) or Siloam TB Simatupang. In Yogyakarta, RS Panti Rapih or Siloam. Stay with the person. ${embassy}`,
        suggestions: [
          { label: "Nearby hospitals", href: "/nex-app/centre?q=hospital" },
        ],
      };
    case "medical_illness":
      return {
        reply:
          `Sorry you're not feeling well. For minor illness (upset stomach, mild fever) — rehydrate with oralit (oral rehydration salts, available at every apotek) and rest. If symptoms are severe (high fever above 39°C, unable to keep fluids down, blood in stools) or last more than 24 hours, see a doctor. In Bali: BIMC Kuta / Nusa Dua or Siloam Denpasar. In Jakarta: International SOS Clinic or Siloam TB Simatupang. In Yogyakarta: RS Panti Rapih or Siloam. ${nex112}`,
        suggestions: [
          { label: "Nearby hospitals", href: "/nex-app/centre?q=hospital" },
        ],
      };
    case "medical_injury":
      return {
        reply:
          `For an injury: apply pressure to bleeding wounds, rinse cuts with clean bottled water (not tap), and get to a clinic. Motorbike accidents in Bali should go to BIMC Kuta or Siloam Denpasar. Snake bites and jellyfish stings — go to hospital immediately, do NOT try to suck out venom. For anything serious call **112**. ${embassy}`,
        suggestions: [
          { label: "Nearby hospitals", href: "/nex-app/centre?q=hospital" },
        ],
      };
    case "lost":
      return {
        reply:
          `Stay where you are if it's safe. Open Google Maps and share your location with someone you trust (long-press → "Share location"). If you have local data, book a Grab or Gojek to a well-known landmark (hotel, police station, or shopping mall). If you're in Bali, the Tourist Police Assistance line is +62 361 224 111 (English-speaking). Otherwise ${nex112}`,
        suggestions: [],
      };
    case "theft_or_assault":
      return {
        reply:
          `File a police report as soon as possible — you'll need it for travel insurance. Bali has a Tourist Police Assistance line: **+62 361 224111** (English-speaking). Elsewhere use **110** (police) or **112** (unified). Contact your embassy for a lost passport. Do NOT chase the thief. ${embassy}`,
        suggestions: [],
      };
    case "natural_disaster":
      return {
        reply:
          `Follow local instructions immediately. For earthquake: drop, cover, hold. For tsunami warning: get to high ground (30 metres or more) and stay away from beaches and river mouths. For volcanic eruption: cover your mouth and eyes and follow evacuation signs. ${nex112} Monitor BMKG (Indonesia's meteorological agency) for warnings.`,
        suggestions: [],
      };
    case "safe_but_worried":
      // Informational only · route continues to normal conversation.
      return { reply: "", suggestions: [] };
    case "none":
    default:
      return { reply: "", suggestions: [] };
  }
}

function firstMatch(message: string, packs: RegExp[]): string {
  for (const rx of packs) { const m = message.match(rx); if (m) return (m[0] || "").toLowerCase().slice(0, 30); }
  return "unknown";
}
