#!/usr/bin/env node
// seed-food.mjs · category-level food knowledge (Phase 2 · food).
//
// Same discipline as seed-accommodation.mjs · encyclopedic knowledge
// only, no fabricated businesses, prices, addresses, or availability.
// Deliberately avoids re-writing the 20 existing legacy food.* dish
// records (nasi goreng, rendang, gudeg, etc.) · adds coverage the
// legacy set does not have:
//
//   · 12 regional cuisines (Padang, Manado, Sundanese, ...)
//   · 5 street-food formats (kaki lima, warteg, angkringan, ...)
//   · 8 signature dishes not yet covered (tempeh, tahu, coto, ...)
//   · 8 ingredients / building blocks (sambal, kecap manis, ...)
//   · 4 food etiquette + culture records
//
// Idempotent. Merges into knowledge-entities.json.
// Provenance: Tier B · walkerId=seed.food.categories · long_lived.
//
// Run: npm run data:seed-food

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__SEED_FOOD_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __SEED_FOOD_INNER__: "1" } },
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

  const mk = (spec) => {
    const record = {
      id: spec.id,
      kind: "knowledge",
      category: spec.category ?? "food",
      name: spec.name,
      description: spec.description,
      keywords: uniq(spec.keywords ?? []),
      lifecycle: "PUBLISHED",
      lifecycleChangedAt: nowIso,
      provenance: [{
        walkerId: spec.walker ?? "seed.food.categories",
        sourceKey: "nex.seed.food",
        sourceName: "NEX Seed · Food Category Knowledge",
        sourceTier: "B",
        market: "ID",
        firstDiscoveredAt: nowIso, lastCheckedAt: nowIso,
        lastChangedAt: nowIso, observedAt: nowIso,
      }],
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
    // ─── 12 REGIONAL CUISINES ────────────────────────────────────
    mk({
      id: "food:cuisine:padang", topic: "food.cuisine.padang", name: "Padang cuisine (Minangkabau)",
      description:
        "Padang / Minangkabau cuisine originates in West Sumatra and is Indonesia's most-recognised regional cuisine, served nasi Padang-style: many small dishes pre-cooked and displayed, you eat what you touch and pay for. Signature techniques: slow-braised rendang, kalio (short-cooked rendang), gulai (coconut-milk curry). Bold use of chili, coconut milk, and dried spices. Every rumah makan Padang across Indonesia inherits this tradition.",
      keywords: ["padang", "minangkabau", "minang", "west sumatra", "rendang", "gulai", "kalio", "rumah makan padang", "sumatra"],
      geo: { province: "sumatera-barat", island: "Sumatra" },
    }),
    mk({
      id: "food:cuisine:manado", topic: "food.cuisine.manado", name: "Manado cuisine (Minahasa)",
      description:
        "Manado / Minahasa cuisine from North Sulawesi is Indonesia's fieriest — heavy use of rica-rica (bird's-eye chili paste), pandan, and unusual proteins (fish, forest game). Signature dishes: ayam rica-rica, tinutuan (Manado porridge with vegetables), cakalang fufu (smoked skipjack tuna), paniki (bat, in traditional contexts). Non-halal is common here (Christian-majority region).",
      keywords: ["manado", "minahasa", "north sulawesi", "sulawesi", "rica-rica", "tinutuan", "cakalang", "spicy", "chili"],
      geo: { province: "sulawesi-utara", island: "Sulawesi" },
    }),
    mk({
      id: "food:cuisine:sundanese", topic: "food.cuisine.sundanese", name: "Sundanese cuisine (West Java)",
      description:
        "Sundanese cuisine from West Java features raw and lightly-cooked vegetables (lalapan), sambal terasi, freshwater fish, and grilled chicken (ayam bakar). Rice is central. Signature: nasi timbel (rice steamed in banana leaf), karedok (raw vegetable salad with peanut sauce), pepes (banana-leaf steamed fish/tofu). Portions are shared communally · eating with hands is normal.",
      keywords: ["sundanese", "sunda", "west java", "bandung", "lalapan", "sambal terasi", "nasi timbel", "karedok", "pepes"],
      geo: { province: "jawa-barat", island: "Java" },
    }),
    mk({
      id: "food:cuisine:javanese", topic: "food.cuisine.javanese", name: "Javanese cuisine (Central & East Java)",
      description:
        "Central Javanese cuisine (Yogyakarta, Solo, Semarang) tends sweet — palm sugar, kecap manis, and slow braises define gudeg, semur, and opor. East Javanese cuisine (Surabaya, Malang) is sharper and saltier · rawon (black nut beef soup), rujak cingur, and pecel. Rice is the base of every meal; kerupuk (crackers) accompany almost everything.",
      keywords: ["javanese", "central java", "east java", "yogyakarta", "solo", "surabaya", "sweet", "palm sugar", "kecap manis"],
      geo: { island: "Java" },
    }),
    mk({
      id: "food:cuisine:betawi", topic: "food.cuisine.betawi", name: "Betawi cuisine (Jakarta)",
      description:
        "Betawi cuisine is Jakarta's native tradition, blending Malay, Chinese, Arab, Dutch, and Indian influences over centuries. Signature dishes: kerak telor (rice-egg omelette cooked over charcoal), soto Betawi (beef offal soup with coconut milk), asinan (pickled vegetables), gado-gado. Increasingly rare in modern Jakarta · surfaces mostly at markets, festivals, and heritage restaurants.",
      keywords: ["betawi", "jakarta", "kerak telor", "soto betawi", "asinan", "orang betawi", "heritage"],
      geo: { province: "dki-jakarta", island: "Java" },
    }),
    mk({
      id: "food:cuisine:aceh", topic: "food.cuisine.aceh", name: "Aceh cuisine (Northern Sumatra)",
      description:
        "Acehnese cuisine reflects deep Indian, Arab, and Malay trade heritage · heavy use of curry spices, ghee, and rich meat stews. Signature dishes: mie Aceh (spiced noodles with beef/seafood), kari kambing (goat curry), roti canai, keumamah (dried tuna). Halal is strict (Aceh applies Sharia). Coffee culture is deep · kopi Aceh (Gayo) is one of Indonesia's most famous single-origins.",
      keywords: ["aceh", "acehnese", "mie aceh", "kari kambing", "keumamah", "gayo", "kopi aceh", "coffee", "sumatra"],
      geo: { province: "aceh", island: "Sumatra" },
    }),
    mk({
      id: "food:cuisine:palembang", topic: "food.cuisine.palembang", name: "Palembang cuisine (South Sumatra)",
      description:
        "Palembang cuisine centres on freshwater fish (particularly tenggiri / Spanish mackerel) processed into pempek (fried fish-cake), tekwan (fish-ball soup), and model. Pempek is served with cuko · a dark, sour-hot sauce of palm sugar, vinegar, and chili. Mie celor (thick coconut-milk noodle) is another Palembang signature.",
      keywords: ["palembang", "south sumatra", "pempek", "tekwan", "cuko", "mie celor", "tenggiri", "fish cake"],
      geo: { province: "sumatera-selatan", island: "Sumatra" },
    }),
    mk({
      id: "food:cuisine:balinese", topic: "food.cuisine.balinese", name: "Balinese cuisine",
      description:
        "Balinese cuisine (as distinct from tourist-oriented Bali food) revolves around base genep (a spice paste of turmeric, galangal, ginger, garlic, shallot, chilli). Ceremonial dishes include babi guling (spit-roast suckling pig) and bebek betutu (leaf-wrapped slow-roasted duck). Non-halal is normal because Bali is Hindu-majority. Daily food is heavily rice + vegetables + sambal.",
      keywords: ["balinese", "bali", "base genep", "babi guling", "bebek betutu", "spice paste", "hindu", "ceremonial"],
      geo: { province: "bali", island: "Bali" },
    }),
    mk({
      id: "food:cuisine:batak", topic: "food.cuisine.batak", name: "Batak cuisine (North Sumatra)",
      description:
        "Batak cuisine from North Sumatra's Lake Toba region uses andaliman (Sichuan-like citrus pepper), garlic, and ginger heavily. Signature dishes: saksang (pork stewed in blood and spices), arsik (spiced carp), naniura (raw fish 'cooked' in lime and andaliman). Batak Toba tradition is non-halal; Mandailing Batak cuisine is halal.",
      keywords: ["batak", "north sumatra", "toba", "andaliman", "saksang", "arsik", "naniura", "medan"],
      geo: { province: "sumatera-utara", island: "Sumatra" },
    }),
    mk({
      id: "food:cuisine:torajan", topic: "food.cuisine.torajan", name: "Torajan cuisine (South Sulawesi highlands)",
      description:
        "Torajan cuisine from the Tana Toraja highlands features pa'piong · meat and vegetables cooked inside bamboo tubes over open fire. Buffalo, pork, and chicken are used ceremonially. Local coffee and rice (Toraja terraced rice) are staples. Cuisine is tied closely to funeral and family ceremonies · Torajan food culture cannot be separated from its ritual context.",
      keywords: ["toraja", "torajan", "tana toraja", "south sulawesi", "pa'piong", "papiong", "bamboo", "buffalo", "ceremonial"],
      geo: { province: "sulawesi-selatan", island: "Sulawesi" },
    }),
    mk({
      id: "food:cuisine:melayu", topic: "food.cuisine.melayu", name: "Melayu / Malay cuisine (Riau, Sumatra east coast)",
      description:
        "Melayu cuisine (Riau, Riau Islands, coastal East Sumatra) shares heritage with Peninsular Malay cooking · asam pedas (sour-spicy fish stew), gulai ikan, nasi lemak, roti canai/paratha. Seafood-heavy given coastal geography. Strong Indian-Muslim (mamak) influence in port cities.",
      keywords: ["melayu", "malay", "riau", "riau islands", "asam pedas", "nasi lemak", "roti canai", "gulai ikan"],
      geo: { island: "Sumatra" },
    }),
    mk({
      id: "food:cuisine:banjar", topic: "food.cuisine.banjar", name: "Banjar cuisine (South Kalimantan)",
      description:
        "Banjar cuisine from South Kalimantan (Banjarmasin) is river-food-heavy · soto Banjar (spiced chicken soup with rice cakes), ketupat Kandangan (rice cakes in fish gravy), nasi kuning Banjar (yellow rice with haruan fish). Distinctive use of freshwater fish, coconut milk, and mild spice.",
      keywords: ["banjar", "banjarmasin", "south kalimantan", "kalimantan", "soto banjar", "ketupat kandangan", "haruan", "freshwater fish"],
      geo: { province: "kalimantan-selatan", island: "Kalimantan" },
    }),

    // ─── 5 STREET-FOOD FORMATS ───────────────────────────────────
    mk({
      id: "food:street:kaki_lima", topic: "food.street.kaki_lima", name: "Kaki lima (five-foot pushcart)",
      description:
        "Kaki lima literally 'five feet' (three cart wheels + two vendor feet) describes wheeled street-food carts you see everywhere in Indonesia. Each vendor typically sells ONE thing very well · bakso, sate, mie ayam, martabak, es kelapa. Vendors rotate through neighbourhoods on a daily circuit; regular customers know their times. Cash-preferred, though QRIS is spreading.",
      keywords: ["kaki lima", "street food", "cart", "pushcart", "keliling", "vendor", "qris"],
    }),
    mk({
      id: "food:street:warung_tenda", topic: "food.street.warung_tenda", name: "Warung tenda (tented stall)",
      description:
        "Warung tenda are temporary tent-roofed food stalls set up along roadsides in the evening. Typical offerings: nasi goreng, mie goreng, ayam bakar, seafood. Same menu across a district often means all stalls source from the same wholesale supplier. Popular after 6pm, cheap, cash-only historically, QRIS increasingly.",
      keywords: ["warung tenda", "tenda", "tent stall", "roadside", "evening", "malam", "night food"],
    }),
    mk({
      id: "food:street:angkringan", topic: "food.street.angkringan", name: "Angkringan (Yogya/Solo street cart)",
      description:
        "Angkringan is a Yogyakarta/Solo street format · a small kerosene-lamp-lit cart selling nasi kucing (tiny rice portions), skewered snacks, and hot drinks. Sit on wooden benches around the cart. Cheap, communal, popular late-evening among students. Signature drink: wedang jahe (hot ginger).",
      keywords: ["angkringan", "yogyakarta", "jogja", "solo", "nasi kucing", "wedang jahe", "street cart", "kerosene"],
      geo: { island: "Java" },
    }),
    mk({
      id: "food:street:warteg", topic: "food.street.warteg", name: "Warteg (Warung Tegal)",
      description:
        "Warteg (Warung Tegal) is a chain-independent format of small workers' restaurants originating with migrants from Tegal (Central Java). Display of pre-cooked dishes behind glass; you point, they plate over rice. Cheap, filling, ubiquitous in Jakarta and industrial cities. Menu rotates daily · fish, tempeh, tofu, vegetables, eggs are standard.",
      keywords: ["warteg", "warung tegal", "tegal", "workers restaurant", "prasmanan", "point and eat", "jakarta"],
    }),
    mk({
      id: "food:street:pedagang_keliling", topic: "food.street.pedagang_keliling", name: "Pedagang keliling (roving vendors)",
      description:
        "Pedagang keliling are itinerant vendors who walk or push carts through residential streets calling out or making a signature sound · bakso vendor rings a bell, ice cream vendor plays a tune, roti bakar vendor knocks. Regular schedules; households know 'the bakso guy comes at 5pm'. A quintessential part of Indonesian neighbourhood soundscape.",
      keywords: ["pedagang keliling", "keliling", "roving vendor", "itinerant", "bakso", "neighbourhood", "kampung"],
    }),

    // ─── 8 SIGNATURE DISHES NOT YET COVERED ──────────────────────
    mk({
      id: "food:dish:tempeh", topic: "food.dish.tempeh", name: "Tempeh (tempe)",
      description:
        "Tempeh is a fermented soybean cake originating in Java, dating back centuries. Whole soybeans are cultured with Rhizopus mold that binds them into a firm, sliceable cake. Prepared by frying (tempe goreng), stewing (semur tempe), or spicing (tempe orek). One of Indonesia's most-recognised food exports · widely used in vegetarian cooking globally.",
      keywords: ["tempeh", "tempe", "fermented", "soybean", "vegetarian", "protein", "java", "tempe goreng"],
    }),
    mk({
      id: "food:dish:tahu", topic: "food.dish.tahu", name: "Tahu (Indonesian tofu)",
      description:
        "Tahu (Indonesian tofu) is a staple protein used across regional cuisines. Common preparations: tahu goreng (fried), tahu isi (stuffed with vegetables), tahu petis (with fermented shrimp paste, Surabaya), tahu bacem (sweet-soy stewed, Central Java). Often served alongside tempeh in a two-protein plate.",
      keywords: ["tahu", "tofu", "protein", "tahu goreng", "tahu isi", "tahu petis", "tahu bacem"],
    }),
    mk({
      id: "food:dish:coto_makassar", topic: "food.dish.coto_makassar", name: "Coto Makassar",
      description:
        "Coto Makassar is a rich beef and offal soup from South Sulawesi, seasoned with kluwek (candlenut), lemongrass, and ground peanuts. Served with ketupat (compressed rice cakes) or buras (banana-leaf rice). Traditional accompaniment: sambal tauco and fresh lime.",
      keywords: ["coto", "coto makassar", "makassar", "south sulawesi", "beef", "offal", "kluwek", "ketupat"],
      geo: { province: "sulawesi-selatan", island: "Sulawesi" },
    }),
    mk({
      id: "food:dish:rawon", topic: "food.dish.rawon", name: "Rawon",
      description:
        "Rawon is an East Javanese black beef soup, its distinctive dark colour from kluwek (Pangium edule nuts fermented and ground). Served with rice, sprouted mung beans (tauge), salted egg, and sambal. Surabaya is the spiritual home. Considered one of the world's oldest continuously-prepared dishes.",
      keywords: ["rawon", "east java", "surabaya", "beef soup", "kluwek", "black soup", "tauge"],
      geo: { province: "jawa-timur", island: "Java" },
    }),
    mk({
      id: "food:dish:ketoprak", topic: "food.dish.ketoprak", name: "Ketoprak",
      description:
        "Ketoprak is a Jakarta/Betawi street dish: rice vermicelli, tofu, and bean sprouts topped with a garlicky peanut sauce, fried shallots, and kerupuk (crackers). Vegetarian by default. Sold from pushcarts across the city; each vendor's peanut sauce recipe is their signature.",
      keywords: ["ketoprak", "jakarta", "betawi", "peanut sauce", "vermicelli", "tofu", "bean sprouts", "vegetarian"],
      geo: { province: "dki-jakarta", island: "Java" },
    }),
    mk({
      id: "food:dish:nasi_uduk", topic: "food.dish.nasi_uduk", name: "Nasi uduk",
      description:
        "Nasi uduk is Jakarta-Betawi coconut-milk rice, mild and fragrant, served with fried chicken, egg, tempeh, and sambal. Breakfast staple across Java and Sumatra. Related to nasi lemak (Malaysia) · both share the coconut-milk rice technique.",
      keywords: ["nasi uduk", "coconut rice", "jakarta", "betawi", "breakfast", "nasi lemak"],
      geo: { province: "dki-jakarta", island: "Java" },
    }),
    mk({
      id: "food:dish:pisang_goreng", topic: "food.dish.pisang_goreng", name: "Pisang goreng",
      description:
        "Pisang goreng · deep-fried banana in crisp batter · is Indonesia's most universal snack. Sold from kaki lima carts, warungs, and airport lounges. Best made with pisang kepok or pisang raja (starchy cooking bananas). Sometimes served with grated cheese and condensed milk in modern versions.",
      keywords: ["pisang goreng", "fried banana", "snack", "pisang kepok", "pisang raja"],
    }),
    mk({
      id: "food:dish:es_cendol", topic: "food.dish.es_cendol", name: "Es cendol",
      description:
        "Es cendol is a Sundanese-origin dessert drink: green rice-flour jelly worms, coconut milk, palm sugar syrup, and shaved ice. Also called es dawet in Central Java. Ubiquitous during Ramadan iftar (buka puasa) as a sweet cool refreshment.",
      keywords: ["es cendol", "cendol", "dawet", "sundanese", "palm sugar", "coconut milk", "ramadan", "iftar", "dessert drink"],
      geo: { island: "Java" },
    }),

    // ─── 8 INGREDIENTS / BUILDING BLOCKS ─────────────────────────
    mk({
      id: "food:ingredient:sambal", topic: "food.ingredient.sambal", name: "Sambal (chili condiment family)",
      description:
        "Sambal is not one condiment but a large family: sambal terasi (with fermented shrimp paste), sambal matah (raw Balinese chili-shallot-lemongrass), sambal ijo (green chili, Padang style), sambal bajak (cooked, Central Java), sambal roa (smoked-fish sambal, Manado), sambal kecap (sweet-soy chili). Every household and warung has its own recipe.",
      keywords: ["sambal", "chili", "condiment", "terasi", "matah", "ijo", "bajak", "roa", "kecap", "cabe"],
    }),
    mk({
      id: "food:ingredient:kecap_manis", topic: "food.ingredient.kecap_manis", name: "Kecap manis (sweet soy sauce)",
      description:
        "Kecap manis is Indonesian sweet soy sauce · palm sugar reduced with fermented soy sauce, thick and molasses-like. Foundation of nasi goreng, sate marinade, semur, and countless dressings. Brands (Bango, ABC) are recognisable everywhere. Distinct from Chinese-style light or dark soy · always sweet.",
      keywords: ["kecap manis", "sweet soy sauce", "palm sugar", "bango", "abc", "nasi goreng", "sate"],
    }),
    mk({
      id: "food:ingredient:terasi", topic: "food.ingredient.terasi", name: "Terasi (fermented shrimp paste)",
      description:
        "Terasi (or belacan, Malay-region) is fermented shrimp paste · pungent when raw, umami-rich when toasted. Central to sambal terasi, base for many curries, and the depth-of-flavour secret in Padang and Sundanese cooking. Sold in solid blocks; small amount used per dish.",
      keywords: ["terasi", "belacan", "shrimp paste", "fermented", "sambal", "umami"],
    }),
    mk({
      id: "food:ingredient:santan", topic: "food.ingredient.santan", name: "Santan (coconut milk)",
      description:
        "Santan · coconut milk pressed from grated fresh coconut · is the primary cooking fat and enrichment across Indonesian cuisines. Thin santan for gulai, thick for rendang and opor. Fresh santan (santan kelapa segar) is preferred; packaged UHT santan is convenient but flavor is thinner.",
      keywords: ["santan", "coconut milk", "gulai", "opor", "rendang", "coconut"],
    }),
    mk({
      id: "food:ingredient:kluwek", topic: "food.ingredient.kluwek", name: "Kluwek / keluak (black nut)",
      description:
        "Kluwek (Pangium edule) is a large black nut, toxic raw but rendered safe by weeks of fermentation in ash or mud. Produces the deep black colour and earthy flavour of rawon and coto Makassar. Unique to Southeast Asia; no substitute reproduces its taste.",
      keywords: ["kluwek", "keluak", "pangium", "black nut", "rawon", "coto", "fermented"],
    }),
    mk({
      id: "food:ingredient:aromatics", topic: "food.ingredient.aromatics", name: "Indonesian aromatics (daun jeruk, serai, laos, salam)",
      description:
        "Core Indonesian aromatics: daun jeruk purut (kaffir lime leaves), serai (lemongrass, bruised at the base), laos (galangal, similar to ginger but pinier), daun salam (Indonesian bay leaf), kemiri (candlenut, toasted). These form the flavour spine of most gulai and soto.",
      keywords: ["daun jeruk", "serai", "lemongrass", "laos", "galangal", "daun salam", "kemiri", "candlenut", "aromatics"],
    }),
    mk({
      id: "food:ingredient:rice_types", topic: "food.ingredient.rice_types", name: "Indonesian rice (nasi) types",
      description:
        "Rice varieties in Indonesia: nasi putih (plain white, everyday), nasi uduk (coconut-milk), nasi kuning (turmeric-yellow, ceremonial), nasi liwet (rice cooked in coconut milk with aromatics, Solo/Sunda), nasi merah (red rice, healthy alternative), ketupat (compressed rice cakes for Eid). Rice is central to almost every meal.",
      keywords: ["nasi", "rice", "nasi putih", "nasi uduk", "nasi kuning", "nasi liwet", "nasi merah", "ketupat"],
    }),
    mk({
      id: "food:ingredient:kerupuk", topic: "food.ingredient.kerupuk", name: "Kerupuk (crackers)",
      description:
        "Kerupuk are puffed crackers · shrimp (kerupuk udang), fish (kerupuk ikan), or plant-based · served alongside almost every Indonesian meal. Made by drying starch-and-flavour dough and deep-frying so it puffs. Emping (bitter melinjo cracker) is a Padang and Betawi specialty.",
      keywords: ["kerupuk", "krupuk", "crackers", "kerupuk udang", "kerupuk ikan", "emping", "melinjo"],
    }),

    // ─── 4 FOOD ETIQUETTE / CULTURE ──────────────────────────────
    mk({
      id: "food:etiquette:hand_eating", topic: "food.etiquette.hand_eating", name: "Eating with your hand (makan pakai tangan)",
      description:
        "Eating with the right hand is common and appropriate in Padang, Betawi, Sundanese, and many rural settings · never the left hand (considered unclean). A small finger-bowl of water (kobokan) is usually provided. In more formal or Chinese-Indonesian restaurants, spoon and fork are standard. Chopsticks appear only at Chinese/Japanese places.",
      keywords: ["hand eating", "makan pakai tangan", "right hand", "kobokan", "padang", "etiquette", "sundanese", "betawi"],
    }),
    mk({
      id: "food:etiquette:makan_bersama", topic: "food.etiquette.makan_bersama", name: "Makan bersama (shared eating)",
      description:
        "Makan bersama is the Indonesian norm of eating together, sharing many small dishes from the centre of the table. Nasi Padang exemplifies this · dishes arrive shared, everyone takes from what they like. Ordering individual plates in a group setting can feel isolating; joining a shared meal signals belonging and respect.",
      keywords: ["makan bersama", "shared eating", "communal", "family style", "nasi padang", "respect"],
    }),
    mk({
      id: "food:culture:warung", topic: "food.culture.warung", name: "Warung culture",
      description:
        "A warung is a small owner-operated food stall · anything from a plastic-chair roadside operation to a permanent shop with a kitchen. Warung culture is the backbone of Indonesian daily eating · cheaper than restaurants, personal (owner knows regulars), and every neighbourhood has 5-20 different ones. Prices typically 15-40k IDR per plate. Cash historically; QRIS spreading fast.",
      keywords: ["warung", "warung makan", "food stall", "neighbourhood", "qris", "regulars", "owner operated"],
    }),
    mk({
      id: "food:culture:ramadan_iftar", topic: "food.culture.ramadan_iftar", name: "Buka puasa (Ramadan iftar dining)",
      description:
        "During Ramadan, buka puasa (breaking-fast dining at sunset) transforms Indonesian food culture · takjil (small sweet snacks) sold from roadside stalls in the late afternoon, then a full meal at maghrib. Popular takjil: es cendol, kolak (banana in sweet coconut milk), gorengan (fried snacks), kurma (dates). Restaurants extend hours; ordering in advance is common.",
      keywords: ["buka puasa", "ramadan", "iftar", "takjil", "kolak", "es cendol", "gorengan", "maghrib", "fasting"],
      freshness: "seasonal",
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

  const totalNew = emitted.filter((e) => !e.existed).length;
  const hiQ = emitted.filter((e) => (e.rec.quality?.overall ?? 0) >= 0.7).length;
  const byCategory = { cuisine: 0, street: 0, dish: 0, ingredient: 0, etiquette: 0, culture: 0 };
  for (const e of emitted) {
    const key = e.rec.id.split(":")[1];
    if (key in byCategory) byCategory[key]++;
  }

  console.log(`\n═════════════ SEED FOOD REPORT ═════════════`);
  console.log(`Records emitted:   ${emitted.length}  (new: ${totalNew} · updated: ${emitted.length - totalNew})`);
  console.log(`By category:       ${Object.entries(byCategory).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
  console.log(`Quality ≥ 0.7:     ${hiQ} / ${emitted.length}`);
  console.log(`Total corpus:      ${allEntities.length} entities`);
  console.log(`Written:           ${path.relative(repoRoot, entFile)}`);
  console.log(`═════════════════════════════════════════════\n`);
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}
