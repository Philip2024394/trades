// Route helpers · convert service-layer errors to consistent JSON responses.

import { NextResponse } from "next/server";
import { MaterialsError } from "../_schema/types";

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof MaterialsError) {
    return NextResponse.json(
      { ok: false, code: e.code, error: e.message, details: e.details ?? undefined },
      { status: e.status },
    );
  }
  const msg = (e as Error)?.message ?? "unknown error";
  console.error("[materials] unexpected error", e);
  return NextResponse.json(
    { ok: false, code: "internal", error: msg },
    { status: 500 },
  );
}

export function okResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}
