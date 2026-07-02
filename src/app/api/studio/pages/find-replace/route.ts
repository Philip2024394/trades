// POST /api/studio/pages/find-replace
//   { find, replace, caseSensitive?, matchWord?, mode?: 'preview' | 'apply', pageIds?: string[] }
//
// Scans every string leaf under the merchant's draft layouts (either
// all pages, or the subset in `pageIds`) and either previews the
// matches or persists the replacement.
//
// Mode = 'preview': returns { hits: [{ pageId, path, before, after }] }
// Mode = 'apply':   persists mutated layouts + returns the same shape
//                   with `applied: true`.
//
// Strings are deep-walked through sections[].config and any nested
// arrays / objects. Non-string leaves are ignored.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  find?: string;
  replace?: string;
  caseSensitive?: boolean;
  matchWord?: boolean;
  mode?: "preview" | "apply";
  pageIds?: string[];
};

type Hit = {
  pageId: string;
  path: string;
  before: string;
  after: string;
  count: number;
};

type LayoutRow = {
  id: string;
  page_id: string;
  layout_json: {
    sections?: { instanceId: string; config?: Record<string, unknown> }[];
  };
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const find = body.find ?? "";
  if (!find) {
    return NextResponse.json({ ok: false, error: "empty-find" }, { status: 400 });
  }
  const replace = body.replace ?? "";
  const caseSensitive = Boolean(body.caseSensitive);
  const matchWord = Boolean(body.matchWord);
  const mode = body.mode === "apply" ? "apply" : "preview";

  // Escape regex special chars in the query — merchants type literal
  // strings, not regex.
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = matchWord ? `\\b${escaped}\\b` : escaped;
  const flags = caseSensitive ? "g" : "gi";
  const re = new RegExp(pattern, flags);

  const q = supabaseAdmin
    .from("studio_layouts")
    .select("id, page_id, layout_json")
    .eq("brand_id", session.brand.id)
    .eq("status", "draft")
    .eq("breakpoint", "default");
  if (Array.isArray(body.pageIds) && body.pageIds.length > 0) {
    q.in("page_id", body.pageIds);
  }
  const res = await q;
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }

  const hits: Hit[] = [];
  const layouts = (res.data ?? []) as LayoutRow[];

  for (const row of layouts) {
    const layout = row.layout_json ?? { sections: [] };
    const sections = layout.sections ?? [];
    let touched = false;
    for (const sec of sections) {
      if (!sec.config) continue;
      walkAndReplace(sec.config, `sec:${sec.instanceId}`, (path, before, after, count) => {
        hits.push({ pageId: row.page_id, path, before, after, count });
        touched = true;
      }, re, replace);
    }
    if (mode === "apply" && touched) {
      const upd = await supabaseAdmin
        .from("studio_layouts")
        .update({ layout_json: { ...layout, sections } })
        .eq("id", row.id);
      if (upd.error) {
        return NextResponse.json(
          { ok: false, error: upd.error.message },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    mode,
    hits,
    applied: mode === "apply"
  });
}

// Recursively walks obj, replacing string leaves in-place. Fires the
// callback for every match discovered so the response includes a full
// diff report.
function walkAndReplace(
  node: unknown,
  path: string,
  onHit: (path: string, before: string, after: string, count: number) => void,
  re: RegExp,
  replace: string
): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const child = node[i];
      if (typeof child === "string") {
        re.lastIndex = 0;
        const count = (child.match(re) ?? []).length;
        if (count > 0) {
          const next = child.replace(re, replace);
          node[i] = next;
          onHit(`${path}[${i}]`, child, next, count);
        }
      } else if (child && typeof child === "object") {
        walkAndReplace(child, `${path}[${i}]`, onHit, re, replace);
      }
    }
    return;
  }
  if (node && typeof node === "object") {
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === "string") {
        re.lastIndex = 0;
        const count = (v.match(re) ?? []).length;
        if (count > 0) {
          const next = v.replace(re, replace);
          rec[k] = next;
          onHit(`${path}.${k}`, v, next, count);
        }
      } else if (v && typeof v === "object") {
        walkAndReplace(v, `${path}.${k}`, onHit, re, replace);
      }
    }
  }
}
