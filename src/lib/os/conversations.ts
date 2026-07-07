// Find-or-create the engagement conversation, keeping participants in
// sync. Called by both sides — owner (entity member) and trade — so
// whoever posts first opens the thread and pulls the other side in.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ConversationSide = "entity_member" | "trade";

export async function ensureEngagementConversation(input: {
  engagementId: string;
  entityId: string;
  businessId: string | null;
  creatorPartyId: string;
  creatorSide: ConversationSide;
  tradePartyId?: string | null;
  entityOwnerPartyIds?: string[];
}): Promise<{ id: string; created: boolean } | null> {
  const { data: existing } = await supabaseAdmin
    .from("os_conversations")
    .select("id")
    .eq("engagement_id", input.engagementId)
    .maybeSingle();
  if (existing) {
    await addParticipant({
      conversationId: existing.id,
      partyId: input.creatorPartyId,
      businessId:
        input.creatorSide === "trade" ? input.businessId : null,
      side: input.creatorSide
    });
    return { id: existing.id, created: false };
  }

  const { data: created, error } = await supabaseAdmin
    .from("os_conversations")
    .insert({
      kind: "engagement_1to1",
      engagement_id: input.engagementId,
      entity_id: input.entityId,
      business_id: input.businessId,
      created_by_party_id: input.creatorPartyId
    })
    .select("id")
    .single();

  if (error || !created) return null;

  // Add creator + counterparty. Best-effort — if the other side isn't
  // known yet, they'll be added the first time they hit the thread.
  await addParticipant({
    conversationId: created.id,
    partyId: input.creatorPartyId,
    businessId:
      input.creatorSide === "trade" ? input.businessId : null,
    side: input.creatorSide
  });

  if (input.creatorSide === "entity_member" && input.tradePartyId) {
    await addParticipant({
      conversationId: created.id,
      partyId: input.tradePartyId,
      businessId: input.businessId,
      side: "trade"
    });
  }
  if (input.creatorSide === "trade") {
    for (const ownerPid of input.entityOwnerPartyIds ?? []) {
      await addParticipant({
        conversationId: created.id,
        partyId: ownerPid,
        businessId: null,
        side: "entity_member"
      });
    }
  }

  return { id: created.id, created: true };
}

async function addParticipant(input: {
  conversationId: string;
  partyId: string;
  businessId: string | null;
  side: ConversationSide;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("os_conversation_participants")
    .select("id")
    .eq("conversation_id", input.conversationId)
    .eq("party_id", input.partyId)
    .maybeSingle();
  if (existing) return;
  await supabaseAdmin.from("os_conversation_participants").insert({
    conversation_id: input.conversationId,
    party_id: input.partyId,
    business_id: input.businessId,
    side: input.side
  });
}

export async function markConversationRead(input: {
  conversationId: string;
  partyId: string;
}): Promise<void> {
  await supabaseAdmin
    .from("os_conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", input.conversationId)
    .eq("party_id", input.partyId);
}

export async function listMessages(conversationId: string) {
  const { data } = await supabaseAdmin
    .from("os_messages")
    .select("id, body, sender_party_id, sender_side, created_at, attachment_url")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  return data ?? [];
}

// Fetch the other participant's last_read_at so the sender can display
// green ticks on their own messages.
export async function loadOtherLastRead(input: {
  conversationId: string;
  meParty: string;
}): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("os_conversation_participants")
    .select("last_read_at")
    .eq("conversation_id", input.conversationId)
    .neq("party_id", input.meParty)
    .order("last_read_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data?.last_read_at ?? null;
}
