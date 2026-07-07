// POST /api/os/vault/notices/dismiss
//
// Dismiss a dashboard notice for the current homeowner. Supports
// hard dismissal or snooze (days).

import { NextResponse } from "next/server";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { dismissNotice } from "@/lib/os/vault/notices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  let body: {
    noticeKey?: string;
    channel?: "x_button" | "converted" | "snoozed";
    snoozeDays?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.noticeKey || typeof body.noticeKey !== "string") {
    return NextResponse.json(
      { ok: false, error: "noticeKey is required." },
      { status: 400 }
    );
  }

  const channel = body.channel ?? "x_button";
  const snoozeDays =
    typeof body.snoozeDays === "number" && body.snoozeDays > 0
      ? Math.min(body.snoozeDays, 365)
      : null;

  try {
    await dismissNotice(party.id, body.noticeKey, channel, snoozeDays);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to record dismissal." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
