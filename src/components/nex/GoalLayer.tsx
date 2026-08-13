// Goal Layer · 7-card landing surface (Phase C).
//
// Replaces the "what do you want to ask?" empty state with
// "What are you trying to achieve today?" — 7 outcome-focused cards.
//
// When the user picks a card:
//   - onGoalSelected() fires with the goal id
//   - The parent should then transition to the goal's default conversation
//     with Identity + Domain pre-populated
//
// If the user types a message instead of picking a card:
//   - onFreeText() fires with the input
//   - The parent classifies via /api/nex/identity + /api/nex/universal-intent
//
// Doctrine: docs/brains/nex-user-identity-brain-philip-2026-08-03.md
// Composes with Foundation Brain 15 (End With Value · every card is a next-step)

"use client";

import { useState } from "react";

export type GoalId =
  | "home_property"
  | "business_growth"
  | "sell_products"
  | "money"
  | "design_studio"
  | "learn_something"
  | "build_with_ai";

export type Goal = {
  id: GoalId;
  emoji: string;
  title: string;
  description: string;
  default_identity_hint: string;
  default_domain_hint: string;
};

const GOALS: readonly Goal[] = [
  {
    id: "home_property",
    emoji: "🏠",
    title: "Home & Property",
    description: "Design a staircase · plan a kitchen · renovate · extension · flooring · lighting",
    default_identity_hint: "homeowner_informed",
    default_domain_hint: "staircase",
  },
  {
    id: "business_growth",
    emoji: "💼",
    title: "Business Growth",
    description: "Get more customers · marketing · website · social media · AI employees",
    default_identity_hint: "business_owner",
    default_domain_hint: "marketing",
  },
  {
    id: "sell_products",
    emoji: "🛒",
    title: "Sell Products",
    description: "Online shop · product descriptions · pricing · catalogues · quotations",
    default_identity_hint: "business_owner",
    default_domain_hint: "ecommerce",
  },
  {
    id: "money",
    emoji: "💰",
    title: "Money",
    description: "Budgets · invoices · profit · pricing · forecasting · expenses",
    default_identity_hint: "business_owner",
    default_domain_hint: "finance",
  },
  {
    id: "design_studio",
    emoji: "🎨",
    title: "Design Studio",
    description: "Logos · branding · banners · packaging · interior design · colour schemes",
    default_identity_hint: "business_owner",
    default_domain_hint: "design",
  },
  {
    id: "learn_something",
    emoji: "📚",
    title: "Learn Something",
    description: "Trade skills · marketing · coding · SEO · anything you want to understand",
    default_identity_hint: "student",
    default_domain_hint: "education",
  },
  {
    id: "build_with_ai",
    emoji: "🤖",
    title: "Build With AI",
    description: "Apps · websites · automations · chatbots · AI agents · workflows",
    default_identity_hint: "developer",
    default_domain_hint: "ai",
  },
];

type Props = {
  greeting?: string;
  onGoalSelected: (goal: Goal) => void;
  onFreeText: (input: string) => void;
};

export function GoalLayer({ greeting, onGoalSelected, onFreeText }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onFreeText(text.trim());
      setText("");
    }
  };

  return (
    <div style={{
      maxWidth: 960,
      margin: "0 auto",
      padding: "48px 24px",
      fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 600,
          margin: "0 0 8px",
          color: "#1a1a1a",
          letterSpacing: "-0.02em",
        }}>
          {greeting ?? "Welcome to Nex"}
        </h1>
        <p style={{
          fontSize: 20,
          color: "#666",
          margin: 0,
          fontWeight: 400,
        }}>
          What are you trying to achieve today?
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12,
        marginBottom: 32,
      }}>
        {GOALS.map((goal) => (
          <button
            key={goal.id}
            type="button"
            onClick={() => onGoalSelected(goal)}
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: "20px 18px",
              textAlign: "left",
              cursor: "pointer",
              transition: "transform 0.12s, box-shadow 0.12s, border-color 0.12s",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.transform = "translateY(-2px)";
              el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
              el.style.borderColor = "#c8c8c8";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "none";
              el.style.borderColor = "#e5e5e5";
            }}
          >
            <span style={{ fontSize: 26 }}>{goal.emoji}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>{goal.title}</span>
            <span style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>{goal.description}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 8,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…or tell Nex what you want to accomplish"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 15,
            padding: "10px 12px",
            background: "transparent",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          style={{
            background: text.trim() ? "#1a1a1a" : "#e5e5e5",
            color: text.trim() ? "#fff" : "#999",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 500,
            cursor: text.trim() ? "pointer" : "not-allowed",
            transition: "background 0.12s",
          }}
        >
          Continue
        </button>
      </form>

      <div style={{
        marginTop: 24,
        fontSize: 12,
        color: "#999",
        textAlign: "center",
      }}>
        Every conversation moves you forward.
      </div>
    </div>
  );
}

export { GOALS };
