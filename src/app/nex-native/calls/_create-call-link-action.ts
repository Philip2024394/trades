"use server";

// Server action: creates a call-link row and returns the shareable
// URL. Session-scoped · the viewer is the created_by.

import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  createCallLink,
  type CallLinkMediaType,
} from "@/lib/nex-native/call-link-service";

export interface CreateCallLinkArgs {
  mediaType: CallLinkMediaType;
  /** 1 = 1:1 ring; 2-4 spins up a group call session on first join. */
  maxUses?: number;
  ttlHours?: number;
}

export interface CreateCallLinkResult {
  ok: true;
  slug: string;
  shareUrl: string;
  mediaType: CallLinkMediaType;
  maxUses: number;
  expiresAt: string | null;
}

export async function createCallLinkAction(
  args: CreateCallLinkArgs,
): Promise<CreateCallLinkResult | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "unauthenticated" };
    const row = await createCallLink({
      createdBy: session.account.id,
      mediaType: args.mediaType,
      maxUses: args.maxUses,
      ttlHours: args.ttlHours,
    });
    const h = await headers();
    const host = h.get("host") ?? "localhost:3008";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const shareUrl = `${proto}://${host}/nex-native/call/j/${row.slug}`;
    return {
      ok: true,
      slug: row.slug,
      shareUrl,
      mediaType: row.media_type,
      maxUses: row.max_uses,
      expiresAt: row.expires_at,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
