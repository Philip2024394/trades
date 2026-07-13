"use client";

// StudioBuilderShell — the split-pane AI app builder.
//
// Left rail:  prompt input + pipeline timeline + chat refinement (Phase 3)
// Centre:     status + action buttons (Accept & Publish / Edit)
// Right:      live iframe preview
//
// Pipeline flow:
//   1. Merchant types a prompt + optionally picks trade
//   2. POST /api/studio/ai/pipeline-v2 → pipeline result (journey,
//      layout, review plan, page set, chrome)
//   3. Result is stashed in-memory + we update the iframe src to
//      /studio/build/preview?pid=<sessionPid> so it renders the plan
//   4. Two big buttons: Accept & Publish → publish; Edit → open the
//      page-by-page refinement walkthrough (Phase 3 wires this up)

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import {
  Loader2,
  Play,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Send,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  MousePointer,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_AMBER, BRAND_GREEN, BRAND_RED } from "@/lib/brand/tokens";
import { InspectorRail } from "./InspectorRail";
import { TemplatePickerModal } from "./TemplatePickerModal";
import {
  isInspectorMessage,
  postToPreview,
  type InspectorMessage,
  type InspectorSelection
} from "@/lib/studio/ai/inspectorBus";

type Viewport = "desktop" | "tablet" | "mobile";

type Trade = { slug: string; label: string };

type PipelineStep = {
  step: number;
  id: string;
  kind: "llm" | "pure";
  ok: boolean;
  ms: number;
  detail?: string;
};

type ReviewAction = {
  id: "accept-publish" | "edit";
  label: string;
  primary: boolean;
  tone: "primary" | "secondary";
};

type JourneyPage = {
  id: string;
  required: boolean;
  purpose: string;
};

type PipelineResult = {
  ok: true;
  pipeline: {
    brand: { id: string };
    steps: PipelineStep[];
    usage: { inputTokens: number; outputTokens: number };
    discovery: unknown;
    intent: {
      audience: string;
      tone: string;
      style: string;
      urgency: string;
      goals: string[];
      wants: Record<string, boolean>;
      keywords: string[];
      confidence: number;
    } | null;
    journey: {
      slug: string;
      name: string;
      tagline: string;
      score: number;
      reasons: string[];
      pageSet: JourneyPage[];
      chrome: {
        stickyFooter?: { whatsapp?: boolean; call?: boolean };
        sidebarRail?: { reviews?: "left" | "right" | "off" };
      };
    } | null;
    layout: {
      slug: string;
      name: string;
      tagline: string;
      score: number;
      reasons: string[];
    } | null;
    review: {
      actions: ReviewAction[];
      branding: unknown;
      pages: unknown[];
      liveFeedPitch: string | null;
    } | null;
    prose: {
      merchantName: string;
      tradeSlug: string;
      pages: unknown[];
    } | null;
    assembledLayouts?: Record<string, { sections: unknown[]; rows: unknown[] }>;
  };
};

type PublishState = {
  status: "idle" | "publishing" | "success" | "error";
  publishedCount?: number;
  totalPages?: number;
  error?: string;
};

type Props = {
  brandId: string;
  trades: readonly Trade[];
  initialPrompt: string;
  initialTrade: string;
};

const YELLOW = BRAND_YELLOW;
const BLACK = BRAND_BLACK;
const AMBER = BRAND_AMBER;

export function StudioBuilderShell({
  brandId,
  trades,
  initialPrompt,
  initialTrade
}: Props): JSX.Element {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [tradeSlug, setTradeSlug] = useState(initialTrade);
  const [tradingName, setTradingName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [facebook, setFacebook] = useState("");
  const [otherLink, setOtherLink] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [yearsTrading, setYearsTrading] = useState("");
  const [accreditations, setAccreditations] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [whatWeDoBest, setWhatWeDoBest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineResult["pipeline"] | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [publish, setPublish] = useState<PublishState>({ status: "idle" });
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [heroCandidates, setHeroCandidates] = useState<
    Array<{ id: string; imageUrl: string; subject: string; score: number }>
  >([]);
  const [currentHeroImage, setCurrentHeroImage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Store the latest pipeline result on window so the iframe can read
  // it. This is intentional: passing large state through the URL is
  // ugly, and Supabase persistence lands in Phase 4.
  useEffect(() => {
    if (pipeline) {
      (window as unknown as {
        __studioBuilderPipeline?: unknown;
        __studioBuilderAudio?: { url: string; name: string } | null;
      }).__studioBuilderPipeline = pipeline;
      (window as unknown as { __studioBuilderAudio?: { url: string; name: string } | null }).__studioBuilderAudio =
        audioDataUrl ? { url: audioDataUrl, name: audioName ?? "audio" } : null;
      setPreviewKey((k) => k + 1);
    }
  }, [pipeline, audioDataUrl, audioName]);

  // Fetch hero candidates once we know the trade — feeds the Inspector's
  // Hero panel.
  useEffect(() => {
    const trade =
      (pipeline?.discovery as { tradeSlug?: string | null } | null)?.tradeSlug ?? null;
    if (!trade) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/studio/ai/hero-candidates?trade=${encodeURIComponent(trade)}`);
        const json = (await res.json()) as {
          ok: boolean;
          results?: Array<{ id: string; imageUrl: string; subject: string; score: number }>;
        };
        if (!cancelled && json.ok && Array.isArray(json.results)) {
          setHeroCandidates(json.results);
        }
      } catch {
        /* silent — inspector still works without candidates */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipeline?.discovery]);

  // Broadcast inspector mode into the iframe whenever it toggles or
  // the iframe reloads.
  useEffect(() => {
    postToPreview(iframeRef.current, { type: "inspector:mode", active: inspectorOpen });
  }, [inspectorOpen, previewKey]);

  // Listen for selection events from the iframe.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isInspectorMessage(event.data)) return;
      const msg = event.data as InspectorMessage;
      if (msg.type === "inspector:select") {
        setSelection(msg.selection);
        if (msg.selection.kind === "hero") {
          const cfg = msg.selection.config ?? {};
          const currentImg =
            (typeof cfg.backgroundImageUrl === "string" && cfg.backgroundImageUrl) ||
            (typeof cfg.imageUrl === "string" && cfg.imageUrl) ||
            (typeof cfg.image === "string" && cfg.image) ||
            null;
          setCurrentHeroImage(currentImg);
        }
      } else if (msg.type === "inspector:clear") {
        setSelection(null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const applyButtonColor = useCallback(
    (scope: "this" | "all" | "theme", color: string) => {
      postToPreview(iframeRef.current, {
        type: "inspector:apply",
        patch: { kind: "button-color", scope, color, instanceId: selection?.instanceId }
      });
    },
    [selection]
  );

  const applyHero = useCallback((imageUrl: string) => {
    setCurrentHeroImage(imageUrl);
    postToPreview(iframeRef.current, {
      type: "inspector:apply",
      patch: { kind: "hero-image", imageUrl }
    });
  }, []);

  const applyText = useCallback((patch: {
    targetRole?: string;
    content?: string;
    size?: string;
    weight?: number;
    color?: string;
    align?: "left" | "center" | "right";
  }) => {
    postToPreview(iframeRef.current, {
      type: "inspector:apply",
      patch: { kind: "text", ...patch }
    });
  }, []);

  const applyImage = useCallback((patch: { role: string; imageUrl: string }) => {
    postToPreview(iframeRef.current, {
      type: "inspector:apply",
      patch: { kind: "image", ...patch }
    });
  }, []);

  const runPipeline = useCallback(
    async (composedPrompt: string, templateId?: string | null) => {
      setError(null);
      setBusy(true);
      setPipeline({
        brand: { id: brandId },
        steps: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        discovery: null,
        intent: null,
        journey: null,
        layout: null,
        review: null,
        prose: null
      });
      try {
        const res = await fetch("/api/studio/ai/pipeline-stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: composedPrompt,
            tradeSlug: tradeSlug || undefined,
            templateId: templateId ?? undefined
          })
        });
        if (!res.ok || !res.body) {
          setError(`Stream failed: ${res.status}`);
          setBusy(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const runningSteps = new Map<number, PipelineStep>();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let event: unknown;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }
            const e = event as {
              type: string;
              step?: number;
              id?: string;
              kind?: "llm" | "pure";
              ok?: boolean;
              ms?: number;
              result?: unknown;
              attempts?: number;
              violationsRemaining?: number;
              pipeline?: PipelineResult["pipeline"];
              error?: string;
              detail?: string;
            };
            if (e.type === "step-start" && typeof e.step === "number" && e.id && e.kind) {
              runningSteps.set(e.step, {
                step: e.step,
                id: e.id,
                kind: e.kind,
                ok: false,
                ms: 0,
                detail: "running…"
              });
              setPipeline((prev) =>
                prev ? { ...prev, steps: Array.from(runningSteps.values()).sort((a, b) => a.step - b.step) } : prev
              );
            } else if (e.type === "step-done" && typeof e.step === "number" && e.id) {
              const detail =
                typeof e.attempts === "number" && e.attempts > 1
                  ? `${e.attempts} attempts (constitution retry)`
                  : undefined;
              runningSteps.set(e.step, {
                step: e.step,
                id: e.id,
                kind: (runningSteps.get(e.step)?.kind ?? "pure") as "llm" | "pure",
                ok: Boolean(e.ok),
                ms: Number(e.ms ?? 0),
                detail
              });
              setPipeline((prev) => {
                if (!prev) return prev;
                const next: PipelineResult["pipeline"] = {
                  ...prev,
                  steps: Array.from(runningSteps.values()).sort((a, b) => a.step - b.step)
                };
                if (e.step === 1 && e.result && typeof e.result === "object") {
                  const r = e.result as { discovery?: unknown };
                  if (r.discovery) next.discovery = r.discovery;
                }
                if (e.step === 2 && e.result) next.intent = e.result as PipelineResult["pipeline"]["intent"];
                if (e.step === 3 && e.result) next.journey = e.result as PipelineResult["pipeline"]["journey"];
                if (e.step === 4 && e.result) next.layout = e.result as PipelineResult["pipeline"]["layout"];
                return next;
              });
            } else if (e.type === "final" && e.pipeline) {
              setPipeline(e.pipeline);
            } else if (e.type === "error") {
              setError(String(e.detail ?? e.error ?? "pipeline error"));
            }
          }
        }
      } catch (e) {
        setError(`Network: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [brandId, tradeSlug]
  );

  const composedPrompt = useMemo(() => {
    const tradeLabel = trades.find((t) => t.slug === tradeSlug)?.label ?? "trade";
    const parts: string[] = [];
    if (tradingName.trim()) parts.push(`${tradingName.trim()} is a ${tradeLabel} business.`);
    else parts.push(`We're a ${tradeLabel} business.`);
    if (yearsTrading.trim()) parts.push(`We've been on the tools for ${yearsTrading.trim()} years.`);
    if (address.trim()) parts.push(`Based at ${address.trim()}.`);
    if (serviceAreas.trim()) parts.push(`We cover ${serviceAreas.trim()}.`);
    if (accreditations.trim()) parts.push(`Accreditations: ${accreditations.trim()}.`);
    if (contactNumber.trim()) parts.push(`Reachable on ${contactNumber.trim()}.`);
    if (email.trim()) parts.push(`Email ${email.trim()}.`);
    const socials: string[] = [];
    if (instagram.trim()) socials.push(`Instagram: ${instagram.trim()}`);
    if (tiktok.trim()) socials.push(`TikTok: ${tiktok.trim()}`);
    if (facebook.trim()) socials.push(`Facebook: ${facebook.trim()}`);
    if (otherLink.trim()) socials.push(`Web: ${otherLink.trim()}`);
    if (socials.length > 0) parts.push(`Find us on: ${socials.join(", ")}.`);
    if (whatWeDoBest.trim()) parts.push(`What we do best: ${whatWeDoBest.trim()}.`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join(" ");
  }, [
    tradingName, tradeSlug, trades, yearsTrading, address, serviceAreas,
    accreditations, contactNumber, email, instagram, tiktok, facebook,
    otherLink, whatWeDoBest, prompt
  ]);

  const canSubmit =
    tradingName.trim().length > 0 && tradeSlug !== "" && composedPrompt.length >= 8;

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!canSubmit) {
        setError("Add at least your trading name + trade type to continue.");
        return;
      }
      // Open the template picker before firing the pipeline — that's
      // Step 2 of the flow: user picks a template (or skips) and then
      // the pipeline runs seeded from that choice.
      setTemplatePickerOpen(true);
    },
    [canSubmit]
  );

  const onTemplateChosen = useCallback(
    async (templateId: string | null) => {
      setChosenTemplateId(templateId);
      setTemplatePickerOpen(false);
      setChatHistory([]);
      await runPipeline(composedPrompt, templateId);
    },
    [composedPrompt, runPipeline]
  );

  const onAcceptPublish = useCallback(async () => {
    const layouts = pipeline?.assembledLayouts;
    if (!layouts || Object.keys(layouts).length === 0) {
      setPublish({ status: "error", error: "No assembled layouts to publish yet." });
      return;
    }
    setPublish({ status: "publishing" });
    try {
      const res = await fetch("/api/studio/ai/publish-pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assembledLayouts: layouts, breakpoint: "default" })
      });
      const json = (await res.json()) as {
        ok: boolean;
        publishedCount?: number;
        totalPages?: number;
        error?: string;
      };
      if (!json.ok) {
        setPublish({ status: "error", error: json.error ?? "Publish failed" });
        return;
      }
      setPublish({
        status: "success",
        publishedCount: json.publishedCount,
        totalPages: json.totalPages
      });
    } catch (e) {
      setPublish({ status: "error", error: `Network: ${(e as Error).message}` });
    }
  }, [pipeline]);

  const onChatSend = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || busy || !pipeline?.journey) return;
    const newHistory = [
      ...chatHistory,
      { role: "user" as const, text: msg }
    ];
    setChatHistory(newHistory);
    setChatInput("");
    // Compose refinement prompt = original + all refinements so far.
    const refinements = newHistory
      .filter((m) => m.role === "user")
      .map((m) => `- ${m.text}`)
      .join("\n");
    const composed = `${prompt.trim()}\n\nAdditional refinements from the merchant:\n${refinements}`;
    await runPipeline(composed);
    setChatHistory((h) => [
      ...h,
      {
        role: "assistant",
        text: "Rebuilt with your refinement. Preview updated on the right."
      }
    ]);
  }, [chatHistory, chatInput, busy, pipeline, prompt, runPipeline]);

  const stepsRendered = pipeline?.steps ?? [];
  const hasResult = pipeline?.journey && pipeline?.layout;

  return (
    <div className="flex h-screen w-full flex-col bg-white text-slate-900">
      {/* Top strip */}
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 px-4">
        <button
          onClick={() => setLeftOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100"
          aria-label={leftOpen ? "Hide builder panel" : "Show builder panel"}
        >
          {leftOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
        </button>
        <div className="flex items-center gap-3">
          <img
            src="https://ik.imagekit.io/9mrgsv2rp/Untitledxcxzxczxc-removebg-preview.png"
            alt="The Network — App Builder"
            className="h-9 w-auto"
          />
          <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Beta
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Viewport toggle — mobile / tablet / desktop */}
          <div className="flex overflow-hidden rounded-md border border-slate-300">
            <button
              onClick={() => setViewport("mobile")}
              className="flex h-9 w-9 items-center justify-center"
              style={
                viewport === "mobile"
                  ? { backgroundColor: BLACK, color: "white" }
                  : { backgroundColor: "white", color: "#334155" }
              }
              aria-label="Mobile viewport"
            >
              <Smartphone size={16} />
            </button>
            <button
              onClick={() => setViewport("tablet")}
              className="flex h-9 w-9 items-center justify-center border-l border-slate-300"
              style={
                viewport === "tablet"
                  ? { backgroundColor: BLACK, color: "white" }
                  : { backgroundColor: "white", color: "#334155" }
              }
              aria-label="Tablet viewport"
            >
              <Tablet size={16} />
            </button>
            <button
              onClick={() => setViewport("desktop")}
              className="flex h-9 w-9 items-center justify-center border-l border-slate-300"
              style={
                viewport === "desktop"
                  ? { backgroundColor: BLACK, color: "white" }
                  : { backgroundColor: "white", color: "#334155" }
              }
              aria-label="Desktop viewport"
            >
              <Monitor size={16} />
            </button>
          </div>

          {/* Inspector toggle */}
          <button
            onClick={() => setInspectorOpen((v) => !v)}
            disabled={!hasResult}
            className="flex h-9 items-center gap-1 rounded-md border px-3 text-[13px] font-semibold disabled:opacity-40"
            style={
              inspectorOpen
                ? { backgroundColor: BLACK, color: "white", borderColor: BLACK }
                : { backgroundColor: "white", color: BLACK, borderColor: "#CBD5E1" }
            }
            title="Toggle Inspector — click any element on the preview to edit it"
          >
            <MousePointer size={14} />
            Inspector
          </button>

          {/* Export — downloads the full pipeline result as JSON */}
          <button
            onClick={() => {
              if (!pipeline) return;
              const blob = new Blob([JSON.stringify(pipeline, null, 2)], {
                type: "application/json"
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `the-network-app-${brandId.slice(0, 8)}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
            disabled={!hasResult}
            className="flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-900 disabled:opacity-40"
            title="Export app package to your computer"
          >
            <Download size={14} />
            Export
          </button>

          <span className="hidden text-[12px] text-slate-400 md:inline">
            {brandId.slice(0, 8)}
          </span>
        </div>
      </header>

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {leftOpen && !hasResult && (
          <aside className="flex w-[400px] flex-shrink-0 flex-col border-r border-slate-200 bg-white">
            <form onSubmit={onSubmit} className="flex h-full flex-col">
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-4">
                  <div className="text-[17px] font-bold text-slate-900">
                    Let's get you in The Network
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-slate-600">
                    Fill what you can — the more you give me, the better your app.
                    Skip anything you don't have. Come back any time and add more.
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <FieldGroup label="Trading name" required>
                    <input
                      type="text"
                      value={tradingName}
                      onChange={(e) => setTradingName(e.target.value)}
                      placeholder="e.g. Manchester Plumbing Co."
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                    />
                  </FieldGroup>

                  <FieldGroup label="Trade type" required>
                    <select
                      value={tradeSlug}
                      onChange={(e) => setTradeSlug(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                    >
                      <option value="">— pick your trade —</option>
                      {trades.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label="Years on the tools">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={yearsTrading}
                        onChange={(e) => setYearsTrading(e.target.value)}
                        placeholder="e.g. 12"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                      />
                    </FieldGroup>
                    <FieldGroup label="Contact number">
                      <input
                        type="tel"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="0161 555 0000"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                      />
                    </FieldGroup>
                  </div>

                  <FieldGroup label="Address / postcode">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. M1 4EN"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                    />
                  </FieldGroup>

                  <FieldGroup label="Service areas">
                    <input
                      type="text"
                      value={serviceAreas}
                      onChange={(e) => setServiceAreas(e.target.value)}
                      placeholder="e.g. Manchester, Salford, Trafford, M1–M40"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                    />
                  </FieldGroup>

                  <FieldGroup label="Email address">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hello@yourbusiness.co.uk"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="Accreditations"
                    hint="Gas Safe, NICEIC, CPCS, TrustMark — the ones that matter to your customers."
                  >
                    <input
                      type="text"
                      value={accreditations}
                      onChange={(e) => setAccreditations(e.target.value)}
                      placeholder="Gas Safe #123456, £5m public liability"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="What you do best"
                    hint="In your own words. Helps the AI write your About + Hero copy."
                  >
                    <textarea
                      value={whatWeDoBest}
                      onChange={(e) => setWhatWeDoBest(e.target.value)}
                      placeholder="Family-run since 2008. On the tools every day. Boiler swaps in a day. Straight talk."
                      className="min-h-[80px] w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] leading-relaxed focus:border-slate-900 focus:outline-none"
                    />
                  </FieldGroup>

                  {/* Socials */}
                  <div className="mt-1 border-t border-slate-200 pt-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Socials + links
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldGroup label="Instagram" compact>
                        <input
                          type="text"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          placeholder="@yourhandle"
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] focus:border-slate-900 focus:outline-none"
                        />
                      </FieldGroup>
                      <FieldGroup label="TikTok" compact>
                        <input
                          type="text"
                          value={tiktok}
                          onChange={(e) => setTiktok(e.target.value)}
                          placeholder="@yourhandle"
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] focus:border-slate-900 focus:outline-none"
                        />
                      </FieldGroup>
                      <FieldGroup label="Facebook" compact>
                        <input
                          type="text"
                          value={facebook}
                          onChange={(e) => setFacebook(e.target.value)}
                          placeholder="facebook.com/…"
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] focus:border-slate-900 focus:outline-none"
                        />
                      </FieldGroup>
                      <FieldGroup label="Website / other" compact>
                        <input
                          type="text"
                          value={otherLink}
                          onChange={(e) => setOtherLink(e.target.value)}
                          placeholder="yourbusiness.co.uk"
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] focus:border-slate-900 focus:outline-none"
                        />
                      </FieldGroup>
                    </div>
                  </div>

                  {/* Audio */}
                  <div className="mt-1 border-t border-slate-200 pt-3">
                    <FieldGroup
                      label="Music or voice-over"
                      hint="Plays once, 2 seconds after your visitor arrives."
                    >
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                        <span>{audioName ? "Change file" : "Choose MP3 / M4A / WAV"}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setAudioDataUrl(ev.target?.result as string);
                              setAudioName(file.name);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {audioName && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-[12px]">
                          <span className="truncate text-slate-700" title={audioName}>
                            {audioName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAudioDataUrl(null);
                              setAudioName(null);
                            }}
                            className="text-[11px] font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </FieldGroup>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                    {error}
                  </div>
                )}
              </div>

              {/* Save / Generate — pinned to the bottom of the aside */}
              <div className="flex-shrink-0 border-t border-slate-200 bg-white p-4">
                <button
                  type="submit"
                  disabled={busy || !canSubmit}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-bold disabled:opacity-50"
                  style={{ backgroundColor: YELLOW, color: BLACK }}
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Building your app…
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Save &amp; Generate App
                    </>
                  )}
                </button>
                <div className="mt-1.5 text-center text-[11px] text-slate-500">
                  You can come back and edit anything after publish.
                </div>
              </div>
            </form>
          </aside>
        )}

        {leftOpen && hasResult && (
          <aside className="flex w-[400px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50">
            {/* Timeline — visible only after a pipeline has run */}
            <div className="flex-1 overflow-y-auto p-4">
              {stepsRendered.length > 0 && (
                <>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Pipeline
                  </div>
                  <ol className="flex flex-col gap-2">
                    {stepsRendered.map((s) => (
                      <StepRow key={`${s.step}-${s.id}`} step={s} />
                    ))}
                  </ol>
                </>
              )}

              {pipeline?.intent && (
                <IntentCard intent={pipeline.intent} />
              )}
              {pipeline?.journey && (
                <JourneyCard journey={pipeline.journey} />
              )}
              {pipeline?.layout && (
                <LayoutCard layout={pipeline.layout} />
              )}

              {/* Chat refinement — appears once a pipeline result exists */}
              {hasResult && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <MessageSquare size={12} />
                    Refine with chat
                  </div>
                  {chatHistory.length > 0 && (
                    <div className="mb-2 flex flex-col gap-2">
                      {chatHistory.map((m, i) => (
                        <div
                          key={i}
                          className={`rounded-md p-2 text-[13px] ${m.role === "user" ? "border border-slate-200 bg-white text-slate-900" : "border-l-2 text-slate-700"}`}
                          style={m.role === "assistant" ? { borderLeftColor: YELLOW, backgroundColor: "#FFFCF0" } : {}}
                        >
                          {m.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Refinement chat — only visible after a pipeline has run */}
            <div className="flex-shrink-0 border-t border-slate-200 bg-white p-4">
              <form
                className="relative rounded-lg border border-slate-300 bg-white focus-within:border-slate-900"
              >
                <label className="mb-1 block px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Refine with a message
                </label>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onChatSend();
                    }
                  }}
                  placeholder="e.g. make the hero shorter, swap to a dark palette, add a booking section"
                  disabled={busy}
                  className="min-h-[100px] w-full resize-none rounded-lg bg-white px-3 pb-14 text-[14px] leading-relaxed outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={onChatSend}
                  disabled={busy || !chatInput.trim()}
                  className="absolute bottom-2 right-2 flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold disabled:opacity-50"
                  style={{ backgroundColor: YELLOW, color: BLACK }}
                >
                  {busy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Working…
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Refine
                    </>
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                  {error}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Right pane: preview iframe + action bar */}
        <main className="flex flex-1 flex-col bg-slate-100">
          <div className="flex-1 overflow-hidden p-4">
            {hasResult ? (
              <div className="mx-auto flex h-full items-start justify-center">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width:
                      viewport === "mobile"
                        ? "390px"
                        : viewport === "tablet"
                          ? "820px"
                          : "100%",
                    maxWidth: "100%"
                  }}
                >
                  <iframe
                    key={previewKey}
                    ref={iframeRef}
                    src={`/studio/build/preview?ts=${Date.now()}`}
                    title="Live app preview"
                    className="h-full w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                  />
                </div>
              </div>
            ) : (
              <EmptyPreview busy={busy} />
            )}
          </div>

          {publish.status === "error" && publish.error && (
            <div className="flex-shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-800">
              Publish failed: {publish.error}
            </div>
          )}
          {publish.status === "success" && (
            <div className="flex-shrink-0 border-t border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-medium text-emerald-800">
              Published {publish.publishedCount} of {publish.totalPages} pages. Your merchant profile is live.
            </div>
          )}
          {hasResult && pipeline?.review && (
            <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3">
              <button
                className="h-11 rounded-md border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-900 hover:bg-slate-50"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("studio-builder:edit"));
                }}
              >
                Edit — walk me through each page
              </button>
              <button
                disabled={publish.status === "publishing"}
                className="h-11 rounded-md px-4 text-[14px] font-semibold disabled:opacity-60"
                style={{ backgroundColor: YELLOW, color: BLACK }}
                onClick={onAcceptPublish}
              >
                {publish.status === "publishing"
                  ? "Publishing…"
                  : publish.status === "success"
                    ? `Published ✓ (${publish.publishedCount}/${publish.totalPages})`
                    : "Accept & Publish"}
              </button>
            </div>
          )}
        </main>

        <InspectorRail
          open={inspectorOpen}
          selection={selection}
          heroCandidates={heroCandidates}
          currentHeroImage={currentHeroImage}
          onClose={() => setInspectorOpen(false)}
          onApplyButtonColor={applyButtonColor}
          onApplyHero={applyHero}
          onApplyText={applyText}
          onApplyImage={applyImage}
        />
      </div>

      <TemplatePickerModal
        open={templatePickerOpen}
        tradeSlug={tradeSlug}
        onSelect={(id) => onTemplateChosen(id)}
        onSkip={() => onTemplateChosen(null)}
      />

      <div className="hidden">
      </div>
    </div>
  );
}

type WizardValues = {
  tradingName: string;
  tradeSlug: string;
  contactNumber: string;
  address: string;
  email: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  otherLink: string;
  audioName: string | null;
};

type WizardChange = {
  tradingName: (v: string) => void;
  tradeSlug: (v: string) => void;
  contactNumber: (v: string) => void;
  address: (v: string) => void;
  email: (v: string) => void;
  instagram: (v: string) => void;
  tiktok: (v: string) => void;
  facebook: (v: string) => void;
  otherLink: (v: string) => void;
  audio: (file: File | null) => void;
};

type WizardStepDef = {
  id: keyof WizardValues | "generate";
  title: string;
  description: string;
  required?: boolean;
  optional?: boolean;
  render: (props: {
    values: WizardValues;
    change: WizardChange;
    trades: readonly { slug: string; label: string }[];
  }) => JSX.Element;
  valid?: (values: WizardValues) => boolean;
};

const WIZARD_STEPS: WizardStepDef[] = [
  {
    id: "tradingName",
    title: "Trading name",
    description: "The name customers know you by. Shows in every hero and share.",
    required: true,
    valid: (v) => v.tradingName.trim().length > 0,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="text"
        value={values.tradingName}
        onChange={(e) => change.tradingName(e.target.value)}
        placeholder="e.g. Manchester Plumbing Co."
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "tradeSlug",
    title: "Trade type",
    description: "We tune the whole app — journey, layout, banner, copy — to your trade.",
    required: true,
    valid: (v) => v.tradeSlug !== "",
    render: ({ values, change, trades }) => (
      <select
        autoFocus
        value={values.tradeSlug}
        onChange={(e) => change.tradeSlug(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      >
        <option value="">— pick your trade —</option>
        {trades.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.label}
          </option>
        ))}
      </select>
    )
  },
  {
    id: "contactNumber",
    title: "Contact number",
    description: "Powers your Call and WhatsApp CTAs. Skip and we'll leave calling off.",
    optional: true,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="tel"
        value={values.contactNumber}
        onChange={(e) => change.contactNumber(e.target.value)}
        placeholder="e.g. 0161 555 0000"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "address",
    title: "Address or postcode",
    description: "Anchors your local SEO + coverage page. Postcode alone is enough.",
    optional: true,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="text"
        value={values.address}
        onChange={(e) => change.address(e.target.value)}
        placeholder="e.g. M1 4EN"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "email",
    title: "Email address",
    description: "Powers your Contact form receipts + newsletter capture.",
    optional: true,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="email"
        value={values.email}
        onChange={(e) => change.email(e.target.value)}
        placeholder="e.g. hello@yourbusiness.co.uk"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "instagram",
    title: "Instagram",
    description: "Shows in your footer + boosts social proof on the Home page.",
    optional: true,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="text"
        value={values.instagram}
        onChange={(e) => change.instagram(e.target.value)}
        placeholder="@yourhandle"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "tiktok",
    title: "TikTok",
    description: "For merchants doing on-the-tools videos — surfaces in the footer.",
    optional: true,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="text"
        value={values.tiktok}
        onChange={(e) => change.tiktok(e.target.value)}
        placeholder="@yourhandle"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "facebook",
    title: "Facebook",
    description: "Still the local-trades workhorse — surfaces in the footer.",
    optional: true,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="text"
        value={values.facebook}
        onChange={(e) => change.facebook(e.target.value)}
        placeholder="facebook.com/…"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "otherLink",
    title: "Anything else? (website / X / LinkedIn)",
    description: "Drop in any other link you want on your profile.",
    optional: true,
    render: ({ values, change }) => (
      <input
        autoFocus
        type="text"
        value={values.otherLink}
        onChange={(e) => change.otherLink(e.target.value)}
        placeholder="your website / etc"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-slate-900 focus:outline-none"
      />
    )
  },
  {
    id: "audioName",
    title: "Music or voice-over",
    description:
      "Plays once, 2 seconds after your visitor arrives. Upload an MP3, M4A or WAV.",
    optional: true,
    render: ({ values, change }) => (
      <div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-900 hover:bg-slate-50">
          <span>{values.audioName ? "Change file" : "Choose audio file"}</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => change.audio(e.target.files?.[0] ?? null)}
          />
        </label>
        {values.audioName && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-[12px]">
            <span className="truncate text-slate-700" title={values.audioName}>
              {values.audioName}
            </span>
            <button
              onClick={() => change.audio(null)}
              className="text-[11px] font-semibold text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    )
  },
  {
    id: "generate",
    title: "Ready to build?",
    description:
      "That's everything I need. Hit Generate App and I'll compose your Network profile.",
    render: () => <div />
  }
];

function BusinessWizard({
  step,
  onStepChange,
  values,
  onChange,
  trades,
  onGenerate,
  canSubmit,
  busy
}: {
  step: number;
  onStepChange: (n: number) => void;
  values: WizardValues;
  onChange: WizardChange;
  trades: readonly { slug: string; label: string }[];
  onGenerate: (event: FormEvent) => void;
  canSubmit: boolean;
  busy: boolean;
}): JSX.Element {
  const current = WIZARD_STEPS[step] ?? WIZARD_STEPS[0];
  const isLast = step === WIZARD_STEPS.length - 1;
  const isValid = current.valid ? current.valid(values) : true;

  const goNext = () => {
    if (!isValid) return;
    if (step < WIZARD_STEPS.length - 1) onStepChange(step + 1);
  };
  const goBack = () => {
    if (step > 0) onStepChange(step - 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[15px] font-bold text-slate-900">
          Let's get you in The Network
        </div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
          One question at a time. What you add activates on your app; what you skip stays off. You can jump back anytime.
        </div>
      </div>

      {/* Progress dots — click any completed step to jump back */}
      <div className="flex flex-wrap gap-1.5">
        {WIZARD_STEPS.map((s, i) => {
          const isActive = i === step;
          const isVisited = i < step;
          const dotVal = s.valid ? s.valid(values) : true;
          return (
            <button
              key={s.id}
              onClick={() => onStepChange(i)}
              className="h-2 rounded-full transition-all"
              style={{
                width: isActive ? 24 : 8,
                backgroundColor: isActive
                  ? BLACK
                  : isVisited && dotVal
                    ? YELLOW
                    : "#E2E8F0"
              }}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              title={s.title}
            />
          );
        })}
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>
          Step {step + 1} of {WIZARD_STEPS.length}
        </span>
        {current.required && (
          <span style={{ color: BRAND_RED }}>Required</span>
        )}
        {current.optional && <span className="text-slate-400">Optional</span>}
      </div>

      {/* Current question + description */}
      <div>
        <div className="text-[16px] font-bold text-slate-900">{current.title}</div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
          {current.description}
        </div>
      </div>

      {/* Input container at the bottom */}
      {!isLast && (
        <div>{current.render({ values, change: onChange, trades })}</div>
      )}

      {/* Actions */}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="flex h-10 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-900 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy || !canSubmit}
            className="ml-auto flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: YELLOW, color: BLACK }}
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Building…
              </>
            ) : (
              <>
                <Play size={14} />
                Generate App
              </>
            )}
          </button>
        ) : (
          <>
            {current.optional && (
              <button
                type="button"
                onClick={goNext}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-600 hover:text-slate-900"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!isValid}
              className="ml-auto flex h-10 items-center gap-1 rounded-md px-4 text-[13px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: YELLOW, color: BLACK }}
            >
              Save &amp; Next
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  hint,
  required,
  compact,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className={compact ? "" : ""}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span style={{ color: BRAND_RED }}> *</span>}
      </label>
      {children}
      {hint && (
        <div className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</div>
      )}
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type,
  required,
  compact
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  compact?: boolean;
}): JSX.Element {
  return (
    <div className={compact ? "mb-1" : ""}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span style={{ color: "#DC2626" }}> *</span>}
      </label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] focus:border-slate-900 focus:outline-none"
      />
    </div>
  );
}

function StepRow({ step }: { step: PipelineStep }): JSX.Element {
  const colour = step.ok ? BRAND_GREEN : BRAND_RED;
  return (
    <li className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
      <div
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: colour }}
      >
        {step.step}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          {step.id}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            {step.kind}
          </span>
          <span className="ml-auto text-[11px] font-normal text-slate-500">{step.ms} ms</span>
        </div>
        {step.detail && (
          <div className="mt-1 text-[12px] text-slate-600">{step.detail}</div>
        )}
      </div>
    </li>
  );
}

function IntentCard({
  intent
}: {
  intent: NonNullable<PipelineResult["pipeline"]["intent"]>;
}): JSX.Element {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Intent
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-slate-500">Audience</dt>
        <dd className="font-medium text-slate-900">{intent.audience}</dd>
        <dt className="text-slate-500">Tone</dt>
        <dd className="font-medium text-slate-900">{intent.tone}</dd>
        <dt className="text-slate-500">Style</dt>
        <dd className="font-medium text-slate-900">{intent.style}</dd>
        <dt className="text-slate-500">Urgency</dt>
        <dd className="font-medium text-slate-900">{intent.urgency}</dd>
      </dl>
      {intent.goals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {intent.goals.map((g) => (
            <span
              key={g}
              className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white"
            >
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function JourneyCard({
  journey
}: {
  journey: NonNullable<PipelineResult["pipeline"]["journey"]>;
}): JSX.Element {
  return (
    <div
      className="mt-3 rounded-md border p-3"
      style={{ borderColor: YELLOW, backgroundColor: "#FFFCF0" }}
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
        Journey
      </div>
      <div className="text-[14px] font-semibold text-slate-900">{journey.name}</div>
      <div className="mt-1 text-[13px] text-slate-700">{journey.tagline}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {journey.pageSet
          .filter((p) => p.required)
          .map((p) => (
            <span
              key={p.id}
              className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800"
              style={{ border: `1px solid ${YELLOW}` }}
            >
              {p.id}
            </span>
          ))}
      </div>
    </div>
  );
}

function LayoutCard({
  layout
}: {
  layout: NonNullable<PipelineResult["pipeline"]["layout"]>;
}): JSX.Element {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Layout
      </div>
      <div className="text-[14px] font-semibold text-slate-900">{layout.name}</div>
      <div className="mt-1 text-[13px] text-slate-600">{layout.tagline}</div>
    </div>
  );
}

function EmptyPreview({ busy }: { busy: boolean }): JSX.Element {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
      style={{
        backgroundImage:
          "url('https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2006_24_29%20PM.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100%"
      }}
    >
      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center text-white">
          <Loader2 size={32} color={YELLOW} className="mb-3 animate-spin" />
          <div className="text-[15px] font-semibold">Composing your app…</div>
          <div className="mt-1 max-w-sm text-[13px] text-slate-200">
            Detecting trade, extracting intent, picking journey, scoring layout, mapping pages…
          </div>
        </div>
      )}
    </div>
  );
}
