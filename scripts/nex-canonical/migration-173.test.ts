// scripts/nex-canonical/migration-173.test.ts
//
// Structural tests for migration 173 (business_media).
// Pure · read-only inspection of the SQL file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "173_nex_business_media.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 173 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.business_media", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.business_media\b/i,
    );
  });
});

describe("migration 173 · column shape", () => {
  test("canonical_business_id uuid NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bcanonical_business_id\s+uuid\s+NOT\s+NULL\b/i);
  });

  test("media_kind text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bmedia_kind\s+text\s+NOT\s+NULL\b/i);
  });

  test("source_id text NOT NULL (per-row source attribution)", () => {
    const code = readCode();
    expect(code).toMatch(/\bsource_id\s+text\s+NOT\s+NULL\b/i);
  });

  test("storage_key text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bstorage_key\s+text\s+NOT\s+NULL\b/i);
  });

  test("mime_type, width_px, height_px, content_sha256, confidence columns present", () => {
    const code = readCode();
    expect(code).toMatch(/\bmime_type\b/);
    expect(code).toMatch(/\bwidth_px\b/);
    expect(code).toMatch(/\bheight_px\b/);
    expect(code).toMatch(/\bcontent_sha256\b/);
    expect(code).toMatch(/\bconfidence\b/);
  });

  test("owner_approved + approved gates present", () => {
    const code = readCode();
    expect(code).toMatch(/\bowner_approved\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+false\b/i);
    expect(code).toMatch(/\bapproved\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+false\b/i);
  });
});

describe("migration 173 · CHECKs", () => {
  test("ck_bm_media_kind covers 4 sealed kinds", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bm_media_kind\b/);
    for (const kind of ["owner_image", "verified_real", "crowdsourced", "category_fallback"]) {
      expect(code).toMatch(new RegExp(`'${kind}'`));
    }
  });

  test("content_sha256 CHECK is 64-char hex", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bm_content_sha256_fmt\b/);
    expect(code).toMatch(/\^\[a-f0-9\]\{64\}\$/);
  });

  test("confidence CHECK bounds [0,1]", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bm_confidence_range\b/);
    expect(code).toMatch(/confidence\s*>=\s*0/i);
    expect(code).toMatch(/confidence\s*<=\s*1/i);
  });

  test("fallback_category is required iff media_kind = category_fallback", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bm_fallback_category_consistency\b/);
  });

  test("dimensions must be positive when present", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bm_dimensions_positive\b/);
  });
});

describe("migration 173 · FKs + UNIQUE", () => {
  test("FK to business_canonical with ON DELETE CASCADE", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bm_canonical_business\b/);
    expect(code).toMatch(
      /FOREIGN\s+KEY\s*\(\s*canonical_business_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.business_canonical/i,
    );
    expect(code).toMatch(/ON\s+DELETE\s+CASCADE/i);
  });

  test("FK to source_registry with ON DELETE RESTRICT", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bm_source\b/);
    expect(code).toMatch(
      /FOREIGN\s+KEY\s*\(\s*source_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.source_registry/i,
    );
    expect(code).toMatch(/ON\s+DELETE\s+RESTRICT/i);
  });

  test("UNIQUE (canonical_business_id, media_kind, source_id)", () => {
    const code = readCode();
    expect(code).toMatch(/\buq_bm_canonical_kind_source\b/);
    expect(code).toMatch(/UNIQUE[\s\S]{1,80}canonical_business_id[\s\S]{1,80}media_kind[\s\S]{1,80}source_id/i);
  });
});

describe("migration 173 · indexes", () => {
  test("hot read index on (canonical_business_id, media_kind) WHERE approved=true", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bm_canonical_kind\b/);
    expect(code).toMatch(/WHERE\s+approved\s*=\s*true/i);
  });

  test("partial index on content_sha256", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bm_content_sha256\b/);
  });

  test("admin pending-approval queue index", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bm_pending_approval\b/);
    expect(code).toMatch(/WHERE\s+approved\s*=\s*false/i);
  });
});

describe("migration 173 · safety posture", () => {
  test("no DML / ALTER on existing tables", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP of existing nex.business_image (swap is a separate wave)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE[\s\S]{0,80}nex\.business_image/i);
  });

  test("no GRANT/REVOKE / triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });
});
