// src/app/api/nex-live/upload/route.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Upload declaration endpoint
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §4 · §5 · §11 · §17 · §18
//
// This endpoint DOES NOT handle the media file bytes. Bytes flow
// through the existing /api/nex-media/upload endpoint (proven infra).
// This endpoint's job is:
//
//   1. Verify the caller is an authenticated user (§17 · reuses
//      getAuthenticatedUser · no parallel auth per §18).
//   2. Record the uploader's rights declaration for the media_id.
//   3. Tag the media with a NEX Live mode (MUSIC or VIDEO).
//   4. Publish the media into NEX Live discovery.
//
// §10 immutable: the declaration is stored as UNVERIFIED — never
// silently upgraded to KNOWN_OWNED.
//
// Body:
//   {
//     media_id:            string,
//     mode:                "MUSIC" | "VIDEO",
//     declared_kind:       "OWNER_DECLARED" | "LICENSED" | "PUBLIC_DOMAIN" | "CREATIVE_COMMONS",
//     declared_statement:  string,
//     supporting_reference?: string
//   }

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { newDeclaration, mayPublishDeclaredMedia, type DeclaredRightsKind } from "@/lib/nex/live/rights-declaration";
import { saveDeclaration, readActiveDeclaration } from "@/lib/nex/live/media-declaration-store";
import { classifyMode, type NexLiveMode } from "@/lib/nex/live/discovery";
import { verifyMediaOwnership, passesPublicationGate } from "@/lib/nex/live/upload-validation";
import { getMediaPool } from "@/lib/nex-media/media-object";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Local media-mode registry (§20 · JSONL, no schema change) ────────
// Records the mode tag chosen by the uploader. Reads from this + the
// declaration store to compute the NEX Live discovery feed. Production
// would put nex_live_mode inside nex.media_object.extras.

function modeIndexPath(): string {
  const override = process.env.NEX_LIVE_DATA_ROOT;
  const root = (override && override.length > 0)
    ? override
    : path.join(process.cwd(), "data", "nex-live");
  return path.join(root, "media-mode-index.json");
}
type ModeIndex = { version: number; index: Record<string, { mode: NexLiveMode; owner_user_id: string; registered_at_iso: string }> };
function readModeIndex(): ModeIndex {
  try {
    if (!fs.existsSync(modeIndexPath())) return { version: 1, index: {} };
    const raw = fs.readFileSync(modeIndexPath(), "utf8");
    if (!raw.trim()) return { version: 1, index: {} };
    return JSON.parse(raw) as ModeIndex;
  } catch { return { version: 1, index: {} }; }
}
function writeModeIndex(m: ModeIndex): void {
  const p = modeIndexPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2), "utf8");
  fs.renameSync(tmp, p);
}
export function _readModeIndexForRoute() { return readModeIndex(); }   // exposed for /discover reuse

// ── Validation ────────────────────────────────────────────────────

const ALLOWED_KINDS: DeclaredRightsKind[] = [
  "OWNER_DECLARED", "LICENSED", "PUBLIC_DOMAIN", "CREATIVE_COMMONS",
];

function validateBody(body: unknown): { ok: true; parsed: {
  media_id: string; mode: NexLiveMode; declared_kind: DeclaredRightsKind;
  declared_statement: string; supporting_reference: string | null;
} } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body_required" };
  const b = body as Record<string, unknown>;
  const media_id = typeof b.media_id === "string" ? b.media_id.trim() : "";
  if (media_id.length === 0 || media_id.length > 200) return { ok: false, error: "media_id_required" };
  const mode = b.mode;
  if (mode !== "MUSIC" && mode !== "VIDEO") return { ok: false, error: "mode_must_be_MUSIC_or_VIDEO" };
  const declared_kind = b.declared_kind;
  if (typeof declared_kind !== "string" || !ALLOWED_KINDS.includes(declared_kind as DeclaredRightsKind)) {
    return { ok: false, error: `declared_kind_must_be_one_of:${ALLOWED_KINDS.join("|")}` };
  }
  const declared_statement = typeof b.declared_statement === "string" ? b.declared_statement.trim() : "";
  if (declared_statement.length < 5) return { ok: false, error: "declared_statement_min_5_chars" };
  const supporting_reference = typeof b.supporting_reference === "string" && b.supporting_reference.trim().length > 0
    ? b.supporting_reference.trim() : null;
  return { ok: true, parsed: {
    media_id, mode: mode as NexLiveMode, declared_kind: declared_kind as DeclaredRightsKind,
    declared_statement, supporting_reference,
  } };
}

// ── POST handler ─────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: `unauthenticated:${auth.error ?? "unknown"}` },
      { status: 401 },
    );
  }
  const body = await req.json().catch(() => null);
  const v = validateBody(body);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const { media_id, mode, declared_kind, declared_statement, supporting_reference } = v.parsed;

  // §5 · one active declaration per media. Re-declaration is allowed
  // (uploader corrects mistake, or dispute resolution).
  const existing = readActiveDeclaration(media_id);
  if (existing && existing.uploader_user_id !== auth.user.supabase_user_id) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  // §16 · §17 immutable · Phase C hardening ────────────────────────
  // Verify the authenticated user actually OWNS the media_id in
  // nex.media_object. Without this check any authenticated user could
  // brute-force UUIDs and declare ownership of other users' media.
  // If storage is unavailable in dev, we fall back to the prior Phase 1
  // behaviour of trusting the (already-checked) prior-declaration match
  // — but ONLY if a prior declaration by THIS user exists (existing !==
  // null path above). This preserves developer flow while still failing
  // closed for first-time declarations against untrusted media_ids.
  let ownershipVerified = false;
  try {
    const pool = getMediaPool();
    const ownership = await verifyMediaOwnership(pool, {
      media_id,
      authenticated_supabase_user_id: auth.user.supabase_user_id,
    });
    if (ownership.ok) {
      ownershipVerified = true;
      // §17 publication gate composite check
      const gate = passesPublicationGate({
        authenticated_supabase_user_id: auth.user.supabase_user_id,
        media_ownership: ownership,
        has_active_rights_declaration: true,   // this request IS the declaration
      });
      if (!gate.ok) {
        return NextResponse.json(
          { ok: false, error_code: gate.error_code, error: gate.reason },
          { status: gate.error_code === "MEDIA_NOT_OWNED" ? 403
                : gate.error_code === "MEDIA_NOT_FOUND" ? 404
                : gate.error_code === "MEDIA_NOT_READY" ? 409
                : 400 },
        );
      }
    } else {
      // Ownership check failed with a non-404 reason (e.g. MEDIA_NOT_OWNED)
      // — fail closed. Only MEDIA_STORAGE_UNAVAILABLE falls through to
      // prior-declaration-only mode (dev without DB), which itself
      // requires a prior declaration by this user to have succeeded.
      if (ownership.error_code === "MEDIA_NOT_FOUND") {
        return NextResponse.json(
          { ok: false, error_code: "MEDIA_NOT_FOUND", error: "media_id not registered in nex.media_object" },
          { status: 404 },
        );
      }
      if (ownership.error_code === "MEDIA_NOT_OWNED") {
        return NextResponse.json(
          { ok: false, error_code: "MEDIA_NOT_OWNED", error: "authenticated user does not own this media_id" },
          { status: 403 },
        );
      }
      // MEDIA_STORAGE_UNAVAILABLE · fall through with ownershipVerified=false
    }
  } catch {
    // getMediaPool may throw in environments without NEX_POSTGRES_URL
    // — fall through, but existing declaration match remains the only
    // authorization path.
  }
  if (!ownershipVerified && !existing) {
    return NextResponse.json(
      {
        ok: false,
        error_code: "MEDIA_STORAGE_UNAVAILABLE",
        error: "unable to verify media ownership · storage layer unreachable AND no prior declaration to reference",
      },
      { status: 503 },
    );
  }

  const decl = newDeclaration({
    declaration_id: randomUUID(),
    media_id,
    uploader_user_id: auth.user.supabase_user_id,
    declared_kind,
    declared_statement,
    supporting_reference,
  });
  saveDeclaration(decl);

  // Register mode tag.
  const idx = readModeIndex();
  idx.index[media_id] = {
    mode,
    owner_user_id: auth.user.supabase_user_id,
    registered_at_iso: new Date().toISOString(),
  };
  writeModeIndex(idx);

  const gate = mayPublishDeclaredMedia(declared_kind);

  return NextResponse.json({
    ok: true,
    declaration: {
      declaration_id: decl.declaration_id,
      media_id,
      declared_kind,
      declared_at_iso: decl.declared_at_iso,
    },
    mode,
    publish_allowed: gate.allowed,
    publish_reason: gate.reason,
    // §10 · never let the UI think we verified anything.
    verified: false,
    honesty: {
      note: "Declaration recorded. NEX has NOT independently verified ownership.",
      customer_facing_label: {
        OWNER_DECLARED: "Uploader-declared ownership",
        LICENSED: "Uploader-declared licence",
        PUBLIC_DOMAIN: "Uploader-declared public domain",
        CREATIVE_COMMONS: "Uploader-declared Creative Commons",
      }[declared_kind],
    },
  });
}
