// src/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer.ts
//
// Founder BEGIN 2026-09-09 · DETERMINISTIC COMPOSER (P4)
//
// Turns { parsed_intent, fact_bundle(s), context } into a natural-language
// reply. Zero fabrication. Zero LLM. Fully deterministic.
//
// Fixes the previous "Yep — found 3" collapse where the chat brain saw the
// right structured answer but the composer flattened it into a generic
// acknowledgement. Every fact composes into a sentence that carries:
//   value + trust marker + honest UNKNOWN handling
//
// If a fact is UNKNOWN the composer says so plainly and (if the intent's
// auto_enqueue_gap_on_unknown is true) mentions that NEX will look it up.

import type { ParsedIntent } from "./intent-parser";
import type { FactBundle, StructuredFact, TrustLayer } from "./fact-computer";
import type { IntentDefinition } from "./intent-registry";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type ComposerLanguage = "en" | "id";

export interface ComposerContext {
  language: ComposerLanguage;
  /** Prior list items (for ordinal follow-ups · "the first one"). */
  prior_list?: readonly {
    listing_ref: string;
    business_name: string;
  }[];
  /** Property currently in focus (single-property Q2 turns). */
  focus_listing_ref?: string;
}

export interface ComposedReply {
  /** The primary sentence(s) shown to the customer. */
  reply_text: string;
  /** Optional short suffix for voice channels (usually identical). */
  voice_reply_text: string;
  /** Structured breakdown so downstream chat brain can log/telemeter honestly. */
  reply_kind: "fact" | "list" | "unknown" | "clarify" | "list_reference" | "multi_property_list" | "research_needed" | "availability_unknown";
  /** Which intent was answered · null if we couldn't route. */
  intent_slug: string | null;
  /** Which listing was answered about · null if aggregate. */
  listing_ref: string | null;
  /** Trust badge for UI. */
  trust: TrustLayer | "clarify" | "mixed";
  /** True = customer got a real value · false = we honestly said unknown/clarify. */
  answered: boolean;
  /** Debug trace lines (never shown to user). */
  reasoning: readonly string[];
  /** When reply_kind = "research_needed" · slots to pass back to the search adapter. */
  research_slots?: Readonly<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════
// Language packs · every user-visible string lives here
// ═══════════════════════════════════════════════════════════════════

const LANG = {
  en: {
    // Facts
    fact_prefix_verified: "",
    fact_prefix_unverified: "Based on what we have on record, ",
    fact_prefix_evidence:  "From a recent source we checked, ",
    fact_prefix_provisional: "The signal we have is a bit soft, but ",
    // Unknowns
    unknown_with_enqueue: "I don't have that on record for {name} yet — I've asked our team to look it up.",
    unknown_no_enqueue:   "I don't have that on record for {name}.",
    unknown_generic:      "I don't have that information right now.",
    // Clarify
    clarify_no_intent: "Sorry, I'm not sure what you'd like to know. Could you say a bit more?",
    clarify_no_focus:  "Which property are you asking about?",
    clarify_missing_ordinal: "Which one — the first, second, or third?",
    // List reference · ordinal follow-up
    list_ref_prefix: "About {name}: ",
    // Multi-property list rendering
    list_header:      "Here's what I have for each:",
    list_row:         "• {name} — {answer}",
    list_row_unknown: "• {name} — I don't have that on record yet",
    // Research-needed handoff (vertical switch)
    research_needed:  "Let me pull up {category}s for you.",
    // Founder BEGIN LCC 2026-09-09 · list_in_city + availability_unknown
    list_in_city_header_named:   "I have {n} verified {category} listings in {city}: {names}. Want prices, rooms, or amenities on any of them?",
    list_in_city_header_uncity:  "I have {n} verified {category} listings on record: {names}. Which city are you looking at?",
    list_in_city_no_city:        "I don't have any {category} listings I can vouch for in {city} yet. Try a different city or ask me for verified ones anywhere.",
    list_in_city_empty:          "I don't have any verified {category} listings yet. Want to try a different vertical?",
    availability_window_suffix:  " I can't verify live availability for {window} yet, but every listing above exists in my records.",
    availability_window_labels: {
      tonight: "tonight",
      tomorrow: "tomorrow",
      today: "today",
      this_weekend: "this weekend",
      next_week: "next week",
    } as Record<string, string>,
    // Composer-hint template markers
    yes: "Yes",
    no:  "No",
  },
  id: {
    fact_prefix_verified: "",
    fact_prefix_unverified: "Berdasarkan catatan kami, ",
    fact_prefix_evidence:  "Dari sumber yang kami cek, ",
    fact_prefix_provisional: "Sinyalnya agak lemah, tapi ",
    unknown_with_enqueue: "Belum ada catatan itu untuk {name} — kami minta tim mencari infonya.",
    unknown_no_enqueue:   "Belum ada catatan itu untuk {name}.",
    unknown_generic:      "Saat ini info itu belum ada.",
    clarify_no_intent: "Maaf, kurang paham. Bisa ceritakan sedikit lebih jelas?",
    clarify_no_focus:  "Properti yang mana ya?",
    clarify_missing_ordinal: "Yang mana — pertama, kedua, atau ketiga?",
    list_ref_prefix: "Tentang {name}: ",
    list_header:      "Berikut untuk masing-masing:",
    list_row:         "• {name} — {answer}",
    list_row_unknown: "• {name} — belum ada catatan",
    research_needed:  "Sebentar, saya carikan {category}.",
    // Founder BEGIN LCC 2026-09-09 · list_in_city + availability_unknown (ID)
    list_in_city_header_named:   "Saya punya {n} {category} yang tercatat di {city}: {names}. Mau harga, jumlah kamar, atau fasilitasnya?",
    list_in_city_header_uncity:  "Saya punya {n} {category} yang tercatat: {names}. Di kota mana?",
    list_in_city_no_city:        "Belum ada {category} tercatat di {city}. Coba kota lain atau saya carikan yang mana saja.",
    list_in_city_empty:          "Belum ada {category} tercatat. Coba kategori lain?",
    availability_window_suffix:  " Ketersediaan real-time untuk {window} belum bisa saya cek, tapi semua yang di atas benar-benar ada.",
    availability_window_labels: {
      tonight: "malam ini",
      tomorrow: "besok",
      today: "hari ini",
      this_weekend: "akhir pekan ini",
      next_week: "minggu depan",
    } as Record<string, string>,
    yes: "Ya",
    no:  "Tidak",
  },
} as const;

// Human-friendly category labels used by the vertical-switch reply
const CATEGORY_LABEL_EN: Record<string, string> = {
  hotel: "hotel", guesthouse: "guesthouse", villa: "villa", homestay: "homestay",
  hostel: "hostel", apartment: "apartment", resort: "resort", kos: "kos",
  penginapan: "penginapan", wisma: "wisma", losmen: "losmen",
};

// ═══════════════════════════════════════════════════════════════════
// Rendering helpers
// ═══════════════════════════════════════════════════════════════════

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function trustPrefix(lang: ComposerLanguage, trust: TrustLayer): string {
  const L = LANG[lang];
  switch (trust) {
    case "canonical_verified":  return L.fact_prefix_verified;
    case "canonical_unverified": return L.fact_prefix_unverified;
    case "evidence_verified":   return L.fact_prefix_evidence;
    case "evidence_provisional": return L.fact_prefix_provisional;
    case "unknown":             return "";
  }
}

function renderValue(value: unknown, answer_kind: IntentDefinition["answer_kind"], lang: ComposerLanguage): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? LANG[lang].yes : LANG[lang].no;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    const items = value.filter((v) => v !== null && v !== undefined).map((v) => String(v));
    if (items.length <= 3) return items.join(", ");
    return `${items.slice(0, 3).join(", ")} (${items.length} total)`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Render an intent's composer_hint template, substituting {value} + {name}. */
function renderHint(
  intent: IntentDefinition,
  fact: StructuredFact,
  business_name: string,
  lang: ComposerLanguage,
): string {
  const template = lang === "id" ? intent.composer_hint_id : intent.composer_hint_en;
  const value = renderValue(fact.value, intent.answer_kind, lang);
  return template
    .replace(/\{value\}/g, value)
    .replace(/\{name\}/g, business_name);
}

// ═══════════════════════════════════════════════════════════════════
// Composer · main entry
// ═══════════════════════════════════════════════════════════════════

export function composeReply(input: {
  parsed: ParsedIntent;
  bundles: readonly FactBundle[];
  context: ComposerContext;
}): ComposedReply {
  const { parsed, bundles, context } = input;
  const reasoning: string[] = [];
  const L = LANG[context.language];

  // ── Guard 1 · no intent detected → honest clarify (never guess) ──
  if (!parsed.intent_slug || !parsed.intent) {
    reasoning.push("no intent resolved · returning clarify");
    return {
      reply_text: L.clarify_no_intent,
      voice_reply_text: L.clarify_no_intent,
      reply_kind: "clarify",
      intent_slug: null,
      listing_ref: null,
      trust: "clarify",
      answered: false,
      reasoning,
    };
  }

  // ── Guard 2 · ordinal follow-up but no prior list · ask ──
  if (parsed.slots.is_follow_up_ordinal && (!context.prior_list || context.prior_list.length === 0)) {
    reasoning.push("ordinal reference but no prior list · asking for clarification");
    return {
      reply_text: L.clarify_missing_ordinal,
      voice_reply_text: L.clarify_missing_ordinal,
      reply_kind: "clarify",
      intent_slug: parsed.intent_slug,
      listing_ref: null,
      trust: "clarify",
      answered: false,
      reasoning,
    };
  }

  // ── Founder BEGIN LCC 2026-09-09 · list_in_city / availability_query ──
  // The founder's chief symptom was "Yep — found 3". That happened because
  // the composer had no way to render "here are 3 verified hotels in <city>"
  // from a list bundle. This branch does that — at canonical_verified trust
  // when every prior_list item resolved to a bundle we own. When the user
  // also asked about a date window (tomorrow/tonight/this weekend/etc.),
  // append an honest "I can't verify live availability" clause and mark the
  // reply as availability_unknown so the promotion gate can accept it.
  if (parsed.intent_slug === "list_in_city" || parsed.intent_slug === "availability_query") {
    const category = parsed.slots.property_category ?? "hotel";
    const city     = parsed.slots.city ?? "";
    const catLabel = CATEGORY_LABEL_EN[category] ?? category;
    // Build a name list from prior_list (each item must map to a bundle we
    // own for the trust badge to be canonical_verified; the composer never
    // includes a name it didn't get from stored data).
    const priorList = context.prior_list ?? [];
    const verifiedNames: string[] = [];
    let allVerified = true;
    for (const item of priorList) {
      const bundle = bundles.find((b) => b.listing_ref === item.listing_ref);
      if (bundle && bundle.business_name) {
        verifiedNames.push(bundle.business_name);
      } else if (item.business_name) {
        // We have the name from chat brain but couldn't resolve a bundle.
        // Include it but downgrade trust below canonical_verified.
        verifiedNames.push(item.business_name);
        allVerified = false;
      } else {
        allVerified = false;
      }
    }
    const n = verifiedNames.length;
    let text: string;
    let trust: TrustLayer | "mixed";
    let answered: boolean;
    let replyKind: "list" | "availability_unknown" | "unknown";

    if (n === 0) {
      // Honest "no verified listings" — that IS an answer, not a search handoff.
      text = city
        ? L.list_in_city_no_city.replace(/\{category\}/g, catLabel).replace(/\{city\}/g, capitalise(city))
        : L.list_in_city_empty.replace(/\{category\}/g, catLabel);
      trust = "unknown";
      answered = true;
      replyKind = "unknown";
      reasoning.push(`list_in_city · zero verified ${category}s${city ? ` in ${city}` : ""}`);
    } else {
      const namesJoined = verifiedNames.slice(0, 6).join(", ") + (verifiedNames.length > 6 ? ", …" : "");
      const header = city
        ? L.list_in_city_header_named
            .replace(/\{n\}/g, String(n))
            .replace(/\{category\}/g, catLabel)
            .replace(/\{city\}/g, capitalise(city))
            .replace(/\{names\}/g, namesJoined)
        : L.list_in_city_header_uncity
            .replace(/\{n\}/g, String(n))
            .replace(/\{category\}/g, catLabel)
            .replace(/\{names\}/g, namesJoined);
      text = header;
      trust = allVerified ? "canonical_verified" : "mixed";
      answered = true;
      replyKind = "list";
      reasoning.push(`list_in_city · rendered ${n} verified ${category}${n === 1 ? "" : "s"}${city ? ` in ${city}` : ""} (allVerified=${allVerified})`);
    }

    // Availability window suffix + reply_kind promotion
    if (parsed.slots.time) {
      const label = L.availability_window_labels[parsed.slots.time] ?? parsed.slots.time;
      text += L.availability_window_suffix.replace(/\{window\}/g, label);
      // availability_unknown is honest — mark it so the promotion gate lets
      // it through even though trust is now mixed (we know the entities,
      // we don't know availability for the window).
      replyKind = "availability_unknown";
      trust = allVerified ? "canonical_verified" : "mixed";
      reasoning.push(`availability window=${parsed.slots.time} · appended honest disclaimer`);
    }

    return {
      reply_text: text,
      voice_reply_text: text,
      reply_kind: replyKind,
      intent_slug: parsed.intent_slug,
      listing_ref: null,
      trust,
      answered,
      reasoning,
    };
  }

  // ── Refinement 3 · Vertical switch → research_needed ──
  // "what about guesthouses" — user wants a NEW search with a different
  // category. Only fires when the parser actually routed to property_category
  // (a real "what about" phrasing). Fresh list requests now route to
  // list_in_city and are handled by the list-composer above.
  if (parsed.intent_slug === "property_category" && parsed.slots.property_category) {
    const cat = parsed.slots.property_category;
    const label = CATEGORY_LABEL_EN[cat] ?? cat;
    const text = L.research_needed.replace(/\{category\}/g, label);
    reasoning.push(`vertical switch to ${cat} · returning research_needed for chat brain to re-run search adapter`);
    return {
      reply_text: text,
      voice_reply_text: text,
      reply_kind: "research_needed",
      intent_slug: parsed.intent_slug,
      listing_ref: null,
      trust: "mixed",
      answered: true,
      reasoning,
      research_slots: {
        property_category: cat,
        city: parsed.slots.city ?? undefined,
        price_preference: parsed.slots.price_preference ?? undefined,
      },
    };
  }

  // ── Refinement 2 · list-composer for multi-property follow-ups ──
  // If we have a prior_list of N properties AND the user is asking a
  // per-property question WITHOUT specifying which one (no ordinal, no
  // focus) → iterate and answer for each. Handles "where are they",
  // "which ones have pool", "show me the cheapest".
  if (
    !parsed.slots.is_follow_up_ordinal
    && !context.focus_listing_ref
    && context.prior_list
    && context.prior_list.length > 1
    && parsed.intent
    && (parsed.intent.answer_kind === "fact" || parsed.intent.answer_kind === "list")
  ) {
    const rows: string[] = [];
    let answeredAny = false;
    let allUnknown = true;
    const trustCounts: Record<string, number> = {};
    for (const item of context.prior_list) {
      const bundle = bundles.find((b) => b.listing_ref === item.listing_ref);
      if (!bundle) {
        rows.push(L.list_row_unknown.replace(/\{name\}/g, item.business_name));
        continue;
      }
      const fact = bundle.facts[parsed.intent_slug];
      if (!fact || fact.unknown) {
        rows.push(L.list_row_unknown.replace(/\{name\}/g, item.business_name));
        continue;
      }
      const answerText = renderHint(parsed.intent, fact, item.business_name, context.language)
        .replace(/^[A-Z]/, (c) => c.toLowerCase()); // "Wi-Fi: Yes." → keep prefix; ensure sentence continuity
      rows.push(L.list_row.replace(/\{name\}/g, item.business_name).replace(/\{answer\}/g, answerText));
      answeredAny = true;
      allUnknown = false;
      trustCounts[fact.trust] = (trustCounts[fact.trust] ?? 0) + 1;
    }
    const text = `${L.list_header}\n${rows.join("\n")}`;
    reasoning.push(`list-composer · ${context.prior_list.length} properties · answered_any=${answeredAny}`);
    return {
      reply_text: text,
      voice_reply_text: text,
      reply_kind: "multi_property_list",
      intent_slug: parsed.intent_slug,
      listing_ref: null,
      trust: allUnknown ? "unknown" : "mixed",
      answered: answeredAny,
      reasoning,
    };
  }

  // ── Resolve which listing this turn refers to ──
  let targetBundle: FactBundle | null = null;
  let listRefPrefix = "";
  if (parsed.slots.is_follow_up_ordinal && context.prior_list && parsed.slots.ordinal) {
    const idx = parsed.slots.ordinal - 1;
    const item = context.prior_list[idx];
    if (item) {
      targetBundle = bundles.find((b) => b.listing_ref === item.listing_ref) ?? null;
      listRefPrefix = L.list_ref_prefix.replace(/\{name\}/g, item.business_name);
      reasoning.push(`ordinal ${parsed.slots.ordinal} → ${item.business_name} (${item.listing_ref})`);
    }
  } else if (context.focus_listing_ref) {
    targetBundle = bundles.find((b) => b.listing_ref === context.focus_listing_ref) ?? null;
    reasoning.push(`focus listing ${context.focus_listing_ref}`);
  } else if (bundles.length === 1) {
    targetBundle = bundles[0];
    reasoning.push(`single bundle in context · using ${targetBundle.listing_ref}`);
  }

  // ── Guard 3 · no target · we have multi-listing context but no focus ──
  if (!targetBundle) {
    if (bundles.length === 0) {
      reasoning.push("no bundles in context");
      return {
        reply_text: L.clarify_no_focus,
        voice_reply_text: L.clarify_no_focus,
        reply_kind: "clarify",
        intent_slug: parsed.intent_slug,
        listing_ref: null,
        trust: "clarify",
        answered: false,
        reasoning,
      };
    }
    // We have multiple listings but no focus → clarify which one
    reasoning.push(`${bundles.length} bundles in context · no focus · asking`);
    return {
      reply_text: L.clarify_no_focus,
      voice_reply_text: L.clarify_no_focus,
      reply_kind: "clarify",
      intent_slug: parsed.intent_slug,
      listing_ref: null,
      trust: "clarify",
      answered: false,
      reasoning,
    };
  }

  // ── Retrieve the fact for the resolved intent ──
  const fact = targetBundle.facts[parsed.intent_slug];
  if (!fact) {
    // Intent has no fact in bundle (e.g. relationship intent · handled elsewhere).
    reasoning.push(`no fact for intent ${parsed.intent_slug} in bundle · returning unknown_generic`);
    const text = L.unknown_generic;
    return {
      reply_text: listRefPrefix + text,
      voice_reply_text: listRefPrefix + text,
      reply_kind: "unknown",
      intent_slug: parsed.intent_slug,
      listing_ref: targetBundle.listing_ref,
      trust: "unknown",
      answered: false,
      reasoning,
    };
  }

  // ── Guard 4 · UNKNOWN fact · honest response · propose gap ──
  if (fact.unknown) {
    const template = fact.enqueue_gap ? L.unknown_with_enqueue : L.unknown_no_enqueue;
    const text = template.replace(/\{name\}/g, targetBundle.business_name);
    reasoning.push(`fact unknown · enqueue_gap=${fact.enqueue_gap}`);
    return {
      reply_text: listRefPrefix + text,
      voice_reply_text: listRefPrefix + text,
      reply_kind: "unknown",
      intent_slug: parsed.intent_slug,
      listing_ref: targetBundle.listing_ref,
      trust: "unknown",
      answered: false,
      reasoning,
    };
  }

  // ── Happy path · we have a value · render with trust prefix ──
  const prefix = trustPrefix(context.language, fact.trust);
  const body = renderHint(parsed.intent, fact, targetBundle.business_name, context.language);
  const composed = listRefPrefix + prefix + body;
  reasoning.push(`answered ${parsed.intent_slug} for ${targetBundle.listing_ref} (${fact.trust})`);

  return {
    reply_text: composed,
    voice_reply_text: composed,
    reply_kind: parsed.slots.is_follow_up_ordinal ? "list_reference" : "fact",
    intent_slug: parsed.intent_slug,
    listing_ref: targetBundle.listing_ref,
    trust: fact.trust,
    answered: true,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Batch composer · for the audit runner
// ═══════════════════════════════════════════════════════════════════

export function composeReplyBatch(inputs: {
  parsed: ParsedIntent;
  bundles: readonly FactBundle[];
  context: ComposerContext;
}[]): ComposedReply[] {
  return inputs.map(composeReply);
}
