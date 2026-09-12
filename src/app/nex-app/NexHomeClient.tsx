"use client";

// src/app/nex-app/NexHomeClient.tsx
//
// NEX Frameless Recovery · Slice 1 · Client shell
// Philip 2026-09-07
//
// Owns all interactive state for the new frameless NEX home:
//   · composer text, focus, insert-mode
//   · keypad visibility (driven by composer focus)
//   · ephemeral submissions echo (last 5 · in-memory · no persistence)
//   · kebab open state (via HomeKebabButton internally)
//
// Composition:
//   [ Top identity strip · NEX wordmark · calm ]
//   [ Workspace area · empty state + ephemeral submission echo ]
//   [ HomeConsole (fixed bottom) · composer + keypad ]
//   [ HomeKebabButton (fixed lower-right) · 3-dot control ]
//
// Slice 1 boundaries (§14 encryption, §5 anti-scope):
//   · submissions are transient useState only · zero persistence
//   · no localStorage write for chat data
//   · no wire to any backend / Supabase / API route
//   · no Contacts / Friends Chat / Chat storage created

import { useCallback, useEffect, useRef, useState } from "react";
import { NexComposer } from "@/components/nexapp/NexComposer";
import { NexKeypad } from "@/components/nexapp/NexKeypad";
import { HomeConsole } from "@/components/nex-app/home/HomeConsole";
import { HomeKebabButton } from "@/components/nex-app/home/HomeKebabButton";

type EphemeralSubmission = {
  id: number;
  text: string;
  at: number;
};

const MAX_ECHOED_SUBMISSIONS = 5;
// Slight blur-delay so keypad key taps (which fire mousedown+click) don't
// unmount the keypad mid-tap. Keypad already uses preventFocusSteal on
// mousedown, but this is belt-and-braces for other blur paths (e.g., the
// kebab button opening a portal).
const KEYPAD_HIDE_DELAY_MS = 120;

export function NexHomeClient() {
  const [composerText, setComposerText]   = useState("");
  const [composerFocused, setFocused]     = useState(false);
  const [insertMode, setInsertMode]       = useState(false);
  const [submissions, setSubmissions]     = useState<EphemeralSubmission[]>([]);
  const nextIdRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const onSubmit = useCallback(() => {
    const trimmed = composerText.trim();
    if (trimmed.length === 0) return;
    const id = ++nextIdRef.current;
    setSubmissions((list) => {
      const next = [...list, { id, text: trimmed, at: Date.now() }];
      return next.length > MAX_ECHOED_SUBMISSIONS
        ? next.slice(next.length - MAX_ECHOED_SUBMISSIONS)
        : next;
    });
    setComposerText("");
    // Return focus to the composer so keypad stays visible for the next
    // message. Composer's textarea ref is forwarded from NexComposer.
    if (composerRef.current) {
      try { composerRef.current.focus(); } catch { /* jsdom / test envs */ }
    }
  }, [composerText]);

  const onKey = useCallback((c: string) => setComposerText((v) => v + c), []);
  const onBackspace = useCallback(() => setComposerText((v) => v.slice(0, -1)), []);

  const onInputFocus = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    setFocused(true);
  }, []);
  const onInputBlur = useCallback(() => {
    hideTimerRef.current = setTimeout(() => {
      setFocused(false);
      setInsertMode(false);
    }, KEYPAD_HIDE_DELAY_MS);
  }, []);

  const onInsertModeToggle = useCallback(() => setInsertMode((v) => !v), []);
  const onInsertTileTap = useCallback(() => {
    // Slice 1: no tile action is wired · toggle insert mode off honestly.
    // Future slices will map each tile to its authorised destination.
    setInsertMode(false);
  }, []);

  return (
    <div
      className="nex-home-viewport"
      data-testid="nex-home-viewport"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#05070c",
        color: "#e8ecf3",
        fontFamily: "Inter, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top identity strip · calm NEX wordmark · restrained orange X per
          Slice 1 visual language. Safe-area aware so it clears the
          notch on iOS. */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          paddingTop: "calc(14px + env(safe-area-inset-top, 0px))",
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          data-testid="nex-home-wordmark"
          aria-label="NEX"
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 28,
            fontWeight: 200,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            textShadow: "0 2px 12px rgba(0, 0, 0, 0.45)",
          }}
        >
          <span aria-hidden>NE</span>
          <span
            aria-hidden
            style={{
              color: "#F97316",
              fontWeight: 300,
              marginLeft: "0.02em",
              textShadow: "0 0 18px rgba(249, 115, 22, 0.35)",
            }}
          >X</span>
        </div>
      </div>

      {/* Workspace area · empty state + ephemeral submission echo.
          Scrolls internally when submissions overflow · never pushes the
          console off-screen. */}
      <div
        data-testid="nex-home-workspace"
        style={{
          position: "relative",
          zIndex: 4,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "16px 20px 200px",
          display: "flex",
          flexDirection: "column",
          justifyContent: submissions.length === 0 ? "center" : "flex-end",
          alignItems: "center",
          gap: 10,
        }}
      >
        {submissions.length === 0 ? (
          <div
            data-testid="nex-home-empty-state"
            style={{
              color: "rgba(220, 230, 245, 0.55)",
              fontSize: 14,
              letterSpacing: 0.2,
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: 320,
            }}
          >
            Ask NEX anything.
          </div>
        ) : (
          submissions.map((s) => (
            <div
              key={s.id}
              data-testid="nex-home-submission"
              style={{
                alignSelf: "flex-end",
                maxWidth: "78%",
                padding: "10px 14px",
                background: "rgba(30, 30, 40, 0.72)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 14,
                color: "rgba(245, 245, 245, 0.95)",
                fontSize: 14,
                lineHeight: 1.4,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
                animation: "nex-home-submission-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            >
              {s.text}
            </div>
          ))
        )}
      </div>

      {/* Console · fixed bottom · composer + keypad zone */}
      <HomeConsole
        keypadOpen={composerFocused}
        composer={
          <NexComposer
            ref={composerRef}
            value={composerText}
            onChange={setComposerText}
            onSubmit={onSubmit}
            nexState="idle"
            onInputFocus={onInputFocus}
            onInputBlur={onInputBlur}
            insertMode={insertMode}
            onInsertModeToggle={onInsertModeToggle}
          />
        }
        keypad={
          <NexKeypad
            onKeyTap={onKey}
            onBackspace={onBackspace}
            onEnter={onSubmit}
            insertMode={insertMode}
            onInsertTileTap={onInsertTileTap}
          />
        }
      />

      {/* Lower-right 3-dot quick panel · frameless replacement for the
          phone-frame's rightKebab affordance. */}
      <HomeKebabButton />

      <style>{`
        @keyframes nex-home-submission-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}
