// ListView — vertical item list. The universal pattern for showing
// items with an icon + title + subtitle + optional trailing meta or
// action.
//
// Used everywhere: leads list, orders list, notifications, quick
// pickers, settings menus.

import { ChevronRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export type ListViewItem = {
  key: string;
  title: string;
  subtitle?: string;
  /** Small metadata line below subtitle. */
  meta?: string;
  /** Left-side icon component OR custom node (Avatar). */
  leading?: ComponentType<{ className?: string }> | ReactNode;
  /** Right-side content — status chip, timestamp, badge. */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Visual state hint. */
  selected?: boolean;
};

export type ListViewProps = {
  items: readonly ListViewItem[];
  /** Density — controls padding. */
  density?: "comfy" | "compact";
  /** Show dividers between items. */
  divided?: boolean;
  className?: string;
  /** Rendered when items is empty. */
  emptyState?: ReactNode;
};

function renderLeading(
  leading: ListViewItem["leading"]
): ReactNode {
  if (!leading) return null;
  if (typeof leading === "function") {
    const Icon = leading as ComponentType<{ className?: string }>;
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
        <Icon className="h-4 w-4" />
      </div>
    );
  }
  return <div className="shrink-0">{leading}</div>;
}

export function ListView({
  items,
  density = "comfy",
  divided = true,
  className = "",
  emptyState
}: ListViewProps) {
  if (!items.length && emptyState) {
    return <>{emptyState}</>;
  }
  const paddingCls = density === "compact" ? "px-3 py-2" : "px-3 py-3";
  return (
    <ul
      className={`overflow-hidden rounded-xl border border-neutral-200 bg-white md:rounded-2xl ${className}`.trim()}
    >
      {items.map((item, i) => {
        const interactive = item.href || item.onClick;
        const rowCls = `flex items-center gap-3 ${paddingCls} ${
          divided && i > 0 ? "border-t border-neutral-100" : ""
        } ${
          item.selected
            ? "bg-neutral-50"
            : interactive
            ? "hover:bg-neutral-50"
            : ""
        } ${interactive ? "min-h-[52px] cursor-pointer" : "min-h-[44px]"}`;
        const inner = (
          <>
            {renderLeading(item.leading)}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium text-neutral-900">
                {item.title}
              </div>
              {item.subtitle ? (
                <div className="truncate text-[12px] text-neutral-600">
                  {item.subtitle}
                </div>
              ) : null}
              {item.meta ? (
                <div className="truncate text-[11px] text-neutral-500">
                  {item.meta}
                </div>
              ) : null}
            </div>
            {item.trailing ? (
              <div className="shrink-0 text-[12px] text-neutral-600">
                {item.trailing}
              </div>
            ) : null}
            {interactive && !item.trailing ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
            ) : null}
          </>
        );
        if (item.href) {
          return (
            <li key={item.key}>
              <a href={item.href} className={rowCls}>
                {inner}
              </a>
            </li>
          );
        }
        if (item.onClick) {
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.onClick}
                className={`w-full text-left ${rowCls}`}
              >
                {inner}
              </button>
            </li>
          );
        }
        return (
          <li key={item.key} className={rowCls}>
            {inner}
          </li>
        );
      })}
    </ul>
  );
}
