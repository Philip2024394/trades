"use client";

// Personal Contacts — premium relationship cards. Photo left, name +
// connection type + location right, tag chips below, small last-
// interaction footer. Favourites show a warm star badge and are
// sorted to the top by the parent shell.

import { Star } from "lucide-react";
import { DARK } from "./ContactsShell";
import type { PersonalContact } from "@/lib/nex/contacts/_types";

export function PersonalContactsSection({
  contacts, onSelect
}: {
  contacts: PersonalContact[];
  onSelect: (c: PersonalContact) => void;
}) {
  return (
    <section className="mt-6">
      <header className="mx-5 mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-black uppercase tracking-[0.24em]"
            style={{ color: DARK.textMuted }}>
          People
        </h2>
        <span className="text-[11px]" style={{ color: DARK.textFaint }}>
          {contacts.length}
        </span>
      </header>
      <div className="mx-4 flex flex-col gap-2.5">
        {contacts.length === 0 && (
          <div className="rounded-2xl px-4 py-8 text-center text-[12px]"
               style={{
                 background: DARK.surface,
                 backdropFilter: "blur(12px)",
                 WebkitBackdropFilter: "blur(12px)",
                 border: `1px solid ${DARK.border}`,
                 color: DARK.textFaint
               }}>
            No people match your search.
          </div>
        )}
        {contacts.map((c) => (
          <ContactCard key={c.id} contact={c} onOpen={() => onSelect(c)} />
        ))}
      </div>
    </section>
  );
}

function ContactCard({
  contact: c, onOpen
}: {
  contact: PersonalContact;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex flex-col rounded-2xl p-3.5 text-left transition-transform active:scale-[0.99]"
      style={{
        background: DARK.surface,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${DARK.border}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -18px rgba(0,0,0,0.7)"
      }}
      aria-label={c.name}
    >
      {c.favourite && (
        <span
          aria-label="Favourite"
          className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full text-[#141416]"
          style={{
            background: DARK.accentGrad,
            boxShadow: "0 4px 12px -3px rgba(251, 191, 36, 0.6)"
          }}
        >
          <Star size={12} strokeWidth={2.5} fill="currentColor" />
        </span>
      )}

      {/* Top row · photo + identity */}
      <div className="flex items-start gap-3.5">
        <span
          className="relative grid h-14 w-14 flex-shrink-0 overflow-hidden rounded-full"
          style={{
            background: DARK.surfaceSolid,
            border: `1px solid ${DARK.border}`,
            boxShadow: "0 8px 24px -12px rgba(251, 191, 36, 0.25)"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          {c.online && (
            <span
              aria-label="Online"
              className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full"
              style={{ background: DARK.online, border: `2px solid ${DARK.bg}` }}
            />
          )}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="pr-6 text-[15px] font-bold leading-tight" style={{ color: DARK.text }}>
            {c.name}
          </div>
          <div className="mt-1 text-[11.5px] leading-tight" style={{ color: DARK.textMuted }}>
            {c.connection_type}
          </div>
          {c.location && (
            <div className="mt-0.5 text-[11px] leading-tight" style={{ color: DARK.textFaint }}>
              {c.location}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {c.tags && c.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: DARK.accentSoft,
                color: DARK.accent,
                border: `1px solid rgba(251, 191, 36, 0.18)`
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Last interaction */}
      {c.last_interaction && (
        <div
          className="mt-3 flex items-baseline gap-2 border-t pt-2.5"
          style={{ borderColor: DARK.border }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: DARK.textFaint }}>
            Last connected
          </span>
          <span className="text-[11px]" style={{ color: DARK.textMuted }}>
            · {c.last_interaction.at}
          </span>
          {c.last_interaction.last_message && (
            <span className="ml-auto truncate text-[11px] italic"
                  style={{ color: DARK.textMuted, maxWidth: "55%" }}>
              &ldquo;{c.last_interaction.last_message}&rdquo;
            </span>
          )}
        </div>
      )}
    </button>
  );
}
