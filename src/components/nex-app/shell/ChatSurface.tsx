"use client";

// ChatSurface — full-width slide-up chat per Design Language v1.1 §2 +
// Master Trade Template v1.1 §1.2. Overlays the canvas when open, back
// arrow returns to canvas without losing message history.

import { ArrowLeft, Mic, Send, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useConversationState } from "../state/ConversationStateProvider";
import { ChatToolTilesRow } from "./ChatToolTilesRow";
import { InlineComparisonCards } from "./InlineComparisonCards";
import type { WoodCardSummary } from "../state/ConversationStateProvider";

export function ChatSurface() {
  const { chatOpen, closeChat, history, sendUserMessage, config, state, canvasPayload, thinking } = useConversationState();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatOpen) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [chatOpen, history.length]);

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await sendUserMessage(text);
  }

  // Show/hide with slide + backdrop
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeChat}
        aria-hidden
        className="fixed inset-0 z-50 transition-opacity"
        style={{
          background: "rgba(15, 17, 21, 0.4)",
          opacity: chatOpen ? 1 : 0,
          pointerEvents: chatOpen ? "auto" : "none",
          transitionDuration: "var(--nex-motion-medium)",
          transitionTimingFunction: "var(--nex-ease-signature)"
        }}
      />

      {/* Surface */}
      <section
        role="dialog"
        aria-modal={chatOpen}
        aria-label="Nex conversation"
        className="fixed inset-x-0 bottom-0 top-0 z-[60] flex flex-col"
        style={{
          background: "var(--nex-cream)",
          transform: chatOpen ? "translateY(0%)" : "translateY(100%)",
          transitionProperty: "transform",
          transitionDuration: "var(--nex-motion-slow)",
          transitionTimingFunction: "var(--nex-ease-signature)"
        }}
      >
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
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close chat"
              className="grid h-9 w-9 place-items-center rounded-full"
              style={{ color: "var(--nex-neutral-700)" }}
            >
              <ArrowLeft size={22} strokeWidth={1.75} />
            </button>
            <NexAvatar size={40} />
            <div className="flex flex-col">
              <span className="text-[15px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
                NEX
              </span>
              <span className="text-[11px] leading-tight" style={{ color: "var(--nex-neutral-500)" }}>
                AI Assistant for {config.trade_slug === "staircase" ? "Master Carpentry" : config.trade_slug}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: "var(--nex-success-500)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--nex-success-500)" }} />
                Online
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Chat options"
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ color: "var(--nex-neutral-500)" }}
          >
            <MoreVertical size={20} strokeWidth={1.75} />
          </button>
        </header>

        {/* Merchant identity banner */}
        <MerchantIdentityBanner />

        {/* Message stream */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ background: "var(--nex-cream)" }}
        >
          {history.map((m) => (
            <ChatBubble
              key={m.id}
              role={m.role}
              content={m.content}
              timestamp={m.timestamp}
              woodCards={m.wood_cards}
            />
          ))}
          {thinking && <ThinkingIndicator />}
          {/* Inline UI card summoned by current state */}
          {state === "compare" && canvasPayload.variant === "styles" && (
            <InlineComparisonCards />
          )}
        </div>

        {/* Ask NEX input */}
        <div
          className="px-4 pt-3 pb-2"
          style={{ background: "var(--nex-cream)" }}
        >
          <div
            className="flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5"
            style={{
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)"
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder="Ask NEX anything about your project..."
              aria-label="Ask NEX"
              className="flex-1 bg-transparent py-2 text-[14px] outline-none placeholder:text-[color:var(--nex-neutral-400)]"
              style={{ color: "var(--nex-neutral-900)" }}
            />
            <button
              type="button"
              aria-label="Voice input"
              className="grid h-9 w-9 place-items-center rounded-full"
              style={{ color: "var(--nex-neutral-500)" }}
            >
              <Mic size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={submit}
              aria-label="Send"
              className="grid h-9 w-9 place-items-center rounded-full transition-transform active:scale-95"
              style={{
                background: "var(--nex-accent-500)",
                color: "var(--nex-neutral-0)"
              }}
            >
              <Send size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Tool tiles row */}
        <ChatToolTilesRow />
      </section>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function MerchantIdentityBanner() {
  const { config } = useConversationState();
  const merchant = config.placeholder_content.merchant;
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3"
         style={{ background: "var(--nex-neutral-0)", boxShadow: "var(--nex-shadow-sm)", border: "1px solid var(--nex-neutral-200)" }}>
      <div className="grid h-11 w-11 place-items-center rounded-lg"
           style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-700)" }}>
        <span className="text-[11px] font-black tracking-tight">{merchant.business_name.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
          Your {config.trade_slug === "staircase" ? "Carpentry" : config.trade_slug} Expert
        </div>
        <div className="mt-0.5 text-[11px] leading-tight" style={{ color: "var(--nex-neutral-500)" }}>
          Ask anything about your project, quotes, materials, design ideas or book a visit.
        </div>
      </div>
      <button
        type="button"
        className="flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
        style={{
          borderColor: "var(--nex-accent-500)",
          color: "var(--nex-accent-500)"
        }}
      >
        Company Profile
      </button>
    </div>
  );
}

function ChatBubble({
  role, content, timestamp, woodCards
}: {
  role: "user" | "nex";
  content: string;
  timestamp: number;
  woodCards?: WoodCardSummary[];
}) {
  const time = new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (role === "user") {
    return (
      <div className="mb-3 flex flex-col items-end">
        <span className="mb-1 pr-1 text-[10px]" style={{ color: "var(--nex-neutral-500)" }}>{time}</span>
        <div
          className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-[1.45]"
          style={{
            background: "var(--nex-accent-50)",
            color: "var(--nex-neutral-900)",
            borderBottomRightRadius: 6
          }}
        >
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-3 flex items-start gap-2">
      <NexAvatar size={32} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[12px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>NEX</span>
          <span className="text-[10px]" style={{ color: "var(--nex-neutral-500)" }}>{time}</span>
        </div>
        <NexStructuredResponse content={content} />
        {woodCards && woodCards.length > 0 && <WoodCardCarousel cards={woodCards} />}
      </div>
    </div>
  );
}

// ─── Thinking / typing indicator ──────────────────────────────────
//
// Rendered in the chat stream while Nex is generating a response
// (typically 2-5s while the LLM composes). Prevents the "is this
// broken?" perception when the send button clicks and nothing
// visibly happens.

function ThinkingIndicator() {
  return (
    <div className="mb-3 flex items-start gap-2">
      <NexAvatar size={32} />
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[12px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>NEX</span>
        </div>
        <div
          className="inline-flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{
            background: "var(--nex-neutral-0)",
            border: "1px solid var(--nex-neutral-200)",
            borderBottomLeftRadius: 6
          }}
        >
          <span className="flex gap-1" aria-hidden>
            <ThinkingDot delay={0} />
            <ThinkingDot delay={0.2} />
            <ThinkingDot delay={0.4} />
          </span>
          <span
            className="text-[12.5px]"
            style={{ color: "var(--nex-neutral-500)" }}
          >
            Nex is thinking…
          </span>
        </div>
      </div>
    </div>
  );
}

function ThinkingDot({ delay }: { delay: number }) {
  return (
    <span
      className="block rounded-full nex-thinking-dot"
      style={{
        width: 7,
        height: 7,
        background: "var(--nex-accent-500)",
        animationDelay: `${delay}s`
      }}
    />
  );
}

// ─── Nex structured response renderer ─────────────────────────────
//
// Per NEX UI RESPONSE BLUEPRINT: Nex responses arrive as structured
// markdown with named sections (## Overview / ## Key Information /
// ## Comparison / ## Recommendation / etc). Each section renders as
// a separate container card with orange bullets and generous spacing.
//
// Backwards-compatible: if the response has no ## sections it renders
// as a single Quick Answer container so old responses still display.

function NexStructuredResponse({ content }: { content: string }) {
  const containers = parseStructuredResponse(content);

  if (containers.length === 0) return null;

  return (
    <div className="flex flex-col" style={{ gap: 20 }}>
      {containers.map((c, i) =>
        c.type === "quick_answer"
          ? <QuickAnswerContainer key={i} text={c.text} />
          : <SectionContainer key={i} heading={c.heading} body={c.body} />
      )}
    </div>
  );
}

// ─── Container types ─────────────────────────────────────────────

type Container =
  | { type: "quick_answer"; text: string }
  | { type: "section"; heading: string; body: SectionBody[] };

type SectionBody =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "products"; items: ProductCardData[] };

type ProductCardData = {
  name:         string;
  material?:    string;
  style?:       string;
  tier?:        string;
  lead_time?:   string;
  imageUrl:     string;
};

// Section headings that signal the client to render bullets as
// product cards (pipe-delimited) instead of plain bullets.
const PRODUCT_SECTION_HEADINGS = /^(products|available options|range|related products|featured options|featured products|related items|matching options)$/i;

// ─── Parser ──────────────────────────────────────────────────────

function parseStructuredResponse(md: string): Container[] {
  const cleaned = md.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const containers: Container[] = [];
  const sectionSplit = cleaned.split(/\n(?=##\s)/);

  // First chunk (before the first ##) is the Quick Answer if present
  const first = sectionSplit[0];
  if (!first.startsWith("##")) {
    const quickText = first.trim();
    if (quickText) containers.push({ type: "quick_answer", text: quickText });
    sectionSplit.shift();
  }

  for (const chunk of sectionSplit) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith("##")) continue;
    const nlIdx = trimmed.indexOf("\n");
    const heading = trimmed
      .slice(2, nlIdx === -1 ? trimmed.length : nlIdx)
      .replace(/^#+/, "")
      .trim();
    const bodyText = nlIdx === -1 ? "" : trimmed.slice(nlIdx + 1).trim();
    const body = parseSectionBody(bodyText);
    // If this is a product-signalling section AND the body has bullets
    // that look pipe-delimited, upgrade them to product cards.
    const upgradedBody = PRODUCT_SECTION_HEADINGS.test(heading)
      ? upgradeBulletsToProducts(body)
      : body;
    containers.push({
      type: "section",
      heading,
      body: upgradedBody
    });
  }

  return containers;
}

// Convert any `bullets` body element whose items are pipe-delimited
// (e.g. "Oak Straight Staircase | Oak | Straight | Premium tier | 3-4 weeks")
// into a `products` element. Non-pipe bullets stay as bullets.
function upgradeBulletsToProducts(body: SectionBody[]): SectionBody[] {
  return body.flatMap((item): SectionBody[] => {
    if (item.type !== "bullets") return [item];
    const productItems: ProductCardData[] = [];
    const plainItems: string[] = [];
    for (const raw of item.items) {
      const parts = raw.split("|").map((s) => s.trim());
      if (parts.length >= 2) {
        productItems.push({
          name:      parts[0],
          material:  parts[1],
          style:     parts[2],
          tier:      parts[3],
          lead_time: parts[4],
          imageUrl:  productImageFor({ material: parts[1], style: parts[2] })
        });
      } else {
        plainItems.push(raw);
      }
    }
    const result: SectionBody[] = [];
    if (productItems.length > 0) result.push({ type: "products", items: productItems });
    if (plainItems.length > 0)   result.push({ type: "bullets",  items: plainItems });
    return result;
  });
}

// Pick a placeholder image for a product based on material or style.
// Uses the wood_gallery image URL where possible so oak/pine/walnut
// products get the right timber photo. Falls back to a stock stair
// photo for unknown materials.
function productImageFor(spec: { material?: string; style?: string }): string {
  const mat = (spec.material ?? "").toLowerCase();
  const style = (spec.style ?? "").toLowerCase();
  if (mat.includes("oak"))    return "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=400&q=80";
  if (mat.includes("walnut")) return "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=400&q=80";
  if (mat.includes("pine") || mat.includes("redwood") || mat.includes("softwood"))
                              return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80";
  if (style.includes("spiral") || mat.includes("metal") || mat.includes("steel"))
                              return "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&q=80";
  if (mat.includes("glass"))  return "https://images.unsplash.com/photo-1600566753104-685f4f24cb4d?w=400&q=80";
  return "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&q=80";
}

function parseSectionBody(text: string): SectionBody[] {
  if (!text) return [];
  const lines = text.split("\n");
  const body: SectionBody[] = [];
  let paragraph: string[] = [];
  let bullets: string[] | null = null;
  let tableLines: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length > 0) {
      body.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  }
  function flushBullets() {
    if (bullets && bullets.length > 0) {
      body.push({ type: "bullets", items: bullets });
      bullets = null;
    }
  }
  function flushTable() {
    if (tableLines && tableLines.length > 0) {
      const rows = tableLines
        .map((l) => l.trim())
        .filter((l) => /^\|.*\|$/.test(l))
        .map((l) => l.slice(1, -1).split("|").map((c) => c.trim()))
        // Drop separator rows (---)
        .filter((r) => !r.every((c) => /^:?-{3,}:?$/.test(c)));
      if (rows.length >= 2) {
        body.push({ type: "table", headers: rows[0], rows: rows.slice(1) });
      }
      tableLines = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") { flushParagraph(); flushBullets(); flushTable(); continue; }
    if (/^\|.*\|$/.test(line)) {
      flushParagraph(); flushBullets();
      if (!tableLines) tableLines = [];
      tableLines.push(line);
      continue;
    }
    const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      flushParagraph(); flushTable();
      if (!bullets) bullets = [];
      bullets.push(bulletMatch[1]);
      continue;
    }
    flushBullets(); flushTable();
    paragraph.push(line);
  }
  flushParagraph(); flushBullets(); flushTable();
  return body;
}

// ─── Container components ─────────────────────────────────────────

function QuickAnswerContainer({ text }: { text: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{
        background: "var(--nex-accent-50)",
        border: "1px solid var(--nex-accent-100)"
      }}
    >
      <p
        className="text-[14px] leading-[1.5]"
        style={{ color: "var(--nex-neutral-900)" }}
      >
        {renderPlain(text)}
      </p>
    </div>
  );
}

function SectionContainer({ heading, body }: { heading: string; body: SectionBody[] }) {
  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: "var(--nex-neutral-0)",
        border: "1px solid var(--nex-neutral-200)",
        boxShadow: "var(--nex-shadow-sm)"
      }}
    >
      <h4
        className="mb-3 text-[13px] font-bold uppercase tracking-wide"
        style={{ color: "var(--nex-neutral-900)", letterSpacing: "0.06em" }}
      >
        {heading}
      </h4>
      <div className="flex flex-col gap-3">
        {body.map((b, i) => {
          if (b.type === "paragraph") return (
            <p key={i} className="text-[13.5px] leading-[1.55]"
               style={{ color: "var(--nex-neutral-700)" }}>
              {renderPlain(b.text)}
            </p>
          );
          if (b.type === "bullets")  return <OrangeBullets key={i} items={b.items} />;
          if (b.type === "products") return <ProductCarousel key={i} items={b.items} />;
          return <ComparisonTable key={i} headers={b.headers} rows={b.rows} />;
        })}
      </div>
    </div>
  );
}

function ProductCarousel({ items }: { items: ProductCardData[] }) {
  const { transitionTo } = useConversationState();
  return (
    <div className="-mx-1">
      <div className="scrollbar-none flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((p, i) => (
          <div
            key={i}
            className="flex-none overflow-hidden rounded-xl"
            style={{
              width: 168,
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)"
            }}
          >
            <div className="relative h-28 w-full" style={{ background: "var(--nex-neutral-100)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="px-3 py-2.5">
              <div className="line-clamp-2 text-[12.5px] font-bold leading-tight"
                   style={{ color: "var(--nex-neutral-900)" }}>
                {p.name}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.material && (
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: "var(--nex-accent-100)", color: "var(--nex-accent-700)" }}>
                    {p.material}
                  </span>
                )}
                {p.style && (
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: "var(--nex-neutral-100)", color: "var(--nex-neutral-700)" }}>
                    {p.style}
                  </span>
                )}
              </div>
              {(p.tier || p.lead_time) && (
                <div className="mt-1.5 text-[10.5px] leading-tight"
                     style={{ color: "var(--nex-neutral-500)" }}>
                  {p.tier}{p.tier && p.lead_time ? " · " : ""}{p.lead_time}
                </div>
              )}
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => transitionTo("configure", { payload: { variant: "staircase", items: [p.name] } })}
                  className="flex-1 rounded-md px-2 py-1 text-[10.5px] font-semibold transition-transform active:scale-95"
                  style={{ background: "var(--nex-accent-500)", color: "var(--nex-neutral-0)" }}
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => transitionTo("price", { nexNarration: `Let me put together an estimate for the ${p.name.toLowerCase()}.` })}
                  className="flex-1 rounded-md px-2 py-1 text-[10.5px] font-semibold transition-transform active:scale-95"
                  style={{
                    background: "var(--nex-neutral-0)",
                    color: "var(--nex-neutral-700)",
                    border: "1px solid var(--nex-neutral-300)"
                  }}
                >
                  Quote
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrangeBullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-[7px] flex-shrink-0 rounded-full"
            style={{ width: 7, height: 7, background: "var(--nex-accent-500)" }}
          />
          <span
            className="text-[13.5px] leading-[1.5]"
            style={{ color: "var(--nex-neutral-700)" }}
          >
            {renderPlain(item)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ComparisonTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="min-w-full text-[13px]">
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--nex-neutral-200)"
            }}
          >
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-1.5 py-2 text-left font-semibold"
                style={{ color: "var(--nex-neutral-900)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr
              key={ri}
              style={{ borderBottom: ri < rows.length - 1 ? "1px solid var(--nex-neutral-100)" : "none" }}
            >
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className="px-1.5 py-2"
                  style={{ color: "var(--nex-neutral-700)" }}
                >
                  {renderPlain(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Plain-text renderer: strips any residual **bold** markers (the
// system prompt bans them but LLMs occasionally slip). No inline
// bold rendering — headings provide the emphasis per blueprint.
function renderPlain(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

// ─── Wood card carousel — inline horizontal image cards ───────────
function WoodCardCarousel({ cards }: { cards: WoodCardSummary[] }) {
  return (
    <div className="mt-2 -ml-10">
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-10 pb-1">
        {cards.map((c) => (
          <div
            key={c.id}
            className="flex-none overflow-hidden rounded-xl"
            style={{
              width: 140,
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)"
            }}
          >
            <div className="relative h-24 w-full" style={{ background: "var(--nex-neutral-100)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.imageUrl}
                alt={c.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-1">
                <span className="truncate text-[12px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
                  {c.name}
                </span>
                <span className="flex-shrink-0 text-[11px]" title={c.country}>{flagEmoji(c.flag)}</span>
              </div>
              <div className="mt-1 text-[10px]" style={{ color: "var(--nex-neutral-500)" }}>
                {c.jankaBand === "soft" ? "Soft" :
                 c.jankaBand === "medium" ? "Medium" :
                 c.jankaBand === "hard" ? "Hard" : "Very hard"}
                {" · "}
                {c.jankaLbf} lbf
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ISO country code → emoji flag. Handles two-letter codes + "EU".
function flagEmoji(code: string): string {
  if (!code) return "";
  if (code === "EU") return "🇪🇺";
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "";
  return String.fromCodePoint(...upper.split("").map((c) => 0x1F1A5 + c.charCodeAt(0)));
}

export function NexAvatar({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/nex-app/staircase/nex-avatar.png"
      alt="Nex"
      width={size}
      height={size}
      className="flex-shrink-0 rounded-full object-cover"
      style={{ width: size, height: size, background: "var(--nex-accent-50)" }}
    />
  );
}
