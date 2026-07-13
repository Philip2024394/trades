"use client";

// StudioBuilderPreviewCanvas — high-fidelity preview of the composed
// plan. Rendered inside the iframe on /studio/build/preview.
//
// Reads the pipeline result from `window.parent.__studioBuilderPipeline`
// (set by StudioBuilderShell). Renders:
//   • Every required page in the journey's pageSet
//   • The sticky WhatsApp footer (if journey.chrome.stickyFooter.whatsapp)
//   • The left review rail (if journey.chrome.sidebarRail.reviews === "left")
//   • Section skeletons keyed off each journey stage's primarySectionRoles
//
// Everything is trades-native by default — real UK trade copy in the
// placeholders, real accreditations, real footer content. No lorem ipsum.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Phone,
  Star,
  Shield,
  Award,
  Wrench,
  Hammer,
  Camera,
  MapPin,
  Mail,
  ChevronRight,
  Sparkles
} from "lucide-react";
import {
  BRAND_YELLOW,
  BRAND_BLACK,
  BRAND_AMBER,
  WHATSAPP_GREEN as WA_GREEN
} from "@/lib/brand/tokens";
import { StudioLiveShell } from "@/components/studio/StudioLiveShell";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import type { BrandTokens, MerchantData } from "@/lib/studio/sectionTypes";
import {
  isInspectorMessage,
  postToParent,
  type InspectorMessage,
  type InspectorSelection
} from "@/lib/studio/ai/inspectorBus";

type JourneyPage = { id: string; required: boolean; purpose: string };

type BespokePageCopy = {
  pageId: string;
  hero?: {
    eyebrow: string;
    headline: string;
    subhead: string;
    ctaPrimary: string;
    ctaSecondary?: string;
  };
  about?: {
    heading: string;
    story: string;
    stats: { label: string; value: string }[];
  };
  services?: {
    heading: string;
    items: { title: string; description: string; priceHint: string }[];
  };
  contact?: {
    heading: string;
    subhead: string;
    responsePromise: string;
  };
  projects?: { heading: string; subhead: string };
  faq?: { heading: string; items: { question: string; answer: string }[] };
  reviews?: { heading: string; subhead: string };
};

type AssembledLayoutJson = {
  sections: Array<{
    instanceId: string;
    key: string;
    config: Record<string, unknown>;
  }>;
  rows: Array<{ id: string; columns: string[] }>;
};

type PipelineStep = {
  step: number;
  id: string;
  ok: boolean;
  ms: number;
};

type PipelineFromWindow = {
  brand: { id: string };
  steps?: PipelineStep[];
  intent: {
    audience: string;
    tone: string;
    style: string;
    urgency: string;
    goals: string[];
  } | null;
  journey: {
    slug: string;
    name: string;
    tagline: string;
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
  } | null;
  discovery: {
    tradeSlug: string | null;
    merchantName: string | null;
  } | null;
  prose: {
    merchantName: string;
    tradeSlug: string;
    pages: BespokePageCopy[];
  } | null;
  assembledLayouts?: {
    home?: AssembledLayoutJson;
    about?: AssembledLayoutJson;
    contact?: AssembledLayoutJson;
    projects?: AssembledLayoutJson;
    services?: AssembledLayoutJson;
    faq?: AssembledLayoutJson;
    reviews?: AssembledLayoutJson;
    coverage?: AssembledLayoutJson;
    "product-grid"?: AssembledLayoutJson;
  };
};

const YELLOW = BRAND_YELLOW;
const BLACK = BRAND_BLACK;
const AMBER = BRAND_AMBER;
const WHATSAPP_GREEN = WA_GREEN;

const SAMPLE_REVIEWS = [
  { name: "Sarah T.", town: "Didsbury", rating: 5, text: "Turned up on time, sorted the leak in 20 minutes. Fair price." },
  { name: "James P.", town: "Chorlton", rating: 5, text: "Gas Safe cert on hand, explained everything, no surprises." },
  { name: "Priya K.", town: "Salford", rating: 5, text: "New boiler fitted in a day. Cleaner than when he started." }
];

const TOTAL_PIPELINE_STEPS = 12;

type TextOverride = {
  content?: string;
  size?: string;
  weight?: number;
  color?: string;
  align?: "left" | "center" | "right";
};

type InspectorOverridesCtx = {
  heroOverride: string | null;
  buttonOverride: string | null;
  textOverrides: Record<string, TextOverride>;
  imageOverrides: Record<string, string>;
};
const InspectorOverrides = createContext<InspectorOverridesCtx>({
  heroOverride: null,
  buttonOverride: null,
  textOverrides: {},
  imageOverrides: {}
});

const SIZE_CLASS: Record<string, string> = {
  xs: "text-[11px]",
  sm: "text-[12px]",
  base: "text-[14px]",
  lg: "text-[16px]",
  xl: "text-[20px]",
  "2xl": "text-[26px]",
  "3xl": "text-[32px]"
};

/** Apply a text override on top of a base value. */
export function useTextOverride(role: string, base: string): {
  content: string;
  style: React.CSSProperties;
  className: string;
} {
  const { textOverrides } = useContext(InspectorOverrides);
  const ov = textOverrides[role];
  const content = ov?.content ?? base;
  const style: React.CSSProperties = {};
  if (ov?.color) style.color = ov.color;
  if (ov?.weight) style.fontWeight = ov.weight;
  if (ov?.align) style.textAlign = ov.align;
  const className = ov?.size ? SIZE_CLASS[ov.size] ?? "" : "";
  return { content, style, className };
}

export function StudioBuilderPreviewCanvas(): JSX.Element {
  const [pipeline, setPipeline] = useState<PipelineFromWindow | null>(null);
  const [activePage, setActivePage] = useState<string>("home");
  const [inspectorActive, setInspectorActive] = useState(false);
  const [heroOverride, setHeroOverride] = useState<string | null>(null);
  const [buttonOverride, setButtonOverride] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ url: string; name: string } | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [textOverrides, setTextOverrides] = useState<Record<string, TextOverride>>({});
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    // The parent window (StudioBuilderShell) stashes the pipeline
    // result + audio config. We poll briefly to catch late updates.
    const read = () => {
      const w = window.parent as unknown as {
        __studioBuilderPipeline?: PipelineFromWindow;
        __studioBuilderAudio?: { url: string; name: string } | null;
      };
      if (w.__studioBuilderPipeline) setPipeline(w.__studioBuilderPipeline);
      const a = w.__studioBuilderAudio ?? null;
      setAudio((prev) => {
        // Only update state if the URL actually changed — avoids
        // restarting playback on every poll.
        if ((prev?.url ?? null) === (a?.url ?? null)) return prev;
        return a;
      });
    };
    read();
    const int = window.setInterval(read, 400);
    return () => window.clearInterval(int);
  }, []);

  // Audio autoplay — 2 second delay from arrival, plays once, no loop.
  useEffect(() => {
    if (!audio?.url) {
      setAudioPlaying(false);
      return;
    }
    setAudioMuted(false);
    const timer = window.setTimeout(() => {
      const el = audioElRef.current;
      if (!el) return;
      el.currentTime = 0;
      el.play().then(() => setAudioPlaying(true)).catch(() => {
        // Browsers may block autoplay without user gesture — user can
        // click the equalizer bars to start it manually.
        setAudioPlaying(false);
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [audio?.url]);

  const toggleAudio = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (audioMuted) {
      el.muted = false;
      setAudioMuted(false);
      if (el.paused) {
        el.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
      }
    } else {
      el.muted = true;
      setAudioMuted(true);
    }
  };

  // Reset to home whenever a new journey lands.
  useEffect(() => {
    if (pipeline?.journey) setActivePage("home");
  }, [pipeline?.journey?.slug]);

  // Listen to inspector messages from the parent shell.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isInspectorMessage(event.data)) return;
      const msg = event.data as InspectorMessage;
      if (msg.type === "inspector:mode") {
        setInspectorActive(msg.active);
        if (!msg.active) postToParent({ type: "inspector:clear" });
      } else if (msg.type === "inspector:apply") {
        const p = msg.patch as {
          kind?: string;
          color?: string;
          imageUrl?: string;
        };
        if (p.kind === "button-color" && typeof p.color === "string") {
          setButtonOverride(p.color);
        } else if (p.kind === "hero-image" && typeof p.imageUrl === "string") {
          setHeroOverride(p.imageUrl);
        } else if (p.kind === "image") {
          const t = msg.patch as { role?: string; imageUrl?: string };
          if (t.role && typeof t.imageUrl === "string") {
            setImageOverrides((prev) => ({ ...prev, [t.role as string]: t.imageUrl as string }));
          }
        } else if (p.kind === "text") {
          const t = msg.patch as {
            targetRole?: string;
            content?: string;
            size?: string;
            weight?: number;
            color?: string;
            align?: "left" | "center" | "right";
          };
          if (t.targetRole) {
            setTextOverrides((prev) => ({
              ...prev,
              [t.targetRole as string]: {
                ...prev[t.targetRole as string],
                content: t.content,
                size: t.size,
                weight: t.weight,
                color: t.color,
                align: t.align
              }
            }));
          }
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Click-in-inspector-mode: intercept clicks on data-inspector elements.
  useEffect(() => {
    if (!inspectorActive) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const el = target?.closest?.("[data-inspector-kind]") as HTMLElement | null;
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      const kind = el.dataset.inspectorKind as InspectorSelection["kind"];
      const label = el.dataset.inspectorLabel ?? "Element";
      const configRaw = el.dataset.inspectorConfig;
      let config: Record<string, unknown> | undefined;
      if (configRaw) {
        try {
          config = JSON.parse(configRaw) as Record<string, unknown>;
        } catch {
          config = undefined;
        }
      }
      postToParent({
        type: "inspector:select",
        selection: { kind, label, config }
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [inspectorActive]);

  // Loading — pipeline not yet complete. Show the hammer loader with
  // progress reflecting steps completed.
  if (!pipeline?.journey) {
    const stepsDone = pipeline?.steps?.length ?? 0;
    const percent = Math.round((stepsDone / TOTAL_PIPELINE_STEPS) * 100);
    const currentStepId =
      pipeline?.steps && pipeline.steps.length > 0
        ? pipeline.steps[pipeline.steps.length - 1].id
        : null;
    return <HammerLoader percent={percent} currentStepId={currentStepId} started={!!pipeline} />;
  }

  const journey = pipeline.journey;
  const merchantName =
    pipeline.prose?.merchantName ?? pipeline.discovery?.merchantName ?? "Your Business";
  const tradeSlug = pipeline.discovery?.tradeSlug ?? "trade";
  const assembledHome = pipeline.assembledLayouts?.home;
  const hasReviewRail = journey.chrome.sidebarRail?.reviews === "left";
  const hasStickyWhatsApp = journey.chrome.stickyFooter?.whatsapp === true;
  const hasStickyCall = journey.chrome.stickyFooter?.call === true;
  const requiredPages = journey.pageSet.filter((p) => p.required);
  const proseByPageId = new Map<string, BespokePageCopy>(
    (pipeline.prose?.pages ?? []).map((p) => [p.pageId, p])
  );

  return (
    <InspectorOverrides.Provider value={{ heroOverride, buttonOverride, textOverrides, imageOverrides }}>
    <div className="min-h-screen bg-slate-100 text-slate-900" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {inspectorActive && (
        <style>{`
          @keyframes inspector-glow {
            0%, 100% { box-shadow: 0 0 0 2px ${YELLOW}66, 0 0 12px ${YELLOW}55; }
            50%      { box-shadow: 0 0 0 3px ${YELLOW}CC, 0 0 20px ${YELLOW}88; }
          }
          [data-inspector-kind] {
            animation: inspector-glow 1.6s ease-in-out infinite;
            cursor: pointer;
            transition: transform 120ms ease;
          }
          [data-inspector-kind]:hover {
            transform: scale(1.02);
            outline: 2px solid ${YELLOW};
          }
        `}</style>
      )}
      {/* Hidden audio element — controlled by the effect above.
          onEnded resets playing state so equalizer bars stop. */}
      {audio?.url && (
        <audio
          ref={audioElRef}
          src={audio.url}
          onEnded={() => setAudioPlaying(false)}
          onPause={() => setAudioPlaying(false)}
          onPlay={() => setAudioPlaying(true)}
        />
      )}

      {/* Top nav — its page links are the page toggle */}
      <TopNav
        merchantName={merchantName}
        pages={requiredPages}
        activePage={activePage}
        onSelect={setActivePage}
        audioPlaying={audio?.url ? audioPlaying : false}
        audioMuted={audioMuted}
        audioLoaded={!!audio?.url}
        onToggleAudio={toggleAudio}
      />

      <div className="flex">
        {/* Left review rail — per user spec 2026-07-09 */}
        {hasReviewRail && <ReviewRail />}

        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6">
            {(() => {
              const activePageDef = requiredPages.find((p) => p.id === activePage) ?? requiredPages[0];
              if (!activePageDef) return null;
              const activeAssembled =
                pipeline.assembledLayouts?.[
                  activePageDef.id as keyof NonNullable<typeof pipeline.assembledLayouts>
                ];
              return (
                <PagePreview
                  page={activePageDef}
                  index={requiredPages.findIndex((p) => p.id === activePageDef.id)}
                  merchantName={merchantName}
                  tradeSlug={tradeSlug}
                  journeySlug={journey.slug}
                  bespoke={proseByPageId.get(activePageDef.id)}
                  assembledLayout={activeAssembled}
                  pipeline={pipeline}
                />
              );
            })()}
          </div>
        </main>
      </div>

      {/* Sticky footer — per user spec 2026-07-09 */}
      {(hasStickyWhatsApp || hasStickyCall) && (
        <StickyFooter whatsapp={hasStickyWhatsApp} call={hasStickyCall} />
      )}
    </div>
    </InspectorOverrides.Provider>
  );
}

function HammerLoader({
  percent,
  currentStepId,
  started
}: {
  percent: number;
  currentStepId: string | null;
  started: boolean;
}): JSX.Element {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: BLACK, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes hammer-swing {
          0%   { transform: rotate(-30deg); }
          40%  { transform: rotate(35deg); }
          55%  { transform: rotate(35deg); }
          65%  { transform: rotate(20deg); }
          100% { transform: rotate(-30deg); }
        }
        @keyframes anvil-hit {
          0%, 40%   { transform: translateY(0); }
          55%       { transform: translateY(2px); }
          70%       { transform: translateY(0); }
          100%      { transform: translateY(0); }
        }
        @keyframes bar-shimmer {
          0%   { background-position: -200px 0; }
          100% { background-position: 400px 0; }
        }
        .hammer-anim {
          transform-origin: 30% 90%;
          animation: hammer-swing 1.2s ease-in-out infinite;
        }
        .anvil-anim {
          animation: anvil-hit 1.2s ease-in-out infinite;
        }
        .shimmer {
          background: linear-gradient(90deg, ${YELLOW} 0%, #FFD966 50%, ${YELLOW} 100%);
          background-size: 200px 100%;
          animation: bar-shimmer 1.6s linear infinite;
        }
      `}</style>
      <div className="flex w-full max-w-md flex-col items-center px-6">
        <div className="relative mb-6 h-24 w-24">
          {/* Anvil */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 anvil-anim">
            <div
              className="h-4 w-16 rounded-sm"
              style={{ backgroundColor: "#4B5563" }}
            />
            <div
              className="mx-auto h-3 w-10 rounded-sm"
              style={{ backgroundColor: "#374151" }}
            />
          </div>
          {/* Hammer */}
          <div className="absolute inset-0 flex items-start justify-center">
            <div className="hammer-anim mt-2">
              <Hammer size={48} color={YELLOW} strokeWidth={2.4} />
            </div>
          </div>
        </div>

        <div className="mb-2 text-center text-[15px] font-bold text-white">
          {started ? "Building your app…" : "Preparing"}
        </div>
        <div className="mb-4 text-center text-[12px] text-slate-400">
          {currentStepId
            ? currentStepId.replace(/[._]/g, " ")
            : "Warming up the pipeline"}
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "#1F2937" }}
          >
            <div
              className="shimmer h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(6, percent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Composition pipeline</span>
            <span style={{ color: YELLOW }}>{percent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageTabs({
  pages,
  activePage,
  onSelect,
  assembled
}: {
  pages: JourneyPage[];
  activePage: string;
  onSelect: (id: string) => void;
  assembled: Record<string, unknown>;
}): JSX.Element {
  return (
    <div
      className="sticky top-0 z-20 flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2"
      style={{ borderBottomColor: "#E2E8F0" }}
    >
      {pages.map((p) => {
        const isActive = activePage === p.id;
        const isReady = Boolean(assembled[p.id]);
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition"
            style={
              isActive
                ? { backgroundColor: BLACK, color: "white" }
                : { backgroundColor: "#F1F5F9", color: "#334155" }
            }
          >
            <span>{pageLabel(p.id)}</span>
            {isReady && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: YELLOW }}
                aria-label="ready"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function buildPreviewTokens(): BrandTokens {
  return {
    "color.primary": BRAND_YELLOW,
    "color.primaryInk": BRAND_BLACK,
    "color.ink": BRAND_BLACK,
    "color.surface": "#FFFFFF",
    "color.accent": BRAND_AMBER,
    "typography.family.heading": "Inter, system-ui, sans-serif",
    "typography.family.body": "Inter, system-ui, sans-serif"
  };
}

function buildPreviewMerchantData(pipeline: PipelineFromWindow): MerchantData {
  const merchantName =
    pipeline.prose?.merchantName ?? pipeline.discovery?.merchantName ?? "Your Business";
  const slug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    merchantId: pipeline.brand.id,
    slug: slug || "preview",
    merchantName,
    city: "Manchester",
    whatsappHref: null,
    brandName: merchantName,
    brandId: pipeline.brand.id,
    domain: {}
  };
}

function AssembledLayoutSummary({
  layout
}: {
  layout: AssembledLayoutJson;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {layout.rows.map((row, rowIdx) => {
        const cols = row.columns
          .map((colId) => layout.sections.find((s) => s.instanceId === colId))
          .filter((s): s is NonNullable<typeof s> => Boolean(s));
        return (
          <div key={row.id} className="flex gap-2">
            {cols.map((section, colIdx) => (
              <div
                key={section.instanceId}
                className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Row {rowIdx + 1}
                  {cols.length > 1 ? ` · Col ${colIdx + 1}` : ""}
                </div>
                <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
                  {section.key}
                </div>
                {typeof section.config.headline === "string" &&
                  section.config.headline.length > 0 && (
                    <div className="mt-1 text-[12px] leading-relaxed text-slate-700">
                      "{section.config.headline}"
                    </div>
                  )}
                {typeof section.config.heading === "string" &&
                  section.config.heading.length > 0 &&
                  typeof section.config.headline !== "string" && (
                    <div className="mt-1 text-[12px] leading-relaxed text-slate-700">
                      "{section.config.heading}"
                    </div>
                  )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TopNav({
  merchantName,
  pages,
  activePage,
  onSelect,
  audioPlaying,
  audioMuted,
  audioLoaded,
  onToggleAudio
}: {
  merchantName: string;
  pages: JourneyPage[];
  activePage: string;
  onSelect: (id: string) => void;
  audioPlaying: boolean;
  audioMuted: boolean;
  audioLoaded: boolean;
  onToggleAudio: () => void;
}): JSX.Element {
  return (
    <nav
      className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4"
      style={{ borderBottomColor: "#E2E8F0" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ backgroundColor: BLACK }}
        >
          <Wrench size={16} color={YELLOW} />
        </div>
        <div className="text-[14px] font-bold text-slate-900">{merchantName}</div>
      </div>
      <div className="ml-6 flex gap-5 overflow-x-auto">
        {pages.map((p) => {
          const isActive = activePage === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="flex-shrink-0 text-[13px] font-medium transition"
              style={{
                color: isActive ? BLACK : "#64748B",
                borderBottom: isActive ? `2px solid ${YELLOW}` : "2px solid transparent",
                paddingBottom: "2px"
              }}
            >
              {pageLabel(p.id)}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {audioLoaded && (
          <EqualizerBars
            playing={audioPlaying && !audioMuted}
            muted={audioMuted}
            onClick={onToggleAudio}
          />
        )}
      </div>
    </nav>
  );
}

function EqualizerBars({
  playing,
  muted,
  onClick
}: {
  playing: boolean;
  muted: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="relative flex h-9 items-end gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 hover:border-slate-400"
      aria-label={muted ? "Unmute audio" : "Mute audio"}
      title={muted ? "Audio muted — click to unmute" : "Playing — click to mute"}
    >
      <style>{`
        @keyframes eq-bar-1 { 0%,100% { height: 30%; } 50% { height: 100%; } }
        @keyframes eq-bar-2 { 0%,100% { height: 80%; } 50% { height: 40%; } }
        @keyframes eq-bar-3 { 0%,100% { height: 50%; } 50% { height: 95%; } }
        .eq-bar { width: 3px; border-radius: 2px; }
        .eq-1 { animation: eq-bar-1 700ms ease-in-out infinite; }
        .eq-2 { animation: eq-bar-2 900ms ease-in-out infinite; }
        .eq-3 { animation: eq-bar-3 800ms ease-in-out infinite; }
      `}</style>
      <div className="flex h-5 items-end gap-1">
        <div
          className={`eq-bar ${playing ? "eq-1" : ""}`}
          style={{
            height: playing ? "100%" : "30%",
            backgroundColor: muted ? "#DC2626" : BLACK
          }}
        />
        <div
          className={`eq-bar ${playing ? "eq-2" : ""}`}
          style={{
            height: playing ? "80%" : "60%",
            backgroundColor: muted ? "#DC2626" : BLACK
          }}
        />
        <div
          className={`eq-bar ${playing ? "eq-3" : ""}`}
          style={{
            height: playing ? "60%" : "40%",
            backgroundColor: muted ? "#DC2626" : BLACK
          }}
        />
      </div>
      {muted && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className="h-[2px] w-[70%] rotate-[-25deg]"
            style={{ backgroundColor: "#DC2626" }}
          />
        </div>
      )}
    </button>
  );
}

function ReviewRail(): JSX.Element {
  return (
    <aside
      className="hidden w-[220px] flex-shrink-0 border-r border-slate-200 bg-white lg:block"
      aria-label="Reviews"
    >
      <div className="sticky top-14 p-4">
        <div className="mb-3 flex items-center gap-1">
          <Star size={14} fill={YELLOW} color={YELLOW} />
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Live Reviews
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {SAMPLE_REVIEWS.map((r) => (
            <div key={r.name} className="rounded-md border border-slate-200 p-3">
              <div className="mb-1 flex items-center gap-1">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} size={11} fill={YELLOW} color={YELLOW} />
                ))}
              </div>
              <div className="text-[12px] leading-relaxed text-slate-700">"{r.text}"</div>
              <div className="mt-1 text-[11px] font-medium text-slate-500">
                {r.name} · {r.town}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function PlanBanner({
  journey,
  layout,
  tradeSlug
}: {
  journey: PipelineFromWindow["journey"];
  layout: PipelineFromWindow["layout"];
  tradeSlug: string;
}): JSX.Element {
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-lg border p-3"
      style={{ borderColor: "#FDE68A", backgroundColor: "#FFFBEB" }}
    >
      <Sparkles size={18} color={AMBER} />
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-slate-900">
          Composing for a{" "}
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">
            {tradeSlug}
          </span>{" "}
          using the{" "}
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">
            {journey?.slug}
          </span>{" "}
          journey
          {layout && (
            <>
              {" "}
              with the{" "}
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">
                {layout.slug}
              </span>{" "}
              layout
            </>
          )}
          .
        </div>
        <div className="mt-0.5 text-[12px] text-slate-600">{journey?.tagline}</div>
      </div>
    </div>
  );
}

function PagePreview({
  page,
  index,
  merchantName,
  tradeSlug,
  journeySlug,
  bespoke,
  assembledLayout,
  pipeline
}: {
  page: JourneyPage;
  index: number;
  merchantName: string;
  tradeSlug: string;
  journeySlug: string;
  bespoke?: BespokePageCopy;
  assembledLayout?: AssembledLayoutJson;
  pipeline: PipelineFromWindow;
}): JSX.Element {
  return (
    <section
      id={page.id}
      className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      {assembledLayout ? (
        <StudioLiveShell
          layout={assembledLayout as StudioLayoutJson}
          tokens={buildPreviewTokens()}
          data={buildPreviewMerchantData(pipeline)}
        />
      ) : (
        <div className="p-4">{renderPage(page.id, merchantName, tradeSlug, journeySlug, bespoke)}</div>
      )}
    </section>
  );
}

function pageLabel(pageId: string): string {
  switch (pageId) {
    case "home":
      return "Home";
    case "about":
      return "About Us";
    case "contact":
      return "Contact";
    case "projects":
      return "Projects";
    case "services":
      return "Services";
    case "product-grid":
      return "Products";
    case "product-detail":
      return "Product Detail";
    case "cart":
      return "Cart";
    case "checkout":
      return "Checkout";
    case "faq":
      return "FAQ";
    case "reviews":
      return "Reviews";
    case "coverage":
      return "Coverage";
    default:
      return pageId;
  }
}

function renderPage(
  pageId: string,
  merchantName: string,
  tradeSlug: string,
  journeySlug: string,
  bespoke?: BespokePageCopy
): JSX.Element {
  switch (pageId) {
    case "home":
      return (
        <HomePreview
          merchantName={merchantName}
          tradeSlug={tradeSlug}
          journeySlug={journeySlug}
          bespoke={bespoke}
        />
      );
    case "about":
      return <AboutPreview merchantName={merchantName} tradeSlug={tradeSlug} bespoke={bespoke} />;
    case "contact":
      return <ContactPreview merchantName={merchantName} bespoke={bespoke} />;
    case "projects":
      return <ProjectsPreview bespoke={bespoke} />;
    case "services":
      return <ServicesPreview tradeSlug={tradeSlug} bespoke={bespoke} />;
    case "product-grid":
      return <ProductGridPreview />;
    case "faq":
      return <FaqPreview bespoke={bespoke} />;
    case "reviews":
      return <ReviewsPreview bespoke={bespoke} />;
    case "coverage":
      return <CoveragePreview />;
    default:
      return <div className="text-[13px] text-slate-500">Preview for {pageId} coming next.</div>;
  }
}

// ─── Page-specific previews ───────────────────────────────────

function HomePreview({
  merchantName,
  tradeSlug,
  journeySlug,
  bespoke
}: {
  merchantName: string;
  tradeSlug: string;
  journeySlug: string;
  bespoke?: BespokePageCopy;
}): JSX.Element {
  const isEmergency = journeySlug === "emergency-callout";
  const hero = bespoke?.hero;
  const heroEyebrow =
    hero?.eyebrow ??
    (isEmergency ? "24/7 Emergency Callout" : "Manchester · Gas Safe registered");
  const heroHeadline = hero?.headline ?? merchantName;
  const heroSubhead =
    hero?.subhead ??
    (isEmergency
      ? `Emergency ${tradeSlug} on call across Greater Manchester. £5m public liability. On-the-tools every day.`
      : `Local ${tradeSlug} — no ties or ribbons, straight talk, prices agreed up front.`);
  const heroPrimary =
    hero?.ctaPrimary ?? (isEmergency ? "Call Now — 0161 555 0000" : "Get a Quote");
  const heroSecondary = hero?.ctaSecondary ?? (isEmergency ? "WhatsApp Us" : "See our work");

  const { heroOverride, buttonOverride } = useContext(InspectorOverrides);
  const heroImageUrl = heroOverride;
  const buttonBg = buttonOverride ?? YELLOW;

  const eyebrowText = useTextOverride("hero.eyebrow", heroEyebrow);
  const headlineText = useTextOverride("hero.headline", heroHeadline);
  const subheadText = useTextOverride("hero.subhead", heroSubhead);

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <div
        data-inspector-kind="hero"
        data-inspector-label="Hero banner"
        data-inspector-config={JSON.stringify({
          backgroundImageUrl: heroImageUrl,
          headline: heroHeadline
        })}
        className="relative flex min-h-[240px] flex-col justify-end overflow-hidden rounded-md p-5 text-white"
        style={
          heroImageUrl
            ? {
                backgroundImage: `linear-gradient(135deg, ${BLACK}CC 0%, ${BLACK}66 60%, transparent 100%), url('${heroImageUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }
            : { background: `linear-gradient(135deg, ${BLACK} 0%, #1F2937 100%)` }
        }
      >
        <div
          data-inspector-kind="text"
          data-inspector-label="Hero eyebrow"
          data-inspector-config={JSON.stringify({ role: "hero.eyebrow", content: eyebrowText.content })}
          className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${eyebrowText.className}`}
          style={{ color: YELLOW, ...eyebrowText.style }}
        >
          {eyebrowText.content}
        </div>
        <div
          data-inspector-kind="text"
          data-inspector-label="Hero headline"
          data-inspector-config={JSON.stringify({ role: "hero.headline", content: headlineText.content })}
          className={`text-[24px] font-bold leading-tight ${headlineText.className}`}
          style={headlineText.style}
        >
          {headlineText.content}
        </div>
        <div
          data-inspector-kind="text"
          data-inspector-label="Hero subhead"
          data-inspector-config={JSON.stringify({ role: "hero.subhead", content: subheadText.content })}
          className={`mt-1 text-[14px] text-slate-200 ${subheadText.className}`}
          style={subheadText.style}
        >
          {subheadText.content}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            data-inspector-kind="button"
            data-inspector-label="Primary hero CTA"
            data-inspector-config={JSON.stringify({ label: heroPrimary })}
            className="h-10 rounded-md px-4 text-[13px] font-semibold"
            style={{ backgroundColor: buttonBg, color: BLACK }}
          >
            {heroPrimary}
          </button>
          <button
            data-inspector-kind="button"
            data-inspector-label="Secondary hero CTA"
            data-inspector-config={JSON.stringify({ label: heroSecondary })}
            className="h-10 rounded-md border border-white/40 bg-white/10 px-4 text-[13px] font-semibold text-white"
          >
            {heroSecondary}
          </button>
        </div>
      </div>

      {/* Trust bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Shield, label: "Gas Safe #123456" },
          { icon: Award, label: "£5m Public Liability" },
          { icon: Star, label: "4.9 · 127 reviews" },
          { icon: MapPin, label: "Greater Manchester" }
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
            <Icon size={14} color={AMBER} />
            <div className="text-[11px] font-semibold text-slate-700">{label}</div>
          </div>
        ))}
      </div>

      {/* Preview strip */}
      <div className="rounded-md bg-slate-50 p-3 text-[12px] text-slate-500">
        Section variants land here next as the pipeline finishes steps 5–14.
      </div>
    </div>
  );
}

function AboutPreview({
  merchantName,
  tradeSlug,
  bespoke
}: {
  merchantName: string;
  tradeSlug: string;
  bespoke?: BespokePageCopy;
}): JSX.Element {
  const about = bespoke?.about;
  const headingBase = about?.heading ?? "Who we are";
  const storyBase =
    about?.story ??
    `${merchantName} has been on the tools across Greater Manchester since 2008. We're a family-run ${tradeSlug} outfit — three of us, all fully qualified, all UK-trained. Gas Safe registered. Insured to £5m public liability. On the tools every day, so we know what makes a job go well.`;
  const heading = useTextOverride("about.heading", headingBase);
  const story = useTextOverride("about.story", storyBase);
  const stats =
    about?.stats && about.stats.length > 0
      ? about.stats
      : [
          { label: "Years on the tools", value: "17+" },
          { label: "Jobs completed", value: "3,240" },
          { label: "Repeat customers", value: "62%" }
        ];
  return (
    <div className="flex flex-col gap-3">
      <div
        data-inspector-kind="text"
        data-inspector-label="About heading"
        data-inspector-config={JSON.stringify({ role: "about.heading", content: heading.content })}
        className={`text-[16px] font-bold text-slate-900 ${heading.className}`}
        style={heading.style}
      >
        {heading.content}
      </div>
      <div
        data-inspector-kind="text"
        data-inspector-label="About story"
        data-inspector-config={JSON.stringify({ role: "about.story", content: story.content })}
        className={`text-[13px] leading-relaxed text-slate-700 ${story.className}`}
        style={story.style}
      >
        {story.content}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.slice(0, 3).map((s) => (
          <div key={s.label} className="rounded-md border border-slate-200 p-3 text-center">
            <div className="text-[22px] font-bold text-slate-900">{s.value}</div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactPreview({
  merchantName,
  bespoke
}: {
  merchantName: string;
  bespoke?: BespokePageCopy;
}): JSX.Element {
  const contact = bespoke?.contact;
  const headingBase = contact?.heading ?? "Get in touch";
  const subheadBase =
    contact?.subhead ?? "Ring, WhatsApp, or drop us a message — we usually reply within 1 working day.";
  const heading = useTextOverride("contact.heading", headingBase);
  const subhead = useTextOverride("contact.subhead", subheadBase);
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div
          data-inspector-kind="text"
          data-inspector-label="Contact heading"
          data-inspector-config={JSON.stringify({ role: "contact.heading", content: heading.content })}
          className={`mb-3 text-[16px] font-bold text-slate-900 ${heading.className}`}
          style={heading.style}
        >
          {heading.content}
        </div>
        <div
          data-inspector-kind="text"
          data-inspector-label="Contact subhead"
          data-inspector-config={JSON.stringify({ role: "contact.subhead", content: subhead.content })}
          className={`mb-3 text-[13px] text-slate-700 ${subhead.className}`}
          style={subhead.style}
        >
          {subhead.content}
        </div>
        <div className="flex flex-col gap-2">
          {[
            { icon: Phone, label: "0161 555 0000", tone: "phone" },
            { icon: MessageCircle, label: "WhatsApp us", tone: "wa" },
            { icon: Mail, label: `hello@${merchantName.toLowerCase().replace(/\s+/g, "")}.co.uk`, tone: "email" }
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
              <Icon size={14} color={AMBER} />
              <div className="text-[13px] font-medium text-slate-900">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[13px] font-semibold text-slate-900">Quote form</div>
        <div className="flex flex-col gap-2">
          <div className="h-9 rounded-md border border-slate-200 bg-slate-50" />
          <div className="h-9 rounded-md border border-slate-200 bg-slate-50" />
          <div className="h-20 rounded-md border border-slate-200 bg-slate-50" />
          <button
            className="h-10 rounded-md text-[13px] font-semibold"
            style={{ backgroundColor: YELLOW, color: BLACK }}
          >
            Send enquiry
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectsPreview({ bespoke }: { bespoke?: BespokePageCopy }): JSX.Element {
  const projectsCopy = bespoke?.projects;
  const heading = useTextOverride("projects.heading", projectsCopy?.heading ?? "Our work");
  const subhead = useTextOverride("projects.subhead", projectsCopy?.subhead ?? "");
  const projects = [
    { title: "Full bathroom refit — Chorlton", tag: "Bathroom · £6,200 · 5 days" },
    { title: "New boiler + smart thermostat — Didsbury", tag: "Heating · £2,850 · 1 day" },
    { title: "Emergency leak repair — Salford", tag: "Emergency · Same-day" },
    { title: "Under-floor heating — Altrincham", tag: "Heating · £4,900 · 3 days" }
  ];
  return (
    <div className="flex flex-col gap-3">
      {projectsCopy && (
        <div>
          <div
            data-inspector-kind="text"
            data-inspector-label="Projects heading"
            data-inspector-config={JSON.stringify({ role: "projects.heading", content: heading.content })}
            className={`text-[16px] font-bold text-slate-900 ${heading.className}`}
            style={heading.style}
          >
            {heading.content}
          </div>
          {subhead.content && (
            <div
              data-inspector-kind="text"
              data-inspector-label="Projects subhead"
              data-inspector-config={JSON.stringify({ role: "projects.subhead", content: subhead.content })}
              className={`mt-1 text-[13px] text-slate-700 ${subhead.className}`}
              style={subhead.style}
            >
              {subhead.content}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {projects.map((p, idx) => (
          <div key={p.title} className="overflow-hidden rounded-md border border-slate-200">
            <ProjectImageSlot role={`projects.image[${idx}]`} title={p.title} />
            <div className="p-3">
              <div className="text-[13px] font-semibold text-slate-900">{p.title}</div>
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {p.tag}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServicesPreview({
  tradeSlug,
  bespoke
}: {
  tradeSlug: string;
  bespoke?: BespokePageCopy;
}): JSX.Element {
  const bespokeServices = bespoke?.services;
  const services =
    bespokeServices?.items && bespokeServices.items.length > 0
      ? bespokeServices.items.map((it) => ({
          title: it.title,
          price: it.priceHint,
          desc: it.description
        }))
      : [
          { title: "Emergency callout", price: "From £85 · Same-day", desc: `24/7 ${tradeSlug} response across Greater Manchester.` },
          { title: "Planned installation", price: "Quoted · 1–5 days", desc: "New installs, replacements, upgrades." },
          { title: "Servicing", price: "From £70", desc: "Annual servicing to keep everything running." }
        ];
  return (
    <div className="flex flex-col gap-2">
      {services.map((s) => (
        <div key={s.title} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-slate-900">{s.title}</div>
            <div className="mt-0.5 text-[12px] text-slate-600">{s.desc}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {s.price}
            </div>
            <button className="mt-1 text-[13px] font-semibold" style={{ color: AMBER }}>
              Book now →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductGridPreview(): JSX.Element {
  const products = [
    { name: "Treated Timber 4×2", ref: "TT042", price: "£4.85 / m", stock: "IN STOCK" },
    { name: "Type-1 MOT Aggregate", ref: "T1M100", price: "£38 / bulk bag", stock: "IN STOCK" },
    { name: "Plumbing Fittings Kit A", ref: "PF-A", price: "£29.90", stock: "LOW STOCK" },
    { name: "Bricks — London Yellow", ref: "BLY-100", price: "£0.68 / brick", stock: "IN STOCK" }
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {products.map((p) => (
        <div key={p.ref} className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex h-24 items-center justify-center rounded bg-slate-100 text-slate-400">
            <Camera size={20} />
          </div>
          <div className="text-[13px] font-semibold text-slate-900">{p.name}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Ref: {p.ref}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div className="text-[13px] font-bold text-slate-900">{p.price}</div>
            <div
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: p.stock === "IN STOCK" ? "#DCFCE7" : "#FEF3C7",
                color: p.stock === "IN STOCK" ? "#166534" : "#92400E"
              }}
            >
              {p.stock}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FaqPreview({ bespoke }: { bespoke?: BespokePageCopy }): JSX.Element {
  const faqCopy = bespoke?.faq;
  const items = faqCopy?.items && faqCopy.items.length > 0
    ? faqCopy.items
    : [
        { question: "Do you charge a callout fee?", answer: "" },
        { question: "How long until you can get to me?", answer: "" },
        { question: "Are you Gas Safe registered?", answer: "" },
        { question: "Do you offer a guarantee?", answer: "" }
      ];
  return (
    <div className="flex flex-col gap-2">
      {faqCopy?.heading && (
        <div className="text-[16px] font-bold text-slate-900">{faqCopy.heading}</div>
      )}
      {items.map((q) => (
        <div key={q.question} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium text-slate-900">{q.question}</div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>
          {q.answer && (
            <div className="mt-1 text-[12px] leading-relaxed text-slate-600">{q.answer}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewsPreview({ bespoke }: { bespoke?: BespokePageCopy }): JSX.Element {
  const reviewsCopy = bespoke?.reviews;
  const reviews = [
    ...SAMPLE_REVIEWS,
    { name: "Mark H.", town: "Oldham", rating: 5, text: "Booked online, showed up when he said. Job done properly." },
    { name: "Ella W.", town: "Bury", rating: 5, text: "Old radiators swapped, no mess. Recommend." }
  ];
  return (
    <div className="flex flex-col gap-3">
      {reviewsCopy && (
        <div>
          <div className="text-[16px] font-bold text-slate-900">{reviewsCopy.heading}</div>
          <div className="mt-1 text-[13px] text-slate-700">{reviewsCopy.subhead}</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
      {reviews.map((r) => (
        <div key={r.name + r.town} className="rounded-md border border-slate-200 p-3">
          <div className="mb-1 flex items-center gap-1">
            {Array.from({ length: r.rating }).map((_, i) => (
              <Star key={i} size={13} fill={YELLOW} color={YELLOW} />
            ))}
          </div>
          <div className="text-[13px] leading-relaxed text-slate-700">"{r.text}"</div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            {r.name} · {r.town}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

/** Image override for a specific slot role. Reads from Inspector
 *  context (set on the image-patch handler in the main canvas). */
function useImageOverride(role: string, fallback: string | null): string | null {
  const { imageOverrides } = useContext(InspectorOverrides);
  return imageOverrides[role] ?? fallback;
}

function ProjectImageSlot({
  role,
  title
}: {
  role: string;
  title: string;
}): JSX.Element {
  const src = useImageOverride(role, null);
  return (
    <div
      data-inspector-kind="image"
      data-inspector-label={`Project photo — ${title}`}
      data-inspector-config={JSON.stringify({ role, currentImageUrl: src })}
      className="flex h-32 w-full items-center justify-center bg-slate-200 text-slate-400"
      style={
        src
          ? {
              backgroundImage: `url('${src}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }
          : {}
      }
    >
      {!src && <Camera size={24} />}
    </div>
  );
}

function CoveragePreview(): JSX.Element {
  const areas = [
    "Manchester City Centre",
    "Chorlton",
    "Didsbury",
    "Salford",
    "Altrincham",
    "Stretford",
    "Sale",
    "Trafford",
    "Prestwich",
    "Whalley Range",
    "Withington",
    "Fallowfield"
  ];
  return (
    <div>
      <div className="mb-2 text-[13px] text-slate-700">
        We cover Greater Manchester including:
      </div>
      <div className="flex flex-wrap gap-1.5">
        {areas.map((a) => (
          <span
            key={a}
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-medium text-slate-700"
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

function StickyFooter({
  whatsapp,
  call
}: {
  whatsapp: boolean;
  call: boolean;
}): JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-20 flex flex-col gap-2">
      {whatsapp && (
        <button
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
          style={{ backgroundColor: WHATSAPP_GREEN }}
          aria-label="Message us on WhatsApp"
        >
          <MessageCircle size={26} />
        </button>
      )}
      {call && (
        <button
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
          style={{ backgroundColor: YELLOW, color: BLACK }}
          aria-label="Call us"
        >
          <Phone size={22} />
        </button>
      )}
    </div>
  );
}
