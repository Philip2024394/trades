// Anonymise — pure function tests.

import { describe, it, expect } from "vitest";
import { anonymiseProject, classifyProjectType, extractRegion } from "./anonymise";

describe("extractRegion", () => {
  it("returns postcode area only", () => {
    expect(extractRegion("M25 1AB")).toBe("M");
    expect(extractRegion("LS12 4RB")).toBe("LS");
    expect(extractRegion("SW1A 0AA")).toBe("SW");
  });
  it("handles missing / malformed", () => {
    expect(extractRegion(null)).toBe("unknown");
    expect(extractRegion("")).toBe("unknown");
    expect(extractRegion("no-postcode-here")).toBe("unknown");
  });
});

describe("classifyProjectType", () => {
  it("recognises common project types", () => {
    expect(classifyProjectType("Smith kitchen refit")).toBe("kitchen");
    expect(classifyProjectType("Loft conversion")).toBe("loft_conversion");
    expect(classifyProjectType("New oak staircase")).toBe("staircase");
    expect(classifyProjectType("Roof felt replacement")).toBe("roofing");
  });
  it("falls back to 'other' when nothing matches", () => {
    expect(classifyProjectType("random project name")).toBe("other");
  });
});

describe("anonymiseProject", () => {
  const row = {
    id: "p1", title: "Smith kitchen refit", description: null, status: "complete",
    address_postcode: "M25 1AB", started_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-15T00:00:00Z"
  };

  it("returns null for projects without completed_at (no incomplete contribution)", () => {
    expect(anonymiseProject({ ...row, completed_at: null }, "carpenter", { members_count: 2, labour_hours: 40, materials_spend_pence: 100_000, labour_spend_pence: 50_000 })).toBeNull();
  });

  it("strips identifiers — no title/description on the fingerprint", () => {
    const fp = anonymiseProject(row, "carpenter", { members_count: 2, labour_hours: 40, materials_spend_pence: 100_000, labour_spend_pence: 50_000 })!;
    expect(fp).not.toBeNull();
    // Confirm none of the identifying fields exist on the shape.
    expect(Object.keys(fp)).not.toContain("title");
    expect(Object.keys(fp)).not.toContain("description");
    expect(Object.keys(fp)).not.toContain("homeowner_id");
    expect(Object.keys(fp)).not.toContain("address_line");
    expect(Object.keys(fp)).not.toContain("id");
  });

  it("anon_id has anon_ prefix + hides the project id", () => {
    const fp = anonymiseProject(row, "carpenter", { members_count: 2, labour_hours: 40, materials_spend_pence: 100_000, labour_spend_pence: 50_000 })!;
    expect(fp.anon_id.startsWith("anon_")).toBe(true);
    expect(fp.anon_id).not.toContain("p1");
  });

  it("keeps region area only (not full postcode)", () => {
    const fp = anonymiseProject(row, "carpenter", { members_count: 2, labour_hours: 40, materials_spend_pence: 100_000, labour_spend_pence: 50_000 })!;
    expect(fp.region).toBe("M");
    expect(fp.region.length).toBeLessThanOrEqual(2);
  });

  it("computes duration_days from started_at / completed_at", () => {
    const fp = anonymiseProject(row, "carpenter", { members_count: 2, labour_hours: 40, materials_spend_pence: 100_000, labour_spend_pence: 50_000 })!;
    expect(fp.duration_days).toBe(14);
  });
});
