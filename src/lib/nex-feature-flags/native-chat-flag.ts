// src/lib/nex-feature-flags/native-chat-flag.ts
//
// NEX · Batch 1 Closure feature flag · NEX_NATIVE_CHAT_ENABLED · 2026-09-17.
//
// Deterministic on/off switch that controls whether the consumer NEX Chat UI
// posts to the native NEX1 conversation gateway (`/api/nex-chat/gateway` →
// runChatTurn → shared ConversationHead) or the legacy consumer route
// (`/api/nex-conv/chat` · LLM-backed via src/lib/nex/brain/*).
//
// PRECEDENCE (highest first):
//   1. `localStorage.nex_native_chat_enabled === "true"|"false"`  (client only)
//   2. `process.env.NEXT_PUBLIC_NEX_NATIVE_CHAT_ENABLED === "true"|"false"`
//   3. `process.env.NEX_NATIVE_CHAT_ENABLED === "true"|"false"`   (server only)
//   4. default: false  (legacy path)
//
// INVARIANTS:
//   · No silent fallback: when the flag is TRUE and the native path fails,
//     the failure is surfaced verbatim (with execution_source) — the UI
//     does NOT retry the legacy path.
//   · When the flag is FALSE the legacy consumer path is unchanged.
//
// Zero LLM · zero network · zero fabrication.

const CLIENT_STORAGE_KEY = "nex_native_chat_enabled";
const PUBLIC_ENV_KEY = "NEXT_PUBLIC_NEX_NATIVE_CHAT_ENABLED";
const SERVER_ENV_KEY = "NEX_NATIVE_CHAT_ENABLED";

function parseBool(v: unknown): boolean | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return null;
}

/** Returns `true` when the native chat route should be used. */
export function isNativeChatEnabled(): boolean {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(CLIENT_STORAGE_KEY);
      const parsed = parseBool(raw);
      if (parsed !== null) return parsed;
    } catch {
      // localStorage not available (SSR / private mode) — fall through.
    }
    const pub = parseBool((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[PUBLIC_ENV_KEY]);
    if (pub !== null) return pub;
    return false;
  }
  const pub = parseBool(process.env[PUBLIC_ENV_KEY]);
  if (pub !== null) return pub;
  const priv = parseBool(process.env[SERVER_ENV_KEY]);
  if (priv !== null) return priv;
  return false;
}

/** Diagnostic label describing where the current setting came from.
 *  Useful for the UI to display "flag=on (via localStorage)" etc. */
export function nativeChatFlagSource(): string {
  if (typeof window !== "undefined") {
    try {
      if (parseBool(window.localStorage.getItem(CLIENT_STORAGE_KEY)) !== null) {
        return "localStorage";
      }
    } catch {
      /* ignore */
    }
    if (parseBool((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[PUBLIC_ENV_KEY]) !== null) {
      return "public_env";
    }
    return "default_false";
  }
  if (parseBool(process.env[PUBLIC_ENV_KEY]) !== null) return "public_env";
  if (parseBool(process.env[SERVER_ENV_KEY]) !== null) return "server_env";
  return "default_false";
}

/** Test / developer override. No production callers. */
export function _setNativeChatEnabledForClient(v: boolean | null): void {
  if (typeof window === "undefined") return;
  try {
    if (v === null) window.localStorage.removeItem(CLIENT_STORAGE_KEY);
    else window.localStorage.setItem(CLIENT_STORAGE_KEY, v ? "true" : "false");
  } catch {
    /* ignore */
  }
}
