"use client";

// Staircase Library · full-screen swipe viewer + floating Nex chat.
//
// Philip 2026-08-02 spec:
//   - one staircase image at a time · fills the viewport
//   - swipe left/right (Tinder-style) · touch + mouse drag
//   - no grid view · focus is immersive
//   - floating circular orange Nex button bottom-right
//   - tapping Nex opens a chat panel · Nex understands the CURRENT image
//   - image stays visible while chatting whenever possible
//
// Chat context bridge: every message sent to /api/nex/staircase-chat
// carries `focused_design_context` describing the currently-viewed
// staircase · the backend prepends this as an inline hint so the
// Advisor + composer know exactly what the customer is looking at.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Send, Home, Camera } from "lucide-react";

export type LibraryDesign = {
  design_id:            string;
  title:                string;
  url:                  string;
  additional_views:     string[];
  staircase_type:       string;
  design_style:         string;
  design_family?:       string;
  materials:            string[];
  customer_description: string;
  image_state:          string;
  // Philip 2026-08-02 · native pixel dimensions from the measure script.
  // Used to render with correct aspect ratio and to prevent upscaling
  // beyond the source resolution.
  width:                number;
  height:               number;
};

type ChatMessage = { role: "user" | "assistant"; content: string; when: number };

const SWIPE_THRESHOLD_PX = 60;
const SWIPE_HINT_STORAGE_KEY = "nex-library-swipe-hint-seen";

// Philip 2026-08-02 · reduce a rich design_style descriptor to a clean
// short header tag. See the h1 comment in the shell for the trim rule.
function shortStyleLabel(raw: string): string {
  if (!raw) return "";
  const firstPhrase = raw.split("·")[0].trim();
  if (firstPhrase.length <= 28) return firstPhrase;
  return firstPhrase.split(/\s+/).slice(0, 3).join(" ");
}

// Philip 2026-08-02 · short reference ID shown on the library viewer + used
// as the search key in the chat. NEX-DESIGN-000005 → "Nex005". Customer can
// type "show me Nex005", "Nex 005" or bare "005" in the chat and the viewer
// jumps to that design.
function shortNexId(designId: string): string {
  const match = designId.match(/(\d{1,6})$/);
  const raw   = match ? match[1] : "0";
  const asInt = parseInt(raw, 10) || 0;         // strip leading zeros ("000005" → 5)
  return "Nex" + String(asInt).padStart(3, "0"); // pad to 3 · grows past 999 naturally
}

// Parse a user chat message for a Nex-ID reference · returns the matching
// index into designs[] or null. Matches "nex005", "Nex 5", "nex-005",
// "show me #5" (bare number ≥ 3 digits to avoid false positives on year/prices).
function parseNexIdReference(message: string, designs: LibraryDesign[]): number | null {
  if (!message) return null;
  const rx = /(?:nex[\s#-]*)(\d{1,6})|(?:^|\s)(\d{3,6})(?=\s|$|[?!.])/i;
  const m = message.match(rx);
  if (!m) return null;
  const digits = (m[1] || m[2] || "").replace(/^0+/, "") || "0";
  const target = digits.padStart(3, "0");
  for (let i = 0; i < designs.length; i++) {
    if (shortNexId(designs[i].design_id).slice(3) === target) return i;
    if (shortNexId(designs[i].design_id).slice(3).replace(/^0+/, "") === digits) return i;
  }
  return null;
}

// Philip 2026-08-02 · rotating placeholder prompts shown in the textarea
// when it's empty · cycles every ~3s to invite different kinds of questions.
const PLACEHOLDER_PROMPTS: string[] = [
  "Ask any question?",
  "What style is this?",
  "Can this be built in oak?",
  "Show me Nex005",
  "Any material choice?",
  "Who can build this?",
];

export function StaircaseLibraryShell({ designs }: { designs: LibraryDesign[] }) {
  const [index, setIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Philip 2026-08-02 · onboarding swipe hint · displayed centered until the
  // user's first swipe or arrow-key nav · persisted via localStorage so it
  // never nags again after the first successful interaction.
  const [hintVisible, setHintVisible] = useState(true);
  const conversationIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  );

  // Ref on the chat scroll container so we can auto-scroll to the newest
  // message whenever a new one lands. Without this the user has to manually
  // scroll down to see Nex's reply after a long conversation.
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Philip 2026-08-02 · rotating placeholder in the textarea · cycles through
  // PLACEHOLDER_PROMPTS every ~2.6s while the input is empty. Pauses when
  // the user starts typing so it never fights the caret.
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    if (draft.length > 0) return; // pause rotation once user types
    const id = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_PROMPTS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [draft]);

  // Philip 2026-08-02 · persist the conversation across page reloads.
  // conversation_id + messages saved to localStorage · restored on mount ·
  // saved on every message change. Keeps the user's chat when they come
  // back to the Library later in the same browser.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("nex-library-chat");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { conversation_id?: string; messages?: ChatMessage[] };
      if (typeof parsed.conversation_id === "string" && parsed.conversation_id.length > 0) {
        conversationIdRef.current = parsed.conversation_id;
      }
      if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
    } catch { /* corrupt entry · ignore · start fresh */ }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("nex-library-chat", JSON.stringify({
        conversation_id: conversationIdRef.current,
        messages,
      }));
    } catch { /* localStorage full / blocked · ignore */ }
  }, [messages]);

  // Drag state — used by both touch + mouse.
  // isAnimating = true while a CSS transition is running on the image ·
  // used to disable input during the ~280ms card-slide so the user can't
  // start another swipe mid-transition.
  const dragStartXRef = useRef<number | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const viewportWidthRef = useRef<number>(0);

  // Load hint state from localStorage on mount (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY)) setHintVisible(false);
    } catch { /* localStorage may be blocked · default is visible */ }
  }, []);

  const dismissHint = useCallback(() => {
    setHintVisible((v) => {
      if (!v) return v;
      try { window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, "1"); } catch { /* ignore */ }
      return false;
    });
  }, []);

  const empty = designs.length === 0;
  const current = designs[index];

  // Cache viewport width for the slide-off animation (updated on resize)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => { viewportWidthRef.current = window.innerWidth; };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Card-slide navigation · animate current image off in the swipe direction,
  // swap index at the end of the animation, snap the new image in centered
  // without transition so it appears instantly at rest. Blocks re-entry
  // while animating.
  const go = useCallback((delta: number) => {
    if (empty || isAnimating) return;
    dismissHint();
    const w = viewportWidthRef.current || (typeof window !== "undefined" ? window.innerWidth : 1000);
    const offX = delta > 0 ? -w : w;  // next → current slides LEFT · prev → current slides RIGHT
    setIsAnimating(true);
    setDragDx(offX);
    window.setTimeout(() => {
      setIndex((i) => (i + delta + designs.length) % designs.length);
      // Snap centered · disable transition simultaneously so no visible reset
      setDragDx(0);
      setIsAnimating(false);
    }, 280);
  }, [designs.length, empty, isAnimating, dismissHint]);

  // Keyboard arrows
  useEffect(() => {
    if (chatOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(+1);
      if (e.key === "ArrowLeft")  go(-1);
      if (e.key === "Escape" && chatOpen) setChatOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, chatOpen]);

  // Auto-scroll the chat to the newest message when a message is added
  // OR when Nex starts thinking (so the "Nex is thinking…" indicator is visible).
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    // requestAnimationFrame ensures the layout has updated before scrolling
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length, sending]);

  // Preload adjacent images so swipes are instant · re-runs when index changes.
  useEffect(() => {
    if (typeof window === "undefined" || designs.length === 0) return;
    const nextI = (index + 1) % designs.length;
    const prevI = (index - 1 + designs.length) % designs.length;
    for (const i of new Set([nextI, prevI])) {
      if (i === index) continue;
      const img = new window.Image();
      img.src = designs[i].url;
    }
  }, [index, designs]);

  // Drag handlers · shared by touch + mouse. Drag itself has no transition
  // (finger follow 1:1). Release below threshold → smooth spring back. Release
  // above threshold → hand off to go() for full card-slide.
  function onDragStart(clientX: number) {
    if (isAnimating) return;
    dragStartXRef.current = clientX;
    setDragDx(0);
  }
  function onDragMove(clientX: number)  {
    if (dragStartXRef.current == null) return;
    setDragDx(clientX - dragStartXRef.current);
  }
  function onDragEnd() {
    if (dragStartXRef.current == null) return;
    const dx = dragDx;
    dragStartXRef.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      go(dx < 0 ? +1 : -1);
    } else {
      // Spring back to center
      setIsAnimating(true);
      setDragDx(0);
      window.setTimeout(() => setIsAnimating(false), 200);
    }
  }

  const focusedContext = useMemo(() => {
    if (!current) return "";
    const parts: string[] = [];
    parts.push(`design_id=${current.design_id}`);
    parts.push(`short_ref=${shortNexId(current.design_id)}`);   // Philip 2026-08-02 · customer-shareable ID
    if (current.title)             parts.push(`title="${current.title}"`);
    if (current.staircase_type)    parts.push(`type=${current.staircase_type}`);
    if (current.design_style)      parts.push(`style=${current.design_style}`);
    if (current.materials?.length) parts.push(`materials=[${current.materials.slice(0, 4).join(", ")}]`);
    parts.push(`image_state=${current.image_state}`);
    return parts.join(" · ");
  }, [current]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    // Philip 2026-08-02 · Nex-ID search · if the user typed "show me Nex005"
    // or bare "005", jump to that design in the viewer before dispatching to
    // the backend. The message is still forwarded to Nex so she can respond.
    const targetIdx = parseNexIdReference(text, designs);
    if (targetIdx != null && targetIdx !== index) {
      dismissHint();
      setIndex(targetIdx);
      setDragDx(0);
    }

    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text, when: Date.now() }]);
    setDraft("");
    try {
      const res = await fetch("/api/nex/staircase-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:                  text,
          conversation_id:          conversationIdRef.current,
          focused_design_context:   focusedContext,
        }),
      });
      const data = await res.json();
      const answer = typeof data?.answer === "string" ? data.answer : "";
      if (answer) setMessages((m) => [...m, { role: "assistant", content: answer, when: Date.now() }]);
      else        setMessages((m) => [...m, { role: "assistant", content: "I couldn't get a response just now — try again in a moment.", when: Date.now() }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network issue — please try again.", when: Date.now() }]);
    } finally {
      setSending(false);
    }
  }, [draft, focusedContext, sending, designs, index, dismissHint]);

  if (empty) {
    return (
      <div className="grid min-h-screen place-items-center bg-black text-white">
        <div className="text-center">
          <div className="text-[13px] uppercase tracking-widest text-neutral-400">Staircase Library</div>
          <div className="mt-2 text-[15px]">No confirmed staircases in the library yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white select-none">
      {/* Full-screen image · one at a time · swipe left/right */}
      <div
        className="absolute inset-0 flex items-center justify-center touch-pan-y"
        onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
        onTouchMove={(e)  => onDragMove(e.touches[0].clientX)}
        onTouchEnd={onDragEnd}
        onMouseDown={(e) => onDragStart(e.clientX)}
        onMouseMove={(e) => { if (dragStartXRef.current != null) onDragMove(e.clientX); }}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
      >
        {/* Philip 2026-08-02 · prev/current/next strip · fixes the "black
              flash between swipes" bug. All three images render simultaneously,
              positioned at translateX -100vw / 0 / +100vw plus the current
              dragDx. When the customer swipes, the current image slides off
              in one direction WHILE the adjacent image slides in from the
              opposite direction · no black gap. Each image is object-cover
              full-viewport so nothing crops or letterboxes. */}
        {[-1, 0, 1].map((offset) => {
          const idx = (index + offset + designs.length) % designs.length;
          const d = designs[idx];
          if (!d) return null;
          return (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`${d.design_id}-${offset}`}
              src={d.url}
              alt={d.title}
              width={d.width}
              height={d.height}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                transform:  `translateX(calc(${offset * 100}vw + ${dragDx}px))`,
                transition: isAnimating ? "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                willChange: "transform",
              }}
              draggable={false}
            />
          );
        })}
      </div>

      {/* Philip 2026-08-02 · Instagram-Stories-style progress bar · one segment
          per design · past + current filled white · upcoming dim. Sits ABOVE
          the Home button so both are visible together. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex gap-1 px-3">
        {designs.map((_, i) => (
          <div
            key={i}
            className="h-[3px] flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.22)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width:      i < index ? "100%" : i === index ? "100%" : "0%",
                background: "rgba(255,255,255,0.95)",
                opacity:    i <= index ? 1 : 0,
              }}
            />
          </div>
        ))}
      </div>

      {/* Philip 2026-08-02 · top-RIGHT Home button · black circle with orange
          Home icon. Moved from left → right this pass to free the top-left
          corner for the Nex-ID badge. */}
      <a
        href="/nex-app/brains/staircase?state=discover"
        className="absolute right-4 top-8 z-40 grid h-12 w-12 place-items-center rounded-full transition active:scale-95 hover:brightness-110"
        style={{
          background: "#000",
          boxShadow:  "0 6px 18px -6px rgba(0,0,0,0.6)",
        }}
        aria-label="Back to Nex landing"
      >
        <Home size={22} strokeWidth={2.25} color="#f59e0b" />
      </a>

      {/* Philip 2026-08-02 · top-LEFT Nex-ID badge · camera icon + short ID
          (e.g. "Nex005") · lets a customer share the exact design with a
          maker/company · the same code is searchable in the chat ("show me
          Nex005" or bare "005" jumps to that design). */}
      <div
        className="absolute left-4 top-8 z-40 flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1.5"
        style={{
          background: "#000",
          boxShadow:  "0 6px 18px -6px rgba(0,0,0,0.6)",
          color:      "#f59e0b",
        }}
        aria-label={`Design reference ${shortNexId(current.design_id)}`}
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-full"
          style={{ background: "rgba(245,158,11,0.15)" }}
          aria-hidden="true"
        >
          <Camera size={14} strokeWidth={2.25} color="#f59e0b" />
        </span>
        <span className="text-[13px] font-black tracking-wider" style={{ color: "#f59e0b" }}>
          {shortNexId(current.design_id)}
        </span>
      </div>

      {/* Left / Right chevrons for desktop */}
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous staircase"
        className="hidden md:grid absolute left-4 top-1/2 h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/70"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        onClick={() => go(+1)}
        aria-label="Next staircase"
        className="hidden md:grid absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/70"
      >
        <ChevronRight size={22} />
      </button>

      {/* Philip 2026-08-02 · onboarding swipe hint · centered gloved hand
          that slides left-then-right in a loop with fade · dismisses on the
          FIRST real swipe/arrow-nav and persists via localStorage. Uses
          pointer-events:none so it never intercepts the swipe gesture. */}
      {hintVisible && !chatOpen && designs.length > 1 && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-full px-3 py-3 backdrop-blur"
              style={{
                background: "rgba(0,0,0,0.55)",
                boxShadow: "0 10px 30px -8px rgba(0,0,0,0.5)",
              }}
            >
              <svg
                width="72"
                height="72"
                viewBox="0 0 72 72"
                fill="none"
                style={{ animation: "nex-swipe-hint 2.4s ease-in-out infinite" }}
                aria-hidden="true"
              >
                {/* Wristband — reads as glove cuff */}
                <rect x="18" y="52" width="36" height="12" rx="3"
                      fill="#d97706" stroke="#000" strokeWidth="1.6" />
                {/* Palm */}
                <rect x="20" y="28" width="30" height="26" rx="7"
                      fill="#f59e0b" stroke="#000" strokeWidth="1.6" />
                {/* Thumb */}
                <ellipse cx="15" cy="34" rx="5" ry="8"
                         fill="#f59e0b" stroke="#000" strokeWidth="1.6" />
                {/* Fingers · left-to-right */}
                <rect x="22" y="10" width="6" height="20" rx="3"
                      fill="#f59e0b" stroke="#000" strokeWidth="1.6" />
                <rect x="30" y="6"  width="6" height="24" rx="3"
                      fill="#f59e0b" stroke="#000" strokeWidth="1.6" />
                <rect x="38" y="8"  width="6" height="22" rx="3"
                      fill="#f59e0b" stroke="#000" strokeWidth="1.6" />
                <rect x="46" y="14" width="6" height="16" rx="3"
                      fill="#f59e0b" stroke="#000" strokeWidth="1.6" />
              </svg>
            </div>
            <div
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            >
              Swipe to explore
            </div>
          </div>
          {/* Keyframes scoped via a style block — matches the swipe motion:
              start centered · slide LEFT (indicates "swipe left for next") ·
              fade out · reset to center · repeat. */}
          <style>{`
            @keyframes nex-swipe-hint {
              0%   { transform: translateX(0);    opacity: 0; }
              15%  { transform: translateX(0);    opacity: 1; }
              55%  { transform: translateX(-70px); opacity: 1; }
              75%  { transform: translateX(-70px); opacity: 0; }
              100% { transform: translateX(0);    opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Philip 2026-08-02 · header shows a SHORT style tag ONLY.
          The confirmed-library stores rich descriptors (e.g.
          "contemporary luxury · industrial-modern · architectural centrepiece"
          OR the inconsistent space-separated "contemporary industrial luxury
          Scandinavian-influenced architectural sculpture"). Trim rule:
          1. Take everything before the first `·` if present
          2. If still >28 chars, keep only the first 3 words
          The full string stays available to Nex when the customer asks. */}
      {!chatOpen && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-6 pr-24">
          <h1
            className="text-[22px] font-black leading-tight text-white capitalize"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.85)" }}
          >
            {shortStyleLabel(current.design_style)}
          </h1>
          <p
            className="mt-1.5 text-[12px] font-semibold text-white/95"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.85)" }}
          >
            Ask Nex For Choice And Details
          </p>
        </div>
      )}

      {/* Philip 2026-08-02 · floating Nex button · hidden when chat is open
          (the slider owns close via its top-left orange X). Always shows the
          Nex avatar inside an orange rim ring when visible. */}
      {!chatOpen && (
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        aria-label="Ask Nex about this staircase"
        className="absolute bottom-6 right-6 z-30 grid h-16 w-16 place-items-center rounded-full transition active:scale-95"
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          padding:    "3px",
          boxShadow:  "0 10px 30px -8px rgba(245,158,11,0.6), 0 4px 10px rgba(0,0,0,0.5)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/staircase-images/nex-avatar.png"
          alt="Nex"
          className="h-full w-full rounded-full object-cover"
          style={{ background: "var(--nex-cream, #f5eedb)" }}
          draggable={false}
        />
      </button>
      )}

      {/* Philip 2026-08-02 · tap-outside-to-close backdrop · covers the image
          area ABOVE the slider · transparent so the design stays visible ·
          tapping anywhere on the image while chat is open closes the chat. */}
      {chatOpen && (
        <div
          className="absolute inset-x-0 top-0 z-15"
          style={{ bottom: "55vh" }}
          onClick={() => setChatOpen(false)}
          aria-label="Close Nex"
        />
      )}

      {/* Philip 2026-08-02 · chat slider panel */}
      {chatOpen && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex h-[55vh] max-h-[55vh] flex-col overflow-hidden rounded-t-3xl text-neutral-900 shadow-2xl"
          style={{ background: "var(--nex-cream-elev, #faf7ed)" }}
        >
          {/* Orange rim with running-light animation · sits flush at the top */}
          <div
            className="relative h-[3px] overflow-hidden"
            style={{ background: "linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #d97706 100%)" }}
          >
            <div
              className="absolute top-0 h-full w-1/4 rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)",
                animation: "nex-runner 2.4s linear infinite",
              }}
            />
          </div>

          {/* Philip 2026-08-02 · big right-side background removed · replaced
              with a small decorative accent in the bottom-right corner of the
              chat container (see below). */}

          {/* Philip 2026-08-02 · centered orange grab-bar handle · replaces the
              top-left close X · tap to close · same behaviour as tap-outside
              the slider (backdrop above the slider closes chat too). */}
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Close Nex"
            className="absolute left-1/2 top-2.5 z-30 h-[5px] w-12 -translate-x-1/2 rounded-full transition active:scale-90"
            style={{
              background: "linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #d97706 100%)",
              boxShadow:  "0 2px 6px -1px rgba(245,158,11,0.55)",
            }}
          />

          {/* Philip 2026-08-02 · persistent header · Nex avatar + "Ask Nex" +
              slogan · always visible while the chat is open, whether the log
              is empty or full. Sits below the grab bar, above the messages. */}
          <div className="relative z-10 flex items-center gap-3 border-b border-neutral-200/60 px-4 pt-6 pb-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                padding:    "2px",
                boxShadow:  "0 3px 8px -1px rgba(245,158,11,0.55)",
              }}
              aria-hidden="true"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/staircase-images/nex-avatar.png"
                alt=""
                className="h-full w-full rounded-full object-cover"
                style={{ background: "var(--nex-cream, #f5eedb)" }}
                draggable={false}
              />
            </div>
            <div>
              <h3 className="text-[18px] font-black leading-tight text-neutral-900">
                Ask Nex
              </h3>
              <p className="text-[13px] font-semibold leading-snug text-neutral-600">
                Any style, any material, any question.
              </p>
            </div>
          </div>

          {/* Chat container · takes ALL remaining slider height (flex-1)
              after the rim + persistent header + form. The header (with the
              Nex avatar + "Ask Nex" + slogan) sits above and is always
              visible, so no empty-state greeting is needed here. */}
          <div
            ref={chatScrollRef}
            className="relative z-10 flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-3 text-[14px]"
          >
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div
                    key={i}
                    className="ml-auto max-w-[85%] rounded-2xl bg-neutral-900 px-3 py-2 text-white"
                  >
                    {m.content}
                  </div>
                );
              }
              // Nex reply · small round Nex avatar with orange rim to the LEFT
              // of the bubble. items-start aligns the avatar with the top of
              // the bubble (Philip 2026-08-02).
              return (
                <div key={i} className="mr-auto flex max-w-[90%] items-start gap-2">
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      padding:    "2px",
                      boxShadow:  "0 2px 6px -1px rgba(245,158,11,0.5)",
                    }}
                    aria-hidden="true"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/staircase-images/nex-avatar.png"
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                      style={{ background: "var(--nex-cream, #f5eedb)" }}
                      draggable={false}
                    />
                  </div>
                  <div className="rounded-2xl bg-neutral-100 px-3 py-2">
                    {m.content}
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="mr-auto flex items-start gap-2">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    padding:    "2px",
                    boxShadow:  "0 2px 6px -1px rgba(245,158,11,0.5)",
                  }}
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/staircase-images/nex-avatar.png"
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                    style={{ background: "var(--nex-cream, #f5eedb)" }}
                    draggable={false}
                  />
                </div>
                <div className="text-[11px] text-neutral-400">Nex is thinking…</div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="relative z-10 flex items-end gap-2 border-t border-neutral-200/60 p-3 backdrop-blur"
            style={{ background: "rgba(250, 247, 237, 0.92)" }}
          >
            {/* Philip 2026-08-02 · multi-line textarea (3 rows) instead of a
                single-line input · Enter sends · Shift+Enter adds a newline. */}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={PLACEHOLDER_PROMPTS[placeholderIdx]}
              rows={3}
              className="flex-1 resize-none rounded-2xl border border-neutral-300 px-4 py-2.5 text-[14px] leading-snug outline-none focus:border-[#d97706]"
              style={{ background: "#ffffff" }}
              autoFocus
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-40"
              style={{ background: "#d97706", color: "white" }}
              aria-label="Send"
            >
              <Send size={18} strokeWidth={2} />
            </button>
          </form>

          <style>{`
            @keyframes nex-runner {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(500%); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
