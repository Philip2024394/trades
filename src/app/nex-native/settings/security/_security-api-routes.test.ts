// src/app/nex-native/settings/security/_security-api-routes.test.ts
//
// NEX Phase 1.0 Security · POST API-route shape parity.
// Sealed 2026-10-06.
//
// Source-grep assertions only · the routes themselves depend on the
// session resolver + the service-role Supabase client which are not
// available in the vitest harness. These tests confirm that each route
// mounts the expected machinery (session resolution + owner-scoped
// side-effect + typed error paths).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");

const ROUTES: readonly { key: string; file: string }[] = [
  {
    key: "sessions/revoke",
    file: "src/app/api/nex-native/security/sessions/revoke/route.ts",
  },
  {
    key: "sessions/revoke-all",
    file: "src/app/api/nex-native/security/sessions/revoke-all/route.ts",
  },
  {
    key: "sessions/trust",
    file: "src/app/api/nex-native/security/sessions/trust/route.ts",
  },
  {
    key: "credentials/revoke",
    file: "src/app/api/nex-native/security/credentials/revoke/route.ts",
  },
  {
    key: "credentials/rename",
    file: "src/app/api/nex-native/security/credentials/rename/route.ts",
  },
  {
    key: "password/change",
    file: "src/app/api/nex-native/security/password/change/route.ts",
  },
] as const;

function readRoute(file: string): string {
  const abs = path.join(REPO_ROOT, file);
  return fs.readFileSync(abs, "utf8");
}

// ─── A · every route file exists ─────────────────────────────────────

describe("A · every security route file exists on disk", () => {
  for (const route of ROUTES) {
    test(`"${route.key}" exists on disk`, () => {
      const abs = path.join(REPO_ROOT, route.file);
      const stat = fs.statSync(abs);
      expect(stat.isFile()).toBe(true);
    });
  }
});

// ─── B · every route exports `export async function POST(` ──────────

describe("B · every route exports an async POST handler", () => {
  for (const route of ROUTES) {
    test(`"${route.key}" exports export async function POST(`, () => {
      const src = readRoute(route.file);
      expect(src).toContain("export async function POST(");
    });
  }
});

// ─── C · every route resolves the session ────────────────────────────

describe("C · every route resolves the NEX app session", () => {
  for (const route of ROUTES) {
    test(`"${route.key}" calls resolveNexAppSessionFromContext`, () => {
      const src = readRoute(route.file);
      expect(src).toContain("resolveNexAppSessionFromContext");
    });
  }
});

// ─── D · every route handles the not_signed_in case ──────────────────

describe("D · every route handles the not_signed_in case", () => {
  for (const route of ROUTES) {
    test(`"${route.key}" references the "not_signed_in" error`, () => {
      const src = readRoute(route.file);
      expect(src).toContain("not_signed_in");
    });
  }
});

// ─── E · revoke-all passes keepSessionKey ────────────────────────────

describe("E · revoke-all preserves the current session", () => {
  test("passes keepSessionKey into revokeAllOtherSessionsForOwner", () => {
    const src = readRoute(
      "src/app/api/nex-native/security/sessions/revoke-all/route.ts",
    );
    expect(src).toContain("revokeAllOtherSessionsForOwner");
    expect(src).toContain("keepSessionKey");
  });
});

// ─── F · password/change calls the Supabase admin updateUserById ────

describe("F · password/change updates the Supabase auth password", () => {
  test("calls nexSupabaseAdmin.auth.admin.updateUserById", () => {
    const src = readRoute(
      "src/app/api/nex-native/security/password/change/route.ts",
    );
    expect(src).toContain("nexSupabaseAdmin.auth.admin.updateUserById");
  });
});
