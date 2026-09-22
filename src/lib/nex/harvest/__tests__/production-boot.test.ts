// src/lib/nex/harvest/__tests__/production-boot.test.ts
//
// NEX 24/7 World Harvest Engine · Production Boot Glue · acceptance
// Founder-authorised scope-locked wire-in only · 2026-09-22.
//
// Every test uses an injectable file reader · nothing touches disk or network.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  resolveProductionHarvestAdapters,
  _PRODUCTION_BOOT_GATED_BY_ACTIVATION_ENV,
  _PRODUCTION_BOOT_HOSTS_FROM_FOUNDER_SIGNED_ALLOWLIST,
  _PRODUCTION_BOOT_NEVER_THROWS,
  _PRODUCTION_BOOT_IS_THE_ONLY_PRODUCTION_CONSTRUCTOR,
} from "../production-boot";

const FOUNDER_SIGNED_ALLOWLIST_JSON = JSON.stringify({
  version: 1,
  signed_by: "founder",
  signed_at: "2026-09-22T00:00:00Z",
  allowed_hosts: [
    { host: "overpass-api.de", reason: "OSM primary", max_bytes: 10_485_760, min_interval_ms: 5000 },
    { host: "overpass.osm.ch", reason: "OSM mirror",  max_bytes:  5_242_880, min_interval_ms: 2000 },
  ],
});

const dummy_path = "/dummy/nex-page-fetcher-allowlist.json";
const mk_reader = (payload: string) => async (_p: string) => payload;

describe("Production boot · gate off returns null_defaults", () => {
  it("(A1) NEX_PAGE_FETCHER_ACTIVATION unset → null_defaults · no adapters constructed", async () => {
    const r = await resolveProductionHarvestAdapters({ env: {} });
    expect(r.source).toBe("null_defaults");
    expect(r.overpass_adapter).toBeUndefined();
    expect(r.page_fetcher).toBeUndefined();
    expect(r.reason).toMatch(/NEX_PAGE_FETCHER_ACTIVATION/);
  });
  it("(A2) NEX_PAGE_FETCHER_ACTIVATION='off' → null_defaults", async () => {
    const r = await resolveProductionHarvestAdapters({ env: { NEX_PAGE_FETCHER_ACTIVATION: "off" } });
    expect(r.source).toBe("null_defaults");
    expect(r.overpass_adapter).toBeUndefined();
    expect(r.page_fetcher).toBeUndefined();
  });
  it("(A3) NEX_PAGE_FETCHER_ACTIVATION='ON' (wrong case) → null_defaults (strict equal)", async () => {
    const r = await resolveProductionHarvestAdapters({ env: { NEX_PAGE_FETCHER_ACTIVATION: "ON" } });
    expect(r.source).toBe("null_defaults");
  });
});

describe("Production boot · malformed / missing allowlist returns null_defaults (never throws)", () => {
  it("(B1) file unreadable → null_defaults with reason", async () => {
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: async () => { throw new Error("ENOENT"); },
    });
    expect(r.source).toBe("null_defaults");
    expect(r.reason).toMatch(/unreadable/);
    expect(r.overpass_adapter).toBeUndefined();
  });
  it("(B2) malformed JSON → null_defaults (never throws)", async () => {
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: mk_reader("{not json"),
    });
    expect(r.source).toBe("null_defaults");
    expect(r.reason).toMatch(/invalid JSON/);
  });
  it("(B3) signed_by !== 'founder' → null_defaults", async () => {
    const bad = JSON.stringify({ version: 1, signed_by: "someone_else", signed_at: "x", allowed_hosts: [{ host: "h", max_bytes: 1, min_interval_ms: 1 }] });
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: mk_reader(bad),
    });
    expect(r.source).toBe("null_defaults");
    expect(r.reason).toMatch(/Founder signature/);
  });
  it("(B4) empty allowed_hosts → null_defaults", async () => {
    const bad = JSON.stringify({ version: 1, signed_by: "founder", signed_at: "x", allowed_hosts: [] });
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: mk_reader(bad),
    });
    expect(r.source).toBe("null_defaults");
    expect(r.reason).toMatch(/empty allowed_hosts/);
  });
  it("(B5) missing signed_at → null_defaults", async () => {
    const bad = JSON.stringify({ version: 1, signed_by: "founder", allowed_hosts: [{ host: "h", max_bytes: 1, min_interval_ms: 1 }] });
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: mk_reader(bad),
    });
    expect(r.source).toBe("null_defaults");
  });
});

describe("Production boot · valid allowlist + gate on → production adapters", () => {
  it("(C1) gate=on + valid Founder-signed file → production adapters returned", async () => {
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: mk_reader(FOUNDER_SIGNED_ALLOWLIST_JSON),
    });
    expect(r.source).toBe("production");
    expect(r.overpass_adapter).toBeDefined();
    expect(r.page_fetcher).toBeDefined();
    expect(r.reason).toMatch(/2 Founder-signed host/);
  });

  it("(C2) constructed Overpass adapter uses hosts FROM THE FILE · off-list host → adapter_dormant", async () => {
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: mk_reader(FOUNDER_SIGNED_ALLOWLIST_JSON),
    });
    const off_list = await r.overpass_adapter!.probe({
      host: "not-in-allowlist.example",
      query: "[out:json];out;",
      timeout_ms: 5000,
    });
    expect(off_list.kind).toBe("adapter_dormant");
    expect(off_list.elements).toEqual([]);
  });

  it("(C3) constructed PageFetcher's own activation gate still authoritative (fetch off-list → blocked_by_governance)", async () => {
    const r = await resolveProductionHarvestAdapters({
      env: { NEX_PAGE_FETCHER_ACTIVATION: "on" },
      allowlist_path: dummy_path,
      read_file: mk_reader(FOUNDER_SIGNED_ALLOWLIST_JSON),
    });
    const result = await r.page_fetcher!.fetchPage({
      url: "https://not-in-allowlist.example/",
      deadline_ms: 5000,
    });
    expect(result.kind).toBe("blocked_by_governance");
    expect(result.note).toMatch(/not on Founder-signed allowlist/);
  });
});

describe("Production boot · governance canaries", () => {
  it("(F1) all four boundary markers present as string exports", () => {
    expect(typeof _PRODUCTION_BOOT_GATED_BY_ACTIVATION_ENV).toBe("string");
    expect(typeof _PRODUCTION_BOOT_HOSTS_FROM_FOUNDER_SIGNED_ALLOWLIST).toBe("string");
    expect(typeof _PRODUCTION_BOOT_NEVER_THROWS).toBe("string");
    expect(typeof _PRODUCTION_BOOT_IS_THE_ONLY_PRODUCTION_CONSTRUCTOR).toBe("string");
  });

  it("(F2) grep proof · outside test files, `new ProductionOverpassAdapter` appears ONLY in production-boot.ts", async () => {
    const root = path.resolve(__dirname, "../../../..");   // src/
    const files: string[] = [];
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === "__tests__" || e.name.startsWith(".")) continue;
          await walk(p);
        } else if (e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) {
          files.push(p);
        }
      }
    }
    await walk(root);
    const constructors: string[] = [];
    for (const f of files) {
      const text = await fs.readFile(f, "utf8");
      // strip string literals so doctrine-name strings don't false-match
      const stripped = text
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/`(?:\\.|[^`\\])*`/g, "``");
      if (/\bnew\s+ProductionOverpassAdapter\s*\(/.test(stripped)) {
        constructors.push(f.replace(root, "src"));
      }
    }
    // exactly one non-test source file constructs it: production-boot.ts
    expect(constructors.map(f => f.replace(/\\/g, "/"))).toEqual([
      "src/lib/nex/harvest/production-boot.ts",
    ]);
  });

  it("(F3) grep proof · outside test files, `new ProductionPageFetcher` appears ONLY in production-boot.ts", async () => {
    const root = path.resolve(__dirname, "../../../..");
    const files: string[] = [];
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === "__tests__" || e.name.startsWith(".")) continue;
          await walk(p);
        } else if (e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) {
          files.push(p);
        }
      }
    }
    await walk(root);
    const constructors: string[] = [];
    for (const f of files) {
      const text = await fs.readFile(f, "utf8");
      const stripped = text
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/`(?:\\.|[^`\\])*`/g, "``");
      if (/\bnew\s+ProductionPageFetcher\s*\(/.test(stripped)) {
        constructors.push(f.replace(root, "src"));
      }
    }
    expect(constructors.map(f => f.replace(/\\/g, "/"))).toEqual([
      "src/lib/nex/harvest/production-boot.ts",
    ]);
  });

  it("(F4) module exports no bypass symbols (no injectFakeAllowlist / disableActivationCheck / etc.)", async () => {
    const mod: any = await import("../production-boot");
    const bad = [
      "injectFakeAllowlist",
      "disableActivationCheck",
      "bypassFounderSignature",
      "overrideAllowedHosts",
      "forceProductionAdapters",
    ];
    for (const name of bad) {
      expect(mod[name]).toBeUndefined();
    }
  });
});
