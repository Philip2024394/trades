// SettingsLayout — sidebar nav + section content + sticky save bar.
//
// Mobile: nav becomes a horizontal chip strip at the top so all
// sections stay accessible without a drawer inside a drawer.
// Desktop: sidebar left, content right, save bar sticky at the
// bottom of the content column.

"use client";

import type { ComponentType, ReactNode } from "react";
import { LayoutShell } from "./LayoutShell";
import type { LayoutShellProps } from "./LayoutShell";
import { PAGE_PAD_X, SECTION_PAD_Y } from "../tokens";

export type SettingsSectionLink = {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

export type SettingsLayoutProps = Omit<LayoutShellProps, "children"> & {
  title: string;
  subtitle?: string;
  sections: readonly SettingsSectionLink[];
  activeKey: string;
  onSectionChange: (key: string) => void;
  /** The current section's content. */
  content: ReactNode;
  /** Optional sticky save bar at the bottom of the content area. */
  stickySaveBar?: ReactNode;
};

export function SettingsLayout({
  title,
  subtitle,
  sections,
  activeKey,
  onSectionChange,
  content,
  stickySaveBar,
  ...shellProps
}: SettingsLayoutProps) {
  return (
    <LayoutShell {...shellProps}>
      <div className={`mx-auto max-w-6xl ${PAGE_PAD_X} ${SECTION_PAD_Y}`}>
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[14px] text-neutral-700 md:text-[15px]">
              {subtitle}
            </p>
          ) : null}
        </header>

        {/* Mobile: horizontal chip strip */}
        <div
          className="-mx-4 mb-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 md:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {sections.map((s) => {
            const Icon = s.icon;
            const active = s.key === activeKey;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSectionChange(s.key)}
                className={`inline-flex min-h-[36px] shrink-0 snap-start items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* Desktop: vertical sidebar */}
          <aside className="hidden md:block">
            <nav>
              <ul className="flex flex-col gap-0.5">
                {sections.map((s) => {
                  const Icon = s.icon;
                  const active = s.key === activeKey;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => onSectionChange(s.key)}
                        className={`flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] transition ${
                          active
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        {Icon ? <Icon className="h-4 w-4" /> : null}
                        {s.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0">
            {content}
            {stickySaveBar ? (
              <div className="sticky bottom-0 z-10 mt-6 border-t border-neutral-200 bg-white/95 py-3 backdrop-blur">
                {stickySaveBar}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
