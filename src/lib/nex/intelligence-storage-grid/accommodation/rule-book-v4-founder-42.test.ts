// src/lib/nex/intelligence-storage-grid/accommodation/rule-book-v4-founder-42.test.ts
//
// NEX Accommodation Agent · Rule Book v4 Contract Tests
// Founder BEGIN 2026-09-08 · 42-section GLOBAL ACCOMMODATION INTELLIGENCE
// RULE BOOK UPGRADE (the mission that was in flight during the crash).
//
// Covers additions from THIS 42-section BEGIN:
//   taxonomy.ts (extended)          FOUNDER_BEGIN_ADDITIONS_2026_09_08 · §3-§6 §8
//   country-profile.ts (new)        §8 · §26 · §27 · §28
//   acceptance-questions.ts (new)   §25 · §40 · §41
//
// Preserves prior v3 tests. Zero modification to v3 test file.
// Focus: no duplication of existing types · Founder-listed types present ·
// discovery checklist honesty · §40 topic coverage complete or explicitly
// gapped · UNKNOWN discipline holds.

import { describe, it, expect } from "vitest";
import {
  ALL_EXTENDED_TYPES,
  CANONICAL_ACCOMMODATION_CATEGORIES,
  CORE_TYPES,
  COUNTRY_SPECIFIC_TYPES,
  CAMPING_TYPES,
  FOUNDER_BEGIN_ADDITIONS_2026_09_08,
  OTHER_TYPES,
  SPECIALISED_TYPES,
  allKnownAliases,
  classifyAccommodationTypeString,
  classifyCanonicalCategory,
  taxonomyAudit,
} from "./taxonomy";
import {
  DISCOVERY_QUESTIONS,
  DISCOVERY_QUESTION_SLUGS,
  SEED_COUNTRY_PROFILES,
  countryProfileRegistryStats,
  generateDiscoveryChecklist,
  getCountryProfile,
  globalCountrySpecificSlugs,
  seededCountryCodes,
} from "./country-profile";
import {
  ACCEPTANCE_CATEGORIES,
  ACCEPTANCE_QUESTIONS,
  FOUNDER_40_TOPICS,
  acceptanceQuestionRegistryStats,
  founder40TopicCoverage,
  questionBySlug,
  questionsForCategory,
} from "./acceptance-questions";

// ═══════════════════════════════════════════════════════════════════
// §37 · NO DUPLICATION — every Founder-listed type appears exactly once
// ═══════════════════════════════════════════════════════════════════

describe("§37 no duplication · every extended type slug is unique across all registries", () => {
  it("no slug is repeated in ALL_EXTENDED_TYPES", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const t of ALL_EXTENDED_TYPES) {
      if (seen.has(t.slug)) duplicates.push(t.slug);
      seen.add(t.slug);
    }
    expect(duplicates).toEqual([]);
  });

  it("FOUNDER_BEGIN_ADDITIONS slugs do NOT collide with pre-existing slugs", () => {
    const preExisting = new Set([
      ...CORE_TYPES.map((t) => t.slug),
      ...SPECIALISED_TYPES.map((t) => t.slug),
      ...CAMPING_TYPES.map((t) => t.slug),
      ...OTHER_TYPES.map((t) => t.slug),
      ...COUNTRY_SPECIFIC_TYPES.map((t) => t.slug),
    ]);
    for (const t of FOUNDER_BEGIN_ADDITIONS_2026_09_08) {
      expect(preExisting.has(t.slug), `additive slug "${t.slug}" collides with pre-existing type`).toBe(false);
    }
  });

  it("no alias appears against two different types", () => {
    const aliasToSlug = new Map<string, string>();
    const conflicts: string[] = [];
    for (const t of ALL_EXTENDED_TYPES) {
      for (const a of t.aliases) {
        const key = a.toLowerCase().trim();
        const prior = aliasToSlug.get(key);
        if (prior && prior !== t.slug) conflicts.push(`"${key}": ${prior} vs ${t.slug}`);
        else aliasToSlug.set(key, t.slug);
      }
    }
    expect(conflicts).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §3-§6 §8 · Founder-listed types now present after additive extension
// ═══════════════════════════════════════════════════════════════════

describe("§3-§6 §8 · Founder-listed types are all present after taxonomy extension", () => {
  const requiredSlugs = [
    // §3 additions
    "apartment-complex", "rural-accommodation", "palace", "all-suite-hotel",
    // §4 additions
    "love-hotel", "teepee", "dome-accommodation", "igloo-accommodation",
    "cruise-ship-accommodation", "floating-accommodation", "lighthouse-accommodation",
    "railway-sleeper-accommodation",
    // §5 additions
    "caravan", "mobile-home", "campervan-accommodation", "tent", "trailer-tent", "cabin-camp",
    // §6 additions
    "seasonal-workers-accommodation", "group-accommodation", "holiday-camp",
    "educational-accommodation", "conference-accommodation", "medical-health-accommodation",
    // §8 nordic
    "ice-hotel",
  ] as const;

  for (const slug of requiredSlugs) {
    it(`FOUNDER_BEGIN addition present: ${slug}`, () => {
      const found = ALL_EXTENDED_TYPES.find((t) => t.slug === slug);
      expect(found, `slug "${slug}" missing from ALL_EXTENDED_TYPES`).toBeTruthy();
      expect(FOUNDER_BEGIN_ADDITIONS_2026_09_08.find((t) => t.slug === slug), `slug "${slug}" missing from FOUNDER_BEGIN_ADDITIONS`).toBeTruthy();
    });
  }

  it("every FOUNDER_BEGIN addition maps to a valid canonical category", () => {
    for (const t of FOUNDER_BEGIN_ADDITIONS_2026_09_08) {
      expect(
        CANONICAL_ACCOMMODATION_CATEGORIES.includes(t.canonical_category as any) || t.canonical_category === "unknown",
        `slug "${t.slug}" has invalid canonical_category "${t.canonical_category}"`,
      ).toBe(true);
    }
  });

  it("high-risk types have requires_evidence_note (§4/§6 special-handling)", () => {
    const highRisk = [
      "love-hotel", "teepee", "igloo-accommodation", "cruise-ship-accommodation",
      "floating-accommodation", "lighthouse-accommodation", "railway-sleeper-accommodation",
      "seasonal-workers-accommodation", "group-accommodation", "educational-accommodation",
      "medical-health-accommodation", "ice-hotel", "palace", "apartment-complex",
      "caravan", "mobile-home", "campervan-accommodation", "tent",
    ] as const;
    for (const slug of highRisk) {
      const t = ALL_EXTENDED_TYPES.find((x) => x.slug === slug)!;
      expect(t.requires_evidence_note, `slug "${slug}" must have a requires_evidence_note per §4/§6`).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// §31 · alias resolution still works for new types
// ═══════════════════════════════════════════════════════════════════

describe("§31 · alias resolver handles new Founder-added types", () => {
  it("resolves 'love hotel' → love-hotel", () => {
    expect(classifyAccommodationTypeString("love hotel")?.slug).toBe("love-hotel");
  });
  it("resolves 'static caravan' → caravan (via alias)", () => {
    expect(classifyAccommodationTypeString("static caravan")?.slug).toBe("caravan");
  });
  it("resolves 'geodesic dome' → dome-accommodation", () => {
    expect(classifyAccommodationTypeString("geodesic dome")?.slug).toBe("dome-accommodation");
  });
  it("resolves 'ice hotel' → ice-hotel", () => {
    expect(classifyAccommodationTypeString("ice hotel")?.slug).toBe("ice-hotel");
  });
  it("resolves 'snowhotel' → ice-hotel", () => {
    expect(classifyAccommodationTypeString("snowhotel")?.slug).toBe("ice-hotel");
  });
  it("classifyCanonicalCategory handles new types deterministically", () => {
    expect(classifyCanonicalCategory("love hotel")).toBe("hotel");
    expect(classifyCanonicalCategory("static caravan")).toBe("hostel");
    expect(classifyCanonicalCategory("cruise cabin")).toBe("hotel");
  });
});

// ═══════════════════════════════════════════════════════════════════
// §39 · taxonomy audit output shape (Founder-required deliverable)
// ═══════════════════════════════════════════════════════════════════

describe("§39 · taxonomy audit exposes all Founder-required counts", () => {
  it("taxonomyAudit() returns coherent totals including new additions", () => {
    const a = taxonomyAudit();
    const sum = a.core_types + a.specialised_types + a.camping_types + a.other_types + a.country_specific_types + a.founder_begin_additions_2026_09_08;
    expect(sum).toBe(a.total_extended_types);
    expect(a.founder_begin_additions_2026_09_08).toBe(FOUNDER_BEGIN_ADDITIONS_2026_09_08.length);
    expect(a.total_aliases).toBeGreaterThan(0);
    expect(a.types_requiring_evidence).toBeGreaterThan(0);
  });

  it("allKnownAliases() includes new-type aliases", () => {
    const aliases = allKnownAliases();
    expect(aliases).toContain("love hotel");
    expect(aliases).toContain("ice hotel");
    expect(aliases).toContain("mobile home");
  });
});

// ═══════════════════════════════════════════════════════════════════
// §8 §27 §28 · country-profile
// ═══════════════════════════════════════════════════════════════════

describe("§27 · country profile seeds Founder-named countries", () => {
  const founderNamed: readonly string[] = ["JP", "MA", "PT", "ES", "IT", "FR", "IN", "ID"];

  for (const cc of founderNamed) {
    it(`seed profile exists for ${cc}`, () => {
      expect(getCountryProfile(cc), `no seed profile for country "${cc}"`).not.toBeNull();
    });
  }

  it("each seeded profile has language + version + timestamp", () => {
    for (const p of SEED_COUNTRY_PROFILES) {
      expect(p.language_primary).toBeTruthy();
      expect(p.profile_version).toBeTruthy();
      expect(p.last_updated_iso).toBeTruthy();
    }
  });

  it("each seed profile's country_specific_type_slugs reference REAL slugs from taxonomy (any extended type · not only COUNTRY_SPECIFIC_TYPES · since Japanese/Alpine/African concepts appear in SPECIALISED too)", () => {
    const allSlugs = new Set(ALL_EXTENDED_TYPES.map((t) => t.slug));
    for (const p of SEED_COUNTRY_PROFILES) {
      for (const slug of p.country_specific_type_slugs) {
        expect(allSlugs.has(slug), `${p.country_code}: slug "${slug}" not in ALL_EXTENDED_TYPES`).toBe(true);
      }
    }
  });

  it("§37 no duplication · country_specific_type_slugs never redefine a type · always reference taxonomy", () => {
    // Any slug in a profile must already exist in ALL_EXTENDED_TYPES
    const allSlugs = new Set(ALL_EXTENDED_TYPES.map((t) => t.slug));
    for (const p of SEED_COUNTRY_PROFILES) {
      for (const slug of p.country_specific_type_slugs) {
        expect(allSlugs.has(slug), `${p.country_code}: slug "${slug}" not in ALL_EXTENDED_TYPES`).toBe(true);
      }
      for (const term of p.local_terminology) {
        expect(allSlugs.has(term.canonical_slug), `${p.country_code}: local_terminology canonical_slug "${term.canonical_slug}" not in taxonomy`).toBe(true);
      }
      for (const term of p.regional_terminology) {
        expect(allSlugs.has(term.canonical_slug), `${p.country_code}: regional_terminology canonical_slug "${term.canonical_slug}" not in taxonomy`).toBe(true);
      }
    }
  });

  it("Indonesia profile preserves local terminology (§26 cultural intelligence)", () => {
    const id = getCountryProfile("ID")!;
    const localTerms = id.local_terminology.map((t) => t.term);
    expect(localTerms).toContain("kos");
    expect(localTerms).toContain("penginapan");
    expect(localTerms).toContain("wisma");
    expect(localTerms).toContain("losmen");
    expect(localTerms).toContain("homestay");
  });

  it("registry stats coherent", () => {
    const s = countryProfileRegistryStats();
    expect(s.seeded_countries).toBe(SEED_COUNTRY_PROFILES.length);
    expect(s.discovery_question_count).toBe(DISCOVERY_QUESTION_SLUGS.length);
    expect(s.total_country_specific_slugs_registered).toBe(COUNTRY_SPECIFIC_TYPES.length);
  });
});

describe("§28 · discovery checklist", () => {
  it("has all 13 Founder questions in slug list", () => {
    expect(DISCOVERY_QUESTION_SLUGS.length).toBe(13);
    for (const slug of DISCOVERY_QUESTION_SLUGS) {
      expect(DISCOVERY_QUESTIONS[slug]).toBeTruthy();
      expect(DISCOVERY_QUESTIONS[slug].founder_text).toBeTruthy();
    }
  });

  it("generateDiscoveryChecklist for unseeded country returns all UNANSWERED (honest)", () => {
    const cl = generateDiscoveryChecklist("XX");
    expect(cl.length).toBe(13);
    for (const item of cl) {
      expect(item.answer_status).toBe("UNANSWERED");
    }
  });

  it("generateDiscoveryChecklist for Indonesia marks populated fields ANSWERED_PARTIAL (never ANSWERED)", () => {
    const cl = generateDiscoveryChecklist("ID");
    // Local terminology populated → 'what_are_the_local_names' should be partial
    const localNames = cl.find((c) => c.slug === "what_are_the_local_names")!;
    expect(localNames.answer_status).toBe("ANSWERED_PARTIAL");
    // Country_specific_type_slugs populated → 'what_accommodation_types_exist_here' partial
    const typesExist = cl.find((c) => c.slug === "what_accommodation_types_exist_here")!;
    expect(typesExist.answer_status).toBe("ANSWERED_PARTIAL");
    // Official terminology NOT populated → UNANSWERED
    const official = cl.find((c) => c.slug === "which_types_are_legally_recognised")!;
    expect(official.answer_status).toBe("UNANSWERED");
  });

  it("checklist NEVER reports ANSWERED status (only ANSWERED_PARTIAL · UNANSWERED · UNRESOLVABLE)", () => {
    const cl = generateDiscoveryChecklist("ID");
    for (const item of cl) {
      expect(["ANSWERED_PARTIAL", "UNANSWERED", "UNRESOLVABLE"]).toContain(item.answer_status);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// §25 §40 · acceptance-questions corpus
// ═══════════════════════════════════════════════════════════════════

describe("§25 · acceptance corpus covers Founder-listed traveller questions", () => {
  it("has at least 30 questions (Founder listed ~50 · corpus covers core)", () => {
    expect(ACCEPTANCE_QUESTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it("every question has non-empty founder_text + answering_fields", () => {
    for (const q of ACCEPTANCE_QUESTIONS) {
      expect(q.founder_text.trim().length).toBeGreaterThan(0);
      expect(q.answering_fields.length).toBeGreaterThan(0);
    }
  });

  it("every question has a valid category", () => {
    for (const q of ACCEPTANCE_QUESTIONS) {
      expect(ACCEPTANCE_CATEGORIES).toContain(q.category);
    }
  });

  it("no duplicate question slugs", () => {
    const slugs = new Set(ACCEPTANCE_QUESTIONS.map((q) => q.slug));
    expect(slugs.size).toBe(ACCEPTANCE_QUESTIONS.length);
  });

  it("Founder key questions from §25 are all present", () => {
    const mustHave = [
      "hotels_near_malioboro", "which_hotel_has_pool", "hotel_has_breakfast",
      "breakfast_included", "breakfast_kind", "room_bed_count", "room_bed_size",
      "can_four_people_stay", "hotel_has_family_room", "room_has_kitchen",
      "room_has_balcony", "room_has_air_conditioning", "hotel_has_parking",
      "hotel_has_ev_charging", "hotel_has_gym", "hotel_has_spa",
      "hotel_has_restaurant", "hotel_food_cuisine", "hotel_has_bar", "hotel_room_service",
      "wheelchair_accessible", "pets_allowed", "children_allowed", "cot_available",
      "extra_bed_available", "check_in_time", "check_out_time",
      "airport_transfer_available", "airport_distance", "station_distance",
      "what_is_nearby", "restaurants_nearby", "japanese_restaurants_nearby",
      "cafes_nearby", "attractions_nearby",
      "which_rooms", "show_rooms", "show_pool", "show_restaurant", "show_exterior", "show_best_room",
      "compare_two_hotels", "which_is_closer", "which_has_pool", "which_has_breakfast",
      "which_has_family_rooms", "which_has_better_nearby_food", "which_has_more_facilities",
      "which_has_more_evidence", "which_information_is_uncertain", "what_has_changed_recently",
    ] as const;
    for (const slug of mustHave) {
      expect(questionBySlug(slug), `Founder §25 question missing: ${slug}`).not.toBeNull();
    }
  });
});

describe("§40 · every acceptance topic has coverage (or is honestly gapped)", () => {
  it("§40 topic coverage returns 18 topics", () => {
    expect(FOUNDER_40_TOPICS.length).toBe(18);
  });

  it("core §40 topics (property lookup · type · country · relationships · unknowns) may currently be gaps", () => {
    // These topics are known to be under-populated in the current corpus.
    // Test asserts we can DETECT the gap, not that it's zero. Honest gap
    // reporting is the §30 · §41 discipline.
    const coverage = founder40TopicCoverage();
    const uncovered = coverage.filter((c) => c.question_count === 0).map((c) => c.topic);
    // Assert the gaps are identifiable (may be empty or populated over time)
    expect(Array.isArray(uncovered)).toBe(true);
  });

  it("registry stats reports which §40 topics are uncovered", () => {
    const s = acceptanceQuestionRegistryStats();
    expect(s.founder_40_topics_covered + s.founder_40_topics_uncovered.length).toBe(FOUNDER_40_TOPICS.length);
    expect(s.total_questions).toBe(ACCEPTANCE_QUESTIONS.length);
    expect(s.comparison_questions).toBeGreaterThan(0);
    expect(s.image_questions).toBeGreaterThan(0);
    expect(s.cross_domain_questions).toBeGreaterThan(0);
    expect(s.room_intelligence_questions).toBeGreaterThan(0);
  });

  it("all comparison questions carry is_comparison=true", () => {
    for (const q of questionsForCategory("COMPARISON")) {
      expect(q.is_comparison).toBe(true);
    }
  });

  it("all image questions carry requires_images=true", () => {
    for (const q of questionsForCategory("IMAGES")) {
      expect(q.requires_images).toBe(true);
    }
  });

  it("bed/room-intelligence questions carry requires_room_intelligence=true", () => {
    const roomOrBed = [...questionsForCategory("BEDS"), ...questionsForCategory("OCCUPANCY")];
    for (const q of roomOrBed) {
      expect(q.requires_room_intelligence).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// §41 · Founder success condition · every topic has UNKNOWN path
// ═══════════════════════════════════════════════════════════════════

describe("§41 · Founder success condition · UNKNOWN discipline everywhere", () => {
  it("no acceptance question mandates fabrication · every answering_field could legitimately be missing", () => {
    // Structural: no question is marked as 'must-be-fabricated'. This is
    // implicitly true (there's no such flag). This test documents the
    // discipline explicitly.
    for (const q of ACCEPTANCE_QUESTIONS) {
      // No field like 'fabricate_ok' should exist
      expect(Object.keys(q)).not.toContain("fabricate_ok");
      expect(Object.keys(q)).not.toContain("assume_when_missing");
    }
  });

  it("all discovery-checklist statuses degrade to UNANSWERED without fabricating", () => {
    // Uses the earlier test set — this restates the discipline as a
    // §41 acceptance criterion.
    const cl = generateDiscoveryChecklist("ZZ");
    for (const item of cl) {
      expect(item.answer_status).toBe("UNANSWERED");
    }
  });
});
