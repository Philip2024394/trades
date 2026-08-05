// Living Demonstration prototype — validates the strongest single doctrine
// element in the NEX Home Architectural Draft v2: the user shares a fact,
// Living Memory forms in real time, no explanation is offered, the user
// realises what happened.
//
// Route: /nex-app-lab/living-demonstration
//
// Discipline anchors (do NOT violate during iteration):
//   • No onboarding · no tooltip · no welcome message · no "this is memory"
//     copy on the surface. The realisation is earned, not narrated.
//   • Selective memory (Philip 2026-08-05): only detected facts produce
//     a Living Memory expression. Chatter ("hello") produces silence.
//     Universal memory feels mechanical; selective memory feels
//     intelligent. The stronger "aha" is when the user notices that
//     NEX did NOT remember something — and then does when they say
//     something worth keeping.
//   • Event-driven behaviour: event.input.first-keystroke → event.memory.
//     processing → event.memory.written. Times are latency thresholds,
//     not animation cues.
//   • User-language on the emerging expression. "Favourite wood: oak"
//     (user owns the fact) not "NEX remembers your favourite wood is oak".
//   • Emotional outcome target: "I'm making progress" — the visible
//     progress is the accumulating row of memories.

"use client";

import { useState, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { extractFact } from "./extractFact";

type Memory = { id: number; key: string; value: string };

const MEMORY_WRITE_LATENCY_MS = 500;

export default function LivingDemonstrationPage() {
  const [input, setInput] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [processing, setProcessing] = useState(false);
  const nextId = useRef(1);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || processing) return;

    setInput("");
    setProcessing(true);

    setTimeout(() => {
      const fact = extractFact(text);
      if (fact) {
        setMemories((prev) => [...prev, { id: nextId.current++, ...fact }]);
      }
      setProcessing(false);
    }, MEMORY_WRITE_LATENCY_MS);
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      style={{ background: "var(--nex-cream)" }}
    >
      <div
        aria-label="NEX"
        className="absolute left-6 top-6 text-[13px] font-medium lowercase tracking-[0.2em]"
        style={{ color: "var(--nex-neutral-500)" }}
      >
        nex
      </div>

      <div className="w-full max-w-md">
        <div
          className="mb-8 flex min-h-[64px] flex-wrap items-end justify-center gap-2"
          aria-live="polite"
        >
          <AnimatePresence initial={false}>
            {memories.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 14, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 26,
                  mass: 0.6
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px]"
                style={{
                  background: "var(--nex-cream-elev)",
                  border: "1px solid var(--nex-neutral-200)",
                  boxShadow: "var(--nex-shadow-sm)",
                  color: "var(--nex-neutral-900)"
                }}
              >
                <span style={{ color: "var(--nex-neutral-500)" }}>{m.key}:</span>
                <span className="font-medium">{m.value}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <form
          onSubmit={submit}
          className="flex items-center gap-2 rounded-full pl-4 pr-1 py-1"
          style={{
            background: "var(--nex-neutral-0)",
            border: "1px solid var(--nex-neutral-200)",
            boxShadow: "var(--nex-shadow-md)"
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell NEX something about yourself or your work…"
            aria-label="Tell NEX"
            autoFocus
            className="flex-1 bg-transparent py-2 text-[14px] outline-none placeholder:text-[color:var(--nex-neutral-400)]"
            style={{ color: "var(--nex-neutral-900)" }}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || processing}
            className="grid h-9 w-9 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, var(--nex-accent-500), var(--nex-accent-700))",
              color: "var(--nex-neutral-0)"
            }}
          >
            <motion.div
              animate={processing ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
              transition={
                processing
                  ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0 }
              }
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--nex-neutral-0)" }}
            />
          </button>
        </form>
      </div>
    </main>
  );
}
