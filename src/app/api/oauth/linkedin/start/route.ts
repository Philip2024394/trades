import { NextResponse } from "next/server";
import { linkedinAuthStartUrl } from "@/lib/oauth/linkedin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const merchantId = new URL(request.url).searchParams.get("merchantId");
  if (!merchantId) {
    return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  }
  const url = linkedinAuthStartUrl(merchantId);
  if (!url) {
    return NextResponse.json(
      { error: "linkedin_not_configured" },
      { status: 503 }
    );
  }
  return NextResponse.redirect(url);
}
