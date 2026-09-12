#!/usr/bin/env node
// scripts/nex-composition-pilot-corpus-v2.mjs
//
// NEX Master AI Engineer · Corpus v2 generator
// Founder BEGIN 2026-09-08 · expanded corpus covering all 13 mandated types
//
// Pulls REAL accommodation entities from Postgres (877 visible rows).
// Zero fabrication of accommodation facts. Questions targeting non-existent
// data (missing_info / no_answer categories) use deliberately-fake names.
//
// Also generates semantic-near-duplicate variants for a subset to exercise
// the semantic cache (which recorded 0% hit in v1 because 30 unique queries
// had no near-neighbours).
//
// Output: data/pilot-nex-composition/corpus-accommodation-v2.jsonl

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_CORPUS_INNER) {
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local")) ? ["--env-file=.env.local"] : [];
  const child = spawn("node", [...envFileArgs, entryFile, ...process.argv.slice(2)], {
    stdio: "inherit", cwd: repoRoot, shell: false,
    env: { ...process.env, NEX_CORPUS_INNER: "1" },
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const pgLib = await import("pg");
  const { Pool } = pgLib.default ?? pgLib;
  const pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

  console.log("Pulling real accommodation entities…");
  const res = await pool.query(`
    SELECT public_listing_ref, business_name, city, coordinates_lat, coordinates_lng,
           amenities, categories, star_rating, room_count, rating
    FROM nex.accommodation_business
    WHERE claim_status IN ('listed','invited','claimed','paying')
  `);
  const rows = res.rows;
  console.log(`  ${rows.length} rows loaded`);

  // Field-quality summary
  const withCoords = rows.filter((r) => r.coordinates_lat != null && r.coordinates_lng != null);
  const withWifi = rows.filter((r) => Array.isArray(r.amenities) && r.amenities.includes("wifi"));
  const withAircon = rows.filter((r) => Array.isArray(r.amenities) && r.amenities.includes("air_conditioning"));
  const withRoomCount = rows.filter((r) => r.room_count != null);
  const withStarRating = rows.filter((r) => r.star_rating != null);
  console.log(`  with_coords=${withCoords.length} with_wifi=${withWifi.length} with_aircon=${withAircon.length} with_room_count=${withRoomCount.length} with_star=${withStarRating.length}`);

  await pool.end();

  // Deterministic PRNG seed for repeatable case generation
  let seed = 12345;
  const rand = () => {
    // xorshift32
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return (seed >>> 0) / 0xffffffff;
  };
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const shuffled = (arr, n) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };

  const cases = [];
  let seq = 0;
  const add = (type, question, expected_route, notes, extras = {}) => {
    cases.push({
      case_id: `${type}_${String(++seq).padStart(4, "0")}`,
      type,
      question,
      expected_route,
      notes,
      ...extras,
    });
  };

  // 1. SIMPLE LOOKUP · 50 cases · real names + real refs + a few fake refs
  const nameSample = shuffled(rows, 30);
  for (const r of nameSample) {
    add("simple_lookup", `Tell me about ${r.business_name}`, "B", "real name · unique-match hot-tier hit");
  }
  const refSample = shuffled(rows, 15);
  for (const r of refSample) {
    add("simple_lookup", `Show me details for listing ${r.public_listing_ref}`, "B", "real ref · hot-tier direct hit");
  }
  const fakeRefs = ["#AC-2026-FAKE1", "#AC-2026-FAKE2", "#AC-2026-XXXXX", "#AC-2026-99999", "#AC-9999-ABCDE"];
  for (const f of fakeRefs) {
    add("simple_lookup", `Show me details for listing ${f}`, "E", "fake ref · honest UNKNOWN + Gap enqueue");
  }

  // 2. NEAREST HOTEL · 30 cases · use REAL coordinates as anchors
  const geoSample = shuffled(withCoords, 20);
  const yogyaLandmarks = [
    { name: "Malioboro street", lat: -7.7924, lng: 110.3657 },
    { name: "Prambanan temple", lat: -7.7520, lng: 110.4915 },
    { name: "Yogyakarta airport (YIA)", lat: -7.9057, lng: 110.0575 },
    { name: "Tugu Yogyakarta station", lat: -7.7893, lng: 110.3639 },
    { name: "Kraton palace", lat: -7.8053, lng: 110.3642 },
    { name: "Ambarrukmo mall", lat: -7.7823, lng: 110.4013 },
    { name: "Gadjah Mada University", lat: -7.7713, lng: 110.3775 },
    { name: "Sultan's palace", lat: -7.8053, lng: 110.3642 },
    { name: "Adisucipto airport", lat: -7.7885, lng: 110.4318 },
    { name: "Beringharjo market", lat: -7.7960, lng: 110.3670 },
  ];
  for (const l of yogyaLandmarks) {
    add("nearest_hotel", `Which hotels are closest to ${l.name} in Yogyakarta?`, "B", `distance intent · Haversine · landmark ${l.name}`);
  }
  for (const l of shuffled(yogyaLandmarks, 5)) {
    add("nearest_hotel", `What's the nearest accommodation to ${l.name}?`, "B", "distance intent");
  }
  for (const l of shuffled(yogyaLandmarks, 5)) {
    add("nearest_hotel", `Find me a hotel near ${l.name}`, "B", "near-me pattern");
  }
  for (const r of shuffled(geoSample, 10)) {
    add("nearest_hotel", `What accommodations are close to ${r.business_name}?`, "C", "real hotel as anchor · comparison");
  }

  // 3. FILTERING · 40 cases · target wifi/air_conditioning heavily since that's what exists
  add("filtering", "Hotels in Yogyakarta with wifi", "C", "wifi predicate · 107 real matches");
  add("filtering", "Accommodation in Yogyakarta with air conditioning", "C", "aircon predicate · 27 real matches");
  add("filtering", "Yogyakarta hotels with WiFi", "C", "casing variant");
  for (let i = 0; i < 12; i++) {
    add("filtering", pick([
      "Hotels with wifi in Yogyakarta",
      "Places with air conditioning in Yogyakarta",
      "Wifi-enabled accommodation Yogyakarta",
      "Hotels with AC in Yogyakarta",
      "Yogyakarta accommodations with internet",
      "Yogyakarta places with air-con",
      "Hotels in Yogyakarta offering wifi",
      "Accommodation with air conditioning Yogyakarta",
      "Yogyakarta stays with wifi included",
      "Yogyakarta lodging with AC",
      "Hotels with internet access Yogyakarta",
      "Yogyakarta hotels with climate control",
    ]), "C", "amenity+city near-duplicate variants · semantic cache should absorb after first");
  }
  for (const p of ["pool", "spa", "gym", "breakfast", "restaurant", "beach", "parking", "kids-friendly", "pet-friendly", "family rooms", "sauna", "beachfront", "seaview", "kitchen", "shuttle"]) {
    add("filtering", `Yogyakarta hotels with ${p}`, "C", "amenity mostly-absent · honest E likely");
  }
  add("filtering", "5-star hotels in Yogyakarta", "C", "star filter · only 13 records populated · mostly E");
  add("filtering", "4-star accommodation in Yogyakarta", "C", "star filter");
  add("filtering", "Cheap hotels in Yogyakarta", "C", "price predicate · no price field · E");
  add("filtering", "Luxury hotels in Yogyakarta", "C", "no price/tier field · E");
  add("filtering", "Budget accommodation Yogyakarta", "C", "no price field · E");
  add("filtering", "Homestays in Yogyakarta", "C", "category filter · 'building-only'/'motel' exist · homestay may match by name");
  add("filtering", "Motels in Yogyakarta", "C", "category · 9 real motel records");

  // 4. COMPARISONS · 30 cases · use real pairs
  const pairs = shuffled(rows, 40);
  for (let i = 0; i < 25; i += 1) {
    const a = pairs[i], b = pairs[(i + 1) % pairs.length];
    if (!a || !b || a.business_name === b.business_name) continue;
    add("comparison", `Compare ${a.business_name} versus ${b.business_name}`, "C", "real pair · comparison intent");
  }
  add("comparison", "Compare Hotel Tentrem vs Royal Ambarrukmo Yogyakarta", "C", "real pair");
  add("comparison", "Grand Inna Malioboro or Eastparc Hotel Yogyakarta - which is better?", "C", "real pair with which-question");
  add("comparison", "Difference between Padma Amita Yogyakarta and Hotel Tentrem", "C", "real pair · difference intent");
  add("comparison", "Is Hotel Novatel better than Sky Hotel Hayam Wuruk?", "C", "real pair · better-than intent");
  add("comparison", "Cheaper option: Le Jardin or Casa De Celestine?", "C", "cheaper-than · no price field · honest E");

  // 5. MULTIPLE CONDITIONS · 30 cases
  const combos = [
    "in Yogyakarta with wifi and air conditioning",
    "in Yogyakarta with wifi and parking",
    "in Yogyakarta with wifi near Malioboro",
    "in Yogyakarta with air conditioning and family rooms",
    "in Yogyakarta with pool and wifi",
    "in Yogyakarta with wifi and breakfast",
    "in Yogyakarta with wifi under 100 dollars",
    "in Yogyakarta with wifi and near the airport",
    "in Yogyakarta with 4 stars and wifi",
    "in Yogyakarta with 5 stars and air conditioning",
  ];
  for (const c of combos) {
    add("multiple_conditions", `Hotels ${c}`, "C", "multi-predicate query");
  }
  for (const c of combos.slice(0, 5)) {
    add("multiple_conditions", `Accommodation ${c}`, "C", "multi-predicate variant");
  }
  for (const c of combos.slice(0, 5)) {
    add("multiple_conditions", `Places to stay ${c}`, "C", "multi-predicate variant");
  }
  add("multiple_conditions", "Family-friendly hotels in Yogyakarta near Malioboro with wifi and breakfast", "C", "4-condition");
  add("multiple_conditions", "5-star beachfront hotels in Yogyakarta with spa and pool", "C", "4-condition · mostly-null fields");
  for (let i = 0; i < 10; i++) {
    const r = pairs[i]; if (!r) continue;
    add("multiple_conditions", `Is ${r.business_name} in Yogyakarta and does it have wifi?`, "C", "entity + predicate combined");
  }

  // 6. MISSING INFORMATION · 30 cases · fake but plausible
  const fakeHotels = [
    "The Nonexistent Palace Yogyakarta", "Hotel Imaginary Solo", "The Fictional Resort Bali",
    "Grand Nowhere Hotel", "Made-Up Homestay Yogya", "Placeholder Inn",
    "Test Fake Hotel", "Nonexistent Grand Villa", "Fabricated Hotel Yogya",
    "The Ghost Hotel", "Vanishing Point Hotel", "Empty Room Inn",
    "Non-Real Boutique", "Illusion Hotel Yogyakarta", "Phantom Palace",
  ];
  for (const h of fakeHotels) {
    add("missing_information", `Tell me about ${h}`, "E", "fake name · honest UNKNOWN + Gap");
  }
  for (const h of fakeHotels.slice(0, 5)) {
    add("missing_information", `Book a room at ${h}`, "E", "fake name · booking intent · UNKNOWN");
  }
  for (const h of fakeHotels.slice(0, 5)) {
    add("missing_information", `What's the price at ${h}?`, "E", "fake name + no-price-field · UNKNOWN");
  }
  add("missing_information", "What is the swimming pool depth at Hotel Tentrem?", "E", "real hotel but attribute not stored");
  add("missing_information", "Does Grand Inna Malioboro have vegetarian breakfast?", "E", "real hotel · attribute not stored");
  add("missing_information", "How many single rooms at Eastparc Hotel Yogyakarta?", "E", "real hotel · granular attribute not stored");
  add("missing_information", "What year was Royal Ambarrukmo Yogyakarta built?", "E", "real hotel · historical attribute not stored");
  add("missing_information", "Who owns Padma Amita Yogyakarta?", "E", "ownership attribute not stored");

  // 7. CONFLICTING INFORMATION · 20 cases
  add("conflicting_information", "Is Hotel Novatel a 5-star or a 4-star?", "E", "conflict detection · not scored");
  add("conflicting_information", "Some sources say Grand Inna Malioboro has a rooftop pool - is that correct?", "E", "cross-source conflict");
  add("conflicting_information", "I heard Hotel Tentrem is closed - is it still open?", "E", "conflicting-status");
  add("conflicting_information", "Are OYO 1592 Gading 4u Homestay reviews positive?", "E", "review synthesis · not available");
  add("conflicting_information", "The website says one thing, TripAdvisor another - what's the real price at Sky Hotel Hayam Wuruk?", "E", "explicit cross-source conflict");
  add("conflicting_information", "Two friends gave contradictory reviews of Bladok Losmen. Which is right?", "E", "conflict resolution needed");
  for (let i = 0; i < 14; i++) {
    add("conflicting_information", pick([
      "Different sites list different prices for Le Jardin, which is accurate?",
      "Is Casa De Celestine open 24/7 or only during business hours?",
      "Does Reddoorz Condongcatur allow pets or not? Sources disagree.",
      "Some say Hotel Sekar Ayu has parking, others say no. Which is true?",
      "The map shows Sagan Huis Hotel in one place, Google says another. Which?",
      "Wisma Ambarrukmo 2 has how many rooms? I've seen different numbers.",
      "Zen Rooms Depok Sleman Syariha - is it a hotel or a homestay?",
      "Kos Pak Ngadirin - permanent or short-stay?",
      "Was Gaotama Hotel renovated recently? Conflicting info online.",
      "Different reviews say Puri Ageng is quiet or noisy. Which?",
      "1O1 STYLE Yogyakarta Malioboro - independent or chain?",
      "Hotel Maerakatja Yogyakarta - do they accept credit cards?",
      "Artotel Suites - does it have spa services or not?",
      "Septia Hotel Jogjakarta - is it family-friendly?",
    ]), "E", "conflict-resolution intent · needs verified answer");
  }

  // 8. FRESHNESS QUESTIONS · 20 cases · time-dependent · reservoir cannot answer
  const freshBase = [
    "What time does Hotel Tentrem reception open today?",
    "Is Grand Inna Malioboro fully booked tonight?",
    "Current prices at Royal Ambarrukmo Yogyakarta",
    "Is there any availability at Eastparc Hotel Yogyakarta right now?",
    "Today's rate for Padma Amita",
    "This weekend's promotions at Artotel Suites",
    "Live availability for Sagan Huis Hotel next Friday",
    "What events are on at Hotel Novatel this week?",
    "Any last-minute deals in Yogyakarta today?",
    "Is Bladok Losmen open right now?",
  ];
  for (const q of freshBase) {
    add("freshness", q, "E", "time-sensitive · reservoir stale for this · needs live source");
  }
  const freshMore = [
    "Current time zone offset for Yogyakarta hotels?",
    "Today's weather at Kuta beach affecting Yogyakarta hotels?",
    "How busy is Malioboro area right now?",
    "Which Yogyakarta hotels have same-day check-in today?",
    "Are any hotels on fire in Yogyakarta right now?",
    "Latest COVID restrictions for Yogyakarta hotels",
    "Any hotel strikes today?",
    "Current traffic to Yogyakarta hotels from the airport",
    "Are Yogyakarta hotels heating up? (weather + occupancy)",
    "Late night check-in options tonight in Yogyakarta",
  ];
  for (const q of freshMore) add("freshness", q, "E", "live/time-sensitive · no answer possible");

  // 9. AMBIGUOUS · 25 cases
  const ambigs = [
    "Hotel", "Hotels", "Accommodation", "Yogyakarta", "Wifi", "Family",
    "Best", "Cheap", "Near me", "For tonight", "Around here", "Somewhere nice",
    "The good one", "You know the one", "That place", "Same as before",
    "Better option?", "Something different", "The other one", "How about it",
    "OK now what", "Continue", "More", "Options?", "Show me",
  ];
  for (const q of ambigs) add("ambiguous", q, "E", "underspecified · honest UNKNOWN or Route A small-talk");

  // 10. CONVERSATIONAL FOLLOW-UPS · 20 cases (mostly A)
  const conversational = [
    "Hi", "Hello", "Hey there", "Good morning", "Good evening",
    "Thanks", "Thank you", "Cheers", "That's great", "Perfect",
    "Ok", "Okay", "Yes", "No", "Maybe", "Not sure", "I guess",
    "Bye", "Goodbye", "See you",
  ];
  for (const q of conversational) add("conversational", q, "A", "small-talk · Route A canned response");

  // 11. REASONING · 20 cases · genuinely multi-step
  const reasoning = [
    "If I'm arriving at Yogyakarta airport at 11pm and need to be at Malioboro by 8am, which hotel makes most sense?",
    "I have a family of 5 with a baby and want to be within walking distance of temples - what's my best choice in Yogyakarta?",
    "Given a budget of 500,000 IDR per night and preferring quiet, which Yogyakarta hotel fits best?",
    "For a business traveler doing a 3-day workshop near Gadjah Mada University, which accommodation minimizes commute time and cost?",
    "If wifi is critical for remote work and I need to stay 2 weeks, which Yogyakarta hotel maximizes value?",
    "I want to visit Prambanan and Borobudur in the same trip - which hotel is optimally placed between them?",
    "Compare the total cost of a 5-night stay at Grand Inna Malioboro versus splitting between two homestays",
    "Best hotel for a wedding party of 30 people in Yogyakarta considering meeting rooms and rooms available",
    "Which Yogyakarta hotel has the best combination of centrality, wifi and quiet?",
    "For a solo traveler on a shoestring budget who wants safety - which Yogyakarta homestay is best?",
    "If I'm traveling by scooter and want free parking, which hotel is optimal?",
    "Give me a 7-day itinerary and hotel choice for exploring Yogyakarta with focus on culture",
    "Break down the trade-offs between staying at a luxury Yogyakarta hotel versus a boutique homestay",
    "Optimize accommodation choice for a photography trip focused on temples and street scenes in Yogyakarta",
    "A group of 4 backpackers needs 2 rooms - which Yogyakarta place gives best group discount?",
    "For an elderly couple with mobility issues, which Yogyakarta accommodation offers best accessibility?",
    "Design an accommodation plan for a 3-city trip: Yogyakarta, Solo, and Semarang",
    "For a solo female traveler prioritizing safety over price - which Yogyakarta option?",
    "If Malioboro area is fully booked, what's my second-best neighbourhood for the same experience?",
    "Which Yogyakarta hotel minimizes total travel time for visiting 5 named attractions?",
  ];
  for (const q of reasoning) add("reasoning", q, "D", "multi-step reasoning · genuinely LLM territory");

  // 12. DELIBERATELY DIFFICULT · 20 cases
  const difficult = [
    "Recommend a hotel in Yogyakarta that also has a Michelin-starred restaurant",
    "Which Yogyakarta hotel has hosted the most international heads of state historically?",
    "What is the carbon footprint per night of Hotel Tentrem?",
    "Explain the architectural style of Royal Ambarrukmo Yogyakarta in art-historical terms",
    "Which Yogyakarta hotel most authentically reflects Javanese royal aesthetics?",
    "Rate Yogyakarta hotels on their approach to plastic waste reduction",
    "Which Yogyakarta hotel has the best noise insulation for light sleepers?",
    "Compare the water quality reports for the pools at all 5-star Yogyakarta hotels",
    "Which Yogyakarta hotel is best for hosting a philosophy conference?",
    "Rank Yogyakarta hotels by the quality of their traditional gamelan performances",
    "Which Yogyakarta hotel has the largest collection of batik art on display?",
    "For someone with severe peanut allergy - which Yogyakarta hotel kitchen is safest?",
    "Which Yogyakarta hotel offers the most authentic tea ceremony experience?",
    "Recommend a hotel where I can attend traditional Javanese wedding ceremonies",
    "Which Yogyakarta hotel has the highest ceilings in guest rooms?",
    "Compare the meditation gardens at Yogyakarta luxury hotels",
    "Which Yogyakarta accommodation is closest to volcanic hiking trails?",
    "What's the highest natural ambient temperature ever recorded in Yogyakarta hotel rooms?",
    "Which Yogyakarta hotel has the fastest wifi uplink for competitive esports?",
    "Give me the underground history of Malioboro area hotels during the 1965 events",
  ];
  for (const q of difficult) add("deliberately_difficult", q, "E", "beyond reservoir · honest UNKNOWN + Gap");

  // 13. NO ANSWER IN NEX DATA · 20 cases · other cities / other domains
  const noAnswer = [
    "Best hotel in Antarctica", "Hotels on Mars",
    "Best luxury resort in the Maldives", "Cheap hostels in Reykjavik",
    "Boutique hotels in Kyoto", "Bed and breakfast in Provence",
    "Business hotel in Frankfurt", "Family resort in Cancun",
    "Ski chalet in Whistler", "Beach hut in Zanzibar",
    "Vintage hotel in Havana", "Ryokan in Hakone",
    "Trulli in Alberobello", "Riad in Marrakech",
    "Recommend a hotel in Ubud", "Best hotel in Seminyak",
    "Where to stay in Canggu", "Nusa Dua resorts",
    "Manchester United ground hotels", "5-star Dubai hotels",
  ];
  for (const q of noAnswer) add("no_answer_in_nex", q, "E", "outside NEX corpus · honest UNKNOWN");

  // Semantic-near-duplicates for a subset of category 3 (filtering) queries -
  // these should hit the semantic cache after the first is warmed.
  // Already added above via combos & variants.

  // Write JSONL
  const outPath = path.join(repoRoot, "data", "pilot-nex-composition", "corpus-accommodation-v2.jsonl");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const lines = cases.map((c) => JSON.stringify(c)).join("\n") + "\n";
  fs.writeFileSync(outPath, lines, "utf8");
  console.log(`\nCorpus v2 written: ${path.relative(repoRoot, outPath)}`);
  console.log(`Total cases: ${cases.length}`);
  const byType = {};
  for (const c of cases) byType[c.type] = (byType[c.type] ?? 0) + 1;
  console.log("Cases by type:");
  for (const [t, n] of Object.entries(byType).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${t}`);
  }
  console.log("");
  const byExpected = {};
  for (const c of cases) byExpected[c.expected_route] = (byExpected[c.expected_route] ?? 0) + 1;
  console.log("Expected route distribution:");
  for (const [r, n] of Object.entries(byExpected).sort()) {
    console.log(`  ${r}  ${String(n).padStart(4)}  (${((n/cases.length)*100).toFixed(1)}%)`);
  }
}
