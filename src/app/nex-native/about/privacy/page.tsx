// src/app/nex-native/about/privacy/page.tsx
//
// Bridge 82 · NEX Privacy pledge · reworded 2026-09-29.
// -----------------------------------------------------
// Founder direction: no consent modal, no scary warnings · this page
// is a POSITIONING statement about how NEX proactively protects users
// against AI bots + fast-moving software threats. Legal detail lives
// on /nex-native/about/terms.
//
// Tone: industry-leading, forward-looking. NEX chose zero-knowledge
// architecture on purpose because bots + broker economies + rushed
// AI product cycles outpace what regulation can restrain. NEX doesn't
// wait for the law to catch up · we ship the strictest architecture
// we can and treat privacy as the product, not the disclaimer.

import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  orange: "#FF7200",
  green: "#22E37A",
  greenFaint: "rgba(34, 227, 122, 0.14)",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";

export default function PrivacyPledgePage(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding:
            "calc(env(safe-area-inset-top, 0) + 40px) 20px 80px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          🔒 The NEX privacy pledge
        </div>

        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: "clamp(34px, 6vw, 56px)",
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            marginBottom: 20,
          }}
        >
          Leading the industry on what safety should look like.
        </h1>

        <p
          style={{
            margin: "0 0 32px",
            fontSize: 17,
            lineHeight: 1.55,
            color: NEX.textDim,
            maxWidth: 640,
          }}
        >
          AI bots, data brokers, and consumer software are shipping
          faster than the safety and privacy rules that were supposed
          to keep pace with them. NEX doesn't wait for the law to catch
          up. We built NEX so that even we can't read your chats — the
          strictest architecture we could ship — and we ship it as the
          default, not an opt-in.
        </p>

        {/* Three-column commitment */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginBottom: 32,
          }}
        >
          <Panel accent={NEX.cyan}>
            <ChipLabel color={NEX.cyan}>End-to-end by default</ChipLabel>
            <Body>
              Every personal message, chat photo, chat video, and voice
              note is encrypted on your device before it leaves. NEX
              servers relay ciphertext they can't read.
            </Body>
          </Panel>
          <Panel accent={NEX.green}>
            <ChipLabel color={NEX.green}>Nothing to sell</ChipLabel>
            <Body>
              No ad targeting, no data-broker pipelines, no AI training
              corpus. We can't monetise what we can't see. That's the
              point.
            </Body>
          </Panel>
          <Panel accent={NEX.orange}>
            <ChipLabel color={NEX.orange}>Bots can't read this</ChipLabel>
            <Body>
              A model scraping NEX finds encrypted bytes with no key.
              Your chats aren't training data · your voice isn't a
              voiceprint anyone can harvest.
            </Body>
          </Panel>
        </section>

        {/* What it means for you */}
        <section
          style={{
            padding: "24px 22px",
            borderRadius: 16,
            background: NEX.panel,
            border: `1px solid ${NEX.cyanSoft}`,
            marginBottom: 32,
          }}
        >
          <ChipLabel color={NEX.cyan}>What NEX chose, on purpose</ChipLabel>
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <Row
              title="Your device is the archive"
              body="NEX doesn't back your chats up to a cloud we control. Your phone holds the only readable copy · which is exactly why nobody else can pull them from us."
            />
            <Row
              title="Calls skip our servers"
              body="Voice + video calls are direct peer-to-peer WebRTC. We help the two devices find each other and get out of the way. No call is ever routed through, recorded by, or visible to NEX."
            />
            <Row
              title="Server retention measured in days, not years"
              body="Once your friend's device confirms it received a message, our copy is queued for deletion. Storage cost stays low, privacy stays high."
            />
            <Row
              title="Public identity, private conversation"
              body="Your nex-XXXXX handle + display name are public so friends can find you. Everything you say to them is not."
            />
          </div>
        </section>

        {/* Comparison */}
        <section
          style={{
            padding: "22px",
            borderRadius: 16,
            background: NEX.panel,
            border: `1px solid ${NEX.cyanSoft}`,
            marginBottom: 32,
          }}
        >
          <ChipLabel color={NEX.cyan}>How NEX compares</ChipLabel>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              rowGap: 10,
              columnGap: 12,
              fontSize: 14,
              color: NEX.textDim,
              lineHeight: 1.4,
            }}
          >
            <div>WhatsApp</div>
            <div style={{ color: NEX.text, fontWeight: 600 }}>Cloud backup on Google / iCloud, often unencrypted</div>
            <div>iMessage</div>
            <div style={{ color: NEX.text, fontWeight: 600 }}>iCloud backup, unencrypted by default</div>
            <div>Telegram (cloud chats)</div>
            <div style={{ color: NEX.text, fontWeight: 600 }}>Plaintext on Telegram servers</div>
            <div>Signal</div>
            <div style={{ color: NEX.text, fontWeight: 600 }}>Optional encrypted backup</div>
            <div style={{ color: NEX.orange, fontWeight: 700 }}>NEX</div>
            <div style={{ color: NEX.green, fontWeight: 700 }}>Zero server-side archive · your device is the only copy</div>
          </div>
        </section>

        {/* What the trade-off is (framed positively) */}
        <section
          style={{
            padding: "20px 22px",
            borderRadius: 16,
            background: NEX.greenFaint,
            border: "1px solid rgba(34,227,122,0.35)",
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
              fontFamily: SERIF,
              fontSize: 22,
              fontWeight: 500,
              lineHeight: 1.25,
            }}
          >
            Your history is yours to steward.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.65,
              color: NEX.textDim,
            }}
          >
            Because NEX doesn't hold your data, you're free to move it,
            keep it, or delete it on your own terms. Back up your phone
            the way you already do · your NEX history rides along. It's
            in your hands · which is where privacy actually lives.
          </p>
        </section>

        {/* CTA */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 32,
          }}
        >
          <Link
            href="/nex-native/create-account"
            style={{
              padding: "14px 24px",
              borderRadius: 12,
              background: NEX.orange,
              color: "#0B0F1A",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textDecoration: "none",
              boxShadow: "0 8px 20px rgba(255,120,0,0.35)",
            }}
          >
            Join NEX
          </Link>
          <Link
            href="/nex-native/about/terms"
            style={{
              padding: "14px 24px",
              borderRadius: 12,
              background: "transparent",
              color: NEX.text,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textDecoration: "none",
              border: `1px solid ${NEX.cyanSoft}`,
            }}
          >
            Terms of Use
          </Link>
        </div>

        <p
          style={{
            marginTop: 40,
            fontSize: 11,
            color: NEX.textMute,
            letterSpacing: "0.04em",
          }}
        >
          Zero-knowledge architecture sealed 2026-09-29. Covers text
          messages, chat photos, chat video, voice notes, and calls in
          every NEX peer chat. Shop product images, restaurant menu
          photos, and business logos stay server-hosted so people
          browsing a shop can see them without a chat first.
        </p>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------- *
 * Helpers                                                          *
 * --------------------------------------------------------------- */

function Panel({
  accent,
  children,
}: {
  accent: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "20px 20px",
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${accent}55`,
        boxShadow: `0 8px 20px ${accent}12`,
      }}
    >
      {children}
    </div>
  );
}

function ChipLabel({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p
      style={{
        margin: "10px 0 0",
        fontSize: 14,
        lineHeight: 1.6,
        color: NEX.textDim,
      }}
    >
      {children}
    </p>
  );
}

function Row({
  title,
  body,
}: {
  title: string;
  body: string;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: NEX.text,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: NEX.textDim,
          lineHeight: 1.55,
        }}
      >
        {body}
      </div>
    </div>
  );
}
