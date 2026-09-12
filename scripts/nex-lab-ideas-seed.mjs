#!/usr/bin/env node
// scripts/nex-lab-ideas-seed.mjs
//
// Founder 2026-09-10 · Innovation Room · seed AI-agent-generated ideas into
// nex_lab.innovation_ideas. This batch is from the first two creative agents
// (mobile-offline · chat-and-data-gap). Idempotent · re-runs skip existing titles.

import { Client } from "pg";

const IDEAS = [
  // ─── AGENT 2 · mobile-offline ──────────────────────────────
  {
    agent: "creative-agent:mobile-offline",
    category: "offline_mode",
    title: "Offline Draft Queue + Deferred Send",
    user_need: "A tourist in Ubud composes a chat message while 4G drops · today the message is lost.",
    description: "Every keystroke debounce-saves the draft to IndexedDB. On submit while offline, message is queued and rendered with a pending badge. Background sync loop fires when internet returns and posts queued messages. Draft cleared on success.",
    why_missing: "NexPolishedChat.tsx sends via fetch() with no local fallback. Service worker (public/nex-sw.js) is read-only cache. No IndexedDB integration.",
    evidence_refs: ["src/app/nexapp/NexPolishedChat.tsx","src/lib/nex/agent-runtime/internet-check.ts","public/nex-sw.js"],
    difficulty: "M",
    user_value: "critical",
    engineering_brief: "Create src/lib/nex/offline/draft-queue.ts with saveDraft/loadDraft/queueMessage/flushQueue. Update NexPolishedChat.tsx to pre-fill draft, check cachedInternetState before send, and render optimistic pending badge. Add SyncManager singleton that listens for internet state → ONLINE and calls flushQueue. Keep service worker read-only (never cache POST).",
  },
  {
    agent: "creative-agent:mobile-offline",
    category: "offline_mode",
    title: "Conversation History Snapshot for Offline Replay",
    user_need: "Homeowner in rural Sumatra wants to re-read yesterday's NEX answer today while offline.",
    description: "On conversation checkpoint, snapshot full thread (messages · cited sources · trust bands) to service-worker cache with 30-day TTL. Offline chat page lists cached conversations. Tap opens read-only replay with grey background + 'Offline replay' badge.",
    why_missing: "Chat state is React-only ephemeral. No /api/nex-conv/snapshot endpoint. Service worker CACHEABLE_GET_PATHS excludes conversations.",
    evidence_refs: ["public/nex-sw.js","src/app/nexapp/NexPolishedChat.tsx"],
    difficulty: "M",
    user_value: "high",
    engineering_brief: "Build POST /api/nex-conv/snapshot returning { conversation_id, messages[], cited_sources[], trust_scores[], snapshot_version, created_at } · strip image_url fields per ADR-0022. Client util src/lib/nex/offline/conversation-snapshot.ts with snapshotConversation/cacheSnapshot/loadSnapshot (IndexedDB, 30d TTL). NexPolishedChat renders replay mode when route param says so.",
  },
  {
    agent: "creative-agent:mobile-offline",
    category: "chat_answer",
    title: "ISP Status Banner + Graceful Degradation",
    user_need: "User's Telkomsel is degraded · they need to know NEX will trade latency for reliability.",
    description: "Fetch /api/nex/isp-status?country=ID on mount + every 5min. When any provider status ≠ operational, set ISP_DEGRADED flag: pause Observatory polling, batch SSE, render top banner 'ISP degraded — low-bandwidth mode'. Sticky per session.",
    why_missing: "Endpoint exists at src/app/api/nex/isp-status/route.ts but nothing consumes it. No degradation UI.",
    evidence_refs: ["src/app/api/nex/isp-status/route.ts","src/app/nexapp/NexPolishedChat.tsx"],
    difficulty: "S",
    user_value: "high",
    engineering_brief: "Create src/lib/nex/network/isp-awareness.ts (fetchIspStatus, isNetworkDegraded, IspStatusContext). Component src/components/nex-app/IspStatusBar.tsx rendering conditional banner + 'Force online' toggle. Layout hooks the context so chat + discovery inherit degradation.",
  },
  {
    agent: "creative-agent:mobile-offline",
    category: "discovery_ui",
    title: "Bandwidth-Aware Lazy Loading for Discovery Cards",
    user_need: "Village user near Yogyakarta at 500kbps · grid of image-heavy cards takes 30s to load.",
    description: "One-time bandwidth probe on mount. If <1Mbps: text-only cards + 'Load preview' button. If 1-3Mbps: low-res thumbnail. If >3Mbps: high-res + lazy viewport load. NEX images only (ADR-0022).",
    why_missing: "No bandwidth detection exists. Discovery cards serve full-res regardless of link speed.",
    evidence_refs: ["src/app/nex-app/discover/page.tsx","src/lib/nex/agent-runtime/internet-check.ts"],
    difficulty: "S",
    user_value: "medium",
    engineering_brief: "src/lib/nex/network/bandwidth-probe.ts fetches a 1MB CDN asset, measures ms, converts to Mbps, sessionStorage-caches result. BandwidthContext exposes app-wide estimate. Discovery cards branch on estimate: text · low-res · high-res.",
  },
  {
    agent: "creative-agent:mobile-offline",
    category: "offline_mode",
    title: "Structured Offline Q&A Seed Cards",
    user_need: "Tradesperson in Bandung loses signal · today gets 'no results' · deserves a cached similar answer.",
    description: "Founder curates ~50 high-value Q&A pairs. Service worker pre-caches at /api/nex/offline/qa-seeds.json with 7-day TTL. On offline search, keyword-match against cache, return best hit with confidence >0.7 and banner 'Offline answer — cached [date]'.",
    why_missing: "Observatory tracks gaps but doesn't seed offline Q&A. No fallback close-match on offline search.",
    evidence_refs: ["src/app/nex/observatory/page.tsx","public/nex-sw.js"],
    difficulty: "M",
    user_value: "medium",
    engineering_brief: "GET /api/nex/offline/qa-seeds returning curated cards. src/lib/nex/offline/qa-matcher.ts (matchOfflineQa with Levenshtein + keyword overlap). Component OfflineQaFallback shown when offline + match ≥0.7. Founder admin POST /admin/offline-qa/seed for curation.",
  },
  {
    agent: "creative-agent:mobile-offline",
    category: "chat_answer",
    title: "Signal Strength Indicator + Proactive Save",
    user_need: "User mid-conversation on shaky hotel Wi-Fi wants their draft saved before signal drops.",
    description: "0-4 cell-bar indicator in header derived from probeInternet latency_ms. When latency >3s or state OFFLINE, auto-save conversation checkpoint (draft + messages) to IndexedDB. On page unload with poor signal, show confirm. Prompt 'Resume offline conversation' on next mount.",
    why_missing: "Internet state is probed but never visualized. Chat state not persisted across reloads.",
    evidence_refs: ["src/lib/nex/agent-runtime/internet-check.ts","src/app/nexapp/NexPolishedChat.tsx"],
    difficulty: "M",
    user_value: "high",
    engineering_brief: "SignalIndicator.tsx (interval every 10s → probeInternet latency → 0-4 bars, colour by band). src/lib/nex/offline/conversation-checkpoint.ts persists { conversation_id, draft_body, messages[], checkpoint_at } to IndexedDB. NexAppShell shows 'Resume offline conversation' badge when checkpoint exists.",
  },
  // ─── AGENT 1 · chat/data-gap ──────────────────────────────
  {
    agent: "creative-agent:chat-data-gap",
    category: "chat_answer",
    title: "Prayer Time Window Awareness for Bookings",
    user_need: "Guest asks 'can I pray during Maghrib while I'm staying?' — no prayer-time / prayer-room answer today.",
    description: "When intent touches prayer facilities or arrival time, compute Maghrib/Subuh/etc. for hotel coordinates. Cross-reference stay window: 'You check in at 15:00 · Maghrib is 17:48 · plenty of time to find the prayer room.' Honest UNKNOWN if data missing + gap ticket.",
    why_missing: "Prayer-time corpus audit exists (src/lib/nex/brain/_corpus-prayer-times-audit.test.ts) but no live connector wired. No prayer_room field in accommodation schema.",
    evidence_refs: ["src/lib/nex/brain/_corpus-prayer-times-audit.test.ts","src/lib/nex/indonesia/halal/","docs/doctrine/nex_accommodation_intelligence_agent_world_class_doctrine_2026_09_07.md"],
    difficulty: "M",
    user_value: "critical",
    engineering_brief: "Add nex.accommodation_business columns prayer_room_available bool + prayer_times_source enum(verified/claimed/unknown). Build prayer-time connector (Kemenag-style) accepting coordinates → daily schedule. deterministic-composer new intent prayer_facilities_check: retrieve hotel prayer data · fetch times for hotel city · compute overlap with user's stated stay window · compose 'Prayer room: yes/no · Maghrib {time} — plenty of buffer' or enqueue gap.",
  },
  {
    agent: "creative-agent:chat-data-gap",
    category: "chat_answer",
    title: "Monsoon-Season Travel Warnings",
    user_need: "'Can I stay in Bali in December? Is it safe during monsoon?' — today no seasonal-risk answer.",
    description: "Cross-reference BMKG monsoon data + flood/landslide risk zones + historical patterns for city + date range. Answer: 'December is monsoon in Bali — coastal low-risk · mountain regions have mudslide warnings 12-15 to 01-30. Hotel X is safe · bring umbrella.'",
    why_missing: "BMKG connector exists (src/lib/nex/indonesia/live/bmkg.ts) but never wired to accommodation discovery. No seasonal_safety_check intent.",
    evidence_refs: ["src/lib/nex/indonesia/live/bmkg.ts","src/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer.ts"],
    difficulty: "M",
    user_value: "high",
    engineering_brief: "Add nex.accommodation_business.seasonal_risk_zones JSONB (array of { month, risk_level, reason }). Populate via annual BMKG + flood-agency ingest. New intent seasonal_safety_for_dates(city, month_range) filters listings to low/medium zones + composes 'monsoon in {city}: N safe accommodations · {names}'.",
  },
  {
    agent: "creative-agent:chat-data-gap",
    category: "discovery_ui",
    title: "Halal Certified + Prayer Room Combined Finder",
    user_need: "Family wants hotels in Yogyakarta that are BPJPH halal-certified AND have prayer rooms · 3-day stay.",
    description: "Filter button '🕌 Halal + Prayer-Friendly' surfaces matches sourced from BPJPH registry + hotel prayer_room field. Cards show BPJPH badge · prayer room · family rooms · nightly rate. Detail view shows cert number/expiry/verified date + prayer times.",
    why_missing: "Halal module exists (src/lib/nex/indonesia/halal/) but not exposed in chat. No combined-filter reply type. Prayer room field doesn't exist yet.",
    evidence_refs: ["src/lib/nex/indonesia/halal/bpjph.ts","src/lib/nex/indonesia/halal/types.ts","src/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer.ts"],
    difficulty: "L",
    user_value: "critical",
    engineering_brief: "Wire halal lookup into directory-knowledge retrieval. New chat UI filter chip. Multi-filter query { city, halal_certified=true, prayer_room=true }. Reply kind 'list_with_badges' rendering name+location+halal_status+prayer_room+rate. Detail view exposes cert authority/issue/expiry/BPJPH ref. Halal refresh monthly via BPJPH API.",
  },
  {
    agent: "creative-agent:chat-data-gap",
    category: "chat_answer",
    title: "Long-Stay Kos Pricing + Lease Terms",
    user_need: "'I'm moving to Jakarta 6 months — what's monthly price for a kos near the office? Can I negotiate?'",
    description: "Detect long-stay intent (6+ months or 'kos bulanan'). Filter to kos/wisma/penginapan · retrieve monthly_rate + lease_terms. Compose 'I have 12 verified kos in Central Jakarta with 6-month leases: {names} range Rp 2.5-4M/month. Want details on contract terms or facilities?'.",
    why_missing: "Kos in taxonomy but schema has only nightly_rate. No monthly_rate/lease_terms fields. No long_stay_pricing intent in registry.",
    evidence_refs: ["src/lib/nex/intelligence-storage-grid/accommodation/taxonomy.ts","src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts"],
    difficulty: "M",
    user_value: "high",
    engineering_brief: "Add columns monthly_rate_idr int · lease_min_months int · lease_max_months int? · lease_flexibility enum(rigid/negotiable/flexible). Language-normaliser aliases 'bulan','kontrak jangka panjang','kos bulanan'. New intent long_stay_pricing (answer_kind list). Reply kind long_stay_list rendering '{name} · Rp {rate}/mo · {min}-{max} month lease · {flex}'.",
  },
  {
    agent: "creative-agent:chat-data-gap",
    category: "trust_signal",
    title: "Accessible Route Planning (Wheelchair)",
    user_need: "'Does this hotel have wheelchair access AND accessible route from street to reception? My dad uses a wheelchair.'",
    description: "Structured detail: 'ground-floor accessible room · wheelchair-accessible bathroom with grab bars · accessible path from street (8° ramp) · staff trained.' Sourced from OSM accessibility tags + structured facility data.",
    why_missing: "wheelchair_access exists as bool in intent-registry (line 315-323) but no structured detail. OSM data available (osm-overpass.ts) but not integrated into enrichment.",
    evidence_refs: ["src/lib/nex/indonesia/live/osm-overpass.ts","src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts","src/lib/nex/intelligence-storage-grid/accommodation/property-schema.ts"],
    difficulty: "L",
    user_value: "high",
    engineering_brief: "Extend BathroomConfiguration with grab_bars/shower_seat/bidet_accessible. Add columns accessible_entry_path_description text · accessible_room_count int · ground_floor_accessible_percent int. Wire Overpass query into enrichment: per-hotel coords → OSM accessibility tags (ramp/surface/barrier) → nex.accommodation_enrichment_evidence. New computed intent accessibility_route composes multi-line detail with ramp slope + room count + bathroom detail.",
  },
  {
    agent: "creative-agent:chat-data-gap",
    category: "discovery_ui",
    title: "Group Booking + Dormitory Configurator",
    user_need: "'6 friends, Yogyakarta, March' — today one query per person, no group math.",
    description: "Detect party size. Compute (1) dorm-bed options, (2) private-room combos, (3) lowest total + best-value breakdown. Show '6-bed dorm at Hostel A: Rp 150k/bed = Rp 900k' vs '3 private rooms at Guesthouse B: Rp 850k total'.",
    why_missing: "BedConfiguration.count exists but no unit_type enum distinguishing dorm_beds from private rooms. No group_booking intent.",
    evidence_refs: ["src/lib/nex/intelligence-storage-grid/accommodation/property-schema.ts","src/lib/nex/intelligence-storage-grid/accommodation/taxonomy.ts"],
    difficulty: "M",
    user_value: "medium",
    engineering_brief: "Add unit_type enum(room/dormitory_bed/bungalow_unit/villa_unit/tent_pitch). Add columns dorm_bed_count int · dorm_bed_price_idr int. Language-normaliser aliases 'kami berempat', 'teman-teman', 'grup'. Intent group_booking_config (answer_kind computed, slots party_size + dates). Composer reply kind group_booking_breakdown showing '{option} · {beds} beds · Rp {total} = Rp {per_person}/head' top-3.",
  },
  {
    agent: "creative-agent:chat-data-gap",
    category: "chat_answer",
    title: "Weather-Impact Room Recommendations",
    user_need: "'Visiting Bali next week — should I book a balcony room or stay inside during rain?'",
    description: "BMKG 3-day forecast for city + dates. Cross-recommend room features: 'Rain Tue-Wed · recommend covered balcony or lobby lounge · {names} have both.' 'High humidity · prioritize strong AC.'",
    why_missing: "BMKG 3-day fetch exists but not integrated into accommodation discovery. No weather_informed_room_features intent.",
    evidence_refs: ["src/lib/nex/indonesia/live/bmkg.ts","src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts"],
    difficulty: "S",
    user_value: "medium",
    engineering_brief: "Chat route: when user specifies dates + city, call BMKG for that window. Intent weather_room_recommendation (answer_kind relationship). Composer maps forecast (rain_percent · temp · humidity) → room features (balcony_type · ac_rating · lobby_lounge). Reply kind weather_informed_list '{date}: {weather} · recommend {feature} · {hotel} has it'.",
  },
  {
    agent: "creative-agent:chat-data-gap",
    category: "discovery_ui",
    title: "Family Filter (Cribs + Kids Club + Pool)",
    user_need: "'Traveling with 2yo and 5yo · show family-friendly hotels with cribs, kids club, pool.'",
    description: "Detect children/toddler/baby + ages. Filter to children_policy=allowed · crib_available · kids_amenities · pool_available. Cards with badges '✓ Crib · ✓ Kids Club · ✓ Pool · ✓ Family Rooms'.",
    why_missing: "children_policy exists as bool (intent-registry line 299) but no structured crib/kids_club/kids_activities. No family_filter reply type.",
    evidence_refs: ["src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts","src/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer.ts"],
    difficulty: "S",
    user_value: "medium",
    engineering_brief: "Add crib_available bool · kids_club_available bool · kids_activities array(playground/movie_room/babysitting) · family_room_count int. Language-normaliser aliases 'anak-anak','bayi','toddler','keluarga'. Intent family_friendly_filter (answer_kind list). Composer reply kind family_list '{name} · ✓ {feature} ✓ {feature}' badges.",
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  let inserted = 0, skipped = 0;
  for (const idea of IDEAS) {
    try {
      const existing = await c.query(`SELECT idea_id FROM nex_lab.innovation_ideas WHERE title = $1 LIMIT 1`, [idea.title]);
      if (existing.rows.length > 0) { skipped++; continue; }
      await c.query(
        `INSERT INTO nex_lab.innovation_ideas
           (generated_by_agent, category, title, user_need, description, why_missing, evidence_refs, engineering_brief, difficulty, user_value, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,'proposed')`,
        [idea.agent, idea.category, idea.title, idea.user_need, idea.description, idea.why_missing, JSON.stringify(idea.evidence_refs), idea.engineering_brief, idea.difficulty, idea.user_value],
      );
      inserted++;
    } catch (err) { console.error(`ERR on "${idea.title}": ${err.message}`); }
  }
  console.log(`seeded ${inserted} new ideas · ${skipped} already existed`);
  await c.end();
}
main().catch(err => { console.error("fatal:", err.message); process.exit(1); });
