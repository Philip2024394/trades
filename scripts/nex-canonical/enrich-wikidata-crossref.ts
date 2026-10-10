// scripts/nex-canonical/enrich-wikidata-crossref.ts
//
// NEX Canonical · Wikidata cross-reference enrichment runner.
//
// Objective
//   For each candidate in the pending-review queue, cross-reference
//   Wikidata by (name, country, [coordinates]) and surface:
//
//     · QID              (the Wikidata entity id · Q#)
//     · P131             (located in admin territorial entity)
//     · P625             (coordinates)
//     · P856             (official website)
//     · P1329            (phone)
//     · P18              (image file name · for internal provenance only)
//
//   Discovered values are written to nex.discovery_business_evidence
//   with `discovered_via_source='wikidata'`. Even though Wikidata is a
//   can_display=FALSE source (per the Section-M attribution rules in
//   migration 182) — meaning NEX never publishes Wikidata-sourced copy
//   verbatim — evidence can still be stored and used for internal
//   fact-checking during Founder promotion review.
//
// Governance hard-locks preserved
//   · Zero fabrication · P-value absent → `null` + skip that field.
//   · The Founder-signed allowlist (`data/nex-page-fetcher-allowlist.json`)
//     currently does NOT include `www.wikidata.org` or `query.wikidata.org`.
//     Until it does, this runner stays dormant · it never issues an HTTPS
//     request and always exits with `stage: "dormant"`.
//   · When the host IS added to the allowlist, construction remains gated
//     behind `resolveProductionHarvestAdapters` just like the OSM path.
//     We never hard-code the host · never bypass the allowlist.
//   · Dry-run default. `--live` is required to open a DB connection and
//     persist evidence rows. Without it, the runner reports what WOULD be
//     written and exits with 0.
//   · Append-only evidence · UNIQUE (programme_id, iso_alpha_2,
//     business_name, website_url) prevents duplicate rows.
//   · Never writes to nex.food_business or nex.business_canonical.
//   · Never auto-promotes lifecycle_state · Founder decision remains the
//     sole promotion mechanism (Rule-5m).
//
// Status: DORMANT-BY-DESIGN · the SPARQL fetcher below is injectable so
// that tests can exercise the full pipeline, but the main() entrypoint
// resolves it via `resolveWikidataFetcher()` which currently returns the
// NULL fetcher unless `NEX_PAGE_FETCHER_ACTIVATION === "on"` AND the
// allowlist includes a Wikidata host.
//
// CLI shape
//   tsx scripts/nex-canonical/enrich-wikidata-crossref.ts \
//     --pending-queue=<path>        (required)
//     --limit=<n>                   (required · [1, 1000])
//     [--offset=<n>]                (optional · default 0)
//     [--evidence-log=<path>]       (optional · defaults to
//                                     data/nex-canonical/wikidata-xref-log-<utc>.jsonl)
//     [--live]                      (opt-in · writes evidence rows)
//     [--programme-slug=<slug>]     (default "nex-wikidata-crossref")
//
// EXIT CODES
//   0  · runner_completed (dormant OR live)
//   1  · preflight (CLI args) refused
//   2  · pending queue unreadable
//   3  · adapter construction refused in --live mode (safety stop)
//  99  · unexpected error

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { canonicaliseWebsite } from "@/lib/nex/harvest/overpass-adapter";
import { resolveProductionHarvestAdapters } from "@/lib/nex/harvest/production-boot";

// ─── Candidate input shape ──────────────────────────────────────────
export interface IdentitySnapshot {
  readonly name_canonical: string | null;
  readonly website_apex: string | null;
  readonly phone_e164: string | null;
  readonly address: string | null;
  readonly wikidata_qid: string | null;
  readonly coordinates: { lat: number; lng: number } | null;
}

export interface LoadedCandidate {
  readonly candidate_id: string;
  readonly country: string;
  readonly identity: IdentitySnapshot;
  readonly entity_type: string;
}

// ─── Pure: load candidates from pending-review JSONL ────────────────
interface PendingReviewLine {
  readonly candidate_id?: string;
  readonly review_package?: {
    readonly candidates?: ReadonlyArray<{
      readonly candidate_id: string;
      readonly country?: string;
      readonly entity_type?: string;
      readonly identity?: Partial<IdentitySnapshot> & {
        readonly coordinates?: { lat: number; lng: number } | null;
      };
    }>;
  };
}

export interface LoadOptions {
  readonly limit: number;
  readonly offset?: number;
}

export async function loadCandidates(
  queuePath: string,
  opts: LoadOptions,
): Promise<LoadedCandidate[]> {
  const text = await fs.readFile(queuePath, "utf8");
  const offset = opts.offset ?? 0;
  const out: LoadedCandidate[] = [];
  const seen = new Set<string>();
  let eligible_seen = 0;
  for (const line of text.split(/\r?\n/)) {
    if (out.length >= opts.limit) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: PendingReviewLine;
    try { obj = JSON.parse(trimmed) as PendingReviewLine; } catch { continue; }
    const c = obj.review_package?.candidates?.[0];
    if (!c) continue;
    if (seen.has(c.candidate_id)) continue;
    seen.add(c.candidate_id);
    const id = c.identity ?? {};
    // Must have a name to cross-reference · zero-fabrication rule.
    if (!id.name_canonical) continue;
    if (eligible_seen < offset) { eligible_seen++; continue; }
    eligible_seen++;
    const snapshot: IdentitySnapshot = {
      name_canonical: id.name_canonical ?? null,
      website_apex: id.website_apex ?? null,
      phone_e164: id.phone_e164 ?? null,
      address: id.address ?? null,
      wikidata_qid: id.wikidata_qid ?? null,
      coordinates: id.coordinates ?? null,
    };
    out.push({
      candidate_id: c.candidate_id,
      country: (c.country ?? "ID").toUpperCase(),
      identity: snapshot,
      entity_type: c.entity_type ?? "food",
    });
  }
  return out;
}

// ─── Pure: build SPARQL query by (name, country, [coordinates]) ─────
export interface SparqlQueryInput {
  readonly name: string;
  readonly iso_alpha_2: string;
  readonly coordinates: { lat: number; lng: number } | null;
}

/** Builds a conservative Wikidata SPARQL query:
 *    · filters by (rdfs:label OR skos:altLabel) case-insensitive match on name
 *    · constrains to items with P17 (country) matching the ISO alpha-2
 *    · if coordinates provided, bounds P625 by a ~1km bbox
 *    · returns QID, P131, P625, P856, P1329, P18 (nullable)
 *  PURE · deterministic · never allocates network. */
export function buildWikidataSparql(input: SparqlQueryInput): string {
  const safeName = input.name.replace(/[\\"]/g, "\\$&");
  const safeIso = input.iso_alpha_2.toUpperCase().replace(/[^A-Z]/g, "");
  const bboxClause = input.coordinates
    ? bboxFilterClause(input.coordinates.lat, input.coordinates.lng, 0.01)
    : "";
  return `SELECT ?item ?itemLabel ?admin ?adminLabel ?coord ?website ?phone ?image WHERE {
  ?item rdfs:label|skos:altLabel ?label .
  FILTER(LANG(?label) IN ("en", "id", "mul")) .
  FILTER(LCASE(STR(?label)) = LCASE("${safeName}")) .
  ?item wdt:P17 ?country .
  ?country wdt:P297 "${safeIso}" .
  OPTIONAL { ?item wdt:P131 ?admin . }
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P1329 ?phone . }
  OPTIONAL { ?item wdt:P18 ?image . }
  ${bboxClause}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 5`;
}

function bboxFilterClause(lat: number, lng: number, half_deg: number): string {
  const minLat = lat - half_deg;
  const maxLat = lat + half_deg;
  const minLng = lng - half_deg;
  const maxLng = lng + half_deg;
  return `BIND(IF(BOUND(?coord), geof:latitude(?coord), 0) AS ?clat) .
  BIND(IF(BOUND(?coord), geof:longitude(?coord), 0) AS ?clng) .
  FILTER(!BOUND(?coord) || (?clat >= ${minLat} && ?clat <= ${maxLat} && ?clng >= ${minLng} && ?clng <= ${maxLng})) .`;
}

// ─── Pure: parse Wikidata SPARQL JSON response ─────────────────────
export interface WikidataBinding {
  readonly item: string | null;
  readonly qid: string | null;
  readonly admin: string | null;
  readonly admin_label: string | null;
  readonly coord: string | null;
  readonly website: string | null;
  readonly phone: string | null;
  readonly image: string | null;
}

export function parseWikidataResponse(text: string): WikidataBinding[] {
  let j: {
    results?: {
      bindings?: Array<Record<string, { value?: string } | undefined>>;
    };
  };
  try { j = JSON.parse(text); } catch { return []; }
  const bindings = j.results?.bindings ?? [];
  const out: WikidataBinding[] = [];
  for (const b of bindings) {
    const itemUri = b.item?.value ?? null;
    const qid = itemUri ? extractQid(itemUri) : null;
    out.push({
      item: itemUri,
      qid,
      admin: b.admin?.value ?? null,
      admin_label: b.adminLabel?.value ?? null,
      coord: b.coord?.value ?? null,
      website: b.website?.value ?? null,
      phone: b.phone?.value ?? null,
      image: b.image?.value ?? null,
    });
  }
  return out;
}

export function extractQid(uri: string): string | null {
  const m = uri.match(/\/(Q\d+)$/);
  return m ? m[1] : null;
}

export function parseCoordPoint(coord: string | null): { lat: number; lng: number } | null {
  if (!coord) return null;
  const m = coord.match(/^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i);
  if (!m) return null;
  const lng = Number.parseFloat(m[1]);
  const lat = Number.parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// ─── Pure: diff Wikidata binding vs candidate snapshot ─────────────
export type WikidataField = "qid" | "admin" | "website" | "phone" | "image";

export interface WikidataDelta {
  readonly qid: string | null;
  readonly admin: string | null;
  readonly admin_label: string | null;
  readonly website: string | null;
  readonly phone: string | null;
  readonly image: string | null;
  readonly coord: { lat: number; lng: number } | null;
  readonly fields_new: readonly WikidataField[];
}

export function computeWikidataDelta(
  b: WikidataBinding,
  snapshot: IdentitySnapshot,
): WikidataDelta {
  const fields_new_mut: WikidataField[] = [];
  if (b.qid && b.qid !== snapshot.wikidata_qid) fields_new_mut.push("qid");
  if (b.admin) fields_new_mut.push("admin");
  if (b.website) {
    const canonicalisedCandidate = canonicaliseWebsite(snapshot.website_apex);
    const canonicalisedWd = canonicaliseWebsite(b.website);
    if (canonicalisedWd !== null && canonicalisedWd !== canonicalisedCandidate) {
      fields_new_mut.push("website");
    }
  }
  if (b.phone && b.phone !== snapshot.phone_e164) fields_new_mut.push("phone");
  if (b.image) fields_new_mut.push("image");

  return {
    qid: b.qid,
    admin: b.admin,
    admin_label: b.admin_label,
    website: b.website,
    phone: b.phone,
    image: b.image,
    coord: parseCoordPoint(b.coord),
    fields_new: fields_new_mut,
  };
}

// ─── CLI parsing ────────────────────────────────────────────────────
export interface Cli {
  readonly pending_queue: string;
  readonly limit: number;
  readonly offset: number;
  readonly evidence_log: string;
  readonly live: boolean;
  readonly programme_slug: string;
}

export function defaultEvidenceLogPath(now: Date): string {
  const utc = now.toISOString().replace(/[:.]/g, "-");
  return path.posix.join("data", "nex-canonical", `wikidata-xref-log-${utc}.jsonl`);
}

export function parseCli(argv: readonly string[], now: Date = new Date()): Cli {
  const get = (name: string): string | null => {
    const needle = `--${name}=`;
    for (const a of argv) if (a.startsWith(needle)) return a.slice(needle.length);
    return null;
  };
  const has = (name: string): boolean => argv.includes(`--${name}`);
  const pending_queue = get("pending-queue");
  const limitRaw = get("limit");
  const offsetRaw = get("offset");
  const evidence_log = get("evidence-log");
  if (!pending_queue) throw new Error("missing --pending-queue=<path>");
  if (!limitRaw) throw new Error("missing --limit=<n>");
  const limit = Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 1000) {
    throw new Error(`--limit must be an integer in [1, 1000]; got ${limitRaw}`);
  }
  let offset = 0;
  if (offsetRaw !== null) {
    offset = Number.parseInt(offsetRaw, 10);
    if (!Number.isFinite(offset) || offset < 0) {
      throw new Error(`--offset must be a non-negative integer; got ${offsetRaw}`);
    }
  }
  return {
    pending_queue,
    limit,
    offset,
    evidence_log: evidence_log ?? defaultEvidenceLogPath(now),
    live: has("live"),
    programme_slug: get("programme-slug") ?? "nex-wikidata-crossref",
  };
}

// ─── Fetcher abstraction (injectable · never hits the network in tests) ─
export type WikidataProbeKind =
  | "responded"
  | "responded_zero"
  | "unavailable"
  | "rate_limited"
  | "parse_error"
  | "adapter_dormant";

export interface WikidataProbeResult {
  readonly kind: WikidataProbeKind;
  readonly bindings: readonly WikidataBinding[];
  readonly bytes: number;
  readonly ms: number;
  readonly note: string | null;
}

export interface WikidataFetcher {
  readonly source_id: string;
  probe(input: { readonly sparql: string; readonly timeout_ms: number }): Promise<WikidataProbeResult>;
}

export const NULL_WIKIDATA_FETCHER: WikidataFetcher = {
  source_id: "null-wikidata",
  async probe() {
    return {
      kind: "adapter_dormant",
      bindings: [],
      bytes: 0,
      ms: 0,
      note: "Wikidata host not in Founder-signed allowlist · fetcher is idle.",
    };
  },
};

/** Fixture fetcher for tests · returns a deterministic canned response. */
export function makeFixtureWikidataFetcher(payload: {
  readonly kind?: WikidataProbeKind;
  readonly bindings?: readonly WikidataBinding[];
  readonly latency_ms?: number;
}): WikidataFetcher {
  return {
    source_id: "fixture-wikidata",
    async probe() {
      return {
        kind: payload.kind ?? (payload.bindings && payload.bindings.length > 0 ? "responded" : "responded_zero"),
        bindings: payload.bindings ?? [],
        bytes: JSON.stringify(payload.bindings ?? []).length,
        ms: payload.latency_ms ?? 0,
        note: null,
      };
    },
  };
}

// ─── Pure: inspect allowlist text for a Wikidata host ──────────────
export function allowlistHasWikidataHost(text: string): boolean {
  try {
    const al = JSON.parse(text) as { allowed_hosts?: Array<{ host?: string }> };
    const hosts = (al.allowed_hosts ?? []).map((h) => (h.host ?? "").toLowerCase());
    return hosts.some((h) => h.endsWith("wikidata.org"));
  } catch { return false; }
}

/** Resolve the Wikidata fetcher via the same sealed gate as Overpass. */
export interface WikidataResolution {
  readonly fetcher: WikidataFetcher;
  readonly source: "production" | "null_defaults";
  readonly reason: string;
  readonly allowlist_path: string;
}

export async function resolveWikidataFetcher(
  env: NodeJS.ProcessEnv,
  deps?: {
    readonly make_production?: (hosts: readonly string[]) => WikidataFetcher;
    readonly read_file?: (p: string) => Promise<string>;
  },
): Promise<WikidataResolution> {
  const sealed = await resolveProductionHarvestAdapters({ env });
  if (sealed.source !== "production") {
    return {
      fetcher: NULL_WIKIDATA_FETCHER,
      source: "null_defaults",
      reason: sealed.reason,
      allowlist_path: sealed.allowlist_path_resolved,
    };
  }
  let allowlist_text = "";
  try {
    allowlist_text = deps?.read_file
      ? await deps.read_file(sealed.allowlist_path_resolved)
      : await fs.readFile(sealed.allowlist_path_resolved, "utf8");
  } catch (e) {
    return {
      fetcher: NULL_WIKIDATA_FETCHER,
      source: "null_defaults",
      reason: `allowlist unreadable: ${(e as Error).message}`,
      allowlist_path: sealed.allowlist_path_resolved,
    };
  }
  if (!allowlistHasWikidataHost(allowlist_text)) {
    return {
      fetcher: NULL_WIKIDATA_FETCHER,
      source: "null_defaults",
      reason: "no wikidata.org host in Founder-signed allowlist · fetcher dormant",
      allowlist_path: sealed.allowlist_path_resolved,
    };
  }
  if (!deps?.make_production) {
    return {
      fetcher: NULL_WIKIDATA_FETCHER,
      source: "null_defaults",
      reason: "wikidata host allowlisted but no production fetcher factory injected · staying dormant",
      allowlist_path: sealed.allowlist_path_resolved,
    };
  }
  const al = JSON.parse(allowlist_text) as { allowed_hosts?: Array<{ host?: string }> };
  const hosts = (al.allowed_hosts ?? []).map((h) => h.host!).filter(Boolean);
  return {
    fetcher: deps.make_production(hosts),
    source: "production",
    reason: `wikidata fetcher constructed · ${hosts.length} founder-signed host(s)`,
    allowlist_path: sealed.allowlist_path_resolved,
  };
}

// ─── Pure: resolve rate-limit for wikidata host ────────────────────
export function resolveMinIntervalMs(allowlist_text: string): number {
  try {
    const al = JSON.parse(allowlist_text) as {
      allowed_hosts?: Array<{ host?: string; min_interval_ms?: number }>;
    };
    const match = (al.allowed_hosts ?? []).find((h) => typeof h.host === "string" && h.host.toLowerCase().endsWith("wikidata.org"));
    if (match && typeof match.min_interval_ms === "number" && match.min_interval_ms >= 0) {
      return match.min_interval_ms;
    }
  } catch { /* keep default */ }
  // Default to 5 seconds · Wikidata query service is public but shared.
  return 5000;
}

// ─── Evidence write (live mode only) ───────────────────────────────
export interface EvidenceInput {
  readonly candidate_id: string;
  readonly country: string;
  readonly business_name: string;
  readonly delta: WikidataDelta;
  readonly all_bindings_count: number;
}

async function writeEvidenceLive(
  client: Client,
  programme_id: string,
  rows: readonly EvidenceInput[],
): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const r of rows) {
    await client.query(
      `INSERT INTO nex.discovery_business_evidence
        (programme_id, iso_alpha_2, business_name, website_url,
         services, category, discovered_via_term, discovered_via_source,
         discovered_via_evidence_url, metadata)
       VALUES ($1, $2, $3, $4, '{}'::text[], NULL, $5, $6, $7, $8::jsonb)
       ON CONFLICT (programme_id, iso_alpha_2, business_name, website_url) DO UPDATE
         SET last_seen_at = now(),
             metadata = EXCLUDED.metadata`,
      [
        programme_id,
        r.country.toUpperCase(),
        r.business_name,
        r.delta.website,
        `wikidata_crossref:${r.delta.qid ?? "no-qid"}`,
        "wikidata",
        r.delta.qid ? `https://www.wikidata.org/wiki/${r.delta.qid}` : null,
        JSON.stringify({
          candidate_id: r.candidate_id,
          qid: r.delta.qid,
          admin: r.delta.admin,
          admin_label: r.delta.admin_label,
          phone: r.delta.phone,
          image: r.delta.image,
          coord: r.delta.coord,
          delta_fields_new: r.delta.fields_new,
          match_count: r.all_bindings_count,
          internal_only: true,
          attribution_note: "wikidata is can_display=FALSE · internal fact-check only",
        }),
      ],
    );
    inserted++;
  }
  return { inserted };
}

async function ensureProgrammeLive(client: Client, slug: string): Promise<string> {
  const existing = await client.query(
    `SELECT programme_id FROM nex.discovery_programme WHERE slug = $1`,
    [slug],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0].programme_id as string;
  }
  const inserted = await client.query(
    `INSERT INTO nex.discovery_programme (slug, display_name, topic, description, status)
     VALUES ($1, $2, $3, $4, 'active') RETURNING programme_id`,
    [
      slug,
      "NEX · Wikidata cross-reference enrichment",
      "general",
      "Cross-reference candidate (name, country, coordinates) against Wikidata · QID/P131/P625/P856/P1329/P18. Evidence is internal-only (Wikidata is can_display=FALSE under Section-M attribution rules).",
    ],
  );
  return inserted.rows[0].programme_id as string;
}

// ─── Orchestration (pure w.r.t. IO · injectable) ───────────────────
export interface RunReport {
  stage: "dormant" | "probed" | "stopped";
  stop_reason: string | null;
  fetcher_source: "production" | "null_defaults";
  fetcher_reason: string;
  allowlist_path: string;
  candidates_read: number;
  probes_attempted: number;
  probes_responded: number;
  probes_responded_zero: number;
  probes_dormant: number;
  probes_rate_limited: number;
  probes_parse_error: number;
  probes_unavailable: number;
  fields_new_counts: Record<string, number>;
  evidence_rows_dryrun_logged: number;
  evidence_rows_written: number;
  min_interval_ms: number;
  offset_applied: number;
}

export interface OrchestrateDeps {
  readonly fetcher_resolution: {
    readonly fetcher: WikidataFetcher;
    readonly source: "production" | "null_defaults";
    readonly reason: string;
    readonly allowlist_path: string;
  };
  readonly candidates: readonly LoadedCandidate[];
  readonly min_interval_ms: number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly append_evidence_log: (line: string) => Promise<void>;
  readonly write_live_rows?: (rows: readonly EvidenceInput[]) => Promise<{ inserted: number }>;
  readonly offset_applied: number;
  readonly live: boolean;
}

export async function orchestrateWikidataCrossref(deps: OrchestrateDeps): Promise<RunReport> {
  const { fetcher_resolution: fr, candidates, min_interval_ms, sleep, append_evidence_log, write_live_rows, offset_applied, live } = deps;

  const report: RunReport = {
    stage: fr.source === "production" ? "probed" : "dormant",
    stop_reason: null,
    fetcher_source: fr.source,
    fetcher_reason: fr.reason,
    allowlist_path: fr.allowlist_path,
    candidates_read: candidates.length,
    probes_attempted: 0,
    probes_responded: 0,
    probes_responded_zero: 0,
    probes_dormant: 0,
    probes_rate_limited: 0,
    probes_parse_error: 0,
    probes_unavailable: 0,
    fields_new_counts: {},
    evidence_rows_dryrun_logged: 0,
    evidence_rows_written: 0,
    min_interval_ms,
    offset_applied,
  };

  const liveRows: EvidenceInput[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (i > 0) await sleep(min_interval_ms);
    if (!c.identity.name_canonical) continue;
    const sparql = buildWikidataSparql({
      name: c.identity.name_canonical,
      iso_alpha_2: c.country,
      coordinates: c.identity.coordinates,
    });
    const probe = await fr.fetcher.probe({ sparql, timeout_ms: 60_000 });
    report.probes_attempted++;

    if (probe.kind === "adapter_dormant") {
      report.probes_dormant++;
      await append_evidence_log(JSON.stringify({
        at: new Date().toISOString(),
        candidate_id: c.candidate_id,
        name: c.identity.name_canonical,
        country: c.country,
        probe_kind: probe.kind,
        delta_fields_new: [],
      }));
      continue;
    }
    if (probe.kind === "rate_limited") { report.probes_rate_limited++; continue; }
    if (probe.kind === "parse_error") { report.probes_parse_error++; continue; }
    if (probe.kind === "unavailable") { report.probes_unavailable++; continue; }
    if (probe.kind === "responded_zero" || probe.bindings.length === 0) {
      report.probes_responded_zero++;
      continue;
    }
    report.probes_responded++;

    const b = probe.bindings[0];
    const delta = computeWikidataDelta(b, c.identity);
    for (const f of delta.fields_new) {
      report.fields_new_counts[f] = (report.fields_new_counts[f] ?? 0) + 1;
    }

    const entry = {
      at: new Date().toISOString(),
      candidate_id: c.candidate_id,
      name: c.identity.name_canonical,
      country: c.country,
      existing_identity: c.identity,
      probed_values: {
        qid: delta.qid,
        admin: delta.admin,
        admin_label: delta.admin_label,
        website: delta.website,
        phone: delta.phone,
        image: delta.image,
        coord: delta.coord,
      },
      delta_fields_new: delta.fields_new,
      match_count: probe.bindings.length,
      probe_kind: probe.kind,
      bytes: probe.bytes,
      ms: probe.ms,
    };
    await append_evidence_log(JSON.stringify(entry));
    report.evidence_rows_dryrun_logged++;

    if (live && c.identity.name_canonical) {
      liveRows.push({
        candidate_id: c.candidate_id,
        country: c.country,
        business_name: c.identity.name_canonical,
        delta,
        all_bindings_count: probe.bindings.length,
      });
    }
  }

  if (live && write_live_rows && liveRows.length > 0) {
    const res = await write_live_rows(liveRows);
    report.evidence_rows_written = res.inserted;
  }

  return report;
}

// ─── Main (orchestration + IO) ─────────────────────────────────────
async function main(): Promise<number> {
  let cli: Cli;
  try { cli = parseCli(process.argv.slice(2)); }
  catch (e) {
    console.error(`enrich-wikidata-crossref · ${(e as Error).message}`);
    console.error("usage: tsx scripts/nex-canonical/enrich-wikidata-crossref.ts \\");
    console.error("  --pending-queue=<path> --limit=<n> [--offset=<n>] [--evidence-log=<path>] [--live] [--programme-slug=<slug>]");
    return 1;
  }

  let candidates: LoadedCandidate[];
  try { candidates = await loadCandidates(cli.pending_queue, { limit: cli.limit, offset: cli.offset }); }
  catch (e) {
    console.error(`pending-queue unreadable: ${(e as Error).message}`);
    return 2;
  }

  const resolution = await resolveWikidataFetcher(process.env);

  if (cli.live && resolution.source !== "production") {
    console.error(`--live requested but Wikidata fetcher did not activate · reason: ${resolution.reason}`);
    console.error(`stopping before any DB open or HTTPS call · the Founder-signed allowlist currently does NOT include a wikidata.org host`);
    return 3;
  }

  let dbClient: Client | null = null;
  let programme_id: string | null = null;
  if (cli.live) {
    const url = process.env.NEX_POSTGRES_URL;
    if (!url) { console.error("--live requires NEX_POSTGRES_URL"); return 3; }
    dbClient = new Client({ connectionString: url });
    await dbClient.connect();
    programme_id = await ensureProgrammeLive(dbClient, cli.programme_slug);
  }

  let min_interval_ms = 5000;
  try {
    const text = await fs.readFile(resolution.allowlist_path, "utf8");
    min_interval_ms = resolveMinIntervalMs(text);
  } catch { /* keep default */ }

  await fs.mkdir(path.dirname(cli.evidence_log), { recursive: true }).catch(() => void 0);
  const stream = await fs.open(cli.evidence_log, "a");
  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

  const report = await orchestrateWikidataCrossref({
    fetcher_resolution: resolution,
    candidates,
    min_interval_ms,
    sleep,
    append_evidence_log: async (line: string) => { await stream.write(line + "\n"); },
    write_live_rows: dbClient && programme_id
      ? (rows) => writeEvidenceLive(dbClient!, programme_id!, rows)
      : undefined,
    offset_applied: cli.offset,
    live: cli.live,
  });

  await stream.close();
  if (dbClient) await dbClient.end();

  console.log("=== enrich-wikidata-crossref report ===");
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

// ─── Entrypoint (only when invoked directly) ────────────────────────
const isDirect = (() => {
  try {
    const argv1 = process.argv[1];
    return argv1 && argv1.endsWith("enrich-wikidata-crossref.ts");
  } catch { return false; }
})();

if (isDirect) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("unexpected error:", (e as Error).message);
    process.exit(99);
  });
}

// ─── Structural boundary markers ────────────────────────────────────
export const _WIKIDATA_NEVER_FABRICATES =
  "parseWikidataResponse_only_copies_values_from_sparql_bindings_never_inferred";
export const _WIKIDATA_DORMANT_BY_DEFAULT =
  "NULL_WIKIDATA_FETCHER_is_module_default_production_wiring_is_founder_opt_in_via_allowlist";
export const _WIKIDATA_NO_AUTO_PROMOTE =
  "runner_writes_evidence_only_never_updates_business_canonical_lifecycle_state";
export const _WIKIDATA_INTERNAL_ONLY =
  "wikidata_source_is_can_display_FALSE_evidence_is_internal_fact_check_never_published_verbatim";
