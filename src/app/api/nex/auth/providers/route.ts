// src/app/api/nex/auth/providers/route.ts
//
// Founder Phase 24 · P24-2 · List OAuth providers + their configuration state.
// GET → { providers: [{ id, display_name, configured, start_url }] }

import { NextResponse } from "next/server";
import { listProviders } from "@/lib/nex/oauth/providers";

export const runtime = "nodejs";

export async function GET() {
  const providers = listProviders().map((p) => ({
    ...p,
    start_url: p.configured ? `/api/nex/auth/oauth/${p.id}/start` : null,
  }));
  return NextResponse.json({
    providers,
    doctrine_note: "Providers list is honest: `configured=false` means the founder has not set the OAuth secrets · endpoints will return 503 in that state · we never fabricate a login flow.",
  });
}
