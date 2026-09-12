"use client";

// src/components/nex-app/live/CreatorHandoff.tsx
//
// NEX LIVE · Phase 2 · Creator / entity handoff strip
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 2
//
// The horizontal strip that sits below the active media. Its job is to
// give the user a meaningful doorway from the media into the NEX
// universe (§1 discover → enjoy → explore → connect).
//
// §19 · §20 · §28 · Only expose actions supported by REAL capability
// evidence. Unknown capability stays unknown. No fabricated Book/Buy.
//
// §33 · uses existing NEX identity — never a parallel system.

export type CreatorAction =
  | { kind: "chat"; href: string }
  | { kind: "explore"; href: string }
  | { kind: "book"; href: string }
  | { kind: "buy"; href: string }
  | { kind: "unknown"; label: string; reason: string };

export type CreatorHandoffProps = {
  owner_id: string | null;
  title: string | null;
  customer_facing_label: string;
  visibility: string;
  /** Actions the caller has determined are genuinely available. Never
   *  fabricate — actions not backed by real capability must be omitted
   *  entirely OR passed as {kind: "unknown", reason} for honest
   *  disabled rendering. */
  actions?: ReadonlyArray<CreatorAction>;
};

export function CreatorHandoff({ owner_id, title, customer_facing_label, visibility, actions = [] }: CreatorHandoffProps) {
  return (
    <div
      className="w-full bg-gradient-to-t from-black via-black/85 to-transparent px-4 pt-8 pb-6 text-white select-none"
      data-testid="nex-live-creator-handoff"
    >
      <div className="mx-auto max-w-2xl">
        {/* Creator identity + title */}
        <div className="mb-2">
          {owner_id && (
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              @{owner_id.slice(0, 20)}
            </div>
          )}
          {title && (
            <div className="mt-0.5 text-base font-semibold truncate">{title}</div>
          )}
        </div>

        {/* Rights + visibility line · §10 discipline propagated */}
        <div className="mb-3 flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/60">
            {customer_facing_label}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/40">
            {visibility}
          </span>
        </div>

        {/* Actions strip · only genuinely-available actions render tappable */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {actions.map((a, idx) => (
              <ActionChip key={idx} action={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionChip({ action }: { action: CreatorAction }) {
  if (action.kind === "unknown") {
    return (
      <span
        className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/30 cursor-not-allowed"
        title={action.reason}
        aria-disabled="true"
        data-testid="nex-live-action-unknown"
        data-availability="UNAVAILABLE"
      >
        {action.label} · not available yet
      </span>
    );
  }
  const label = {
    chat: "Chat",
    explore: "Explore",
    book: "Book",
    buy: "Buy",
  }[action.kind];
  return (
    <a
      href={action.href}
      className="rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-white"
      data-testid={`nex-live-action-${action.kind}`}
      data-availability="VERIFIED"
    >
      {label}
    </a>
  );
}
