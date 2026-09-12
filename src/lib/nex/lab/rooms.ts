// src/lib/nex/lab/rooms.ts
//
// Founder ADR-0304 · Canonical list of Lab rooms.
// Every room maps 1:1 to a Postgres schema (nex_lab_{slug}) and to a
// primary worker agent (lab_{primary_agent}). This registry is the
// source of truth for the HQ dashboard's "rooms" panel and for the
// Lab supervisor's per-room tick.

export interface LabRoom {
  slug:              string;
  display_name:      string;
  schema_name:       string;
  primary_agent_id:  string;
  data_sources:      readonly string[];
  target_records:    number;
  purpose:           string;
}

export const LAB_ROOMS: readonly LabRoom[] = Object.freeze([
  {
    slug: "accommodation",
    display_name: "Accommodation Lab",
    schema_name: "nex_lab_accommodation",
    primary_agent_id: "lab_harvest_accommodation",
    data_sources: ["osm", "kemenparekraf"],
    target_records: 100_000,
    purpose: "Every accommodation across Indonesia · OSM + government registry · verified 2+ sources",
  },
  {
    slug: "food",
    display_name: "Food Lab",
    schema_name: "nex_lab_food",
    primary_agent_id: "lab_harvest_food",
    data_sources: ["osm", "kemenparekraf"],
    target_records: 250_000,
    purpose: "Restaurants · cafes · warungs · street food · halal/veg flags",
  },
  {
    slug: "transport",
    display_name: "Transport Lab",
    schema_name: "nex_lab_transport",
    primary_agent_id: "lab_harvest_transport",
    data_sources: ["osm", "bmkg", "gov_transit"],
    target_records: 5_000,
    purpose: "Routes · schedules · real-time delays · airport-city corridors",
  },
  {
    slug: "business",
    display_name: "Business Lab",
    schema_name: "nex_lab_business",
    primary_agent_id: "lab_harvest_business",
    data_sources: ["wikidata", "msme_registry"],
    target_records: 500_000,
    purpose: "MSMEs · services · shops · workshops · every business in Indonesia",
  },
  {
    slug: "activities",
    display_name: "Activities & Rentals Lab",
    schema_name: "nex_lab_activities",
    primary_agent_id: "lab_harvest_activities",
    data_sources: ["osm", "tourism_boards"],
    target_records: 50_000,
    purpose: "Tours · bike rentals · scooter rentals · surf lessons · cultural experiences",
  },
  {
    slug: "image",
    display_name: "Image Lab",
    schema_name: "nex_lab_image",
    primary_agent_id: "lab_image_fetcher",
    data_sources: ["osm_wikimedia"],
    target_records: 500_000,
    purpose: "Verified image per business · ODbL-compliant · ImageKit CDN · MinIO backup",
  },
  {
    slug: "news",
    display_name: "News & Trends Lab",
    schema_name: "nex_lab_news",
    primary_agent_id: "lab_news_harvester",
    data_sources: ["rss"],
    target_records: 100_000,
    purpose: "Kompas · Detik · Antara RSS · topic extraction · demand signal contribution",
  },
  {
    slug: "voice",
    display_name: "Voice Lab",
    schema_name: "nex_lab_voice",
    primary_agent_id: "lab_voice_benchmark",
    data_sources: ["local_whisper"],
    target_records: 10_000,
    purpose: "Indonesian + English STT/TTS benchmark corpus · quality regression testing",
  },
  {
    slug: "chat",
    display_name: "Chat Lab",
    schema_name: "nex_lab_chat",
    primary_agent_id: "lab_chat_experimenter",
    data_sources: ["conversation_ledger"],
    target_records: 100_000,
    purpose: "A/B tone profiles · prompt variants · measure against real user conversations",
  },
  {
    slug: "monetization",
    display_name: "Monetization Lab",
    schema_name: "nex_lab_monetization",
    primary_agent_id: "lab_monetization_modeller",
    data_sources: ["stripe", "pilots"],
    target_records: 0,
    purpose: "6 doctrine-safe revenue models · pilot flows · unit economics per stream",
  },
]);

export function getRoom(slug: string): LabRoom | undefined {
  return LAB_ROOMS.find((r) => r.slug === slug);
}

export const LAB_WORKERS_EXTRA = Object.freeze([
  "lab_pipeline_healer",     // watches all lab agents, restarts stalls
  "lab_stress_tester",       // nightly endurance test on chat, fails release if regression
  "lab_growth_snapshotter",  // hourly snapshots into nex_lab.growth_history
  "lab_fact_verifier",       // cross-source verification (shared across all rooms)
  "lab_founder_report_composer", // weekly briefs
]);
