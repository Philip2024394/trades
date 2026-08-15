// M4 · Blind user test survey · 15 questions across 5 dimensions.
// Participant fills this in privately after their conversation.
// Moderator can also fill in metadata (age band, tech comfort, notes)
// via the "moderator" toggle at the top.

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

type ResponseMap = Record<string, string | number | null>;

export default function M4SurveyPage() {
  const params = useParams<{ conversation_id: string }>();
  const convId = params.conversation_id;
  const [r, setR] = useState<ResponseMap>({});
  const [showModerator, setShowModerator] = useState(false);
  const [ageBand, setAgeBand] = useState<string>("");
  const [techComfort, setTechComfort] = useState<string>("");
  const [modNotes, setModNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { outcome_mapped: string }>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string | number | null) => setR(prev => ({ ...prev, [key]: value }));

  const canSubmit =
    r.q1_thought && r.q2_confidence && (r.q3_reason as string || '').trim().length >= 3 &&
    r.q4_helped && r.q5_outcome && r.q6_would_use_again &&
    r.q7_trust && r.q8_wrong &&
    r.q9_understood && r.q10_repeated && r.q11_misunderstood && r.q12_frustrated &&
    typeof r.q13_nps === "number" && r.q14_would_enquire;

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/nex-conv/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: convId,
          responses: r,
          moderator_notes: modNotes || null,
          participant_age_band: ageBand || null,
          participant_tech_comfort: techComfort || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setDone({ outcome_mapped: j.outcome_mapped });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 640, margin: "80px auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>Thanks — that's it.</h1>
          <p style={{ color: "#a79c8e", fontSize: 15, lineHeight: 1.6 }}>
            Your answers have been saved. The moderator will pass you your voucher in a moment.
          </p>
          <p style={{ color: "#666", fontSize: 12, marginTop: 32 }}>
            (Moderator note: outcome recorded as <code>{done.outcome_mapped}</code>.)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>Quick 15-question survey</h1>
          <p style={{ color: "#a79c8e", fontSize: 14, marginTop: 6, marginBottom: 4 }}>
            About the assistant you just chatted with. Takes about 5 minutes. There are no right answers — say what feels true.
          </p>
          <p style={{ color: "#666", fontSize: 11, marginTop: 4 }}>
            conversation id: <code>{convId}</code>
          </p>
        </header>

        {/* Dimension 1 · AI detection */}
        <Section num={1} title="What did it feel like to talk to?">
          <Q text="1 · Who do you think you were talking to?">
            <Radio group="q1_thought" value="person" checked={r.q1_thought === "person"} onChange={v => set("q1_thought", v)}>A real person</Radio>
            <Radio group="q1_thought" value="ai" checked={r.q1_thought === "ai"} onChange={v => set("q1_thought", v)}>An AI</Radio>
            <Radio group="q1_thought" value="both" checked={r.q1_thought === "both"} onChange={v => set("q1_thought", v)}>A mix of both</Radio>
            <Radio group="q1_thought" value="unsure" checked={r.q1_thought === "unsure"} onChange={v => set("q1_thought", v)}>Not sure</Radio>
          </Q>
          <Q text="2 · How confident are you?">
            <Likert5 name="q2_confidence" value={r.q2_confidence as number | undefined} onChange={v => set("q2_confidence", v)} leftLabel="guessing" rightLabel="certain" />
          </Q>
          <Q text="3 · What made you think that? (required)">
            <TextArea value={r.q3_reason as string || ""} onChange={v => set("q3_reason", v)} rows={2} placeholder="A short sentence is fine · e.g. 'the replies came instantly' or 'it repeated itself twice'" />
          </Q>
        </Section>

        {/* Dimension 2 · Usefulness */}
        <Section num={2} title="Was it useful?">
          <Q text="4 · Did the conversation help you understand your staircase options?">
            <Likert5 name="q4_helped" value={r.q4_helped as number | undefined} onChange={v => set("q4_helped", v)} leftLabel="not at all" rightLabel="very much" />
          </Q>
          <Q text="5 · Did you reach a useful outcome?">
            <Radio group="q5_outcome" value="yes" checked={r.q5_outcome === "yes"} onChange={v => set("q5_outcome", v)}>Yes</Radio>
            <Radio group="q5_outcome" value="partial" checked={r.q5_outcome === "partial"} onChange={v => set("q5_outcome", v)}>Partly</Radio>
            <Radio group="q5_outcome" value="no" checked={r.q5_outcome === "no"} onChange={v => set("q5_outcome", v)}>No</Radio>
          </Q>
          <Q text="6 · Would you use this again for a similar decision?">
            <Radio group="q6_would_use_again" value="yes" checked={r.q6_would_use_again === "yes"} onChange={v => set("q6_would_use_again", v)}>Yes</Radio>
            <Radio group="q6_would_use_again" value="maybe" checked={r.q6_would_use_again === "maybe"} onChange={v => set("q6_would_use_again", v)}>Maybe</Radio>
            <Radio group="q6_would_use_again" value="no" checked={r.q6_would_use_again === "no"} onChange={v => set("q6_would_use_again", v)}>No</Radio>
          </Q>
        </Section>

        {/* Dimension 3 · Correctness / trust */}
        <Section num={3} title="Did you trust it?">
          <Q text="7 · Did you trust the answers you were given?">
            <Likert5 name="q7_trust" value={r.q7_trust as number | undefined} onChange={v => set("q7_trust", v)} leftLabel="not at all" rightLabel="fully" />
          </Q>
          <Q text="8 · Did you spot anything you thought was wrong?">
            <Radio group="q8_wrong" value="yes" checked={r.q8_wrong === "yes"} onChange={v => set("q8_wrong", v)}>Yes</Radio>
            <Radio group="q8_wrong" value="no" checked={r.q8_wrong === "no"} onChange={v => set("q8_wrong", v)}>No</Radio>
            {r.q8_wrong === "yes" && (
              <TextArea value={r.q8_wrong_detail as string || ""} onChange={v => set("q8_wrong_detail", v)} rows={2} placeholder="What was wrong?" />
            )}
          </Q>
        </Section>

        {/* Dimension 4 · Conversation quality */}
        <Section num={4} title="How did the conversation feel?">
          <Q text="9 · Did the assistant understand what you were asking?">
            <Likert5 name="q9_understood" value={r.q9_understood as number | undefined} onChange={v => set("q9_understood", v)} leftLabel="never" rightLabel="always" />
          </Q>
          <Q text="10 · Did the assistant ever repeat itself or feel formulaic?">
            <Radio group="q10_repeated" value="yes" checked={r.q10_repeated === "yes"} onChange={v => set("q10_repeated", v)}>Yes</Radio>
            <Radio group="q10_repeated" value="no" checked={r.q10_repeated === "no"} onChange={v => set("q10_repeated", v)}>No</Radio>
          </Q>
          <Q text="11 · Did the assistant ever misunderstand you?">
            <Radio group="q11_misunderstood" value="yes" checked={r.q11_misunderstood === "yes"} onChange={v => set("q11_misunderstood", v)}>Yes</Radio>
            <Radio group="q11_misunderstood" value="no" checked={r.q11_misunderstood === "no"} onChange={v => set("q11_misunderstood", v)}>No</Radio>
            {r.q11_misunderstood === "yes" && (
              <TextArea value={r.q11_misunderstood_detail as string || ""} onChange={v => set("q11_misunderstood_detail", v)} rows={2} placeholder="What did it misunderstand?" />
            )}
          </Q>
          <Q text="12 · Did you feel frustrated at any point?">
            <Radio group="q12_frustrated" value="yes" checked={r.q12_frustrated === "yes"} onChange={v => set("q12_frustrated", v)}>Yes</Radio>
            <Radio group="q12_frustrated" value="no" checked={r.q12_frustrated === "no"} onChange={v => set("q12_frustrated", v)}>No</Radio>
            {r.q12_frustrated === "yes" && (
              <TextArea value={r.q12_frustrated_detail as string || ""} onChange={v => set("q12_frustrated_detail", v)} rows={2} placeholder="What frustrated you?" />
            )}
          </Q>
        </Section>

        {/* Dimension 5 · Business outcome */}
        <Section num={5} title="Would you tell someone else about Summit?">
          <Q text="13 · How likely are you to recommend Summit based on this experience?">
            <NPSBar value={typeof r.q13_nps === "number" ? r.q13_nps : undefined} onChange={v => set("q13_nps", v)} />
          </Q>
          <Q text="14 · Would you proceed to a real enquiry, call, or visit with Summit?">
            <Radio group="q14_would_enquire" value="yes" checked={r.q14_would_enquire === "yes"} onChange={v => set("q14_would_enquire", v)}>Yes</Radio>
            <Radio group="q14_would_enquire" value="maybe" checked={r.q14_would_enquire === "maybe"} onChange={v => set("q14_would_enquire", v)}>Maybe</Radio>
            <Radio group="q14_would_enquire" value="no" checked={r.q14_would_enquire === "no"} onChange={v => set("q14_would_enquire", v)}>No</Radio>
          </Q>
          <Q text="15 · Anything else you'd like to tell us? (optional)">
            <TextArea value={r.q15_other as string || ""} onChange={v => set("q15_other", v)} rows={3} placeholder="Free text · anything the questions didn't cover" />
          </Q>
        </Section>

        {/* Moderator-only section · toggle */}
        <div style={{ margin: "24px 0", padding: 16, background: "#1a1712", borderRadius: 8, border: "1px dashed #2a2620" }}>
          <button onClick={() => setShowModerator(!showModerator)} style={{ background: "transparent", border: "none", color: "#a79c8e", cursor: "pointer", fontSize: 12, textAlign: "left" }}>
            {showModerator ? "▾" : "▸"} moderator-only (participant demographics + session notes)
          </button>
          {showModerator && (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#a79c8e", marginRight: 8 }}>age band:</label>
                {["18-30", "30-45", "45-60", "60+"].map(a => (
                  <button key={a} onClick={() => setAgeBand(a)} style={{ ...smallChip, background: ageBand === a ? "#b58f5e" : "transparent", color: ageBand === a ? "#0f0d0a" : "#a79c8e" }}>{a}</button>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#a79c8e", marginRight: 8 }}>tech comfort:</label>
                {["low", "medium", "high"].map(c => (
                  <button key={c} onClick={() => setTechComfort(c)} style={{ ...smallChip, background: techComfort === c ? "#b58f5e" : "transparent", color: techComfort === c ? "#0f0d0a" : "#a79c8e" }}>{c}</button>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#a79c8e", display: "block", marginBottom: 4 }}>session notes (facial reactions, moments, pauses):</label>
                <TextArea value={modNotes} onChange={setModNotes} rows={3} placeholder="What did you notice that the survey won't catch?" />
              </div>
            </div>
          )}
        </div>

        {error && <p style={{ color: "#e07070", marginTop: 16 }}>Error: {error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          style={{
            marginTop: 24,
            padding: "12px 28px",
            background: canSubmit ? "#b58f5e" : "#2a2620",
            color: canSubmit ? "#0f0d0a" : "#666",
            border: "none",
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 500,
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          {submitting ? "Saving…" : canSubmit ? "Submit answers" : "Answer required questions to enable"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Local UI helpers · minimal · matches admin visual language
// ────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = { padding: "32px 24px 80px", fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif", background: "#0f0d0a", color: "#e6dfd1", minHeight: "100vh" };
const smallChip: React.CSSProperties = { padding: "4px 12px", marginRight: 6, background: "transparent", border: "1px solid #2a2620", borderRadius: 999, fontSize: 12, cursor: "pointer", fontFamily: "inherit" };

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32, padding: 20, background: "#161310", borderRadius: 10, border: "1px solid #2a2620" }}>
      <h2 style={{ fontSize: 16, color: "#dbb17a", marginTop: 0, marginBottom: 16, fontWeight: 500 }}>
        <span style={{ color: "#a79c8e", marginRight: 8 }}>{num}</span>{title}
      </h2>
      {children}
    </section>
  );
}

function Q({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 13, color: "#e6dfd1", display: "block", marginBottom: 8 }}>{text}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "flex-start" }}>{children}</div>
    </div>
  );
}

function Radio({ group, value, checked, onChange, children }: { group: string; value: string; checked: boolean; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      style={{
        padding: "8px 16px",
        background: checked ? "#b58f5e" : "transparent",
        color: checked ? "#0f0d0a" : "#e6dfd1",
        border: `1px solid ${checked ? "#b58f5e" : "#2a2620"}`,
        borderRadius: 6,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
      data-group={group}
    >{children}</button>
  );
}

function Likert5({ name, value, onChange, leftLabel, rightLabel }: { name: string; value: number | undefined; onChange: (v: number) => void; leftLabel: string; rightLabel: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map(v => (
          <button key={v} type="button" onClick={() => onChange(v)} data-name={name} style={{
            width: 40, height: 40, background: value === v ? "#b58f5e" : "transparent",
            color: value === v ? "#0f0d0a" : "#e6dfd1", border: `1px solid ${value === v ? "#b58f5e" : "#2a2620"}`,
            borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>{v}</button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#666", width: 232 }}>
        <span>1 · {leftLabel}</span>
        <span>5 · {rightLabel}</span>
      </div>
    </div>
  );
}

function NPSBar({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => {
          const isDetractor = v <= 6;
          const isPromoter = v >= 9;
          const active = value === v;
          const bg = active ? (isPromoter ? "#7fd4a8" : isDetractor ? "#e07070" : "#dbb17a") : "transparent";
          const border = active ? bg : "#2a2620";
          const color = active ? "#0f0d0a" : "#e6dfd1";
          return (
            <button key={v} type="button" onClick={() => onChange(v)} style={{
              width: 36, height: 36, background: bg, color, border: `1px solid ${border}`,
              borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>{v}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#666", width: 440 }}>
        <span>0 · not at all</span>
        <span>10 · definitely</span>
      </div>
    </div>
  );
}

function TextArea({ value, onChange, rows, placeholder }: { value: string; onChange: (v: string) => void; rows: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: 10,
        background: "#0a0806",
        border: "1px solid #2a2620",
        color: "#e6dfd1",
        borderRadius: 6,
        fontSize: 13,
        fontFamily: "inherit",
        resize: "vertical",
      }}
    />
  );
}
