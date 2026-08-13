// src/lib/nex/brain/http/validate-input.ts
//
// D9 · Shared route-boundary input validation for /api/nex/brain/*.
//
// Motivation: engineering-audit finding that almost none of the 18
// brain routes validate their input beyond ad-hoc enum checks. A single
// small helper here lets every route declare its expected shape via zod
// and get consistent 400 responses without repeating boilerplate.
//
// Usage in a route:
//
//   import { validateSearchParams, validateJsonBody } from "@/lib/nex/brain/http/validate-input";
//   import { z } from "zod";
//
//   const QuerySchema = z.object({ status: z.enum(["DRAFT","AUTHORITATIVE"]).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) });
//
//   export async function GET(req: NextRequest) {
//     const auth = checkCronAuth(req); if (!auth.ok) return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
//     const q = validateSearchParams(req, QuerySchema); if (!q.ok) return q.response;
//     // q.data is fully typed
//     ...
//   }
//
// Non-goals: this file does NOT auto-apply validation to every route.
// Migration is per-route. Adding validation to a route is a one-liner;
// leaving a route unvalidated is honest (visible in code review) rather
// than pretending everything is safe.

import { NextResponse } from "next/server";
import type { z, ZodError } from "zod";

/** Union result: caller either uses .data or returns .response. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/** Convert a ZodError into a shape that's safe to expose to callers.
 *  We include the field path + message so operators can debug, but never
 *  echo back the invalid value itself (which could be a secret). */
function zodErrorToBody(err: ZodError): { ok: false; error: "validation_failed"; issues: Array<{ path: string; message: string }> } {
  return {
    ok: false,
    error: "validation_failed",
    issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

/** Validate `req.nextUrl.searchParams` against a zod schema.
 *  Returns typed data or a 400 response. */
export function validateSearchParams<S extends z.ZodTypeAny>(
  req: { nextUrl: { searchParams: URLSearchParams } },
  schema: S,
): ValidationResult<z.infer<S>> {
  // URLSearchParams → plain object (last-wins for repeated keys, which
  // matches zod default coercion). Callers that need array semantics
  // should use z.array() with the raw searchParams.getAll().
  const obj: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams.entries()) obj[k] = v;
  const parsed = schema.safeParse(obj);
  if (parsed.success) return { ok: true, data: parsed.data as z.infer<S> };
  return { ok: false, response: NextResponse.json(zodErrorToBody(parsed.error), { status: 400 }) };
}

/** Validate the JSON body of a POST/PUT request against a zod schema.
 *  Returns typed data or a 400 response. Also handles JSON-parse errors. */
export async function validateJsonBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<ValidationResult<z.infer<S>>> {
  let raw: unknown;
  try {
    const text = await req.text();
    if (!text || text.length === 0) raw = {};
    else raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, response: NextResponse.json(
      { ok: false, error: "malformed_json", detail: e instanceof Error ? e.message : "parse failed" },
      { status: 400 },
    ) };
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data as z.infer<S> };
  return { ok: false, response: NextResponse.json(zodErrorToBody(parsed.error), { status: 400 }) };
}
