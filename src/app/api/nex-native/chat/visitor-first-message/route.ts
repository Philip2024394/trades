// src/app/api/nex-native/chat/visitor-first-message/route.ts
//
// Wave 4N deep · #262 · atomic visitor bootstrap + first message.
// -------------------------------------------------------------------------
// One server call that atomically:
//   1 · provisions a visitor auth.users row (metadata.is_nex_visitor=true)
//   2 · signs the visitor in (writes the Supabase SSR cookie)
//   3 · lets resolveNexAppSession auto-provision the nex_account
//   4 · posts the first message via conversationService (same production
//       path as any other message · same RLS · same immutability trigger)
//   5 · returns the raw session tokens so the client can call
//       supabase.auth.setSession locally to update the UI badge
//
// This avoids client-side sequencing (visitor-session → wait → POST /message)
// which raced Turbopack dev-server compilation. Now the visitor's first
// message is a single round-trip.

import { NextResponse } from "next/server";
import { nexAppSsrServerClient, resolveNexAppSessionByAccessToken } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as conversationService from "@/lib/nex-native/conversation-service";
import { enqueueNexReply } from "@/lib/nex-native/intelligence/enqueue-nex-reply";
import type { NexUuid } from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randomToken(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = ((await req.json()) as Record<string, unknown>) ?? {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const businessSlug = typeof body.businessSlug === "string" ? body.businessSlug.trim() : "";
  const productId = typeof body.productId === "string" && body.productId ? (body.productId as NexUuid) : null;
  const messageBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!businessSlug) return NextResponse.json({ error: "missing_businessSlug" }, { status: 400 });
  if (!messageBody) return NextResponse.json({ error: "missing_body" }, { status: 400 });
  if (messageBody.length > 4000) return NextResponse.json({ error: "body_too_long" }, { status: 400 });

  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) return NextResponse.json({ error: "business_not_found" }, { status: 404 });

  let product = null;
  if (productId) {
    product = await productService.getProductById(productId);
    if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });
    if (product.business_id !== business.id) {
      return NextResponse.json({ error: "product_not_on_business" }, { status: 400 });
    }
  }

  // Provision a visitor auth.users row + sign it in so the response
  // carries the Supabase SSR Set-Cookie. Then resolve the NEX session
  // directly from the fresh access token · this atomically auto-provisions
  // the nex_account without waiting on client cookie propagation.
  const ssr = await nexAppSsrServerClient();
  const token = randomToken(16);
  const placeholderEmail = `visitor-${token}@visitor.nex-native.local`;
  const placeholderPassword = `Vp!${randomToken(24)}`;
  const created = await nexSupabaseAdmin.auth.admin.createUser({
    email: placeholderEmail,
    password: placeholderPassword,
    email_confirm: true,
    user_metadata: {
      is_nex_visitor: true,
      arrived_via_business_slug: businessSlug,
      created_at_iso: new Date().toISOString(),
    },
  });
  if (created.error || !created.data.user) {
    return NextResponse.json(
      { error: "visitor_create_failed", detail: created.error?.message ?? "unknown" },
      { status: 500 },
    );
  }
  const signIn = await ssr.auth.signInWithPassword({
    email: placeholderEmail,
    password: placeholderPassword,
  });
  if (signIn.error || !signIn.data.session) {
    try {
      await nexSupabaseAdmin.auth.admin.deleteUser(created.data.user.id);
    } catch { /* swallow */ }
    return NextResponse.json(
      { error: "visitor_signin_failed", detail: signIn.error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  const session = await resolveNexAppSessionByAccessToken(signIn.data.session.access_token);
  if (!session) {
    return NextResponse.json({ error: "visitor_session_resolve_failed" }, { status: 500 });
  }

  // Post the first message via the SAME production service path used
  // by every other message. No fork, no parallel chat system.
  let conversation = await conversationService.findLatestCustomerConversation({
    customer_account_id: session.account.id,
    business_id: business.id,
    about_product_id: product?.id ?? null,
  });
  let createdConversation = false;
  if (!conversation) {
    conversation = await conversationService.createConversation({
      business_id: business.id,
      about_product_id: product?.id ?? null,
    });
    await conversationService.addParticipant({
      conversation_id: conversation.id,
      account_id: session.account.id,
      side: "customer",
    });
    await conversationService.addParticipant({
      conversation_id: conversation.id,
      account_id: business.owner_account_id,
      side: "business",
    });
    createdConversation = true;
  }
  const message = await conversationService.postMessage({
    conversation_id: conversation.id,
    sender_account_id: session.account.id,
    body: messageBody,
  });

  // Fire the NEX Assistant reply queue in the background · same honest
  // backpressure surface as the standard message endpoint. Never fabricate.
  let queuedReply: {
    admitted: boolean;
    job_id?: string;
    correlation_id?: string;
    reason?: string;
    retry_after_seconds?: number;
  } = { admitted: false };
  try {
    const enqueued = await enqueueNexReply({
      conversation_id: conversation.id,
      requester_account_id: session.account.id,
      requester_side: "customer",
    });
    queuedReply = enqueued.admit
      ? { admitted: true, job_id: enqueued.job_id, correlation_id: enqueued.correlation_id }
      : { admitted: false, reason: enqueued.reason, retry_after_seconds: enqueued.retry_after_seconds };
  } catch (e) {
    queuedReply = {
      admitted: false,
      reason: e instanceof Error ? e.message.slice(0, 200) : "enqueue_failed",
    };
  }

  return NextResponse.json({
    ok: true,
    is_visitor: true,
    conversation_id: conversation.id,
    business_id: business.id,
    about_product_id: conversation.about_product_id,
    created_conversation: createdConversation,
    account: { id: session.account.id, display_name: session.account.display_name },
    message: {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_account_id: message.sender_account_id,
      body: message.body,
      created_at: message.created_at,
    },
    queued_reply: queuedReply,
    session: {
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    },
  });
}
