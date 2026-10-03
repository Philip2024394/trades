// tests/e2e/hq-surface-health.spec.ts
//
// §12 Item 3 · HQ Surface-Health + Theme Kill-Switch browser evidence.
// Drives the real HQ page + Server Actions against a running dev server
// configured with NEX_HQ_ADMIN_TOKEN.
//
// Requires:
//   · Supabase service-role env configured
//   · Dev server running with NEX_HQ_ADMIN_TOKEN=<value> (NOT with
//     NEX_SURFACE_HEALTH_TEST_BRIDGE=1 — Item 3 validation uses the
//     production-equivalent env)
//   · NEX_E2E_SKIP_WEBSERVER=1 if the dev server is externally managed

import { test, expect, type BrowserContext } from "@playwright/test";
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
const ADMIN_TOKEN = process.env.NEX_HQ_ADMIN_TOKEN;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error("hq-surface-health: Supabase env not configured");
}
if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 8) {
  throw new Error(
    "hq-surface-health: NEX_HQ_ADMIN_TOKEN must be set to a value of at least 8 chars",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MARIA_ID = "d3e7f000-0001-4a00-b000-000000000001";
const PILOT_URL = "/nex-native/chat/prototypes/depth-cards";
const HQ_URL = "/nex-head-quarters/surface-health";
const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";
const PILOT_SIGNATURE = `hq-pilot-${Math.random().toString(16).slice(2, 10)}`;
const KILL_SWITCH_THEME = "pink-dream"; // known seeded theme row

interface SignedInUser {
  email: string;
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
}

async function provisionUser(suffix: string): Promise<SignedInUser> {
  const email = `nex-hqshu-${suffix}@nex-native.local`;
  const password = "HqSurfaceHealth!2026";
  const cu = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `HQ-SHU ${suffix}` },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  const authId = cu.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `HQ-SHU ${suffix}`, chat_theme: KILL_SWITCH_THEME })
    .select("id")
    .single();
  if (acc.error || !acc.data) throw new Error(`account: ${acc.error?.message}`);
  const accountId = (acc.data as { id: string }).id;

  // Ensure Maria exists so the pilot renders the deck tree.
  const maria = await admin.from("nex_account").select("id").eq("id", MARIA_ID).maybeSingle();
  if (!maria.data) {
    await admin.from("nex_account").insert({
      id: MARIA_ID,
      display_name: "Maria Santos",
      nex_handle: "nex-27418",
      chat_theme: "pink",
    });
  }

  // Seed one Maria→viewer message so the SafeFallbackRenderer has
  // content to display during the kill-switch test.
  const [a, b] = accountId < MARIA_ID ? [accountId, MARIA_ID] : [MARIA_ID, accountId];
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
      body: "HQ-SHU-GOLDEN-MESSAGE kill-switch evidence",
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

// Walk a row from fallback-active → ongoing (DB-trigger-enforced).
async function seedOngoingRow(signature: string): Promise<string> {
  const inserted = await admin
    .from("nex_surface_health_event")
    .insert({
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
      component_module: "theme-root",
      error_classification: "theme_bundle_load_failure",
      recovery_action: "fallback",
      failure_signature: signature,
      lifecycle_state: "fallback-active",
      state_history: [],
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) {
    throw new Error(`seed fallback-active: ${inserted.error?.message}`);
  }
  const id = (inserted.data as { id: string }).id;
  const walked = await admin
    .from("nex_surface_health_event")
    .update({ lifecycle_state: "ongoing" })
    .eq("id", id)
    .select("id")
    .single();
  if (walked.error) throw new Error(`walk to ongoing: ${walked.error.message}`);
  return id;
}

async function closeRowThroughLifecycle(id: string): Promise<void> {
  const current = await admin
    .from("nex_surface_health_event")
    .select("lifecycle_state")
    .eq("id", id)
    .maybeSingle();
  if (!current.data) return;
  let state = (current.data as { lifecycle_state: string }).lifecycle_state;
  const walk: string[] = [];
  if (state === "fallback-active" || state === "ongoing") walk.push("investigating");
  if (state === "investigating" || walk.length) walk.push("fixed", "verified");
  else if (state === "fixed") walk.push("verified");
  for (const next of walk) {
    await admin
      .from("nex_surface_health_event")
      .update({ lifecycle_state: next })
      .eq("id", id);
    state = next;
  }
}

async function readRowState(id: string): Promise<string | null> {
  const r = await admin
    .from("nex_surface_health_event")
    .select("lifecycle_state")
    .eq("id", id)
    .maybeSingle();
  return (r.data as { lifecycle_state: string } | null)?.lifecycle_state ?? null;
}

async function readThemeIsActive(themeId: string): Promise<boolean | null> {
  const r = await admin
    .from("nex_chat_theme")
    .select("is_active")
    .eq("id", themeId)
    .maybeSingle();
  return (r.data as { is_active: boolean } | null)?.is_active ?? null;
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

test.describe("§12 Item 3 · HQ Surface-Health + Kill-Switch", () => {
  let user: SignedInUser;
  let rowId: string;
  let pinkDreamOriginalActive: boolean | null;

  test.beforeAll(async () => {
    const suffix = "h" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
    user = await provisionUser(suffix);
    rowId = await seedOngoingRow(PILOT_SIGNATURE);
    pinkDreamOriginalActive = await readThemeIsActive(KILL_SWITCH_THEME);
  });

  test.afterAll(async () => {
    try {
      // Restore pink-dream to its original state regardless of test outcomes.
      if (pinkDreamOriginalActive !== null) {
        await admin
          .from("nex_chat_theme")
          .update({ is_active: pinkDreamOriginalActive })
          .eq("id", KILL_SWITCH_THEME);
      }
      await closeRowThroughLifecycle(rowId);
    } finally {
      await cleanupUser(user);
    }
  });

  // ── TEST 1 · HQ page loads + lists seeded ongoing row ─────────────

  test("HQ page loads, kanban visible, seeded ongoing row shown", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();
    await page.goto(HQ_URL, { waitUntil: "networkidle" });
    await expect(page.getByTestId("hq-surface-health-title")).toBeVisible();
    await expect(page.getByTestId("hq-lifecycle-kanban")).toBeVisible();
    await expect(page.getByTestId(`lifecycle-row-${rowId}`)).toBeVisible();
    // Admin-token-missing warning should NOT appear since the env var is set.
    await expect(page.getByTestId("hq-admin-token-missing")).toHaveCount(0);
    await ctx.close();
  });

  // ── TEST 2 · Non-admin cannot operate controls ────────────────────

  test("non-admin (no token) cannot transition the row", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();
    await page.goto(HQ_URL, { waitUntil: "networkidle" });

    const row = page.getByTestId(`lifecycle-row-${rowId}`);
    const form = row.locator("form").first();
    await form.getByPlaceholder("HQ admin token").fill("wrong-token-attempt");
    await row.getByTestId("transition-submit").click();
    await expect(row.getByTestId("transition-error")).toContainText("unauthorized");

    // DB state unchanged.
    expect(await readRowState(rowId)).toBe("ongoing");
    await ctx.close();
  });

  // ── TEST 3 · Admin transition ongoing → investigating ─────────────

  test("admin token transitions ongoing → investigating via HQ UI", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();
    await page.goto(HQ_URL, { waitUntil: "networkidle" });

    // Confirm the seeded row starts in the ongoing column.
    await expect(
      page.getByTestId("lifecycle-column-ongoing").getByTestId(`lifecycle-row-${rowId}`),
    ).toBeVisible();

    const row = page.getByTestId(`lifecycle-row-${rowId}`);
    const form = row.locator("form").first();
    await form.getByPlaceholder("HQ admin token").fill(ADMIN_TOKEN!);
    await form.getByPlaceholder("reason (optional)").fill("hq playwright evidence");
    await Promise.all([
      page.waitForLoadState("networkidle"),
      row.getByTestId("transition-submit").click(),
    ]);

    // DB-level truth: the row is now in investigating.
    await expect
      .poll(() => readRowState(rowId), { timeout: 10_000 })
      .toBe("investigating");

    // UI-level truth: after revalidation the row has moved to the
    // investigating column.
    await expect(
      page.getByTestId("lifecycle-column-investigating").getByTestId(`lifecycle-row-${rowId}`),
    ).toBeVisible();
    await ctx.close();
  });

  // ── TEST 4 · Kill-switch disables theme + pilot shows fallback ────

  test("admin disables theme · pilot shows SafeFallbackRenderer with messages intact", async ({
    browser,
  }) => {
    const hqCtx = await browser.newContext({ baseURL: BASE_URL });
    const hqPage = await hqCtx.newPage();
    await hqPage.goto(HQ_URL, { waitUntil: "networkidle" });

    const themeRow = hqPage.getByTestId(`theme-row-${KILL_SWITCH_THEME}`);
    await expect(themeRow).toBeVisible();

    const form = themeRow.locator("form").first();
    await form.getByPlaceholder("HQ admin token").fill(ADMIN_TOKEN!);
    await form.getByPlaceholder("actor label").fill("hq-playwright");
    await form.getByPlaceholder("reason (optional)").fill("evidence · temporary disable");
    await hqPage.getByTestId(`kill-switch-${KILL_SWITCH_THEME}`).click();
    await expect(hqPage.getByTestId(`kill-switch-ok-${KILL_SWITCH_THEME}`)).toBeVisible();

    expect(await readThemeIsActive(KILL_SWITCH_THEME)).toBe(false);
    await hqCtx.close();

    // Now the viewer (whose chat_theme=pink-dream) visits the pilot
    // and must see the SafeFallbackRenderer with the seeded message.
    const vCtx = await browser.newContext({ baseURL: BASE_URL });
    await plantAuthCookies(vCtx, user.jwt, user.refresh);
    const vPage = await vCtx.newPage();
    await vPage.goto(PILOT_URL, { waitUntil: "networkidle" });

    const fallback = vPage.locator('[role="log"]').first();
    await expect(fallback).toBeVisible({ timeout: 10_000 });
    await expect(fallback).toContainText(/Theme temporarily unavailable/);
    await expect(fallback).toContainText("HQ-SHU-GOLDEN-MESSAGE kill-switch evidence");

    // Composer still available (essential chat preserved).
    const composer = vPage.locator("form textarea, form input[type=text]").first();
    await expect(composer).toBeVisible();

    // No raw error text leaks to the user.
    const bodyText = await vPage.locator("body").innerText();
    expect(bodyText).not.toMatch(/Error:/);
    expect(bodyText).not.toMatch(/at VisualThemeBoundary/);

    await vCtx.close();
  });

  // ── TEST 5 · Re-enabling the theme restores normal rendering ──────

  test("admin re-enables theme · pilot restores themed deck", async ({ browser }) => {
    const hqCtx = await browser.newContext({ baseURL: BASE_URL });
    const hqPage = await hqCtx.newPage();
    await hqPage.goto(HQ_URL, { waitUntil: "networkidle" });

    const themeRow = hqPage.getByTestId(`theme-row-${KILL_SWITCH_THEME}`);
    const form = themeRow.locator("form").first();
    await form.getByPlaceholder("HQ admin token").fill(ADMIN_TOKEN!);
    await form.getByPlaceholder("actor label").fill("hq-playwright");
    await form.getByPlaceholder("reason (optional)").fill("evidence · re-enable");
    await hqPage.getByTestId(`kill-switch-${KILL_SWITCH_THEME}`).click();
    await expect(hqPage.getByTestId(`kill-switch-ok-${KILL_SWITCH_THEME}`)).toBeVisible();

    expect(await readThemeIsActive(KILL_SWITCH_THEME)).toBe(true);
    await hqCtx.close();

    const vCtx = await browser.newContext({ baseURL: BASE_URL });
    await plantAuthCookies(vCtx, user.jwt, user.refresh);
    const vPage = await vCtx.newPage();
    await vPage.goto(PILOT_URL, { waitUntil: "networkidle" });

    // Normal deck visible again · no fallback.
    await expect(vPage.locator("[data-nex-deck]").first()).toBeVisible();
    await expect(vPage.locator('[role="log"]')).toHaveCount(0);
    await vCtx.close();
  });
});
