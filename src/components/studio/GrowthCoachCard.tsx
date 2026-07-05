"use client";

// Growth Coach card — "3 things to do this week".
//
// Fetches /api/studio/growth-coach and renders exactly 3 highest-impact
// tasks. Progress-oriented framing: shows a done count (`0 of 3
// done`) so completing a task feels like a win, not a judgment. Each
// task has a single CTA — no dropdown, no expand-all, no analytics
// pile-on. One page, one action, one next click.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GrowthTask } from "@/lib/studio/growthCoach/types";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const NEUTRAL = "#525252";

const CATEGORY_COLOR: Record<GrowthTask["category"], string> = {
  trust: "#2563EB",
  setup: YELLOW,
  publishing: RED,
  content: "#7C3AED",
  contact: GREEN,
  coverage: AMBER
};

export function GrowthCoachCard() {
  const [tasks, setTasks] = useState<GrowthTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/studio/growth-coach");
        const json = (await res.json()) as
          | { ok: true; tasks: GrowthTask[] }
          | { ok: false; error: string };
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error);
        setTasks(json.tasks);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message ?? "network");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold text-red-700">
          Growth Coach: {error}
        </p>
      </div>
    );
  }

  if (tasks === null) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: YELLOW }}>
          Growth coach
        </p>
        <p className="mt-2 text-[13px] text-neutral-500">Loading your next 3 wins…</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: GREEN }}>
          Growth coach
        </p>
        <h2 className="mt-1 text-[18px] font-extrabold leading-tight text-emerald-900">
          You're on top of it.
        </h2>
        <p className="mt-1 text-[12px] text-emerald-800">
          Every top-priority task is done. Keep publishing updates and
          adding project photos — that's the compounding play.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-neutral-900 bg-white shadow-lg">
      <div className="flex items-start justify-between gap-3 bg-neutral-900 px-5 py-4 text-white">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: YELLOW }}>
            Growth coach
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold leading-tight">
            Your next 3 wins
          </h2>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white/80">
          0 of {tasks.length} done
        </div>
      </div>

      <ol className="divide-y divide-neutral-100">
        {tasks.map((t, idx) => (
          <li key={t.id} className="flex items-start gap-4 p-5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white"
              style={{ background: CATEGORY_COLOR[t.category] }}
              aria-hidden="true"
            >
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-[14px] font-extrabold leading-tight text-neutral-900">
                  {t.title}
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                  style={{ background: CATEGORY_COLOR[t.category] }}
                >
                  {t.category}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
                {t.description}
              </p>
              {t.reason && (
                <p className="mt-1 text-[10px] italic leading-relaxed text-neutral-500">
                  Why: {t.reason}
                </p>
              )}
            </div>
            <Link
              href={t.ctaHref}
              className="shrink-0 self-center rounded-lg px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
              style={{ background: YELLOW }}
            >
              {t.ctaLabel} →
            </Link>
          </li>
        ))}
      </ol>

      <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3">
        <p className="text-[10px] leading-relaxed" style={{ color: NEUTRAL }}>
          Updated on every load. Complete a task and it drops off — a
          new one takes its place. This is the compounding play, not the
          judgment dashboard.
        </p>
      </div>
    </div>
  );
}
