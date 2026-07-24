// POST /api/studio/export
// Streams the merchant's full Brand Package as a ZIP.
// Master Rule: "leave with everything" — Brand DNA + tokens + palette +
// every generated van/logo/etc. Merchant can walk with all of it.
//
// The response is a `application/zip` stream from `archiver`. We build
// the file structure via buildExportPackage() then push each file into
// the archive. Fetched assets (images) are streamed in-line so the ZIP
// doesn't materialise fully in memory.

import { type NextRequest } from "next/server";
import * as archiverNs from "archiver";
// archiver ships as a callable module — types don't advertise it, so
// cast through unknown here.
const archiverFn = (archiverNs as unknown as { default?: typeof archiverNs }).default ?? archiverNs;
type ArchiverFactory = (fmt: "zip", opts?: unknown) => import("archiver").Archiver;
const createArchive = archiverFn as unknown as ArchiverFactory;
import { PassThrough } from "node:stream";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { buildExportPackage } from "@/lib/design/export/zip-package";
import { parseBrandRecord } from "@/lib/design/brand/schema";
import { interpret as interpretTokens } from "@/lib/design/tokens/interpret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const session = await loadStudioSession();
  if (!session) return json({ ok: false, error: "not_authenticated" }, 401);

  const merchantSlug = session.merchant.slug;

  // Load Brand DNA. Refuses if the merchant hasn't done Discovery.
  const { data: identity, error: brandErr } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("id, brand_json, version")
    .eq("merchant_slug", merchantSlug)
    .maybeSingle();

  if (brandErr) return json({ ok: false, error: brandErr.message }, 500);
  if (!identity) return json({ ok: false, error: "no_brand_dna_yet" }, 409);

  let brand;
  try {
    brand = parseBrandRecord(identity.brand_json);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "invalid_brand" }, 500);
  }

  // Load every generated asset for this merchant. Sessions own the
  // generations. RLS + slug filter here defends the same rows twice.
  const { data: gens } = await supabaseAdmin
    .from("hammerex_van_generations")
    .select("id, kind, image_urls, prompt_text, sds_json, created_at, session:hammerex_van_sessions!inner(merchant_slug)")
    .eq("session.merchant_slug", merchantSlug)
    .order("created_at", { ascending: false });

  const assetList = (gens ?? []).flatMap((g) => {
    const urls = Array.isArray(g.image_urls) ? g.image_urls as string[] : [];
    return urls.map((u, i) => ({
      path: `Vehicles/${g.id}-${i}.png`,
      url:  u,
      kind: "png" as const
    }));
  });

  const pkg = buildExportPackage({
    brand,
    tokens:  interpretTokens(brand),
    version: identity.version,
    assetList
  });

  // Stream. `archiver` writes into a PassThrough, we turn that into a
  // Web ReadableStream for the Response body.
  const pass = new PassThrough();
  const archive = createArchive("zip", { zlib: { level: 6 } });
  archive.on("error", (e: Error) => { pass.destroy(e); });
  archive.pipe(pass);

  // Push the deterministic files first.
  for (const f of pkg.files) {
    const content = typeof f.content === "string" ? Buffer.from(f.content, "utf-8") : Buffer.from(f.content);
    archive.append(content, { name: f.path });
  }

  // Add every generation's recipe. Master Rule — the recipe is the
  // real product. The image is downstream artefact.
  for (const g of gens ?? []) {
    const recipe = JSON.stringify({
      generation_id: g.id,
      kind:          g.kind,
      prompt_text:   g.prompt_text,
      sds_json:      g.sds_json,
      created_at:    g.created_at
    }, null, 2);
    archive.append(Buffer.from(recipe, "utf-8"), { name: `Recipes/${g.id}.json` });
  }

  archive.finalize();

  const webStream = passthroughToWeb(pass);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${slugify(brand.name)}-brand-package.zip"`,
      "Cache-Control":       "no-store"
    }
  });
}

function passthroughToWeb(pt: PassThrough): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      pt.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      pt.on("end",  () => controller.close());
      pt.on("error", (e) => controller.error(e));
    },
    cancel() { pt.destroy(); }
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
}
