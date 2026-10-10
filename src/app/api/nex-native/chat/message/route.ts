// src/app/api/nex-native/chat/message/route.ts
//
// Wave 4 · first real application consumer of the NEX-native service layer.
//
//   POST · post a customer message to a business (optionally scoped to a
//          specific product). Creates or reuses a real persisted
//          nex_conversation · adds real participants · calls
//          conversationService.postMessage() → nex_message row on the
//          authoritative NEX Supabase (ijvqdvsvwtwxzcqmoqit).
//
//   GET  · retrieve the message history for a conversation the caller
//          participates in.
//
// Auth: `resolveNexAppSession(req)` — accepts Bearer JWT or ssr cookie ·
// verifies via Supabase Auth · resolves nex_account · auto-provisions
// on first call. Never trusts client-supplied identity.
//
// Zero business logic lives in this route. Every mutation goes through
// src/lib/nex-native/* services · the route is the auth+plumbing
// boundary only.

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as conversationService from "@/lib/nex-native/conversation-service";
import { enqueueNexReply } from "@/lib/nex-native/intelligence/enqueue-nex-reply";
import type { NexUuid } from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST · post a customer message to a business (optionally about a product)
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  let session;
  try {
    session = await resolveNexAppSession(req);
  } catch (e) {
    console.error("[chat/message POST] resolveNexAppSession threw:", (e as Error).message);
    return NextResponse.json({ error: "session_resolve_failed", detail: (e as Error).message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
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

  // 1 · Find existing conversation between this customer and this business
  //     scoped to the product (or the null-product bucket).
  let conversation;
  try {
    conversation = await conversationService.findLatestCustomerConversation({
      customer_account_id: session.account.id,
      business_id: business.id,
      about_product_id: product?.id ?? null,
    });
  } catch (e) {
    console.error("[chat/message POST] findLatestCustomerConversation threw:", (e as Error).message);
    return NextResponse.json({ error: "find_conv_failed", detail: (e as Error).message }, { status: 500 });
  }

  // 2 · Create it (+ both participants) if none exists.
  let createdConversation = false;
  if (!conversation) {
    try {
      conversation = await conversationService.createConversation({
        business_id: business.id,
        about_product_id: product?.id ?? null,
      });
      // Add customer (this session)
      await conversationService.addParticipant({
        conversation_id: conversation.id,
        account_id: session.account.id,
        side: "customer",
      });
      // Add business owner · the account that owns the business. Owner may
      // not have signed in yet — that's fine, they're a participant seat,
      // not required to be authenticated at post-time.
      await conversationService.addParticipant({
        conversation_id: conversation.id,
        account_id: business.owner_account_id,
        side: "business",
      });
      createdConversation = true;
    } catch (e) {
      console.error("[chat/message POST] createConversation/addParticipant threw:", (e as Error).message);
      return NextResponse.json({ error: "create_conv_failed", detail: (e as Error).message }, { status: 500 });
    }
  }

  // 3 · Post the message via the service · service enforces immutability
  //     and RLS/triggers enforce it too (Wave 3.1 C3 hardening).
  const message = await conversationService.postMessage({
    conversation_id: conversation.id,
    sender_account_id: session.account.id,
    body: messageBody,
  });

  // 4 · Wave 9/10 · enqueue a NEX Assistant reply for customer-side sends.
  // The client polls the messages endpoint (or job status) to observe
  // the reply landing. Never fabricates. Honest backpressure surfaced
  // in the response body when the queue refuses to admit.
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
    conversation_id: conversation.id,
    business_id: business.id,
    about_product_id: conversation.about_product_id,
    created_conversation: createdConversation,
    message: {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_account_id: message.sender_account_id,
      body: message.body,
      created_at: message.created_at,
    },
    queued_reply: queuedReply,
    account: { id: session.account.id, display_name: session.account.display_name },
  });
}

// ---------------------------------------------------------------------------
// GET · retrieve messages
//   ?conversationId=<uuid>     · read this conversation's messages
//     OR
//   ?businessSlug=<slug>&productId=<uuid>?  · locate the current session
//                                             user's conversation and return
//                                             its messages (empty if none)
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const session = await resolveNexAppSession(req);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const explicitConvId = url.searchParams.get("conversationId");
  const businessSlug = url.searchParams.get("businessSlug");
  const productId = url.searchParams.get("productId");

  let conversationId: NexUuid | null = null;

  if (explicitConvId) {
    conversationId = explicitConvId;
    // Verify caller is a participant · service-role bypasses RLS so we
    // must check ourselves at this application boundary.
    const parts = await conversationService.listParticipants(explicitConvId);
    const isParticipant = parts.some((p) => p.account_id === session.account.id);
    if (!isParticipant) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
  } else if (businessSlug) {
    const business = await businessService.getBusinessBySlug(businessSlug);
    if (!business) return NextResponse.json({ error: "business_not_found" }, { status: 404 });
    const existing = await conversationService.findLatestCustomerConversation({
      customer_account_id: session.account.id,
      business_id: business.id,
      about_product_id: productId ?? null,
    });
    if (!existing) {
      return NextResponse.json({
        conversation_id: null,
        messages: [],
        account: { id: session.account.id, display_name: session.account.display_name },
      });
    }
    conversationId = existing.id;
  } else {
    return NextResponse.json({ error: "missing_conversationId_or_businessSlug" }, { status: 400 });
  }

  const messages = await conversationService.listMessages(conversationId!);
  return NextResponse.json({
    conversation_id: conversationId,
    messages: messages.map((m) => ({
      id: m.id,
      sender_account_id: m.sender_account_id,
      body: m.body,
      created_at: m.created_at,
    })),
    account: { id: session.account.id, display_name: session.account.display_name },
  });
}
