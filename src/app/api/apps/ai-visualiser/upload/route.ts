// POST /api/apps/ai-visualiser/upload
//
// Homeowner uploads a source photo. Authorised by a signed upload
// grant issued by the register route. Zero trust of form-body ids —
// merchantId + homeownerId come from the verified grant. Uses the OS
// media primitive for storage.
import { NextResponse } from "next/server";
import { uploadImage } from "@/lib/os/media";
import { verifyUploadGrant } from "@/lib/os/uploadGrants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-form" }, { status: 400 });
  }
  const grantToken = String(form.get("uploadGrant") || "").trim();
  if (!grantToken) {
    return NextResponse.json(
      { ok: false, error: "missing-grant" },
      { status: 401 }
    );
  }
  const verified = verifyUploadGrant(grantToken);
  if (!verified.ok) {
    return NextResponse.json(
      { ok: false, error: `grant:${verified.error}` },
      { status: 401 }
    );
  }
  const raw = form.get("file");
  if (!(raw instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
  }
  const result = await uploadImage({
    actor: {
      kind: "homeowner",
      merchantId: verified.grant.merchantId,
      partyId: verified.grant.homeownerId
    },
    category: "ai-visualiser",
    scopeId: verified.grant.homeownerId,
    file: raw
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.code === "file-too-large" ? 413 : 400 }
    );
  }
  return NextResponse.json({
    ok: true,
    path: result.path,
    url: result.url
  });
}
