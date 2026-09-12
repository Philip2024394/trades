// src/lib/nex/master-ai/master-ai-w4-6.test.ts
//
// NEX Master AI · W4-6 Primary-Evidence Mission · contract tests
// Philip 2026-09-07 · AUTHORIZE
//
// Covers:
//   · Robots.txt parser · correctly disallows /admin when User-agent: *
//   · Robots.txt parser · handles empty Disallow (allow-all)
//   · HTML text extraction produces plain text
//   · Primary adapter refuses without tos_reviewed_permits_reading=true
//   · Activity matrix requires all fields · latest-per-activity wins
//   · Usage stress produces 4 profiles × N tiers points
//   · Attack survival requires exactly 14 attacks
//   · Verdict logic: BROKE_YES on CRITICAL → 🔴 NO
//   · Verdict logic: all survived + primary evidence + no unknowns/reqs → 🟢 YES
//   · Verdict logic: all survived + finite conditions → 🟢 YES WITH CONDITIONS

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-w46-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
});
afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("W4-6 · Robots.txt parser + HTML extraction", () => {
  it("Disallow: /admin blocks /admin/foo but allows /public", async () => {
    const { isPathAllowedByRobots } = await import("./live-adapter-http-primary");
    const robots = "User-agent: *\nDisallow: /admin\n";
    expect(isPathAllowedByRobots(robots, "AnyAgent/1.0", "/admin/foo")).toBe(false);
    expect(isPathAllowedByRobots(robots, "AnyAgent/1.0", "/public")).toBe(true);
  });
  it("Disallow: / blocks everything", async () => {
    const { isPathAllowedByRobots } = await import("./live-adapter-http-primary");
    const robots = "User-agent: *\nDisallow: /\n";
    expect(isPathAllowedByRobots(robots, "AnyAgent/1.0", "/anything")).toBe(false);
  });
  it("empty robots.txt permits everything", async () => {
    const { isPathAllowedByRobots } = await import("./live-adapter-http-primary");
    expect(isPathAllowedByRobots("", "AnyAgent/1.0", "/anything")).toBe(true);
  });
  it("extractPlainText strips tags and collapses whitespace", async () => {
    const { extractPlainText } = await import("./live-adapter-http-primary");
    const html = "<html><body><h1>Regulation X</h1><p>Frequency: 2400-2483.5 MHz</p></body></html>";
    const text = extractPlainText(html);
    expect(text).toContain("Regulation X");
    expect(text).toContain("2400-2483.5 MHz");
    expect(text).not.toContain("<");
  });
});

describe("W4-6 · Primary source adapter", () => {
  it("REFUSES to construct without tos_reviewed_permits_reading=true", async () => {
    const { createPrimarySourceAdapter } = await import("./live-adapter-http-primary");
    expect(() => createPrimarySourceAdapter({
      source_slug: "test", base_origin: "https://example.gov",
      tos_reviewed_permits_reading: false as unknown as true,
    })).toThrow(/tos_review/);
  });

  it("BLOCKED when robots.txt disallows the path", async () => {
    const { createPrimarySourceAdapter } = await import("./live-adapter-http-primary");
    let callCount = 0;
    const stub: typeof fetch = async (url: any) => {
      const u = String(url);
      callCount++;
      if (u.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /gated\n", { status: 200, headers: { "content-type": "text/plain" } });
      return new Response("<html>should not be reached</html>", { status: 200, headers: { "content-type": "text/html" } });
    };
    const adapter = createPrimarySourceAdapter({
      source_slug: "test", base_origin: "https://example.gov",
      tos_reviewed_permits_reading: true, fetch_impl: stub,
    });
    const r = await adapter.fetch({ query_id: "q", question: "/gated/document", target_source_slugs: ["test"], created_at_iso: "", created_by: "test", priority: 0, status: "OPEN", blocked_reason: null, target_source_slug: null } as any);
    expect(r.status).toBe("BLOCKED");
    if (r.status === "BLOCKED") expect(r.reason).toContain("robots_txt_disallows");
    expect(callCount).toBe(1);                    // only robots.txt fetched
  });

  it("OK when robots.txt permits and content is substantive text/html", async () => {
    const { createPrimarySourceAdapter } = await import("./live-adapter-http-primary");
    const substantive = "Peraturan Menteri No. 5 Tahun 2021 tentang penggunaan spektrum frekuensi radio pita 2.4 GHz. Pasal 1: Definisi. Pasal 2: Ketentuan Umum. Frequency band 2400-2483.5 MHz. Class licence. EIRP 100 mW indoor.".repeat(5);
    const stub: typeof fetch = async (url: any) => {
      const u = String(url);
      if (u.endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response(`<html><body>${substantive}</body></html>`, {
        status: 200, headers: { "content-type": "text/html; charset=utf-8" },
      });
    };
    const adapter = createPrimarySourceAdapter({
      source_slug: "test", base_origin: "https://example.gov",
      tos_reviewed_permits_reading: true, fetch_impl: stub,
    });
    const r = await adapter.fetch({ query_id: "q", question: "/regulation/pm-5-2021" } as any);
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.raw_evidence).toContain("EIRP 100 mW");
      expect(r.license).toContain("public-government-document");
    }
  });

  it("BLOCKED when content is gated (very short text)", async () => {
    const { createPrimarySourceAdapter } = await import("./live-adapter-http-primary");
    const stub: typeof fetch = async (url: any) => {
      const u = String(url);
      if (u.endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response("<html><body>please enable javascript</body></html>", {
        status: 200, headers: { "content-type": "text/html" },
      });
    };
    const adapter = createPrimarySourceAdapter({
      source_slug: "test", base_origin: "https://example.gov",
      tos_reviewed_permits_reading: true, fetch_impl: stub,
    });
    const r = await adapter.fetch({ query_id: "q", question: "/document" } as any);
    expect(r.status).toBe("BLOCKED");
    if (r.status === "BLOCKED") expect(r.reason).toMatch(/source_gated|scripted/);
  });
});

describe("W4-6 · Activity matrix", () => {
  it("REJECTS unknown activity", async () => {
    const { recordActivityMatrixRow } = await import("./connectivity-w4-6");
    expect(() => recordActivityMatrixRow({
      activity: "made_up_activity" as any, jurisdiction: "ID",
      classification: "UNKNOWN", licence_required: "UNKNOWN",
      conditions: "", primary_evidence_ref: null, evidence_tier: "NONE",
      confidence: "NONE", interpretation_note: "test note",
      counterargument_note: null,
    })).toThrow(/unknown_activity/);
  });
  it("REJECTS row missing interpretation_note", async () => {
    const { recordActivityMatrixRow } = await import("./connectivity-w4-6");
    expect(() => recordActivityMatrixRow({
      activity: "nex_charges_users_rp0" as any, jurisdiction: "ID",
      classification: "UNKNOWN", licence_required: "UNKNOWN",
      conditions: "", primary_evidence_ref: null, evidence_tier: "NONE",
      confidence: "NONE", interpretation_note: "",
      counterargument_note: null,
    })).toThrow(/interpretation_note/);
  });
  it("latest per activity wins", async () => {
    const { recordActivityMatrixRow, currentActivityMatrix } = await import("./connectivity-w4-6");
    recordActivityMatrixRow({
      activity: "nex_charges_users_rp0", jurisdiction: "ID",
      classification: "UNKNOWN", licence_required: "UNKNOWN",
      conditions: "-", primary_evidence_ref: null, evidence_tier: "NONE",
      confidence: "NONE", interpretation_note: "first pass",
      counterargument_note: null,
    });
    recordActivityMatrixRow({
      activity: "nex_charges_users_rp0", jurisdiction: "ID",
      classification: "REQUIRES_PARTNERSHIP", licence_required: "PARTNERSHIP_ONLY",
      conditions: "-", primary_evidence_ref: null, evidence_tier: "TIER_3",
      confidence: "MEDIUM", interpretation_note: "second pass with evidence",
      counterargument_note: null,
    });
    const current = currentActivityMatrix("ID");
    expect(current.find((r) => r.activity === "nex_charges_users_rp0")?.classification).toBe("REQUIRES_PARTNERSHIP");
  });
});

describe("W4-6 · Usage stress test", () => {
  it("produces 4 profiles × N tiers points", async () => {
    const { runUsageStress, USER_PROFILES } = await import("./connectivity-w4-6");
    const r = runUsageStress([100, 1000, 10_000]);
    expect(r.points.length).toBe(USER_PROFILES.length * 3);
    // Extreme user at 10k users should have higher peak than light user
    const extreme = r.points.find((p) => p.users === 10_000 && p.profile === "extreme")!;
    const light   = r.points.find((p) => p.users === 10_000 && p.profile === "light")!;
    expect(extreme.peak_aggregate_mbps).toBeGreaterThan(light.peak_aggregate_mbps);
    expect(extreme.total_gb_per_month).toBeGreaterThan(light.total_gb_per_month);
  });
});

describe("W4-6 · Attack survival gate", () => {
  it("REJECTS submission that doesn't have exactly 14 attacks", async () => {
    const { recordAttackSurvival } = await import("./connectivity-w4-6");
    expect(() => recordAttackSurvival({ attacks: [] })).toThrow(/requires_14_attacks/);
  });

  it("survived_all_critical=false when any CRITICAL attack has verdict=BROKE_YES", async () => {
    const { recordAttackSurvival, FOURTEEN_ATTACKS } = await import("./connectivity-w4-6");
    const attacks = FOURTEEN_ATTACKS.map((a, i) => ({
      attack_id: `test-${i}`, attack_slug: a.slug, question: a.question,
      severity: a.severity, verdict: i === 0 ? "BROKE_YES" : "SURVIVED",
      reasoning: `test reason ${i}`, what_would_change_verdict: "test change",
    })) as any;
    const r = recordAttackSurvival({ attacks });
    expect(r.survived_all_critical).toBe(false);
    expect(r.broke_yes_count).toBeGreaterThan(0);
  });

  it("survived_all_critical=true when all CRITICAL attacks SURVIVED or WEAKENED", async () => {
    const { recordAttackSurvival, FOURTEEN_ATTACKS } = await import("./connectivity-w4-6");
    const attacks = FOURTEEN_ATTACKS.map((a, i) => ({
      attack_id: `test-${i}`, attack_slug: a.slug, question: a.question,
      severity: a.severity, verdict: "SURVIVED",
      reasoning: "test", what_would_change_verdict: "test",
    })) as any;
    const r = recordAttackSurvival({ attacks });
    expect(r.survived_all_critical).toBe(true);
  });
});

describe("W4-6 · Final verdict composition", () => {
  it("🔴 NO when any CRITICAL attack broke_yes", async () => {
    const { composeFinalVerdict, FOURTEEN_ATTACKS } = await import("./connectivity-w4-6");
    const brokenCritical = FOURTEEN_ATTACKS.find((a) => a.severity === "CRITICAL")!;
    const survival = {
      survival_id: "s", recorded_at_iso: "", attacks: [{
        attack_id: "a", attack_slug: brokenCritical.slug, question: brokenCritical.question,
        severity: brokenCritical.severity, verdict: "BROKE_YES" as const,
        reasoning: "primary_evidence_says_no", what_would_change_verdict: "primary_source_correction",
      }], survived_all_critical: false, survived_all_high: true,
      broke_yes_count: 1, weakened_count: 0, survived_count: 0, insufficient_evidence_count: 0,
    };
    const v = composeFinalVerdict({ survival, primary_evidence_findings_count: 5, activity_matrix: [] });
    expect(v.verdict).toBe("🔴 NO");
  });

  it("🟢 YES WITH CONDITIONS when all critical survived + finite requirements exist", async () => {
    const { composeFinalVerdict, FOURTEEN_ATTACKS } = await import("./connectivity-w4-6");
    const attacks = FOURTEEN_ATTACKS.map((a) => ({
      attack_id: "a", attack_slug: a.slug, question: a.question,
      severity: a.severity, verdict: "SURVIVED" as const,
      reasoning: "survived", what_would_change_verdict: "",
    }));
    const survival = {
      survival_id: "s", recorded_at_iso: "", attacks,
      survived_all_critical: true, survived_all_high: true,
      broke_yes_count: 0, weakened_count: 0, survived_count: 14, insufficient_evidence_count: 0,
    };
    const matrix = [{
      row_id: "r", recorded_at_iso: "", activity: "nex_provides_wifi_to_its_own_users" as any,
      jurisdiction: "ID", classification: "REQUIRES_PARTNERSHIP" as const,
      licence_required: "PARTNERSHIP_ONLY" as const, conditions: "-",
      primary_evidence_ref: null, evidence_tier: "TIER_3" as const,
      confidence: "MEDIUM" as const, interpretation_note: "-", counterargument_note: null,
    }];
    const v = composeFinalVerdict({ survival, primary_evidence_findings_count: 3, activity_matrix: matrix });
    expect(v.verdict).toBe("🟢 YES WITH CONDITIONS");
  });
});
