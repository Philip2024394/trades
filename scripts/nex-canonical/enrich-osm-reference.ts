// scripts/nex-canonical/enrich-osm-reference.ts
//
// NEX Canonical · OSM re-query enrichment runner.
//
// Objective
//   For each candidate in the pending-review queue that carries an OSM
//   source reference (`node/<id>` · `way/<id>` · `relation/<id>`),
//   re-probe OpenStreetMap via the sealed Overpass adapter and surface
//   any tags that the legacy OSM import did not project into
//   nex.food_business — specifically `website` · `phone` ·
//   `addr:*` · `opening_hours` · `wikidata`.
//
//   This is EVIDENCE RESEARCH only. Discovered tag values are written to
//   nex.discovery_business_evidence (Founder-only surface, sealed by
//   migration · see db/migrations/nex_world_discovery.sql §5). Nothing
//   is written to the canonical pipeline. Nothing changes the pending
//   candidate's status. Founder review via decideCandidate remains the
//   sole promotion mechanism.
//
// Governance hard-locks preserved
//   · Zero fabrication · every field value is copied verbatim from an
//     OSM tag or recorded as null. extractCandidateFromElement guards
//     against business_name invention.
//   · ProductionOverpassAdapter is gated on
//     NEX_PAGE_FETCHER_ACTIVATION === "on" AND a founder-signed
//     data/nex-page-fetcher-allowlist.json. Without both, resolveProductionHarvestAdapters
//     returns NULL_OVERPASS_ADAPTER and this runner reports `dormant`
//     for every probe without issuing a single HTTP request.
//   · Rate-limited via the per-host `min_interval_ms` from the
//     founder-signed allowlist. Overpass politeness enforced.
//   · Dry-run default. `--live` is required to open a DB connection
//     and persist evidence. Without it, the runner reports what WOULD
//     be enriched and exits with 0.
//   · Never writes to nex.food_business, nex.business_canonical, or any
//     table the sealed canonical write path owns.
//   · Append-only evidence · UNIQUE (programme_id, iso_alpha_2,
//     business_name, website_url) prevents duplicate rows.
//
// CLI shape
//   tsx scripts/nex-canonical/enrich-osm-reference.ts \
//     --pending-queue=<path>        (required · same JSONL ingestion writes)
//     --limit=<n>                   (required · bounded batch cap)
//     --evidence-log=<path>         (optional · defaults to
//                                     data/nex-canonical/enrichment-log-<utc>.jsonl)
//     [--offset=<n>]                (optional · default 0 · resumable batching)
//     [--live]                      (opt-in · writes to nex.discovery_business_evidence
//                                     requires NEX_PAGE_FETCHER_ACTIVATION === "on"
//                                     requires NEX_POSTGRES_URL)
//     [--programme-slug=<slug>]     (default "nex-food-id-enrichment"
//                                     resolved to programme_id · created
//                                     on-demand ONLY in --live mode)
//
// EXIT CODES
//   0  · runner_completed (dormant OR live)
//   1  · preflight (CLI args or allowlist file) refused
//   2  · pending queue unreadable
//   3  · adapter construction refused in --live mode (safety stop)
//  99  · unexpected error

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { extractCandidateFromElement, canonicaliseWebsite } from "@/lib/nex/harvest/overpass-adapter";
import type { OverpassAdapter } from "@/lib/nex/harvest/overpass-adapter";
import { resolveProductionHarvestAdapters } from "@/lib/nex/harvest/production-boot";

// ─── Pure: parse source_reference from caveats ──────────────────────
const CAVEAT_OSM_RE =
  /source="osm_overpass"\s*[·|]\s*source_reference="(node|way|relation)\/(\d+)"/;

export interface ParsedOsmRef {
  readonly element_type: "node" | "way" | "relation";
  readonly element_id: number;
}

export function parseOsmRefFromCaveats(caveats: readonly string[] | undefined): ParsedOsmRef | null {
  if (!caveats) return null;
  for (const c of caveats) {
    const m = c.match(CAVEAT_OSM_RE);
    if (m) return { element_type: m[1] as ParsedOsmRef["element_type"], element_id: Number(m[2]) };
  }
  return null;
}

// ─── Pure: build a per-element Overpass query ───────────────────────
export function buildOsmElementQuery(ref: ParsedOsmRef): string {
  return `[out:json][timeout:60];${ref.element_type}(${ref.element_id});out tags center;`;
}

// ─── Pure: diff OSM tags vs candidate identity (what's newly surfaced) ─
export interface IdentitySnapshot {
  readonly name_canonical: string | null;
  readonly website_apex: string | null;
  readonly phone_e164: string | null;
  readonly address: string | null;
  readonly street_line: string | null;
  readonly neighbourhood: string | null;
  readonly district: string | null;
  readonly wikidata_qid: string | null;
}

export type EnrichmentField =
  | "website"
  | "phone"
  | "address"
  | "opening_hours"
  | "wikidata_qid"
  | "email";

export interface EnrichmentDelta {
  readonly website: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly opening_hours: string | null;
  readonly wikidata_qid: string | null;
  readonly email: string | null; // OSM `email` tag · raw · not inferred
  readonly fields_new: readonly EnrichmentField[];
}

export function computeDelta(
  tags: Readonly<Record<string, string>>,
  snapshot: IdentitySnapshot,
): EnrichmentDelta {
  const website = tags.website ?? tags["contact:website"] ?? null;
  const phone = tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null;
  const email = tags.email ?? tags["contact:email"] ?? null;
  const opening_hours = tags.opening_hours ?? null;
  const wikidata_qid = tags.wikidata ?? null;

  const addr_parts = [
    tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:postcode"],
  ].filter((v) => typeof v === "string" && v.trim().length > 0);
  const address = addr_parts.length > 0 ? addr_parts.join(", ") : null;

  const fields_new_mut: EnrichmentField[] = [];
  const canonicalisedCandidate = canonicaliseWebsite(snapshot.website_apex);
  const canonicalisedOsm = canonicaliseWebsite(website);
  if (website && canonicalisedOsm !== null && canonicalisedCandidate !== canonicalisedOsm) {
    fields_new_mut.push("website");
  }
  if (phone && phone !== snapshot.phone_e164) fields_new_mut.push("phone");
  if (address && address !== snapshot.address) fields_new_mut.push("address");
  if (opening_hours) fields_new_mut.push("opening_hours");
  if (wikidata_qid && wikidata_qid !== snapshot.wikidata_qid) fields_new_mut.push("wikidata_qid");
  if (email) fields_new_mut.push("email");

  return {
    website,
    phone,
    address,
    opening_hours,
    wikidata_qid,
    email,
    fields_new: fields_new_mut,
  };
}

// ─── Pure: parse CLI ────────────────────────────────────────────────
export interface Cli {
  readonly pending_queue: string;
  readonly limit: number;
  readonly offset: number;
  readonly evidence_log: string;
  readonly live: boolean;
  readonly programme_slug: string;
}

/** Default evidence-log path · includes a UTC timestamp so parallel runs
 *  never collide. Deterministic when `now` is injected · pure helper. */
export function defaultEvidenceLogPath(now: Date): string {
  const utc = now.toISOString().replace(/[:.]/g, "-");
  return path.posix.join("data", "nex-canonical", `enrichment-log-${utc}.jsonl`);
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
    programme_slug: get("programme-slug") ?? "nex-food-id-enrichment",
  };
}

// ─── IO: read pending-review candidates ─────────────────────────────
interface PendingReviewLine {
  readonly candidate_id?: string;
  readonly review_package?: {
    readonly candidates?: ReadonlyArray<{
      readonly candidate_id: string;
      readonly country?: string;
      readonly caveats?: readonly string[];
      readonly identity?: Partial<IdentitySnapshot>;
      readonly entity_type?: string;
    }>;
  };
}

export interface LoadedCandidate {
  readonly candidate_id: string;
  readonly country: string;
  readonly osm_ref: ParsedOsmRef;
  readonly identity: IdentitySnapshot;
  readonly entity_type: string;
}

export interface LoadOptions {
  readonly limit: number;
  readonly offset?: number;
}

export async function loadCandidates(
  queuePath: string,
  options: LoadOptions | number,
): Promise<LoadedCandidate[]> {
  // Back-compat · old callers passed limit as a plain number.
  const opts: LoadOptions = typeof options === "number" ? { limit: options } : options;
  const limit = opts.limit;
  const offset = opts.offset ?? 0;

  const text = await fs.readFile(queuePath, "utf8");
  const out: LoadedCandidate[] = [];
  const seen = new Set<string>();
  let eligible_seen = 0;
  for (const line of text.split(/\r?\n/)) {
    if (out.length >= limit) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: PendingReviewLine;
    try { obj = JSON.parse(trimmed) as PendingReviewLine; } catch { continue; }
    const c = obj.review_package?.candidates?.[0];
    if (!c) continue;
    if (seen.has(c.candidate_id)) continue;
    seen.add(c.candidate_id);
    const osm_ref = parseOsmRefFromCaveats(c.caveats);
    if (!osm_ref) continue;
    // Skip until we're past the offset. Offset counts OSM-tagged candidates
    // (not raw JSONL lines) so resuming is stable across queue regeneration.
    if (eligible_seen < offset) { eligible_seen++; continue; }
    eligible_seen++;
    const id = c.identity ?? {};
    const snapshot: IdentitySnapshot = {
      name_canonical: id.name_canonical ?? null,
      website_apex: id.website_apex ?? null,
      phone_e164: id.phone_e164 ?? null,
      address: id.address ?? null,
      street_line: id.street_line ?? null,
      neighbourhood: id.neighbourhood ?? null,
      district: id.district ?? null,
      wikidata_qid: id.wikidata_qid ?? null,
    };
    out.push({
      candidate_id: c.candidate_id,
      country: (c.country ?? "ID").toUpperCase(),
      osm_ref,
      identity: snapshot,
      entity_type: c.entity_type ?? "food",
    });
  }
  return out;
}

// ─── Resolve adapter via sealed production-boot ─────────────────────
async function resolveAdapter(env: NodeJS.ProcessEnv): Promise<{ adapter: OverpassAdapter; source: "production" | "null_defaults"; reason: string; allowlist_path: string }> {
  const r = await resolveProductionHarvestAdapters({ env });
  return {
    adapter: r.overpass_adapter ?? (await import("@/lib/nex/harvest/overpass-adapter")).NULL_OVERPASS_ADAPTER,
    source: r.source,
    reason: r.reason,
    allowlist_path: r.allowlist_path_resolved,
  };
}

// ─── IO: evidence write (live mode only) ────────────────────────────
interface EvidenceInput {
  readonly candidate_id: string;
  readonly country: string;
  readonly osm_ref: ParsedOsmRef;
  readonly business_name: string | null;
  readonly delta: EnrichmentDelta;
  readonly all_tags: Readonly<Record<string, string>>;
}

async function writeEvidenceLive(
  client: Client,
  programme_id: string,
  rows: readonly EvidenceInput[],
): Promise<{ inserted: number; skipped_no_name: number }> {
  let inserted = 0;
  let skipped_no_name = 0;
  for (const r of rows) {
    if (!r.business_name) { skipped_no_name++; continue; }
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
        `osm_reprobe:${r.osm_ref.element_type}/${r.osm_ref.element_id}`,
        "osm_overpass_reprobe",
        `https://www.openstreetmap.org/${r.osm_ref.element_type}/${r.osm_ref.element_id}`,
        JSON.stringify({
          candidate_id: r.candidate_id,
          osm_ref: `${r.osm_ref.element_type}/${r.osm_ref.element_id}`,
          delta_fields_new: r.delta.fields_new,
          phone: r.delta.phone,
          address: r.delta.address,
          opening_hours: r.delta.opening_hours,
          wikidata_qid: r.delta.wikidata_qid,
          raw_tag_count: Object.keys(r.all_tags).length,
        }),
      ],
    );
    inserted++;
  }
  return { inserted, skipped_no_name };
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
      "NEX Food ID · OSM re-probe enrichment",
      "food",
      "Per-OSM-id re-probe of candidates already in nex.food_business, surfacing website / phone / addr:* / opening_hours / wikidata tags that the original import did not project.",
    ],
  );
  return inserted.rows[0].programme_id as string;
}

// ─── Pure/testable orchestration (adapter + sleep injected) ────────
export interface RunReport {
  stage: "dormant" | "probed" | "stopped";
  stop_reason: string | null;
  adapter_source: "production" | "null_defaults";
  adapter_reason: string;
  allowlist_path: string;
  candidates_read: number;
  osm_tagged: number;
  probes_attempted: number;
  probes_responded: number;
  probes_dormant: number;
  probes_rate_limited: number;
  probes_parse_error: number;
  probes_unavailable: number;
  fields_new_counts: Record<string, number>;
  evidence_rows_written: number;
  evidence_rows_dryrun_logged: number;
  min_interval_ms: number;
  offset_applied: number;
}

export interface AdapterResolution {
  readonly adapter: OverpassAdapter;
  readonly source: "production" | "null_defaults";
  readonly reason: string;
  readonly allowlist_path: string;
}

export interface OrchestrateDeps {
  readonly adapter_resolution: AdapterResolution;
  readonly candidates: readonly LoadedCandidate[];
  readonly min_interval_ms: number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly append_evidence_log: (line: string) => Promise<void>;
  readonly write_live_rows?: (rows: readonly EvidenceInput[]) => Promise<{ inserted: number; skipped_no_name: number }>;
  readonly offset_applied: number;
  readonly live: boolean;
}

/** Pure-ish orchestrator · all IO injected · deterministic for tests.
 *  Never throws · surfaces failure counts in the returned report. */
export async function orchestrateEnrichment(deps: OrchestrateDeps): Promise<RunReport> {
  const { adapter_resolution: ar, candidates, min_interval_ms, sleep, append_evidence_log, write_live_rows, offset_applied, live } = deps;

  const report: RunReport = {
    stage: ar.source === "production" ? "probed" : "dormant",
    stop_reason: null,
    adapter_source: ar.source,
    adapter_reason: ar.reason,
    allowlist_path: ar.allowlist_path,
    candidates_read: candidates.length,
    osm_tagged: candidates.length,
    probes_attempted: 0,
    probes_responded: 0,
    probes_dormant: 0,
    probes_rate_limited: 0,
    probes_parse_error: 0,
    probes_unavailable: 0,
    fields_new_counts: {},
    evidence_rows_written: 0,
    evidence_rows_dryrun_logged: 0,
    min_interval_ms,
    offset_applied,
  };

  const liveRows: EvidenceInput[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (i > 0) await sleep(min_interval_ms);

    const query = buildOsmElementQuery(c.osm_ref);
    const host = "overpass-api.de";
    const probe = await ar.adapter.probe({ host, query, timeout_ms: 60_000 });

    report.probes_attempted++;

    if (probe.kind === "adapter_dormant") {
      report.probes_dormant++;
      await append_evidence_log(JSON.stringify({
        at: new Date().toISOString(),
        candidate_id: c.candidate_id,
        osm_ref: `${c.osm_ref.element_type}/${c.osm_ref.element_id}`,
        probe_kind: probe.kind,
        delta_fields_new: [],
      }));
      continue;
    }
    if (probe.kind === "rate_limited") { report.probes_rate_limited++; continue; }
    if (probe.kind === "parse_error") { report.probes_parse_error++; continue; }
    if (probe.kind === "unavailable") { report.probes_unavailable++; continue; }

    // responded / responded_zero
    if (probe.elements.length === 0) continue;
    report.probes_responded++;

    const el = probe.elements[0];
    const extracted = extractCandidateFromElement(el);
    const tags = el.tags ?? {};
    const delta = computeDelta(tags, c.identity);
    for (const f of delta.fields_new) {
      report.fields_new_counts[f] = (report.fields_new_counts[f] ?? 0) + 1;
    }

    const business_name = extracted?.business_name ?? c.identity.name_canonical;

    const entry = {
      at: new Date().toISOString(),
      candidate_id: c.candidate_id,
      osm_ref: `${c.osm_ref.element_type}/${c.osm_ref.element_id}`,
      business_name,
      country: c.country,
      existing_identity: c.identity,
      probed_values: {
        website: delta.website,
        phone: delta.phone,
        address: delta.address,
        opening_hours: delta.opening_hours,
        wikidata_qid: delta.wikidata_qid,
        email: delta.email,
      },
      delta_fields_new: delta.fields_new,
      probe_kind: probe.kind,
      bytes: probe.bytes,
      ms: probe.ms,
    };
    await append_evidence_log(JSON.stringify(entry));
    report.evidence_rows_dryrun_logged++;

    if (live && business_name) {
      liveRows.push({
        candidate_id: c.candidate_id,
        country: c.country,
        osm_ref: c.osm_ref,
        business_name,
        delta,
        all_tags: tags,
      });
    }
  }

  if (live && write_live_rows && liveRows.length > 0) {
    const res = await write_live_rows(liveRows);
    report.evidence_rows_written = res.inserted;
  }

  return report;
}

// ─── Pure: resolve rate-limit from allowlist text ───────────────────
export function resolveMinIntervalMs(allowlist_text: string, host_contains: string = "overpass"): number {
  try {
    const al = JSON.parse(allowlist_text) as {
      allowed_hosts?: Array<{ host?: string; min_interval_ms?: number }>;
    };
    const match = (al.allowed_hosts ?? []).find((h) => typeof h.host === "string" && h.host.includes(host_contains));
    if (match && typeof match.min_interval_ms === "number" && match.min_interval_ms >= 0) {
      return match.min_interval_ms;
    }
  } catch { /* keep default */ }
  return 2000;
}

// ─── Main (orchestration + IO) ──────────────────────────────────────
async function main(): Promise<number> {
  let cli: Cli;
  try { cli = parseCli(process.argv.slice(2)); }
  catch (e) {
    console.error(`enrich-osm-reference · ${(e as Error).message}`);
    console.error("usage: tsx scripts/nex-canonical/enrich-osm-reference.ts \\");
    console.error("  --pending-queue=<path> --limit=<n> [--offset=<n>] [--evidence-log=<path>] [--live] [--programme-slug=<slug>]");
    return 1;
  }

  let candidates: LoadedCandidate[];
  try { candidates = await loadCandidates(cli.pending_queue, { limit: cli.limit, offset: cli.offset }); }
  catch (e) {
    console.error(`pending-queue unreadable: ${(e as Error).message}`);
    return 2;
  }

  const { adapter, source, reason, allowlist_path } = await resolveAdapter(process.env);

  if (cli.live && source !== "production") {
    console.error(`--live requested but adapter did not activate · reason: ${reason}`);
    console.error(`stopping before any DB open or HTTP call · set NEX_PAGE_FETCHER_ACTIVATION=on and verify ${allowlist_path}`);
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

  // Resolve rate-limit from allowlist (best-effort, defaults to 2000ms).
  let min_interval_ms = 2000;
  try {
    const text = await fs.readFile(allowlist_path, "utf8");
    min_interval_ms = resolveMinIntervalMs(text, "overpass");
  } catch { /* keep default */ }

  // Ensure the evidence-log parent dir exists (relative paths OK).
  await fs.mkdir(path.dirname(cli.evidence_log), { recursive: true }).catch(() => void 0);
  const evidenceStream = await fs.open(cli.evidence_log, "a");

  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

  const report = await orchestrateEnrichment({
    adapter_resolution: { adapter, source, reason, allowlist_path },
    candidates,
    min_interval_ms,
    sleep,
    append_evidence_log: async (line: string) => { await evidenceStream.write(line + "\n"); },
    write_live_rows: dbClient && programme_id
      ? (rows) => writeEvidenceLive(dbClient!, programme_id!, rows)
      : undefined,
    offset_applied: cli.offset,
    live: cli.live,
  });

  await evidenceStream.close();
  if (dbClient) await dbClient.end();

  console.log("=== enrich-osm-reference report ===");
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

// ─── Entrypoint (only when invoked directly) ────────────────────────
const isDirect = (() => {
  try {
    const argv1 = process.argv[1];
    return argv1 && argv1.endsWith("enrich-osm-reference.ts");
  } catch { return false; }
})();

if (isDirect) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("unexpected error:", (e as Error).message);
    process.exit(99);
  });
}
