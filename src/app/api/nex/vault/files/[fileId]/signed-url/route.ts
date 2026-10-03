// src/app/api/nex/vault/files/[fileId]/signed-url/route.ts
//
// Stage 4 · short-lived signed-URL endpoint for Vault files. Owner-scoped
// (resolves the viewer via session, verifies file ownership before issuing).
//
// Default TTL 60 seconds. No public URL path exists; this endpoint is the
// only way a client can obtain a URL to a Vault object.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { createSignedDownloadUrl } from "@/lib/nex-native/vault-file-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ fileId: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { fileId } = await ctx.params;
  if (!fileId || !/^[a-f0-9-]{36}$/i.test(fileId)) {
    return NextResponse.json({ error: "invalid file id" }, { status: 400 });
  }
  try {
    const url = await createSignedDownloadUrl(session.account.id, fileId);
    if (!url) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ url, ttl_seconds: 60 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
