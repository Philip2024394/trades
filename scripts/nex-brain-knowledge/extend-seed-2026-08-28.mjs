// One-shot script · Philip 2026-08-28 · Task #45 knowledge walker expansion.
// Adds 4 new segments (cuisine · history · culture · language) to the
// knowledge seed. Brings knowledge walker count from 8 → 15 once the
// scheduler entries are added.

import fs from "node:fs";

const path = "data/nex-indonesia-knowledge-seed.json";
const seed = JSON.parse(fs.readFileSync(path, "utf8"));

seed.cuisine = [
  { slug: "nasi-padang", name_en: "Nasi Padang", name_id: "Nasi Padang", region: "West Sumatra", truth_class: "confirmed_fact" },
  { slug: "rendang", name_en: "Rendang", name_id: "Rendang", region: "West Sumatra", truth_class: "confirmed_fact" },
  { slug: "nasi-goreng", name_en: "Nasi Goreng", name_id: "Nasi Goreng", region: "National", truth_class: "confirmed_fact" },
  { slug: "sate", name_en: "Satay", name_id: "Sate", region: "National", truth_class: "confirmed_fact" },
  { slug: "soto", name_en: "Soto", name_id: "Soto", region: "National", truth_class: "confirmed_fact" },
  { slug: "bakso", name_en: "Bakso", name_id: "Bakso", region: "National", truth_class: "confirmed_fact" },
  { slug: "gado-gado", name_en: "Gado-gado", name_id: "Gado-gado", region: "National", truth_class: "confirmed_fact" },
  { slug: "pempek", name_en: "Pempek", name_id: "Pempek", region: "South Sumatra", truth_class: "confirmed_fact" },
  { slug: "ayam-betutu", name_en: "Ayam Betutu", name_id: "Ayam Betutu", region: "Bali", truth_class: "confirmed_fact" },
  { slug: "papeda", name_en: "Papeda", name_id: "Papeda", region: "Papua/Maluku", truth_class: "confirmed_fact" },
  { slug: "coto-makassar", name_en: "Coto Makassar", name_id: "Coto Makassar", region: "South Sulawesi", truth_class: "confirmed_fact" },
  { slug: "nasi-kuning", name_en: "Nasi Kuning", name_id: "Nasi Kuning", region: "National", truth_class: "confirmed_fact" },
  { slug: "rawon", name_en: "Rawon", name_id: "Rawon", region: "East Java", truth_class: "confirmed_fact" },
  { slug: "rujak", name_en: "Rujak", name_id: "Rujak", region: "National", truth_class: "confirmed_fact" },
  { slug: "mie-ayam", name_en: "Mie Ayam", name_id: "Mie Ayam", region: "National", truth_class: "confirmed_fact" },
];

seed.history = [
  { slug: "srivijaya-empire", name_en: "Srivijaya Empire", name_id: "Kerajaan Sriwijaya", period: "7th-13th century", truth_class: "confirmed_fact" },
  { slug: "majapahit-empire", name_en: "Majapahit Empire", name_id: "Kerajaan Majapahit", period: "13th-16th century", truth_class: "confirmed_fact" },
  { slug: "mataram-sultanate", name_en: "Mataram Sultanate", name_id: "Kesultanan Mataram", period: "16th-18th century", truth_class: "confirmed_fact" },
  { slug: "dutch-east-india-company", name_en: "Dutch East India Company (VOC)", name_id: "VOC", period: "1602-1799", truth_class: "confirmed_fact" },
  { slug: "sukarno", name_en: "Sukarno", name_id: "Sukarno", period: "1901-1970", truth_class: "confirmed_fact" },
  { slug: "proclamation-1945", name_en: "Proclamation of Indonesian Independence", name_id: "Proklamasi Kemerdekaan Indonesia 1945", period: "17 August 1945", truth_class: "confirmed_fact" },
  { slug: "indonesian-national-revolution", name_en: "Indonesian National Revolution", name_id: "Revolusi Nasional Indonesia", period: "1945-1949", truth_class: "confirmed_fact" },
  { slug: "new-order-suharto", name_en: "New Order (Suharto)", name_id: "Orde Baru (Soeharto)", period: "1966-1998", truth_class: "confirmed_fact" },
  { slug: "reformasi-1998", name_en: "Reformasi 1998", name_id: "Reformasi 1998", period: "1998", truth_class: "confirmed_fact" },
  { slug: "east-timor-independence", name_en: "East Timor Independence", name_id: "Kemerdekaan Timor Leste", period: "1999-2002", truth_class: "confirmed_fact" },
];

seed.culture = [
  { slug: "batik", name_en: "Batik", name_id: "Batik", origin: "Java", truth_class: "confirmed_fact" },
  { slug: "wayang-kulit", name_en: "Wayang Kulit (shadow puppet theatre)", name_id: "Wayang Kulit", origin: "Java · Bali", truth_class: "confirmed_fact" },
  { slug: "gamelan", name_en: "Gamelan", name_id: "Gamelan", origin: "Java · Bali · Sunda", truth_class: "confirmed_fact" },
  { slug: "kecak", name_en: "Kecak (Balinese fire dance)", name_id: "Kecak", origin: "Bali", truth_class: "confirmed_fact" },
  { slug: "angklung", name_en: "Angklung", name_id: "Angklung", origin: "Sundanese · West Java", truth_class: "confirmed_fact" },
  { slug: "keris", name_en: "Keris (traditional dagger)", name_id: "Keris", origin: "Java · archipelago-wide", truth_class: "confirmed_fact" },
  { slug: "tari-saman", name_en: "Saman Dance", name_id: "Tari Saman", origin: "Aceh", truth_class: "confirmed_fact" },
  { slug: "tari-pendet", name_en: "Pendet Dance", name_id: "Tari Pendet", origin: "Bali", truth_class: "confirmed_fact" },
  { slug: "ikat-tenun", name_en: "Ikat & Tenun (traditional weaving)", name_id: "Ikat dan Tenun", origin: "NTT · Bali · Sumatra", truth_class: "confirmed_fact" },
  { slug: "songket", name_en: "Songket", name_id: "Songket", origin: "Sumatra · Bali", truth_class: "confirmed_fact" },
];

seed.language = [
  { slug: "bahasa-indonesia", name_en: "Bahasa Indonesia (national language)", name_id: "Bahasa Indonesia", family: "Austronesian · Malayic", truth_class: "confirmed_fact" },
  { slug: "bahasa-jawa", name_en: "Javanese", name_id: "Bahasa Jawa", family: "Austronesian · Javanese", truth_class: "confirmed_fact" },
  { slug: "bahasa-sunda", name_en: "Sundanese", name_id: "Bahasa Sunda", family: "Austronesian · Sundanese", truth_class: "confirmed_fact" },
  { slug: "bahasa-bali", name_en: "Balinese", name_id: "Bahasa Bali", family: "Austronesian · Bali-Sasak", truth_class: "confirmed_fact" },
  { slug: "bahasa-batak", name_en: "Batak languages", name_id: "Bahasa Batak", family: "Austronesian · Batak", truth_class: "confirmed_fact" },
  { slug: "bahasa-minangkabau", name_en: "Minangkabau", name_id: "Bahasa Minangkabau", family: "Austronesian · Malayic", truth_class: "confirmed_fact" },
  { slug: "bahasa-bugis", name_en: "Buginese", name_id: "Bahasa Bugis", family: "Austronesian · South Sulawesi", truth_class: "confirmed_fact" },
  { slug: "bahasa-sasak", name_en: "Sasak (Lombok)", name_id: "Bahasa Sasak", family: "Austronesian · Bali-Sasak", truth_class: "confirmed_fact" },
];

fs.writeFileSync(path, JSON.stringify(seed, null, 2));
console.log("added segments · cuisine:", seed.cuisine.length, "history:", seed.history.length, "culture:", seed.culture.length, "language:", seed.language.length);
console.log("total: 8 segments across", (seed.provinces.length + seed.destinations.length + seed.folklore.length + seed.spiritual.length + seed.cuisine.length + seed.history.length + seed.culture.length + seed.language.length), "topics");
