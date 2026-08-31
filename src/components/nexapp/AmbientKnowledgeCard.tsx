// src/components/nexapp/AmbientKnowledgeCard.tsx
//
// NEX Ambient Knowledge Card · Philip 2026-08-28.
//
// Premium frosted-glass card that renders inside the chat surface when the
// AmbientInjector fires. Distinct visual class from conversational messages
// (which are typographic per constitutional chat doctrine). This card is
// an intentional exception · see:
// project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md

"use client";

import React from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import type { AmbientVariant } from "@/lib/nexapp/ambientInjector";

export interface AmbientKnowledgeCardProps {
  variant: AmbientVariant;
  body: string;
  time: string;
  sourceLabel?: string;
  onDismiss?: () => void;
}

export function AmbientKnowledgeCard({
  variant, body, time, sourceLabel, onDismiss,
}: AmbientKnowledgeCardProps) {
  const isFact = variant === "did_you_know";
  const typeLabel = isFact ? "DID YOU KNOW…" : "THEY SAY…";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      style={{
        // Philip 2026-08-29 · V3 NEON CYAN OUTLINE (picked from the DYK
        // samples page /nexapp/dyk-samples). Transparent black core +
        // bright cyan outline + dual cyan glow (outer bloom + inner rim).
        position: "relative",
        // Philip 2026-08-29 · +3px left + 3px right = 6px wider total
        // (was 420 → 426). Stays centered via `margin: auto`.
        maxWidth: 426,
        margin: "6px auto 8px",
        padding: "14px 16px 12px",
        borderRadius: 14,
        background: "rgba(0, 0, 0, 0.20)",
        border: "1.5px solid rgba(163, 226, 255, 0.85)",
        boxShadow:
          "0 0 12px rgba(74, 201, 255, 0.55), inset 0 0 12px rgba(74, 201, 255, 0.15)",
        color: "rgba(240, 248, 255, 0.98)",
        pointerEvents: "auto",
      }}
    >
      {/* NEX wordmark · CANONICAL · Philip 2026-08-29 · white "NE" +
          orange "X" · SAME size + color everywhere it appears (chat
          messages, ambient cards, future surfaces). Match to chat's
          NexTextElement styling · fontSize 18, weight 800, letterSpacing
          0.6, color rgba(245,245,245,0.9). */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 0.6,
          lineHeight: 1,
          color: "rgba(245,245,245,0.9)",
          marginBottom: 6,
        }}
      >
        NE<span style={{ color: "#f97316" }}>X</span>
      </div>

      {/* Type label · DID YOU KNOW / THEY SAY · neon caps */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1.8,
          color: "rgba(163, 226, 255, 0.85)",
          textShadow: "0 0 6px rgba(74, 201, 255, 0.65)",
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {typeLabel}
      </div>

      {/* Body · pale cyan-white · subtle cyan text-glow */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.45,
          color: "rgba(240, 248, 255, 0.98)",
          letterSpacing: 0.15,
          fontWeight: 500,
          textShadow: "0 0 6px rgba(74, 201, 255, 0.20)",
        }}
      >
        {body}
      </div>

      {/* Bottom row · source + time (with orange clock icon · Philip
          2026-08-29 · "time will always have the clock icon in orange"). */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 10,
          color: "rgba(163, 226, 255, 0.60)",
          letterSpacing: 0.3,
        }}
      >
        <span title={sourceLabel} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {sourceLabel ?? ""}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          letterSpacing: 0.4, flexShrink: 0,
        }}>
          <Clock size={11} color="#f97316" strokeWidth={2.2} />
          {time}
        </span>
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: 999,
            border: "none",
            background: "rgba(255,255,255,0.08)",
            color: "rgba(245,245,245,0.7)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </motion.div>
  );
}
