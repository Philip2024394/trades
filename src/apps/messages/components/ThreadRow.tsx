// One row in the /tc/messages inbox. Shows other participant + context
// chip + preview + unread badge + time.

import Link from "next/link";
import { Package, Building2, Briefcase, MessageCircle } from "lucide-react";
import type { MessageThread, Participant } from "../data/threads";

type Props = {
  thread: MessageThread;
  other: Participant;
};

function timeShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function contextIcon(kind: MessageThread["context"] extends infer C ? C extends { kind: infer K } ? K : never : never) {
  switch (kind) {
    case "product":  return Package;
    case "merchant": return Building2;
    case "job":      return Briefcase;
    case "general":  return MessageCircle;
  }
}

export function ThreadRow({ thread, other }: Props) {
  const CtxIcon = thread.context ? contextIcon(thread.context.kind) : MessageCircle;
  const hasUnread = thread.unreadCountForViewer > 0;

  return (
    <li>
      <Link
        href={`/tc/messages/${thread.id}`}
        className="flex min-h-[72px] items-start gap-3 rounded-lg px-3 py-3 transition hover:bg-neutral-50"
      >
        {/* Avatar */}
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          aria-hidden
        >
          {other.initials}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="min-w-0 truncate text-[13px] font-black text-neutral-900">
              {other.name}
            </div>
            <div className="ml-auto flex-shrink-0 text-[10.5px] text-neutral-500">
              {timeShort(thread.lastMessageAtIso)}
            </div>
          </div>
          {thread.context && (
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600">
              <CtxIcon size={9}/>
              <span className="line-clamp-1">{thread.context.label}</span>
            </div>
          )}
          <div className={`mt-1 line-clamp-2 text-[11.5px] leading-snug ${hasUnread ? "font-black text-neutral-900" : "text-neutral-600"}`}>
            {thread.lastMessagePreview}
          </div>
        </div>

        {/* Unread pip */}
        {hasUnread && (
          <span
            className="mt-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            {thread.unreadCountForViewer}
          </span>
        )}
      </Link>
    </li>
  );
}
