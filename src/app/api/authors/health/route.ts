// GET /api/authors/health
//
// Readiness check for the Author Studio + Brain Admin stack. Returns
// booleans about what is configured — never returns secret values.
// Safe to call without any session (config check only).
//
// Use this before you try to sign in as Author: if
// `ready_to_teach: false`, the JSON tells you exactly which env var
// or backing table is missing.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_SECRET_LEN = 32;

function isSet(v: string | undefined): boolean {
  return v != null && v.length > 0;
}
function isStrong(v: string | undefined): boolean {
  return v != null && v.length >= MIN_SECRET_LEN;
}
function allowlistCount(v: string | undefined): number {
  if (!v) return 0;
  return v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).length;
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from(name).select("*").limit(1);
    if (!error) return true;
    if (error.code === "42P01") return false;
    if (typeof error.message === "string" && error.message.includes("does not exist")) return false;
    // Any other error (e.g. RLS refusal on a table that DOES exist) still means the table is there.
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const studioFlag = process.env.NEX_AUTHOR_STUDIO_ENABLED;
  const adminFlag  = process.env.NEX_BRAIN_ADMIN_ENABLED;
  const runtimeFlag = process.env.NEX_BRAIN_RUNTIME_ENABLED;

  const authorAllowlist = process.env.NEX_AUTHOR_ALLOWLIST;
  const adminAllowlist  = process.env.NEX_BRAIN_ADMIN_ALLOWLIST;

  const authorInvite    = process.env.NEX_AUTHOR_INVITE_SECRET;
  const authorCookie    = process.env.NEX_AUTHOR_COOKIE_SECRET;
  const adminInvite     = process.env.NEX_BRAIN_ADMIN_INVITE_SECRET;
  const adminCookie     = process.env.NEX_BRAIN_ADMIN_COOKIE_SECRET;

  const anthropicKey    = process.env.ANTHROPIC_API_KEY;
  const supaUrl         = process.env.SUPABASE_URL;
  const supaKey         = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const flagsOn = {
    author_studio:  isTruthy(studioFlag),
    brain_admin:    isTruthy(adminFlag),
    brain_runtime:  isTruthy(runtimeFlag)
  };

  const allowlists = {
    author_count: allowlistCount(authorAllowlist),
    admin_count:  allowlistCount(adminAllowlist)
  };

  const secrets = {
    author_invite_ok:  isStrong(authorInvite),
    author_cookie_ok:  isStrong(authorCookie),
    admin_invite_ok:   isStrong(adminInvite),
    admin_cookie_ok:   isStrong(adminCookie),
    min_length:        MIN_SECRET_LEN
  };

  const externalKeys = {
    anthropic_api_key_present:      isSet(anthropicKey),
    supabase_url_present:           isSet(supaUrl),
    supabase_service_role_present:  isSet(supaKey)
  };

  // Table probes — only run if Supabase is configured; otherwise
  // report null (unknown).
  let tables: Record<string, boolean | null> = {
    hammerex_nex_brains:                null,
    hammerex_nex_brain_content:         null,
    hammerex_nex_brain_field_outcomes:  null
  };
  if (externalKeys.supabase_url_present && externalKeys.supabase_service_role_present) {
    tables = {
      hammerex_nex_brains:                await tableExists("hammerex_nex_brains"),
      hammerex_nex_brain_content:         await tableExists("hammerex_nex_brain_content"),
      hammerex_nex_brain_field_outcomes:  await tableExists("hammerex_nex_brain_field_outcomes")
    };
  }

  const ready_to_teach =
    flagsOn.author_studio
    && allowlists.author_count > 0
    && secrets.author_invite_ok
    && secrets.author_cookie_ok
    && externalKeys.anthropic_api_key_present;

  const ready_for_admin_review =
    flagsOn.brain_admin
    && allowlists.admin_count > 0
    && secrets.admin_invite_ok
    && secrets.admin_cookie_ok;

  const audit_grade_storage_active =
    (tables.hammerex_nex_brains ?? false)
    && (tables.hammerex_nex_brain_content ?? false);

  const gaps: string[] = [];
  if (!flagsOn.author_studio)             gaps.push("NEX_AUTHOR_STUDIO_ENABLED is not '1' / 'true'");
  if (allowlists.author_count === 0)      gaps.push("NEX_AUTHOR_ALLOWLIST is empty");
  if (!secrets.author_invite_ok)          gaps.push(`NEX_AUTHOR_INVITE_SECRET missing or <${MIN_SECRET_LEN} chars`);
  if (!secrets.author_cookie_ok)          gaps.push(`NEX_AUTHOR_COOKIE_SECRET missing or <${MIN_SECRET_LEN} chars`);
  if (!externalKeys.anthropic_api_key_present) gaps.push("ANTHROPIC_API_KEY missing (extraction will 503)");
  if (!flagsOn.brain_admin)               gaps.push("NEX_BRAIN_ADMIN_ENABLED is not '1' / 'true' (Admin review will 503)");
  if (allowlists.admin_count === 0)       gaps.push("NEX_BRAIN_ADMIN_ALLOWLIST is empty");
  if (!secrets.admin_invite_ok)           gaps.push(`NEX_BRAIN_ADMIN_INVITE_SECRET missing or <${MIN_SECRET_LEN} chars`);
  if (!secrets.admin_cookie_ok)           gaps.push(`NEX_BRAIN_ADMIN_COOKIE_SECRET missing or <${MIN_SECRET_LEN} chars`);
  if (!audit_grade_storage_active) {
    if (tables.hammerex_nex_brains === false || tables.hammerex_nex_brain_content === false) {
      gaps.push("brain_content_v0.sql migration not applied — drafts land in filesystem fallback (not audit-grade)");
    } else if (tables.hammerex_nex_brains === null) {
      gaps.push("Supabase not configured — cannot check whether audit-grade storage is available");
    }
  }

  return NextResponse.json({
    ok: true,
    ready_to_teach,
    ready_for_admin_review,
    audit_grade_storage_active,
    flags:                flagsOn,
    allowlists,
    secrets,
    external_keys:        externalKeys,
    tables,
    gaps,
    checked_at:           new Date().toISOString()
  });
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}
