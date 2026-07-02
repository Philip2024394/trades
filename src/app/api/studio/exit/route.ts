// Studio sign-out. Clears the session cookie and redirects to /studio.
// Invoked by the Exit button in the top bar of StudioShell.

import { NextResponse } from "next/server";
import { clearStudioSession } from "@/lib/studio/session";

export async function POST(req: Request) {
  await clearStudioSession();
  const url = new URL("/studio", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
