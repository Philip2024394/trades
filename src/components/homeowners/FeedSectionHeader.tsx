// FeedSectionHeader — the tiny nav row that sits above the composer.
//
// Three text links (Composer / App Store / How it works). Whichever
// matches the current view is highlighted. All three link to feed-area
// swaps via query params — no route navigation.
//
// Server component (safe to render from server pages) — link building
// is pure string work.

import Link from "next/link";

export type FeedView = "composer" | "apps" | "guide" | "gallery" | "costs";

const LINKS: { view: FeedView; label: string; hrefSuffix: string }[] = [
  { view: "composer", label: "Feed Posting", hrefSuffix: "" },              // pathname only
  { view: "apps",     label: "App Store",    hrefSuffix: "?view=apps" },
  { view: "guide",    label: "How it works", hrefSuffix: "?guide=1" }
];

export function FeedSectionHeader({
  hrefBase,
  activeView
}: {
  /** Route base without trailing query. Real /sitebook = "/sitebook";
   *  mock = "/sitebook-showcase/the-old-rectory". */
  hrefBase:   string;
  activeView: FeedView;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {LINKS.map((l) => {
        const isActive = activeView === l.view;
        return (
          <Link
            key={l.view}
            href={`${hrefBase}${l.hrefSuffix}`}
            scroll={false}
            className="text-[10px] font-black uppercase tracking-[0.22em] transition"
            style={{
              color: isActive ? "#0A0A0A" : "#94908A",
              borderBottom: isActive ? "1.5px solid #FFB300" : "1.5px solid transparent",
              paddingBottom: 2
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
