// POST /api/gold-path/dismiss/[taskId]

import { NextResponse } from "next/server";
import { dismissTask } from "@/lib/gold-path/loader";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const merchantId = request.headers.get("x-merchant-id");
  if (!merchantId) {
    return NextResponse.json(
      { error: "no merchant session" },
      { status: 401 }
    );
  }
  const ok = await dismissTask(merchantId, taskId);
  if (!ok) return NextResponse.json({ error: "dismiss failed" }, { status: 500 });
  return NextResponse.json({ ok });
}
