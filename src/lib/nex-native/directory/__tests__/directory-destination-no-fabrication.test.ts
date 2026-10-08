// src/lib/nex-native/directory/__tests__/directory-destination-no-fabrication.test.ts
//
// NEX Directory · Phase C · Static grep invariants for destination
// resolution.
//
// These tests read the Phase C source files as text and assert the
// same architectural locks Phase B carries, scoped to Phase C:
//
//   · No DB / network / filesystem / clock / randomness in the
//     resolver or destination-types modules
//   · No fabricated URL literals — the slug + handle come from
//     OwnerClaim only, never from the resolver's own strings
//   · No fabricated city / coordinate / content strings
//   · Resolver imports only ./destination-types + ./types
//   · destination-types imports only ./types (type-level)
//   · The two route pattern constants are the only `/nex-native/` URL
//     strings in the resolver source
//
// If a future wave introduces a hard-coded URL ("/nex-native/claim"),
// a Supabase import, or any clock/randomness, the suite fails loudly.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const DIR = resolve(__dirname, "..");

function read(file: string): string {
  return readFileSync(join(DIR, file), "utf8");
}

function stripComments(src: string): string {
  // Phase B lesson: strip line comments FIRST so `/*` tokens inside
  // `//` prose do not get mistaken for block comment starters.
  const noLine = src
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · No DB / network / clock / randomness
// ═════════════════════════════════════════════════════════════════════

const FORBIDDEN_RUNTIME_TOKENS: readonly string[] = [
  "nexSupabaseAdmin",
  "@supabase/supabase-js",
  "supabase-admin",
  "createClient",
  "fetch(",
  "new Date(",
  "Date.now",
  "Math.random",
  "crypto.random",
  "node:fs",
  "readFileSync",
  "writeFileSync",
  "pg.Client",
  "require(",
];

describe("Phase C · resolver + destination-types have no runtime side effects", () => {
  const FILES = ["destination-types.ts", "resolve-destination.ts"];
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
// §2 · No fabricated content strings
// ═════════════════════════════════════════════════════════════════════

const FORBIDDEN_CITY_LITERALS: readonly string[] = [
  "Yogyakarta",
  "Jakarta",
  "Bali",
  "Denpasar",
  "Bandung",
  "Surabaya",
];

const FORBIDDEN_FABRICATION_LITERALS: readonly string[] = [
  "placeholder",
  "coming-soon",
  "coming soon",
  "example.com",
  "stock-image",
  "default-image",
  "unknown-business",
  "unknown-city",
  "null-island",
  "lorem ipsum",
];

describe("Phase C · no fabrication literals (after stripping comments)", () => {
  const FILES = ["destination-types.ts", "resolve-destination.ts"];

  for (const file of FILES) {
    for (const needle of FORBIDDEN_CITY_LITERALS) {
      it(`${file} contains no literal "${needle}"`, () => {
        const src = stripComments(read(file));
        expect(src).not.toContain(needle);
      });
    }

    for (const needle of FORBIDDEN_FABRICATION_LITERALS) {
      it(`${file} contains no literal "${needle}"`, () => {
        const src = stripComments(read(file));
        expect(src.toLowerCase()).not.toContain(needle.toLowerCase());
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// §3 · No fabricated URL literals in the resolver
// ═════════════════════════════════════════════════════════════════════

describe("Phase C · resolver URL discipline", () => {
  it("resolve-destination.ts imports the two sealed route patterns · does not inline URL strings", () => {
    const src = stripComments(read("resolve-destination.ts"));
    // Count every `/nex-native/` occurrence. Legitimate uses:
    //   · NONE in resolve-destination.ts source — patterns are consumed
    //     by name (NEX_BUSINESS_ROUTE_PATTERN / NEX_USER_PROFILE_ROUTE_PATTERN)
    //     from destination-types.ts via import, never re-typed here.
    // Any match is a fabrication smell.
    const urlPattern = /\/nex-native\//g;
    const matches = src.match(urlPattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("destination-types.ts carries exactly the two sealed route patterns", () => {
    const src = stripComments(read("destination-types.ts"));
    const urlPattern = /\/nex-native\//g;
    const matches = src.match(urlPattern) ?? [];
    // Exactly two matches: the two patterns in §1.
    expect(matches.length).toBe(2);
  });

  it("destination-types.ts' two patterns are byte-stable", () => {
    // Importing them at the top of this file would be cleaner, but the
    // test suite is static-text-oriented. We re-verify the known
    // byte-stable sealed literals here as a locked contract.
    const src = read("destination-types.ts");
    expect(src).toContain('"/nex-native/{slug}"');
    expect(src).toContain('"/nex-native/u/{handle}"');
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Import discipline
// ═════════════════════════════════════════════════════════════════════

describe("Phase C · import discipline", () => {
  function collectImportSpecifiers(file: string): readonly string[] {
    const src = stripComments(read(file));
    const specifiers: string[] = [];
    const re = /from\s+["']([^"']+)["']/g;
    for (const m of src.matchAll(re)) {
      specifiers.push(m[1]);
    }
    return specifiers;
  }

  it("resolve-destination.ts imports only ./destination-types + ./types", () => {
    const specifiers = collectImportSpecifiers("resolve-destination.ts");
    const sorted = [...specifiers].sort();
    expect(sorted).toEqual(["./destination-types", "./types"]);
  });

  it("destination-types.ts imports only ./types (type-only)", () => {
    const specifiers = collectImportSpecifiers("destination-types.ts");
    expect([...specifiers]).toEqual(["./types"]);
    // And the single import statement must be `import type`.
    const src = read("destination-types.ts");
    const flat = stripComments(src).replace(/\n/g, " ");
    const runtimeImportMatches = flat.match(/\bimport\s+(?!type\b)[\s\S]*?from\s+["']/g) ?? [];
    expect(runtimeImportMatches).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Barrel re-exports the Phase C surface
// ═════════════════════════════════════════════════════════════════════

describe("Phase C · barrel export surface", () => {
  it("index.ts re-exports the Phase C value symbols", () => {
    const src = read("index.ts");
    expect(src).toContain("resolveDirectoryDestination");
    expect(src).toContain("resolveDirectoryDestinations");
    expect(src).toContain("buildNexBusinessPath");
    expect(src).toContain("buildNexUserProfilePath");
    expect(src).toContain("NEX_BUSINESS_ROUTE_PATTERN");
    expect(src).toContain("NEX_USER_PROFILE_ROUTE_PATTERN");
    expect(src).toContain("SEALED_DESTINATION_KINDS");
    expect(src).toContain("SEALED_UNRESOLVED_REASONS");
  });

  it("index.ts re-exports the Phase C type symbols", () => {
    const src = read("index.ts");
    expect(src).toContain("DirectoryDestination");
    expect(src).toContain("OwnerClaim");
    expect(src).toContain("UnresolvedReason");
    expect(src).toContain("ResolveDirectoryDestinationArgs");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Resolver content-fabrication guards
// ═════════════════════════════════════════════════════════════════════

describe("Phase C · resolver has no content-fabricating fallbacks", () => {
  it("resolve-destination.ts has no `?? \"...\"` string fallbacks", () => {
    const src = stripComments(read("resolve-destination.ts"));
    const pattern = /\?\?\s*["'`]/g;
    const matches = src.match(pattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("resolve-destination.ts has no `|| \"...\"` string fallbacks", () => {
    const src = stripComments(read("resolve-destination.ts"));
    const pattern = /\|\|\s*["'`]/g;
    const matches = src.match(pattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("resolve-destination.ts contains no decimal numeric literals", () => {
    const src = stripComments(read("resolve-destination.ts"));
    const pattern = /-?\d+\.\d+/g;
    const matches = src.match(pattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("resolve-destination.ts allows exactly one `?? null` for the batch claim-map lookup", () => {
    const src = stripComments(read("resolve-destination.ts"));
    const matches = src.match(/\?\?\s*null/g) ?? [];
    // One occurrence in `map.get(id) ?? null` in the batch form. The
    // single-row form uses a strict `claim === null` check.
    expect(matches.length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Sealed-set consistency
// ═════════════════════════════════════════════════════════════════════

describe("Phase C · sealed sets stay in lock-step with the discriminated unions", () => {
  it("destination-types.ts declares exactly the 6 sealed destination kinds in SEALED_DESTINATION_KINDS", () => {
    const src = read("destination-types.ts");
    const kinds = [
      "nex_business",
      "nex_user_profile",
      "claim_available",
      "redirect_to_canonical",
      "place_detail",
      "unresolved",
    ];
    for (const k of kinds) {
      expect(src).toContain(`"${k}"`);
    }
  });

  it("destination-types.ts declares exactly the 3 sealed unresolved reasons", () => {
    const src = read("destination-types.ts");
    const reasons = [
      "superseded_without_target",
      "claimed_without_link",
      "claim_classification_mismatch",
    ];
    for (const r of reasons) {
      expect(src).toContain(`"${r}"`);
    }
  });
});
