"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, CheckCheck, Check } from "lucide-react";

type Message = {
  id: string;
  body: string;
  sender_party_id: string;
  sender_side: "entity_member" | "trade" | "system";
  created_at: string;
  attachment_url: string | null;
};

type Fetched = {
  ok: boolean;
  conversationId?: string;
  myRole?: "entity_member" | "trade";
  myPartyId?: string;
  otherLastRead?: string | null;
  messages?: Message[];
  engagement?: { id: string; hired_display_name: string };
};

export function ConversationView({
  engagementId,
  otherLabel
}: {
  engagementId: string;
  otherLabel: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myPartyId, setMyPartyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/conversations/engagement/${engagementId}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as Fetched;
      if (!res.ok || !data.ok) {
        setError("Could not open this thread.");
        return;
      }
      setMyPartyId(data.myPartyId ?? null);
      setMessages(data.messages ?? []);
      setOtherLastRead(data.otherLastRead ?? null);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    // Scroll to bottom on new messages.
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/conversations/engagement/${engagementId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: draft })
        }
      );
      const data = (await res.json()) as {
        ok: boolean;
        message?: Message;
      };
      if (res.ok && data.ok && data.message) {
        setMessages((prev) => [...prev, data.message!]);
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/50" aria-hidden />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-100">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <div
        ref={listRef}
        className="flex max-h-[520px] min-h-[280px] flex-col gap-3 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <p className="my-auto text-center text-[13px] text-white/50">
            No messages yet — say hello to {otherLabel}.
          </p>
        ) : null}
        {messages.map((m) => {
          const mine = myPartyId != null && m.sender_party_id === myPartyId;
          const seen =
            mine &&
            otherLastRead != null &&
            new Date(otherLastRead).getTime() >= new Date(m.created_at).getTime();
          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-[1.45] ${
                  mine
                    ? "rounded-br-md bg-amber-400 text-neutral-900"
                    : "rounded-bl-md border border-white/10 bg-white/10 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
              <div
                className={`mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${
                  mine ? "text-amber-300/70" : "text-white/40"
                }`}
              >
                {new Date(m.created_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
                {mine ? (
                  seen ? (
                    <CheckCheck
                      className="h-3 w-3 text-emerald-400"
                      aria-label="Read"
                    />
                  ) : (
                    <Check className="h-3 w-3" aria-label="Sent" />
                  )
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-white/10 bg-neutral-950/40 p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${otherLabel}…`}
          maxLength={5000}
          className="min-h-[44px] flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-[14px] text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-neutral-900 hover:bg-amber-300 disabled:opacity-40"
          aria-label="Send"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </form>
    </div>
  );
}
