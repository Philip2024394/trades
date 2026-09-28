// src/lib/nex-native/report-service.ts
//
// Bridge 16d · Report service.
// ---------------------------
// User-generated abuse / scam reports. Wraps nex_report (migration
// 070) with a snapshot helper that captures the offending peer
// conversation at report time · this evidence survives even if the
// reported party later deletes their messages.
//
// Reviewer surface (admin dashboard) is queued · during pilot,
// operators inspect the table directly and update `status` +
// `reviewer_note` by hand.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp } from "./types";
import * as peerConversationService from "./peer-conversation-service";
import * as peerMessageService from "./peer-message-service";

export const NEX_REPORT_REASONS = [
  "scam",
  "harassment",
  "prohibited_goods",
  "impersonation",
  "spam",
  "off_doctrine_payment",
  "other",
] as const;

export type NexReportReason = (typeof NEX_REPORT_REASONS)[number];

export const NEX_REPORT_REASON_LABEL: Record<
  NexReportReason,
  { emoji: string; label: string; blurb: string }
> = {
  scam: {
    emoji: "🚨",
    label: "Scam or fraud",
    blurb: "Took money and didn't ship · sent counterfeit / fake · lied about the item",
  },
  harassment: {
    emoji: "😠",
    label: "Harassment or threats",
    blurb: "Verbally abusive · threatening · repeatedly contacting you after you asked them to stop",
  },
  prohibited_goods: {
    emoji: "⛔",
    label: "Prohibited goods",
    blurb: "Illegal items · drugs · weapons · endangered wildlife · counterfeit currency · stolen goods",
  },
  impersonation: {
    emoji: "🎭",
    label: "Impersonation",
    blurb: "Pretending to be someone else · using a real person's photo/name without permission",
  },
  spam: {
    emoji: "📢",
    label: "Spam",
    blurb: "Unwanted promotional messages · phishing · bot-like behaviour",
  },
  off_doctrine_payment: {
    emoji: "💵",
    label: "Off-doctrine payment demand",
    blurb: "Pressuring you to pay direct bank / QR / e-wallet before delivery · refuses COD or escrow",
  },
  other: {
    emoji: "…",
    label: "Something else",
    blurb: "Explain in the note field · reviewer will follow up if needed",
  },
};

export type NexReportStatus =
  | "pending"
  | "under_review"
  | "action_taken"
  | "dismissed"
  | "escalated_to_law";

export interface NexReportRow {
  id: NexUuid;
  reporter_account_id: NexUuid;
  reported_account_id: NexUuid;
  conversation_id: NexUuid | null;
  reason: NexReportReason;
  note: string | null;
  chat_snapshot: unknown | null;
  status: NexReportStatus;
  reviewer_note: string | null;
  reviewed_by: NexUuid | null;
  reviewed_at: NexTimestamp | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface CreateReportInput {
  reporterAccountId: NexUuid;
  reportedAccountId: NexUuid;
  reason: NexReportReason;
  note?: string | null;
  /** When true (default) · snapshot the peer conversation into
   *  chat_snapshot for evidence. Set false when reporting from
   *  outside a chat context (e.g. a listing page). */
  snapshotConversation?: boolean;
}

/** File a report. Snapshots the offending peer conversation into
 *  chat_snapshot when both parties have an existing thread ·
 *  reviewer keeps the evidence even if the reported user later
 *  deletes messages. */
export async function createReport(
  input: CreateReportInput,
): Promise<NexReportRow> {
  if (input.reporterAccountId === input.reportedAccountId) {
    throw new Error("report-service.createReport: cannot report yourself");
  }
  if (!NEX_REPORT_REASONS.includes(input.reason)) {
    throw new Error(
      `report-service.createReport: unknown reason '${input.reason}'`,
    );
  }
  const note = input.note?.trim() || null;
  if (note && note.length > 2000) {
    throw new Error("report-service.createReport: note exceeds 2000 chars");
  }

  // Try to snapshot the offending conversation. Failure here doesn't
  // abort the report · we still want to capture the accusation.
  let chatSnapshot: unknown | null = null;
  let conversationId: NexUuid | null = null;
  if (input.snapshotConversation !== false) {
    try {
      const conv = await peerConversationService.findPeerConversation(
        input.reporterAccountId,
        input.reportedAccountId,
      );
      if (conv) {
        conversationId = conv.id;
        const messages = await peerMessageService.listPeerMessages(conv.id);
        chatSnapshot = {
          captured_at: new Date().toISOString(),
          conversation: {
            id: conv.id,
            participant_a_id: conv.participant_a_id,
            participant_b_id: conv.participant_b_id,
            created_at: conv.created_at,
            last_message_at: conv.last_message_at,
          },
          messages: messages.map((m) => ({
            id: m.id,
            sender_account_id: m.sender_account_id,
            body: m.body,
            sent_at: m.sent_at,
            deleted_for_everyone: m.deleted_for_everyone,
            attachment_url: m.attachment_url,
            attachment_type: m.attachment_type,
            attachment_meta: m.attachment_meta,
          })),
        };
      }
    } catch {
      // Snapshot failure never blocks the report · we log & continue.
      chatSnapshot = { captured_at: new Date().toISOString(), error: "snapshot_failed" };
    }
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_report")
    .insert({
      reporter_account_id: input.reporterAccountId,
      reported_account_id: input.reportedAccountId,
      conversation_id: conversationId,
      reason: input.reason,
      note,
      chat_snapshot: chatSnapshot,
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `report-service.createReport: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexReportRow;
}

/** Count pending reports against an account · feeds a future
 *  auto-suspend threshold (admin bridge). */
export async function countPendingReportsAgainst(
  accountId: NexUuid,
): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_report")
    .select("*", { count: "exact", head: true })
    .eq("reported_account_id", accountId)
    .eq("status", "pending");
  if (error) {
    throw new Error(
      `report-service.countPendingReportsAgainst: ${error.message}`,
    );
  }
  return count ?? 0;
}

/** True when the viewer has already reported this account · used to
 *  hide the report affordance from someone who's already used it
 *  once in the current conversation. */
export async function viewerHasReported(
  reporterAccountId: NexUuid,
  reportedAccountId: NexUuid,
): Promise<boolean> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_report")
    .select("*", { count: "exact", head: true })
    .eq("reporter_account_id", reporterAccountId)
    .eq("reported_account_id", reportedAccountId);
  if (error) {
    throw new Error(`report-service.viewerHasReported: ${error.message}`);
  }
  return (count ?? 0) > 0;
}
