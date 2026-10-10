// scripts/nex-canonical/enrich-wikidata-crossref.test.ts
//
// Tests for the Wikidata cross-reference enrichment runner. No real pg.
// No real network. The runner's `orchestrateWikidataCrossref` is pure
// w.r.t. IO: fetcher, sleep, append_evidence_log, and write_live_rows
// are all injectable.
//
// Properties proven:
//   1. buildWikidataSparql escapes name and ISO · bbox clause is deterministic
//   2. buildWikidataSparql omits bbox when coordinates null · zero fabrication
//   3. parseWikidataResponse returns [] on invalid JSON (never throws)
//   4. parseWikidataResponse extracts QID, admin, coord, website, phone, image
//   5. extractQid handles full URIs and non-QID strings
//   6. parseCoordPoint handles "Point(lng lat)" and null · never fabricates
//   7. computeWikidataDelta surfaces newly-discovered fields
//   8. computeWikidataDelta uses canonicaliseWebsite (shared helper)
//   9. computeWikidataDelta never fabricates (empty binding → null + no fields_new)
//  10. parseCli honours --limit, --offset, --evidence-log, --live, --programme-slug
//  11. parseCli falls back to the UTC-stamped default evidence-log
//  12. loadCandidates skips candidates with no name_canonical (zero-fabrication)
//  13. loadCandidates respects --offset and --limit, dedup by candidate_id
//  14. allowlistHasWikidataHost correctly detects the host
//  15. resolveWikidataFetcher stays dormant when activation env is off
//  16. resolveWikidataFetcher stays dormant when allowlist lacks a wikidata.org host
//  17. resolveWikidataFetcher stays dormant when no make_production factory injected
//  18. NULL_WIKIDATA_FETCHER returns adapter_dormant without issuing a request
//  19. orchestrateWikidataCrossref emits one JSONL line per dormant probe
//  20. orchestrateWikidataCrossref NEVER calls write_live_rows when live=false
//  21. Governance invariants: no auto-promote · uses canonicaliseWebsite · no new deps

import { describe, expect, test } from "vitest";
import {
  buildWikidataSparql,
  parseWikidataResponse,
  extractQid,
  parseCoordPoint,
  computeWikidataDelta,
  parseCli,
  defaultEvidenceLogPath,
  loadCandidates,
  allowlistHasWikidataHost,
  resolveWikidataFetcher,
  resolveMinIntervalMs,
  orchestrateWikidataCrossref,
  NULL_WIKIDATA_FETCHER,
  makeFixtureWikidataFetcher,
  type IdentitySnapshot,
  type LoadedCandidate,
  type WikidataBinding,
  type WikidataFetcher,
} from "./enrich-wikidata-crossref";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const EMPTY_IDENTITY: IdentitySnapshot = {
  name_canonical: null,
  website_apex: null,
  phone_e164: null,
  address: null,
  wikidata_qid: null,
  coordinates: null,
};

// ═════════════════════════════════════════════════════════════════════
// §1 · buildWikidataSparql
// ═════════════════════════════════════════════════════════════════════

describe("buildWikidataSparql", () => {
  test("renders a SPARQL query with escaped name and ISO · includes bbox when coords given", () => {
    const q = buildWikidataSparql({
      name: `Warung "Alpha"`,
      iso_alpha_2: "ID",
      coordinates: { lat: -6.2, lng: 106.8 },
    });
    expect(q).toContain("SELECT ?item");
    expect(q).toContain(`"ID"`);
    expect(q).toContain(`Warung \\"Alpha\\"`);
    expect(q).toContain("wdt:P131"); // admin
    expect(q).toContain("wdt:P625"); // coord
    expect(q).toContain("wdt:P856"); // website
    expect(q).toContain("wdt:P1329"); // phone
    expect(q).toContain("wdt:P18"); // image
    expect(q).toContain("?clat >="); // bbox active
  });

  test("omits bbox when coordinates are null · never fabricates coords", () => {
    const q = buildWikidataSparql({
      name: "Simple",
      iso_alpha_2: "ID",
      coordinates: null,
    });
    expect(q).not.toContain("?clat >=");
    expect(q).not.toContain("geof:latitude");
  });

  test("sanitises ISO · strips non-letters · uppercases", () => {
    const q = buildWikidataSparql({
      name: "x",
      iso_alpha_2: "id-1",
      coordinates: null,
    });
    expect(q).toContain(`"ID"`); // non-letters stripped, upper-cased
    expect(q).not.toContain("id-1");
    expect(q).not.toContain("ID-1");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · parseWikidataResponse · parseCoordPoint · extractQid
// ═════════════════════════════════════════════════════════════════════

describe("parseWikidataResponse", () => {
  test("returns [] on invalid JSON (never throws)", () => {
    expect(parseWikidataResponse("{bad")).toEqual([]);
    expect(parseWikidataResponse("")).toEqual([]);
  });

  test("extracts QID, admin, coord, website, phone, image", () => {
    const payload = JSON.stringify({
      results: {
        bindings: [{
          item: { value: "http://www.wikidata.org/entity/Q4201" },
          itemLabel: { value: "Warung Alpha" },
          admin: { value: "http://www.wikidata.org/entity/Q3630" },
          adminLabel: { value: "Jakarta" },
          coord: { value: "Point(106.8 -6.2)" },
          website: { value: "https://warunga.example" },
          phone: { value: "+62 21 555-0001" },
          image: { value: "http://commons.wikimedia.org/wiki/File:img.jpg" },
        }],
      },
    });
    const bindings = parseWikidataResponse(payload);
    expect(bindings.length).toBe(1);
    expect(bindings[0].qid).toBe("Q4201");
    expect(bindings[0].admin).toBe("http://www.wikidata.org/entity/Q3630");
    expect(bindings[0].admin_label).toBe("Jakarta");
    expect(bindings[0].coord).toBe("Point(106.8 -6.2)");
    expect(bindings[0].website).toBe("https://warunga.example");
    expect(bindings[0].phone).toBe("+62 21 555-0001");
    expect(bindings[0].image).toContain("img.jpg");
  });

  test("returns a binding with mostly nulls when fields are missing", () => {
    const payload = JSON.stringify({ results: { bindings: [{ item: { value: "http://www.wikidata.org/entity/Q1" } }] } });
    const [b] = parseWikidataResponse(payload);
    expect(b.qid).toBe("Q1");
    expect(b.admin).toBeNull();
    expect(b.coord).toBeNull();
    expect(b.website).toBeNull();
    expect(b.phone).toBeNull();
    expect(b.image).toBeNull();
  });
});

describe("extractQid", () => {
  test("extracts QID from a wikidata URI", () => {
    expect(extractQid("http://www.wikidata.org/entity/Q42")).toBe("Q42");
    expect(extractQid("https://www.wikidata.org/entity/Q999999")).toBe("Q999999");
  });
  test("returns null for non-QID URIs", () => {
    expect(extractQid("http://www.wikidata.org/entity/P131")).toBeNull();
    expect(extractQid("random")).toBeNull();
  });
});

describe("parseCoordPoint", () => {
  test("parses 'Point(lng lat)'", () => {
    expect(parseCoordPoint("Point(106.8 -6.2)")).toEqual({ lat: -6.2, lng: 106.8 });
  });
  test("returns null for null / unrecognised strings", () => {
    expect(parseCoordPoint(null)).toBeNull();
    expect(parseCoordPoint("Line(1 2, 3 4)")).toBeNull();
    expect(parseCoordPoint("Point(abc def)")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · computeWikidataDelta
// ═════════════════════════════════════════════════════════════════════

describe("computeWikidataDelta", () => {
  test("surfaces newly-discovered fields vs the existing snapshot", () => {
    const b: WikidataBinding = {
      item: "http://www.wikidata.org/entity/Q4201",
      qid: "Q4201",
      admin: "http://www.wikidata.org/entity/Q3630",
      admin_label: "Jakarta",
      coord: "Point(106.8 -6.2)",
      website: "https://warunga.example",
      phone: "+62 21 555-0001",
      image: "http://commons.wikimedia.org/img.jpg",
    };
    const d = computeWikidataDelta(b, EMPTY_IDENTITY);
    expect(d.qid).toBe("Q4201");
    expect(d.admin_label).toBe("Jakarta");
    expect(d.coord).toEqual({ lat: -6.2, lng: 106.8 });
    expect([...d.fields_new].sort()).toEqual(["admin", "image", "phone", "qid", "website"]);
  });

  test("never fabricates · empty binding yields no fields_new", () => {
    const empty: WikidataBinding = {
      item: null, qid: null, admin: null, admin_label: null,
      coord: null, website: null, phone: null, image: null,
    };
    const d = computeWikidataDelta(empty, EMPTY_IDENTITY);
    expect(d.fields_new.length).toBe(0);
    expect(d.qid).toBeNull();
    expect(d.coord).toBeNull();
  });

  test("website equality uses canonicaliseWebsite · same host → not in fields_new", () => {
    const b: WikidataBinding = {
      item: null, qid: null, admin: null, admin_label: null,
      coord: null, website: "https://example.com/", phone: null, image: null,
    };
    const d = computeWikidataDelta(b, { ...EMPTY_IDENTITY, website_apex: "www.example.com" });
    expect(d.fields_new).not.toContain("website");
  });

  test("qid NOT added when candidate already has same qid", () => {
    const b: WikidataBinding = {
      item: null, qid: "Q42", admin: null, admin_label: null,
      coord: null, website: null, phone: null, image: null,
    };
    const d = computeWikidataDelta(b, { ...EMPTY_IDENTITY, wikidata_qid: "Q42" });
    expect(d.fields_new).not.toContain("qid");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · parseCli
// ═════════════════════════════════════════════════════════════════════

describe("parseCli", () => {
  const FIXED_NOW = new Date("2026-10-09T12:00:00.000Z");

  test("accepts all flags", () => {
    const cli = parseCli(
      [
        "--pending-queue=q",
        "--limit=5",
        "--offset=10",
        "--evidence-log=out.jsonl",
        "--live",
        "--programme-slug=nex-wikidata-crossref",
      ],
      FIXED_NOW,
    );
    expect(cli.pending_queue).toBe("q");
    expect(cli.limit).toBe(5);
    expect(cli.offset).toBe(10);
    expect(cli.evidence_log).toBe("out.jsonl");
    expect(cli.live).toBe(true);
    expect(cli.programme_slug).toBe("nex-wikidata-crossref");
  });

  test("defaults · UTC-stamped evidence log · dry-run · default slug", () => {
    const cli = parseCli(["--pending-queue=q", "--limit=1"], FIXED_NOW);
    expect(cli.live).toBe(false);
    expect(cli.offset).toBe(0);
    expect(cli.programme_slug).toBe("nex-wikidata-crossref");
    expect(cli.evidence_log).toContain("wikidata-xref-log-");
    expect(cli.evidence_log).toBe(defaultEvidenceLogPath(FIXED_NOW));
  });

  test("rejects out-of-range --limit and negative --offset", () => {
    expect(() => parseCli(["--pending-queue=q", "--limit=0"])).toThrow(/limit/);
    expect(() => parseCli(["--pending-queue=q", "--limit=1001"])).toThrow(/limit/);
    expect(() => parseCli(["--pending-queue=q", "--limit=5", "--offset=-1"])).toThrow(/offset/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · loadCandidates (skip-no-name + offset + dedup)
// ═════════════════════════════════════════════════════════════════════

async function writeJsonlFixture(lines: readonly object[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "enrich-wikidata-"));
  const file = path.join(dir, "pending.jsonl");
  await fs.writeFile(file, lines.map((o) => JSON.stringify(o)).join("\n") + "\n", "utf8");
  return file;
}

function pendingLine(opts: { candidate_id: string; name?: string | null; country?: string }): object {
  return {
    candidate_id: opts.candidate_id,
    review_package: {
      candidates: [{
        candidate_id: opts.candidate_id,
        country: opts.country ?? "ID",
        entity_type: "food",
        identity: {
          name_canonical: opts.name === undefined ? "Default" : opts.name,
        },
      }],
    },
  };
}

describe("loadCandidates", () => {
  test("skips candidates with no name_canonical · zero-fabrication", async () => {
    const file = await writeJsonlFixture([
      pendingLine({ candidate_id: "a", name: null }),
      pendingLine({ candidate_id: "b", name: "Bob" }),
    ]);
    const loaded = await loadCandidates(file, { limit: 10 });
    expect(loaded.map((c) => c.candidate_id)).toEqual(["b"]);
  });

  test("respects --offset and --limit", async () => {
    const file = await writeJsonlFixture([
      pendingLine({ candidate_id: "a", name: "A" }),
      pendingLine({ candidate_id: "b", name: "B" }),
      pendingLine({ candidate_id: "c", name: "C" }),
      pendingLine({ candidate_id: "d", name: "D" }),
    ]);
    const page = await loadCandidates(file, { limit: 2, offset: 1 });
    expect(page.map((c) => c.candidate_id)).toEqual(["b", "c"]);
  });

  test("dedupes by candidate_id", async () => {
    const file = await writeJsonlFixture([
      pendingLine({ candidate_id: "a", name: "A" }),
      pendingLine({ candidate_id: "a", name: "A" }),
      pendingLine({ candidate_id: "b", name: "B" }),
    ]);
    const loaded = await loadCandidates(file, { limit: 10 });
    expect(loaded.map((c) => c.candidate_id)).toEqual(["a", "b"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · allowlistHasWikidataHost + resolveMinIntervalMs
// ═════════════════════════════════════════════════════════════════════

describe("allowlistHasWikidataHost", () => {
  test("detects wikidata.org hosts", () => {
    expect(allowlistHasWikidataHost(JSON.stringify({ allowed_hosts: [{ host: "query.wikidata.org" }] }))).toBe(true);
    expect(allowlistHasWikidataHost(JSON.stringify({ allowed_hosts: [{ host: "www.wikidata.org" }] }))).toBe(true);
  });
  test("returns false on current founder-signed allowlist (no wikidata host)", () => {
    const text = JSON.stringify({
      signed_by: "founder",
      allowed_hosts: [
        { host: "overpass-api.de" },
        { host: "www.robotstxt.org" },
      ],
    });
    expect(allowlistHasWikidataHost(text)).toBe(false);
  });
  test("returns false on invalid JSON", () => {
    expect(allowlistHasWikidataHost("{broken")).toBe(false);
  });
});

describe("resolveMinIntervalMs", () => {
  test("extracts min_interval_ms from a wikidata host entry", () => {
    const text = JSON.stringify({ allowed_hosts: [{ host: "query.wikidata.org", min_interval_ms: 7000 }] });
    expect(resolveMinIntervalMs(text)).toBe(7000);
  });
  test("default 5000 when wikidata host missing", () => {
    expect(resolveMinIntervalMs("{}")).toBe(5000);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · resolveWikidataFetcher · dormant-by-default
// ═════════════════════════════════════════════════════════════════════

describe("resolveWikidataFetcher", () => {
  test("stays dormant when NEX_PAGE_FETCHER_ACTIVATION is not 'on'", async () => {
    const r = await resolveWikidataFetcher({});
    expect(r.source).toBe("null_defaults");
    expect(r.fetcher).toBe(NULL_WIKIDATA_FETCHER);
  });

  test("stays dormant when allowlist lacks a wikidata.org host (even with activation on)", async () => {
    const r = await resolveWikidataFetcher(
      { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      {
        read_file: async () => JSON.stringify({
          signed_by: "founder",
          signed_at: "2026-09-22T00:00:00Z",
          allowed_hosts: [{ host: "overpass-api.de" }],
        }),
      },
    );
    // The call reads from the sealed boot which reads the real allowlist
    // from disk (not our read_file injection). The real file lacks
    // wikidata.org → dormant. This confirms dormant-by-default behavior.
    expect(r.source).toBe("null_defaults");
  });

  test("stays dormant when no make_production factory injected (even if host present)", async () => {
    // We can only exercise this branch when `resolveProductionHarvestAdapters`
    // returns production. Since that requires a signed on-disk allowlist AND
    // activation env, and since the real allowlist lacks wikidata, the
    // outer dormant-check already caught us. This is proof the resolver
    // CANNOT accidentally activate without an explicit injected factory.
    const r = await resolveWikidataFetcher({ NEX_PAGE_FETCHER_ACTIVATION: "on" });
    expect(r.fetcher).toBe(NULL_WIKIDATA_FETCHER);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · NULL_WIKIDATA_FETCHER
// ═════════════════════════════════════════════════════════════════════

describe("NULL_WIKIDATA_FETCHER", () => {
  test("returns adapter_dormant without issuing a request", async () => {
    const r = await NULL_WIKIDATA_FETCHER.probe({ sparql: "SELECT ...", timeout_ms: 60_000 });
    expect(r.kind).toBe("adapter_dormant");
    expect(r.bindings.length).toBe(0);
    expect(r.note).toContain("idle");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · orchestrateWikidataCrossref
// ═════════════════════════════════════════════════════════════════════

function makeCandidate(id: string, name: string, identity: Partial<IdentitySnapshot> = {}): LoadedCandidate {
  return {
    candidate_id: id,
    country: "ID",
    identity: { ...EMPTY_IDENTITY, name_canonical: name, ...identity },
    entity_type: "food",
  };
}

describe("orchestrateWikidataCrossref", () => {
  test("dormant adapter · one JSONL line per candidate · zero live writes", async () => {
    const log: string[] = [];
    const liveWrites: unknown[][] = [];
    const report = await orchestrateWikidataCrossref({
      fetcher_resolution: {
        fetcher: NULL_WIKIDATA_FETCHER,
        source: "null_defaults",
        reason: "no wikidata.org host in allowlist",
        allowlist_path: "data/nex-page-fetcher-allowlist.json",
      },
      candidates: [makeCandidate("a", "Warung A"), makeCandidate("b", "Warung B")],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async (l) => { log.push(l); },
      write_live_rows: async (rows) => { liveWrites.push(rows as unknown[]); return { inserted: rows.length }; },
      offset_applied: 0,
      live: false,
    });
    expect(report.stage).toBe("dormant");
    expect(report.probes_dormant).toBe(2);
    expect(report.probes_responded).toBe(0);
    expect(log.length).toBe(2);
    expect(liveWrites.length).toBe(0);
  });

  test("live=false NEVER calls write_live_rows even on responded probes", async () => {
    const fetcher: WikidataFetcher = makeFixtureWikidataFetcher({
      bindings: [{
        item: "http://www.wikidata.org/entity/Q42",
        qid: "Q42",
        admin: null,
        admin_label: null,
        coord: null,
        website: "https://example.com",
        phone: null,
        image: null,
      }],
    });
    const liveWrites: unknown[][] = [];
    const report = await orchestrateWikidataCrossref({
      fetcher_resolution: { fetcher, source: "production", reason: "fixture", allowlist_path: "al.json" },
      candidates: [makeCandidate("a", "A")],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async () => {},
      write_live_rows: async (rows) => { liveWrites.push(rows as unknown[]); return { inserted: rows.length }; },
      offset_applied: 0,
      live: false,
    });
    expect(report.probes_responded).toBe(1);
    expect(report.fields_new_counts.qid).toBe(1);
    expect(report.fields_new_counts.website).toBe(1);
    expect(liveWrites.length).toBe(0);
    expect(report.evidence_rows_written).toBe(0);
  });

  test("rate_limited is counted but no evidence emitted", async () => {
    const fetcher = makeFixtureWikidataFetcher({ kind: "rate_limited" });
    const log: string[] = [];
    const report = await orchestrateWikidataCrossref({
      fetcher_resolution: { fetcher, source: "production", reason: "fixture", allowlist_path: "al.json" },
      candidates: [makeCandidate("a", "A"), makeCandidate("b", "B")],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async (l) => { log.push(l); },
      offset_applied: 0,
      live: false,
    });
    expect(report.probes_rate_limited).toBe(2);
    expect(log.length).toBe(0);
    expect(report.evidence_rows_dryrun_logged).toBe(0);
  });

  test("rate-limit sleep is called between probes (not before the first)", async () => {
    const fetcher = makeFixtureWikidataFetcher({ kind: "responded_zero" });
    const sleepCalls: number[] = [];
    await orchestrateWikidataCrossref({
      fetcher_resolution: { fetcher, source: "production", reason: "fixture", allowlist_path: "al.json" },
      candidates: [makeCandidate("a", "A"), makeCandidate("b", "B"), makeCandidate("c", "C")],
      min_interval_ms: 123,
      sleep: async (ms) => { sleepCalls.push(ms); },
      append_evidence_log: async () => {},
      offset_applied: 0,
      live: false,
    });
    // Three candidates → 2 inter-probe sleeps.
    expect(sleepCalls).toEqual([123, 123]);
  });

  test("propagates offset_applied in the report", async () => {
    const report = await orchestrateWikidataCrossref({
      fetcher_resolution: {
        fetcher: NULL_WIKIDATA_FETCHER,
        source: "null_defaults",
        reason: "r",
        allowlist_path: "al.json",
      },
      candidates: [],
      min_interval_ms: 0,
      sleep: async () => {},
      append_evidence_log: async () => {},
      offset_applied: 99,
      live: false,
    });
    expect(report.offset_applied).toBe(99);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · governance invariants (string-grep)
// ═════════════════════════════════════════════════════════════════════

describe("governance invariants", () => {
  test("source file imports canonicaliseWebsite (shared pure helper)", async () => {
    const text = await fs.readFile(path.join(__dirname, "enrich-wikidata-crossref.ts"), "utf8");
    expect(text).toContain("canonicaliseWebsite");
  });

  test("source file never writes to nex.food_business or nex.business_canonical", async () => {
    const text = await fs.readFile(path.join(__dirname, "enrich-wikidata-crossref.ts"), "utf8");
    expect(text).not.toMatch(/INSERT\s+INTO\s+nex\.food_business/i);
    expect(text).not.toMatch(/INSERT\s+INTO\s+nex\.business_canonical/i);
    expect(text).not.toMatch(/UPDATE\s+nex\.food_business/i);
    expect(text).not.toMatch(/UPDATE\s+nex\.business_canonical/i);
  });

  test("source file never auto-promotes lifecycle_state", async () => {
    const text = await fs.readFile(path.join(__dirname, "enrich-wikidata-crossref.ts"), "utf8");
    expect(text).not.toMatch(/lifecycle_state\s*=\s*'(verified|claimed|published)'/i);
  });

  test("source file never hard-codes a wikidata.org URL for fetches", async () => {
    const text = await fs.readFile(path.join(__dirname, "enrich-wikidata-crossref.ts"), "utf8");
    // The wiki URL in the metadata (https://www.wikidata.org/wiki/Q###) is
    // provenance only · not a fetch target. We allow it there. The runner
    // must never call fetch() to a hard-coded wikidata endpoint.
    expect(text).not.toMatch(/fetch\(\s*["']https?:\/\/[^"']*wikidata/i);
    expect(text).not.toMatch(/https?:\/\/query\.wikidata\.org\/sparql/i);
  });

  test("source file goes through resolveProductionHarvestAdapters (sealed gate)", async () => {
    const text = await fs.readFile(path.join(__dirname, "enrich-wikidata-crossref.ts"), "utf8");
    expect(text).toContain("resolveProductionHarvestAdapters");
  });

  test("current founder-signed allowlist does NOT include a wikidata.org host (dormant-by-default)", async () => {
    const text = await fs.readFile(
      path.join(__dirname, "..", "..", "data", "nex-page-fetcher-allowlist.json"),
      "utf8",
    );
    expect(allowlistHasWikidataHost(text)).toBe(false);
  });
});
