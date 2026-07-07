// Kanban-style pipeline: Ready to quote → Draft → Sent → Viewed → Won / Lost.

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type ReadyItem = {
  renderId: string;
  projectId: string | null;
  specificationId: string | null;
  leafSlug: string;
  renderUrl: string | null;
  homeownerId: string | null;
  homeownerName: string;
  postcode: string;
};

type QuoteRow = {
  id: string;
  title: string;
  status: string;
  totalPence: number;
  sentAt: string | null;
  firstViewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  homeownerName: string;
  postcode: string;
};

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function QuotePipeline({
  readyToQuote,
  quotes
}: {
  readyToQuote: ReadyItem[];
  quotes: QuoteRow[];
}) {
  const [draftingRenderId, setDraftingRenderId] = useState<string | null>(null);

  async function draftFromRender(renderId: string) {
    setDraftingRenderId(renderId);
    try {
      const res = await fetch("/api/apps/quote-workspace/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ renderId })
      });
      const data: { ok: boolean; quote?: { id: string }; error?: string } =
        await res.json();
      if (data.ok && data.quote?.id) {
        window.location.href = `/site-office/apps/quote-workspace/${data.quote.id}`;
        return;
      }
      alert(data.error || "Could not draft quote.");
    } finally {
      setDraftingRenderId(null);
    }
  }

  const drafts = quotes.filter((q) => q.status === "draft");
  const sent = quotes.filter((q) => q.status === "sent");
  const viewed = quotes.filter((q) => q.status === "viewed");
  const accepted = quotes.filter((q) => q.status === "accepted");
  const rejected = quotes.filter((q) => q.status === "rejected");
  const expired = quotes.filter(
    (q) => q.status === "expired" || (q.expiresAt && new Date(q.expiresAt) < new Date() && ["sent", "viewed"].includes(q.status))
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Column icon={Sparkles} title="Ready to quote" count={readyToQuote.length}>
        {readyToQuote.length === 0 ? (
          <EmptyNote>Renders with a specification will appear here.</EmptyNote>
        ) : (
          readyToQuote.map((r) => (
            <SurfaceCard key={r.renderId} variant="primary" padding="none" className="overflow-hidden">
              {r.renderUrl ? (
                <img src={r.renderUrl} alt="" className="h-32 w-full object-cover" />
              ) : null}
              <div className="p-3">
                <div className="text-[13px] font-semibold text-neutral-900">
                  {r.homeownerName}
                </div>
                <div className="text-[13px] text-neutral-500">
                  {r.leafSlug.replace(/_/g, " ")} · {r.postcode}
                </div>
                <button
                  type="button"
                  onClick={() => draftFromRender(r.renderId)}
                  disabled={draftingRenderId !== null}
                  className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {draftingRenderId === r.renderId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Draft quote
                </button>
              </div>
            </SurfaceCard>
          ))
        )}
      </Column>

      <Column icon={FileText} title="In progress" count={drafts.length + sent.length + viewed.length}>
        {[...drafts, ...sent, ...viewed].map((q) => (
          <QuoteCard key={q.id} q={q} />
        ))}
        {drafts.length + sent.length + viewed.length === 0 ? (
          <EmptyNote>Drafts + sent quotes land here.</EmptyNote>
        ) : null}
      </Column>

      <Column icon={CheckCircle2} title="Closed" count={accepted.length + rejected.length + expired.length}>
        {accepted.map((q) => (
          <QuoteCard key={q.id} q={q} tint="success" />
        ))}
        {rejected.map((q) => (
          <QuoteCard key={q.id} q={q} tint="danger" />
        ))}
        {expired.map((q) => (
          <QuoteCard key={q.id} q={q} tint="warning" />
        ))}
        {accepted.length + rejected.length + expired.length === 0 ? (
          <EmptyNote>Won / lost / expired quotes will show here.</EmptyNote>
        ) : null}
      </Column>
    </div>
  );
}

function Column({
  icon: Icon,
  title,
  count,
  children
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {title}
        </div>
        <span className="text-[13px] text-neutral-500">{count}</span>
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function QuoteCard({
  q,
  tint = "neutral"
}: {
  q: QuoteRow;
  tint?: "neutral" | "success" | "warning" | "danger";
}) {
  const statusIcon =
    q.status === "sent" ? (
      <Send className="h-3.5 w-3.5" aria-hidden />
    ) : q.status === "viewed" ? (
      <Eye className="h-3.5 w-3.5" aria-hidden />
    ) : q.status === "accepted" ? (
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
    ) : q.status === "rejected" ? (
      <XCircle className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <FileText className="h-3.5 w-3.5" aria-hidden />
    );

  const variant =
    tint === "success"
      ? "success"
      : tint === "warning"
        ? "warning"
        : tint === "danger"
          ? "danger"
          : "primary";

  return (
    <Link href={`/site-office/apps/quote-workspace/${q.id}`}>
      <SurfaceCard variant={variant} padding="md" interactive>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[14px] font-semibold text-neutral-900">
            {q.title}
          </div>
          <div className="text-[14px] font-bold">{gbp(q.totalPence)}</div>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-neutral-500 capitalize">
          {statusIcon}
          {q.status}
        </div>
        <div className="mt-1 text-[13px] text-neutral-500">
          {q.homeownerName}
          {q.postcode ? ` · ${q.postcode}` : ""}
        </div>
      </SurfaceCard>
    </Link>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <SurfaceCard variant="secondary" padding="md">
      <p className="text-[13px] text-neutral-500">{children}</p>
    </SurfaceCard>
  );
}
