"use client";
// Worker portal client · list + measurement form
//
// Kept deliberately small — no libraries, no design system. The point
// is to prove the round-trip works. Polish comes when Philip signs off
// the architecture.

import { useState, useCallback, useMemo } from "react";

type BoardView = {
  id: string;
  board_ref: string;
  position_in_pack: number;
  status: string;
  current_measurement: null | {
    measurement_version: number;
    length_mm: number;
    width_centre_mm: number;
    thickness_centre_mm: number;
    measured_at: string;
  };
};

type WorkerView = {
  link: { id: string; label: string | null; pack_id: string; current_uses: number; max_uses: number | null; expires_at: string | null };
  pack: { id: string; pack_ref: string; grade: string | null; status: string; species: { id: string; display_name: string }; board_count_expected: number | null };
  boards: BoardView[];
};

export default function WorkerPortalClient(props: { token: string; initial: WorkerView }) {
  const [view, setView] = useState<WorkerView>(props.initial);
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);

  const measured = view.boards.filter(b => b.current_measurement).length;
  const total = view.boards.length;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/worker/${encodeURIComponent(props.token)}/validate`, { cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    if (res.ok && payload.ok) setView(payload.data as WorkerView);
  }, [props.token]);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <header style={{ padding: 12, background: "white", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#666" }}>{view.pack.species.display_name} · {view.pack.grade ?? "—"}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{view.pack.pack_ref}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{measured} of {total} measured</div>
        <div style={{ height: 6, background: "#eee", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
          <div style={{ width: `${total ? (measured / total) * 100 : 0}%`, height: "100%", background: "#0a7a2f", transition: "width .3s" }} />
        </div>
      </header>

      {view.boards.length === 0 && (
        <div style={{ padding: 20, background: "white", borderRadius: 8, textAlign: "center", color: "#888" }}>
          No boards yet. Ask the office to add them.
        </div>
      )}

      {view.boards.map(b => {
        const isOpen = openBoardId === b.id;
        return (
          <div key={b.id} style={{ background: "white", borderRadius: 8, marginBottom: 8 }}>
            <button
              onClick={() => setOpenBoardId(isOpen ? null : b.id)}
              style={{
                width: "100%",
                padding: 12,
                textAlign: "left",
                border: "none",
                background: "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                fontSize: 15,
              }}
            >
              <span>
                <strong>#{b.board_ref}</strong>
                {b.current_measurement && (
                  <span style={{ color: "#0a7a2f", marginLeft: 8, fontSize: 12 }}>
                    ✓ v{b.current_measurement.measurement_version}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 11, color: "#888" }}>{b.status}</span>
            </button>
            {isOpen && (
              <MeasurementForm
                token={props.token}
                boardId={b.id}
                onSaved={async () => {
                  await refresh();
                  setOpenBoardId(null);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MeasurementForm(props: { token: string; boardId: string; onSaved: () => void }) {
  const [length, setLength]                       = useState("");
  const [widthA, setWidthA]                       = useState("");
  const [widthCentre, setWidthCentre]             = useState("");
  const [widthB, setWidthB]                       = useState("");
  const [thicknessA, setThicknessA]               = useState("");
  const [thicknessCentre, setThicknessCentre]     = useState("");
  const [thicknessB, setThicknessB]               = useState("");
  const [notes, setNotes]                         = useState("");
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState<string | null>(null);

  const canSave = useMemo(() => {
    return [length, widthA, widthCentre, widthB, thicknessA, thicknessCentre, thicknessB].every(v => v.trim() !== "" && Number(v) > 0);
  }, [length, widthA, widthCentre, widthB, thicknessA, thicknessCentre, thicknessB]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/worker/${encodeURIComponent(props.token)}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id:              props.boardId,
          length_mm:             Number(length),
          width_end_a_mm:        Number(widthA),
          width_centre_mm:       Number(widthCentre),
          width_end_b_mm:        Number(widthB),
          thickness_end_a_mm:    Number(thicknessA),
          thickness_centre_mm:   Number(thicknessCentre),
          thickness_end_b_mm:    Number(thicknessB),
          notes:                 notes.trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Save failed");
        setSaving(false);
        return;
      }
      props.onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ padding: 12, borderTop: "1px solid #eee" }}>
      <label style={label}>Length (mm)
        <input type="number" inputMode="numeric" value={length} onChange={e => setLength(e.target.value)} style={input} required />
      </label>
      <fieldset style={fieldset}>
        <legend style={legend}>Width (mm) — 3 samples</legend>
        <div style={grid3}>
          <input placeholder="End A" type="number" inputMode="numeric" value={widthA} onChange={e => setWidthA(e.target.value)} style={input} required />
          <input placeholder="Centre" type="number" inputMode="numeric" value={widthCentre} onChange={e => setWidthCentre(e.target.value)} style={input} required />
          <input placeholder="End B" type="number" inputMode="numeric" value={widthB} onChange={e => setWidthB(e.target.value)} style={input} required />
        </div>
      </fieldset>
      <fieldset style={fieldset}>
        <legend style={legend}>Thickness (mm) — 3 samples</legend>
        <div style={grid3}>
          <input placeholder="End A" type="number" inputMode="numeric" value={thicknessA} onChange={e => setThicknessA(e.target.value)} style={input} required />
          <input placeholder="Centre" type="number" inputMode="numeric" value={thicknessCentre} onChange={e => setThicknessCentre(e.target.value)} style={input} required />
          <input placeholder="End B" type="number" inputMode="numeric" value={thicknessB} onChange={e => setThicknessB(e.target.value)} style={input} required />
        </div>
      </fieldset>
      <label style={label}>Notes (optional)
        <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...input, minHeight: 48 }} />
      </label>
      {error && <div style={{ color: "#a00", marginTop: 8, fontSize: 12 }}>{error}</div>}
      <button
        type="submit"
        disabled={!canSave || saving}
        style={{
          marginTop: 12,
          padding: "10px 16px",
          fontSize: 15,
          fontWeight: 600,
          background: canSave ? "#0a7a2f" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: 6,
          width: "100%",
          cursor: canSave ? "pointer" : "not-allowed",
        }}
      >
        {saving ? "Saving…" : "Save measurement"}
      </button>
    </form>
  );
}

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "#333",
  marginTop: 10,
};
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 8px",
  fontSize: 15,
  border: "1px solid #ccc",
  borderRadius: 4,
  marginTop: 4,
};
const fieldset: React.CSSProperties = {
  marginTop: 10,
  padding: 8,
  border: "1px solid #eee",
  borderRadius: 4,
};
const legend: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#666",
  padding: "0 4px",
};
const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 6,
};
