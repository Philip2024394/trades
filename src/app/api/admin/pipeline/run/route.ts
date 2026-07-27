// POST /api/admin/pipeline/run
//
// Runs the 7-pass Global Intelligence Pipeline (ADR-0031) server-side
// and atomically writes the manifest at Pass 7. Never writes partial
// state. Never processes images individually.
//
// Called by scripts/run-global-intelligence-pipeline.mjs — the CLI
// bulk runner. Also callable from admin UI when a "re-index all"
// button is pressed.

import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { runGlobalIntelligencePipeline } from "@/lib/nex/images/globalIntelligencePipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // pipeline over 1k images can take a moment

const MANIFEST_PATH = path.join(process.cwd(), "data", "nex-image-manifest.json");

export async function POST(req: Request) {
  let payload: {
    candidates?: Array<{
      url: string;
      contexts: Array<Record<string, unknown>>;
      origin?: string;
      purpose?: string;
      referring_files?: string[];
    }>;
    contextMap?: Record<string, Array<Record<string, unknown>>>;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const candidates = payload.candidates ?? [];
  if (candidates.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_candidates" },
      { status: 400 }
    );
  }

  // Reconstruct the context map from serialised payload
  const contextMap = new Map<string, Array<Record<string, unknown>>>();
  for (const [k, v] of Object.entries(payload.contextMap ?? {})) {
    contextMap.set(k, v);
  }

  // Description assembler — must match the bulk script's logic
  const assembleMasterDescription = (
    candidate: (typeof candidates)[number],
    contexts: Array<Record<string, unknown>>
  ): string => {
    const filename = decodeURIComponent(candidate.url.split("/").pop() ?? "");
    const sections: string[] = [];
    const identity: string[] = [];
    identity.push(`Image Name:\n${filename}`);
    const category = contexts.find((c) => c.category)?.category as string | undefined;
    if (category) identity.push(`Category:\n${category}`);
    if (candidate.referring_files?.length) {
      identity.push(
        `Referenced in:\n${candidate.referring_files
          .slice(0, 3)
          .map((f) => `- ${f}`)
          .join("\n")}`
      );
    }
    if (candidate.origin) identity.push(`Source Origin:\n${candidate.origin}`);
    sections.push(`IMAGE IDENTITY\n${identity.join("\n\n")}`);

    const descParts: string[] = [];
    for (const ctx of contexts) {
      if (ctx.question) descParts.push(`Q: ${ctx.question}`);
      if (ctx.answer_excerpt) descParts.push(ctx.answer_excerpt as string);
      if (ctx.caption) descParts.push(`Caption: ${ctx.caption}`);
      if (ctx.wood) descParts.push(`Wood species: ${ctx.wood}.`);
      if (ctx.notes) descParts.push(ctx.notes as string);
      if (ctx.material) descParts.push(`Material: ${ctx.material}.`);
    }
    if (descParts.length > 0) {
      sections.push(`IMAGE DESCRIPTION\n${descParts.join("\n\n")}`);
    }
    return sections.join("\n\n");
  };

  const { report, manifestRows } = await runGlobalIntelligencePipeline({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    candidates: candidates as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contextMap: contextMap as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assembleMasterDescription: assembleMasterDescription as any,
  });

  // Pass 7 — ATOMIC WRITE. Read existing manifest, preserve rows the
  // pipeline didn't touch (e.g. Philip's manually authored rows), merge
  // pipeline output, write once.
  let existing: { images?: Record<string, unknown> } = { images: {} };
  try {
    existing = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  } catch {
    // ok
  }
  if (!existing.images) existing.images = {};

  // Preserve manually-authored rows (created_by: philip and not by pipeline)
  const preserved: Record<string, unknown> = {};
  for (const [url, row] of Object.entries(existing.images)) {
    const r = row as { created_by?: string };
    if (r.created_by && r.created_by !== "pipeline" && r.created_by !== "bulk-processor") {
      preserved[url] = row;
    }
  }

  // Merge pipeline rows — pipeline output wins for URLs it touched,
  // preserved rows win for URLs it didn't (manual authoring is sacred).
  const nextImages: Record<string, unknown> = { ...preserved };
  for (const [url, row] of Object.entries(manifestRows)) {
    if (preserved[url]) continue; // preserve manual authoring untouched
    nextImages[url] = {
      ...row,
      source: "ai_generated",
      created_by: "pipeline",
      created_at: new Date().toISOString(),
    };
  }

  const nextManifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    description:
      "NEX image manifest — canonical index. Per ADR-0031, populated by the 7-pass Global Intelligence Pipeline. Per ADR-0032, every row carries a MASTER IMAGE SCORE across 5 axes.",
    images: nextImages,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2), "utf8");

  return NextResponse.json({
    ok: true,
    report,
    rows_saved: Object.keys(nextImages).length,
    manual_rows_preserved: Object.keys(preserved).length,
  });
}
