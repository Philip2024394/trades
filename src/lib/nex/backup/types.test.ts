// Backup constants + table ordering.

import { describe, it, expect } from "vitest";
import { BACKUP_TABLES, NEX_BACKUP_FORMAT_VERSION, BACKUP_BUCKET } from "./types";

describe("Backup constants", () => {
  it("format version is semver 1.0.0", () => {
    expect(NEX_BACKUP_FORMAT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("BACKUP_TABLES lists the six knowledge tables in FK-safe order", () => {
    const keys = BACKUP_TABLES.map((t) => t.key);
    // entries must come before versions/edges/reviews (which FK to entries)
    expect(keys.indexOf("entries")).toBeLessThan(keys.indexOf("versions"));
    expect(keys.indexOf("entries")).toBeLessThan(keys.indexOf("edges"));
    expect(keys.indexOf("entries")).toBeLessThan(keys.indexOf("reviews"));
  });

  it("every backup table has a timestamp column", () => {
    for (const t of BACKUP_TABLES) expect(typeof t.tsCol).toBe("string");
  });

  it("bucket name is stable", () => {
    expect(BACKUP_BUCKET).toBe("nex-backups");
  });
});
