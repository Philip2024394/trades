// src/lib/nex-native/realtime/presence.ts
//
// Bridge 67 · Typed presence-roster channel.
//
// Every account that opts into presence (via nex_account.presence_visible)
// tracks itself on `nex:presence:global`. Consumers subscribe once at
// app-shell mount and read the roster to paint avatar rings, chip rings,
// last-seen labels, and typing composer accent colors elsewhere.
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

const CHANNEL_NAME = "nex:presence:global";

export function openPresenceChannel(opts: {
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
    name: CHANNEL_NAME,
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
