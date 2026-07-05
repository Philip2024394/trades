// Handoff — WhatsApp / share action row for the trim carpenter quote.

"use client";

import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/platform/ui";
import type { CalculatorOutput } from "../logic";

export type HandoffProps = {
  result: CalculatorOutput;
  whatsappNumber?: string;
  showWhatsapp?: boolean;
  showShare?: boolean;
  onShare?: () => void;
  stack?: boolean;
};

function buildMessage(result: CalculatorOutput): string {
  const total = result.materials_total_pence;
  const primary = result.lines.find((l) => l.tone === "primary");
  const others = result.lines.filter((l) => l !== primary);
  const parts = [
    `Hi — I've built a quote using your Trim Carpenter calculator:`,
    ``,
    ...others.map((l) => `• ${l.label}: ${l.value}${l.detail ? ` (${l.detail})` : ""}`),
    ``,
    `Total: £${(total / 100).toFixed(0)}`,
    ``,
    `Can you confirm the price + your availability?`
  ];
  return parts.filter(Boolean).join("\n");
}

export function Handoff({
  result,
  whatsappNumber,
  showWhatsapp = true,
  showShare = true,
  onShare,
  stack = false
}: HandoffProps) {
  const openWhatsApp = () => {
    const encoded = encodeURIComponent(buildMessage(result));
    const url = whatsappNumber
      ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener");
  };
  const disabled = result.materials_total_pence === 0;
  const containerCls = stack
    ? "flex flex-col gap-2"
    : "flex flex-wrap items-center gap-2";
  return (
    <div className={containerCls}>
      {showWhatsapp ? (
        <Button
          intent="primary"
          size={stack ? "lg" : "md"}
          icon={MessageCircle}
          block={stack}
          onClick={openWhatsApp}
          disabled={disabled}
        >
          Send WhatsApp quote
        </Button>
      ) : null}
      {showShare ? (
        <Button
          intent="ghost"
          size={stack ? "lg" : "md"}
          icon={Copy}
          block={stack}
          onClick={onShare}
          disabled={disabled}
        >
          Share estimate
        </Button>
      ) : null}
    </div>
  );
}
