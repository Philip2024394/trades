// Shared helpers for /api/brain/* endpoints.

import { NextResponse } from "next/server";
import { nexBrainRuntimeEnabled } from "@/lib/nex/brains";

/** Every /api/brain/* endpoint calls this first. When the runtime flag
 *  is OFF, returns a 503 immediately — the substrate ships but does
 *  not serve traffic until ADR-0017 + ADR-0021 signoff + first Author
 *  under contract. */
export function requireBrainRuntime(): NextResponse | null {
  if (nexBrainRuntimeEnabled()) return null;
  return NextResponse.json(
    {
      ok: false,
      error: "nex_brain_runtime_disabled",
      detail: "The Nex Brain runtime is not enabled in this environment. Set NEX_BRAIN_RUNTIME_ENABLED=1 after ADR-0017 + ADR-0021 signoff."
    },
    { status: 503 }
  );
}

export function jsonError(code: string, detail: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: code, detail }, { status });
}

export function jsonOk(payload: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...(payload as object) }, { status });
}
