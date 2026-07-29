"use client";
// ActionsCard — "2 · I'm going to"
// Reads like a checklist of everything NEX will execute on approval.
// Deliberately human-worded ("Create 20 board records"), not verb-y
// like a task list — feels like NEX narrating the plan.

import { Package, Layers, Brain, SkipForward, CheckCircle2, Edit3 } from "lucide-react";
import { MT } from "../_tokens";
import type { AddStockFormValues } from "./AddStockWorkflow";
import type { NexAddStockDraft } from "@/apps/materials/_schema/memory_types";

export function ActionsCard({
  form,
  memoryAction,
}: {
  form: AddStockFormValues;
  memoryAction: NexAddStockDraft["memory_action"] | null;
}) {
  const memoryLine = memoryLineFor(memoryAction, form.material_name);
  return (
    <div
      className="px-5 py-4"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
      }}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>
        2 · This is what I&apos;m going to do
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {memoryLine && <Line icon={memoryLine.icon}>{memoryLine.text}</Line>}
        <Line icon={<Package size={16} strokeWidth={2} />}>Create a new hardwood pack</Line>
        <Line icon={<Layers  size={16} strokeWidth={2} />}>
          Create <strong>{form.quantity}</strong> individual board record{form.quantity === 1 ? "" : "s"}
        </Line>
        <Line icon={<CheckCircle2 size={16} strokeWidth={2} />}>Update stock and calculate volume</Line>
        {form.price_per_unit != null && (
          <Line icon={<CheckCircle2 size={16} strokeWidth={2} />}>Record the purchase valuation</Line>
        )}
      </ul>
    </div>
  );
}

function memoryLineFor(
  action: NexAddStockDraft["memory_action"] | null,
  name: string,
): { icon: React.ReactNode; text: React.ReactNode } | null {
  if (action == null) return null;
  const icon = <Brain size={16} strokeWidth={2} />;
  switch (action) {
    case "create_new":
      return { icon, text: <>Remember <strong>{name}</strong> for next time</> };
    case "use_existing":
      return { icon, text: <>Use the details I already have for <strong>{name}</strong></> };
    case "update_existing":
      return { icon: <Edit3 size={16} strokeWidth={2} />, text: <>Update what I know about <strong>{name}</strong></> };
    case "skip_memory":
      return { icon: <SkipForward size={16} strokeWidth={2} />, text: <>Treat this as a one-off — I won&apos;t save it</> };
  }
}

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13.5px]" style={{ color: MT.darkGrey }}>
      <span style={{ color: MT.primary, marginTop: 1 }}>{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
