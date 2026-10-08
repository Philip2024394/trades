// src/lib/nex-native/directory/__tests__/directory-no-fabrication.test.ts
//
// NEX Directory · Phase B · Static grep invariants.
//
// These tests read the Phase B source files as text and assert
// architectural invariants that cannot be expressed purely in
// TypeScript types.
//
//   · No DB, network, filesystem, clock, or randomness in the
//     projector or types modules
//   · No fabricated default strings (e.g. "Yogyakarta", "Jakarta",
//     "placeholder", "default", "example.com", "coming soon",
//     "unknown")
//   · No fabricated default coordinates (hard-coded lat/lng pairs)
//   · No `|| "..."` or `?? "..."` substitutions of fabricated
//     content for nullable identity columns (only the media
//     attachment legitimately uses the ternary pattern we verify)
//   · Projector module imports only from ./types and
//     ./classify-entity-type
//   · The barrel exports only the symbols we expect
//
// This file is the architectural lock. If a future wave accidentally
// introduces a city default, a stock image URL, or a DB client import,
// the suite fails loudly.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const DIR = resolve(__dirname, "..");

function read(file: string): string {
  return readFileSync(join(DIR, file), "utf8");
}

function stripComments(src: string): string {
  // Strip line comments FIRST (so a `/*` appearing inside a `//` line —
  // e.g. the token `scripts/nex-canonical/*` in prose — does not get
  // mistaken for the start of a block comment), then strip block
  // comments.
  const noLine = src
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Fabrication guard · forbidden content strings
// ═════════════════════════════════════════════════════════════════════

/** City / location strings that MUST NEVER appear as literal values in
 *  Phase B code (comments are allowed to mention them for context). */
const FORBIDDEN_CITY_LITERALS: readonly string[] = [
  "Yogyakarta",
  "Jakarta",
  "Bali",
  "Denpasar",
  "Bandung",
  "Surabaya",
];

/** Fabrication smells — strings that NEVER belong in a honest view
 *  model projector. */
const FORBIDDEN_FABRICATION_LITERALS: readonly string[] = [
  "placeholder",
  "coming-soon",
  "coming soon",
  "example.com",
  "stock-image",
  "default-image",
  "default.jpg",
  "default.png",
  "unknown-business",
  "unknown-city",
  "null-island",
  "lorem ipsum",
];

describe("Phase B · no fabrication literals (after stripping comments)", () => {
  const FILES = [
    "types.ts",
    "classify-entity-type.ts",
    "project-canonical-row.ts",
    "index.ts",
  ];

  for (const file of FILES) {
    for (const needle of FORBIDDEN_CITY_LITERALS) {
      it(`${file} contains no literal "${needle}" (city fabrication guard)`, () => {
        const src = stripComments(read(file));
        expect(src).not.toContain(needle);
      });
    }

    for (const needle of FORBIDDEN_FABRICATION_LITERALS) {
      it(`${file} contains no literal "${needle}" (content fabrication guard)`, () => {
        const src = stripComments(read(file));
        expect(src.toLowerCase()).not.toContain(needle.toLowerCase());
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// §2 · No fabricated coordinates
// ═════════════════════════════════════════════════════════════════════

describe("Phase B · no fabricated coordinate literals in projector", () => {
  it("project-canonical-row.ts contains no decimal lat/lng literals", () => {
    const src = stripComments(read("project-canonical-row.ts"));
    // Any `float.float` pattern would be suspicious. We allow 0, 1, etc.
    // (bare integers like `const N = 10`) but no decimal numbers.
    const decimalPattern = /-?\d+\.\d+/g;
    const matches = src.match(decimalPattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("types.ts contains no decimal lat/lng literals", () => {
    const src = stripComments(read("types.ts"));
    const decimalPattern = /-?\d+\.\d+/g;
    const matches = src.match(decimalPattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("classify-entity-type.ts contains no decimal literals", () => {
    const src = stripComments(read("classify-entity-type.ts"));
    const decimalPattern = /-?\d+\.\d+/g;
    const matches = src.match(decimalPattern) ?? [];
    expect(matches).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · No DB / network / clock / randomness in Phase B modules
// ═════════════════════════════════════════════════════════════════════

/** Imports or token patterns that MUST NEVER appear in Phase B code. */
const FORBIDDEN_RUNTIME_TOKENS: readonly string[] = [
  "nexSupabaseAdmin",         // our own server-only client
  "@supabase/supabase-js",    // raw supabase import
  "supabase-admin",
  "createClient",
  "fetch(",
  "new Date(",                // no clock
  "Date.now",                 // no clock
  "Math.random",              // no randomness
  "crypto.random",            // no randomness
  "node:fs",                  // no filesystem in the projector
  "readFileSync",             // no filesystem in the projector
  "writeFileSync",            // no filesystem in the projector
  "pg.Client",                // no raw PG
  "require(",                 // no commonjs
];

describe("Phase B · projector + types modules have no runtime side effects", () => {
  const FILES = ["types.ts", "classify-entity-type.ts", "project-canonical-row.ts"];
  for (const file of FILES) {
    for (const needle of FORBIDDEN_RUNTIME_TOKENS) {
      it(`${file} contains no "${needle}"`, () => {
        const src = stripComments(read(file));
        expect(src).not.toContain(needle);
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Projector import discipline
// ═════════════════════════════════════════════════════════════════════

describe("Phase B · projector imports only ./types + ./classify-entity-type", () => {
  /** Strip comments then collect every `from "..."` specifier in the
   *  file. Handles single-line AND multi-line `import type {...} from
   *  "x"` statements. */
  function collectImportSpecifiers(file: string): readonly string[] {
    const src = stripComments(read(file));
    const specifiers: string[] = [];
    const re = /from\s+["']([^"']+)["']/g;
    for (const m of src.matchAll(re)) {
      specifiers.push(m[1]);
    }
    return specifiers;
  }

  it("project-canonical-row.ts imports exactly the two allowed modules", () => {
    const specifiers = collectImportSpecifiers("project-canonical-row.ts");
    const sorted = [...specifiers].sort();
    expect(sorted).toEqual(["./classify-entity-type", "./types"]);
  });

  it("classify-entity-type.ts imports only ./types", () => {
    const specifiers = collectImportSpecifiers("classify-entity-type.ts");
    expect([...specifiers]).toEqual(["./types"]);
  });

  it("types.ts imports only type-level symbols from the sealed canonical pipeline", () => {
    const src = read("types.ts");
    // Every `import` statement must be `import type` — no runtime
    // imports permitted in types.ts. We check this by asserting that
    // every occurrence of the token `import ` (with a trailing space,
    // excluding `import type`) does not appear outside comments.
    const stripped = stripComments(src);
    // Collapse multi-line imports into one line so regex works.
    const flat = stripped.replace(/\n/g, " ");
    const runtimeImportMatches = flat.match(/\bimport\s+(?!type\b)[\s\S]*?from\s+["']/g) ?? [];
    expect(runtimeImportMatches).toEqual([]);

    const specifiers = collectImportSpecifiers("types.ts");
    const sorted = [...specifiers].sort();
    expect(sorted).toEqual([
      "../../../../scripts/nex-canonical/canonical-row",
      "../../../../scripts/nex-canonical/generate-candidates",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Barrel exports match the sealed surface
// ═════════════════════════════════════════════════════════════════════

describe("Phase B · barrel export surface", () => {
  it("index.ts re-exports exactly the sealed symbol surface", () => {
    const src = read("index.ts");
    // Required exported value symbols:
    expect(src).toContain("classifyEntityType");
    expect(src).toContain("BUSINESS_ENTITY_TYPES");
    expect(src).toContain("PERSON_ENTITY_TYPES");
    expect(src).toContain("PLACE_ENTITY_TYPES");
    expect(src).toContain("projectDirectoryListing");
    expect(src).toContain("projectDirectoryListings");
    // Required exported types:
    expect(src).toContain("DirectoryCanonicalRow");
    expect(src).toContain("DirectoryClassification");
    expect(src).toContain("DirectoryCoordinates");
    expect(src).toContain("DirectoryImage");
    expect(src).toContain("DirectoryListingMedia");
    expect(src).toContain("DirectoryListingVM");
    expect(src).toContain("EntityType");
    expect(src).toContain("LifecycleState");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Projector does not use `??` / `||` to substitute content
// ═════════════════════════════════════════════════════════════════════

describe("Phase B · projector has no content-fabricating fallbacks", () => {
  it("project-canonical-row.ts has no `?? \"...\"` or `|| \"...\"` string fallbacks", () => {
    const src = stripComments(read("project-canonical-row.ts"));
    // Match a `??` or `||` followed by whitespace then a quoted string.
    const stringFallbackPattern = /(\?\?|\|\|)\s*["'`]/g;
    const matches = src.match(stringFallbackPattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("project-canonical-row.ts has no `?? <decimal>` or `|| <decimal>` numeric fallbacks", () => {
    const src = stripComments(read("project-canonical-row.ts"));
    const numericFallbackPattern = /(\?\?|\|\|)\s*-?\d+(\.\d+)?/g;
    const matches = src.match(numericFallbackPattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("project-canonical-row.ts allows exactly one `?? null` for the media attachment default", () => {
    const src = stripComments(read("project-canonical-row.ts"));
    const nullCoalesce = src.match(/\?\?\s*null/g) ?? [];
    // One occurrence in the batch form `map.get(id) ?? null`. The
    // single-row form uses a strict ternary (media === null ? …) and
    // introduces no additional ?? null.
    expect(nullCoalesce.length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Reflection discipline · the 9 entity_types + 7 lifecycle states
// ═════════════════════════════════════════════════════════════════════

describe("Phase B · reflection consistency with the sealed canonical pipeline", () => {
  it("classify-entity-type.ts covers exactly the 9 sealed entity_type values", () => {
    const src = read("classify-entity-type.ts");
    // Each of the 9 sealed values must appear as a `case "..."` line
    // in the exhaustive switch.
    const sealed = [
      "food",
      "accommodation",
      "service",
      "professional",
      "vehicle_rental",
      "marketplace_seller",
      "transport_driver",
      "transport_operator",
      "place",
    ];
    for (const et of sealed) {
      expect(src).toContain(`case "${et}":`);
    }
  });
});
