"use client";

// AIToolsRow — horizontal-scroll cards for the AI-first utilities per
// canonical mockup: AI Writer · Image Editor · Translator. Each is a
// separate future studio; V1 renders the cards + routes to placeholder
// pages so the platform navigation feels complete.

import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, PenLine, ImageIcon, Languages, type LucideIcon } from "lucide-react";

type Tool = { label: string; description: string; icon: LucideIcon; route: string };

const TOOLS: Tool[] = [
  { label: "AI Writer",    description: "Write anything in seconds",        icon: PenLine,   route: "/nex-app/tools/writer" },
  { label: "Image Editor", description: "Edit, remove background & more",   icon: ImageIcon, route: "/nex-app/tools/image" },
  { label: "Translator",   description: "Translate in any language",        icon: Languages, route: "/nex-app/tools/translate" }
];

export function AIToolsRow() {
  const router = useRouter();
  return (
    <section className="mt-3">
      <header className="mx-5 mb-2 flex items-center justify-between">
        <h3 className="text-[15px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
          AI Tools
        </h3>
        <button type="button"
                className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ color: "var(--nex-accent-500)" }}>
          View All <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </header>

      <div className="scrollbar-none flex gap-2 overflow-x-auto px-5 pb-1">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => router.push(t.route)}
            className="flex flex-none items-start gap-2 rounded-xl px-2 py-2 text-left transition-transform active:scale-[0.98]"
            style={{
              width: 112,
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)"
            }}
            aria-label={t.label}
          >
            <span
              className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg"
              style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-500)" }}
              aria-hidden
            >
              <t.icon size={16} strokeWidth={1.75} />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[11px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
                {t.label}
              </span>
              <span className="mt-0.5 line-clamp-2 text-[9.5px]" style={{ color: "var(--nex-neutral-500)" }}>
                {t.description}
              </span>
            </span>
            <ChevronRight size={12} strokeWidth={2} style={{ color: "var(--nex-neutral-400)" }} />
          </button>
        ))}
      </div>
    </section>
  );
}
