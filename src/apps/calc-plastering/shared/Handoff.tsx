// Handoff — WhatsApp / share action row.
//
// Plastering doesn't have an add-to-cart flow (it's labour-heavy, not
// material-heavy — the plasterer's rate card drives price, not a
// material product feed). The primary action is a WhatsApp quote.

"use client";

import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/platform/ui";
import {
  PROJECT_TYPE_LABEL,
  READINESS_LABEL
} from "../logic";
import type {
  CalculatorOutput,
  PlasteringScenario,
  ProjectDetails
} from "../logic";

export type HandoffProps = {
  result: CalculatorOutput;
  scenarioLabel: string;
  scenario: PlasteringScenario;
  project: ProjectDetails;
  whatsappNumber?: string;
  showWhatsapp?: boolean;
  showShare?: boolean;
  onShare?: () => void;
  stack?: boolean;
};

function buildMessage(
  result: CalculatorOutput,
  scenarioLabel: string,
  project: ProjectDetails
): string {
  const total = result.lines.find(
    (l) => l.tone === "primary" && l.label.startsWith("Job total")
  );
  const parts = [
    `Hi — plastering quote request via calculator.`,
    ``,
    `Scenario: ${scenarioLabel}`
  ];
  if (project.project_type) {
    parts.push(`Project type: ${PROJECT_TYPE_LABEL[project.project_type]}`);
  }
  if (project.readiness) {
    const readiness =
      project.readiness === "ready_in_weeks"
        ? `Ready in ${project.ready_in_weeks} week${project.ready_in_weeks === 1 ? "" : "s"}`
        : READINESS_LABEL[project.readiness];
    parts.push(`Readiness: ${readiness}`);
  }
  if (project.site_address) {
    parts.push(`Site: ${project.site_address}`);
  }
  if (project.access_notes) {
    parts.push(`Access: ${project.access_notes}`);
  }
  parts.push("");
  parts.push("Breakdown:");
  for (const l of result.lines) {
    if (l.tone === "warning") continue;
    if (l === total) continue;
    parts.push(`• ${l.label}: ${l.value}`);
  }
  parts.push("");
  if (total) {
    parts.push(`${total.label}: ${total.value}`);
  }
  parts.push("");
  parts.push("Can you confirm availability + on-site survey?");
  return parts.filter(Boolean).join("\n");
}

export function Handoff({
  result,
  scenarioLabel,
  project,
  whatsappNumber,
  showWhatsapp = true,
  showShare = true,
  onShare,
  stack = false
}: HandoffProps) {
  const openWhatsApp = () => {
    const encoded = encodeURIComponent(
      buildMessage(result, scenarioLabel, project)
    );
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
