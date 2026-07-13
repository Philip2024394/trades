// HowItWorksButton — one-liner "how this page works" trigger.
//
// Drop it on any page:
//   <HowItWorksButton topic="jobs"/>
//
// The button label + modal copy come from HOW_IT_WORKS_TOPICS so the
// trigger always explains what the panel will cover. Internal state
// keeps the caller free of open/close plumbing.

"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { WhatIsNotebookModal } from "./WhatIsNotebookModal";
import { HOW_IT_WORKS_TOPICS, type HowItWorksTopicKey } from "../data/howItWorksTopics";

type Props = {
  topic: HowItWorksTopicKey;
  /** Optional custom label override. Defaults to the topic's `buttonLabel`. */
  label?: string;
  /** Visual style — solid yellow (default) or subtle outlined for compact chrome. */
  variant?: "yellow" | "ghost";
  className?: string;
};

export function HowItWorksButton({ topic, label, variant = "yellow", className }: Props) {
  const [open, setOpen] = useState(false);
  const text = label ?? HOW_IT_WORKS_TOPICS[topic].buttonLabel;

  const styles =
    variant === "ghost"
      ? {
          backgroundColor: "#FFFFFF",
          color:           "#0A0A0A",
          border:          "1px solid rgba(139,69,19,0.18)"
        }
      : {
          backgroundColor: "#FFB300",
          color:           "#0A0A0A",
          border:          "1px solid transparent"
        };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm transition hover:brightness-105 ${className ?? ""}`}
        style={styles}
        title={text}
      >
        <HelpCircle size={13}/>
        {text}
      </button>
      <WhatIsNotebookModal open={open} onClose={() => setOpen(false)} topic={topic}/>
    </>
  );
}
