// src/app/api/nex/lab/language-room/translate/route.ts
//
// POST /api/nex/lab/language-room/translate
// body: { utterance: string, source: "english"|"bahasa_indonesia", target: "english"|"bahasa_indonesia" }
//
// Runs the deterministic Intent-Preserving Translation engine (v0).
// Fails closed on ambiguous input. Never manufactures meaning.

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translateIntentPreserving, type IPTLanguage } from "@/lib/nex-language-brain/translation-engine-v0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: IPTLanguage[] = ["english", "bahasa_indonesia"];

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const utterance = typeof body.utterance === "string" ? body.utterance : "";
  const source = body.source;
  const target = body.target;
  if (!utterance || !ALLOWED.includes(source) || !ALLOWED.includes(target)) {
    return NextResponse.json({ error: "invalid_arguments", allowed_source_target: ALLOWED }, { status: 400 });
  }
  const registry = JSON.parse(readFileSync(resolve(process.cwd(), "data/nex1-language-brain/pattern-registry-v0.json"), "utf8"));
  const result = translateIntentPreserving({
    utterance,
    source,
    target,
    registry,
    verify_round_trip: true,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
