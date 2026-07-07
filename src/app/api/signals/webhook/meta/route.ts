// Meta signals webhook — receives engagement events from Facebook +
// Instagram (comments, likes, mentions, page insights).
//
// Meta requires:
//   GET  — echoes back the hub.challenge for verification (first-time
//          webhook registration handshake)
//   POST — signed with X-Hub-Signature-256 header, HMAC-SHA256 of
//          the body with META_WEBHOOK_APP_SECRET
//
// We map the incoming events to publications by external_id → publication_id
// and insert signal rows.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { insertSignal } from "@/lib/signals/loader";
import type { SignalType } from "@/lib/signals/types";

export const runtime = "nodejs";

// Facebook Graph webhook verification.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verify_failed" }, { status: 403 });
}

type MetaWebhookBody = {
  object: string;
  entry: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        item?: string;
        verb?: string;
        post_id?: string;
        media_id?: string;
        comment_id?: string;
        from?: { id: string; name: string };
      };
    }>;
  }>;
};

export async function POST(request: Request) {
  const bodyText = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature) {
    return NextResponse.json({ error: "unsigned" }, { status: 401 });
  }
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(bodyText).digest("hex");
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  const body = JSON.parse(bodyText) as MetaWebhookBody;
  const supaUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const c = supaUrl && key ? createClient(supaUrl, key, { auth: { persistSession: false } }) : null;
  const ingested: string[] = [];

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      const postId = v.post_id ?? v.media_id;
      if (!postId) continue;
      const signalType = mapVerbToSignalType(v.verb, change.field);
      if (!signalType) continue;

      // Look up the publication by external_id → get merchant + publication ids
      let merchantId: string | null = null;
      let publicationId: string | null = null;
      if (c) {
        const { data } = await c
          .from("publications")
          .select("id, merchant_id")
          .eq("external_id", postId)
          .maybeSingle();
        if (data) {
          publicationId = (data.id as string) ?? null;
          merchantId = (data.merchant_id as string) ?? null;
        }
      }
      if (!merchantId) continue;
      await insertSignal({
        merchantId,
        publicationId: publicationId ?? undefined,
        signalType,
        source: change.field === "feed" ? "facebook_webhook" : "instagram_webhook",
        metadata: {
          field: change.field,
          verb: v.verb,
          from: v.from,
          entry_id: entry.id
        }
      });
      ingested.push(signalType);
    }
  }

  return NextResponse.json({ ingested: ingested.length });
}

function mapVerbToSignalType(
  verb: string | undefined,
  field: string
): SignalType | null {
  if (!verb) return null;
  if (verb === "add" && field === "feed") return "comment";
  if (verb === "like") return "like";
  if (verb === "share") return "share";
  if (verb === "add" && (field === "comments" || field === "media")) return "comment";
  return null;
}
