"use client";

// MessengerShell — Phase 1 placeholder. Renders the visible surface
// (top nav · empty-state hero · placeholder conversation list · input)
// but is deliberately not wired to any realtime backend yet. Sets the
// design pattern so subsequent phases (realtime, attachments, groups)
// slot in without redesign.
//
// Free-tier promise made visible in copy: no AI credits required to
// use this surface at all.

import Link from "next/link";
import { ArrowLeft, Search, Plus, MoreVertical, MessageCircle } from "lucide-react";
import { StatusBar } from "../shell/StatusBar";
import { PlatformBottomNav } from "./PlatformBottomNav";

export function MessengerShell() {
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
              Messages
            </span>
            <span className="text-[10.5px]" style={{ color: "var(--nex-neutral-500)" }}>
              Free forever · no AI needed
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
            placeholder="Search chats"
            className="flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-[color:var(--nex-neutral-400)]"
            style={{ color: "var(--nex-neutral-900)" }}
          />
        </div>
      </div>

      {/* Empty state */}
      <main className="flex-1 px-6 pt-14">
        <div className="mx-auto flex max-w-xs flex-col items-center text-center">
          <span
            className="mb-5 grid h-16 w-16 place-items-center rounded-full"
            style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-500)" }}
            aria-hidden
          >
            <MessageCircle size={30} strokeWidth={1.75} />
          </span>
          <h2 className="text-[18px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
            Messenger is coming soon.
          </h2>
          <p className="mt-2 text-[13px] leading-[1.5]" style={{ color: "var(--nex-neutral-500)" }}>
            The free chat layer is the next major piece we&apos;re building. Person-to-person,
            group chats, images, files — no AI needed to use any of it. This surface will
            light up when the messaging backend lands.
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
            Back to home
          </Link>
        </div>
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
