// AssemblyNavPillStrip — thin horizontal strip of assembly-driven nav
// entries the merchant accepted at install time.
//
// Rendered above StudioLiveShell on the storefront when the merchant
// has any add-nav-item proposals accepted for the nav.header slot.
// Zero merchants without accepted decisions see anything different.

import Link from "next/link";
import type { ResolvedAssemblyNavEntry } from "@/lib/studio/assembly";

export function AssemblyNavPillStrip({
  entries
}: {
  entries: ResolvedAssemblyNavEntry[];
}) {
  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="Actions"
      className="sticky top-0 z-20 border-b border-white/10"
      style={{ background: "#0A0A0A" }}
    >
      <ul className="mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto px-3 py-2 sm:px-6">
        {entries.map((e) => (
          <li key={e.id} className="shrink-0">
            <Link
              href={e.href}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:bg-white/10"
            >
              {e.icon && (
                <span aria-hidden="true" className="text-[14px]">
                  {e.icon}
                </span>
              )}
              {e.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
