// Handoff — the action row at the bottom of the calculator.
//
// Three buttons:
//   • WhatsApp quote — opens WhatsApp with the estimate summary
//   • Share estimate — copies a shareable URL (deferred to future round)
//   • Add to cart — for real merchant integrations
//
// Every embed context can hide any button via prop.

"use client";

import { Copy, MessageCircle, ShoppingCart } from "lucide-react";
import { Button } from "@/platform/ui";
import type { CalculatorOutput, PaintScenario } from "../logic";

export type HandoffProps = {
  result: CalculatorOutput;
  scenarioLabel: string;
  scenario: PaintScenario;
  whatsappNumber?: string;
  showWhatsapp?: boolean;
  showShare?: boolean;
  showAddToCart?: boolean;
  /** Called when Add-to-Cart is tapped. Passes the cart-eligible lines. */
  onAddToCart?: () => void;
  /** Called when Share is tapped. */
  onShare?: () => void;
  /** Full-width buttons stacked (portrait / square) vs inline (landscape). */
  stack?: boolean;
};

function pence(p: number): string {
  const gbp = p / 100;
  return gbp >= 100 ? `£${gbp.toFixed(0)}` : `£${gbp.toFixed(2)}`;
}

function buildWhatsAppMessage(
  result: CalculatorOutput,
  scenarioLabel: string
): string {
  const total = result.materials_total_pence + (result.labour?.total_pence ?? 0);
  const lines = [
    `Hi — I've priced up a paint job using your calculator:`,
    ``,
    `Scenario: ${scenarioLabel}`,
    ...result.lines
      .filter((l) => l.tone !== "warning")
      .map((l) => `• ${l.label}: ${l.value}`),
    ``,
    total > 0 ? `Estimated total: ${pence(total)}` : "",
    ``,
    `Can you confirm availability + a firm quote?`
  ];
  return lines.filter(Boolean).join("\n");
}

export function Handoff({
  result,
  scenarioLabel,
  whatsappNumber,
  showWhatsapp = true,
  showShare = true,
  showAddToCart = false,
  onAddToCart,
  onShare,
  stack = false
}: HandoffProps) {
  const openWhatsApp = () => {
    const msg = buildWhatsAppMessage(result, scenarioLabel);
    const encoded = encodeURIComponent(msg);
    const url = whatsappNumber
      ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener");
  };

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
        >
          Send WhatsApp quote
        </Button>
      ) : null}
      {showAddToCart ? (
        <Button
          intent="secondary"
          size={stack ? "lg" : "md"}
          icon={ShoppingCart}
          block={stack}
          onClick={onAddToCart}
        >
          Add all to cart
        </Button>
      ) : null}
      {showShare ? (
        <Button
          intent="ghost"
          size={stack ? "lg" : "md"}
          icon={Copy}
          block={stack}
          onClick={onShare}
        >
          Share estimate
        </Button>
      ) : null}
    </div>
  );
}
