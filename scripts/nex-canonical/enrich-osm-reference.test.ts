// scripts/nex-canonical/enrich-osm-reference.test.ts
//
// Tests for the OSM re-probe enrichment runner. No real pg. No real
// network. The runner's `orchestrateEnrichment` is pure w.r.t. IO: adapter,
// sleep, append_evidence_log, and write_live_rows are all injectable.
// We never touch the sealed production adapter here.
//
// Properties proven:
//   1. parseOsmRefFromCaveats accepts the sealed caveat shape (· separator)
//   2. parseOsmRefFromCaveats returns null on unrelated caveats
//   3. buildOsmElementQuery produces the per-element Overpass QL
//   4. computeDelta surfaces newly-discovered fields vs an existing snapshot
//   5. computeDelta never fabricates (missing OSM tags → null · no fields_new)
//   6. computeDelta uses canonicaliseWebsite() for website equality (shared helper)
//   7. parseCli honours --limit, --offset, --evidence-log, --live, --programme-slug
//   8. parseCli falls back to the UTC-stamped default evidence-log
//   9. parseCli rejects out-of-range --limit and negative --offset
//  10. loadCandidates respects --offset and --limit, dedup by candidate_id
//  11. loadCandidates skips lines without an OSM caveat (zero-fabrication)
//  12. resolveMinIntervalMs parses the founder-signed allowlist for overpass
//  13. orchestrateEnrichment emits one JSONL line per probed candidate (dormant)
//  14. orchestrateEnrichment NEVER calls write_live_rows when live=false
//  15. orchestrateEnrichment NEVER emits DB rows for candidates lacking a name
//  16. orchestrateEnrichment forwards fields_new counts into the report

import { describe, expect, test } from "vitest";
import {
  parseOsmRefFromCaveats,
  buildOsmElementQuery,
  computeDelta,
  parseCli,
  defaultEvidenceLogPath,
  loadCandidates,
  resolveMinIntervalMs,
  orchestrateEnrichment,
  type IdentitySnapshot,
  type LoadedCandidate,
} from "./enrich-osm-reference";
import {
  makeFixtureOverpassAdapter,
  NULL_OVERPASS_ADAPTER,
  type OverpassRawElement,
} from "@/lib/nex/harvest/overpass-adapter";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const EMPTY_IDENTITY: IdentitySnapshot = {
  name_canonical: null,
  website_apex: null,
  phone_e164: null,
  address: null,
  street_line: null,
  neighbourhood: null,
  district: null,
  wikidata_qid: null,
};

// ═════════════════════════════════════════════════════════════════════
// §1 · parseOsmRefFromCaveats
// ═════════════════════════════════════════════════════════════════════

describe("parseOsmRefFromCaveats", () => {
  test("accepts the sealed caveat form (middle-dot separator)", () => {
    const ref = parseOsmRefFromCaveats([
      'legacy-adapter projection · source="osm_overpass" · source_reference="node/9797682461"',
    ]);
    expect(ref).toEqual({ element_type: "node", element_id: 9797682461 });
  });

  test("accepts the pipe separator form", () => {
    const ref = parseOsmRefFromCaveats([
      'legacy-adapter projection | source="osm_overpass" | source_reference="way/42"',
    ]);
    expect(ref).toEqual({ element_type: "way", element_id: 42 });
  });

  test("returns null when no OSM caveat present", () => {
    expect(parseOsmRefFromCaveats(["some unrelated caveat"])).toBeNull();
    expect(parseOsmRefFromCaveats([])).toBeNull();
    expect(parseOsmRefFromCaveats(undefined)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · buildOsmElementQuery
// ═════════════════════════════════════════════════════════════════════

describe("buildOsmElementQuery", () => {
  test("renders per-element Overpass QL", () => {
    const q = buildOsmElementQuery({ element_type: "node", element_id: 123 });
    expect(q).toBe("[out:json][timeout:60];node(123);out tags center;");
  });

  test("works for way and relation", () => {
    expect(buildOsmElementQuery({ element_type: "way", element_id: 7 }))
      .toContain("way(7)");
    expect(buildOsmElementQuery({ element_type: "relation", element_id: 11 }))
      .toContain("relation(11)");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · computeDelta
// ═════════════════════════════════════════════════════════════════════

describe("computeDelta", () => {
  test("surfaces newly-discovered fields vs the existing snapshot", () => {
    const d = computeDelta(
      {
        website: "https://example.com",
        phone: "+62 21 555-0100",
        "addr:housenumber": "10",
        "addr:street": "Jl. Thamrin",
        "addr:city": "Jakarta",
        opening_hours: "Mo-Fr 09:00-17:00",
        wikidata: "Q42",
        email: "hello@example.com",
      },
      EMPTY_IDENTITY,
    );
    expect(d.website).toBe("https://example.com");
    expect(d.phone).toBe("+62 21 555-0100");
    expect(d.address).toBe("10, Jl. Thamrin, Jakarta");
    expect(d.opening_hours).toBe("Mo-Fr 09:00-17:00");
    expect(d.wikidata_qid).toBe("Q42");
    expect(d.email).toBe("hello@example.com");
    expect([...d.fields_new].sort()).toEqual([
      "address",
      "email",
      "opening_hours",
      "phone",
      "website",
      "wikidata_qid",
    ]);
  });

  test("never fabricates · missing tags produce null and empty fields_new", () => {
    const d = computeDelta({}, EMPTY_IDENTITY);
    expect(d.website).toBeNull();
    expect(d.phone).toBeNull();
    expect(d.address).toBeNull();
    expect(d.opening_hours).toBeNull();
    expect(d.wikidata_qid).toBeNull();
    expect(d.email).toBeNull();
    expect(d.fields_new.length).toBe(0);
  });

  test("website equality uses canonicaliseWebsite (shared helper)", () => {
    // Candidate already has 'www.example.com' · OSM returns 'https://example.com/'
    // These canonicalise to the same host · fields_new must NOT include website.
    const d = computeDelta(
      { website: "https://example.com/" },
      { ...EMPTY_IDENTITY, website_apex: "www.example.com" },
    );
    expect(d.website).toBe("https://example.com/");
    expect(d.fields_new).not.toContain("website");
  });

  test("prefers primary tag over contact: fallback", () => {
    const d = computeDelta(
      { website: "https://primary.example", "contact:website": "https://alt.example" },
      EMPTY_IDENTITY,
    );
    expect(d.website).toBe("https://primary.example");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · parseCli
// ═════════════════════════════════════════════════════════════════════

describe("parseCli", () => {
  const FIXED_NOW = new Date("2026-10-09T12:00:00.000Z");

  test("accepts the required flags and parses offset + live + programme-slug", () => {
    const cli = parseCli(
      [
        "--pending-queue=queue.jsonl",
        "--limit=10",
        "--offset=50",
        "--evidence-log=out.jsonl",
        "--live",
        "--programme-slug=nex-food-id-enrichment",
      ],
      FIXED_NOW,
    );
    expect(cli.pending_queue).toBe("queue.jsonl");
    expect(cli.limit).toBe(10);
    expect(cli.offset).toBe(50);
    expect(cli.evidence_log).toBe("out.jsonl");
    expect(cli.live).toBe(true);
    expect(cli.programme_slug).toBe("nex-food-id-enrichment");
  });

  test("defaults offset=0 · live=false · uses UTC-stamped default evidence-log", () => {
    const cli = parseCli(
      ["--pending-queue=q.jsonl", "--limit=1"],
      FIXED_NOW,
    );
    expect(cli.offset).toBe(0);
    expect(cli.live).toBe(false);
    expect(cli.evidence_log).toBe(defaultEvidenceLogPath(FIXED_NOW));
    expect(cli.evidence_log).toContain("data/nex-canonical/enrichment-log-");
    expect(cli.evidence_log).toContain("2026-10-09T12-00-00-000Z");
  });

  test("rejects out-of-range --limit", () => {
    expect(() => parseCli(["--pending-queue=q", "--limit=0"])).toThrow(/limit/);
    expect(() => parseCli(["--pending-queue=q", "--limit=1001"])).toThrow(/limit/);
    expect(() => parseCli(["--pending-queue=q", "--limit=abc"])).toThrow(/limit/);
  });

  test("rejects negative --offset", () => {
    expect(() => parseCli(["--pending-queue=q", "--limit=5", "--offset=-1"])).toThrow(/offset/);
  });

  test("rejects missing --pending-queue or --limit", () => {
    expect(() => parseCli(["--limit=5"])).toThrow(/pending-queue/);
    expect(() => parseCli(["--pending-queue=q"])).toThrow(/limit/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · loadCandidates (offset + dedup + skip-non-OSM)
// ═════════════════════════════════════════════════════════════════════

async function writeJsonlFixture(lines: readonly object[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "enrich-osm-ref-"));
  const file = path.join(dir, "pending.jsonl");
  await fs.writeFile(
    file,
    lines.map((o) => JSON.stringify(o)).join("\n") + "\n",
    "utf8",
  );
  return file;
}

function pendingLine(opts: {
  candidate_id: string;
  osm_ref?: string | null;
  name?: string;
  country?: string;
}): object {
  const caveats = opts.osm_ref
    ? [`legacy-adapter projection · source="osm_overpass" · source_reference="${opts.osm_ref}"`]
    : ["no osm reference"];
  return {
    candidate_id: opts.candidate_id,
    review_package: {
      candidates: [
        {
          candidate_id: opts.candidate_id,
          caveats,
          country: opts.country ?? "ID",
          entity_type: "food",
          identity: { name_canonical: opts.name ?? "Test" },
        },
      ],
    },
  };
}

describe("loadCandidates", () => {
  test("skips non-OSM candidates · never fabricates ref", async () => {
    const file = await writeJsonlFixture([
      pendingLine({ candidate_id: "a", osm_ref: null }),
      pendingLine({ candidate_id: "b", osm_ref: "node/1" }),
    ]);
    const loaded = await loadCandidates(file, { limit: 10 });
    expect(loaded.map((c) => c.candidate_id)).toEqual(["b"]);
    expect(loaded[0].osm_ref).toEqual({ element_type: "node", element_id: 1 });
  });

  test("dedupes by candidate_id", async () => {
    const file = await writeJsonlFixture([
      pendingLine({ candidate_id: "a", osm_ref: "node/1" }),
      pendingLine({ candidate_id: "a", osm_ref: "node/1" }),
      pendingLine({ candidate_id: "b", osm_ref: "node/2" }),
    ]);
    const loaded = await loadCandidates(file, { limit: 10 });
    expect(loaded.map((c) => c.candidate_id)).toEqual(["a", "b"]);
  });

  test("respects --offset · counts OSM-eligible candidates only", async () => {
    const file = await writeJsonlFixture([
      pendingLine({ candidate_id: "skip-this-non-osm", osm_ref: null }), // not counted
      pendingLine({ candidate_id: "a", osm_ref: "node/1" }), // offset=0 → first
      pendingLine({ candidate_id: "b", osm_ref: "node/2" }), // offset=1 → first
      pendingLine({ candidate_id: "c", osm_ref: "node/3" }), // offset=2 → first
    ]);
    const first = await loadCandidates(file, { limit: 2, offset: 1 });
    expect(first.map((c) => c.candidate_id)).toEqual(["b", "c"]);
  });

  test("respects --limit", async () => {
    const file = await writeJsonlFixture([
      pendingLine({ candidate_id: "a", osm_ref: "node/1" }),
      pendingLine({ candidate_id: "b", osm_ref: "node/2" }),
      pendingLine({ candidate_id: "c", osm_ref: "node/3" }),
    ]);
    const loaded = await loadCandidates(file, { limit: 2 });
    expect(loaded.length).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · resolveMinIntervalMs
// ═════════════════════════════════════════════════════════════════════

describe("resolveMinIntervalMs", () => {
  test("extracts overpass min_interval_ms from the founder-signed allowlist", () => {
    const text = JSON.stringify({
      signed_by: "founder",
      allowed_hosts: [
        { host: "overpass-api.de", min_interval_ms: 5000 },
        { host: "www.robotstxt.org", min_interval_ms: 1000 },
      ],
    });
    expect(resolveMinIntervalMs(text, "overpass")).toBe(5000);
  });

  test("falls back to 2000ms when host missing / parse fails", () => {
    expect(resolveMinIntervalMs("{not json", "overpass")).toBe(2000);
    expect(resolveMinIntervalMs(JSON.stringify({ allowed_hosts: [] }), "overpass")).toBe(2000);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · orchestrateEnrichment · dormant adapter path
// ═════════════════════════════════════════════════════════════════════

function makeCandidate(id: string, element_id: number, identity: Partial<IdentitySnapshot> = {}): LoadedCandidate {
  return {
    candidate_id: id,
    country: "ID",
    osm_ref: { element_type: "node", element_id },
    identity: { ...EMPTY_IDENTITY, ...identity },
    entity_type: "food",
  };
}

describe("orchestrateEnrichment", () => {
  test("dormant adapter · reports dormant · zero DB writes · evidence log receives one line per candidate", async () => {
    const log: string[] = [];
    const writeLiveCalls: Array<readonly unknown[]> = [];

    const report = await orchestrateEnrichment({
      adapter_resolution: {
        adapter: NULL_OVERPASS_ADAPTER,
        source: "null_defaults",
        reason: "NEX_PAGE_FETCHER_ACTIVATION not equal 'on'",
        allowlist_path: "data/nex-page-fetcher-allowlist.json",
      },
      candidates: [makeCandidate("a", 1), makeCandidate("b", 2)],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async (l) => { log.push(l); },
      write_live_rows: async (rows) => { writeLiveCalls.push(rows); return { inserted: rows.length, skipped_no_name: 0 }; },
      offset_applied: 0,
      live: false,
    });

    expect(report.stage).toBe("dormant");
    expect(report.adapter_source).toBe("null_defaults");
    expect(report.probes_attempted).toBe(2);
    expect(report.probes_dormant).toBe(2);
    expect(report.probes_responded).toBe(0);
    expect(report.evidence_rows_written).toBe(0);
    expect(report.evidence_rows_dryrun_logged).toBe(0); // dormant records probe_kind only, not a delta
    expect(log.length).toBe(2);
    expect(writeLiveCalls.length).toBe(0);
  });

  test("responded adapter · emits one evidence-log entry per probed candidate · fields_new count propagates", async () => {
    const elements: OverpassRawElement[] = [
      {
        type: "node",
        id: 100,
        tags: {
          name: "Warung A",
          website: "https://warunga.example",
          phone: "+62 21 555-0001",
          "addr:housenumber": "1",
          "addr:street": "Jl. Alpha",
        },
      },
    ];
    const adapter = makeFixtureOverpassAdapter({ elements });
    const log: string[] = [];
    const liveWrites: unknown[] = [];

    const report = await orchestrateEnrichment({
      adapter_resolution: {
        adapter,
        source: "production",
        reason: "fixture",
        allowlist_path: "data/nex-page-fetcher-allowlist.json",
      },
      candidates: [makeCandidate("a", 100)],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async (l) => { log.push(l); },
      write_live_rows: async (rows) => { liveWrites.push(rows); return { inserted: rows.length, skipped_no_name: 0 }; },
      offset_applied: 0,
      live: false, // dry-run · liveWrites must stay empty
    });

    expect(report.stage).toBe("probed");
    expect(report.probes_responded).toBe(1);
    expect(report.evidence_rows_dryrun_logged).toBe(1);
    expect(report.fields_new_counts.website).toBe(1);
    expect(report.fields_new_counts.phone).toBe(1);
    expect(report.fields_new_counts.address).toBe(1);
    expect(liveWrites.length).toBe(0); // never called in dry-run
    expect(log.length).toBe(1);
    const parsed = JSON.parse(log[0]);
    expect(parsed.business_name).toBe("Warung A");
    expect(parsed.probed_values.website).toBe("https://warunga.example");
    expect(parsed.delta_fields_new).toContain("website");
  });

  test("live mode · only writes rows for candidates that have a business_name", async () => {
    // No `name` tag on element → extractCandidateFromElement returns null →
    // business_name falls back to c.identity.name_canonical. If that's also
    // null, the row must be skipped (zero-fabrication).
    const elements: OverpassRawElement[] = [
      { type: "node", id: 200, tags: { website: "https://noname.example" } },
    ];
    const adapter = makeFixtureOverpassAdapter({ elements });
    const log: string[] = [];
    const liveWrites: unknown[][] = [];

    const report = await orchestrateEnrichment({
      adapter_resolution: {
        adapter,
        source: "production",
        reason: "fixture",
        allowlist_path: "data/nex-page-fetcher-allowlist.json",
      },
      // identity.name_canonical is null · OSM has no `name` either
      candidates: [makeCandidate("a", 200, { name_canonical: null })],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async (l) => { log.push(l); },
      write_live_rows: async (rows) => { liveWrites.push(rows as unknown[]); return { inserted: rows.length, skipped_no_name: 0 }; },
      offset_applied: 0,
      live: true,
    });

    expect(report.probes_responded).toBe(1);
    expect(liveWrites.length).toBe(0); // no DB write because business_name is null
    expect(report.evidence_rows_written).toBe(0);
  });

  test("rate_limited probes advance the counter but do not log evidence", async () => {
    const adapter = makeFixtureOverpassAdapter({ kind: "rate_limited" });
    const log: string[] = [];
    const report = await orchestrateEnrichment({
      adapter_resolution: {
        adapter,
        source: "production",
        reason: "fixture",
        allowlist_path: "al.json",
      },
      candidates: [makeCandidate("a", 1), makeCandidate("b", 2)],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async (l) => { log.push(l); },
      offset_applied: 0,
      live: false,
    });
    expect(report.probes_rate_limited).toBe(2);
    expect(report.evidence_rows_dryrun_logged).toBe(0);
    expect(log.length).toBe(0);
  });

  test("respects --offset by propagating to the report", async () => {
    const report = await orchestrateEnrichment({
      adapter_resolution: {
        adapter: NULL_OVERPASS_ADAPTER,
        source: "null_defaults",
        reason: "fixture",
        allowlist_path: "al.json",
      },
      candidates: [],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async () => {},
      offset_applied: 42,
      live: false,
    });
    expect(report.offset_applied).toBe(42);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · governance invariants (string-grep)
// ═════════════════════════════════════════════════════════════════════

describe("governance invariants", () => {
  test("source file never imports a non-sealed Overpass adapter", async () => {
    const text = await fs.readFile(
      path.join(__dirname, "enrich-osm-reference.ts"),
      "utf8",
    );
    // Must go through the sealed boot. Never construct ProductionOverpassAdapter directly.
    expect(text).toContain("resolveProductionHarvestAdapters");
    expect(text).not.toContain("new ProductionOverpassAdapter(");
  });

  test("source file imports canonicaliseWebsite (shared pure helper)", async () => {
    const text = await fs.readFile(
      path.join(__dirname, "enrich-osm-reference.ts"),
      "utf8",
    );
    expect(text).toContain("canonicaliseWebsite");
  });

  test("source file never writes to nex.food_business or nex.business_canonical", async () => {
    const text = await fs.readFile(
      path.join(__dirname, "enrich-osm-reference.ts"),
      "utf8",
    );
    expect(text).not.toMatch(/INSERT\s+INTO\s+nex\.food_business/i);
    expect(text).not.toMatch(/INSERT\s+INTO\s+nex\.business_canonical/i);
    expect(text).not.toMatch(/UPDATE\s+nex\.food_business/i);
    expect(text).not.toMatch(/UPDATE\s+nex\.business_canonical/i);
  });

  test("source file never auto-promotes lifecycle_state", async () => {
    const text = await fs.readFile(
      path.join(__dirname, "enrich-osm-reference.ts"),
      "utf8",
    );
    expect(text).not.toMatch(/lifecycle_state\s*=\s*'(verified|claimed|published)'/i);
  });
});
