// Compose form for a message thread. Client component with local state
// — persists to fixtures via setLocalMessages callback so the parent
// thread view can render appended messages instantly.

"use client";

import { useRef, useState } from "react";
import { Send, Paperclip } from "lucide-react";
import type { Message } from "../data/threads";

type Props = {
  threadId: string;
  viewerSlug: string;
  onSend: (m: Message) => void;
};

export function ComposeForm({ threadId, viewerSlug, onSend }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const msg: Message = {
      id: `m-local-${Date.now()}`,
      threadId,
      authorSlug: viewerSlug,
      body,
      sentAtIso: new Date().toISOString()
    };
    onSend(msg);
    setText("");
    ref.current?.focus();
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t bg-white p-3"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <button
        type="button"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
        aria-label="Attach"
        title="Attach a product, quote, or file"
      >
        <Paperclip size={16}/>
      </button>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message"
        rows={1}
        className="min-h-[44px] flex-1 resize-none rounded-2xl border bg-white px-4 py-2.5 text-[13px] outline-none focus:border-neutral-500"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit(e);
          }
        }}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="flex h-11 min-w-[44px] flex-shrink-0 items-center justify-center gap-1 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-40"
        style={{ backgroundColor: "#166534" }}
      >
        <Send size={14}/>
        <span className="hidden sm:inline">Send</span>
      </button>
    </form>
  );
}
