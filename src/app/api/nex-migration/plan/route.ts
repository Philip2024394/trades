// POST /api/nex-migration/plan
// Body: { source_path, interface_name, table_name, dialect, persist? }
// Returns a full DdlPlan. Does NOT execute against any real database.
// Founder-callable and pipeline-callable.

import { NextResponse } from "next/server";
import { planFromInterface } from "@/lib/nex-migration";
import { isSafeIdentifier } from "@/lib/nex-migration";

export const dynamic = "force-dynamic";

interface Body {
  source_path?: string;
  interface_name?: string;
  table_name?: string;
  dialect?: "postgresql" | "sqlite";
  persist?: boolean;
  founder_prompt?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const source_path = String(body.source_path ?? "").trim();
  const interface_name = String(body.interface_name ?? "").trim();
  const table_name = String(body.table_name ?? "").trim();
  const dialect = body.dialect ?? "sqlite";

  if (!source_path || !interface_name || !table_name) {
    return NextResponse.json(
      { ok: false, error: "source_path, interface_name, and table_name are all required" },
      { status: 400 },
    );
  }
  if (dialect !== "postgresql" && dialect !== "sqlite") {
    return NextResponse.json({ ok: false, error: "dialect must be 'postgresql' or 'sqlite'" }, { status: 400 });
  }
  if (!isSafeIdentifier(table_name) || !isSafeIdentifier(interface_name)) {
    return NextResponse.json({ ok: false, error: "unsafe table or interface identifier" }, { status: 400 });
  }
  // source_path is repo-relative · reject any escape attempt.
  if (source_path.startsWith("..") || source_path.includes("\0") || /[a-zA-Z]:/.test(source_path)) {
    return NextResponse.json({ ok: false, error: "source_path must be repo-relative" }, { status: 400 });
  }

  const plan = planFromInterface({
    source_path,
    interface_name,
    table_name,
    dialect,
    persist: body.persist === true,
    founder_prompt: typeof body.founder_prompt === "string" ? body.founder_prompt : undefined,
  });
  return NextResponse.json(plan, { status: plan.ok ? 200 : 400 });
}
