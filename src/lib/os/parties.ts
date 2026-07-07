// OS Foundation — Party identity helpers.
//
// Every human or business on the platform gets one os_parties row.
// This module upserts and looks up parties by email hash / WhatsApp
// hash so any app can bind its data back to the universal identity.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashEmail, hashWhatsapp } from "@/lib/os/hashing";

export type PartyKind = "person" | "business";

export type PartyRecord = {
  id: string;
  kind: PartyKind;
  display_name: string;
  email: string | null;
  whatsapp_e164: string | null;
  business_listing_id: string | null;
  supabase_user_id: string | null;
  created_at: string;
};

export async function findOrCreatePersonParty(input: {
  displayName: string;
  email?: string | null;
  whatsappE164?: string | null;
}): Promise<PartyRecord> {
  const emailHash = input.email ? hashEmail(input.email) : null;
  const whatsappHash = input.whatsappE164
    ? hashWhatsapp(input.whatsappE164)
    : null;

  if (emailHash) {
    const { data } = await supabaseAdmin
      .from("os_parties")
      .select("*")
      .eq("email_hash", emailHash)
      .maybeSingle();
    if (data) return data as PartyRecord;
  }
  if (whatsappHash) {
    const { data } = await supabaseAdmin
      .from("os_parties")
      .select("*")
      .eq("whatsapp_hash", whatsappHash)
      .maybeSingle();
    if (data) return data as PartyRecord;
  }

  const { data: created, error } = await supabaseAdmin
    .from("os_parties")
    .insert({
      kind: "person" as const,
      display_name: input.displayName,
      email: input.email ?? null,
      email_hash: emailHash,
      whatsapp_e164: input.whatsappE164 ?? null,
      whatsapp_hash: whatsappHash
    })
    .select("*")
    .single();
  if (error || !created) {
    throw new Error(`Failed to create party: ${error?.message}`);
  }
  return created as PartyRecord;
}

export async function getPartyById(id: string): Promise<PartyRecord | null> {
  const { data } = await supabaseAdmin
    .from("os_parties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as PartyRecord) ?? null;
}

export async function findPartyByEmail(email: string): Promise<PartyRecord | null> {
  const emailHash = hashEmail(email);
  const { data } = await supabaseAdmin
    .from("os_parties")
    .select("*")
    .eq("email_hash", emailHash)
    .maybeSingle();
  return (data as PartyRecord) ?? null;
}
