// Xrated Trades — shared EXAMPLE pill rendered on demo job posts.
// Single source of truth so the card, detail page, and feed all match.

export function ExamplePill({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold tracking-wide text-black ${className}`}
    >
      EXAMPLE
    </span>
  );
}

export default ExamplePill;
