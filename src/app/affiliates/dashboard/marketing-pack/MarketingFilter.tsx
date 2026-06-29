"use client";

// Filter chip row for the affiliate marketing-pack. Client island so the
// active filter highlights without a full server round-trip; we still
// drive the URL via ?filter= so the server-side query stays the source
// of truth for which assets render.
import Link from "next/link";

type Filter = { id: string; label: string; kinds: string[] };

export function MarketingFilter({
  filters,
  active
}: {
  filters: Filter[];
  active: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => {
        const href = f.id === "all" ? "?" : `?filter=${f.id}`;
        const isActive = f.id === active;
        return (
          <Link
            key={f.id}
            href={href}
            scroll={false}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
              isActive
                ? "bg-brand-accent text-black"
                : "border border-brand-line bg-brand-surface text-brand-text hover:bg-brand-line"
            }`}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
