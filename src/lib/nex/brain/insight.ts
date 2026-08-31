// src/lib/nex/brain/insight.ts
//
// Stage 3.8 · NEX Brain · Insight subsystem (Philip 2026-08-31).
//
// Insight is NOT a second Brain. It's a cognitive function that lives
// INSIDE the canonical Brain, alongside Routing (classifier) and
// Memory (session store). Its job:
//
//   Observe → Understand → Detect gap / connection / opportunity →
//   Decide: is this useful NOW? → If yes, shape the response. If no,
//   stay silent.
//
// The output is a small deterministic decision record — never a
// generated question, never an LLM call. This keeps NEX fast,
// predictable, and controllable.
//
// Insight signals (per Philip 2026-08-31):
//   🔎 missing_required_slot  — we can't help without this info
//   ❓ useful_preference       — knowing this materially improves the result
//   🧩 contradiction           — user changed their mind
//   🚀 opportunity             — narrow list · offer next action
//   🧠 learning_gap            — user wants something we structurally can't answer
//   💤 none                    — stay silent, present results as-is
//
// v1 covers accommodation only (matches Stage 3.7 scope). Same
// pattern extends to food / transport / marketplace / services when
// their slot memory lands.

import type { AccommodationSlots, ExtractResult } from "./accommodation-slots";
import { describeSlots } from "./accommodation-slots";

export type InsightPriority = "required" | "useful" | "optional";

export type InsightReason =
  | "missing_required_slot"
  | "useful_preference"
  | "discovery_opportunity"
  | "clarification"
  | "contradiction"
  | "opportunity"
  | "learning_gap"
  | "none";

/**
 * Presentation state · Philip 2026-08-31 doctrine. Eureka is NOT a
 * separate Brain or subsystem — it's the presentation form when
 * Insight has made a genuine grounded observation worth surfacing
 * with an "I noticed…" opener rather than a plain follow-up question.
 * Only signals that carry a real connection between user context +
 * NEX knowledge + current goal are eureka-eligible. Never fabricated.
 */
export type InsightPresentation = "regular" | "eureka";

export type InsightDecision = {
  /**
   * True when the composer should surface Insight's output in the
   * reply. False = Insight is curious internally but has nothing
   * useful to say now, so the composer presents results plainly.
   */
  shouldSpeak: boolean;
  reason: InsightReason;
  priority: InsightPriority;
  presentation: InsightPresentation;
  /** Question or short prompt for the user (when shouldSpeak). */
  question?: string;
  /** For contradiction · a short "Switching to X" acknowledgement. */
  contradictionSummary?: string;
  /** For learning_gap · what the user asked that we can't answer, and
   *  the domain scope to feed the workforce. */
  learningGap?: {
    unmet: string;
    scope: string;
    query: string;
  };
};

export type AccommodationInsightInput = {
  message: string;
  extraction: ExtractResult;
  priorSlots: Readonly<AccommodationSlots> | undefined;
  mergedSlots: Readonly<AccommodationSlots>;
  /** How many real properties (place:accommodation:*) survived the
   *  merged-slot post-filter. */
  realPropertiesMatched: number;
  /** Total real properties before the merged-slot post-filter — used
   *  to detect over-narrowing ("your area filter dropped us from 15 to 0"). */
  realPropertiesAvailable: number;
  /** True when the user's turn is a booking intent (action=book). */
  isBookIntent: boolean;
  /** True when the user asked about price (how much / berapa / etc.). */
  isPriceQuestion: boolean;
  /** True when the user's turn asks about amenities (pool/wifi/etc). */
  isAmenityQuestion: boolean;
  /** The amenity names the user asked about (for gap recording). */
  amenitiesAsked: string[];
  /** Reply language · Stage 3.31 · defaults to English. When "id",
   *  every question/summary this function returns is Bahasa Indonesia.
   *  Numbers / place names / slot values remain verbatim. */
  lang?: "en" | "id";
};

const KNOWN_ACCOMMODATION_LOCATIONS = new Set([
  "yogyakarta", "jakarta", "bandung", "surabaya", "medan", "makassar",
  "semarang", "malang", "solo", "bali", "ubud", "canggu", "kuta",
  "seminyak", "sanur", "nusa-dua", "uluwatu", "jimbaran", "lombok",
  "labuan-bajo",
]);

/**
 * Deterministic Insight decision for an accommodation turn. Called by
 * the accommodation composer AFTER slot extraction + merging +
 * retrieval + post-filtering. Ordered by importance — the first
 * matching signal wins so we speak about ONE thing at a time.
 */
export function decideAccommodationInsight(input: AccommodationInsightInput): InsightDecision {
  const { message, extraction, priorSlots, mergedSlots,
          realPropertiesMatched, realPropertiesAvailable,
          isBookIntent, isPriceQuestion, isAmenityQuestion,
          amenitiesAsked } = input;
  const lang: "en" | "id" = input.lang ?? "en";

  // 1. Contradiction (change of mind on type/location/area).
  //    Fires ONLY when the user signalled a correction AND actually
  //    changed a load-bearing slot. Otherwise "actually" is just filler.
  const typeChanged = extraction.slots.type !== undefined && extraction.slots.type !== priorSlots?.type;
  const areaChanged = extraction.slots.area !== undefined && extraction.slots.area !== priorSlots?.area;
  const locationChanged = extraction.slots.location !== undefined && extraction.slots.location !== priorSlots?.location;
  if (extraction.correction && (typeChanged || locationChanged || areaChanged)) {
    return {
      shouldSpeak: true,
      reason: "contradiction",
      priority: "useful",
      presentation: "regular",
      contradictionSummary: lang === "id"
        ? `Beralih ke ${describeSlots(mergedSlots, "id")}`
        : `Switching to ${describeSlots(mergedSlots)}`,
    };
  }

  // 2. Book intent · opportunity to be honest about capability.
  if (isBookIntent) {
    return {
      shouldSpeak: true,
      reason: "opportunity",
      priority: "required",
      presentation: "regular",
      question: lang === "id"
        ? "Saya belum bisa memesankan akomodasi untuk kamu — World punya listingan penemuan tapi belum ada koneksi booking langsung. Kamu perlu hubungi properti langsung atau lewat platform booking."
        : "I can't book accommodation for you yet — the World has discovery listings but no live booking connection. You'd need to contact the property directly or use a booking platform.",
    };
  }

  // 3. Price question · learning gap (OSM has no price data).
  if (isPriceQuestion) {
    return {
      shouldSpeak: true,
      reason: "learning_gap",
      priority: "useful",
      presentation: "regular",
      question: lang === "id"
        ? "Listingan OpenStreetMap tidak menyimpan data harga, jadi saya tidak bisa memberikan tarif dengan jujur."
        : "OpenStreetMap listings don't carry price data, so I can't quote a rate honestly.",
      learningGap: {
        unmet: "price",
        scope: "accommodation.pricing",
        query: message,
      },
    };
  }

  // 4. Amenity question · learning gap (OSM has no facility data).
  if (isAmenityQuestion) {
    if (lang === "id") {
      const list = amenitiesAsked.length > 0 ? amenitiesAsked.join(", ") : "fasilitas";
      return {
        shouldSpeak: true,
        reason: "learning_gap",
        priority: "useful",
        presentation: "regular",
        question: `Listingan OpenStreetMap tidak menyimpan data fasilitas (kolam, wifi, sarapan, AC), jadi saya belum bisa memfilter untuk ${list} dari yang saya punya.`,
        learningGap: {
          unmet: amenitiesAsked.join(",") || "facilities",
          scope: "accommodation.amenities",
          query: message,
        },
      };
    }
    const list = amenitiesAsked.length > 0 ? amenitiesAsked.join(", ") : "facilities";
    return {
      shouldSpeak: true,
      reason: "learning_gap",
      priority: "useful",
      presentation: "regular",
      question:
        `OpenStreetMap listings don't carry facility data (pool, wifi, breakfast, aircon), so I can't confidently filter for ${list} from what I have.`,
      learningGap: {
        unmet: amenitiesAsked.join(",") || "facilities",
        scope: "accommodation.amenities",
        query: message,
      },
    };
  }

  // 5. Missing required · we cannot help without a location or area.
  if (!mergedSlots.location && !mergedSlots.area) {
    return {
      shouldSpeak: true,
      reason: "missing_required_slot",
      priority: "required",
      presentation: "regular",
      question: lang === "id"
        ? "Kota atau area mana yang sedang kamu lihat — Yogyakarta, Bali, Jakarta, atau tempat lain?"
        : "Which city or area are you looking at — Yogyakarta, Bali, Jakarta, somewhere else?",
    };
  }

  // 6. Missing required · type.
  if (!mergedSlots.type) {
    return {
      shouldSpeak: true,
      reason: "missing_required_slot",
      priority: "required",
      presentation: "regular",
      question: lang === "id"
        ? "Kamu mau hotel, guesthouse, homestay, hostel, atau tipe lain?"
        : "Do you want a hotel, guesthouse, homestay, hostel, or something else?",
    };
  }

  // 7. Useful preference · budget.
  if (!mergedSlots.budget) {
    return {
      shouldSpeak: true,
      reason: "useful_preference",
      priority: "useful",
      presentation: "regular",
      question: lang === "id"
        ? "Kamu mau yang murah, menengah, atau lebih mewah?"
        : "Do you want budget, mid-range, or something more upmarket?",
    };
  }

  // 8. Useful preference · area.
  //    Only ask when we know the location is one where the corpus
  //    has recognised sub-areas · otherwise pushing "which area?"
  //    when the user only knows the city is not useful.
  if (!mergedSlots.area && mergedSlots.location === "yogyakarta") {
    return {
      shouldSpeak: true,
      reason: "useful_preference",
      priority: "useful",
      presentation: "regular",
      question: lang === "id"
        ? "Mau saya fokus di area tertentu seperti Malioboro atau Prawirotaman?"
        : "Want me to focus around a specific area like Malioboro or Prawirotaman?",
    };
  }
  if (!mergedSlots.area && mergedSlots.location && KNOWN_ACCOMMODATION_LOCATIONS.has(mergedSlots.location)) {
    return {
      shouldSpeak: true,
      reason: "useful_preference",
      priority: "useful",
      presentation: "regular",
      question: lang === "id"
        ? "Ada lingkungan khusus yang kamu mau dekati?"
        : "Any particular neighbourhood you want to be near?",
    };
  }

  // 9. Opportunity · narrow list (3 or fewer real matches) · offer
  //    next action. Only fires when we're confident we've helped as
  //    far as we can with what the user told us.
  if (realPropertiesMatched > 0 && realPropertiesMatched <= 3) {
    return {
      shouldSpeak: true,
      reason: "opportunity",
      priority: "optional",
      presentation: "regular",
      question: lang === "id"
        ? "Mau saya bukakan panel direktori untuk detail mereka, atau menyaring lebih lanjut?"
        : "Want me to open the directory panel for their details, or refine further?",
    };
  }

  // 10. Over-narrowed · we had properties but filters removed them all.
  //     This is a EUREKA signal · a genuine grounded observation:
  //     "your filters + our data don't overlap, but relaxing one gives
  //     you N more matches." NEX is doing something more than pattern
  //     matching — it's noticing a mismatch and offering a fix.
  if (realPropertiesMatched === 0 && realPropertiesAvailable > 0) {
    return {
      shouldSpeak: true,
      reason: "clarification",
      priority: "useful",
      presentation: "eureka",
      question: lang === "id"
        ? `Satu hal yang saya perhatikan — filter kamu sekarang memberi 0 hasil, tapi saya punya ${realPropertiesAvailable} listingan kalau kita longgarkan area atau tipe. Mau saya perluas pencariannya?`
        : `One thing I noticed — your current filters leave 0 matches, but I have ${realPropertiesAvailable} listings if we relax the area or type. Want me to widen the search?`,
    };
  }

  // 11. Nothing useful to add · stay silent. The composer will present
  //     the top results plainly without a trailing question.
  return {
    shouldSpeak: false,
    reason: "none",
    priority: "optional",
    presentation: "regular",
  };
}
