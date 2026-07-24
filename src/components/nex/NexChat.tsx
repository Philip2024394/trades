"use client";

// Nex Chat — the crown-jewel merchant surface.
// Merchant types "design my van" → Nex invokes the Studio, returns
// the asset URL + cost + follow-up suggestions. Every reply carries
// evidence (Studio id, page URL, or knowledge source).

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Send, Loader2, ArrowUpRight, ChevronRight, Car, CreditCard, Share2, Search, Palette, Clock, Home, ShoppingBag, MessageSquare, Save, LogOut } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BG_CREAM     = "#FBF6EC";

type ChatTurn = {
  role:        "merchant" | "nex";
  text:        string;
  originalMerchant?: string;              // for correction context (Nex turn only)
  result?:     { path?: string; asset_urls?: string[]; cost_pence?: number; prompt_used?: string; sources?: Array<{ id?: string; title: string }> };
  suggestions?: string[];
};

const STARTER_PROMPTS = [
  "Design my van",
  "Business cards to match",
  "Research UK staircase guidance",
  "What changed this week?"
];

// Six yellow shortcut buttons above the composer. Same spec as the
// site editor's canvas-toolbar buttons: h-14 w-14 square, rounded-lg,
// icon over 9px uppercase label. Sized for builders with big fingers.
const QUICK_ACTIONS: Array<{ label: string; prompt: string; icon: React.ReactNode }> = [
  { label: "Van",       prompt: "Design my van",                                        icon: <Car        size={18} strokeWidth={2.4}/> },
  { label: "Cards",     prompt: "Business cards to match my van",                       icon: <CreditCard size={18} strokeWidth={2.4}/> },
  { label: "Post",      prompt: "Create a Facebook post for my latest project",         icon: <Share2     size={18} strokeWidth={2.4}/> },
  { label: "Research",  prompt: "Research the latest UK regulations for my trade",      icon: <Search     size={18} strokeWidth={2.4}/> },
  { label: "Brand",     prompt: "Show my brand",                                        icon: <Palette    size={18} strokeWidth={2.4}/> },
  { label: "New",       prompt: "What changed this week?",                              icon: <Clock      size={18} strokeWidth={2.4}/> }
];

type BriefingSignal = { id: string; kind: string; priority: string; headline: string; action?: { label: string; href: string } };

export function NexChat({ merchantName, greeting, briefing, signals }: { merchantName: string; greeting?: string; briefing?: string | null; signals?: BriefingSignal[] }) {
  const openingText = greeting
    ? greeting
    : `Alright ${merchantName.split(" ")[0]}. Tell me what you need. Van, cards, brand tweaks. Or ask a trade question.`;
  // Signal actions become suggestion chips so a merchant can act
  // directly on what Nex noticed without typing.
  const openingSuggestions = signals && signals.length > 0
    ? signals.slice(0, 4).map((s) => s.action?.label ?? s.headline).filter(Boolean) as string[]
    : STARTER_PROMPTS;
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: "nex",
      text: openingText,
      suggestions: openingSuggestions
    }
  ]);
  // Suppress unused-var lint when briefing prop is passed but not read.
  void briefing;
  const [draft, setDraft]   = useState("");
  const [busy, setBusy]     = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const search = useSearchParams();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, busy]);

  // Optional prefill from ?prompt=... so quick-action tiles elsewhere
  // hand off cleanly. Fires once on mount.
  useEffect(() => {
    const p = search?.get("prompt");
    if (p && turns.length === 1) send(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text?: string) {
    const msg = (text ?? draft).trim();
    if (!msg || busy) return;
    setDraft("");
    setTurns((t) => [...t, { role: "merchant", text: msg }]);
    setBusy(true);
    try {
      const res = await fetch("/api/nex/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });
      const json = await res.json();
      if (json.ok) {
        setTurns((t) => [...t, {
          role: "nex",
          text: json.speak,
          originalMerchant: msg,
          result: json.result,
          suggestions: json.suggestions
        }]);
      } else {
        setTurns((t) => [...t, { role: "nex", text: `Something went sideways (${json.error}). Try again.` }]);
      }
    } catch {
      setTurns((t) => [...t, { role: "nex", text: "Network hiccup. Say it again." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: BG_CREAM }}>
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-black" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>N</span>
          <div>
            <p className="text-[13px] font-black leading-tight">Nex</p>
            <p className="text-[10px] leading-tight text-neutral-500">Your Trade OS assistant</p>
          </div>
          <div className="flex-1"/>
          <Link href="/studio/vault" className="text-[11px] font-black text-neutral-600 hover:text-neutral-900">Brand Vault →</Link>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {turns.map((t, i) => <ChatBubble key={i} turn={t} onSuggest={send}/>)}
          {busy && (
            <div className="flex items-center gap-2 text-[12px] text-neutral-500">
              <Loader2 size={13} className="animate-spin"/> Nex is working…
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-neutral-200 bg-white p-4">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask Nex…"
              disabled={busy}
              className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2 text-[16px] text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={busy || !draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-black disabled:opacity-40"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
            >
              <Send size={12}/> Send
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                type="button"
                onClick={() => send(qa.prompt)}
                disabled={busy}
                title={qa.prompt}
                className="flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition hover:brightness-95 disabled:opacity-40"
                style={{
                  backgroundColor: BRAND_YELLOW,
                  color:           BRAND_BLACK,
                  boxShadow:       "0 1px 2px rgba(255,179,0,0.25)"
                }}
              >
                {qa.icon}
                {qa.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Black nav footer — same spec as the site editor mobile action
          bar: 56px + safe-area, black bg, yellow icon+label per action. */}
      <div
        className="flex flex-none items-center justify-around border-t px-2"
        style={{
          height:          "calc(56px + env(safe-area-inset-bottom, 0px))",
          paddingBottom:   "env(safe-area-inset-bottom, 0px)",
          backgroundColor: BRAND_BLACK
        }}
      >
        <FooterBtn icon={<Home size={16}/>}           label="Home"    href="/studio/home"/>
        <FooterBtn icon={<Palette size={16}/>}        label="Vault"   href="/studio/vault"/>
        <FooterBtn icon={<Share2 size={16}/>}         label="Social"  href="/studio/social"/>
        <FooterBtn icon={<ShoppingBag size={16}/>}    label="Store"   href="/studio/store"/>
        <FooterBtn icon={<MessageSquare size={16}/>}  label="Nex"     href="/nex"/>
      </div>
    </div>
  );
}

function FooterBtn({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex h-11 min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[9px] font-black uppercase tracking-wider"
      style={{ color: BRAND_YELLOW }}
    >
      {icon}
      {label}
    </Link>
  );
}

function ChatBubble({ turn, onSuggest }: { turn: ChatTurn; onSuggest: (s: string) => void }) {
  const isNex = turn.role === "nex";
  return (
    <div className={"flex flex-col " + (isNex ? "items-start" : "items-end")}>
      <div
        className={"max-w-[85%] rounded-2xl px-4 py-2.5 text-[16px] leading-snug " +
          (isNex ? "bg-white text-neutral-900 shadow-sm" : "bg-neutral-900 text-white")}
      >
        {turn.text}
      </div>

      {turn.result?.asset_urls && turn.result.asset_urls.length > 0 && (
        <div className="mt-2 max-w-[85%] overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {turn.result.asset_urls[0].startsWith("b64:")
            ? <div className="grid h-48 place-items-center bg-neutral-50 text-[11px] text-neutral-500">base64 payload delivered</div>
            : <img src={turn.result.asset_urls[0]} alt="Generated" className="w-full"/>}
          {typeof turn.result.cost_pence === "number" && (
            <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500">
              Cost £{(turn.result.cost_pence / 100).toFixed(2)} · Recipe saved
            </p>
          )}
        </div>
      )}

      {turn.result?.path && (
        <Link
          href={turn.result.path}
          className="mt-2 inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-black text-neutral-700 hover:border-neutral-900"
        >
          Open <ArrowUpRight size={11}/>
        </Link>
      )}

      {turn.result?.sources && turn.result.sources.length > 0 && (
        <>
          <div className="mt-2 max-w-[85%] rounded-xl border border-neutral-200 bg-white p-2 text-[10px] text-neutral-500">
            <p className="font-black text-neutral-700">Sources</p>
            <ul className="mt-1 space-y-0.5">
              {turn.result.sources.map((s, i) => <li key={i}>· {s.title}</li>)}
            </ul>
          </div>
          <CorrectionButton
            entryId={turn.result.sources[0]?.id}
            originalMessage={turn.originalMerchant ?? ""}
            nexReply={turn.text}
          />
        </>
      )}

      {turn.suggestions && turn.suggestions.length > 0 && (
        <div className="mt-2 flex max-w-[85%] flex-wrap gap-1.5">
          {turn.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-black text-neutral-700 hover:border-neutral-900"
            >
              {s} <ChevronRight size={10}/>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrectionButton({ entryId, originalMessage, nexReply }: { entryId?: string; originalMessage: string; nexReply: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    if (!text.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/nex/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId, original_message: originalMessage, nex_reply: nexReply, correction: text })
      });
      const json = await res.json();
      setState(json.ok ? "sent" : "error");
    } catch { setState("error"); }
  }

  if (state === "sent") {
    return (
      <p className="mt-1 text-[10px] font-black text-green-700">
        Cheers. Nex sent that to review. Every merchant benefits when it lands.
      </p>
    );
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 text-[10px] font-black text-neutral-500 underline hover:text-neutral-900">
        That's not right
      </button>
    );
  }
  return (
    <div className="mt-2 max-w-[85%] rounded-xl border border-amber-300 bg-amber-50 p-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-amber-900">Tell Nex what's wrong</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="e.g. the landing spec should be 400mm not 300mm"
        className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-2 text-[12px]"
        autoFocus
      />
      <div className="mt-1 flex items-center gap-2">
        <button onClick={send} disabled={state === "sending" || !text.trim()} className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-black text-white disabled:opacity-40">
          {state === "sending" ? "Sending…" : "Submit correction"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[10px] font-black text-neutral-500">Cancel</button>
        {state === "error" && <span className="ml-auto text-[10px] font-black text-red-700">Try again</span>}
      </div>
    </div>
  );
}
