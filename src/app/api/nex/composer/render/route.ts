// POST /api/nex/composer/render — { blocks, subject?, preview_text?, variables?, resolve_unsubscribe? }
// Returns { html, plain_text }
import { NextResponse } from "next/server";
import { renderBlocksToHtml, renderBlocksToPlainText } from "@/lib/nex/composer/renderer";
import { sampleContext } from "@/lib/nex/composer/variables";
import type { Block, VariableContext } from "@/lib/nex/composer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { blocks?: Block[]; subject?: string; preview_text?: string; variables?: VariableContext; resolve_unsubscribe?: boolean };

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const variables = body.variables ?? sampleContext();
  const html = renderBlocksToHtml(blocks, {
    subject: body.subject, preview_text: body.preview_text,
    variables, resolveUnsubscribe: body.resolve_unsubscribe === true,
  });
  const plain_text = renderBlocksToPlainText(blocks, {
    subject: body.subject, preview_text: body.preview_text,
    variables, resolveUnsubscribe: body.resolve_unsubscribe === true,
  });
  return NextResponse.json({ ok: true, html, plain_text });
}
