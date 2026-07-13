// WhatIsNotebookModal — full-height explainer surface, driven by a
// per-surface topic from HOW_IT_WORKS_TOPICS so each notebook section
// gets its own focused copy. Only the primary bottom CTA closes the
// panel (per user brief). ESC still closes for keyboard users.

"use client";

import { useEffect } from "react";
import {
  HOW_IT_WORKS_TOPICS,
  type HowItWorksTopicKey
} from "../data/howItWorksTopics";

type Props = {
  open: boolean;
  onClose: () => void;
  topic?: HowItWorksTopicKey;
};

export function WhatIsNotebookModal({ open, onClose, topic = "trade-center" }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const t = HOW_IT_WORKS_TOPICS[topic];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[#FBF6EC]"
      role="dialog"
      aria-modal="true"
      aria-label={`How ${topic === "trade-center" ? "Trade Center" : topic.replace(/-/g, " ")} works`}
    >
      {/* Sticky top wordmark — yellow dot + "Trade Center · <topic>" */}
      <div
        className="sticky top-0 z-10 flex items-center border-b bg-[#FBF6EC]/95 px-4 py-3 backdrop-blur"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
            aria-hidden
          />
          <div className="leading-none">
            <div className="text-[13px] font-black tracking-tight text-neutral-900">
              Trade Center
            </div>
            <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-neutral-500">
              {t.headerLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section
        className="relative flex flex-col items-center px-6 pb-10 pt-8 md:pt-14"
        style={{
          background:
            "linear-gradient(180deg, #FFB300 0%, #FFD46B 40%, #FBF6EC 100%)"
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2009_06_44%20PM.png"
          alt=""
          className="h-56 w-auto max-w-full object-contain sm:h-72"
          aria-hidden
        />
        <h1 className="mt-6 max-w-3xl text-center text-[26px] font-black leading-tight text-neutral-900 md:text-[36px]">
          {t.heroTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-center text-[13.5px] leading-relaxed text-neutral-800/80 md:text-[15px]">
          {t.heroSubtitle}
        </p>
      </section>

      {/* Feature grid */}
      <section className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <h2 className="mb-4 text-[13px] font-black uppercase tracking-[0.18em] text-neutral-500">
          {t.featuresTitle}
        </h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {t.features.map((f) => (
            <li
              key={f.title}
              className="rounded-2xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.12)" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full shadow-sm"
                  style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                >
                  <f.Icon size={18} strokeWidth={2.2}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-black text-neutral-900">{f.title}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">{f.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Optional flow */}
      {t.flow && t.flow.length > 0 && (
        <section className="mx-auto w-full max-w-3xl px-4 pb-10 md:px-6">
          <div
            className="rounded-2xl border p-5 shadow-sm md:p-6"
            style={{ borderColor: "rgba(139,69,19,0.12)", backgroundColor: "#FFFFFF" }}
          >
            <h2 className="text-[13px] font-black uppercase tracking-[0.18em] text-neutral-500">
              {t.flowTitle ?? "How the flow runs"}
            </h2>
            <ol className="mt-4 flex flex-col gap-4">
              {t.flow.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black"
                    style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                  >
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-[12.5px] leading-relaxed text-neutral-700">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Footer CTA — the ONLY exit besides ESC */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 md:px-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        >
          {t.footerCta}
        </button>
      </div>
    </div>
  );
}
