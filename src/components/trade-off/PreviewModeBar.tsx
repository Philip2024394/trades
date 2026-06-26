// Fixed top-bar shown when /trade/<slug>?preview=standard is loaded. Lets
// the visitor see the profile as if the tier were Standard so the trial
// tradie can preview what their profile loses when the trial ends.
//
// Server component — pure render, no client state. "Exit preview" is a
// plain link back to /trade/<slug> with no query string.

export function PreviewModeBar({ slug }: { slug: string }) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-3 py-2 text-amber-900 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="text-base leading-none">👁</span>
        <p className="truncate text-[13px] font-semibold">
          Previewing as <span className="font-extrabold">Standard tier</span>
          <span className="hidden text-amber-700 sm:inline"> — this is what your profile looks like without Xrated App.</span>
        </p>
      </div>
      <a
        href={`/trade/${encodeURIComponent(slug)}`}
        className="inline-flex h-8 shrink-0 items-center rounded-full border border-amber-400 bg-white px-3 text-[12px] font-bold text-amber-900 transition hover:bg-amber-50"
      >
        Exit preview
      </a>
    </div>
  );
}

export default PreviewModeBar;
