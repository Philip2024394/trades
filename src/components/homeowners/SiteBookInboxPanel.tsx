"use client";

// SiteBookInboxPanel v2 — card-per-trade layout with grouping.
//
// Rewritten 2026-07-19 (Philip):
//   • Active | Archived toggle at top (segmented)
//   • Group-by-project accordion when >5 non-archived rows
//   • Each trade rendered as its own bordered card (not compact row)
//   • Per-card overflow menu ⋯ with 3 actions:
//       · Archive  — soft-hide, still shown in Archived tab
//       · Remove   — un-assign from this project only
//       · Delete   — destructive, wipes the conversation
//
// MVP: archive state is client-only for previewability (mock works
// instantly). Real /sitebook wires the actions to API endpoints in
// Phase 1.5 via optional onAction callback.
//
// Rules:
//   1 · Questions: "Who am I working with?"
//   2 · Replaces: mental juggle of "who's on which project"
//   3 · Groups only appear when scale demands them (>5 trades)

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageCircle, MoreHorizontal, UserPlus,
  Archive, X, Trash2, ChevronDown, ChevronRight, Inbox
} from "lucide-react";

const BRAND         = "#FFB300";
const CARD_BORDER   = "#EDE4CE";
const ACTIVE_GREEN  = "#166534";       // matches BRAND_GREEN_DARK — CTAs / active state
const ARCHIVE_RED   = "#B91C1C";       // matches destructive-action red
const GROUP_THRESHOLD = 5;

export type SiteBookInboxRowStatus =
  | "invited"      // pending — waiting for trade to accept
  | "member"       // trade accepted
  | "declined"     // trade said no
  | "unavailable"  // SLA elapsed without response
  | "conversation";// active WA thread with an accepted trade

export type SiteBookInboxRow = {
  id:            string;
  kind:          "whatsapp" | "post" | "system";
  /** Which side of the panel this row belongs to AND the label shown
   *  on the small pill on the card. Three flat categories:
   *  trade · merchant · supplier. Trades section = kind 'trade';
   *  Suppliers section = 'merchant' + 'supplier'. */
  entityKind?:   "trade" | "merchant" | "supplier";
  title:         string;
  preview:       string;
  createdAt:     string;
  avatarInitial: string;
  avatarUrl?:    string | null;
  projectTitle?: string | null;
  projectCity?:  string | null;
  status?:       SiteBookInboxRowStatus;
  isUnread?:     boolean;
  isArchived?:   boolean;
  linkHref?:     string;
};

const STATUS_STYLE: Record<SiteBookInboxRowStatus, { label: string; bg: string; fg: string }> = {
  invited:      { label: "Invited",      bg: "#FEF3C7", fg: "#92400E" },
  member:       { label: "Member",       bg: "#DCFCE7", fg: "#166534" },
  declined:     { label: "Declined",     bg: "#F3F4F6", fg: "#525252" },
  unavailable:  { label: "Unavailable",  bg: "#FEE2E2", fg: "#991B1B" },
  conversation: { label: "Chat",         bg: "#DBEAFE", fg: "#1D4ED8" }
};

// Tiny pill styling per entity kind — trade/merchant/supplier.
const ENTITY_PILL_STYLE: Record<"trade" | "merchant" | "supplier", { backgroundColor: string; color: string }> = {
  trade:    { backgroundColor: "rgba(255,179,0,0.20)", color: "#7A4E00" },   // yellow
  merchant: { backgroundColor: "rgba(59,130,246,0.15)", color: "#1E40AF" },  // blue
  supplier: { backgroundColor: "rgba(34,197,94,0.15)",  color: "#166534" }   // green
};

type Tab = "active" | "archived";
type Action = "archive" | "remove" | "delete";

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "now";
  if (mins < 60)  return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d`;
  const wks = Math.floor(days / 7);
  return `${wks}w`;
}

export function SiteBookInboxPanel({
  rows,
  emptyLabel = "No conversations yet. Message a trade from any post to start one.",
  addHref    = "/trade-off/yard/canteens",
  onAction
}: {
  rows: SiteBookInboxRow[];
  emptyLabel?: string;
  /** Where the "+ Add" pill routes — canonical trades directory
   *  (yard canteens). Same destination as the composer's "Add trades"
   *  button. Mock overrides to "?previewInvite=1". */
  addHref?:   string;
  /** Optional action callback — real /sitebook wires this to API
   *  endpoints in Phase 1.5. Mock / MVP uses client-only state. */
  onAction?:  (rowId: string, action: Action) => void;
}) {
  const [tab,     setTab]             = useState<Tab>("active");
  const [locallyArchived, setLocallyArchived] = useState<Set<string>>(new Set());
  const [locallyDeleted,  setLocallyDeleted]  = useState<Set<string>>(new Set());
  const [openMenuId,      setOpenMenuId]      = useState<string | null>(null);

  function isRowArchived(r: SiteBookInboxRow): boolean {
    return !!r.isArchived || locallyArchived.has(r.id);
  }
  function isRowDeleted(r: SiteBookInboxRow): boolean {
    return locallyDeleted.has(r.id);
  }

  const activeRows   = useMemo(() => rows.filter((r) => !isRowArchived(r) && !isRowDeleted(r)),   [rows, locallyArchived, locallyDeleted]);
  const archivedRows = useMemo(() => rows.filter((r) => isRowArchived(r) && !isRowDeleted(r)),    [rows, locallyArchived, locallyDeleted]);

  // Search removed per Philip 2026-07-19 — tab selection is the only filter now.
  const filtered = tab === "active" ? activeRows : archivedRows;

  const unavailable = activeRows.filter((r) => r.status === "unavailable");

  function fireAction(id: string, action: Action) {
    setOpenMenuId(null);
    if (action === "archive" || action === "remove") {
      setLocallyArchived((prev) => new Set(prev).add(id));
    }
    if (action === "delete") {
      if (!confirm("Delete this conversation? Every message and reply will be removed. This can't be undone.")) return;
      setLocallyDeleted((prev) => new Set(prev).add(id));
    }
    onAction?.(id, action);
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: CARD_BORDER }}
    >
      {/* Header — small "+ Add" pill (opens the trades directory)
          + segmented Active|Archived toggle. */}
      <div className="border-b p-3" style={{ borderColor: CARD_BORDER }}>
        <div className="mb-2 flex justify-end">
          <Link
            href={addHref}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
            style={{ backgroundColor: BRAND }}
            title="Browse the trades directory and invite a trade"
          >
            <UserPlus size={10} strokeWidth={2.6}/>
            Add
          </Link>
        </div>

        {/* Segmented toggle — Active = green, Archived = red */}
        <div
          className="grid grid-cols-2 rounded-full border p-0.5 text-[10.5px] font-black uppercase tracking-wider"
          style={{ borderColor: CARD_BORDER, backgroundColor: "#F9F5EA" }}
        >
          <button
            type="button"
            onClick={() => setTab("active")}
            className="inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 transition"
            style={{
              backgroundColor: tab === "active" ? ACTIVE_GREEN : "transparent",
              color:           tab === "active" ? "white"      : "#94908A",
              boxShadow:       tab === "active" ? "0 1px 2px rgba(0,0,0,0.12)" : undefined
            }}
          >
            <Inbox size={11} strokeWidth={2.5}/>
            Active
            <span
              className="ml-0.5 rounded-full px-1.5 text-[9.5px] tabular-nums"
              style={{
                backgroundColor: tab === "active" ? "rgba(255,255,255,0.25)" : "#F1F1EF",
                color:           tab === "active" ? "white"                 : "#525252"
              }}
            >
              {activeRows.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("archived")}
            className="inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 transition"
            style={{
              backgroundColor: tab === "archived" ? ARCHIVE_RED : "transparent",
              color:           tab === "archived" ? "white"     : "#94908A",
              boxShadow:       tab === "archived" ? "0 1px 2px rgba(0,0,0,0.12)" : undefined
            }}
          >
            <Archive size={11} strokeWidth={2.5}/>
            Archived
            <span
              className="ml-0.5 rounded-full px-1.5 text-[9.5px] tabular-nums"
              style={{
                backgroundColor: tab === "archived" ? "rgba(255,255,255,0.25)" : "#F1F1EF",
                color:           tab === "archived" ? "white"                 : "#525252"
              }}
            >
              {archivedRows.length}
            </span>
          </button>
        </div>
      </div>

      {/* SLA notice — one banner when 1+ rows flipped to unavailable */}
      {tab === "active" && unavailable.length > 0 && (
        <div className="border-b px-3 py-2" style={{ borderColor: CARD_BORDER, backgroundColor: "#FEF2F2" }}>
          <p className="text-[11.5px] leading-snug text-neutral-800">
            <span className="font-black">No reply from {unavailable[0].title}
            {unavailable.length > 1 ? ` and ${unavailable.length - 1} other${unavailable.length > 2 ? "s" : ""}` : ""} in 24 hours.</span>
            {" "}Likely unavailable right now.
          </p>
          <Link
            href="/trade-off/yard/canteens"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-red-800 underline underline-offset-2 hover:text-red-900"
          >
            Invite another trade from the directory →
          </Link>
        </div>
      )}

      {/* Body — split into two sections: Trades / Suppliers. Each
          shows 3 cards by default with "Show all N" expand. */}
      <div className="p-2">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-neutral-500">
            {tab === "archived" ? "Nothing archived yet." : emptyLabel}
          </div>
        ) : (
          <SplitSections
            rows={filtered}
            openMenuId={openMenuId}
            onOpenMenu={setOpenMenuId}
            onAction={fireAction}
          />
        )}
      </div>
    </div>
  );
}

// ─── Split sections: Trades + Suppliers ───────────────────────────

const SECTION_DEFAULT_LIMIT = 3;

function SplitSections({
  rows, openMenuId, onOpenMenu, onAction
}: {
  rows:                SiteBookInboxRow[];
  /** Kept for API compat with older callers; ignored — grouping was
   *  removed per Philip 2026-07-19 (no in-between project headers). */
  groupWithinSection?: boolean;
  openMenuId:          string | null;
  onOpenMenu:          (id: string | null) => void;
  onAction:            (id: string, action: Action) => void;
}) {
  const trades    = rows.filter((r) => (r.entityKind ?? "trade") === "trade");
  const suppliers = rows.filter((r) => r.entityKind === "supplier" || r.entityKind === "merchant");

  return (
    <div className="space-y-3">
      <EntitySection
        label="Trades"
        rows={trades}
        openMenuId={openMenuId}
        onOpenMenu={onOpenMenu}
        onAction={onAction}
      />
      <EntitySection
        label="Suppliers"
        rows={suppliers}
        openMenuId={openMenuId}
        onOpenMenu={onOpenMenu}
        onAction={onAction}
      />
    </div>
  );
}

function EntitySection({
  label, rows, openMenuId, onOpenMenu, onAction
}: {
  label:               string;
  rows:                SiteBookInboxRow[];
  openMenuId:          string | null;
  onOpenMenu:          (id: string | null) => void;
  onAction:            (id: string, action: Action) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Empty section = header + subtle empty text
  if (rows.length === 0) {
    return (
      <section>
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          <h4 className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</h4>
          <span className="text-[10px] font-bold tabular-nums text-neutral-400">0</span>
        </div>
        <div className="rounded-xl bg-neutral-50 px-3 py-3 text-center">
          <p className="text-[11px] text-neutral-500">No {label.toLowerCase()} yet</p>
        </div>
      </section>
    );
  }

  const canExpand = rows.length > SECTION_DEFAULT_LIMIT;
  const visible   = canExpand && !expanded ? rows.slice(0, SECTION_DEFAULT_LIMIT) : rows;

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <h4 className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</h4>
        <span className="text-[10px] font-bold tabular-nums text-neutral-500">
          {canExpand && !expanded ? `${SECTION_DEFAULT_LIMIT} of ${rows.length}` : rows.length}
        </span>
      </div>

      <FlatList
        rows={visible}
        openMenuId={openMenuId}
        onOpenMenu={onOpenMenu}
        onAction={onAction}
      />

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
        >
          {expanded ? (
            <>Show fewer <ChevronDown size={11} strokeWidth={2.5} className="rotate-180"/></>
          ) : (
            <>Show all {rows.length} <ChevronDown size={11} strokeWidth={2.5}/></>
          )}
        </button>
      )}
    </section>
  );
}

// ─── Grouped-by-project view ───────────────────────────────────────

function GroupedList({
  rows, openMenuId, onOpenMenu, onAction
}: {
  rows:       SiteBookInboxRow[];
  openMenuId: string | null;
  onOpenMenu: (id: string | null) => void;
  onAction:   (id: string, action: Action) => void;
}) {
  // Group by projectTitle; rows without a project fall into "Other".
  const groups = useMemo(() => {
    const map = new Map<string, SiteBookInboxRow[]>();
    for (const r of rows) {
      const key = r.projectTitle ?? "Other";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-1">
      {groups.map(([projectTitle, projectRows]) => (
        <GroupAccordion
          key={projectTitle}
          projectTitle={projectTitle}
          rows={projectRows}
          openMenuId={openMenuId}
          onOpenMenu={onOpenMenu}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

function GroupAccordion({
  projectTitle, rows, openMenuId, onOpenMenu, onAction
}: {
  projectTitle: string;
  rows:         SiteBookInboxRow[];
  openMenuId:   string | null;
  onOpenMenu:   (id: string | null) => void;
  onAction:     (id: string, action: Action) => void;
}) {
  const [open, setOpen] = useState<boolean>(true); // first render open by default

  return (
    <div className="rounded-xl" style={{ backgroundColor: "#FBF6EC" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-neutral-100/60"
      >
        <div className="flex items-center gap-1.5">
          {open ? <ChevronDown size={12} strokeWidth={2.5} className="text-neutral-500"/>
                : <ChevronRight size={12} strokeWidth={2.5} className="text-neutral-500"/>}
          <span className="text-[11.5px] font-black uppercase tracking-wider text-neutral-800">{projectTitle}</span>
        </div>
        <span className="text-[10px] font-bold tabular-nums text-neutral-500">
          {rows.length} {rows.length === 1 ? "trade" : "trades"}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 px-1.5 pb-2">
          {rows.map((r) => (
            <TradeCard
              key={r.id}
              row={r}
              menuOpen={openMenuId === r.id}
              onOpenMenu={() => onOpenMenu(openMenuId === r.id ? null : r.id)}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Flat card list (used when ≤ GROUP_THRESHOLD trades) ────────────

function FlatList({
  rows, openMenuId, onOpenMenu, onAction
}: {
  rows:       SiteBookInboxRow[];
  openMenuId: string | null;
  onOpenMenu: (id: string | null) => void;
  onAction:   (id: string, action: Action) => void;
}) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <TradeCard
          key={r.id}
          row={r}
          menuOpen={openMenuId === r.id}
          onOpenMenu={() => onOpenMenu(openMenuId === r.id ? null : r.id)}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

// ─── Per-trade card ────────────────────────────────────────────────

function TradeCard({
  row: r, menuOpen, onOpenMenu, onAction
}: {
  row:        SiteBookInboxRow;
  menuOpen:   boolean;
  onOpenMenu: () => void;
  onAction:   (id: string, action: Action) => void;
}) {
  const statusChip = r.status ? STATUS_STYLE[r.status] : null;

  const body = (
    <div
      className="group relative flex items-start gap-2.5 rounded-lg border bg-white p-2.5 transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      {/* Avatar — 36px round, yellow-outlined so it reads like the
          yard members strip pattern */}
      <div
        className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 shadow-sm"
        style={{ borderColor: "white", boxShadow: "0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        {r.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={r.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-[12px] font-black text-neutral-900"
            style={{ backgroundColor: BRAND }}
          >
            {r.avatarInitial.toUpperCase() || <MessageCircle size={12} strokeWidth={2.5}/>}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[12.5px] font-black text-neutral-900">{r.title}</p>
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-neutral-500">
            {timeAgoShort(r.createdAt)}
          </span>
        </div>

        {/* Category · Project — the category pill now shows the flat
            entityKind (trade / merchant / supplier) instead of the
            freeform trade type. Status pill sits inline to save a row. */}
        {(r.entityKind || r.projectTitle || statusChip) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
            {r.entityKind && (
              <span
                className="rounded-sm px-1 text-[9px] font-black uppercase tracking-wider"
                style={ENTITY_PILL_STYLE[r.entityKind]}
              >
                {r.entityKind}
              </span>
            )}
            {r.projectTitle && (
              <span className="truncate text-[10px] font-black uppercase tracking-wider text-neutral-500">
                {r.projectTitle}
              </span>
            )}
            {statusChip && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider"
                style={{ backgroundColor: statusChip.bg, color: statusChip.fg }}
              >
                {statusChip.label}
              </span>
            )}
          </div>
        )}

        <p className={"mt-1 line-clamp-1 text-[11.5px] " + (r.isUnread ? "font-bold text-neutral-800" : "text-neutral-500")}>
          {r.preview}
        </p>
      </div>

      {/* Unread dot */}
      {r.isUnread && (
        <span
          className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: BRAND }}
          aria-hidden="true"
        />
      )}

      {/* Overflow menu */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenMenu(); }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 opacity-70 transition hover:bg-neutral-100 hover:opacity-100 group-hover:opacity-100"
          aria-label="More options"
        >
          <MoreHorizontal size={14}/>
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-lg border bg-white shadow-lg"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem icon={Archive} label="Archive"     onClick={() => onAction(r.id, "archive")}/>
            <MenuItem icon={X}       label="Remove"      onClick={() => onAction(r.id, "remove")}/>
            <MenuItem icon={Trash2}  label="Delete"      onClick={() => onAction(r.id, "delete")} destructive/>
          </div>
        )}
      </div>
    </div>
  );

  if (r.linkHref) {
    return <a href={r.linkHref} className="block">{body}</a>;
  }
  return body;
}

function MenuItem({
  icon: Icon, label, onClick, destructive
}: {
  icon:        typeof Archive;
  label:       string;
  onClick:     () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-black transition " +
        (destructive ? "text-red-800 hover:bg-red-50" : "text-neutral-800 hover:bg-neutral-50")
      }
    >
      <Icon size={12} strokeWidth={2.5}/>
      {label}
    </button>
  );
}
