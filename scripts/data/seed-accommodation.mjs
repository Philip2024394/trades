#!/usr/bin/env node
// seed-accommodation.mjs · category-level accommodation knowledge.
//
// This seed does NOT ship specific properties (names, phones, prices,
// hours) — those need real inventory (OSM / Traveloka / hand-curation)
// and the doctrine forbids fabricating facts personality can't verify.
//
// What it DOES ship: ~24 encyclopedic records that answer type/culture
// questions honestly:
//   · what is a kos-kosan / homestay / villa / penginapan
//   · how does the Indonesian hotel star rating work (melati vs bintang)
//   · which booking platforms Indonesians actually use
//   · regional lodging norms (Bali villas, Ubud homestays, Toraja
//     tongkonan, Yogya kraton-adjacent lodgings)
//   · homestay etiquette, foreign guest reporting norms
//
// Idempotent · re-run updates in place. Merges into knowledge-entities.json.
// Provenance: Tier B · walkerId=seed.accommodation.categories · freshness
// varies (long_lived for definitions, seasonal for regulatory notes).
//
// Run: npm run data:seed-accommodation

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__SEED_ACCOM_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __SEED_ACCOM_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { scoreEntity } = await import("../../src/lib/nex/indonesia/data/quality.ts");
  const { stampVerified } = await import("../../src/lib/nex/indonesia/data/freshness.ts");

  const entFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
  const existing = existsSync(entFile) ? JSON.parse(readFileSync(entFile, "utf8")) : { entities: [] };
  const byId = new Map(existing.entities.map((e) => [e.id, e]));
  const now = new Date();
  const nowIso = now.toISOString();
  const emitted = [];

  const provenance = (walker) => ([{
    walkerId: walker,
    sourceKey: "nex.seed.accommodation",
    sourceName: "NEX Seed · Accommodation Category Knowledge",
    sourceTier: "B",
    market: "ID",
    firstDiscoveredAt: nowIso, lastCheckedAt: nowIso,
    lastChangedAt: nowIso, observedAt: nowIso,
  }]);

  const mk = (spec) => {
    const record = {
      id: spec.id,
      kind: "knowledge",
      category: spec.category ?? "accommodation",
      name: spec.name,
      description: spec.description,
      keywords: uniq(spec.keywords ?? []),
      lifecycle: "PUBLISHED",
      lifecycleChangedAt: nowIso,
      provenance: provenance(spec.walker ?? "seed.accommodation.categories"),
      freshness: stampVerified(spec.freshness ?? "long_lived", now),
      geo: spec.geo,
      attributes: {
        legacyTopic: spec.topic,
        legacyConfidence: spec.confidence ?? 0.9,
        ...(spec.attributes ?? {}),
      },
    };
    record.quality = scoreEntity(record, now);
    return record;
  };

  const RECORDS = [
    // ─── LODGING TYPES · one record per type ───
    mk({
      id: "accommodation:type:hotel",
      topic: "accommodation.type.hotel",
      name: "Hotel",
      description:
        "Hotels in Indonesia range from budget properties to international 5-star chains, rated on the bintang (star) system 1-5. Business hotels cluster in Jakarta CBD (SCBD, Sudirman, Thamrin) and provincial capitals; resort hotels dominate Bali, Lombok, and Bintan. Foreign guests must present a passport at check-in and are usually reported to local authorities as part of the hotel registration.",
      keywords: ["hotel", "bintang", "resort", "check-in", "star rating"],
    }),
    mk({
      id: "accommodation:type:guesthouse",
      topic: "accommodation.type.guesthouse",
      name: "Guesthouse",
      description:
        "A guesthouse is a small owner-operated lodging, usually 5-20 rooms, common in tourist areas (Ubud, Canggu, Yogyakarta, Lombok). More personal than a hotel, often includes breakfast, and the host or family is typically on site. Prices sit between backpacker hostels and mid-range hotels.",
      keywords: ["guesthouse", "guest house", "wisma", "family run", "small hotel"],
    }),
    mk({
      id: "accommodation:type:homestay",
      topic: "accommodation.type.homestay",
      name: "Homestay",
      description:
        "A homestay places you inside a local family's compound or a room adjoining their house. Common in Ubud (Bali), Yogyakarta, Toraja, Lombok villages, and many rural cultural destinations. Expect shared meals with the host family, informal cultural exchange, and modest facilities. It is the traditional Indonesian lodging alongside larger hotels and is often the cheapest way to stay in a village.",
      keywords: ["homestay", "family stay", "penginapan keluarga", "cultural stay"],
      attributes: { typical_price_band: "budget_to_mid" },
    }),
    mk({
      id: "accommodation:type:villa",
      topic: "accommodation.type.villa",
      name: "Villa",
      description:
        "A villa is a private house — one to many bedrooms, often with pool and staff — rented as a single unit. Villas dominate the Bali market (Seminyak, Canggu, Umalas, Ubud outskirts, Uluwatu), and appear in Lombok, Yogyakarta hills, and North Sulawesi. Booking is typically per property per night, minimum-night rules common in peak season.",
      keywords: ["villa", "private villa", "vila", "pool villa"],
    }),
    mk({
      id: "accommodation:type:penginapan",
      topic: "accommodation.type.penginapan",
      name: "Penginapan",
      description:
        "Penginapan is the Indonesian umbrella term for basic budget lodging — smaller and cheaper than a hotel, typically fan-cooled or basic AC, sometimes shared bathrooms. Found near bus terminals, ferry ports, small towns, and pilgrimage sites. Standards vary widely; personal inspection before booking is common practice.",
      keywords: ["penginapan", "budget lodging", "basic hotel"],
      attributes: { typical_price_band: "budget" },
    }),
    mk({
      id: "accommodation:type:kos-kosan",
      topic: "accommodation.type.kos_kosan",
      name: "Kos-kosan",
      description:
        "Kos-kosan (often shortened to kos) is monthly-rented boarding-house accommodation, aimed at students, workers, and long-stay visitors. Rooms are private, common areas usually shared. Rent is typically paid per month rather than per night. Increasingly used by long-stay digital nomads in Bali, Yogyakarta, and Bandung.",
      keywords: ["kos", "kos-kosan", "kost", "boarding house", "monthly rental", "long stay"],
      attributes: { typical_price_band: "budget_to_mid", billing_cycle: "monthly" },
    }),
    mk({
      id: "accommodation:type:hostel",
      topic: "accommodation.type.hostel",
      name: "Hostel",
      description:
        "Hostels — dormitory-style shared rooms plus some private rooms — cluster in backpacker districts: Kuta and Canggu (Bali), Prawirotaman and Sosrowijayan (Yogyakarta), Gili Trawangan, and along the Sumatra overland route. Common bookings via Hostelworld, Agoda, or direct.",
      keywords: ["hostel", "dorm", "backpacker", "shared room"],
    }),

    // ─── STAR RATING · melati vs bintang ───
    mk({
      id: "accommodation:rating:melati_bintang",
      topic: "accommodation.rating.melati_bintang",
      name: "Hotel star ratings (melati vs bintang)",
      description:
        "Indonesian hotels are historically categorised into two tiers: melati (jasmine · non-star / budget) and bintang (star, 1-5). Melati properties are typically small, family-run, and priced below bintang 1. Bintang ratings are assigned by the Ministry of Tourism / PHRI (hotel association) and roughly track international star norms, though inspection frequency varies.",
      keywords: ["melati", "bintang", "star rating", "phri", "hotel rating"],
    }),

    // ─── BOOKING PLATFORMS ───
    mk({
      id: "accommodation:platform:traveloka",
      topic: "accommodation.platform.traveloka",
      name: "Traveloka (booking platform)",
      description:
        "Traveloka is Indonesia's largest domestic online travel agent, covering hotels, flights, trains, buses, attractions, and Xperience packages. It has the strongest domestic hotel inventory (kos-kosan and small guesthouses that international OTAs don't list). Pays in IDR by default; QRIS and Indonesian bank transfer supported.",
      keywords: ["traveloka", "ota", "booking platform", "domestic booking"],
      freshness: "seasonal",
    }),
    mk({
      id: "accommodation:platform:tiket",
      topic: "accommodation.platform.tiket",
      name: "tiket.com (booking platform)",
      description:
        "tiket.com is a major Indonesian OTA, second-largest after Traveloka. Strong on domestic flights and hotels including regional properties. Offers rewards ('tiket Points') and IDR-denominated pricing. Native Bahasa Indonesia interface with English available.",
      keywords: ["tiket.com", "tiket", "ota"],
      freshness: "seasonal",
    }),
    mk({
      id: "accommodation:platform:agoda",
      topic: "accommodation.platform.agoda",
      name: "Agoda (booking platform)",
      description:
        "Agoda (part of Booking Holdings) is the dominant international OTA for Asia-Pacific hotels and one of the most-used platforms for foreign visitors booking Indonesian properties. Strong Bali and Java coverage. Prices shown in the user's chosen currency.",
      keywords: ["agoda", "ota", "international booking"],
      freshness: "seasonal",
    }),
    mk({
      id: "accommodation:platform:booking_com",
      topic: "accommodation.platform.booking_com",
      name: "Booking.com (booking platform)",
      description:
        "Booking.com is widely used in Indonesia for hotels, apartments, and villas. Reliable for international traveller expectations (English support, familiar cancellation policies). Coverage is deep in Bali, Jakarta, and Yogyakarta; thinner in eastern Indonesia.",
      keywords: ["booking.com", "booking", "international ota"],
      freshness: "seasonal",
    }),
    mk({
      id: "accommodation:platform:airbnb",
      topic: "accommodation.platform.airbnb",
      name: "Airbnb (booking platform)",
      description:
        "Airbnb is common in Indonesia for villas, apartments, and homestays — especially in Bali, Jakarta, Yogyakarta, and Bandung. Local regulations vary: some regencies restrict short-term letting in residential zones, and Bali has periodically discussed tighter enforcement. Verify the property's legal short-let status before long bookings.",
      keywords: ["airbnb", "short let", "vacation rental", "vila"],
      freshness: "seasonal",
    }),

    // ─── REGIONAL LODGING NORMS ───
    mk({
      id: "accommodation:regional:bali_villas",
      topic: "accommodation.regional.bali_villas",
      name: "Bali villa culture",
      description:
        "Villa rental is the dominant mid-to-upper accommodation format in Bali. Seminyak, Canggu, Umalas, Uluwatu, Ubud outskirts, and North Bali all have deep villa inventory. Typical package: private house + pool + kitchen + daily housekeeping + optional cook. Minimum-night rules (2-5 nights) apply in high season (July-August, December-January).",
      keywords: ["bali", "villa", "seminyak", "canggu", "uluwatu", "ubud", "umalas"],
      geo: { province: "bali", island: "Bali" },
    }),
    mk({
      id: "accommodation:regional:ubud_homestays",
      topic: "accommodation.regional.ubud_homestays",
      name: "Ubud homestays and boutique lodges",
      description:
        "Ubud (central Bali) is the traditional homestay heartland — Balinese family compounds renting rooms alongside their household temple, often with breakfast and cultural context. Also home to a large boutique-lodge and jungle-resort segment (Sayan, Payangan, Tegallalang). Rice-terrace views are the premium factor.",
      keywords: ["ubud", "homestay", "boutique", "jungle resort", "sayan", "payangan", "tegallalang"],
      geo: { province: "bali", regency: "gianyar", island: "Bali" },
    }),
    mk({
      id: "accommodation:regional:toraja_tongkonan",
      topic: "accommodation.regional.toraja_tongkonan",
      name: "Toraja tongkonan and traditional homestays",
      description:
        "In Tana Toraja (South Sulawesi), some traditional tongkonan (ancestral houses with distinctive boat-shaped roofs) accept overnight guests, and many family homestays operate in Rantepao and surrounding villages. This is a cultural lodging experience rather than a hospitality product; expect basic amenities and rich cultural exchange.",
      keywords: ["toraja", "tana toraja", "tongkonan", "rantepao", "homestay"],
      geo: { province: "sulawesi-selatan", regency: "tana toraja", island: "Sulawesi" },
    }),
    mk({
      id: "accommodation:regional:yogya_kraton",
      topic: "accommodation.regional.yogya_kraton",
      name: "Yogyakarta kraton-adjacent lodgings",
      description:
        "Yogyakarta's lodging clusters include Prawirotaman (backpacker + boutique), Sosrowijayan (budget alley near Malioboro), and the kraton-adjacent kampung with heritage guesthouses. Boutique heritage hotels occupy former colonial and royal buildings in the Kotagede and kraton areas.",
      keywords: ["yogyakarta", "jogja", "prawirotaman", "sosrowijayan", "malioboro", "kraton", "kotagede"],
      geo: { province: "di-yogyakarta", island: "Java" },
    }),
    mk({
      id: "accommodation:regional:jakarta_business",
      topic: "accommodation.regional.jakarta_business",
      name: "Jakarta business-hotel districts",
      description:
        "Jakarta's business-hotel inventory concentrates in the SCBD, Sudirman, Thamrin, and Kuningan corridors, with international chains including Ritz-Carlton, Grand Hyatt, Fairmont, Mandarin Oriental, and Four Seasons. Mid-market properties spread through South Jakarta (Kemang, Blok M). Airport hotels cluster at Soekarno-Hatta.",
      keywords: ["jakarta", "scbd", "sudirman", "thamrin", "kuningan", "kemang", "soekarno-hatta", "cgk", "business hotel"],
      geo: { province: "dki-jakarta", island: "Java" },
    }),
    mk({
      id: "accommodation:regional:eastern_indonesia_rural",
      topic: "accommodation.regional.eastern_indonesia_rural",
      name: "Eastern Indonesia rural lodging",
      description:
        "In remote destinations — Sumba, Flores interior, Alor, Raja Ampat homestays, Baliem Valley — accommodation is typically small family-run homestays or a handful of guesthouses. Cash is often needed (no card acceptance), power may be limited or scheduled, and booking is often WhatsApp direct rather than online OTA. Confirm access logistics before travel.",
      keywords: ["sumba", "flores", "alor", "raja ampat", "baliem", "papua", "rural homestay", "remote"],
    }),

    // ─── ETIQUETTE + PRACTICAL ───
    mk({
      id: "accommodation:etiquette:homestay",
      topic: "accommodation.etiquette.homestay",
      name: "Homestay etiquette",
      description:
        "Homestay etiquette: remove shoes at the door, greet the host family, use the right hand when giving or receiving anything, dress modestly around common areas, ask before entering household shrines or family temples, tell the host if you will miss a shared meal. A small gift for the family (fruit, snacks, or something from your home country) is appreciated on longer stays.",
      keywords: ["homestay", "etiquette", "manners", "cultural respect", "shoes", "right hand"],
    }),
    mk({
      id: "accommodation:practical:foreign_guest_reporting",
      topic: "accommodation.practical.foreign_guest_reporting",
      name: "Foreign guest reporting (STM/hotel registration)",
      description:
        "Hotels are legally required to report foreign guests to local immigration. Passports are collected at check-in and returned promptly; passport data is submitted electronically. Homestays and unregistered rentals in some areas may ask the guest to register at the local RT/RW office directly; this is normal and takes a few minutes.",
      keywords: ["foreign guest", "registration", "passport", "immigration", "rt/rw", "stm"],
    }),
    mk({
      id: "accommodation:practical:payment_deposit",
      topic: "accommodation.practical.payment_deposit",
      name: "Accommodation payment norms",
      description:
        "International hotels take card at check-in with a deposit hold (Visa/Mastercard/Amex). Domestic OTAs accept QRIS, GoPay, OVO, ShopeePay, bank transfer (BCA/Mandiri/BNI/BRI), and virtual account. Direct-booked homestays and villas often prefer bank transfer or cash on arrival. Ask for a receipt (bukti pembayaran) for anything paid in cash.",
      keywords: ["payment", "qris", "gopay", "ovo", "bank transfer", "cash", "deposit", "bukti pembayaran"],
    }),
    mk({
      id: "accommodation:practical:booking_channels",
      topic: "accommodation.practical.booking_channels",
      name: "How Indonesians actually book accommodation",
      description:
        "Domestic booking behaviour: Traveloka and tiket.com dominate for hotels and flights; Booking.com and Agoda are more common for foreign visitors; Airbnb covers villas and apartments; WhatsApp direct booking is normal for homestays, small guesthouses, and remote destinations. Traveloka often has the best domestic hotel coverage and QRIS/local-payment support.",
      keywords: ["booking", "traveloka", "tiket.com", "agoda", "booking.com", "airbnb", "whatsapp direct"],
    }),
  ];

  for (const rec of RECORDS) {
    const existed = byId.has(rec.id);
    byId.set(rec.id, rec);
    emitted.push({ rec, existed });
  }

  const allEntities = [...byId.values()];
  const out = {
    generatedAt: nowIso,
    schemaVersion: 1,
    count: allEntities.length,
    entities: allEntities,
  };
  mkdirSync(path.dirname(entFile), { recursive: true });
  const tmp = entFile + ".tmp";
  writeFileSync(tmp, JSON.stringify(out, null, 2) + "\n");
  renameSync(tmp, entFile);

  const totalEmitted = emitted.length;
  const totalNew = emitted.filter((e) => !e.existed).length;
  const hiQ = emitted.filter((e) => (e.rec.quality?.overall ?? 0) >= 0.7).length;

  console.log(`\n═════════════ SEED ACCOMMODATION REPORT ═════════════`);
  console.log(`Records emitted:   ${totalEmitted}  (new: ${totalNew} · updated: ${totalEmitted - totalNew})`);
  console.log(`Quality ≥ 0.7:     ${hiQ} / ${totalEmitted}`);
  console.log(`Total corpus:      ${allEntities.length} entities`);
  console.log(`Written:           ${path.relative(repoRoot, entFile)}`);
  console.log(`═══════════════════════════════════════════════════════\n`);
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}
