// src/lib/nex-native/realtime/channel.ts
//
// Bridge 67 · Typed Supabase Realtime channel wrapper.
//
// Every real-time feature in nex-native (WebRTC signalling, typing,
// presence) runs through this primitive. It gives us:
//
//   · A single subscribe/broadcast API that matches how we actually
//     use Realtime (broadcast + presence, not table subscriptions).
//   · Automatic self-filtering — broadcast events echo back to the
//     sender by default, and every consumer would otherwise have to
//     re-implement "ignore my own broadcasts."
//   · A clean teardown so components can subscribe in useEffect and
//     the channel unwinds when the effect cleanup fires.
//
// Channel naming convention: `nex:<feature>:<scope>` — e.g.
//   nex:signal:{conversationId}  · WebRTC offer/answer/ICE
//   nex:typing:{conversationId}  · typing indicators
//   nex:presence:{accountId}     · per-account presence
//
// Conversation IDs are UUID v4 (128 bits entropy) so channel names
// are effectively unguessable by non-participants. A stronger private-
// channel auth (RLS on realtime.messages) can layer on later without
// changing this API.

"use client";

import type {
  RealtimeChannel,
  RealtimePresenceState,
} from "@supabase/supabase-js";
import { getNexBrowserSupabase } from "./client";

export type BroadcastPayload = Record<string, unknown>;

export interface BroadcastEnvelope<T extends BroadcastPayload = BroadcastPayload> {
  sender: string;
  payload: T;
}

export interface NexChannelHandle {
  /** Broadcast an event to every subscriber on this channel. Self is
   *  filtered on the receive side, so senders never see their own echo. */
  broadcast(event: string, payload: BroadcastPayload): Promise<void>;
  /** Track this identity on the channel's presence roster. Call before
   *  or after subscribe — Supabase re-syncs on subscribe.  */
  trackPresence(state: BroadcastPayload): Promise<void>;
  /** Snapshot of current presence roster keyed by presence_ref. */
  getPresenceState<T = BroadcastPayload>(): RealtimePresenceState<T>;
  /** Unsubscribe + release the channel. Safe to call multiple times. */
  close(): Promise<void>;
}

export interface OpenChannelOptions<T extends BroadcastPayload = BroadcastPayload> {
  /** Full channel name — caller decides the naming scheme. */
  name: string;
  /** Identity used to filter own broadcasts. Usually the caller's
   *  nex_account.id. Required — without it consumers see their own
   *  events echoed back. */
  selfId: string;
  /** Fires for every broadcast except the caller's own. Event name is
   *  the sender's `event` string. */
  onBroadcast?: (event: string, envelope: BroadcastEnvelope<T>) => void;
  /** Fires whenever the presence roster changes (join, leave, sync). */
  onPresenceChange?: (state: RealtimePresenceState) => void;
  /** Fires once when the WebSocket-level subscription is live. */
  onSubscribed?: () => void;
  /** Fires on channel error — auto-reconnect happens under the hood via
   *  the Supabase SDK, but consumers may want to surface a "reconnecting"
   *  indicator. */
  onError?: (err: string) => void;
}

/**
 * Open (or attach to) a named Realtime channel. Returns a handle that
 * exposes broadcast + presence + close. Subscribe is fire-and-forget;
 * the returned handle is usable immediately (broadcasts before subscribe
 * completes queue inside the SDK).
 */
export function openNexChannel<T extends BroadcastPayload = BroadcastPayload>(
  opts: OpenChannelOptions<T>,
): NexChannelHandle {
  const supabase = getNexBrowserSupabase();
  const channel: RealtimeChannel = supabase.channel(opts.name, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: opts.selfId },
    },
  });

  if (opts.onBroadcast) {
    channel.on("broadcast", { event: "*" }, (msg) => {
      const raw = msg.payload as BroadcastEnvelope<T> | undefined;
      if (!raw || raw.sender === opts.selfId) return;
      opts.onBroadcast!(msg.event, raw);
    });
  }

  if (opts.onPresenceChange) {
    const emit = () => opts.onPresenceChange!(channel.presenceState());
    channel.on("presence", { event: "sync" }, emit);
    channel.on("presence", { event: "join" }, emit);
    channel.on("presence", { event: "leave" }, emit);
  }

  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") opts.onSubscribed?.();
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      opts.onError?.(err ? String(err) : status);
    }
  });

  return {
    async broadcast(event: string, payload: BroadcastPayload): Promise<void> {
      const envelope: BroadcastEnvelope = { sender: opts.selfId, payload };
      await channel.send({ type: "broadcast", event, payload: envelope });
    },
    async trackPresence(state: BroadcastPayload): Promise<void> {
      await channel.track(state);
    },
    getPresenceState<TState = BroadcastPayload>(): RealtimePresenceState<TState> {
      return channel.presenceState<TState>();
    },
    async close(): Promise<void> {
      try {
        await channel.untrack();
      } catch {
        /* presence may not have been tracked · ignore */
      }
      await supabase.removeChannel(channel);
    },
  };
}
