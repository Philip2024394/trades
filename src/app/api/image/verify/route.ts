// POST /api/image/verify
//
// Decodes the steganographic payload from a supplied image. Used to
// prove provenance of a suspected repost — upload the stolen image
// and get back the original thenetworkers.app/i/{imageId} URL.
//
// Body: multipart/form-data with field `file` (the image to check).
// Response: { payload: string | null, ahash: string, matches: [...] }

import { NextResponse } from "next/server";
import { extractPayload } from "@/lib/watermark/steganography";
import { computeAHash } from "@/lib/watermark/perceptualHash";
import { findByAhash } from "@/lib/watermark/registry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected multipart form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  // Try steganography first — if the payload is intact, we have an
  // exact URL and don't need aHash matching.
  const payload = await extractPayload(buffer).catch(() => null);
  const ahash = await computeAHash(buffer);
  const matches = await findByAhash(ahash, 10);

  return NextResponse.json({
    payload,
    ahash,
    matches: matches.map((m) => ({
      imageId: m.imageId,
      distance: m.distance,
      confidence: m.distance <= 3 ? "high" : m.distance <= 7 ? "medium" : "low"
    }))
  });
}
