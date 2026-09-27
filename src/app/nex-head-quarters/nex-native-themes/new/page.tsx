// src/app/nex-head-quarters/nex-native-themes/new/page.tsx
//
// NEX HQ · Chat theme builder.
// ----------------------------
// Founder builds a new theme here. Fields are explained in plain
// English inside the form itself · not just terse hints. Preview
// panel on the right repaints every keystroke so what-you-see is
// what-users-will-see.
//
// Auth · HQ is behind founder middleware · plus the createTheme
// Server Action re-verifies dev-admin@nex-native.local as a second
// safety layer.

import Link from "next/link";
import { adminCreateChatThemeAction } from "../../../nex-native/_actions";
import { ThemeBuilderForm } from "./_theme-builder-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  cyan: "#00AFFF",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

export default function HqThemeBuilderPage() {
  return (
    <div style={{ padding: "16px 24px 40px", color: NEX.text }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <Link
            href="/nex-head-quarters/nex-native-themes"
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
              textDecoration: "none",
            }}
          >
            ← Theme catalogue
          </Link>
        </div>

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Build a new chat theme
        </h1>

        <div
          style={{
            marginBottom: 22,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(0,175,255,0.08)",
            border: "1px solid rgba(0,175,255,0.35)",
            fontSize: 13,
            color: NEX.text,
            lineHeight: 1.6,
            maxWidth: 780,
          }}
        >
          <strong style={{ display: "block", marginBottom: 6, color: NEX.cyan }}>
            What is a theme?
          </strong>
          A NEX chat theme is a visual identity a user wears when others
          chat with them. When Maria picks a theme, everyone who opens
          Maria&rsquo;s chat sees it — bubble borders, the composer, the
          ripple when Maria sends a message. Themes are how users show
          personality inside NEX conversations. Free themes are always
          available. <strong style={{ color: "#FF7200" }}>Premium themes</strong>{" "}
          are locked behind a paid NEX Bisnis subscription — they&rsquo;re
          the reason someone upgrades.
        </div>

        <ThemeBuilderForm action={adminCreateChatThemeAction} />
      </div>
    </div>
  );
}
