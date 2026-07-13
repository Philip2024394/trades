"use client";

// Yard search bar — client input that writes ?q= to the URL and lets
// Next re-render the feed with the server-side ILIKE filter applied.
//
// Debounces to 350ms so heavy typers don't rerun the query per
// keystroke. Submit-on-enter for accessibility.

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export function YardSearchBar({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);

  // Rebuild the URL with the new q, preserving all existing filters.
  const commit = useMemo(
    () => (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  // Debounce so typing doesn't spam the server. Empty-string clears
  // immediately (no delay on "cancel").
  useEffect(() => {
    if (value === initial) return;
    if (value === "") {
      commit("");
      return;
    }
    const t = setTimeout(() => commit(value), 350);
    return () => clearTimeout(t);
  }, [value, commit, initial]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit(value);
      }}
      className="mt-6 flex items-center gap-2 rounded-full border border-[#1B1A17]/12 bg-white px-4 py-2.5 shadow-sm sm:mt-8 sm:px-5 sm:py-3"
      role="search"
    >
      <Search className="h-4 w-4 shrink-0 text-[#1B1A17]/50" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search a trade, town or tool…"
        aria-label="Search The Yard"
        className="flex-1 bg-transparent text-[13px] font-medium text-[#1B1A17] placeholder:text-[#1B1A17]/50 focus:outline-none"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#1B1A17]/50 hover:bg-[#1B1A17]/5 hover:text-[#1B1A17]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </form>
  );
}
