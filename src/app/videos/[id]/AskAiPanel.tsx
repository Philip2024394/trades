"use client";

// AskAiPanel — Ask-AI-about-this-video chat under the leaf player.
// Fires POST /api/videos/[id]/ask-ai with the user's question.
// Charges 1 washer per query for merchants; free for homeowners
// + anonymous (initial UX).
//
// Renders the Trade Knowledge Engine output:
//   · Conversational answer (Part 1 — always shown)
//   · Structured sections (Part 2 — collapsible "Full breakdown")
//   · Sources with origin badge (KB vs Web)
//   · Specialist CTA (when regs-sensitive)
//   · "Need this done?" recommender — live Networkers merchants
//     + trades matching the answer's topic categories
//
// Suggested questions come from the video's enriched metadata
// (video.suggested_questions) with a generic default set as
// fallback.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, Send, Loader2, AlertTriangle, CircleCheck,
  ExternalLink, UserCheck, ArrowUpRight, BookOpen, ChevronDown,
  ChevronUp, Store, Wrench, ShieldCheck, Globe
} from "lucide-react";

type Source = {
  title:     string;
  url:       string;
  origin:    "knowledge-base" | "web-search";
  publisher?: string;
};

type Sections = Partial<{
  summary:         string;
  technical:       string;
  bestPractice:    string;
  commonMistakes:  string;
  safety:          string;
  materials:       string;
  tools:           string;
  proTips:         string;
  standards:       string;
  whenYouNeedAPro: string;
}>;

type Recommendation = {
  slug:          string;
  display_name:  string;
  city:          string | null;
  tier:          string;
  primary_trade: string | null;
};

type Turn = {
  role:                "user" | "ai";
  text:                string;
  cost?:               number;
  sections?:           Sections | null;
  sources?:            Source[];
  knowledgeHitCount?:  number;
  needsSpecialist?:    boolean;
  specialistTrade?:    string | null;
  merchantCategories?: string[];
  tradeCategories?:    string[];
  merchants?:          Recommendation[];   // populated async after answer
  trades?:             Recommendation[];
  expandedDetails?:    boolean;
};

type Props = {
  videoId:             string;
  suggestedQuestions?: string[];
};

const DEFAULT_SUGGESTIONS = [
  "How much for a 4m by 4m slab?",
  "What tools were used?",
  "Do I need planning permission?",
  "What UK regulations apply?"
];

const SECTION_LABELS: Array<{ key: keyof Sections; label: string; icon: React.ReactNode }> = [
  { key: "summary",         label: "Summary",           icon: <BookOpen size={11}/>},
  { key: "technical",       label: "Technical",         icon: <Wrench size={11}/>},
  { key: "bestPractice",    label: "Best practice",     icon: <CircleCheck size={11}/>},
  { key: "commonMistakes",  label: "Common mistakes",   icon: <AlertTriangle size={11}/>},
  { key: "safety",          label: "Safety",            icon: <ShieldCheck size={11}/>},
  { key: "materials",       label: "Materials",         icon: <Store size={11}/>},
  { key: "tools",           label: "Tools",             icon: <Wrench size={11}/>},
  { key: "proTips",         label: "Pro tips",          icon: <Sparkles size={11}/>},
  { key: "standards",       label: "Standards",         icon: <BookOpen size={11}/>},
  { key: "whenYouNeedAPro", label: "When you need a pro", icon: <UserCheck size={11}/>}
];

export function AskAiPanel({ videoId, suggestedQuestions }: Props) {
  const suggestions = (suggestedQuestions && suggestedQuestions.length > 0)
    ? suggestedQuestions.slice(0, 4)
    : DEFAULT_SUGGESTIONS;

  const [question, setQuestion] = useState("");
  const [turns,    setTurns]    = useState<Turn[]>([]);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || q.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");

    const res = await fetch(`/api/videos/${videoId}/ask-ai`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q })
    });
    const json = await res.json().catch(() => ({ ok: false, error: "bad-response" }));
    setBusy(false);

    if (!json.ok) {
      if (json.error === "insufficient-balance") {
        setError(`Not enough washers (need ${json.cost}, have ${json.balance ?? 0}).`);
      } else {
        setError(json.error ?? "Something went wrong");
      }
      setTurns((prev) => prev.slice(0, -1));
      return;
    }

    const merchantCategories = Array.isArray(json.merchant_categories) ? json.merchant_categories : [];
    const tradeCategories    = Array.isArray(json.trade_categories)    ? json.trade_categories    : [];

    const newTurn: Turn = {
      role:               "ai",
      text:               json.answer,
      cost:               json.cost,
      sections:           json.sections ?? null,
      sources:            Array.isArray(json.sources) ? json.sources : undefined,
      knowledgeHitCount:  json.knowledge_hit_count ?? 0,
      needsSpecialist:    json.needs_specialist === true,
      specialistTrade:    json.specialist_trade ?? null,
      merchantCategories,
      tradeCategories
    };
    setTurns((prev) => [...prev, newTurn]);

    // Fire the recommender in the background — non-blocking
    if (merchantCategories.length > 0 || tradeCategories.length > 0) {
      loadRecommendations(merchantCategories, tradeCategories).then(({ merchants, trades }) => {
        setTurns((prev) => prev.map((t, idx) =>
          idx === prev.length - 1 && t.role === "ai"
            ? { ...t, merchants, trades }
            : t
        ));
      }).catch(() => undefined);
    }
  }

  function toggleDetails(turnIdx: number) {
    setTurns((prev) => prev.map((t, i) =>
      i === turnIdx ? { ...t, expandedDetails: !t.expandedDetails } : t
    ));
  }

  return (
    <section
      className="rounded-2xl border-2 p-5 shadow-sm md:p-6"
      style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "#0A0A0A" }}>
          <Sparkles size={14} strokeWidth={2.6} className="text-white"/>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Networkers AI · Trade Knowledge Engine
          </p>
          <p className="text-[13px] font-black text-neutral-900">Ask a question about this video</p>
        </div>
      </div>

      {/* Conversation thread */}
      {turns.length > 0 && (
        <ol className="mt-4 space-y-3">
          {turns.map((t, i) => (
            <li key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={t.role === "user" ? "max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed" : "w-full rounded-2xl px-4 py-3 text-[13px] leading-relaxed"}
                style={
                  t.role === "user"
                    ? { backgroundColor: "#0A0A0A", color: "#FFFFFF", borderTopRightRadius: 4 }
                    : { backgroundColor: "#FFFFFF", color: "#171717", border: "1px solid rgba(139,69,19,0.15)", borderTopLeftRadius: 4 }
                }
              >
                {/* Main conversational answer */}
                <p className="whitespace-pre-wrap">{t.text}</p>

                {/* KB citation badge — small + informative */}
                {t.role === "ai" && (t.knowledgeHitCount ?? 0) > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-700">
                    <BookOpen size={9}/> Grounded in {t.knowledgeHitCount} verified KB {t.knowledgeHitCount === 1 ? "entry" : "entries"}
                  </p>
                )}

                {/* Full breakdown — collapsible structured sections */}
                {t.role === "ai" && t.sections && Object.values(t.sections).some(Boolean) && (
                  <div className="mt-3 rounded-lg border" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                    <button
                      type="button"
                      onClick={() => toggleDetails(i)}
                      className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                    >
                      <span className="inline-flex items-center gap-1"><BookOpen size={11}/> Full breakdown</span>
                      {t.expandedDetails ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    </button>
                    {t.expandedDetails && (
                      <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                        {SECTION_LABELS.filter(s => t.sections?.[s.key]).map(s => (
                          <div key={s.key}>
                            <p className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-[0.20em] text-neutral-500">
                              {s.icon} {s.label}
                            </p>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-800 whitespace-pre-wrap">{t.sections![s.key]}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sources — separated by origin */}
                {t.role === "ai" && t.sources && t.sources.length > 0 && (
                  <div className="mt-3 border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                    <p className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
                      Sources
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {t.sources.map((s, si) => (
                        <li key={si}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10.5px] font-black text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
                          >
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[8px]"
                              style={{
                                backgroundColor: s.origin === "knowledge-base" ? "#FFB300" : "#166534",
                                color:           s.origin === "knowledge-base" ? "#0A0A0A" : "#FFFFFF"
                              }}
                            >
                              {s.origin === "knowledge-base" ? <BookOpen size={7}/> : <Globe size={7}/>}
                              {s.origin === "knowledge-base" ? "KB" : "Web"}
                            </span>
                            {s.title.length > 60 ? s.title.slice(0, 60) + "…" : s.title}
                            <ExternalLink size={9}/>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Need this done? — recommendations from KB categories */}
                {t.role === "ai" && ((t.merchants?.length ?? 0) > 0 || (t.trades?.length ?? 0) > 0) && (
                  <div className="mt-3 rounded-lg border-2 p-3" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
                    <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-900">
                      Need this done?
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-600">
                      Verified Networkers trades + merchants for this topic
                    </p>

                    {(t.trades?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Trades</p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {t.trades!.map(tr => (
                            <li key={tr.slug}>
                              <Link
                                href={`/${tr.slug}`}
                                className="inline-flex items-center gap-1 rounded-full border-2 bg-white px-2.5 py-1 text-[10.5px] font-black text-neutral-800 hover:-translate-y-0.5 transition"
                                style={{ borderColor: "rgba(0,0,0,0.15)" }}
                              >
                                <UserCheck size={9}/> {tr.display_name}
                                {tr.city && <span className="text-neutral-500 font-normal"> · {tr.city}</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(t.merchants?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Merchants + suppliers</p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {t.merchants!.map(m => (
                            <li key={m.slug}>
                              <Link
                                href={`/${m.slug}`}
                                className="inline-flex items-center gap-1 rounded-full border-2 bg-white px-2.5 py-1 text-[10.5px] font-black text-neutral-800 hover:-translate-y-0.5 transition"
                                style={{ borderColor: "rgba(0,0,0,0.15)" }}
                              >
                                <Store size={9}/> {m.display_name}
                                {m.city && <span className="text-neutral-500 font-normal"> · {m.city}</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Specialist CTA — regs-sensitive escalation */}
                {t.role === "ai" && t.needsSpecialist && (t.trades?.length ?? 0) === 0 && (
                  <div className="mt-3 rounded-lg border-2 p-2.5" style={{ borderColor: "#166534", backgroundColor: "#F0FDF4" }}>
                    <p className="text-[10.5px] font-black text-green-900">
                      Regs change + every project is different — connect me with a specialist{t.specialistTrade ? ` ${t.specialistTrade.replace(/-/g, " ")}` : ""} on Networkers.
                    </p>
                    <Link
                      href={t.specialistTrade ? `/trades/${t.specialistTrade}` : "/find"}
                      className="mt-2 inline-flex h-8 items-center gap-1 rounded-md px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm active:scale-[0.97]"
                      style={{ backgroundColor: "#166534" }}
                    >
                      <UserCheck size={10}/> Find a specialist <ArrowUpRight size={10}/>
                    </Link>
                  </div>
                )}

                {t.role === "ai" && (t.cost ?? 0) > 0 && (
                  <p className="mt-2 text-[9.5px] font-black uppercase tracking-wider text-neutral-400">
                    <CircleCheck size={9} className="mb-0.5 inline"/> {t.cost} washer spent
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Suggested questions */}
      {turns.length === 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Try one of these</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border-2 bg-white px-3 py-1.5 text-[11px] font-black text-neutral-800 hover:-translate-y-0.5 transition disabled:opacity-50"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
        className="mt-4 flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this video…"
          disabled={busy}
          maxLength={500}
          className="h-11 flex-1 rounded-lg border-2 bg-white px-3 text-[13px] text-neutral-900 disabled:opacity-50"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 4}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "#FFB300" }}
        >
          {busy ? <Loader2 size={13} className="animate-spin"/> : <Send size={13} strokeWidth={2.6}/>}
          Ask
        </button>
      </form>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border-2 p-2.5" style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-700"/>
          <p className="text-[11px] font-black text-red-900">{error}</p>
        </div>
      )}

      <p className="mt-3 text-[10.5px] text-neutral-500">
        Trades: 1 washer per question · Homeowners: free. Answers grounded in the Networkers Trade Knowledge Engine (verified trade knowledge from gov.uk, HSE, MPA, Concrete Centre, NHBC + trade bodies). Live UK-regs lookup when needed. Never fabricates.
      </p>
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

async function loadRecommendations(
  merchantCategories: string[],
  tradeCategories:    string[]
): Promise<{ merchants: Recommendation[]; trades: Recommendation[] }> {
  try {
    const res = await fetch("/api/knowledge/recommend", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ merchantCategories, tradeCategories, limit: 5 })
    });
    const json = await res.json();
    if (!json.ok) return { merchants: [], trades: [] };
    return {
      merchants: Array.isArray(json.merchants) ? json.merchants : [],
      trades:    Array.isArray(json.trades)    ? json.trades    : []
    };
  } catch {
    return { merchants: [], trades: [] };
  }
}
