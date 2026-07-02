// StudioStubPage — placeholder shown while a Studio module is in
// build. Every scaffolded route uses this so the workspace feels
// coherent immediately, before any specific module ships.

import type { ReactNode } from "react";

const YELLOW = "#FFB300";

export function StudioStubPage({
  title,
  subtitle,
  moduleNumber,
  moduleName,
  action
}: {
  title: string;
  subtitle: string;
  moduleNumber: string;
  moduleName: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Studio · Coming in Module {moduleNumber}
      </p>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        {subtitle}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-bold text-neutral-700">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: YELLOW }}
          />
          {moduleName}
        </span>
        {action}
      </div>
    </div>
  );
}
