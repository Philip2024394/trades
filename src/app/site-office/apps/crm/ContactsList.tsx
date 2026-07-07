// Merchant contacts list — stage filter tabs + search + rows.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronRight,
  MessageCircle,
  Mail,
  Clock,
  Users
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type Contact = {
  id: string;
  displayName: string;
  email: string | null;
  whatsappE164: string | null;
  postcode: string | null;
  stage: string;
  source: string | null;
  tags: string[];
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
  quietSince: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  engaged: "Engaged",
  quoted: "Quoted",
  won: "Won",
  active: "Active",
  signed_off: "Signed off",
  silent: "Silent",
  lost: "Lost",
  archived: "Archived"
};

const STAGE_TINT: Record<string, string> = {
  new: "bg-neutral-100 text-neutral-800",
  engaged: "bg-blue-100 text-blue-800",
  quoted: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-800",
  active: "bg-emerald-100 text-emerald-800",
  signed_off: "bg-emerald-100 text-emerald-800",
  silent: "bg-orange-100 text-orange-800",
  lost: "bg-neutral-100 text-neutral-500",
  archived: "bg-neutral-100 text-neutral-500"
};

export function ContactsList({
  contacts,
  activeStage,
  stageOrder,
  stageCounts,
  initialQuery
}: {
  contacts: Contact[];
  activeStage: string | null;
  stageOrder: readonly string[];
  stageCounts: Record<string, number>;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return contacts;
    const q = query.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.postcode || "").toLowerCase().includes(q)
    );
  }, [contacts, query]);

  function daysSince(iso: string | null): string | null {
    if (!iso) return null;
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 1) return "today";
    if (days === 1) return "1 day";
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} mo`;
    return `${Math.floor(days / 365)} yr`;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/site-office/apps/crm"
          className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-semibold transition ${
            !activeStage
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
          }`}
        >
          All ({contacts.length})
        </Link>
        {stageOrder.map((s) => {
          const count = stageCounts[s] || 0;
          if (count === 0) return null;
          const active = activeStage === s;
          return (
            <Link
              key={s}
              href={`/site-office/apps/crm?stage=${s}`}
              className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-semibold transition ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {STAGE_LABELS[s] || s} ({count})
            </Link>
          );
        })}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3">
        <Search className="h-4 w-4 text-neutral-500" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, postcode"
          className="min-h-[40px] flex-1 border-0 bg-transparent p-0 text-[14px] outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <SurfaceCard variant="secondary" padding="lg">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-600">
            <Users className="h-4 w-4" aria-hidden />
            No contacts yet
          </div>
          <p className="mt-2 text-[13px] text-neutral-600">
            Contacts appear here automatically as customers land on your
            AI Visualiser, request quotes, or start jobs. No manual
            imports required.
          </p>
        </SurfaceCard>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/site-office/apps/crm/${c.id}`}
                className="flex items-center gap-3 px-3 py-3 hover:bg-neutral-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {c.displayName}
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[13px] font-semibold ${
                        STAGE_TINT[c.stage] || "bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      {STAGE_LABELS[c.stage] || c.stage}
                    </span>
                    {c.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[13px] text-neutral-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-neutral-500">
                    {c.email ? <span>{c.email}</span> : null}
                    {c.whatsappE164 ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" aria-hidden />
                        {c.whatsappE164}
                      </span>
                    ) : null}
                    {c.postcode ? (
                      <span className="font-mono">{c.postcode}</span>
                    ) : null}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right text-[13px] text-neutral-500 md:block">
                  <div className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {daysSince(c.lastActivityAt) || "—"}
                  </div>
                  {c.nextFollowUpAt ? (
                    <div className="text-amber-700">
                      Follow up{" "}
                      {new Date(c.nextFollowUpAt).toLocaleDateString(
                        undefined,
                        { day: "numeric", month: "short" }
                      )}
                    </div>
                  ) : null}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
