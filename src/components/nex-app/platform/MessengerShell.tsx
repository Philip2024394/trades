"use client";

// MessengerShell — Phase 1 placeholder. Renders the visible surface
// (top nav · empty-state hero · placeholder conversation list · input)
// but is deliberately not wired to any realtime backend yet. Sets the
// design pattern so subsequent phases (realtime, attachments, groups)
// slot in without redesign.
//
// Free-tier promise made visible in copy: no AI credits required to
// use this surface at all.
//
// Stage 3.33 · Phase 26 (Philip 2026-08-31):
//   · Wrapped in <I18nProvider> so every label pulls from the string
//     packs (EN + ID). User's lang comes from localStorage.nex_user_lang
//     set by the sign-on prefix picker (Stage 3.31.a).
//   · Cross-language preview section renders 3 sample ChatBubbleTranslated
//     bubbles under the "coming soon" hero so users see how the
//     translation + toggle icon works before the realtime backend lands.

import Link from "next/link";
import { ArrowLeft, Search, Plus, MoreVertical, MessageCircle } from "lucide-react";
import { StatusBar } from "../shell/StatusBar";
import { PlatformBottomNav } from "./PlatformBottomNav";
import { I18nProvider, useT, useLang } from "@/lib/nex/i18n/I18nProvider";
import { ChatBubbleTranslated } from "@/components/nexapp/ChatBubbleTranslated";

export function MessengerShell() {
  return (
    <I18nProvider>
      <MessengerShellInner />
    </I18nProvider>
  );
}

function MessengerShellInner() {
  const t = useT();
  const { lang: viewerLang } = useLang();
  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col"
      style={{ background: "var(--nex-cream)" }}
    >
      <StatusBar />

      {/* Nav */}
      <header
        className="flex items-center justify-between px-4 pt-3 pb-3"
        style={{
          background: "color-mix(in oklab, var(--nex-cream) 92%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--nex-neutral-200)"
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/nex-app"
            aria-label="Back to home"
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ color: "var(--nex-neutral-700)" }}
          >
            <ArrowLeft size={22} strokeWidth={1.75} />
          </Link>
          <div className="flex flex-col">
            <span className="text-[16px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
              {t("messenger.title")}
            </span>
            <span className="text-[10.5px]" style={{ color: "var(--nex-neutral-500)" }}>
              {t("messenger.subtitle")}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Messenger options"
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ color: "var(--nex-neutral-500)" }}
        >
          <MoreVertical size={20} strokeWidth={1.75} />
        </button>
      </header>

      {/* Search */}
      <div className="px-4 pt-3">
        <div
          className="flex items-center gap-2 rounded-full pl-3.5 pr-3 py-2"
          style={{
            background: "var(--nex-neutral-0)",
            border: "1px solid var(--nex-neutral-200)"
          }}
        >
          <Search size={16} strokeWidth={1.75} style={{ color: "var(--nex-neutral-400)" }} />
          <input
            type="text"
            placeholder={t("messenger.searchPlaceholder")}
            className="flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-[color:var(--nex-neutral-400)]"
            style={{ color: "var(--nex-neutral-900)" }}
          />
        </div>
      </div>

      {/* Empty state + cross-language preview */}
      <main className="flex-1 px-6 pt-14 pb-28">
        <div className="mx-auto flex max-w-xs flex-col items-center text-center">
          <span
            className="mb-5 grid h-16 w-16 place-items-center rounded-full"
            style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-500)" }}
            aria-hidden
          >
            <MessageCircle size={30} strokeWidth={1.75} />
          </span>
          <h2 className="text-[18px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
            {t("messenger.emptyStateTitle")}
          </h2>
          <p className="mt-2 text-[13px] leading-[1.5]" style={{ color: "var(--nex-neutral-500)" }}>
            {t("messenger.emptyStateBody")}
          </p>
          <Link
            href="/nex-app"
            className="mt-6 rounded-full px-4 py-2 text-[12px] font-semibold"
            style={{
              background: "var(--nex-neutral-0)",
              color: "var(--nex-neutral-700)",
              border: "1px solid var(--nex-neutral-300)"
            }}
          >
            {t("common.back")}
          </Link>
        </div>

        {/* Cross-language preview · Stage 3.33. Sample bubbles that
            demonstrate the auto-translation + top-right toggle icon.
            When the realtime backend lands, real messages replace these
            using the same <ChatBubbleTranslated> component. */}
        <section
          className="mx-auto mt-10 max-w-[420px]"
          aria-labelledby="messenger-preview-title"
        >
          <div className="mb-4 text-center">
            <h3
              id="messenger-preview-title"
              className="text-[13px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "var(--nex-neutral-700)" }}
            >
              {t("messenger.previewTitle")}
            </h3>
            <p className="mt-1.5 text-[12px] leading-[1.55]" style={{ color: "var(--nex-neutral-500)" }}>
              {t("messenger.previewSubtitle")}
            </p>
          </div>

          {/*
            3 sample bubbles. In the "other" role we simulate a friend who
            sent the message in the language OPPOSITE to the viewer, so the
            translation + toggle icon are always visible for demo purposes.
            The "self" bubble is always in the viewer's own language so no
            translation happens (matches real UX).
          */}
          <div className="flex flex-col gap-3">
            <ChatBubbleTranslated
              role="other"
              text={viewerLang === "id" ? "Good morning" : "Selamat pagi"}
              sentLang={viewerLang === "id" ? "en" : "id"}
              viewerLang={viewerLang}
              authorName="Andi"
              timestamp="09:14"
            />
            <ChatBubbleTranslated
              role="self"
              text={viewerLang === "id" ? "Selamat pagi, apa kabar?" : "Good morning, how are you?"}
              sentLang={viewerLang}
              viewerLang={viewerLang}
              timestamp="09:15"
            />
            <ChatBubbleTranslated
              role="other"
              text={viewerLang === "id" ? "Thank you very much" : "Terima kasih banyak"}
              sentLang={viewerLang === "id" ? "en" : "id"}
              viewerLang={viewerLang}
              authorName="Andi"
              timestamp="09:16"
            />
          </div>
        </section>
      </main>

      {/* Floating new-chat FAB reserved for when the surface is live */}
      <button
        type="button"
        aria-label="Start new chat (coming soon)"
        disabled
        className="fixed bottom-24 right-5 grid h-14 w-14 place-items-center rounded-full opacity-60"
        style={{
          background: "var(--nex-accent-500)",
          color: "var(--nex-neutral-0)",
          boxShadow: "var(--nex-shadow-lg)"
        }}
      >
        <Plus size={26} strokeWidth={2.25} />
      </button>

      <PlatformBottomNav />
    </div>
  );
}
