"use client";

// ContactsShell — NEX relationship dashboard. Design brief: premium
// AI relationship platform, not a chat app. Deep charcoal base ·
// warm ambient glow · yellow NEX accent · glass floating cards ·
// spacious layout · smart tabs · natural-language search.
//
// The whole surface is a "relationship dashboard" not a phone
// contacts list. No WhatsApp rows. No basic list ticks. Every card
// breathes. Every action is one tap away.
//
// V2 features shipped in this pass:
//   1. Smart tabs (All · People · Business · Groups)
//   2. NEX natural-language search (substring V1, wired to AI in V2)
//   3. Relationship tags on every card
//   4. Last interaction on every card
//   5. Favourite pinning (star badge · sorted first)
//   6. Private notes (in profile sheet)
//   7. In-profile action grid (Message · Call · Ask NEX · Share · Reminder · Meet)
//   9. Activity timeline (in profile sheet)
// Deferred: (8) merge duplicates — needs the real contacts service.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Sparkles, UserPlus } from "lucide-react";
import { StatusBar } from "../shell/StatusBar";
import { PersonalContactsSection } from "./PersonalContactsSection";
import { BusinessContactsSection } from "./BusinessContactsSection";
import { GroupsSection } from "./GroupsSection";
import { ContactProfileSheet } from "./ContactProfileSheet";
import { CreateGroupModal } from "./CreateGroupModal";
import type { PersonalContact, BusinessContact, ContactGroup, ContactsTab } from "@/lib/nex/contacts/_types";
import { MOCK_PERSONAL_CONTACTS, MOCK_BUSINESS_CONTACTS, MOCK_GROUPS } from "@/lib/nex/contacts/_mock";

// Export name kept as DARK for import-stability across contacts
// components. Palette is deep-charcoal + warm yellow NEX accent.
export const DARK = {
  bg:            "#08080D",                                              // near-black cool base
  bgSoft:        "#0F0F16",                                              // slight elevation
  surface:       "rgba(22, 22, 32, 0.72)",                               // glass card
  surfaceSolid:  "#161620",                                              // solid card
  surfaceElev:   "rgba(34, 34, 48, 0.82)",                               // higher elevation glass
  border:        "rgba(255, 255, 255, 0.06)",                            // hairline
  borderStrong:  "rgba(251, 191, 36, 0.28)",                             // yellow-tinted for focus
  text:          "#F5F5FA",
  textMuted:     "#8E8E9E",
  textFaint:     "#5A5A6A",
  accent:        "#FBBF24",                                              // NEX yellow (amber-400)
  accentDeep:    "#F59E0B",                                              // amber-500 for gradient
  accentGrad:    "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
  accentSoft:    "rgba(251, 191, 36, 0.12)",
  online:        "#22C55E",
  favourite:     "#FBBF24"
};

const TABS: { id: ContactsTab; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "people",   label: "People" },
  { id: "business", label: "Business" },
  { id: "groups",   label: "Groups" }
];

// Rank favourites first, keep otherwise-stable order.
function pinFirst<T extends { favourite?: boolean }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite));
}

export function ContactsShell() {
  const [query, setQuery]           = useState("");
  const [tab,   setTab]             = useState<ContactsTab>("all");
  const [openPerson, setOpenPerson] = useState<PersonalContact | BusinessContact | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  const q = query.trim().toLowerCase();

  const filteredPersonal = useMemo(() => pinFirst(
    MOCK_PERSONAL_CONTACTS.filter((c) => matchPersonal(c, q))
  ), [q]);

  const filteredBusiness = useMemo(() => pinFirst(
    MOCK_BUSINESS_CONTACTS.filter((c) => matchBusiness(c, q))
  ), [q]);

  const filteredGroups = useMemo(() => pinFirst(
    MOCK_GROUPS.filter((g) => g.name.toLowerCase().includes(q))
  ), [q]);

  const showPeople   = tab === "all" || tab === "people";
  const showBusiness = tab === "all" || tab === "business";
  const showGroups   = tab === "all" || tab === "groups";

  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden"
      style={{ background: DARK.bg, color: DARK.text }}
    >
      {/* Ambient warm glow — soft yellow orbs give the deep charcoal
          scene a candle-lit premium feel. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 65%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute -right-32 top-1/2 h-[380px] w-[380px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #FBBF24 0%, transparent 65%)", filter: "blur(90px)" }}
        />
        <div
          className="absolute bottom-0 left-1/4 h-[320px] w-[320px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FCD34D 0%, transparent 65%)", filter: "blur(90px)" }}
        />
      </div>

      {/* Fine grid overlay — barely visible, spatial UI feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px"
        }}
      />

      <div className="relative z-10 flex flex-col">
        <div style={{ filter: "invert(1)" }}>
          <StatusBar />
        </div>

        {/* Header */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-5 pt-3 pb-3"
          style={{
            background: "rgba(8, 8, 13, 0.72)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderBottom: `1px solid ${DARK.border}`
          }}
        >
          <Link href="/nex-app" aria-label="Back to home"
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{
                  color: DARK.text,
                  background: DARK.surfaceElev,
                  border: `1px solid ${DARK.border}`
                }}>
            <ArrowLeft size={18} strokeWidth={1.75} />
          </Link>
          <h1
            className="text-[15px] font-black uppercase tracking-[0.24em]"
            style={{
              background: DARK.accentGrad,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}
          >
            Contacts
          </h1>
          <button
            type="button"
            aria-label="Add contact"
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-black text-[#141416] transition-transform active:scale-95"
            style={{
              background: DARK.accentGrad,
              boxShadow: "0 6px 20px -4px rgba(251, 191, 36, 0.55)"
            }}
          >
            <UserPlus size={14} strokeWidth={2.5} />
            Add
          </button>
        </header>

        {/* Big NEX Search */}
        <div className="px-5 pt-4">
          <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em]"
                 style={{ color: DARK.textFaint }}>
            <Sparkles size={10} strokeWidth={2.25} style={{ color: DARK.accent }} />
            NEX Search
          </label>
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{
              background: DARK.surface,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${DARK.border}`,
              boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(251,191,36,0.04)"
            }}
          >
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[#141416]"
                  style={{
                    background: DARK.accentGrad,
                    boxShadow: "0 4px 14px -4px rgba(251, 191, 36, 0.55)"
                  }}>
              <Sparkles size={14} strokeWidth={2.5} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask NEX to find a connection…"
              aria-label="NEX Search"
              className="flex-1 bg-transparent py-0.5 text-[13.5px] outline-none placeholder:opacity-40"
              style={{ color: DARK.text }}
            />
          </div>
          <p className="mt-2 px-1 text-[10.5px] leading-tight" style={{ color: DARK.textFaint }}>
            Try &ldquo;my plumber&rdquo; · &ldquo;businesses I contacted last month&rdquo; · &ldquo;who did I discuss kitchens with&rdquo;
          </p>
        </div>

        {/* Smart Tabs */}
        <div className="px-5 pt-4">
          <div
            className="flex gap-1 rounded-full p-1"
            style={{
              background: DARK.surface,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${DARK.border}`
            }}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="flex-1 rounded-full py-2 text-[11.5px] font-bold transition-all"
                  style={{
                    background: active ? DARK.accentGrad : "transparent",
                    color: active ? "#141416" : DARK.textMuted,
                    boxShadow: active ? "0 6px 20px -6px rgba(251, 191, 36, 0.55)" : "none"
                  }}
                  aria-pressed={active}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <main className="flex-1 pb-28">
          {showPeople && (
            <PersonalContactsSection
              contacts={filteredPersonal}
              onSelect={setOpenPerson}
            />
          )}
          {showBusiness && (
            <BusinessContactsSection
              contacts={filteredBusiness}
              onSelect={setOpenPerson}
            />
          )}
          {showGroups && (
            <GroupsSection groups={filteredGroups} />
          )}
        </main>

        {/* Floating Create Group */}
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#141416] transition-transform active:scale-95"
          style={{
            background: DARK.accentGrad,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.10) inset, 0 12px 40px -8px rgba(251, 191, 36, 0.55), 0 20px 60px -12px rgba(245, 158, 11, 0.35)"
          }}
        >
          <Plus size={16} strokeWidth={2.75} />
          Create Group
        </button>
      </div>

      <ContactProfileSheet
        subject={openPerson}
        onClose={() => setOpenPerson(null)}
      />
      <CreateGroupModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        contacts={MOCK_PERSONAL_CONTACTS}
      />
    </div>
  );
}

// ── Search matchers ─────────────────────────────────────────────────
// V1: substring across every searchable field so casual natural-
// language queries ("plumber", "kitchens", "last month") land on
// tagged/noted contacts even without real NLU. V2 wires to NEX.

function matchPersonal(c: PersonalContact, q: string): boolean {
  if (!q) return true;
  const hay = [
    c.name, c.connection_type, c.location, c.connection_history,
    c.private_notes,
    ...(c.tags ?? []),
    c.last_interaction?.last_message
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

function matchBusiness(c: BusinessContact, q: string): boolean {
  if (!q) return true;
  const hay = [
    c.name, c.category, c.location, c.private_notes,
    ...(c.tags ?? [])
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}
