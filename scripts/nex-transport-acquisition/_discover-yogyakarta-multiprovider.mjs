#!/usr/bin/env node
// scripts/nex-transport-acquisition/_discover-yogyakarta-multiprovider.mjs
//
// MULTI-PROVIDER TRANSPORT DISCOVERY · Yogyakarta.
//
// Providers (in order):
//   1. Nominatim (OSM search) · known-working from this environment · rate-limit 1/s
//   2. Overpass  · when reachable · consolidated query · falls through when 500/502
//
// Per-provider result recorded in worker_cycle_run.summary.provider_results so
// HQ page distinguishes PROVIDER_FAILED from ZERO_RESULTS.
//
// Doctrine:
//   · Public-source only · schema CHECK enforces
//   · Discovery only · stage='discovered'
//   · Zero outreach · zero dispatch
//   · Every record traces to a source snapshot

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

const BBOX = "-8.05,110.15,-7.55,110.55";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const USER_AGENT = "NEX-Discovery/0.2 (development · public-source-only)";
const POLITE_DELAY_MS = 1500;
const OVERPASS_TIMEOUT_MS = 45000;

// Nominatim search queries · keyword → (vehicleKind, providerKind, supports*)
const NOMINATIM_QUERIES = [
  // Motorcycle rental + services
  { q: "sewa motor Jogja",         vehicleKind: "motorcycle",         providerKind: "transport_business", supportsPassenger: false },
  { q: "motorcycle rental Yogyakarta", vehicleKind: "motorcycle",     providerKind: "transport_business", supportsPassenger: false },
  { q: "ojek Yogyakarta",          vehicleKind: "motorcycle",         providerKind: "transport_business", supportsPassenger: true  },
  // Car rental + private driver
  { q: "rental mobil Jogja",       vehicleKind: "car",                providerKind: "transport_business", supportsPassenger: true  },
  { q: "car rental Yogyakarta",    vehicleKind: "car",                providerKind: "transport_business", supportsPassenger: true  },
  { q: "private driver Yogyakarta",vehicleKind: "car",                providerKind: "transport_business", supportsPassenger: true  },
  // Taxi
  { q: "taxi Yogyakarta",          vehicleKind: "taxi",               providerKind: "transport_business", supportsPassenger: true  },
  // Airport transfer
  { q: "airport transfer YIA",     vehicleKind: "airport_transfer",   providerKind: "transport_business", supportsPassenger: true  },
  { q: "airport transfer Yogyakarta", vehicleKind: "airport_transfer",providerKind: "transport_business", supportsPassenger: true  },
  // Bus + minibus/elf
  { q: "sewa bus Jogja",           vehicleKind: "bus",                providerKind: "transport_business", supportsPassenger: true  },
  { q: "sewa elf Jogja",           vehicleKind: "minibus",            providerKind: "transport_business", supportsPassenger: true  },
  // Courier + logistics
  { q: "kurir Jogja",              vehicleKind: "courier",            providerKind: "courier_operator",   supportsLogistics: true  },
  { q: "jasa kirim barang Jogja",  vehicleKind: "courier",            providerKind: "courier_operator",   supportsLogistics: true  },
  { q: "logistik Yogyakarta",      vehicleKind: "logistics_operator", providerKind: "logistics_operator", supportsLogistics: true  },
  // Pickup + truck
  { q: "sewa pickup Jogja",        vehicleKind: "pickup",             providerKind: "transport_business", supportsLogistics: true  },
  { q: "sewa truk Jogja",          vehicleKind: "truck",              providerKind: "transport_business", supportsLogistics: true  },
];

const OVERPASS_FILTERS = [
  '["amenity"="taxi"]', '["office"="taxi"]',
  '["amenity"="car_rental"]', '["shop"="car_rental"]',
  '["amenity"="motorcycle_rental"]', '["shop"="motorcycle_rental"]',
  '["office"="logistics"]', '["office"="courier"]',
  '["amenity"="bus_station"]',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Utilities ─────────────────────────────────────────────────────────
function normalisePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  const wa = s.match(/wa\.me\/(\d+)/i);
  if (wa) s = wa[1];
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return null;
  let nn;
  if (hasPlus && digits.startsWith("62")) nn = digits.slice(2);
  else if (digits.startsWith("62")) nn = digits.slice(2);
  else if (digits.startsWith("0")) nn = digits.slice(1);
  else return null;
  if (nn.length < 9 || nn.length > 12) return null;
  return `+62${nn}`;
}
const buildWaLink = (e164) => (e164 && e164.startsWith("+62") ? `https://wa.me/${e164.slice(1)}` : null);
const newId = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
});

async function openCycleRun() {
  const q = await pool.query(
    `INSERT INTO nex.worker_cycle_run (worker_id, worker_type, worker_config, started_at, status)
     VALUES ('acquisition:transport:Yogyakarta', 'acquisition', 'transport:Yogyakarta:multiprovider', now(), 'running')
     RETURNING id`,
  );
  return q.rows[0].id;
}
async function closeCycleRun(cycleRunId, status, summary) {
  await pool.query(
    `UPDATE nex.worker_cycle_run
        SET finished_at = now(),
            duration_ms = EXTRACT(MILLISECONDS FROM (now() - started_at))::int,
            status = $1,
            records_processed = $2,
            records_new = $3,
            errors_count = $4,
            summary = $5::jsonb
      WHERE id = $6`,
    [status, summary.processed, summary.persisted, summary.errors, JSON.stringify(summary), cycleRunId],
  );
}

// ── Insert (idempotent by canonical_phone_e164 · fallback business_name+jurisdiction) ─
async function insertRecord(rec, snap) {
  await pool.query("BEGIN");
  try {
    let insert;
    if (rec.canonicalPhoneE164) {
      insert = await pool.query(
        `INSERT INTO nex.transport_acquisition_record (
           provider_id, provider_kind, business_name,
           canonical_phone_e164, public_whatsapp_link, public_email, website,
           home_jurisdiction, city, province,
           vehicle_types, vehicle_models_public,
           supports_airport, supports_parcel, supports_passenger, supports_tourist, supports_logistics,
           discovery_stage, contactability, review_flags,
           first_discovered_at, last_seen_at, provenance
         ) VALUES ($1, $2::nex.transport_provider_kind, $3, $4, $5, $6, $7, $8, $9, $10,
                   $11::nex.transport_vehicle_ontology[], $12::jsonb,
                   $13, $14, $15, $16, $17,
                   'discovered', $18::nex.transport_contactability, '{}'::nex.transport_review_flag[],
                   now(), now(), $19::jsonb)
         ON CONFLICT (canonical_phone_e164) DO UPDATE SET
           last_seen_at = now(),
           vehicle_types = (SELECT array_agg(DISTINCT v) FROM unnest(nex.transport_acquisition_record.vehicle_types || EXCLUDED.vehicle_types) as v)
         RETURNING provider_id`,
        [rec.providerId, rec.providerKind, rec.businessName,
         rec.canonicalPhoneE164, rec.publicWhatsappLink, rec.publicEmail, rec.website,
         rec.homeJurisdiction, rec.city, rec.province,
         rec.vehicleTypes, JSON.stringify([]),
         false, !!rec.supportsLogistics, !!rec.supportsPassenger, false, !!rec.supportsLogistics,
         rec.contactability, JSON.stringify(rec.provenance)],
      );
    } else {
      // No phone · fallback dedupe on name+jurisdiction. Insert without conflict target.
      insert = await pool.query(
        `INSERT INTO nex.transport_acquisition_record (
           provider_id, provider_kind, business_name,
           canonical_phone_e164, public_whatsapp_link, public_email, website,
           home_jurisdiction, city, province,
           vehicle_types, vehicle_models_public,
           supports_airport, supports_parcel, supports_passenger, supports_tourist, supports_logistics,
           discovery_stage, contactability, review_flags,
           first_discovered_at, last_seen_at, provenance
         ) VALUES ($1, $2::nex.transport_provider_kind, $3, NULL, NULL, $4, $5, $6, $7, $8,
                   $9::nex.transport_vehicle_ontology[], $10::jsonb,
                   $11, $12, $13, $14, $15,
                   'discovered', $16::nex.transport_contactability, '{}'::nex.transport_review_flag[],
                   now(), now(), $17::jsonb)
         RETURNING provider_id`,
        [rec.providerId, rec.providerKind, rec.businessName,
         rec.publicEmail, rec.website,
         rec.homeJurisdiction, rec.city, rec.province,
         rec.vehicleTypes, JSON.stringify([]),
         false, !!rec.supportsLogistics, !!rec.supportsPassenger, false, !!rec.supportsLogistics,
         rec.contactability, JSON.stringify(rec.provenance)],
      );
    }
    const providerId = insert.rows[0].provider_id;
    await pool.query(
      `INSERT INTO nex.transport_acquisition_source_snapshot (
         snapshot_id, provider_id, source_url, source_kind, source_captured_at,
         source_licence_terms, raw_payload, public_evidence_note, ingested_by
       ) VALUES ($1, $2, $3, $4::nex.transport_source_kind, now(), $5, $6::jsonb, $7, $8)`,
      [snap.snapshotId, providerId, snap.sourceUrl, snap.sourceKind, snap.sourceLicenceTerms,
       JSON.stringify(snap.rawPayload), snap.publicEvidenceNote, snap.ingestedBy],
    );
    await pool.query("COMMIT");
    return { providerId, isNew: true };
  } catch (e) {
    await pool.query("ROLLBACK");
    // ON CONFLICT DO UPDATE returns row · non-conflict errors bubble
    if (String(e.message).includes("duplicate key")) return { providerId: null, isNew: false };
    throw e;
  }
}

// ── Provider: Nominatim ──────────────────────────────────────────────
async function providerNominatim(providerReport) {
  console.log("── PROVIDER: NOMINATIM ────────────────────────────────────────");
  const perQueryCounts = {};
  let totalReturned = 0, totalPersisted = 0, totalSkipped = 0;
  let providerErrors = 0;

  for (const q of NOMINATIM_QUERIES) {
    await sleep(POLITE_DELAY_MS);
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", q.q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "20");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("viewbox", "110.15,-7.55,110.55,-8.05");
    url.searchParams.set("bounded", "1");

    let results;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30000);
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.log(`   "${q.q}" → HTTP ${res.status}`);
        providerErrors++;
        continue;
      }
      results = await res.json();
    } catch (e) {
      console.log(`   "${q.q}" → ${e.message}`);
      providerErrors++;
      continue;
    }
    console.log(`   "${q.q}" → ${results.length} result(s)`);
    perQueryCounts[q.q] = { returned: results.length, persisted: 0 };
    totalReturned += results.length;

    for (const el of results) {
      const displayName = el.namedetails?.name || el.name || (el.display_name ? el.display_name.split(",")[0] : null);
      if (!displayName || displayName.trim().length < 2) { totalSkipped++; continue; }
      const extratags = el.extratags || {};
      const rawPhone = extratags.phone || extratags["contact:phone"] || extratags.mobile || null;
      const email = extratags["contact:email"] || extratags.email || null;
      const website = extratags["contact:website"] || extratags.website || null;
      const canonicalPhone = normalisePhone(rawPhone);
      // Relaxed rule: accept records with name+location even without public contact.
      // These are legitimately-discovered businesses · contactability marked 'unknown'.
      // Recruitment layer will filter to contactable rows when the time comes.

      const providerId = newId(), snapshotId = newId();
      const osmType = el.osm_type || "node";
      const osmId = el.osm_id || el.place_id;
      const osmUrl = `https://www.openstreetmap.org/${osmType}/${osmId}`;
      const addr = el.address || {};

      const record = {
        providerId,
        providerKind: q.providerKind,
        businessName: displayName,
        canonicalPhoneE164: canonicalPhone,
        publicWhatsappLink: buildWaLink(canonicalPhone) || extratags["contact:whatsapp"] || null,
        publicEmail: email,
        website,
        homeJurisdiction: "ID/DIY/Yogyakarta",
        city: addr.city || addr.town || addr.county || null,
        province: addr.state || "DIY",
        vehicleTypes: [q.vehicleKind],
        supportsPassenger: q.supportsPassenger,
        supportsLogistics: q.supportsLogistics,
        contactability: canonicalPhone ? "contactable" : (rawPhone ? "invalid" : "unknown"),
        provenance: {
          composer: "transport-walker-multiprovider/nominatim/v0.1",
          nominatim_query: q.q,
          osm_ref: osmUrl,
          lat: el.lat, lon: el.lon,
          place_id: el.place_id,
          display_name: el.display_name,
        },
      };
      const snapshot = {
        snapshotId,
        sourceUrl: osmUrl,
        sourceKind: "public_maps_listing",
        sourceLicenceTerms: "ODbL-1.0",
        rawPayload: { nominatim_query: q.q, element: el },
        publicEvidenceNote: `Nominatim search for "${q.q}" returned ${osmType}/${osmId}.`,
        ingestedBy: "transport-walker-multiprovider/nominatim/v0.1",
      };

      try {
        const r = await insertRecord(record, snapshot);
        if (r.isNew) { totalPersisted++; perQueryCounts[q.q].persisted++; }
      } catch (e) {
        console.log(`     insert error: ${e.message}`);
        providerErrors++;
      }
    }
  }
  providerReport.push({
    provider: "nominatim",
    status: providerErrors > 0 && totalPersisted === 0 ? "FAILED" : "SUCCESS",
    returned: totalReturned,
    persisted: totalPersisted,
    skipped: totalSkipped,
    errors: providerErrors,
    per_query: perQueryCounts,
  });
  return { totalReturned, totalPersisted, totalSkipped, providerErrors };
}

// ── Provider: Overpass (fallback · quick-fail if 500) ────────────────
async function providerOverpass(providerReport) {
  console.log("\n── PROVIDER: OVERPASS (fallback) ─────────────────────────────");
  const body = OVERPASS_FILTERS.map((f) => `nwr${f}(${BBOX});`).join("\n  ");
  const query = `[out:json][timeout:60];\n(\n  ${body}\n);\nout center tags;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: "data=" + encodeURIComponent(query),
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { console.log(`   ${endpoint} → HTTP ${res.status}`); continue; }
      const text = await res.text();
      if (!text) { console.log(`   ${endpoint} → empty`); continue; }
      const j = JSON.parse(text);
      const elements = j.elements || [];
      console.log(`   ${endpoint} → ${elements.length} feature(s)`);
      let persisted = 0;
      for (const el of elements) {
        const tags = el.tags || {};
        const name = tags.name || tags["name:id"] || tags["name:en"];
        if (!name) continue;
        const rawPhone = tags.phone || tags["contact:phone"];
        const canonicalPhone = normalisePhone(rawPhone);
        const anyContact = canonicalPhone || tags["contact:email"] || tags.website || tags["contact:whatsapp"];
        if (!anyContact) continue;
        let vk = "unknown", pk = "transport_business", passenger = true, logistics = false;
        if (tags.amenity === "taxi" || tags.office === "taxi")            { vk = "taxi"; }
        else if (tags.amenity === "car_rental" || tags.shop === "car_rental") { vk = "car"; }
        else if (tags.amenity === "motorcycle_rental" || tags.shop === "motorcycle_rental") { vk = "motorcycle"; passenger = false; }
        else if (tags.office === "logistics" || tags.office === "courier") { vk = "logistics_operator"; pk = "logistics_operator"; passenger = false; logistics = true; }
        else if (tags.amenity === "bus_station") { vk = "bus"; }
        const providerId = newId(), snapshotId = newId();
        const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;
        try {
          const r = await insertRecord({
            providerId, providerKind: pk, businessName: name,
            canonicalPhoneE164: canonicalPhone,
            publicWhatsappLink: buildWaLink(canonicalPhone) || tags["contact:whatsapp"] || null,
            publicEmail: tags["contact:email"] || tags.email || null,
            website: tags["contact:website"] || tags.website || null,
            homeJurisdiction: "ID/DIY/Yogyakarta",
            city: tags["addr:city"] || null, province: tags["addr:province"] || "DIY",
            vehicleTypes: [vk], supportsPassenger: passenger, supportsLogistics: logistics,
            contactability: canonicalPhone ? "contactable" : (rawPhone ? "invalid" : "unknown"),
            provenance: { composer: "transport-walker-multiprovider/overpass/v0.1", osm_ref: osmUrl },
          }, {
            snapshotId, sourceUrl: osmUrl, sourceKind: "public_business_directory",
            sourceLicenceTerms: "ODbL-1.0", rawPayload: { tags, osm_type: el.type, osm_id: el.id, lat: el.lat, lng: el.lon },
            publicEvidenceNote: `Overpass consolidated query returned ${el.type}/${el.id}.`,
            ingestedBy: "transport-walker-multiprovider/overpass/v0.1",
          });
          if (r.isNew) persisted++;
        } catch (e) {
          console.log(`     insert error: ${e.message}`);
        }
      }
      providerReport.push({
        provider: "overpass",
        endpoint,
        status: "SUCCESS",
        returned: elements.length,
        persisted,
      });
      return { totalReturned: elements.length, totalPersisted: persisted };
    } catch (e) {
      clearTimeout(timer);
      console.log(`   ${endpoint} → ${e.message}`);
    }
  }
  providerReport.push({ provider: "overpass", status: "FAILED", returned: 0, persisted: 0, note: "all mirrors 500/timeout" });
  return { totalReturned: 0, totalPersisted: 0 };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  TRANSPORT WALKER · MULTI-PROVIDER · YOGYAKARTA                          ║");
  console.log("║  Nominatim (primary · known-working) · Overpass (fallback)               ║");
  console.log("║  0 outreach · 0 dispatch · public sources only                            ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  const cycleRunId = await openCycleRun();
  console.log(`cycle_run_id: ${cycleRunId}\n`);

  const providerReport = [];
  const nom = await providerNominatim(providerReport);
  const ovp = await providerOverpass(providerReport);
  const totalReturned = nom.totalReturned + ovp.totalReturned;
  const totalPersisted = nom.totalPersisted + ovp.totalPersisted;

  console.log("\n── SUMMARY ────────────────────────────────────────────────────");
  console.log(`  total returned    : ${totalReturned}`);
  console.log(`  total persisted   : ${totalPersisted}`);
  console.log(`  runtime           : ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log("");
  for (const p of providerReport) {
    console.log(`  ${p.provider.padEnd(12)} status=${p.status.padEnd(8)} returned=${p.returned} persisted=${p.persisted}`);
  }

  const anySuccess = providerReport.some((p) => p.status === "SUCCESS");
  await closeCycleRun(cycleRunId, anySuccess ? "completed" : "failed", {
    processed: totalReturned,
    persisted: totalPersisted,
    errors: providerReport.filter((p) => p.status !== "SUCCESS").length,
    provider_results: providerReport,
    runtime_ms: Date.now() - started,
  });
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
