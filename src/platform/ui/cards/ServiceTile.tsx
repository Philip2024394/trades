// ServiceTile — compact card for services / features / categories.
//
// Renders 3-per-row on mobile inside a Grid density="compact". On
// desktop expands to include description. Featured items get an
// amber accent.

import type { ComponentType } from "react";
import { CARD_RADIUS, TYPE_H4 } from "../tokens";

export type ServiceTileProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  featured?: boolean;
  tag?: string;
  href?: string;
  onClick?: () => void;
};

export function ServiceTile({
  icon: Icon,
  title,
  description,
  featured,
  tag,
  href,
  onClick
}: ServiceTileProps) {
  const outer = `relative flex flex-col ${CARD_RADIUS} border p-3 transition md:p-5 ${
    featured
      ? "border-amber-300 bg-amber-50"
      : "border-neutral-200 bg-white hover:border-neutral-300"
  }`;

  const inner = (
    <>
      {featured ? (
        <span className="absolute right-1.5 top-1.5 hidden rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-neutral-900 md:inline">
          Featured
        </span>
      ) : null}
      <div
        className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg md:mb-3 md:h-10 md:w-10 ${
          featured
            ? "bg-amber-400 text-neutral-900"
            : "bg-neutral-900 text-white"
        }`}
      >
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <h3 className={TYPE_H4}>{title}</h3>
      {featured ? (
        <span className="mt-1 inline-flex w-fit rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-900 md:hidden">
          Featured
        </span>
      ) : null}
      {tag ? (
        <span className="mt-1 hidden w-fit rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 md:inline-flex">
          {tag}
        </span>
      ) : null}
      {description ? (
        <p className="mt-1 hidden text-[13px] text-neutral-700 md:block">
          {description}
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={outer}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`text-left ${outer}`}>
        {inner}
      </button>
    );
  }
  return <div className={outer}>{inner}</div>;
}
