import { NextResponse } from "next/server";
import { stopRunner, status } from "@/lib/nex-hq-system-runner/runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(): Promise<Response> {
  await stopRunner();
  return NextResponse.json({ ok: true, result: status() }, { status: 200 });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true, result: status() }, { status: 200 });
}
