// NEX Side Drawer · 2026-08-23.
// Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
// "Discovery Drawer" section.
//
// Right-side drawer, 60% viewport width (max 480 px). Backdrop dims screen.
// Dark translucent surface · subtle orange border · backdrop-filter blur ·
// rounded corners · smooth 300 ms slide (cubic-out) · safe-area padding.
// Header shows title + close button. Content area is vertically scrollable
// with hidden scrollbars (.nex-no-scrollbar utility from NexAppHome).
//
// Currently used by the Discovery satellite in Explore mode. Component is
// generic so future Personalize / Create surfaces can share the same
// drawer language.

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { NEX } from "@/lib/nexapp/tokens";

export function NexSideDrawer({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop · tap to dismiss. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.42 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "#000",
              zIndex: 30,
              cursor: "pointer",
            }}
            aria-hidden
          />

          {/* Drawer aside · slides in from right. */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "60%",
              maxWidth: 480,
              minWidth: 280,
              background: "rgba(10, 10, 10, 0.94)",
              borderLeft: `1px solid ${NEX.borderMuted}`,
              boxShadow: `-20px 0 48px rgba(0, 0, 0, 0.6), 0 0 60px ${NEX.orangeGlowLo}`,
              zIndex: 31,
              display: "flex",
              flexDirection: "column",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              borderTopLeftRadius: 20,
              borderBottomLeftRadius: 20,
              paddingTop: "max(env(safe-area-inset-top), 12px)",
              paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
            }}
            aria-label={title}
            role="dialog"
            aria-modal="true"
          >
            {/* Header · title + close. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px 12px",
                borderBottom: `1px solid ${NEX.borderMuted}`,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: NEX.text,
                  letterSpacing: -0.1,
                }}
              >
                {title}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: NEX.bgSurface,
                  border: `1px solid ${NEX.borderMuted}`,
                  color: NEX.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  transition: "color 180ms ease, border-color 180ms ease",
                }}
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            {/* Scrollable content. */}
            <div
              className="nex-no-scrollbar"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "14px 14px 20px",
              }}
            >
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
