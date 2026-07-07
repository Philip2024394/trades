// /insights/[trade] — merchant + public view of anonymised cross-
// merchant patterns for their trade. Server-rendered so it's SEO-
// friendly and works without JS.

import type { Metadata } from "next";
import { loadInsightsFor } from "@/lib/insights/loader";
import type { TradeInsight } from "@/lib/insights/loader";

const CHANNELS = ["instagram", "facebook", "gbp", "linkedin", "tiktok"] as const;

type PageProps = { params: Promise<{ trade: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { trade } = await params;
  return {
    title: `${humanise(trade)} · Insights — xrated studio`,
    description: `How the ${humanise(trade)} trade posts on socials — anonymised patterns across the xrated studio network.`
  };
}

export default async function InsightsPage({ params }: PageProps) {
  const { trade } = await params;
  const all = await loadInsightsFor(trade);
  const byChannel = groupByChannel(all);

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-neutral-50 px-4 py-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
          Trade insights
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900 md:text-3xl">
          How the {humanise(trade)} trade posts
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-neutral-700">
          Anonymised patterns computed weekly from every {humanise(trade)}
          business on xrated studio. Used automatically by the composer
          — shown here so you can see what&apos;s working.
        </p>
      </header>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-[13px] text-neutral-600">
          Not enough data yet for {humanise(trade)}. Insights need
          at least 30 posts per channel to compute. Once the network
          crosses that threshold, this page fills automatically.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {CHANNELS.map((ch) => {
            const insights = byChannel.get(ch) ?? [];
            if (insights.length === 0) return null;
            return (
              <ChannelCard
                key={ch}
                channel={ch}
                insights={insights}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

function ChannelCard({
  channel,
  insights
}: {
  channel: string;
  insights: TradeInsight[];
}) {
  const byKind = new Map(insights.map((i) => [i.insightKind, i]));
  const bestTime = byKind.get("best_time_slots");
  const captionLen = byKind.get("top_caption_length");
  const materials = byKind.get("top_material_mentions");
  const baseline = byKind.get("typical_engagement_baseline");
  const sampleSize = insights[0]?.sampleSize ?? 0;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[13px] font-semibold text-neutral-900">
            {humanise(channel)}
          </div>
          <div className="text-[10px] text-neutral-500">
            {sampleSize} posts sampled
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {bestTime ? (
          <li>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Best time to post
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {((bestTime.facets.slots as Array<{ dayOfWeek: number; hour: number }>) ?? []).map(
                (s, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
                  >
                    {dayLabel(s.dayOfWeek)} · {formatHour(s.hour)}
                  </span>
                )
              )}
            </div>
          </li>
        ) : null}

        {captionLen ? (
          <li>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Caption length
            </div>
            <div className="mt-1 text-[13px] text-neutral-900">
              Median{" "}
              <span className="font-semibold">
                {(captionLen.facets.median_chars as number) ?? 0} chars
              </span>
            </div>
          </li>
        ) : null}

        {materials ? (
          <li>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Top-mentioned materials
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {((materials.facets.materials as Array<{ material: string; count: number }>) ?? []).map(
                (m, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-900"
                  >
                    {humanise(m.material)} · {m.count}
                  </span>
                )
              )}
            </div>
          </li>
        ) : null}

        {baseline ? (
          <li>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Typical engagement
            </div>
            <div className="mt-1 text-[13px] text-neutral-900">
              Median{" "}
              <span className="font-semibold">
                {((baseline.facets.median as number) ?? 0).toFixed(0)}
              </span>
              {" · "}top-quartile threshold{" "}
              <span className="font-semibold">
                {((baseline.facets.top_quartile_min as number) ?? 0).toFixed(0)}
              </span>
            </div>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function groupByChannel(all: TradeInsight[]): Map<string, TradeInsight[]> {
  const map = new Map<string, TradeInsight[]>();
  for (const i of all) {
    const key = i.channel ?? "any";
    const list = map.get(key) ?? [];
    list.push(i);
    map.set(key, list);
  }
  return map;
}

function humanise(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dayLabel(d: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d] ?? "?";
}

function formatHour(h: number): string {
  const ampm = h < 12 ? "am" : "pm";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}${ampm}`;
}
