// Breadcrumbs — visible category trail rendered above the PDP gallery.
//
// Paired with BreadcrumbList JSON-LD (emitted from the PDP page itself)
// so Google can render rich-snippet breadcrumbs in search results and
// confirm the page's category hierarchy. Visible markup is a small
// muted strip — keeps SEO + navigation value without competing with the
// product hero below.
//
// Pure server component. Last item renders as plain text (not a link)
// per Google's BreadcrumbList guidance — the current page shouldn't
// link to itself.

import Link from "next/link";

export type BreadcrumbTrailItem = { name: string; url?: string };

export function Breadcrumbs({ trail }: { trail: BreadcrumbTrailItem[] }) {
  if (trail.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6"
    >
      <ol className="flex flex-wrap items-center gap-1 text-[12px] font-bold text-neutral-500">
        {trail.map((item, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={`${item.name}-${i}`} className="flex items-center gap-1">
              {item.url && !isLast ? (
                <Link
                  href={item.url}
                  className="transition hover:text-[#FFB300]"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "font-extrabold text-neutral-900"
                      : "text-neutral-500"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.name}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-neutral-400">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
