// src/app/nex-native/conversations/[conversationId]/page.tsx
//
// NEX customer↔business chat · Portrait Bloom shell.
// --------------------------------------------------
// Business-side chat now uses the same Portrait Bloom design language
// as friend chat, so the customer-side experience of buying from a
// NEX business feels like the same product as talking to a friend.
// The only differences are data mapping: logo_url instead of avatar_url,
// business.display_name instead of peer.display_name, product context
// chip when the conversation is scoped to a product.
//
// Backend and Server Actions are unchanged · postMessageAction still
// posts through conversation-service and enqueues NEX Assistant replies.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as conversationService from "@/lib/nex-native/conversation-service";
import { postMessageAction } from "../../_actions";
import {
  PortraitBloomShell,
  type PortraitBloomPresenceKind,
} from "../../chat/_portrait-bloom-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/conversations");

  const participation = await conversationService.getParticipation(
    conversationId,
    session.account.id,
  );
  if (!participation) {
    return <NonParticipantFallback />;
  }

  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) notFound();

  const [business, product, messages] = await Promise.all([
    businessService.getBusinessById(conversation.business_id),
    conversation.about_product_id
      ? productService.getProductById(conversation.about_product_id)
      : Promise.resolve(null),
    conversationService.listMessages(conversationId),
  ]);
  if (!business) notFound();

  // Mark as read on view · idempotent side-effect
  await conversationService.updateLastRead(conversationId, session.account.id);

  const bind = postMessageAction.bind(null, conversationId);

  // Business "presence" — for MVP we treat businesses as "OPEN" always.
  // A future slice can consult business_hours (migration 031) and flip
  // to "AWAY · will reply during hours" outside opening hours.
  const presenceKind: PortraitBloomPresenceKind = "online";
  const presenceLabel =
    participation.side === "customer"
      ? "NEX · chatting with"
      : "NEX · you host";

  const bloomMessages = messages.map((m) => ({
    id: m.id,
    body: m.body,
    sent_at: m.created_at,
    // Business chat doesn't have a per-message read_at yet · treat all
    // as read once the conversation has been read (older service uses
    // a per-participant last_read_at watermark). Displaying "✓✓" on
    // every outbound is fine for the current model.
    read_at: m.sender_account_id === session.account.id ? m.created_at : null,
    mine: m.sender_account_id === session.account.id,
  }));

  const priceLabel = product
    ? `${product.currency} ${(product.price_pence / 100).toFixed(2)}`
    : null;

  return (
    <PortraitBloomShell
      scope="business-chat"
      displayName={business.display_name}
      subtitle={
        business.description
          ? firstLine(business.description, 60)
          : "NEX business"
      }
      portraitUrl={business.logo_url ?? null}
      contextChip={
        product
          ? {
              label: product.name,
              sublabel: priceLabel,
            }
          : null
      }
      presenceKind={presenceKind}
      presenceLabel={presenceLabel}
      // No brand-colour field yet · fall back to NEX cyan.
      rippleColor="#00AFFF"
      backHref="/nex-native/conversations"
      messages={bloomMessages}
      composerAction={bind}
      composerPlaceholder={`Message ${business.display_name}…`}
      headerTag={
        participation.side === "customer"
          ? "NEX Business"
          : "NEX · your business"
      }
    />
  );
}

function firstLine(text: string, maxLen: number): string {
  const line = text.split(/\r?\n/)[0]?.trim() ?? "";
  if (line.length <= maxLen) return line;
  return line.slice(0, maxLen - 1).trimEnd() + "…";
}

function NonParticipantFallback() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#020914",
        color: "#F4F7FC",
        display: "grid",
        placeItems: "center",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Not your conversation
        </h1>
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "#8BA9D1",
            lineHeight: 1.55,
          }}
        >
          You&rsquo;re not a participant on this thread. If this is your
          business, sign in with the owner account.
        </p>
        <Link
          href="/nex-native/conversations"
          style={{
            display: "inline-block",
            marginTop: 18,
            padding: "10px 18px",
            borderRadius: 999,
            background: "rgba(0,159,239,0.15)",
            border: "1px solid #009FEF",
            color: "#F4F7FC",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Back to inbox
        </Link>
      </div>
    </main>
  );
}
