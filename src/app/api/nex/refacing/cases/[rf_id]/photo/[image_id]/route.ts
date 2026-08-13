// GET /api/nex/refacing/cases/[rf_id]/photo/[image_id]
//
// Serves a customer's BASE photo from Case storage. Requires the anonymous
// return token. Never leaks whether the Case exists on token mismatch.
//
// This endpoint exists ONLY to render BASE photos in the homeowner UI
// (ShowPanel / SeeGrid / SeeComparison / LockConfirmation). It does NOT
// serve reference-library images (those live under /public/ and are
// served by Next's static file middleware).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readCaseWithToken, CaseNotFoundError } from "@/lib/nex/refacing/case-store";
import { extractToken } from "@/lib/nex/refacing/_route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS_ROOT = join(process.cwd(), "data", "refacing-cases", "uploads");

const EXT_MIME: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

async function tryReadFile(path: string): Promise<{ buf: Buffer; ext: string } | null> {
  for (const ext of Object.keys(EXT_MIME)) {
    try {
      const full = `${path}.${ext}`;
      const buf = await readFile(full);
      return { buf, ext };
    } catch {
      // try next extension
    }
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string; image_id: string }> }
) {
  const { rf_id, image_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 401 });
  }

  try {
    // Token gate (also asserts the Case exists · never leaks existence on mismatch)
    const c = await readCaseWithToken(rf_id, token);

    // Sanity check · the requested image_id must actually belong to THIS Case
    const claimed = c.existing_staircase.photos.some((p) => p.image_id === image_id);
    if (!claimed) {
      // Same 404 shape as unknown Case · never leaks that the file exists
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // Look up on disk · try all supported extensions
    const basePath = join(UPLOADS_ROOT, rf_id, image_id);
    const found = await tryReadFile(basePath);
    if (!found) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const mime = EXT_MIME[found.ext] ?? "application/octet-stream";
    return new NextResponse(found.buf, {
      status: 200,
      headers: {
        "Content-Type": mime,
        // The token-in-URL model means we can't safely cache · treat as private
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof CaseNotFoundError) {
      return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
