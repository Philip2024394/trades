// Chat bubble — single message rendered in a thread view.
//
// Rich message types are first-class citizens: attached product cards,
// merchant cards, job links, and quote panels render inline so replies
// stay anchored to context. This is what makes Trade Center chat
// materially better than WhatsApp for trade work.

import Link from "next/link";
import { CheckCircle2, Package, Building2, Briefcase, Receipt } from "lucide-react";
import { PRODUCT_FIXTURES } from "@/apps/marketplace/data/products";
import { findMerchant } from "@/apps/marketplace/data/merchants";
import { findJob } from "@/apps/jobs/data/jobs";
import type { Message, MessageAttachment } from "../data/threads";

type Props = {
  message: Message;
  isSelf: boolean;
  authorName: string;
  authorInitials: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isSelf, authorName, authorInitials }: Props) {
  const bubbleBg = isSelf ? "#166534" : "#FFFFFF";
  const bubbleFg = isSelf ? "#FFFFFF" : "#0A0A0A";
  const bubbleBorder = isSelf ? "transparent" : "rgba(139,69,19,0.15)";

  return (
    <div className={`flex items-end gap-2 ${isSelf ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
        style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        title={authorName}
        aria-hidden
      >
        {authorInitials}
      </div>

      {/* Bubble */}
      <div className={`flex max-w-[80%] flex-col gap-1 ${isSelf ? "items-end" : "items-start"}`}>
        <div
          className="rounded-2xl border px-3 py-2 text-[12.5px] leading-relaxed shadow-sm"
          style={{
            backgroundColor: bubbleBg,
            color: bubbleFg,
            borderColor: bubbleBorder,
            borderTopLeftRadius: isSelf ? undefined : 4,
            borderTopRightRadius: isSelf ? 4 : undefined
          }}
        >
          {message.body}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {message.attachments.map((a, i) => (
                <AttachmentCard key={i} attachment={a} inSelfBubble={isSelf}/>
              ))}
            </div>
          )}
        </div>
        <div className="text-[10px] text-neutral-500">
          {formatTime(message.sentAtIso)}
        </div>
      </div>
    </div>
  );
}

function AttachmentCard({
  attachment,
  inSelfBubble
}: {
  attachment: MessageAttachment;
  inSelfBubble: boolean;
}) {
  const cardBg = inSelfBubble ? "rgba(255,255,255,0.12)" : "#F5F0E4";
  const cardFg = inSelfBubble ? "#FFFFFF" : "#0A0A0A";
  const mutedFg = inSelfBubble ? "rgba(255,255,255,0.75)" : "#525252";

  if (attachment.kind === "product") {
    const p = PRODUCT_FIXTURES.find((x) => x.slug === attachment.productSlug);
    if (!p) return null;
    return (
      <Link
        href={`/tc/trade-center/product/${p.slug}`}
        className="flex items-center gap-3 rounded-lg p-2 transition hover:opacity-90"
        style={{ backgroundColor: cardBg }}
      >
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
          ) : (
            <Package size={18} strokeWidth={1.5} className="text-neutral-400"/>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[11.5px] font-black" style={{ color: cardFg }}>
            {p.name}
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: mutedFg }}>
            £{p.priceGbp}
          </div>
        </div>
      </Link>
    );
  }

  if (attachment.kind === "merchant") {
    const m = findMerchant(attachment.merchantSlug);
    if (!m) return null;
    return (
      <Link
        href={`/tc/trade-center/merchant/${m.slug}`}
        className="flex items-center gap-3 rounded-lg p-2 transition hover:opacity-90"
        style={{ backgroundColor: cardBg }}
      >
        <Building2 size={18} style={{ color: cardFg }}/>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-[11.5px] font-black" style={{ color: cardFg }}>
            {m.displayName}
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: mutedFg }}>
            {m.homeCity}
          </div>
        </div>
      </Link>
    );
  }

  if (attachment.kind === "job") {
    const j = findJob(attachment.jobSlug);
    if (!j) return null;
    return (
      <Link
        href={`/tc/jobs/${j.slug}`}
        className="flex items-center gap-3 rounded-lg p-2 transition hover:opacity-90"
        style={{ backgroundColor: cardBg }}
      >
        <Briefcase size={18} style={{ color: cardFg }}/>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-[11.5px] font-black" style={{ color: cardFg }}>
            {j.title}
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: mutedFg }}>
            {j.customerName} · £{j.quoteGbp.toLocaleString()}
          </div>
        </div>
      </Link>
    );
  }

  if (attachment.kind === "quote") {
    return (
      <div
        className="flex items-center gap-3 rounded-lg p-3"
        style={{ backgroundColor: cardBg }}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#FFB300" }}
        >
          <Receipt size={16} strokeWidth={2.5} className="text-neutral-900"/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: mutedFg }}>
            Quote
          </div>
          <div className="mt-0.5 text-[12.5px] font-black" style={{ color: cardFg }}>
            {attachment.label}
          </div>
          <div className="mt-0.5 text-[13px] font-black" style={{ color: cardFg }}>
            £{attachment.totalGbp.toLocaleString()}
          </div>
        </div>
        <CheckCircle2 size={16} style={{ color: cardFg }}/>
      </div>
    );
  }

  return null;
}
