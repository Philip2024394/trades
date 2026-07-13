// /tc/messages — Trade Center native inbox.
//
// Threads grouped by activity (most recent first). Each row shows the
// other participant, context chip (product / merchant / job), preview,
// and unread badge. Deep-linked from the marketplace header Messages
// icon and every merchant/product page Message Seller CTA.

import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { ThreadRow } from "@/apps/messages/components/ThreadRow";
import {
  threadsForViewer,
  otherParticipant
} from "@/apps/messages/data/threads";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export const dynamic = "force-dynamic";

export default function MessagesInboxPage() {
  const viewer = currentViewerTrade();
  const threads = threadsForViewer(viewer.slug);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <header className="mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Messages
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            <MessageSquare size={24}/>
            Inbox
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Every conversation about your quotes, products, and jobs — kept as your record.
            Merchants who&apos;ve exposed their WhatsApp have a shortcut on their profile too.
          </p>
        </header>

        {/* Layout: threads list + empty state */}
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside
            className="flex flex-col gap-2 rounded-xl border bg-white p-2 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="p-2">
              <label
                className="flex min-h-[44px] items-center gap-2 rounded-md border bg-neutral-50 px-3"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <Search size={13} className="text-neutral-500"/>
                <input
                  type="text"
                  placeholder="Search messages"
                  className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400"
                />
              </label>
            </div>
            <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              {threads.length === 0 && (
                <li className="p-6 text-center text-[11.5px] text-neutral-500">
                  No conversations yet. Message a merchant from their profile or a product page to start one.
                </li>
              )}
              {threads.map((t) => {
                const other = otherParticipant(t, viewer.slug);
                if (!other) return null;
                return <ThreadRow key={t.id} thread={t} other={other}/>;
              })}
            </ul>
          </aside>

          {/* Right column: pick-a-thread hint (desktop) / hidden on mobile */}
          <section
            className="hidden min-h-[400px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center lg:flex"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <MessageSquare size={32} strokeWidth={1.5} className="text-neutral-400"/>
            <div className="text-[13px] font-black text-neutral-900">Pick a thread on the left</div>
            <p className="max-w-md text-[11.5px] leading-snug text-neutral-500">
              Every message is your record. Quotes, invoices, product links, and job attachments live inside
              each thread — searchable and exportable.
            </p>
            <Link
              href="/tc/trade-center/plastering"
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              Browse marketplace
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
