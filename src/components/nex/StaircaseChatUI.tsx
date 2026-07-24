"use client";

// StaircaseChatUI — client chat component for /staircase-chat.
//
// Wood cards render inline once per session, each with a yellow eye
// icon that opens the full-screen Tinder-style gallery. In the gallery
// the user swipes / arrows between all wood cards mentioned in the
// conversation, with country + supplier-variance text top-right so it
// doesn't block the image. Close top-right dismisses back to chat.

import { useEffect, useRef, useState } from "react";

type Citation = {
  module:  string;
  ref_id:  string;
  snippet: string;
  source:  string;
};

type WoodCard = {
  id:         string;
  name:       string;
  country:    string;
  flag:       string;
  imageUrl:   string;
  strength:   string;
  popularity: string;
  notes:      string;
  jankaLbf:   number;
  jankaBand:  "soft" | "medium" | "hard" | "very-hard";
};

// Homeowner-friendly labels for the hardness band
const JANKA_BAND_LABEL: Record<WoodCard["jankaBand"], string> = {
  "soft":       "Soft",
  "medium":     "Medium",
  "hard":       "Hard",
  "very-hard":  "Very hard"
};
// Colour for the visual scale bar per band
const JANKA_BAND_COLOUR: Record<WoodCard["jankaBand"], string> = {
  "soft":       "#e8a15b",   // warm orange — softest
  "medium":     "#d4a548",   // gold
  "hard":       "#7ba05b",   // green
  "very-hard":  "#166534"    // deep green — hardest
};

type Message = {
  role:            "user" | "assistant";
  content:         string;
  citations?:      Citation[];
  woodsMentioned?: WoodCard[];
  woodsToShow?:    WoodCard[];
  status?:         string;
};

const FLAG_EMOJI: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", UK: "🇬🇧", IE: "🇮🇪",
  SE: "🇸🇪", FI: "🇫🇮", NO: "🇳🇴", DK: "🇩🇰",
  FR: "🇫🇷", DE: "🇩🇪", IT: "🇮🇹", ES: "🇪🇸",
  EU: "🇪🇺", CA: "🇨🇦", JP: "🇯🇵", AU: "🇦🇺", NZ: "🇳🇿"
};

const STARTER_PROMPTS = [
  "Tell me about American oak for a staircase",
  "What's the difference between mahogany and Sapele?",
  "Which timber is the most affordable for painted stairs?",
  "Explain the 100mm sphere rule for balustrades",
  "Do I need fire-line plasterboard for my loft conversion?"
];

export function StaircaseChatUI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welcome to Nex Staircases. You're now with my staircase specialist — I can help with design, stairparts, timber choices, regulations, product comparisons, supplier guidance, and technical advice from first ideas through to installation. What can I help you with today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const [shownWoodIds, setShownWoodIds] = useState<Set<string>>(new Set());
  // Gallery of ALL wood cards ever mentioned in this conversation — the
  // fullscreen modal navigates through this list.
  const [gallery, setGallery] = useState<WoodCard[]>([]);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  // Detected user expertise from the last server response
  const [detectedExpertise, setDetectedExpertise] = useState<{ level: "unknown" | "homeowner" | "trade"; confidence: number; signals: string[] }>({ level: "unknown", confidence: 0, signals: [] });
  // Manual override — user can flip if the detection got it wrong
  const [expertiseOverride, setExpertiseOverride] = useState<"unknown" | "homeowner" | "trade" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Keyboard navigation for fullscreen modal
  useEffect(() => {
    if (fullscreenIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreenIndex(null);
      else if (e.key === "ArrowLeft") navigateGallery(-1);
      else if (e.key === "ArrowRight") navigateGallery(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreenIndex, gallery.length]);

  function navigateGallery(delta: number) {
    setFullscreenIndex((prev) => {
      if (prev === null || gallery.length === 0) return prev;
      const next = (prev + delta + gallery.length) % gallery.length;
      return next;
    });
  }

  function openFullscreen(woodId: string) {
    const idx = gallery.findIndex((w) => w.id === woodId);
    if (idx !== -1) setFullscreenIndex(idx);
  }

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setError(null);

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const history = messages
      .filter((m, i) => i !== 0 || m.role !== "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/nex/staircase-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          expertise_override: expertiseOverride
        })
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      const woodsMentioned: WoodCard[] = data.wood_cards ?? [];
      const isComparison = !!data.comparison;
      // Normal rule: show only woods not yet shown this session.
      // Comparison override: when the user is comparing, show all
      // mentioned woods side by side even if some were shown before.
      const woodsToShow = isComparison
        ? woodsMentioned
        : woodsMentioned.filter((w) => !shownWoodIds.has(w.id));
      // Update detected expertise from server response
      if (data.expertise) {
        setDetectedExpertise({
          level:      data.expertise.level ?? "unknown",
          confidence: data.expertise.confidence ?? 0,
          signals:    data.expertise.signals ?? []
        });
      }

      if (woodsToShow.length > 0) {
        setShownWoodIds((prev) => {
          const next = new Set(prev);
          for (const w of woodsToShow) next.add(w.id);
          return next;
        });
        // Add any new woods to the gallery in order-of-first-appearance
        setGallery((prev) => {
          const existing = new Set(prev.map((w) => w.id));
          const additions = woodsToShow.filter((w) => !existing.has(w.id));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          woodsMentioned,
          woodsToShow,
          status: data.status
        }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleCitations(idx: number) {
    setExpandedCitations((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#e6ddc7] bg-[#FBF6EC] sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#166534]">Nex Staircases</h1>
            <p className="text-sm text-[#5a6b5a]">Specialist UK staircase knowledge · 1,000+ verified facts</p>
          </div>
          <div className="text-xs text-[#8a9585]">Admin test · not for public release</div>
        </div>
        {/* Expertise badge — visible once Nex has picked up signals */}
        {(detectedExpertise.level !== "unknown" || expertiseOverride) && (
          <ExpertiseBadge
            detected={detectedExpertise}
            override={expertiseOverride}
            onOverride={setExpertiseOverride}
          />
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  msg.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-[#166534] text-white px-4 py-3 shadow-sm"
                    : "max-w-[85%] rounded-2xl bg-white border border-[#e6ddc7] px-4 py-3 shadow-sm"
                }
              >
                <div className={msg.role === "user" ? "text-white" : "text-[#2a2a2a]"} style={{ whiteSpace: "pre-wrap" }}>
                  {msg.content}
                </div>

                {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#e6ddc7]">
                    <button
                      onClick={() => toggleCitations(i)}
                      className="text-xs text-[#5a6b5a] hover:text-[#166534] transition-colors inline-flex items-center gap-1"
                    >
                      <span className="text-[#166534]">◆</span>
                      {expandedCitations.has(i) ? "Hide official sources" : `Verify · ${msg.citations.length} official source${msg.citations.length === 1 ? "" : "s"}`}
                    </button>
                    {expandedCitations.has(i) && (
                      <div className="mt-2 space-y-2">
                        {msg.citations.map((c, j) => (
                          <div key={j} className="text-xs bg-[#FBF6EC] border border-[#e6ddc7] rounded p-2">
                            <div className="text-[#8a9585] mb-1">
                              {c.module} · {c.source}
                            </div>
                            <div className="text-[#4a4a4a]">{c.snippet}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* "See again" chips for woods already shown earlier in the session */}
                {msg.role === "assistant" && msg.woodsMentioned && msg.woodsMentioned.length > 0 && (() => {
                  const alreadyShown = msg.woodsMentioned.filter(
                    (w) => !msg.woodsToShow?.some((s) => s.id === w.id)
                  );
                  if (alreadyShown.length === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-[#e6ddc7]">
                      <div className="text-xs text-[#8a9585] mb-2">Take a closer look?</div>
                      <div className="flex flex-wrap gap-2">
                        {alreadyShown.map((w) => (
                          <button
                            key={w.id}
                            onClick={() => openFullscreen(w.id)}
                            className="text-xs px-3 py-1.5 rounded-full bg-[#FBF6EC] border border-[#e6ddc7] text-[#4a4a4a] hover:border-[#166534] hover:text-[#166534] transition-colors inline-flex items-center gap-1.5"
                          >
                            <span>{FLAG_EMOJI[w.flag] ?? "🌍"}</span>
                            <span>Open {w.name} card</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Wood cards inline — shown once per session */}
            {msg.role === "assistant" && msg.woodsToShow && msg.woodsToShow.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3 justify-start">
                {msg.woodsToShow.map((w) => (
                  <WoodCardTile key={w.id} card={w} onEyeClick={() => openFullscreen(w.id)} />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-white border border-[#e6ddc7] px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[#8a9585]">
                <div className="animate-pulse">Nex is thinking</div>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#8a9585] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-[#8a9585] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-[#8a9585] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-center">
            <div className="max-w-[85%] rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-red-700 text-sm">
              {error}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Starter prompts */}
      {messages.length === 1 && !loading && (
        <div className="px-4 pb-4">
          <div className="text-xs text-[#8a9585] mb-2">Try one of these to start:</div>
          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => send(prompt)}
                className="text-sm px-3 py-2 rounded-lg bg-white border border-[#e6ddc7] text-[#4a4a4a] hover:border-[#166534] hover:text-[#166534] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[#e6ddc7] bg-white px-4 py-4 sticky bottom-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Nex about staircases..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-lg border border-[#e6ddc7] bg-white text-[#2a2a2a] placeholder-[#8a9585] focus:outline-none focus:border-[#166534]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-lg bg-[#166534] text-white font-medium hover:bg-[#0f4a24] disabled:bg-[#8a9585] disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      {/* Fullscreen swipeable gallery modal */}
      {fullscreenIndex !== null && gallery[fullscreenIndex] && (
        <FullscreenGallery
          card={gallery[fullscreenIndex]}
          index={fullscreenIndex}
          total={gallery.length}
          onClose={() => setFullscreenIndex(null)}
          onPrev={() => navigateGallery(-1)}
          onNext={() => navigateGallery(1)}
        />
      )}
    </div>
  );
}

/** Small badge showing detected user expertise level with a manual
 *  override toggle. Appears in the header once Nex has picked up
 *  enough signal to classify. The user can flip it if the detection
 *  got it wrong — Nex will adapt tone on the next message. */
function ExpertiseBadge({
  detected,
  override,
  onOverride
}: {
  detected: { level: "unknown" | "homeowner" | "trade"; confidence: number; signals: string[] };
  override: "unknown" | "homeowner" | "trade" | null;
  onOverride: (v: "unknown" | "homeowner" | "trade" | null) => void;
}) {
  const [showControls, setShowControls] = useState(false);
  const effective = override ?? detected.level;

  const label = effective === "trade"
    ? "trade professional"
    : effective === "homeowner"
      ? "homeowner"
      : "figuring out";
  const icon = effective === "trade" ? "🔨" : effective === "homeowner" ? "🏠" : "…";
  const colour = effective === "trade" ? "#166534" : effective === "homeowner" ? "#c17817" : "#8a9585";

  return (
    <div className="mt-2 flex items-center justify-between text-xs">
      <button
        onClick={() => setShowControls((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[#5a6b5a] hover:text-[#166534] transition-colors"
      >
        <span>{icon}</span>
        <span>Speaking to you as a </span>
        <span className="font-medium" style={{ color: colour }}>{label}</span>
        {override && (
          <span className="text-[10px] text-[#8a9585]">(you set)</span>
        )}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
          <polyline points={showControls ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
        </svg>
      </button>
      {showControls && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOverride("homeowner")}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${
              effective === "homeowner"
                ? "bg-[#c17817] text-white"
                : "bg-white border border-[#e6ddc7] text-[#5a6b5a] hover:border-[#c17817]"
            }`}
          >
            🏠 Homeowner
          </button>
          <button
            onClick={() => onOverride("trade")}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${
              effective === "trade"
                ? "bg-[#166534] text-white"
                : "bg-white border border-[#e6ddc7] text-[#5a6b5a] hover:border-[#166534]"
            }`}
          >
            🔨 Trade / joiner
          </button>
          {override && (
            <button
              onClick={() => onOverride(null)}
              className="px-2 py-1 rounded text-[10px] bg-transparent text-[#8a9585] hover:text-[#166534]"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact wood card in the chat — image + eye icon + name +
 *  strength + popularity under the image. Click eye → fullscreen. */
function WoodCardTile({ card, onEyeClick }: { card: WoodCard; onEyeClick: () => void }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-[#e6ddc7] shadow-sm w-48 flex-shrink-0">
      <div className="relative">
        <img
          src={card.imageUrl}
          alt={`${card.name} staircase`}
          className="w-full h-64 object-cover"
          loading="lazy"
        />
        {/* Yellow eye icon top-right of image */}
        <button
          onClick={onEyeClick}
          aria-label={`Open full-screen view of ${card.name}`}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-[#FFD84D] hover:bg-[#FFC72C] shadow-md flex items-center justify-center transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
      <div className="bg-[#2a2a2a] text-white px-3 py-2 text-center">
        <div className="text-sm font-medium">{card.name}</div>
        <div className="text-xs text-[#c9c9c9] mt-0.5 flex items-center justify-center gap-1">
          <span>{card.country}</span>
          <span>{FLAG_EMOJI[card.flag] ?? "🌍"}</span>
        </div>
      </div>
      {/* Hardness visual scale + popularity strip */}
      <div className="px-3 py-2.5 text-[11px] leading-tight bg-[#FBF6EC] border-t border-[#e6ddc7]">
        <JankaScale jankaLbf={card.jankaLbf} band={card.jankaBand} />
        <div className="text-[#5a6b5a] mt-1.5">{card.popularity}</div>
      </div>
    </div>
  );
}

/** Compact visual hardness scale — bar with position marker + plain-
 *  English label. Homeowner sees at a glance where this wood sits on
 *  a soft-to-hard scale without needing to know what "Janka lbf" is.
 *  Bar covers 200-1800 lbf (covers all common staircase timbers). */
function JankaScale({ jankaLbf, band }: { jankaLbf: number; band: WoodCard["jankaBand"] }) {
  const MIN = 200;
  const MAX = 1800;
  const clamped = Math.max(MIN, Math.min(MAX, jankaLbf));
  const pct = ((clamped - MIN) / (MAX - MIN)) * 100;
  const colour = JANKA_BAND_COLOUR[band];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium" style={{ color: colour }}>{JANKA_BAND_LABEL[band]}</span>
        <span className="text-[#8a9585]">{jankaLbf} lbf hardness</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-[#e8a15b] via-[#d4a548] via-[#7ba05b] to-[#166534] overflow-visible">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
          style={{ left: `${pct}%`, transform: "translate(-50%, -50%)", backgroundColor: colour }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[#8a9585] mt-0.5">
        <span>Soft</span>
        <span>Hard</span>
      </div>
    </div>
  );
}

/** Fullscreen Tinder-style gallery modal. Swipe / arrow / button
 *  navigation between all woods mentioned in the conversation.
 *  Country + supplier-variance disclaimer sits top-right so the
 *  image itself isn't blocked. */
function FullscreenGallery({
  card, index, total, onClose, onPrev, onNext
}: {
  card: WoodCard;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.touches[0].clientX;
  }
  function onTouchEnd() {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) onNext();
    else onPrev();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={onClose}>
      {/* Close button — top right of viewport */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close full-screen view"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition-colors z-10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Wood details top-right (offset from close button) — country
          flag + supplier variance disclaimer. Positioned so it doesn't
          block the image. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-20 right-4 max-w-xs bg-white/10 backdrop-blur rounded-lg px-4 py-3 text-white text-xs z-10"
      >
        <div className="flex items-center gap-2 text-base font-medium">
          <span className="text-2xl">{FLAG_EMOJI[card.flag] ?? "🌍"}</span>
          <span>{card.country}</span>
        </div>
        <div className="mt-2 text-white/80 leading-relaxed">
          Country of origin varies by importer, mill, and agent. Ask your merchant for the specific batch source if it matters for the project.
        </div>
      </div>

      {/* Progress indicator top-left */}
      <div className="absolute top-6 left-6 text-white/80 text-sm z-10">
        {index + 1} / {total}
      </div>

      {/* Image + info card — the tinder-style centred card */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-black shadow-2xl"
      >
        <img
          src={card.imageUrl}
          alt={`${card.name} staircase in full detail`}
          className="w-full flex-1 object-contain bg-black"
          style={{ maxHeight: "calc(90vh - 130px)" }}
        />
        <div className="bg-[#2a2a2a] text-white px-6 py-4">
          <div className="text-xl font-medium text-center">{card.name}</div>
          <div className="text-sm text-[#c9c9c9] mt-1 text-center">{card.notes}</div>
          <div className="mt-3 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium" style={{ color: JANKA_BAND_COLOUR[card.jankaBand] }}>
                {JANKA_BAND_LABEL[card.jankaBand]} hardness
              </span>
              <span className="text-[#a0a0a0]">{card.jankaLbf} lbf Janka</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#e8a15b] via-[#d4a548] via-[#7ba05b] to-[#166534] overflow-visible">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow"
                style={{
                  left: `${((Math.max(200, Math.min(1800, card.jankaLbf)) - 200) / 1600) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: JANKA_BAND_COLOUR[card.jankaBand]
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#a0a0a0] mt-1">
              <span>Soft (dents easily)</span>
              <span>Very hard (wears well)</span>
            </div>
          </div>
          <div className="text-xs text-[#a0a0a0] mt-3 text-center">{card.popularity}</div>
        </div>
      </div>

      {/* Prev / Next arrow buttons — desktop */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            aria-label="Previous wood"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition-colors z-10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            aria-label="Next wood"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition-colors z-10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </>
      )}

      {/* Swipe hint on mobile — subtle text bottom */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs md:hidden">
          Swipe left or right for more woods
        </div>
      )}
    </div>
  );
}
