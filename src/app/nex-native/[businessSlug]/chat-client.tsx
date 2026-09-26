"use client";

// src/app/nex-native/[businessSlug]/chat-client.tsx
//
// Wave 4N deep · #262 · 2026-09-25.
// -------------------------------------------------------------------------
// Founder directive 2026-09-25: "Do not put authentication in front of
// basic Chat access." The visitor arrives from an Instagram bio, taps
// Chat, and immediately sends a message. NEX creates a real anonymous
// Supabase auth session under the hood, provisions a real nex_account,
// and the message reaches the owner through the SAME conversation
// tables. Later the visitor can promote the anonymous account to a
// full email/password account without losing history (Supabase
// updateUser({email, password}) preserves auth.users.id).
//
// Nothing else changes:
//   · same nex_conversation + nex_message tables
//   · same RLS (auth.uid() populated for anon users)
//   · same /api/nex-native/chat/message route
//   · same NEX identity anchor (nex_account.id)
//   · no phone-as-identity · no internal-id exposure

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface ProductLite {
  id: string;
  name: string;
  price_pence: number;
  currency: string;
}
interface MessageLite {
  id: string;
  sender_account_id: string;
  body: string;
  created_at: string;
}

const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY!;

type AuthState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "anonymous" }
  | { kind: "full" };

export function NexNativeChatClient(props: {
  businessSlug: string;
  businessDisplayName: string;
  products: ProductLite[];
  /**
   * When provided, the product picker starts on this product id.
   * Used by /nex-native/product/[productId] so the visitor doesn't
   * have to re-select the product they just clicked into.
   * The picker remains user-editable — visitor can still switch to
   * "general" or another product if they choose. Product context is
   * persisted honestly via nex_conversation.about_product_id.
   */
  initialSelectedProductId?: string;
}) {
  const supabase = useMemo(() => createBrowserClient(url, anonKey), []);
  const [authState, setAuthState] = useState<AuthState>({ kind: "loading" });
  const [selectedProductId, setSelectedProductId] = useState<string | "">(
    props.initialSelectedProductId ?? "",
  );
  const [messages, setMessages] = useState<MessageLite[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [account, setAccount] = useState<{ id: string; display_name: string } | null>(null);
  const [outgoing, setOutgoing] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [replyTimedOut, setReplyTimedOut] = useState(false);

  // Promotion (anon → full account) UI state
  const [showPromote, setShowPromote] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promotePassword, setPromotePassword] = useState("");
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState(false);

  const classifyUser = useCallback(
    (user: { is_anonymous?: boolean; user_metadata?: { is_nex_visitor?: boolean } | null } | null): AuthState => {
      if (!user) return { kind: "signed_out" };
      const isSupabaseAnon = user.is_anonymous === true;
      const isServerVisitor = Boolean(user.user_metadata?.is_nex_visitor);
      return isSupabaseAnon || isServerVisitor ? { kind: "anonymous" } : { kind: "full" };
    },
    [],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthState(classifyUser(data.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthState(classifyUser(session?.user ?? null));
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, classifyUser]);

  const fetchMessages = useCallback(async () => {
    setSendError(null);
    const qs = new URLSearchParams({ businessSlug: props.businessSlug });
    if (selectedProductId) qs.set("productId", selectedProductId);
    const res = await fetch(`/api/nex-native/chat/message?${qs}`, { credentials: "include" });
    if (!res.ok) {
      const t = await res.text();
      setSendError(`fetch failed · ${res.status} · ${t.slice(0, 120)}`);
      return;
    }
    const j = await res.json();
    setMessages(j.messages ?? []);
    setConversationId(j.conversation_id ?? null);
    if (j.account) setAccount(j.account);
  }, [props.businessSlug, selectedProductId]);

  useEffect(() => {
    if (authState.kind === "anonymous" || authState.kind === "full") void fetchMessages();
  }, [authState.kind, fetchMessages]);

  // Auto-poll for NEX Assistant replies (unchanged from prior implementation)
  useEffect(() => {
    if (!awaitingReply) return;
    setReplyTimedOut(false);
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > 90_000) {
        clearInterval(timer);
        setAwaitingReply(false);
        setReplyTimedOut(true);
        return;
      }
      await fetchMessages();
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingReply]);

  useEffect(() => {
    if (!awaitingReply || !account) return;
    const last = messages[messages.length - 1];
    if (last && last.sender_account_id !== account.id) {
      setAwaitingReply(false);
      setReplyTimedOut(false);
    }
  }, [messages, account, awaitingReply]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!outgoing.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const isVisitorFirstSend = authState.kind === "signed_out";
      const endpoint = isVisitorFirstSend
        ? "/api/nex-native/chat/visitor-first-message"
        : "/api/nex-native/chat/message";
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessSlug: props.businessSlug,
          productId: selectedProductId || null,
          body: outgoing.trim(),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        setSendError(`send failed · ${res.status} · ${t.slice(0, 200)}`);
        return;
      }
      const j = await res.json();
      if (j.queued_reply && j.queued_reply.admitted === false && j.queued_reply.reason) {
        setSendError(`Nex reply queue full · ${j.queued_reply.reason}${
          j.queued_reply.retry_after_seconds ? ` · retry in ${j.queued_reply.retry_after_seconds}s` : ""
        }`);
      }
      setOutgoing("");
      // Update local state from response · handles both first-send
      // (which returns the message directly) and subsequent sends
      // (which return via fetchMessages).
      if (j.account) setAccount(j.account);
      if (j.conversation_id) setConversationId(j.conversation_id);
      await fetchMessages();
      if (j.queued_reply && j.queued_reply.admitted === true) {
        setAwaitingReply(true);
      }
      // If this was the first visitor message, propagate the session
      // into supabase-js AFTER the send + refetch have completed. This
      // triggers onAuthStateChange and flips the UI to "anonymous" without
      // racing the send.
      if (isVisitorFirstSend && j.session?.access_token && j.session?.refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: j.session.access_token,
          refresh_token: j.session.refresh_token,
        });
        if (setErr) {
          console.warn("[NEX chat] deferred setSession failed", setErr.message);
        }
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMessages([]);
    setConversationId(null);
    setAccount(null);
    setShowPromote(false);
    setPromoteSuccess(false);
  }

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault();
    setPromoteError(null);
    if (!promoteEmail || promotePassword.length < 6) {
      setPromoteError("Enter an email and a password (min 6 chars).");
      return;
    }
    setPromoteBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: promoteEmail,
        password: promotePassword,
      });
      if (error) {
        setPromoteError(error.message);
        return;
      }
      setPromoteSuccess(true);
      setShowPromote(false);
      // onAuthStateChange will flip is_anonymous=false shortly.
    } finally {
      setPromoteBusy(false);
    }
  }

  if (authState.kind === "loading") {
    return <p className="text-sm text-neutral-500">Loading session…</p>;
  }

  const showSaveNudge = authState.kind === "anonymous" && messages.length > 0 && !promoteSuccess;

  return (
    <div className="rounded border border-neutral-300 bg-white p-3" data-nex-chat-panel>
      {authState.kind === "full" && (
        <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2 text-xs text-neutral-500">
          <div>
            Signed in as <span className="font-medium text-neutral-800">{account?.display_name ?? "…"}</span>
            {conversationId && (
              <>
                {" "}· conv <code className="font-mono">{conversationId.slice(0, 8)}…</code>
              </>
            )}
          </div>
          <button onClick={handleSignOut} className="text-xs text-neutral-500 underline">
            sign out
          </button>
        </div>
      )}

      {authState.kind === "anonymous" && (
        <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2 text-[11px] text-[var(--nex-neutral-500)]">
          <span data-nex-anonymous-badge>
            Chatting as a visitor · your message reaches {props.businessDisplayName}
          </span>
        </div>
      )}

      {props.products.length > 0 && (
        <label className="mb-2 block text-xs text-neutral-600">
          About product
          <select
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">— general (no specific product) —</option>
            {props.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.currency} {(p.price_pence / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mb-2 max-h-72 overflow-y-auto rounded bg-neutral-50 p-2">
        {messages.length === 0 ? (
          <p className="py-2 text-center text-xs text-neutral-500">
            Send the first message to {props.businessDisplayName}. No account required to start.
          </p>
        ) : (
          <ul className="space-y-1">
            {messages.map((m) => {
              const own = account?.id === m.sender_account_id;
              return (
                <li
                  key={m.id}
                  className={`flex ${own ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded px-2 py-1 text-sm ${
                      own
                        ? "bg-neutral-900 text-white"
                        : "bg-white text-neutral-900 border border-neutral-200"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div className={`mt-0.5 text-[10px] ${own ? "text-neutral-300" : "text-neutral-400"}`}>
                      {new Date(m.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {sendError && (
        <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800" data-nex-chat-error>
          {sendError}
        </p>
      )}

      {awaitingReply && (
        <p className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-500" />
          Nex is thinking…
        </p>
      )}

      {replyTimedOut && !awaitingReply && (
        <div className="mb-2 flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>Nex is taking longer than usual · check back in a moment, or send again.</span>
          <button
            type="button"
            onClick={() => {
              setReplyTimedOut(false);
              void fetchMessages();
            }}
            className="inline-flex min-h-[36px] items-center justify-center self-start rounded bg-amber-200 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-300 sm:self-auto"
          >
            Refresh
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2" data-nex-chat-compose>
        <input
          type="text"
          value={outgoing}
          onChange={(e) => setOutgoing(e.target.value)}
          placeholder={`Message ${props.businessDisplayName}…`}
          maxLength={4000}
          className="min-h-[44px] flex-1 rounded border border-neutral-300 px-2 py-2 text-sm"
          data-nex-chat-input
        />
        <button
          type="submit"
          disabled={!outgoing.trim() || sending}
          aria-busy={sending}
          className="inline-flex min-h-[44px] items-center justify-center rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-50"
          data-nex-chat-send
        >
          {sending && (
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden />
          )}
          {sending ? "Sending…" : "Send"}
        </button>
      </form>

      {showSaveNudge && (
        <div
          className="mt-3 rounded-lg border border-[var(--nex-accent-100)] bg-[var(--nex-accent-50)] p-3 text-xs text-[var(--nex-neutral-800)]"
          data-nex-save-nudge
        >
          {!showPromote ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong className="text-[var(--nex-accent-700)]">Save this conversation</strong> ·
                add an email and password so you can come back to it from any device.
              </span>
              <button
                type="button"
                onClick={() => setShowPromote(true)}
                className="inline-flex min-h-[36px] items-center rounded bg-[var(--nex-accent-600)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--nex-accent-700)]"
                data-nex-save-open
              >
                Save
              </button>
            </div>
          ) : (
            <form onSubmit={handlePromote} className="flex flex-col gap-2" data-nex-save-form>
              <label className="block text-[11px] text-neutral-600">
                Email
                <input
                  type="email"
                  required
                  value={promoteEmail}
                  onChange={(e) => setPromoteEmail(e.target.value)}
                  className="mt-1 block min-h-[40px] w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-[11px] text-neutral-600">
                Password (min 6 chars)
                <input
                  type="password"
                  required
                  minLength={6}
                  value={promotePassword}
                  onChange={(e) => setPromotePassword(e.target.value)}
                  className="mt-1 block min-h-[40px] w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              {promoteError && (
                <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-800">{promoteError}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={promoteBusy}
                  className="inline-flex min-h-[36px] items-center rounded bg-[var(--nex-accent-600)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--nex-accent-700)] disabled:opacity-50"
                >
                  {promoteBusy ? "Saving…" : "Save conversation"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPromote(false)}
                  className="text-[11px] text-neutral-500 underline"
                >
                  cancel
                </button>
              </div>
              <p className="text-[10px] text-neutral-500">
                Your conversation and identity are preserved · we upgrade this visitor session in-place.
              </p>
            </form>
          )}
        </div>
      )}

      {promoteSuccess && authState.kind === "full" && (
        <p
          className="mt-3 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800"
          role="status"
        >
          Conversation saved · sign in with your email + password anytime to continue.
        </p>
      )}
    </div>
  );
}
