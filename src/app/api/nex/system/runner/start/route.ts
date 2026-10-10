import { NextResponse } from "next/server";
import { startRunner } from "@/lib/nex-hq-system-runner/runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(): Promise<Response> {
  try {
    const result = await startRunner();
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(): Promise<Response> { return methodNotAllowed(); }
export async function PUT(): Promise<Response> { return methodNotAllowed(); }
export async function DELETE(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
