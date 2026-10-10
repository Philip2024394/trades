#!/usr/bin/env node
// scripts/nex-canonical/_e2e-fixture-health-check.mjs
//
// NEX Emergency Help · Playwright fixture health check.
//
// Purpose · validate every prerequisite the hardening Playwright suite's
// provisionAccount() helper depends on, BEFORE running the suite. Prevents
// "H2-H5 skipped silently because fixture provisioning returned null" by
// turning each potential failure mode into an explicit, named check.
//
// Checks (each is independent, each prints PASS/FAIL + a fix hint):
//   1. .env.local present + readable
//   2. NEXT_PUBLIC_NEX_SUPABASE_URL (or NEX_SUPABASE_URL) set + looks like a URL
//   3. NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY set
//   4. NEX_SUPABASE_SERVICE_ROLE_KEY set
//   5. Supabase reachable at the URL (anon ping)
//   6. supabase.auth.admin.createUser works with service role (then delete)
//   7. nex_account insert accepts {supabase_user_id, display_name} (then delete)
//   8. signInWithPassword against anon client returns an access_token
//   9. Dev server reachable at NEX_E2E_BASE_URL (default http://localhost:3008)
//
// Exits 0 only when ALL checks pass. Exits 1 on first blocker, with a
// specific fix instruction. Safe to run in CI as a preflight gate.
//
// Usage · node scripts/nex-canonical/_e2e-fixture-health-check.mjs
//
// See docs/doctrine/nex-emergency-h2-h5-execution-evidence-2026-10-10.md.

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

// --- env loader (identical shape to the spec) --------------------------
(() => {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
})();

const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";
const SUPABASE_URL =
  process.env.NEX_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ??
  "";
const ANON = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";

let failed = false;

function pass(name, detail) {
  console.log(`PASS · ${name}${detail ? ` · ${detail}` : ""}`);
}

function fail(name, detail, fix) {
  failed = true;
  console.error(`FAIL · ${name}${detail ? ` · ${detail}` : ""}`);
  if (fix) console.error(`      FIX · ${fix}`);
}

async function main() {
  // 1. .env.local
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    fail(
      ".env.local present",
      `missing at ${envPath}`,
      "Create .env.local with NEXT_PUBLIC_NEX_SUPABASE_URL + NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY + NEX_SUPABASE_SERVICE_ROLE_KEY",
    );
  } else {
    pass(".env.local present", envPath);
  }

  // 2. Supabase URL
  if (!SUPABASE_URL || !/^https?:\/\/[a-z0-9-]+\.supabase\.co/i.test(SUPABASE_URL)) {
    fail(
      "Supabase URL set",
      SUPABASE_URL ? `looks malformed: ${SUPABASE_URL}` : "unset",
      "Set NEXT_PUBLIC_NEX_SUPABASE_URL=https://<project-ref>.supabase.co in .env.local",
    );
  } else {
    pass("Supabase URL set", SUPABASE_URL);
  }

  // 3. anon key
  if (!ANON || ANON.length < 40) {
    fail(
      "Supabase anon key set",
      ANON ? "value too short" : "unset",
      "Set NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY=<anon-key> in .env.local",
    );
  } else {
    pass("Supabase anon key set", `${ANON.slice(0, 12)}…`);
  }

  // 4. service role key
  if (!SERVICE_ROLE || SERVICE_ROLE.length < 40) {
    fail(
      "Supabase service role key set",
      SERVICE_ROLE ? "value too short" : "unset",
      "Set NEX_SUPABASE_SERVICE_ROLE_KEY=<service-role-key> in .env.local (NEVER commit)",
    );
  } else {
    pass("Supabase service role key set", `${SERVICE_ROLE.slice(0, 12)}…`);
  }

  // Early exit if the mandatory values are missing · everything downstream
  // depends on them.
  if (failed) {
    console.error("\nOne or more mandatory env vars are missing. Aborting further checks.");
    process.exit(1);
  }

  // 5. Supabase reachability
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: ANON },
    });
    if (res.status < 500) {
      pass("Supabase reachable", `/auth/v1/health → ${res.status}`);
    } else {
      fail(
        "Supabase reachable",
        `/auth/v1/health → ${res.status}`,
        "Confirm the project ref is correct and the Supabase project is not paused",
      );
    }
  } catch (err) {
    fail(
      "Supabase reachable",
      err && err.message ? err.message : String(err),
      "Confirm network access to Supabase. If offline, the Playwright fixture will skip.",
    );
  }

  // Build the admin + anon clients.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 6. admin.createUser (and cleanup)
  const probeEmail = `eh-health-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const probePassword = `EH!Pw${Date.now()}`;
  let probeAuthId = null;
  try {
    const c = await admin.auth.admin.createUser({
      email: probeEmail,
      password: probePassword,
      email_confirm: true,
    });
    if (c.error || !c.data?.user) {
      fail(
        "supabase.auth.admin.createUser",
        c.error ? c.error.message : "no user returned",
        "Verify NEX_SUPABASE_SERVICE_ROLE_KEY is the service-role key (not anon). Check auth settings.",
      );
    } else {
      probeAuthId = c.data.user.id;
      pass("supabase.auth.admin.createUser", `authId=${probeAuthId.slice(0, 8)}…`);
    }
  } catch (err) {
    fail(
      "supabase.auth.admin.createUser",
      err && err.message ? err.message : String(err),
      "Service role key may be invalid or project auth is misconfigured.",
    );
  }

  // 7. nex_account insert + delete
  let probeAccountId = null;
  if (probeAuthId) {
    try {
      const acc = await admin
        .from("nex_account")
        .insert({ supabase_user_id: probeAuthId, display_name: "EH Health Probe" })
        .select("id")
        .single();
      if (acc.error || !acc.data) {
        fail(
          "nex_account insert",
          acc.error ? acc.error.message : "no row returned",
          "Verify nex_account schema accepts (supabase_user_id, display_name). Check migrations.",
        );
      } else {
        probeAccountId = acc.data.id;
        pass("nex_account insert", `accountId=${probeAccountId.slice(0, 8)}…`);
      }
    } catch (err) {
      fail(
        "nex_account insert",
        err && err.message ? err.message : String(err),
        "DB may not accept the fixture's insert shape.",
      );
    }
  }

  // 8. signInWithPassword returns a session
  if (probeAuthId) {
    try {
      const signIn = await anon.auth.signInWithPassword({
        email: probeEmail,
        password: probePassword,
      });
      if (signIn.error || !signIn.data?.session?.access_token) {
        fail(
          "signInWithPassword",
          signIn.error ? signIn.error.message : "no session returned",
          "Verify anon key is correct and email confirmation is not required for new users.",
        );
      } else {
        pass(
          "signInWithPassword",
          `jwt len=${signIn.data.session.access_token.length}`,
        );
      }
    } catch (err) {
      fail(
        "signInWithPassword",
        err && err.message ? err.message : String(err),
        "Check anon-key and that newly-created users can sign in immediately.",
      );
    }
  }

  // Cleanup probe rows.
  if (probeAccountId) {
    try {
      await admin.from("nex_account").delete().eq("id", probeAccountId);
    } catch {
      /* non-fatal · leftover row has no PII */
    }
  }
  if (probeAuthId) {
    try {
      await admin.auth.admin.deleteUser(probeAuthId);
    } catch {
      /* non-fatal */
    }
  }

  // 9. Dev server reachable
  try {
    const res = await fetch(BASE_URL, { method: "GET" });
    if (res.status < 500) {
      pass("Dev server reachable", `${BASE_URL} → ${res.status}`);
    } else {
      fail(
        "Dev server reachable",
        `${BASE_URL} → ${res.status}`,
        "Start dev server with `npm run dev` or set NEX_E2E_BASE_URL to the right origin.",
      );
    }
  } catch (err) {
    fail(
      "Dev server reachable",
      err && err.message ? err.message : String(err),
      `Start dev server at ${BASE_URL}, or set NEX_E2E_BASE_URL to a reachable origin.`,
    );
  }

  if (failed) {
    console.error("\nFixture is NOT ready. Fix the FAIL lines above before running Playwright.");
    process.exit(1);
  }
  console.log("\nAll checks passed. Playwright fixture is ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error("UNEXPECTED FAILURE ·", err && err.stack ? err.stack : err);
  process.exit(1);
});
