// DropdownMenu — anchored menu of actions.
//
// Composed on top of Popover. Items have icon + label + optional
// dangerous-styling + disabled state + submenu (deferred).

"use client";

import type { ComponentType, ReactNode } from "react";
import { Popover } from "./Popover";
import type { PopoverPlacement } from "./Popover";

export type DropdownItem = {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  intent?: "default" | "danger";
  disabled?: boolean;
};

export type DropdownDivider = { key: string; divider: true };

export type DropdownEntry = DropdownItem | DropdownDivider;

export type DropdownMenuProps = {
  trigger: (props: {
    ref: React.RefObject<HTMLButtonElement | null>;
    onClick: () => void;
    isOpen: boolean;
  }) => ReactNode;
  items: readonly DropdownEntry[];
  placement?: PopoverPlacement;
  width?: string | number;
};

function isDivider(entry: DropdownEntry): entry is DropdownDivider {
  return "divider" in entry && entry.divider === true;
}

export function DropdownMenu({
  trigger,
  items,
  placement = "bottom-end",
  width = 220
}: DropdownMenuProps) {
  return (
    <Popover trigger={trigger} placement={placement} width={width}>
      <ul role="menu" className="flex flex-col py-1">
        {items.map((entry) => {
          if (isDivider(entry)) {
            return (
              <li key={entry.key} role="separator" className="my-1 border-t border-neutral-100" />
            );
          }
          const item = entry;
          const Icon = item.icon;
          const intentCls =
            item.intent === "danger"
              ? "text-red-700 hover:bg-red-50"
              : "text-neutral-800 hover:bg-neutral-50";
          const inner = (
            <>
              {Icon ? (
                <Icon className={`h-4 w-4 ${item.intent === "danger" ? "text-red-600" : "text-neutral-500"}`} />
              ) : null}
              <span className="flex-1 truncate">{item.label}</span>
            </>
          );
          const rowCls = `flex min-h-[36px] items-center gap-2 px-3 text-[13px] ${
            item.disabled ? "cursor-not-allowed opacity-50" : intentCls
          }`;
          if (item.href && !item.disabled) {
            return (
              <li key={item.key} role="menuitem">
                <a href={item.href} className={rowCls}>
                  {inner}
                </a>
              </li>
            );
          }
          return (
            <li key={item.key} role="menuitem">
              <button
                type="button"
                onClick={item.onClick}
                disabled={item.disabled}
                className={`w-full text-left ${rowCls}`}
              >
                {inner}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
