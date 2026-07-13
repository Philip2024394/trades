// Platform Widget Tile — canonical shell renderer.
//
// Every App contributes a WidgetPayload; the shell owns how they
// render. Same reason Slack channel rows look identical regardless of
// which integration produces them.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DiscoveredWidget } from "@/platform/widgets/discovery";
import type { WidgetPayload, WidgetChip } from "@/platform/widgets/runtime";

function chipStyle(kind: WidgetChip["kind"]): {
  bg: string;
  fg: string;
} {
  switch (kind) {
    case "count":
      return { bg: "#F5F0E4", fg: "#0A0A0A" };
    case "distance":
      return { bg: "#DBEAFE", fg: "#1E40AF" };
    case "money":
      return { bg: "#DCFCE7", fg: "#166534" };
    case "eta":
      return { bg: "#FEF3C7", fg: "#78350F" };
    case "info":
      return { bg: "#F5F0E4", fg: "#525252" };
    case "warn":
      return { bg: "#FEE2E2", fg: "#DC2626" };
    case "good":
      return { bg: "#DCFCE7", fg: "#166534" };
  }
}

type Props = {
  widget: DiscoveredWidget;
  payload: WidgetPayload;
};

export function WidgetTile({ widget, payload }: Props) {
  const hasContent =
    (payload.chips && payload.chips.length > 0) ||
    (payload.rows && payload.rows.length > 0);

  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Header — App identity + widget label */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
            {widget.appName}
          </div>
          <div className="text-[13px] font-black text-neutral-900">
            {widget.label}
          </div>
        </div>
        {payload.href && (
          <Link
            href={payload.href}
            className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="See all"
          >
            <ChevronRight size={14}/>
          </Link>
        )}
      </div>

      {/* Headline */}
      {payload.headline && (
        <div className="mb-2 text-[12.5px] leading-snug text-neutral-700">
          {payload.headline}
        </div>
      )}

      {/* Chips */}
      {payload.chips && payload.chips.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {payload.chips.map((c, i) => {
            const style = chipStyle(c.kind);
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black"
                style={{ backgroundColor: style.bg, color: style.fg }}
              >
                {c.label}
                {c.value !== undefined && (
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9.5px]">
                    {c.value}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Rows */}
      {payload.rows && payload.rows.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {payload.rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold text-neutral-800">
                  {r.title}
                </div>
                {r.subtitle && (
                  <div className="truncate text-[10.5px] text-neutral-500">
                    {r.subtitle}
                  </div>
                )}
              </div>
              {r.trailing && (
                <span className="whitespace-nowrap text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                  {r.trailing}
                </span>
              )}
              {r.href && (
                <Link
                  href={r.href}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label={`Open ${r.title}`}
                >
                  <ChevronRight size={12}/>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="rounded-md bg-neutral-50 p-3 text-center text-[11.5px] text-neutral-500">
          {payload.emptyLabel ?? "Nothing to show right now."}
        </div>
      )}
    </article>
  );
}
