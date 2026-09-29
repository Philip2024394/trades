// src/lib/nex-native/realtime/client.ts
//
// Bridge 67 · Browser Supabase client factory · cached singleton.
//
// The nex-native surface previously had server-side clients only
// (session.ts + supabase-admin.ts). Realtime broadcasts / presence
// require a browser client that carries the signed-in user's JWT
// through Supabase's Realtime authentication.
//
// Consumers: signalling.ts (WebRTC), typing.ts, presence.ts.
// Every module goes through this factory so we share one WebSocket
// connection across features — Supabase Realtime multiplexes channels
// on a single socket, and creating multiple clients would fragment
// that + waste sockets.

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getNexBrowserSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for realtime.",
    );
  }
  cached = createBrowserClient(url, anon);
  return cached;
}
