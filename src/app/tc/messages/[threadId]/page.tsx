// /tc/messages/[threadId] — single conversation view.
//
// Header: other participant + context chip + WhatsApp shortcut (if
// exposed). Scrollable message list. Compose form pinned to the bottom
// (mobile-first).

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  Package,
  Building2,
  Briefcase,
  MessageCircle as MC
} from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { MessageBubble } from "@/apps/messages/components/MessageBubble";
import { ComposeForm } from "@/apps/messages/components/ComposeForm";
import {
  findThread,
  messagesForThread,
  otherParticipant,
  whatsappLinkFor,
  type Message
} from "@/apps/messages/data/threads";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const viewer = currentViewerTrade();
  const thread = params?.threadId ? findThread(params.threadId) : undefined;
  const [appended, setAppended] = useState<Message[]>([]);

  const initial = useMemo(() => (thread ? messagesForThread(thread.id) : []), [thread]);
  const all = useMemo(() => [...initial, ...appended], [initial, appended]);

  if (!thread) return notFound();
  const other = otherParticipant(thread, viewer.slug);
  if (!other) return notFound();

  const CtxIcon =
    thread.context?.kind === "product"
      ? Package
      : thread.context?.kind === "merchant"
        ? Building2
        : thread.context?.kind === "job"
          ? Briefcase
          : MC;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 py-4 md:px-4 md:py-6">
        {/* Back link */}
        <Link
          href="/tc/messages"
          className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Inbox
        </Link>

        {/* Thread header card */}
        <section
          className="mb-3 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              aria-hidden
            >
              {other.initials}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-black text-neutral-900">{other.name}</div>
              {thread.context && (
                <Link
                  href={thread.context.href ?? "#"}
                  className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[10.5px] font-bold text-neutral-700 hover:bg-neutral-200"
                >
                  <CtxIcon size={10}/>
                  <span className="line-clamp-1">{thread.context.label}</span>
                </Link>
              )}
            </div>
          </div>

          {/* WhatsApp shortcut — only when merchant has it exposed */}
          {thread.merchantWhatsAppExposed && thread.merchantWhatsAppE164 && (
            <a
              href={whatsappLinkFor(thread.merchantWhatsAppE164, `Hi — following up on our Trade Center chat about ${thread.context?.label ?? "your store"}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm md:self-auto"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              title="Opens WhatsApp. Trade Center never sees the conversation itself — just logs that you moved to WA."
            >
              <MessageCircle size={12}/>
              Continue on WhatsApp
              <ExternalLink size={10}/>
            </a>
          )}
        </section>

        {/* Message list */}
        <div
          className="flex-1 rounded-xl border bg-[#FBF6EC] p-3 shadow-sm md:p-4"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ul className="flex flex-col gap-3">
            {all.map((m) => {
              const isSelf = m.authorSlug === viewer.slug;
              const authorName = isSelf ? viewer.displayName : other.name;
              const authorInitials = isSelf ? viewer.headshotInitials : other.initials;
              return (
                <li key={m.id}>
                  <MessageBubble
                    message={m}
                    isSelf={isSelf}
                    authorName={authorName}
                    authorInitials={authorInitials}
                  />
                </li>
              );
            })}
          </ul>
        </div>

        {/* Compose */}
        <div
          className="mt-3 overflow-hidden rounded-xl border shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ComposeForm
            threadId={thread.id}
            viewerSlug={viewer.slug}
            onSend={(m) => setAppended((prev) => [...prev, m])}
          />
        </div>
      </main>
    </div>
  );
}
