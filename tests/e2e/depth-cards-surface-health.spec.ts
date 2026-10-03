// tests/e2e/depth-cards-surface-health.spec.ts
//
// §12 Item 2 · Browser Evidence Extension.
// Drives the already-authorised __faultInject paths through the
// development-only test bridge (?__inject=theme|smoke|core, gated
// by NEX_SURFACE_HEALTH_TEST_BRIDGE=1) and asserts the actual
// integrated boundary behaviour from a real browser.
//
// Requires:
//   · Supabase service-role env configured (NEX_SUPABASE_SERVICE_ROLE_KEY)
//   · Dev server running with NEX_SURFACE_HEALTH_TEST_BRIDGE=1
//   · NEX_E2E_SKIP_WEBSERVER=1 if the dev server is externally managed
//
// Scope: evidence-only · no production feature introduced.

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnv(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const SUPABASE_URL =
  process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY =
  process.env.NEX_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error("depth-cards-surface-health: Supabase env not configured");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MARIA_ID = "d3e7f000-0001-4a00-b000-000000000001";
const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";

interface SignedInUser {
  email: string;
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
}

async function provisionSignedInUser(suffix: string): Promise<SignedInUser> {
  const email = `nex-shu-${suffix}@nex-native.local`;
  const password = "SurfaceHealth!2026";
  const cu = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Surface-Health Pilot ${suffix}` },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  const authId = cu.data.user.id;

  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `SHU ${suffix}` })
    .select("id")
    .single();
  if (acc.error || !acc.data) throw new Error(`account insert: ${acc.error?.message}`);
  const accountId = (acc.data as { id: string }).id;

  // Ensure the Maria peer exists · otherwise MissingPeerFallback renders
  // instead of the boundary tree.
  const maria = await admin
    .from("nex_account")
    .select("id")
    .eq("id", MARIA_ID)
    .maybeSingle();
  if (!maria.data) {
    await admin.from("nex_account").insert({
      id: MARIA_ID,
      display_name: "Maria Santos",
      nex_handle: "nex-27418",
      chat_theme: "pink",
    });
  }

  // Seed one message FROM Maria so the fallback has something to render.
  const [a, b] =
    accountId < MARIA_ID ? [accountId, MARIA_ID] : [MARIA_ID, accountId];
  const conv = await admin
    .from("nex_peer_conversation")
    .insert({ participant_a_id: a, participant_b_id: b })
    .select("id")
    .single();
  const convId = (conv.data as { id: string } | null)?.id;
  if (convId) {
    await admin.from("nex_peer_message").insert({
      conversation_id: convId,
      sender_account_id: MARIA_ID,
      body: "SHU-GOLDEN-MESSAGE pilot evidence",
    });
  }

  const si = await anon.auth.signInWithPassword({ email, password });
  if (si.error || !si.data.session) throw new Error(`signIn: ${si.error?.message}`);

  return {
    email,
    authId,
    accountId,
    jwt: si.data.session.access_token,
    refresh: si.data.session.refresh_token,
  };
}

async function cleanupUser(u: SignedInUser): Promise<void> {
  await admin.from("nex_account").delete().eq("id", u.accountId);
  await admin.auth.admin.deleteUser(u.authId);
}

async function cleanupSyntheticSurfaceHealth(signatures: Set<string>): Promise<void> {
  if (signatures.size === 0) return;
  // Walk any non-terminal rows for these signatures through the sealed
  // lifecycle: → investigating → fixed → verified. State_history is
  // maintained explicitly. All transitions are enforced by the
  // migration 127 trigger.
  for (const sig of signatures) {
    const rows = await admin
      .from("nex_surface_health_event")
      .select("id, lifecycle_state, state_history")
      .eq("failure_signature", sig)
      .in("lifecycle_state", [
        "detected",
        "fallback-active",
        "ongoing",
        "investigating",
        "fixed",
      ]);
    if (rows.error || !rows.data) continue;
    for (const raw of rows.data) {
      const row = raw as {
        id: string;
        lifecycle_state: string;
        state_history: unknown[] | null;
      };
      let state = row.lifecycle_state;
      let history = Array.isArray(row.state_history) ? [...row.state_history] : [];
      const walk: string[] = [];
      if (state === "fallback-active") walk.push("investigating");
      if (state === "ongoing") walk.push("investigating");
      if (state === "investigating" || walk.length) walk.push("fixed", "verified");
      else if (state === "fixed") walk.push("verified");
      else if (state === "detected") walk.push("fallback-active", "investigating", "fixed", "verified");
      for (const next of walk) {
        history.push({
          from: state,
          to: next,
          at: new Date().toISOString(),
          reason: "evidence audit · synthetic probe",
        });
        await admin
          .from("nex_surface_health_event")
          .update({ lifecycle_state: next, state_history: history })
          .eq("id", row.id);
        state = next;
      }
    }
  }
}

async function plantAuthCookies(
  ctx: BrowserContext,
  jwt: string,
  refresh: string,
): Promise<void> {
  const projectRef = SUPABASE_URL!.match(/https?:\/\/([^.]+)/)?.[1] ?? "unknown";
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = {
    access_token: jwt,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: null,
  };
  const base = new URL(BASE_URL);
  await ctx.addCookies([
    {
      name: cookieName,
      value: `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`,
      domain: base.hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "xrated_cookie_consent",
      value: "all",
      domain: base.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

interface CapturedEmission {
  status: number;
  body: Record<string, unknown>;
}

async function captureSurfaceHealthEmissions(page: Page): Promise<CapturedEmission[]> {
  const captured: CapturedEmission[] = [];
  page.on("request", async (req) => {
    if (
      req.method() === "POST" &&
      req.url().endsWith("/api/nex-native/surface-health")
    ) {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
      } catch {
        /* noop */
      }
      const resp = await req.response();
      captured.push({ status: resp?.status() ?? 0, body });
    }
  });
  return captured;
}

// ────────────────────────────────────────────────────────────────────
// Test suite · depth-cards boundary catch paths
// ────────────────────────────────────────────────────────────────────

test.describe("§12 Item 2 · depth-cards boundary browser evidence", () => {
  const createdSignatures = new Set<string>();
  let user: SignedInUser;

  test.beforeAll(async () => {
    const suffix = "e" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
    user = await provisionSignedInUser(suffix);
  });

  test.afterAll(async () => {
    try {
      await cleanupSyntheticSurfaceHealth(createdSignatures);
    } finally {
      await cleanupUser(user);
    }
  });

  // ── TEST A · Tier 2 theme crash ───────────────────────────────────

  test("A · Tier 2 theme fault · fallback renders · messages survive · composer available", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    await plantAuthCookies(ctx, user.jwt, user.refresh);
    const page = await ctx.newPage();
    const captured = await captureSurfaceHealthEmissions(page);

    await page.goto("/nex-native/chat/prototypes/depth-cards?__inject=theme", {
      waitUntil: "networkidle",
    });

    // SafeFallbackRenderer is identified by role=log + "Chat continues · reduced" label.
    const fallback = page.locator('[role="log"]').first();
    await expect(fallback).toBeVisible({ timeout: 10_000 });
    await expect(fallback).toContainText(/Chat continues · reduced/);

    // Existing message content survives (seeded "SHU-GOLDEN-MESSAGE" is from Maria).
    await expect(fallback).toContainText("SHU-GOLDEN-MESSAGE pilot evidence");

    // The composer is a form with a text input · it must still be reachable.
    const composer = page.locator("form textarea, form input[type=text]").first();
    await expect(composer).toBeVisible();

    // User must not see any raw technical error strings.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("fault-injection: depth-deck theme");
    expect(bodyText).not.toMatch(/Error:/);
    expect(bodyText).not.toMatch(/at DepthDeck/);
    expect(bodyText).not.toMatch(/componentStack/);
    expect(bodyText).not.toContain("stack trace");

    // Give the fire-and-forget telemetry a moment to settle.
    await page.waitForTimeout(500);
    const themeEmissions = captured.filter(
      (c) =>
        c.body?.tier === "visual-theme" &&
        c.body?.component_module === "theme-root",
    );
    expect(themeEmissions.length).toBeGreaterThanOrEqual(1);
    const em = themeEmissions[0]!.body;
    expect(em.error_classification).toBe("theme_bundle_load_failure");
    expect(em.recovery_action).toBe("fallback");

    // Content safety · no raw error fields present in the emission.
    const serialised = JSON.stringify(em);
    expect(serialised).not.toContain("fault-injection: depth-deck theme");
    expect(em).not.toHaveProperty("message");
    expect(em).not.toHaveProperty("stack");
    expect(em).not.toHaveProperty("componentStack");

    const sig = (themeEmissions[0]!.body as { failure_signature?: unknown }).failure_signature;
    // The emission from client → server · the server response carries
    // the derived signature. The captured response was 202 with the
    // signature in the response, but body here is the REQUEST body
    // (no signature yet). Pull signature from the DB via admin for
    // cleanup bookkeeping.
    void sig;
    const row = await admin
      .from("nex_surface_health_event")
      .select("failure_signature")
      .eq("surface", "depth-cards")
      .eq("component_module", "theme-root")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row.data) {
      createdSignatures.add(
        (row.data as { failure_signature: string }).failure_signature,
      );
    }

    await ctx.close();
  });

  // ── TEST B · Tier 3 module crash ──────────────────────────────────

  test("B · Tier 3 smoke fault · only smoke degrades · deck + composer continue", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    await plantAuthCookies(ctx, user.jwt, user.refresh);
    const page = await ctx.newPage();
    const captured = await captureSurfaceHealthEmissions(page);

    await page.goto("/nex-native/chat/prototypes/depth-cards?__inject=smoke", {
      waitUntil: "networkidle",
    });

    // The deck must still render (not the fallback). The deck section
    // has data-nex-deck attribute.
    const deck = page.locator("[data-nex-deck]").first();
    await expect(deck).toBeVisible({ timeout: 10_000 });

    // Fallback must NOT be visible.
    const fallback = page.locator('[role="log"]').first();
    await expect(fallback).toHaveCount(0);

    // Composer available.
    const composer = page.locator("form textarea, form input[type=text]").first();
    await expect(composer).toBeVisible();

    // No raw error reaches the UI.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("fault-injection: haunted-smoke");

    await page.waitForTimeout(500);
    const smokeEmissions = captured.filter(
      (c) =>
        c.body?.tier === "optional-visual-module" &&
        c.body?.component_module === "haunted-smoke",
    );
    expect(smokeEmissions.length).toBeGreaterThanOrEqual(1);
    expect(smokeEmissions[0]!.body.error_classification).toBe(
      "animation_runtime_error",
    );
    expect(smokeEmissions[0]!.body.recovery_action).toBe("degrade");

    const row = await admin
      .from("nex_surface_health_event")
      .select("failure_signature")
      .eq("surface", "depth-cards")
      .eq("component_module", "haunted-smoke")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row.data) {
      createdSignatures.add(
        (row.data as { failure_signature: string }).failure_signature,
      );
    }

    await ctx.close();
  });

  // ── TEST C · Tier 1 crash ─────────────────────────────────────────

  test("C · Tier 1 canary fault · minimal shell renders · no technical detail", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    await plantAuthCookies(ctx, user.jwt, user.refresh);
    const page = await ctx.newPage();
    const captured = await captureSurfaceHealthEmissions(page);

    await page.goto("/nex-native/chat/prototypes/depth-cards?__inject=core", {
      waitUntil: "networkidle",
    });

    // Minimal shell is identified by role=status + "Chat temporarily reduced".
    const shell = page.locator('[role="status"]').first();
    await expect(shell).toBeVisible({ timeout: 10_000 });
    await expect(shell).toContainText(/Chat temporarily reduced/);

    // The page must still be the NEX surface · not a generic Next.js error page.
    expect(page.url()).toContain("/nex-native/chat/prototypes/depth-cards");

    // No raw error anywhere in the DOM.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("fault-injection: tier-one canary");
    expect(bodyText).not.toMatch(/componentStack/);
    expect(bodyText).not.toContain("Application error");

    await page.waitForTimeout(500);
    const coreEmissions = captured.filter(
      (c) => c.body?.tier === "chat-core",
    );
    expect(coreEmissions.length).toBeGreaterThanOrEqual(1);
    expect(coreEmissions[0]!.body.error_classification).toBe(
      "render_runtime_error",
    );

    const row = await admin
      .from("nex_surface_health_event")
      .select("failure_signature")
      .eq("surface", "depth-cards")
      .eq("component_module", "surface-root")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row.data) {
      createdSignatures.add(
        (row.data as { failure_signature: string }).failure_signature,
      );
    }

    await ctx.close();
  });

  // ── TEST D · Baseline / no production control ─────────────────────

  test("D · without ?__inject the page behaves exactly as before · no bridge visible", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    await plantAuthCookies(ctx, user.jwt, user.refresh);
    const page = await ctx.newPage();
    const captured = await captureSurfaceHealthEmissions(page);

    await page.goto("/nex-native/chat/prototypes/depth-cards", {
      waitUntil: "networkidle",
    });

    // Deck renders (production baseline).
    await expect(page.locator("[data-nex-deck]").first()).toBeVisible();
    // Fallback must NOT be visible.
    await expect(page.locator('[role="log"]')).toHaveCount(0);
    // Minimal shell must NOT be visible.
    await expect(page.locator('[role="status"]')).toHaveCount(0);
    // No boundary emissions should have fired.
    await page.waitForTimeout(500);
    expect(captured.length).toBe(0);

    await ctx.close();
  });
});
