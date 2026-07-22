// /admin/mate — Mate conversation observatory.
//
// Every conversation, every feedback signal, cost totals, model
// breakdown. This is the training-data curation surface for
// Phase 3 (fine-tune on labelled data).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mate — Admin observatory" };

type ConvRow = {
  id:               string;
  surface:          string;
  user_key:         string | null;
  canteen_slug:     string | null;
  first_message:    string | null;
  message_count:    number;
  total_cost_pence: number;
  started_at:       string;
  last_message_at:  string;
};

type FeedbackRow = {
  message_id:    string;
  signal:        number;
  content:       string;
  model:         string | null;
  conversation_id: string;
  created_at:    string;
};

async function loadData() {
  const [convsRes, feedbackRes, costsRes, thumbsUpRes, thumbsDownRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_mate_conversations")
      .select("id, surface, user_key, canteen_slug, first_message, message_count, total_cost_pence, started_at, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("hammerex_mate_messages")
      .select("id, conversation_id, content, model, feedback_signal, created_at")
      .not("feedback_signal", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("hammerex_mate_daily_usage")
      .select("cost_pence, messages_sent")
      .gte("usage_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    supabaseAdmin
      .from("hammerex_mate_messages")
      .select("id", { count: "exact", head: true })
      .eq("feedback_signal", 1),
    supabaseAdmin
      .from("hammerex_mate_messages")
      .select("id", { count: "exact", head: true })
      .eq("feedback_signal", -1)
  ]);

  const conversations = (convsRes.data ?? []) as ConvRow[];
  const feedback: FeedbackRow[] = (feedbackRes.data ?? []).map((r) => ({
    message_id:      r.id as string,
    conversation_id: r.conversation_id as string,
    signal:          r.feedback_signal as number,
    content:         r.content as string,
    model:           (r.model as string | null),
    created_at:      r.created_at as string
  }));

  const monthCosts = (costsRes.data ?? []).reduce((acc, r) => ({
    pence:     acc.pence + ((r.cost_pence as number | null)    ?? 0),
    messages:  acc.messages + ((r.messages_sent as number | null) ?? 0)
  }), { pence: 0, messages: 0 });

  return {
    conversations,
    feedback,
    kpis: {
      convs30d: conversations.length,
      cost30dGbp: (monthCosts.pence / 100).toFixed(2),
      messages30d: monthCosts.messages,
      thumbsUp: thumbsUpRes.count ?? 0,
      thumbsDown: thumbsDownRes.count ?? 0
    }
  };
}

export default async function MateAdminPage() {
  const { conversations, feedback, kpis } = await loadData();
  const totalFeedback = kpis.thumbsUp + kpis.thumbsDown;
  const thumbsUpPct   = totalFeedback > 0 ? Math.round((kpis.thumbsUp / totalFeedback) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Mate · Observatory</h1>
          <p className="text-[13px] text-neutral-600">Every conversation, feedback signal, and cost line for our AI agent.</p>
        </div>
        <Link href="/admin/mate/gaps" className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white hover:bg-neutral-800">
          Knowledge gaps →
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Conversations (30d)" value={String(kpis.convs30d)} sub="last 100 shown"/>
        <Kpi label="Messages (30d)"      value={String(kpis.messages30d)} sub="user + Mate"/>
        <Kpi label="Cost (30d)"          value={`£${kpis.cost30dGbp}`} sub="Anthropic bill"/>
        <Kpi label="Thumbs up"           value={String(kpis.thumbsUp)} sub={`${thumbsUpPct}% of rated`}/>
        <Kpi label="Thumbs down"         value={String(kpis.thumbsDown)} sub="training signal"/>
      </div>

      {/* Recent feedback — most actionable signal */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Recent feedback · powers Phase 3 fine-tune
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b bg-neutral-50">
              <tr>
                <Th>When</Th>
                <Th>Signal</Th>
                <Th>Model</Th>
                <Th>Mate said (excerpt)</Th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.message_id} className="border-b hover:bg-neutral-50">
                  <Td>{new Date(f.created_at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td>{f.signal === 1
                    ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-800">👍 up</span>
                    : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800">👎 down</span>}</Td>
                  <Td mono>{f.model ?? "—"}</Td>
                  <Td className="max-w-lg truncate">{f.content.slice(0, 200)}</Td>
                </tr>
              ))}
              {feedback.length === 0 && <tr><Td>—</Td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent conversations */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Recent conversations · latest 100
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b bg-neutral-50">
              <tr>
                <Th>Last active</Th>
                <Th>Surface</Th>
                <Th>User</Th>
                <Th align="right">Msgs</Th>
                <Th align="right">Cost</Th>
                <Th>First message</Th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => (
                <tr key={c.id} className="border-b hover:bg-neutral-50">
                  <Td>{new Date(c.last_message_at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td><span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black uppercase text-neutral-700">{c.surface}</span></Td>
                  <Td mono>
                    {c.surface === "merchant" && c.user_key ? (
                      <Link href={`/${c.user_key}`} className="text-neutral-900 underline">{c.user_key}</Link>
                    ) : (
                      c.user_key?.slice(0, 12) ?? "—"
                    )}
                  </Td>
                  <Td align="right" mono>{c.message_count}</Td>
                  <Td align="right" mono>£{(c.total_cost_pence / 100).toFixed(2)}</Td>
                  <Td className="max-w-md truncate">{c.first_message ?? <span className="text-neutral-400">—</span>}</Td>
                </tr>
              ))}
              {conversations.length === 0 && <tr><Td>—</Td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-2xl font-black tabular-nums text-neutral-900">{value}</p>
      <p className="text-[10.5px] text-neutral-500">{sub}</p>
    </div>
  );
}
function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={"px-2 py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-600 " + (align === "right" ? "text-right" : "text-left")}>{children}</th>;
}
function Td({ children, align, mono, className }: { children: React.ReactNode; align?: "left" | "right"; mono?: boolean; className?: string }) {
  return <td className={"px-2 py-1.5 " + (align === "right" ? "text-right " : "") + (mono ? "font-mono " : "") + (className ?? "")}>{children}</td>;
}
