// src/lib/nex-native/realtime/people-presence.ts
//
// Global people-presence tracker · Bridge 67 Supabase Realtime channel.
// --------------------------------------------------------------------
// Two channels, keyed by account_id:
//
//   nex:presence:global   · every signed-in NEX session tracks here.
//                            Everyone else subscribed sees who's
//                            currently online.
//   nex:presence:in-call  · the PeerCall client tracks here while the
//                            call state is `connected`. Online +
//                            in-call = "busy on a call".
//
// Public API is a pair of channel helpers; the React side wires them
// into a context in src/app/nex-native/calls/_presence-client.tsx.

"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getNexBrowserSupabase } from "./client";

export const PRESENCE_GLOBAL_CHANNEL = "nex:presence:global";
export const PRESENCE_IN_CALL_CHANNEL = "nex:presence:in-call";

export interface PresenceSets {
  online: Set<string>;
  inCall: Set<string>;
}

interface JoinOptions {
  accountId: string;
  onChange: (sets: PresenceSets) => void;
}

/** Join both presence channels for this viewer. The viewer is
 *  tracked on the global channel immediately · the in-call channel
 *  is subscribed read-only here (the call launcher opts in via
 *  trackPresenceInCall when a call reaches connected). */
export function joinPeoplePresence(opts: JoinOptions): () => void {
  const sb = getNexBrowserSupabase();

  const online = new Set<string>();
  const inCall = new Set<string>();
  const emit = () => opts.onChange({ online: new Set(online), inCall: new Set(inCall) });

  const globalCh: RealtimeChannel = sb.channel(PRESENCE_GLOBAL_CHANNEL, {
    config: { presence: { key: opts.accountId } },
  });
  const inCallCh: RealtimeChannel = sb.channel(PRESENCE_IN_CALL_CHANNEL, {
    config: { presence: { key: opts.accountId } },
  });

  globalCh.on("presence", { event: "sync" }, () => {
    online.clear();
    for (const k of Object.keys(globalCh.presenceState())) online.add(k);
    emit();
  });
  inCallCh.on("presence", { event: "sync" }, () => {
    inCall.clear();
    for (const k of Object.keys(inCallCh.presenceState())) inCall.add(k);
    emit();
  });

  void globalCh.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await globalCh.track({ at: new Date().toISOString() });
    }
  });
  void inCallCh.subscribe(() => {
    /* read-only · tracking is opt-in via trackPresenceInCall */
  });

  return () => {
    void globalCh.unsubscribe();
    void inCallCh.unsubscribe();
  };
}

/** One-shot read of the in-call presence channel · resolves true
 *  when the peer is currently tracked as busy. Used by the call
 *  launcher's start handlers so an outgoing call never dials a
 *  user who is already on another call. */
export async function isPeerInCall(peerAccountId: string): Promise<boolean> {
  const sb = getNexBrowserSupabase();
  const ch = sb.channel(PRESENCE_IN_CALL_CHANNEL);
  try {
    return await new Promise<boolean>((resolve) => {
      let decided = false;
      const decide = (v: boolean) => {
        if (decided) return;
        decided = true;
        void ch.unsubscribe();
        resolve(v);
      };
      void ch.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Supabase broadcasts a presence sync shortly after SUBSCRIBED;
        // read state once a short tick later so we see every tracked key.
        setTimeout(() => {
          const state = ch.presenceState();
          decide(peerAccountId in state);
        }, 150);
      });
      // Hard cap · if the channel never syncs within 2s, treat as
      // "not known to be busy" and let the dial proceed. The callee
      // will reject if they're actually in another call.
      setTimeout(() => decide(false), 2000);
    });
  } catch {
    return false;
  }
}

/** Opt the current session into the "in-call" presence set for as
 *  long as the returned un-track function hasn't been called. Used
 *  by _call-launcher.tsx when PeerCall reaches `connected`. */
export function trackPresenceInCall(accountId: string): () => void {
  const sb = getNexBrowserSupabase();
  const ch = sb.channel(PRESENCE_IN_CALL_CHANNEL, {
    config: { presence: { key: accountId } },
  });
  let subscribed = false;
  void ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      subscribed = true;
      await ch.track({ at: new Date().toISOString() });
    }
  });
  return () => {
    if (subscribed) {
      void ch.untrack();
    }
    void ch.unsubscribe();
  };
}
