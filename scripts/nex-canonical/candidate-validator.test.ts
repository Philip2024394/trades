// scripts/nex-canonical/candidate-validator.test.ts
//
// Pure unit tests for the Candidate shape validator and JSONL parser.
// No DB. No network. No pg Client.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CANDIDATE_GENERATOR_LITERAL,
  CANDIDATE_STATUS_LITERAL,
  CandidateShapeError,
  SEALED_RISK_CATEGORIES,
  isCandidate,
  parseCandidateJsonl,
  validateCandidate,
} from "./candidate-validator";
import { SEALED_ENTITY_TYPES } from "./generate-candidates";

// ═════════════════════════════════════════════════════════════════════
// §0 · Canonical valid-candidate fixture
// ═════════════════════════════════════════════════════════════════════

function makeValidCandidate(): Record<string, unknown> {
  return {
    candidate_id: "cand-001",
    status: "pending_founder_review",
    entity_type: "food",
    country: "ID",
    identity: {
      name_canonical: "Warung Bu Siti",
      aliases: ["Warung Siti", "Bu Siti"],
      phone_e164: "+6281234567890",
      website_apex: "warungsiti.id",
      osm_id: "node/12345",
      wikidata_qid: null,
      city: "Bandung",
      district: "Cihampelas",
      // Migration 178 fields · default null in the shared fixture so
      // existing happy-path tests exercise the sparse-row shape.
      street_line: null,
      neighbourhood: null,
      address: null,
      coordinates: { lat: -6.9, lng: 107.6 },
    },
    legacy_source: {
      table: "nex.food_business",
      ref: "food-ref-1",
      internal_id: "fb-1",
    },
    risk_categories: ["R1", "R3"],
    selection_score: 0.73,
    selection_rationale: [
      { risk_category: "R1", contribution: 0.5, note: "live listing" },
      { risk_category: "R3", contribution: 0.23, note: "dup-source" },
    ],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: "2026-10-08T12:00:00.000Z",
      generation_run_id: "nex-cand-v1-2026-10-08",
    },
    caveats: ["from preserved snapshot"],
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Happy path
// ═════════════════════════════════════════════════════════════════════

describe("validateCandidate · happy path", () => {
  test("accepts a canonical valid Candidate", () => {
    const c = makeValidCandidate();
    const v = validateCandidate(c);
    expect(v.candidate_id).toBe("cand-001");
    expect(v.status).toBe("pending_founder_review");
    expect(v.entity_type).toBe("food");
    expect(v.identity.coordinates).toEqual({ lat: -6.9, lng: 107.6 });
    expect(v.risk_categories).toEqual(["R1", "R3"]);
    expect(v.selection_score).toBe(0.73);
    expect(v.generation_source.generator).toBe(CANDIDATE_GENERATOR_LITERAL);
  });

  test("accepts every sealed entity_type", () => {
    for (const et of SEALED_ENTITY_TYPES) {
      const c = makeValidCandidate();
      c.entity_type = et;
      expect(() => validateCandidate(c)).not.toThrow();
    }
  });

  test("accepts every risk category", () => {
    for (const rc of SEALED_RISK_CATEGORIES) {
      const c = makeValidCandidate();
      c.risk_categories = [rc];
      (c.selection_rationale as unknown[])[0] = {
        risk_category: rc,
        contribution: 0.5,
        note: "n",
      };
      expect(() => validateCandidate(c)).not.toThrow();
    }
  });

  test("accepts null coordinates", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).coordinates = null;
    expect(() => validateCandidate(c)).not.toThrow();
  });

  test("accepts null-valued optional identity fields", () => {
    const c = makeValidCandidate();
    const ident = c.identity as Record<string, unknown>;
    ident.phone_e164 = null;
    ident.website_apex = null;
    ident.osm_id = null;
    ident.wikidata_qid = null;
    ident.city = null;
    ident.district = null;
    expect(() => validateCandidate(c)).not.toThrow();
  });

  test("accepts empty aliases and caveats arrays", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).aliases = [];
    c.caveats = [];
    expect(() => validateCandidate(c)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §1b · address jsonb · sealed { line1, postal_code } | null
// ═════════════════════════════════════════════════════════════════════

describe("validateCandidate · address jsonb (sealed doctrine shape)", () => {
  test("accepts address = null (honest absence)", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = null;
    const v = validateCandidate(c);
    expect(v.identity.address).toBeNull();
  });

  test("accepts address with populated line1 and null postal_code (legacy food-business shape)", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = {
      line1: "73, Jalan Braga",
      postal_code: null,
    };
    const v = validateCandidate(c);
    expect(v.identity.address).toEqual({
      line1: "73, Jalan Braga",
      postal_code: null,
    });
  });

  test("accepts address with both line1 and postal_code populated", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = {
      line1: "138, Raya Kerobokan",
      postal_code: "80361",
    };
    const v = validateCandidate(c);
    expect(v.identity.address).toEqual({
      line1: "138, Raya Kerobokan",
      postal_code: "80361",
    });
  });

  test("accepts address with both keys null (object permitted even if contents are null)", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = {
      line1: null,
      postal_code: null,
    };
    const v = validateCandidate(c);
    expect(v.identity.address).toEqual({ line1: null, postal_code: null });
  });

  test("rejects address missing line1 key (sealed shape · all keys required)", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = { postal_code: null };
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects address missing postal_code key", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = { line1: "x" };
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects address with unknown extra key (sealed shape · no new keys)", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = {
      line1: "x",
      postal_code: null,
      city: "x", // not permitted · address has only line1 + postal_code
    };
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects address as a plain string (not the sealed object shape)", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = "73, Jalan Braga";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects line1 as a number (type must be string | null)", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = {
      line1: 42,
      postal_code: null,
    };
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("error path for malformed address pinpoints the exact key", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).address = {
      line1: null,
      postal_code: 123,
    };
    expect(() => validateCandidate(c)).toThrow(/postal_code/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · status literal pin
// ═════════════════════════════════════════════════════════════════════

describe("status literal", () => {
  test("rejects status other than 'pending_founder_review'", () => {
    const c = makeValidCandidate();
    c.status = "approved";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
    try {
      validateCandidate(c);
    } catch (e) {
      expect((e as CandidateShapeError).path).toContain("root.status");
      expect((e as Error).message).toContain('"approved"');
    }
  });

  test("rejects status = null", () => {
    const c = makeValidCandidate();
    c.status = null;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("accepts only the sealed literal CANDIDATE_STATUS_LITERAL", () => {
    expect(CANDIDATE_STATUS_LITERAL).toBe("pending_founder_review");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · entity_type sealed enum · indirect Rule 5l guard
// ═════════════════════════════════════════════════════════════════════

describe("entity_type sealed enum", () => {
  test("rejects a value outside SEALED_ENTITY_TYPES", () => {
    const c = makeValidCandidate();
    c.entity_type = "restaurant"; // not sealed
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects quarantined Rule 5l business_category values if misused as entity_type", () => {
    for (const q of ["event", "portfolio", "community", "creator"]) {
      const c = makeValidCandidate();
      c.entity_type = q;
      expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
    }
  });

  test("rejects null entity_type", () => {
    const c = makeValidCandidate();
    c.entity_type = null;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · risk_categories
// ═════════════════════════════════════════════════════════════════════

describe("risk_categories", () => {
  test("rejects a non-array", () => {
    const c = makeValidCandidate();
    c.risk_categories = "R1";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects an element not in R1..R10", () => {
    const c = makeValidCandidate();
    c.risk_categories = ["R1", "R11"];
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
    try {
      validateCandidate(c);
    } catch (e) {
      expect((e as CandidateShapeError).path).toContain(
        "risk_categories[1]",
      );
    }
  });

  test("accepts an empty array (no inferred category)", () => {
    const c = makeValidCandidate();
    c.risk_categories = [];
    expect(() => validateCandidate(c)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · selection_score range
// ═════════════════════════════════════════════════════════════════════

describe("selection_score range [0,1]", () => {
  test("rejects < 0", () => {
    const c = makeValidCandidate();
    c.selection_score = -0.01;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects > 1", () => {
    const c = makeValidCandidate();
    c.selection_score = 1.01;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("accepts 0 and 1", () => {
    for (const v of [0, 1, 0.5, 0.999999]) {
      const c = makeValidCandidate();
      c.selection_score = v;
      expect(() => validateCandidate(c)).not.toThrow();
    }
  });

  test("rejects NaN", () => {
    const c = makeValidCandidate();
    c.selection_score = Number.NaN;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects Infinity", () => {
    const c = makeValidCandidate();
    c.selection_score = Number.POSITIVE_INFINITY;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · coordinates ranges
// ═════════════════════════════════════════════════════════════════════

describe("coordinates", () => {
  test("rejects lat outside [-90,90]", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).coordinates = { lat: 91, lng: 0 };
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects lng outside [-180,180]", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).coordinates = {
      lat: 0,
      lng: 180.1,
    };
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects coordinates with extra keys", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).coordinates = {
      lat: 0,
      lng: 0,
      z: 42,
    };
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("accepts polar extremes", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).coordinates = {
      lat: 90,
      lng: 180,
    };
    expect(() => validateCandidate(c)).not.toThrow();
    (c.identity as Record<string, unknown>).coordinates = {
      lat: -90,
      lng: -180,
    };
    expect(() => validateCandidate(c)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · generation_source · generator literal pin
// ═════════════════════════════════════════════════════════════════════

describe("generation_source literal pin", () => {
  test("rejects generator value not equal to the sealed literal", () => {
    const c = makeValidCandidate();
    (c.generation_source as Record<string, unknown>).generator =
      "scripts/other/generator.ts";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects empty generation_run_id", () => {
    const c = makeValidCandidate();
    (c.generation_source as Record<string, unknown>).generation_run_id = "";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects missing generated_at", () => {
    const c = makeValidCandidate();
    delete (c.generation_source as Record<string, unknown>).generated_at;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("sealed literal matches the generator's own string", () => {
    expect(CANDIDATE_GENERATOR_LITERAL).toBe(
      "scripts/nex-canonical/generate-candidates.ts",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · strict mode · extra keys rejected
// ═════════════════════════════════════════════════════════════════════

describe("strict mode · extra keys", () => {
  test("rejects extra top-level key", () => {
    const c = makeValidCandidate();
    (c as Record<string, unknown>).ghost = "x";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
    try {
      validateCandidate(c);
    } catch (e) {
      expect((e as CandidateShapeError).path).toContain("root.ghost");
      expect((e as Error).message).toContain("unknown field");
    }
  });

  test("rejects extra identity key", () => {
    const c = makeValidCandidate();
    (c.identity as Record<string, unknown>).secret = "nope";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects extra legacy_source key", () => {
    const c = makeValidCandidate();
    (c.legacy_source as Record<string, unknown>).extra = "x";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects extra generation_source key", () => {
    const c = makeValidCandidate();
    (c.generation_source as Record<string, unknown>).extra = "x";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects extra selection_rationale[i] key", () => {
    const c = makeValidCandidate();
    const rat = c.selection_rationale as Record<string, unknown>[];
    rat[0].extra = "x";
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · missing required fields
// ═════════════════════════════════════════════════════════════════════

describe("missing required fields · each path reported", () => {
  const topLevelRequired = [
    "candidate_id",
    "status",
    "entity_type",
    "country",
    "identity",
    "legacy_source",
    "risk_categories",
    "selection_score",
    "selection_rationale",
    "generation_source",
    "caveats",
  ];
  test.each(topLevelRequired)("rejects missing root.%s", (field) => {
    const c = makeValidCandidate();
    delete (c as Record<string, unknown>)[field];
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
    try {
      validateCandidate(c);
    } catch (e) {
      expect((e as CandidateShapeError).path).toContain(`root.${field}`);
    }
  });

  test("rejects missing identity.name_canonical", () => {
    const c = makeValidCandidate();
    delete (c.identity as Record<string, unknown>).name_canonical;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });

  test("rejects missing legacy_source.ref", () => {
    const c = makeValidCandidate();
    delete (c.legacy_source as Record<string, unknown>).ref;
    expect(() => validateCandidate(c)).toThrow(CandidateShapeError);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · isCandidate predicate
// ═════════════════════════════════════════════════════════════════════

describe("isCandidate predicate", () => {
  test("returns true for valid", () => {
    expect(isCandidate(makeValidCandidate())).toBe(true);
  });

  test("returns false for invalid without throwing", () => {
    const c = makeValidCandidate();
    c.status = "wrong";
    expect(isCandidate(c)).toBe(false);
  });

  test("returns false for null / primitive / array", () => {
    expect(isCandidate(null)).toBe(false);
    expect(isCandidate(42)).toBe(false);
    expect(isCandidate("x")).toBe(false);
    expect(isCandidate([])).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §11 · parseCandidateJsonl
// ═════════════════════════════════════════════════════════════════════

describe("parseCandidateJsonl", () => {
  function serialize(c: unknown): string {
    return JSON.stringify(c);
  }

  test("parses one valid line", () => {
    const text = serialize(makeValidCandidate()) + "\n";
    const parsed = parseCandidateJsonl(text);
    expect(parsed.length).toBe(1);
    expect(parsed[0].candidate_id).toBe("cand-001");
  });

  test("parses multiple valid lines in order", () => {
    const a = makeValidCandidate();
    a.candidate_id = "cand-a";
    const b = makeValidCandidate();
    b.candidate_id = "cand-b";
    const text = `${serialize(a)}\n${serialize(b)}\n`;
    const parsed = parseCandidateJsonl(text);
    expect(parsed.length).toBe(2);
    expect(parsed[0].candidate_id).toBe("cand-a");
    expect(parsed[1].candidate_id).toBe("cand-b");
  });

  test("tolerates blank lines (including trailing newline)", () => {
    const c = serialize(makeValidCandidate());
    const text = `${c}\n\n${c}\n`;
    const parsed = parseCandidateJsonl(text);
    expect(parsed.length).toBe(2);
  });

  test("empty input yields empty array", () => {
    expect(parseCandidateJsonl("")).toEqual([]);
    expect(parseCandidateJsonl("\n\n\n")).toEqual([]);
  });

  test("invalid JSON on line N raises with line number", () => {
    const c = serialize(makeValidCandidate());
    const text = `${c}\n{not valid json\n${c}\n`;
    try {
      parseCandidateJsonl(text);
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CandidateShapeError);
      expect((e as CandidateShapeError).path).toContain("line 2");
    }
  });

  test("shape error on line N raises with line + inner path", () => {
    const good = serialize(makeValidCandidate());
    const bad = makeValidCandidate();
    bad.selection_score = 2; // out of range
    const text = `${good}\n${serialize(bad)}\n`;
    try {
      parseCandidateJsonl(text);
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CandidateShapeError);
      expect((e as CandidateShapeError).path).toContain("line 2");
      expect((e as CandidateShapeError).path).toContain("selection_score");
    }
  });

  test("does not return partial results on failure", () => {
    const good = serialize(makeValidCandidate());
    const bad = makeValidCandidate();
    (bad as Record<string, unknown>).status = "nope";
    const text = `${good}\n${serialize(bad)}\n${good}\n`;
    expect(() => parseCandidateJsonl(text)).toThrow(CandidateShapeError);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §12 · Grep invariants · pure module
// ═════════════════════════════════════════════════════════════════════

describe("candidate-validator source · pure module invariants", () => {
  const srcPath = path.join(__dirname, "candidate-validator.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import pg", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/require\(["']pg["']/);
  });

  test("CODE does NOT import pg-executor / pg-fingerprint / extract-candidates", () => {
    expect(code).not.toMatch(/from\s+["']\.\/pg-executor["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-fingerprint["']/);
    expect(code).not.toMatch(/from\s+["']\.\/extract-candidates["']/);
  });

  test("CODE does NOT import or invoke the resolver", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT read or write the filesystem", () => {
    expect(code).not.toMatch(/\bfs\.readFile/);
    expect(code).not.toMatch(/\bfs\.writeFile/);
    expect(code).not.toMatch(/\bfsp\./);
    expect(code).not.toMatch(/\bcreateWriteStream/);
  });

  test("CODE does NOT reference Supabase", () => {
    expect(code).not.toMatch(/@supabase/);
    expect(code).not.toMatch(/supabase/i);
  });

  test("CODE does NOT reference credentials / env scanning", () => {
    expect(code).not.toMatch(/\bdotenv\b/);
    expect(code).not.toMatch(/\.pgpass/);
    expect(code).not.toMatch(/process\.env/);
  });

  test("CODE's only local import is ./generate-candidates", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    for (const imp of localImports) {
      expect(imp).toBe("generate-candidates");
    }
  });
});
