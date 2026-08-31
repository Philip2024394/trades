// NEX Indonesia · Walker Workforce Taxonomy.
//
// The authoritative registry of every specialist walker NEX will
// eventually run. Each entry is a knowledge-domain SPECIFICATION —
// not necessarily an implemented walker. Progressive activation
// pattern:
//
//   planned         · spec only · no config file yet
//   config_defined  · walker-config JSON exists · no source data
//   active          · walker publishes records · Guardian covered
//   mature          · walker refreshed on cadence · >100 records
//
// This registry is intentionally verbose. It captures Philip's
// insistence that Adat gets its own branch (not buried under
// Culture), that Spiritual is separate from Culture, and that the
// long tail of resident/expat topics matters as much as tourism.
//
// The universal walker engine consumes any config that references a
// taxonomy entry. To activate a new walker: (1) drop a config in
// data/indonesia/walker-configs/{spec.id}.json (2) add source files
// under data/indonesia/sources/{spec.id}/*.json (3) flip the spec's
// status to "active" here (4) rerun `npm run walkers:indonesia`.
// The Guardian's walkers-taxonomy suite enforces integrity.

export type WalkerBranch =
  | "destinations"
  | "culture"
  | "spiritual"
  | "adat"
  | "food"
  | "travel"
  | "safety"
  | "resident";

export type WalkerStatus = "planned" | "config_defined" | "active" | "mature";

export type WalkerPriority = 1 | 2 | 3;
// 1 = Tier A (build now · highest daily-query value)
// 2 = Tier B (build next · fills obvious user gaps)
// 3 = Tier C (long tail · nice-to-have)

export type WalkerSpec = {
  /** Stable ID · e.g. "walker.culture.festivals_ceremonies". */
  id: string;
  branch: WalkerBranch;
  /** Short, human-readable purpose. */
  purpose: string;
  /** Current implementation status. */
  status: WalkerStatus;
  /** Priority tier (1 = build first, 3 = long tail). */
  priority: WalkerPriority;
  /** Planned or actual authoritative sources. */
  sources: string[];
  /** Rough target record count at maturity. */
  targetRecords?: number;
  /** Notes on why this walker matters. */
  rationale?: string;
  /** Explicit scope hint · defaults to "regional" (fleet-planner
   *  shards Tier-A walkers 8× across regions). "national" walkers
   *  (e.g. BMKG live feeds · same payload for all of Indonesia) get
   *  ONE worker · sharding would just duplicate calls to the source. */
  scope?: "national" | "regional";
};

// ─── DESTINATIONS · 11 specialist walkers ──────────────────────────
// The tourist-facing surface. Focuses on WHERE to go and WHAT it is.
// Sacred sites live under Spiritual to preserve the belief-context;
// this branch is landscape + place-fact.

const DESTINATIONS: WalkerSpec[] = [
  { id: "walker.destinations.core", branch: "destinations", purpose: "Major city + region overviews (Bali, Yogyakarta, Jakarta, Bandung, Surabaya, Lombok, Flores, Medan, Makassar).", status: "active", priority: 1, sources: ["curated:destinations-extra", "UNESCO API", "indonesia.travel"], targetRecords: 300, rationale: "Answers the top-N tourist queries. Already partly seeded." },
  { id: "walker.destinations.beaches_islands", branch: "destinations", purpose: "Beaches + islands + reef zones (Gili, Nusa Penida, Karimunjawa, Belitung, Raja Ampat, Derawan).", status: "planned", priority: 1, sources: ["curated:beaches", "diving-directories"], targetRecords: 400 },
  { id: "walker.destinations.mountains_volcanoes", branch: "destinations", purpose: "Volcanoes + mountains (Bromo, Ijen, Rinjani, Kerinci, Semeru, Merapi). Live status from MAGMA required.", status: "planned", priority: 1, sources: ["MAGMA Indonesia (live)", "PVMBG", "curated"], targetRecords: 100, rationale: "Life-safety domain. Live status is life-safety, not tourism trivia." },
  { id: "walker.destinations.waterfalls_nature", branch: "destinations", purpose: "Waterfalls, hot springs, wildlife spots (Tumpak Sewu, Sekumpul, Gitgit, Tangkuban).", status: "planned", priority: 2, sources: ["curated", "provincial-tourism"], targetRecords: 300 },
  { id: "walker.destinations.national_parks", branch: "destinations", purpose: "National parks + protected areas (Komodo, Way Kambas, Ujung Kulon, Lorentz, Tanjung Puting).", status: "planned", priority: 2, sources: ["KLHK", "UNESCO", "curated"], targetRecords: 60 },
  { id: "walker.destinations.landmarks_monuments", branch: "destinations", purpose: "Non-sacred landmarks + monuments (Monas, Kota Tua, Fort Rotterdam, Sam Poo Kong).", status: "planned", priority: 2, sources: ["cagarbudaya.kemdikbud.go.id", "curated"], targetRecords: 250 },
  { id: "walker.destinations.neighborhoods_areas", branch: "destinations", purpose: "Neighborhood-level guides (Malioboro, Kemang, Menteng, Seminyak, Canggu, Ubud, Prawirotaman).", status: "planned", priority: 2, sources: ["curated", "community-verified"], targetRecords: 200 },
  { id: "walker.destinations.caves_lakes_rivers", branch: "destinations", purpose: "Caves + lakes + rivers (Goa Gong, Lake Toba, Lake Maninjau, Sungai Ayung, Loksado).", status: "planned", priority: 3, sources: ["curated"], targetRecords: 150 },
  { id: "walker.destinations.diving_snorkeling", branch: "destinations", purpose: "Dive + snorkel sites (Bunaken, Lembeh, Wakatobi, Alor, Manta Point, Menjangan).", status: "planned", priority: 2, sources: ["dive-operator-directories", "curated"], targetRecords: 200 },
  { id: "walker.destinations.viewpoints", branch: "destinations", purpose: "Viewpoints + photo spots (Kelingking, Pura Lempuyang gates, Wae Rebo, King Kong Hill).", status: "planned", priority: 3, sources: ["curated", "community-verified"], targetRecords: 200 },
  { id: "walker.destinations.adventure", branch: "destinations", purpose: "Adventure activities (surfing, paragliding, rafting, hiking, trekking, canyoning).", status: "planned", priority: 2, sources: ["operator-directories", "curated"], targetRecords: 200 },
];

// ─── CULTURE · 15 specialist walkers ───────────────────────────────
// Living cultural practice, distinct from spiritual belief and adat
// customary law. Regional variance is the axis that matters.

const CULTURE: WalkerSpec[] = [
  { id: "walker.culture.traditions", branch: "culture", purpose: "Regional living traditions (Javanese slametan, Balinese odalan, Batak funeral customs — the community-observed, non-adat side).", status: "planned", priority: 1, sources: ["Kemendikbud WBTB", "academic (Wacana, Antropologi Indonesia)"], targetRecords: 300 },
  { id: "walker.culture.festivals_ceremonies", branch: "culture", purpose: "Festival + ceremony calendar (Nyepi, Galungan, Kuningan, Waisak, Ramadan hours, Idul Fitri, Cap Go Meh, Erau).", status: "active", priority: 1, sources: ["Kemenag", "PHDI", "curated calendar"], targetRecords: 100, rationale: "Nobody surfaces this well. Cornerstone of the 'Bali during Galungan' use case." },
  { id: "walker.culture.arts_crafts", branch: "culture", purpose: "Regional arts + crafts (batik, ikat, songket, silver, wood carving, wayang, ukiran Bali).", status: "planned", priority: 2, sources: ["Kemendikbud WBTB", "curated"], targetRecords: 200 },
  { id: "walker.culture.music", branch: "culture", purpose: "Traditional music (gamelan, angklung, sasando, kolintang, jaipongan, keroncong).", status: "planned", priority: 3, sources: ["academic", "Kemendikbud"], targetRecords: 100 },
  { id: "walker.culture.dance", branch: "culture", purpose: "Traditional dance (Kecak, Legong, Barong, Saman, Reog, Piring, Jaipong).", status: "planned", priority: 2, sources: ["Kemendikbud WBTB", "curated"], targetRecords: 100 },
  { id: "walker.culture.traditional_clothing", branch: "culture", purpose: "Traditional dress (kebaya, batik protocols, sarong, kamen + selendang, Ulos, Bodo).", status: "planned", priority: 2, sources: ["curated", "academic"], targetRecords: 100, rationale: "Directly maps to temple/mosque dress-code queries." },
  { id: "walker.culture.languages_expressions", branch: "culture", purpose: "Bahasa Indonesia + major regional languages (Javanese, Sundanese, Balinese, Batak, Minang, Bugis, Papuan).", status: "planned", priority: 2, sources: ["Wacana", "Ethnologue", "academic"], targetRecords: 300 },
  { id: "walker.culture.food_culture", branch: "culture", purpose: "Food as culture (Padang rumah makan protocol, communal rice-and-side, coffee ceremonies, tumpeng meaning).", status: "planned", priority: 2, sources: ["curated", "academic"], targetRecords: 150 },
  { id: "walker.culture.etiquette", branch: "culture", purpose: "Cross-cultural etiquette (right-hand use, temple etiquette, home visits, public affection, dress).", status: "planned", priority: 1, sources: ["curated", "academic"], targetRecords: 100 },
  { id: "walker.culture.regional_customs", branch: "culture", purpose: "Province-by-province customs (Aceh sharia notes, Papuan gift protocols, Toraja funeral gifts, Minang matrilineal norms).", status: "planned", priority: 2, sources: ["academic", "provincial cultural offices"], targetRecords: 500 },
  { id: "walker.culture.marriage_family_traditions", branch: "culture", purpose: "Marriage + family customs by region (Minang matrilineal, Batak dowry, Javanese lamaran, Balinese caste).", status: "planned", priority: 3, sources: ["academic"], targetRecords: 150 },
  { id: "walker.culture.funeral_traditions", branch: "culture", purpose: "Funeral + mourning practices (Toraja rambu solo', Balinese ngaben, Javanese slametan sedekah).", status: "planned", priority: 3, sources: ["academic"], targetRecords: 100, rationale: "Toraja funerals are tourist-accessible + require respectful preparation." },
  { id: "walker.culture.birth_coming_of_age", branch: "culture", purpose: "Birth + coming-of-age rites (aqiqah, tedak siten, potong gigi, sunatan).", status: "planned", priority: 3, sources: ["academic"], targetRecords: 80 },
  { id: "walker.culture.traditional_architecture", branch: "culture", purpose: "Traditional architecture (Toraja tongkonan, Minang rumah gadang, Balinese compound, Papuan honai, Javanese joglo).", status: "planned", priority: 2, sources: ["academic", "curated"], targetRecords: 100 },
  { id: "walker.culture.indigenous_heritage", branch: "culture", purpose: "Indigenous / ethnic heritage broadly (Papua tribes, Dayak subgroups, Mentawai, Suku Anak Dalam).", status: "planned", priority: 3, sources: ["academic", "AMAN (adjacent)"], targetRecords: 200 },
];

// ─── SPIRITUAL · 14 specialist walkers ─────────────────────────────
// Separate from Culture because BELIEF is different from PRACTICE.
// Indonesia's constitutional-legal frame recognises `agama` (6 recognised
// religions) + `penghayat kepercayaan` (recognised beliefs since 2017)
// distinct from adat (customary law). Kejawen/kebatinan are the
// biggest structured-source blindspot per the research pass.

const SPIRITUAL: WalkerSpec[] = [
  { id: "walker.spiritual.religions", branch: "spiritual", purpose: "The 6 recognised agama (Islam Sunni/Shia/Ahmadi variants, Protestantism, Catholicism, Hindu Bali, Buddhism, Confucianism).", status: "planned", priority: 1, sources: ["Kemenag", "academic"], targetRecords: 80 },
  { id: "walker.spiritual.belief_systems", branch: "spiritual", purpose: "Distinctions between doctrinal belief, folk practice, syncretism, contemporary interpretation. Perspective field required.", status: "planned", priority: 1, sources: ["academic"], targetRecords: 150 },
  { id: "walker.spiritual.sacred_sites", branch: "spiritual", purpose: "Sacred sites with belief-context (Besakih, Uluwatu, Prambanan, Borobudur, Istiqlal, Ganesha caves, Danau Ranu Kumbolo).", status: "active", priority: 1, sources: ["PHDI", "Kemenag", "UNESCO", "curated"], targetRecords: 200, rationale: "Not a landmark walker — must carry belief-tradition + observance_type." },
  { id: "walker.spiritual.temples_mosques_churches_monasteries", branch: "spiritual", purpose: "Places of worship as functional buildings (Grand Mosque Jakarta, Basilica Ende, Mendut, Sam Poo Kong).", status: "planned", priority: 2, sources: ["Kemenag", "curated"], targetRecords: 300 },
  { id: "walker.spiritual.pilgrimage", branch: "spiritual", purpose: "Pilgrimage routes + practices (Wali Songo circuit, Balinese temple circuits, Umrah/Hajj prep from Indonesia).", status: "planned", priority: 3, sources: ["Kemenag", "academic"], targetRecords: 100 },
  { id: "walker.spiritual.practices", branch: "spiritual", purpose: "Spiritual practices (meditation, wirid, upacara, cleansing rituals, offerings).", status: "planned", priority: 2, sources: ["academic", "PHDI"], targetRecords: 150 },
  { id: "walker.spiritual.local_beliefs", branch: "spiritual", purpose: "Local/folk beliefs by region (roh, hantu, penunggu, taboo forests, calendar-day beliefs).", status: "planned", priority: 3, sources: ["academic"], targetRecords: 200 },
  { id: "walker.spiritual.kejawen", branch: "spiritual", purpose: "Kejawen + kebatinan — Javanese mystical/spiritual tradition. Distinguish practice, philosophy, contemporary revivals.", status: "planned", priority: 2, sources: ["academic (Mulder, Geertz, UIN Sunan Kalijaga)", "MLKI"], targetRecords: 80, rationale: "Structured source blindspot — must be academically sourced with perspective field." },
  { id: "walker.spiritual.penghayat_kepercayaan", branch: "spiritual", purpose: "Recognised belief systems (post-2017 Constitutional Court · Sunda Wiwitan, Parmalim, Kaharingan, Aluk Todolo).", status: "planned", priority: 2, sources: ["Kemenag directorate", "academic"], targetRecords: 60, rationale: "Legal recognition matters — helps users understand documentation + practice." },
  { id: "walker.spiritual.adat_spirituality", branch: "spiritual", purpose: "Spiritual dimension of adat (sasi Maluku, huma Dayak, gua Kubu, hutan larangan).", status: "planned", priority: 3, sources: ["AMAN", "academic"], targetRecords: 100 },
  { id: "walker.spiritual.sacred_mountains_forests_springs", branch: "spiritual", purpose: "Natural sacred sites (Gunung Agung, Gunung Kawi, mata air, hutan keramat, danau suci).", status: "planned", priority: 2, sources: ["PHDI", "AMAN", "curated"], targetRecords: 100 },
  { id: "walker.spiritual.ceremony_practices", branch: "spiritual", purpose: "How to participate in / observe ceremonies (ngaben, sesajen, maulid, purnama).", status: "planned", priority: 2, sources: ["PHDI", "Kemenag", "curated"], targetRecords: 150 },
  { id: "walker.spiritual.religious_calendars", branch: "spiritual", purpose: "Religious calendars integrated (Islamic hijri, Hindu Saka, Christian, Buddhist Vesak, Chinese lunar).", status: "planned", priority: 1, sources: ["Kemenag", "PHDI"], targetRecords: 50, rationale: "Enables 'is it Ramadan / Nyepi / Waisak next week' queries." },
  { id: "walker.spiritual.etiquette", branch: "spiritual", purpose: "Belief-specific etiquette (temple menstruation rule, Ramadan public-eating norms, church dress, mosque wudu).", status: "planned", priority: 1, sources: ["PHDI", "MUI", "curated"], targetRecords: 80 },
];

// ─── ADAT · 12 specialist walkers ──────────────────────────────────
// Split OUT of Culture per Philip's insistence. Adat is customary
// LAW + community governance + territory. Distinct from spiritual
// tradition (though they overlap). AMAN (Aliansi Masyarakat Adat
// Nusantara) is the closest authoritative body, but coverage of
// 2,000+ adat communities is deeply uneven — every record must
// carry provenance + adat-community identifier + perspective.

const ADAT: WalkerSpec[] = [
  { id: "walker.adat.communities", branch: "adat", purpose: "Adat communities registry (Baduy, Toraja, Dayak subgroups, Sasak, Suku Anak Dalam, Mentawai, Papuan tribes).", status: "active", priority: 1, sources: ["AMAN (aman.or.id)", "academic"], targetRecords: 300, rationale: "The foundational lookup — everything else references a community." },
  { id: "walker.adat.customary_law", branch: "adat", purpose: "Hukum adat rules (per community, with scope — marriage, inheritance, land, dispute).", status: "planned", priority: 2, sources: ["AMAN", "academic legal journals"], targetRecords: 400 },
  { id: "walker.adat.customary_territories", branch: "adat", purpose: "Recognised customary territories (BRWA map, hutan adat, wilayah adat).", status: "planned", priority: 2, sources: ["BRWA (Badan Registrasi Wilayah Adat)", "AMAN"], targetRecords: 200 },
  { id: "walker.adat.local_leadership", branch: "adat", purpose: "Adat leadership structures (kepala adat, tetua, pemangku, pemuka).", status: "planned", priority: 2, sources: ["AMAN", "academic"], targetRecords: 200 },
  { id: "walker.adat.land_customary_rights", branch: "adat", purpose: "Ulayat land rights + tenure recognition process (hak ulayat, hutan adat certification).", status: "planned", priority: 3, sources: ["AMAN", "KLHK", "legal journals"], targetRecords: 100 },
  { id: "walker.adat.ceremonies", branch: "adat", purpose: "Adat-specific ceremonies (Bau Nyale Sasak, Erau Kutai, Aruh Baharin Meratus).", status: "planned", priority: 2, sources: ["AMAN", "provincial cultural offices"], targetRecords: 200 },
  { id: "walker.adat.taboos", branch: "adat", purpose: "Adat taboos + pantangan (sacred forest entry, animal killing bans, timing restrictions).", status: "planned", priority: 2, sources: ["academic", "AMAN"], targetRecords: 200, rationale: "Tourist-safety adjacent — accidental taboo violation is real." },
  { id: "walker.adat.community_rules", branch: "adat", purpose: "Rules of community life (Baduy Dalam dress + tech taboos, Sasak marriage-by-elopement norms).", status: "planned", priority: 2, sources: ["AMAN", "academic"], targetRecords: 200 },
  { id: "walker.adat.traditional_conflict_resolution", branch: "adat", purpose: "Musyawarah + peradilan adat + restorative mechanisms.", status: "planned", priority: 3, sources: ["legal journals", "AMAN"], targetRecords: 80 },
  { id: "walker.adat.customary_marriage", branch: "adat", purpose: "Adat marriage forms (kawin lari Sasak, jujuran Batak, matrilineal Minang, patrilineal Toba).", status: "planned", priority: 3, sources: ["academic"], targetRecords: 100 },
  { id: "walker.adat.customary_inheritance", branch: "adat", purpose: "Adat inheritance (matrilineal Minang, patrilineal Toba, bilateral Javanese, harta pusaka).", status: "planned", priority: 3, sources: ["academic legal"], targetRecords: 80 },
  { id: "walker.adat.local_environmental_practices", branch: "adat", purpose: "Environmental adat (subak Bali, sasi Maluku, tebang milih, hutan larangan).", status: "planned", priority: 2, sources: ["AMAN", "academic"], targetRecords: 150, rationale: "Subak is UNESCO-listed — high tourist interest, respectful framing required." },
];

// ─── FOOD · 11 specialist walkers ──────────────────────────────────

const FOOD: WalkerSpec[] = [
  { id: "walker.food.dishes", branch: "food", purpose: "National dishes (nasi goreng, rendang, sate, gado-gado, bakso, soto, martabak, mie goreng, gudeg, pempek).", status: "active", priority: 1, sources: ["curated:dishes-extra", "academic (food history)"], targetRecords: 300 },
  { id: "walker.food.regional_cuisines", branch: "food", purpose: "Regional cuisines (Padang, Manado, Bali, Aceh, Palembang, Betawi, Sunda, Batak, Bugis, Maluku).", status: "planned", priority: 1, sources: ["curated", "academic"], targetRecords: 500 },
  { id: "walker.food.ingredients", branch: "food", purpose: "Key ingredients + spices (terasi, kecap manis, kemiri, daun jeruk, kluwek, andaliman).", status: "planned", priority: 2, sources: ["curated", "academic"], targetRecords: 200 },
  { id: "walker.food.street_food", branch: "food", purpose: "Street food (kaki lima, warung tenda, angkringan · region-specific specialities).", status: "planned", priority: 1, sources: ["curated", "community-verified"], targetRecords: 400 },
  { id: "walker.food.restaurants", branch: "food", purpose: "Restaurants (curated + Google Places live for hours/prices).", status: "planned", priority: 2, sources: ["curated", "Google Places API (paid)"], targetRecords: 2000 },
  { id: "walker.food.halal_certification", branch: "food", purpose: "Halal-certified restaurants + products (BPJPH authoritative).", status: "planned", priority: 1, sources: ["BPJPH halal.go.id"], targetRecords: 5000, rationale: "THE differentiator. No competitor surfaces BPJPH certification reliably. 240M Muslim market." },
  { id: "walker.food.vegetarian_vegan", branch: "food", purpose: "Vegetarian + vegan options + terasi-free markers.", status: "planned", priority: 2, sources: ["curated", "community-verified"], targetRecords: 500 },
  { id: "walker.food.food_customs", branch: "food", purpose: "Table customs (right-hand, communal rice, Padang bench-of-dishes, tumpeng cutting).", status: "planned", priority: 2, sources: ["curated", "academic"], targetRecords: 100 },
  { id: "walker.food.ceremonial_food", branch: "food", purpose: "Ceremonial + ritual food (tumpeng, ketupat lebaran, kolak, bubur suro, banten Bali).", status: "planned", priority: 2, sources: ["academic", "curated"], targetRecords: 100 },
  { id: "walker.food.traditional_cooking", branch: "food", purpose: "Traditional cooking methods (tungku, batu kompor, daun pisang, bakar batu Papua).", status: "planned", priority: 3, sources: ["academic", "curated"], targetRecords: 80 },
  { id: "walker.food.regional_food_history", branch: "food", purpose: "Food history (Padang migration, kecap origin, colonial-era rijsttafel, Chinese-Indonesian).", status: "planned", priority: 3, sources: ["academic (food-history journals)"], targetRecords: 100 },
];

// ─── TRAVEL / PRACTICAL · 15 specialist walkers ────────────────────

const TRAVEL: WalkerSpec[] = [
  { id: "walker.travel.airports", branch: "travel", purpose: "All IATA-3 airports (CGK, DPS, SUB, LOP, YIA, LBJ, UPG, MDC, KNO, HLP, KOE, TIM, DJJ).", status: "active", priority: 1, sources: ["curated:airports", "Angkasa Pura I/II"], targetRecords: 50 },
  { id: "walker.travel.trains", branch: "travel", purpose: "KAI intercity + commuter (Argo Bromo, Argo Lawu, KRL Jabodetabek, MRT Jakarta, LRT Bali plan).", status: "planned", priority: 1, sources: ["KAI (partner API preferred)", "curated"], targetRecords: 100 },
  { id: "walker.travel.buses", branch: "travel", purpose: "Buses (Damri, PO buses Bali, TransJakarta, TransJogja, Batik Solo Trans).", status: "planned", priority: 2, sources: ["Dishub provincial", "curated"], targetRecords: 100 },
  { id: "walker.travel.ferries", branch: "travel", purpose: "Ferries (Pelni intercity, fast-boat Bali-Gili-Lombok, ASDP roll-on car ferry).", status: "planned", priority: 2, sources: ["Pelni", "ASDP", "operator sites"], targetRecords: 100 },
  { id: "walker.travel.roads", branch: "travel", purpose: "Toll roads, mountain passes, road-condition notes (Trans-Java toll, Trans-Sumatra, Bali Ring Road).", status: "planned", priority: 3, sources: ["Jasa Marga", "curated"], targetRecords: 100 },
  { id: "walker.travel.accommodation", branch: "travel", purpose: "Accommodation records (hotel · guesthouse · hostel · motel · apartment) sourced from OpenStreetMap via Overpass · ODbL-licensed community data · Tier C.", status: "active", priority: 2, scope: "national", sources: ["OSM Overpass"], targetRecords: 500, rationale: "Stage 3 (Philip 2026-08-31) · first Tier-C acquisition source · brings real Indonesian accommodation inventory into the World layer that the Brain's accommodation intent already retrieves against." },
  { id: "walker.travel.sim_esim", branch: "travel", purpose: "SIM + eSIM (Telkomsel, XL, Indosat, Smartfren, Airalo, Nomad, Saily).", status: "planned", priority: 1, sources: ["provider sites", "curated"], targetRecords: 30 },
  { id: "walker.travel.money", branch: "travel", purpose: "Money (rupiah, denominations, tipping norms, service charge, exchange).", status: "planned", priority: 2, sources: ["Bank Indonesia", "curated"], targetRecords: 30 },
  { id: "walker.travel.atms", branch: "travel", purpose: "ATM guidance (bank-branch preference, skimming risk, withdrawal limits, foreign-card fees).", status: "planned", priority: 3, sources: ["curated"], targetRecords: 40 },
  { id: "walker.travel.shopping", branch: "travel", purpose: "Shopping (Malioboro, Pasar Baru, Tanah Abang, Ubud Art Market, Sukawati, oleh-oleh).", status: "planned", priority: 2, sources: ["curated"], targetRecords: 200 },
  { id: "walker.travel.visas", branch: "travel", purpose: "Visa types (VoA, e-VoA, B211A, KITAS · Second Home, digital nomad).", status: "planned", priority: 1, sources: ["Ditjen Imigrasi"], targetRecords: 30 },
  { id: "walker.travel.immigration", branch: "travel", purpose: "Immigration process (arrival, extension, overstay, exit).", status: "planned", priority: 2, sources: ["Ditjen Imigrasi"], targetRecords: 30 },
  { id: "walker.travel.pharmacies", branch: "travel", purpose: "Pharmacies (Kimia Farma, Guardian, Apotek K-24 · common medicines, prescription rules).", status: "planned", priority: 2, sources: ["curated"], targetRecords: 100 },
  { id: "walker.travel.hospitals", branch: "travel", purpose: "Hospitals (BIMC, Siloam, SOS Clinic, RS Panti Rapih · with English + insurance notes).", status: "active", priority: 1, sources: ["curated:hospitals", "Kemenkes SIRS", "JCI"], targetRecords: 500 },
  { id: "walker.travel.emergency_services", branch: "travel", purpose: "Unified emergency directory (112, 110 police, 118/119 ambulance, tourist police lines).", status: "planned", priority: 1, sources: ["Kemendagri", "curated"], targetRecords: 50 },
];

// ─── SAFETY · 12 specialist walkers ────────────────────────────────

const SAFETY: WalkerSpec[] = [
  { id: "walker.safety.earthquakes", branch: "safety", purpose: "Earthquake live feed + preparedness. BMKG open feed.", status: "active", priority: 1, scope: "national", sources: ["BMKG (live)"], targetRecords: 50, rationale: "Stage C (Philip 2026-08-30) · first real HTTP walker in the workforce · adapts the proven BMKG live-source connector. Scope=national · BMKG returns the same feed for the whole country · sharding 8× would just burn the 2/min budget." },
  { id: "walker.safety.volcanoes", branch: "safety", purpose: "Volcano status (live). MAGMA Indonesia JSON.", status: "planned", priority: 1, sources: ["MAGMA (live)", "PVMBG"], targetRecords: 130 },
  { id: "walker.safety.tsunami", branch: "safety", purpose: "Tsunami warnings + coastal risk profile.", status: "planned", priority: 1, sources: ["BMKG (live)", "BNPB"], targetRecords: 30 },
  { id: "walker.safety.weather", branch: "safety", purpose: "Weather forecast (live) + rainy-season patterns per region.", status: "planned", priority: 2, sources: ["BMKG (live)"], targetRecords: 100 },
  { id: "walker.safety.flooding", branch: "safety", purpose: "Flood-prone areas + rainy-season closures.", status: "planned", priority: 2, sources: ["BNPB dibi.bnpb.go.id", "curated"], targetRecords: 100 },
  { id: "walker.safety.currents", branch: "safety", purpose: "Coastal currents + rip-tide warnings (Bali south coast, Nusa Lembongan, Lombok south).", status: "planned", priority: 2, sources: ["curated", "surf-report sites"], targetRecords: 60 },
  { id: "walker.safety.wildlife", branch: "safety", purpose: "Wildlife hazards (macaques, monitor lizards, snakes, jellyfish, dogs, mosquito-borne).", status: "planned", priority: 2, sources: ["curated", "academic"], targetRecords: 80 },
  { id: "walker.safety.scams", branch: "safety", purpose: "Common scams (airport taxi, money-changer sleight, motorbike damage, closed-for-ceremony detour, fake police).", status: "planned", priority: 1, sources: ["community-verified", "tourist-police reports", "curated"], targetRecords: 100, rationale: "Reddit-fills-this-gap territory. Structural differentiator." },
  { id: "walker.safety.tourist_traps", branch: "safety", purpose: "Overpriced or misrepresented tourist attractions (with honest alternatives).", status: "planned", priority: 3, sources: ["community-verified"], targetRecords: 80 },
  { id: "walker.safety.dangerous_roads", branch: "safety", purpose: "Roads with high accident rate + advice (Karo highlands, Trans-Papua, Bali Ubud mountain roads).", status: "planned", priority: 3, sources: ["curated"], targetRecords: 60 },
  { id: "walker.safety.nightlife_safety", branch: "safety", purpose: "Nightlife safety (Bali methanol risk, Gili beach parties, Jakarta clubs, drink-spiking).", status: "planned", priority: 2, sources: ["curated", "embassy travel advisories"], targetRecords: 60 },
  { id: "walker.safety.emergency_procedures", branch: "safety", purpose: "Emergency-response protocols (earthquake drop-cover-hold, tsunami evacuation, snake bite, jellyfish sting).", status: "planned", priority: 1, sources: ["BNPB", "medical guidelines"], targetRecords: 60 },
];

// ─── RESIDENT / EXPAT · 11 specialist walkers ──────────────────────
// The neglected market. No existing app serves the 76M residents +
// long-stay expats well.

const RESIDENT: WalkerSpec[] = [
  { id: "walker.resident.kitas", branch: "resident", purpose: "KITAS process (work, dependent, retirement, investor, Second Home).", status: "planned", priority: 2, sources: ["Ditjen Imigrasi", "curated"], targetRecords: 40 },
  { id: "walker.resident.bpjs", branch: "resident", purpose: "BPJS Kesehatan enrolment, tiers, hospital acceptance.", status: "planned", priority: 2, sources: ["BPJS Kesehatan"], targetRecords: 30 },
  { id: "walker.resident.pln", branch: "resident", purpose: "PLN (electricity) accounts, prepaid vs postpaid, tariff tiers.", status: "planned", priority: 3, sources: ["PLN"], targetRecords: 20 },
  { id: "walker.resident.internet", branch: "resident", purpose: "Home internet (IndiHome, MyRepublic, Biznet, First Media · coverage + typical speeds).", status: "planned", priority: 3, sources: ["provider sites"], targetRecords: 30 },
  { id: "walker.resident.schools", branch: "resident", purpose: "International schools (SPH, JIS, AIS, BIS · fees, curricula, calendars).", status: "planned", priority: 3, sources: ["curated"], targetRecords: 80 },
  { id: "walker.resident.driving_licensing", branch: "resident", purpose: "SIM (driving licence) — SIM A/B/C, KITAS-holder path, IDP acceptance.", status: "planned", priority: 3, sources: ["Korlantas", "curated"], targetRecords: 30 },
  { id: "walker.resident.banking", branch: "resident", purpose: "Banking for foreigners (BCA, Mandiri, Permata Golden · KITAS-required, digital-first options).", status: "planned", priority: 3, sources: ["bank sites", "curated"], targetRecords: 40 },
  { id: "walker.resident.property", branch: "resident", purpose: "Property (Hak Pakai, Hak Milik restrictions for foreigners, leasehold Bali, nominee risks).", status: "planned", priority: 3, sources: ["BPN", "legal journals"], targetRecords: 50 },
  { id: "walker.resident.government_services", branch: "resident", purpose: "Government services (Dukcapil, KUA, kelurahan · registration types).", status: "planned", priority: 3, sources: ["Kemendagri"], targetRecords: 40 },
  { id: "walker.resident.business", branch: "resident", purpose: "Business setup (PT, PT PMA, CV, OSS, TDP, NIB).", status: "planned", priority: 3, sources: ["BKPM", "OSS"], targetRecords: 60 },
  { id: "walker.resident.taxes", branch: "resident", purpose: "Taxes (PPh individual, NPWP, DGT online, foreigner-tax rules).", status: "planned", priority: 3, sources: ["DJP"], targetRecords: 40 },
];

// ─── The full registry ─────────────────────────────────────────────

const ALL_WALKERS: WalkerSpec[] = [
  ...DESTINATIONS,
  ...CULTURE,
  ...SPIRITUAL,
  ...ADAT,
  ...FOOD,
  ...TRAVEL,
  ...SAFETY,
  ...RESIDENT,
];

export function listAllWalkerSpecs(): readonly WalkerSpec[] {
  return ALL_WALKERS;
}

export function listWalkersByBranch(branch: WalkerBranch): readonly WalkerSpec[] {
  return ALL_WALKERS.filter((w) => w.branch === branch);
}

export function listWalkersByStatus(status: WalkerStatus): readonly WalkerSpec[] {
  return ALL_WALKERS.filter((w) => w.status === status);
}

export function listWalkersByPriority(priority: WalkerPriority): readonly WalkerSpec[] {
  return ALL_WALKERS.filter((w) => w.priority === priority);
}

export function findWalkerSpec(id: string): WalkerSpec | undefined {
  return ALL_WALKERS.find((w) => w.id === id);
}

export const BRANCH_LABELS: Record<WalkerBranch, string> = {
  destinations: "Destinations",
  culture:      "Culture",
  spiritual:    "Spiritual / Belief",
  adat:         "Adat / Customary Law",
  food:         "Food",
  travel:       "Travel / Practical",
  safety:       "Safety",
  resident:     "Resident / Expat",
};
