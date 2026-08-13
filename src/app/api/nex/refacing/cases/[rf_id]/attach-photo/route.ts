// POST /api/nex/refacing/cases/[rf_id]/attach-photo
//
// V3 support · attaches a BASE staircase photo to an existing Case at the
// SHOW stage. Multipart form upload · single photo per call (customer may
// upload multiple views by calling repeatedly).
//
// Storage: file saved to data/refacing-cases/uploads/<rf_id>/<image_id>.<ext>
// The photo is registered as an images_v3-like entry inline on the Case
// (existing_staircase.photos[]) · it does NOT get promoted to the shared
// images_v3[] library · customer BASE photos are Case-scoped, not library-scoped.
//
// Truthfulness contract (PR-16): the Case's unknown_items[] gets an updated
// "photo_pending" removal + a new note about what NEX cannot confirm from a
// photograph.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { readCaseWithToken, updateCase, CaseNotFoundError, CaseValidationError } from "@/lib/nex/refacing/case-store";
import type { BasePhoto } from "@/lib/nex/refacing/case-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPLOADS_ROOT = join(process.cwd(), "data", "refacing-cases", "uploads");
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extractToken(req: NextRequest): string | null {
  const q = new URL(req.url).searchParams.get("token");
  if (q) return q;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function extForMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string }> }
) {
  const { rf_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "expected_multipart_form_data" },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "form_parse_failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ ok: false, error: "photo_required" }, { status: 400 });
  }
  if (photo.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "photo_too_large", max_bytes: MAX_FILE_BYTES },
      { status: 413 }
    );
  }
  if (photo.type && !ALLOWED_MIME.has(photo.type.toLowerCase())) {
    return NextResponse.json(
      { ok: false, error: "photo_mime_not_allowed", got: photo.type },
      { status: 400 }
    );
  }

  try {
    // Verify token.
    await readCaseWithToken(rf_id, token);

    // Persist the file under data/refacing-cases/uploads/<rf_id>/<image_id>.<ext>
    const uploadDir = join(UPLOADS_ROOT, rf_id);
    await mkdir(uploadDir, { recursive: true });

    const image_id = `img_case_${rf_id}_${randomBytes(4).toString("hex")}`;
    const ext = extForMime(photo.type || "image/jpeg");
    const filename = `${image_id}.${ext}`;
    const filePath = join(uploadDir, filename);

    const buf = Buffer.from(await photo.arrayBuffer());
    await writeFile(filePath, buf);

    const base: BasePhoto = {
      image_id,
      captured_at: new Date().toISOString(),
    };

    // Update Case · promote status from DRAFT → BASE_UPLOADED
    // Also add PR-16 truthfulness note about what a photo cannot confirm.
    const updated = await updateCase(
      rf_id,
      (current) => {
        const nextPhotos = [...(current.existing_staircase.photos ?? []), base];
        const unknownItems = current.unknown_items
          .filter((u) => u.concern !== "photo_pending")
          .concat([
            {
              concern: "exact_dimensions",
              reason: "Exact tread/riser dimensions cannot be confirmed from a photograph · to be captured during survey.",
            },
            {
              concern: "timber_species_confirmation",
              reason: "Species can be inferred visually but the confirmed species requires a physical sample or survey.",
            },
            {
              concern: "structural_conditions",
              reason: "Structural condition · fixings · load capacity · not visible in a photograph.",
            },
          ]);

        return {
          ...current,
          existing_staircase: {
            ...current.existing_staircase,
            photos: nextPhotos,
          },
          unknown_items: unknownItems,
        };
      },
      "BASE_UPLOADED"
    );

    return NextResponse.json({
      ok: true,
      case: updated,
      photo: base,
    });
  } catch (err) {
    if (err instanceof CaseNotFoundError) {
      return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
    }
    if (err instanceof CaseValidationError) {
      return NextResponse.json(
        { ok: false, error: err.reason, detail: err.detail },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
