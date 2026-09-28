"use client";

// src/app/nex-native/manage/ladder/_editor.tsx
//
// Bridge 49c · Client editor for the NEX Direct Price ladder.
// Founder direction 2026-09-29. Dark chat-card palette · Swiss-NEX
// aesthetic to match D6 · Bauhaus discipline on the tier ladder rows.
//
// Ladder rows are locally editable (add / remove / edit) · tiers_json
// hidden input carries the current shape to the server action on save.
// Other fields are plain named inputs · server validates.

import { useCallback, useMemo, useState } from "react";
import type { LadderTier } from "@/lib/nex-native/ladder-service";
import { upsertLadderAction } from "../../_actions";

interface Props {
  businessId: string;
  businessName: string;
  businessSlug: string;
  compareMarkupPct: number;
  initialLadder: {
    tiers: LadderTier[];
    maxCapPct: number;
    shareFriendBonusPct: number;
    shareGroupBonusPct: number;
    shareExpiryHours: number;
    compareChannel: string;
    active: boolean;
  };
}

const NEX = {
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "rgba(125,155,192,0.65)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeStrong: "#FF9033",
  green: "#10B981",
};

const DEFAULT_TIERS: LadderTier[] = [
  { order: 1, discount: 0, label: "New here" },
  { order: 2, discount: 3, label: "Getting to know us" },
  { order: 4, discount: 5, label: "Regular" },
  { order: 7, discount: 8, label: "We know your order" },
  { order: 12, discount: 15, label: "Member for life" },
];

export function NexDirectPriceEditor(props: Props) {
  const [tiers, setTiers] = useState<LadderTier[]>(props.initialLadder.tiers);
  const [maxCap, setMaxCap] = useState(props.initialLadder.maxCapPct);
  const [friendBonus, setFriendBonus] = useState(props.initialLadder.shareFriendBonusPct);
  const [groupBonus, setGroupBonus] = useState(props.initialLadder.shareGroupBonusPct);
  const [expiryHours, setExpiryHours] = useState(props.initialLadder.shareExpiryHours);
  const [compareChannel, setCompareChannel] = useState(props.initialLadder.compareChannel);
  const [compareMarkup, setCompareMarkup] = useState(props.compareMarkupPct);
  const [active, setActive] = useState(props.initialLadder.active);

  const setTierField = useCallback(
    (idx: number, field: keyof LadderTier, value: string) => {
      setTiers((prev) => {
        const next = [...prev];
        const row = { ...next[idx]! };
        if (field === "order" || field === "discount") {
          const n = Number.parseInt(value, 10);
          if (Number.isFinite(n)) (row as unknown as Record<string, number>)[field] = n;
        } else {
          (row as unknown as Record<string, string>)[field] = value;
        }
        next[idx] = row;
        return next;
      });
    },
    [],
  );

  const addTier = useCallback(() => {
    setTiers((prev) => {
      if (prev.length >= 8) return prev;
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          order: (last?.order ?? 0) + 5,
          discount: Math.min(maxCap, (last?.discount ?? 0) + 2),
          label: "New tier",
        },
      ];
    });
  }, [maxCap]);

  const removeTier = useCallback((idx: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const resetDefaults = useCallback(() => {
    setTiers([...DEFAULT_TIERS]);
    setMaxCap(15);
    setFriendBonus(5);
    setGroupBonus(7);
    setExpiryHours(48);
    setCompareChannel("typical delivery app");
    setCompareMarkup(22);
  }, []);

  const tiersJson = useMemo(() => JSON.stringify(tiers), [tiers]);
  const boundAction = useMemo(
    () => upsertLadderAction.bind(null, props.businessId),
    [props.businessId],
  );

  const monotonicWarning = useMemo(() => {
    let prev = -1;
    for (const t of tiers) {
      if (t.discount < prev) {
        return "Discount can only rise as orders rise · fix red rows before saving.";
      }
      prev = t.discount;
    }
    return null;
  }, [tiers]);

  return (
    <form
      action={boundAction}
      data-nex-ladder-editor
      style={{
        marginTop: 20,
        padding: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 14,
      }}
    >
      <input type="hidden" name="tiers_json" value={tiersJson} />

      {/* Shop identity */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingBottom: 12,
          borderBottom: `1px solid ${NEX.cyanFaint}`,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${NEX.orangeStrong}, ${NEX.orange})`,
            display: "grid",
            placeItems: "center",
            fontSize: 16,
          }}
        >
          🛍
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{props.businessName}</div>
          <div style={{ fontSize: 10, color: NEX.textSecondary, letterSpacing: "0.04em" }}>
            /nex-native/{props.businessSlug}
          </div>
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 800,
            color: active ? NEX.green : NEX.textMute,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            style={{ accentColor: NEX.green }}
          />
          <span>{active ? "Active" : "Paused"}</span>
        </label>
      </div>

      {/* Tier ladder */}
      <FieldGroup label="Loyalty ladder">
        <p style={{ margin: "0 0 10px", fontSize: 11, color: NEX.textSecondary, lineHeight: 1.5 }}>
          Each row = a milestone. As buyers place more orders, they climb the ladder and unlock bigger discounts.
        </p>
        {tiers.map((t, idx) => {
          const prev = tiers[idx - 1]?.discount ?? -1;
          const isRegression = t.discount < prev;
          return (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr 68px 32px",
                gap: 6,
                alignItems: "center",
                padding: "8px 4px",
                borderBottom: `1px solid ${NEX.cyanFaint}`,
                background: isRegression ? "rgba(239,68,68,0.06)" : "transparent",
              }}
            >
              <div>
                <div style={ministatStyle()}>Order</div>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={t.order}
                  onChange={(e) => setTierField(idx, "order", e.target.value)}
                  style={miniInputStyle()}
                />
              </div>
              <div>
                <div style={ministatStyle()}>Label</div>
                <input
                  type="text"
                  value={t.label}
                  onChange={(e) => setTierField(idx, "label", e.target.value)}
                  maxLength={40}
                  style={miniInputStyle()}
                />
              </div>
              <div>
                <div style={ministatStyle()}>% off</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={t.discount}
                  onChange={(e) => setTierField(idx, "discount", e.target.value)}
                  style={{
                    ...miniInputStyle(),
                    color: isRegression ? "#EF4444" : NEX.orange,
                    fontWeight: 800,
                  }}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  aria-label="Remove tier"
                  disabled={tiers.length <= 1}
                  style={{
                    width: 28,
                    height: 28,
                    marginTop: 12,
                    borderRadius: 6,
                    background: "transparent",
                    color: NEX.textMute,
                    border: `1px solid ${NEX.cyanFaint}`,
                    fontSize: 12,
                    cursor: tiers.length <= 1 ? "not-allowed" : "pointer",
                    opacity: tiers.length <= 1 ? 0.4 : 1,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
        {monotonicWarning && (
          <p
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#EF4444",
              lineHeight: 1.4,
            }}
          >
            ⚠ {monotonicWarning}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={addTier}
            disabled={tiers.length >= 8}
            style={secondaryButtonStyle({ dim: tiers.length >= 8 })}
          >
            + Add tier
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            style={secondaryButtonStyle()}
          >
            Reset to defaults
          </button>
        </div>
      </FieldGroup>

      {/* Max cap · slider */}
      <FieldGroup label={`Max discount cap · ${maxCap}%`}>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: NEX.textSecondary, lineHeight: 1.5 }}>
          Ceiling on total stacked discount (tier + share). Restaurants safe at 15% (still beats GoFood 22% commission). Product shops may cap lower.
        </p>
        <input
          type="range"
          name="max_cap_pct"
          min={0}
          max={25}
          value={maxCap}
          onChange={(e) => setMaxCap(Number(e.target.value))}
          style={{ width: "100%", accentColor: NEX.orange }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: NEX.textMute,
            letterSpacing: "0.06em",
          }}
        >
          <span>0%</span>
          <span>15%</span>
          <span>25% max</span>
        </div>
      </FieldGroup>

      {/* Share bonuses · two sliders */}
      <FieldGroup label="Share rewards · NEX-only">
        <p style={{ margin: "0 0 10px", fontSize: 11, color: NEX.textSecondary, lineHeight: 1.5 }}>
          Buyers can share your products to their NEX friends and groups. Both sides get the bonus if they order within the window. Sharing is NEX-internal only · never external. Same contact/group not sharable twice in 7 days · recipient must have been active in the last 7 days.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: NEX.textPrimary, marginBottom: 4 }}>
              👤 Friend share · <strong style={{ color: NEX.cyan }}>{friendBonus}%</strong> both sides
            </div>
            <input
              type="range"
              name="share_friend_bonus_pct"
              min={0}
              max={15}
              value={friendBonus}
              onChange={(e) => setFriendBonus(Number(e.target.value))}
              style={{ width: "100%", accentColor: NEX.cyan }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: NEX.textPrimary, marginBottom: 4 }}>
              👥 Group share · <strong style={{ color: NEX.cyan }}>{groupBonus}%</strong> both sides
            </div>
            <input
              type="range"
              name="share_group_bonus_pct"
              min={0}
              max={20}
              value={groupBonus}
              onChange={(e) => setGroupBonus(Number(e.target.value))}
              style={{ width: "100%", accentColor: NEX.cyan }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: NEX.textPrimary, marginBottom: 4 }}>
              ⏳ Reward window · <strong style={{ color: NEX.cyan }}>{expiryHours} hours</strong>
            </div>
            <input
              type="range"
              name="share_expiry_hours"
              min={1}
              max={168}
              value={expiryHours}
              onChange={(e) => setExpiryHours(Number(e.target.value))}
              style={{ width: "100%", accentColor: NEX.cyan }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: NEX.textMute,
              }}
            >
              <span>1 hr</span>
              <span>48 hr · default</span>
              <span>1 wk</span>
            </div>
          </div>
        </div>
      </FieldGroup>

      {/* Compare price · channel + markup */}
      <FieldGroup label="Compare price · vs delivery apps">
        <p style={{ margin: "0 0 10px", fontSize: 11, color: NEX.textSecondary, lineHeight: 1.5 }}>
          Every product shows "you save Rp X vs {compareChannel}" so buyers see the value of ordering direct from you on NEX vs paying a delivery app's markup.
          <br />
          <strong style={{ color: NEX.orange }}>Never</strong> name a specific competitor here (Gojek, GrabFood, Shopee etc.) · server rejects it · legal safety.
        </p>
        <label
          style={{ display: "block", marginBottom: 12, fontSize: 11, color: NEX.textSecondary }}
        >
          Compare label
          <input
            type="text"
            name="compare_channel"
            value={compareChannel}
            maxLength={60}
            onChange={(e) => setCompareChannel(e.target.value)}
            placeholder="typical delivery app"
            style={inputStyle()}
          />
        </label>
        <label style={{ display: "block", fontSize: 11, color: NEX.textSecondary }}>
          Compare markup · <strong style={{ color: NEX.orange }}>{compareMarkup}%</strong> above your NEX price
          <input
            type="range"
            name="compare_markup_pct"
            min={0}
            max={60}
            value={compareMarkup}
            onChange={(e) => setCompareMarkup(Number(e.target.value))}
            style={{ width: "100%", accentColor: NEX.orange, marginTop: 4 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: NEX.textMute }}>
            <span>0%</span>
            <span>22% · GoFood range</span>
            <span>60%</span>
          </div>
        </label>
      </FieldGroup>

      {/* Save row */}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button
          type="submit"
          disabled={monotonicWarning !== null}
          style={{
            flex: 1,
            minHeight: 48,
            padding: "10px 16px",
            borderRadius: 10,
            background: monotonicWarning
              ? "rgba(255,114,0,0.35)"
              : `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`,
            color: "#0B0F1A",
            border: "none",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            cursor: monotonicWarning ? "not-allowed" : "pointer",
            opacity: monotonicWarning ? 0.55 : 1,
            boxShadow: monotonicWarning
              ? "none"
              : "0 10px 26px rgba(255,114,0,0.45)",
          }}
        >
          {monotonicWarning ? "Fix red rows" : "Save Direct Price"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset
      style={{
        marginTop: 18,
        padding: 0,
        border: "none",
      }}
    >
      <legend
        style={{
          padding: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: NEX.orange,
          marginBottom: 6,
        }}
      >
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ministatStyle(): React.CSSProperties {
  return {
    fontSize: 8,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: NEX.textMute,
    fontWeight: 700,
    marginBottom: 2,
  };
}

function miniInputStyle(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    minHeight: 32,
    padding: "6px 8px",
    background: NEX.fieldBg,
    color: NEX.textPrimary,
    border: `1px solid ${NEX.cyanFaint}`,
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "inherit",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    display: "block",
    marginTop: 4,
    width: "100%",
    minHeight: 40,
    padding: "8px 12px",
    background: NEX.fieldBg,
    color: NEX.textPrimary,
    border: `1px solid ${NEX.cyanFaint}`,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "inherit",
  };
}

function secondaryButtonStyle(opts: { dim?: boolean } = {}): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 6,
    background: "transparent",
    color: opts.dim ? NEX.textMute : NEX.cyan,
    border: `1px solid ${opts.dim ? NEX.cyanFaint : NEX.cyan}`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    cursor: opts.dim ? "not-allowed" : "pointer",
    opacity: opts.dim ? 0.5 : 1,
  };
}
