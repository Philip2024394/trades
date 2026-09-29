// src/lib/nex-native/realtime/presence.ts
//
// Bridge 67 (scoped 2026-09-29 by Bridge 83) · Per-conversation
// presence channels.
//
// SCALE CRITICAL: the earlier version used one global channel
// `nex:presence:global` that tracked every signed-in NEX user. At
// 100K concurrent that meant every browser downloaded + diffed a
// 100K-row roster on every join — a real crashy scale bug. Fix is
// to scope each presence subscription to its actual conversation
// (max 2 participants). Consumers still get the "is my peer online"
// signal they need; roster size stays constant regardless of NEX
// DAU. Friends-list live presence (where a viewer wants presence
// for every friend without opening each chat) is deferred to a
// per-account presence-ping channel in a follow-up bridge.
//
// Presence semantics match the sealed 2026-09-27 doctrine:
//   · green  — online (heartbeat within last 30s)
//   · amber  — busy (self-flagged, e.g. in a call)
//   · gray   — offline (no heartbeat, use last_seen fallback)
//
// Supabase Realtime handles heartbeats automatically — it emits a
// `leave` when the socket drops so we get offline detection for free.

"use client";

import { openNexChannel, type NexChannelHandle } from "./channel";

export type PresenceKind = "online" | "busy" | "offline";

export interface PresenceState {
  accountId: string;
  kind: PresenceKind;
  displayName?: string;
  updatedAt: number;
}

export interface PresenceChannel {
  /** Update this account's presence state. Publish an initial state on
   *  mount, then again whenever the local state changes (e.g. entering
   *  a call flips to "busy"). */
  publish(kind: PresenceKind): Promise<void>;
  /** Snapshot of every account currently on the presence roster. */
  snapshot(): PresenceState[];
  close(): Promise<void>;
}

function channelNameFor(conversationId: string): string {
  return `nex:presence:conv:${conversationId}`;
}

export function openPresenceChannel(opts: {
  /** Scope · required · presence roster is only the participants of
   *  this specific conversation. Keeps roster size O(1) at 100K DAU. */
  conversationId: string;
  selfAccountId: string;
  selfDisplayName: string;
  initialKind: PresenceKind;
  onRosterChange: (roster: PresenceState[]) => void;
}): PresenceChannel {
  let currentKind: PresenceKind = opts.initialKind;

  const flatten = (state: Record<string, unknown[]>): PresenceState[] => {
    const out: PresenceState[] = [];
    for (const key of Object.keys(state)) {
      const entries = state[key];
      const first = entries?.[0] as Partial<PresenceState> | undefined;
      if (!first || !first.accountId || !first.kind) continue;
      out.push({
        accountId: first.accountId,
        kind: first.kind,
        displayName: first.displayName,
        updatedAt: first.updatedAt ?? Date.now(),
      });
    }
    return out;
  };

  const handle: NexChannelHandle = openNexChannel({
    name: channelNameFor(opts.conversationId),
    selfId: opts.selfAccountId,
    onPresenceChange: (state) => {
      opts.onRosterChange(flatten(state as Record<string, unknown[]>));
    },
    onSubscribed: () => {
      const initial: PresenceState = {
        accountId: opts.selfAccountId,
        kind: currentKind,
        displayName: opts.selfDisplayName,
        updatedAt: Date.now(),
      };
      void handle.trackPresence(initial as unknown as Record<string, unknown>);
    },
  });

  return {
    async publish(kind: PresenceKind): Promise<void> {
      currentKind = kind;
      const state: PresenceState = {
        accountId: opts.selfAccountId,
        kind,
        displayName: opts.selfDisplayName,
        updatedAt: Date.now(),
      };
      await handle.trackPresence(state as unknown as Record<string, unknown>);
    },
    snapshot(): PresenceState[] {
      const raw = handle.getPresenceState<PresenceState>() as unknown as Record<string, PresenceState[]>;
      const out: PresenceState[] = [];
      for (const key of Object.keys(raw)) {
        const first = raw[key]?.[0];
        if (first) out.push(first);
      }
      return out;
    },
    close: () => handle.close(),
  };
}
