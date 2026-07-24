"use client";

// Chat surface tool tiles row (bottom) — per canonical Staircase chat
// mockup. 6 quick-access tiles: Gallery, Calculator, Materials,
// Regulations, Book Visit, Contact. Each triggers a state transition
// inside the chat.

import { Image, Calculator, Layers, ShieldCheck, Calendar, Phone, type LucideIcon } from "lucide-react";
import { useConversationState } from "../state/ConversationStateProvider";
import type { ConversationState } from "@/lib/nex-apps/_types";

type Tool = { label: string; icon: LucideIcon; state: ConversationState; canvas?: string };

const TOOLS: Tool[] = [
  { label: "Gallery",     icon: Image,       state: "discover", canvas: "gallery"      },
  { label: "Calculator",  icon: Calculator,  state: "configure"                          },
  { label: "Materials",   icon: Layers,      state: "compare",  canvas: "timbers"      },
  { label: "Regulations", icon: ShieldCheck, state: "discover", canvas: "regulations"  },
  { label: "Book Visit",  icon: Calendar,    state: "book"                              },
  { label: "Contact",     icon: Phone,       state: "aftercare"                         }
];

export function ChatToolTilesRow() {
  const { transitionTo } = useConversationState();
  return (
    <div className="pb-safe grid grid-cols-6 gap-1 px-3 pb-2 pt-1">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.label}
            type="button"
            onClick={() =>
              transitionTo(tool.state, tool.canvas ? { payload: { variant: tool.canvas } } : undefined)
            }
            className="flex flex-col items-center gap-1 rounded-xl py-2 transition-transform active:scale-95"
            style={{
              background: "var(--nex-neutral-0)",
              border: "1px solid var(--nex-neutral-200)"
            }}
          >
            <Icon size={20} strokeWidth={1.75} style={{ color: "var(--nex-neutral-700)" }} />
            <span className="text-[10px] font-medium" style={{ color: "var(--nex-neutral-700)" }}>
              {tool.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
