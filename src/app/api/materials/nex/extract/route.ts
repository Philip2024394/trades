// POST /api/materials/nex/extract
// Body: multipart/form-data · file: image (jpg/png/webp/heic)
// Returns: { ok: true, data: { intent, memory_match } }
//
// Uploads are held in memory only — never persisted to storage. The
// extracted intent + Memory match are handed back to the UI just like
// the text /parse endpoint so the confirmation screen is source-agnostic.

import { requireAuth } from "@/lib/nex/brains/_auth";
import { extractIntentFromDocument } from "@/apps/materials/_services/nex_document";
import { findMemoryByQuery } from "@/apps/materials/_services/memory";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";
import { MaterialsError } from "@/apps/materials/_schema/types";

export const runtime = "nodejs";
export const maxDuration = 60;   // vision calls can take a moment

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 8 * 1024 * 1024;   // 8 MB

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new MaterialsError("invalid_input", "No file uploaded (field name must be 'file').", 422);
    }
    if (!ALLOWED_MIME.has(file.type)) {
      throw new MaterialsError("invalid_input", `Unsupported file type '${file.type}'. Use JPG, PNG, WebP, or HEIC.`, 422);
    }
    if (file.size === 0) {
      throw new MaterialsError("invalid_input", "The uploaded file is empty.", 422);
    }
    if (file.size > MAX_BYTES) {
      throw new MaterialsError("invalid_input", `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max 8MB).`, 422);
    }

    const buf   = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    const intent = await extractIntentFromDocument(base64, file.type);

    if (intent.action !== "add_stock") {
      return okResponse({ intent, memory_match: { kind: "none" as const } });
    }

    const memory_match = await findMemoryByQuery(user.email, intent.material_query);
    return okResponse({ intent, memory_match });
  } catch (e) {
    return errorResponse(e);
  }
}
