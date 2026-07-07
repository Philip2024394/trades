// GET /api/gold-path/[merchantId] — open Gold Path tasks.

import { NextResponse } from "next/server";
import { loadOpenTasks } from "@/lib/gold-path/loader";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ merchantId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const tasks = await loadOpenTasks(merchantId);
  return NextResponse.json({ tasks });
}
