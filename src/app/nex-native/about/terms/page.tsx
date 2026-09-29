// src/app/nex-native/about/terms/page.tsx
//
// Bridge 82 · NEX Terms of Use.
// -----------------------------
// Founder direction 2026-09-29: no consent modal at signup · legal
// language lives here · positioned as NEX leading the industry, not
// warning users. Signup link references this page inline.
//
// This is a plain-language terms doc, not a lawyer-produced contract.
// Founder should replace with a legally-reviewed version before any
// commercial launch outside a pilot audience.

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
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";

export default function TermsOfUsePage(): React.JSX.Element {
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
          Terms of Use · v1 · 2026-09-29
        </div>

        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: "clamp(30px, 5vw, 48px)",
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            marginBottom: 20,
          }}
        >
          NEX Terms of Use
        </h1>

        <p
          style={{
            margin: "0 0 32px",
            fontSize: 15,
            lineHeight: 1.65,
            color: NEX.textDim,
          }}
        >
          Plain-language terms. By creating a NEX account you agree
          to the following. Our
          {" "}
          <Link
            href="/nex-native/about/privacy"
            style={{ color: NEX.orange, textDecoration: "none", fontWeight: 600 }}
          >
            Privacy pledge
          </Link>
          {" "}
          explains the architecture in more depth.
        </p>

        <Section num="1" title="What NEX is">
          NEX is a peer-to-peer messaging and small-business platform.
          You use it to talk to friends, discover shops and restaurants,
          and let others discover yours. Voice and video calls run
          directly between devices · they never pass through NEX
          servers.
        </Section>

        <Section num="2" title="Your data lives on your device">
          Every personal message, chat photo, chat video, and voice
          note you send is encrypted on your device before it leaves.
          NEX servers relay the encrypted bytes only long enough to
          deliver them, then remove them. NEX does not hold readable
          copies of your chats and cannot restore them. Your device is
          the archive · your device is the backup.
        </Section>

        <Section num="3" title="What NEX may see">
          NEX servers see: your NEX ID (nex-XXXXX), your display name,
          your profile avatar and theme choices, your public keys, and
          which conversations you belong to. NEX servers do not see:
          the content of your messages, the pixels inside chat photos
          or videos, the audio inside voice notes, or the media of any
          call. Payment content is never stored by NEX — see § 6.
        </Section>

        <Section num="4" title="What NEX will never do">
          <List
            items={[
              "Sell your data, your voice, or your photos to advertisers, brokers, or AI companies.",
              "Use your chats to train models — ours or anyone else's.",
              "Provide a cloud backup that could be subpoenaed or leaked.",
              "Ask you to install additional trackers, SDKs, or profiling libraries.",
            ]}
          />
        </Section>

        <Section num="5" title="What business content is public">
          If you list a shop, restaurant, product, menu item, or
          business profile, the images and text you publish are
          server-hosted so anyone browsing NEX can find them. That
          content is not covered by the peer-chat encryption above
          because you chose to make it discoverable. You may edit or
          remove it at any time from your Manage surface.
        </Section>

        <Section num="6" title="Payments">
          NEX does not process, hold, or move payments. Buyers and
          sellers agree payment terms directly. When you subscribe to
          Bisnis or any paid theme, you pay via your own bank / e-wallet
          rail direct to the NEX team, and we manually activate your
          plan. No card numbers, wallets, or balances are ever stored
          on NEX systems.
        </Section>

        <Section num="7" title="Your responsibilities">
          <List
            items={[
              "Keep your device secure — losing it means losing your NEX history because we cannot restore what we do not hold.",
              "Do not use NEX to send content that is illegal in your jurisdiction or that violates the rights of others.",
              "Respect other users — NEX supports reporting and blocking, and we act on abuse of the platform.",
              "Do not attempt to reverse-engineer NEX servers, exploit them, or use them to send unsolicited bulk messages.",
            ]}
          />
        </Section>

        <Section num="8" title="Accounts and identity">
          You sign up with an email, phone number, and password. Your
          phone number is a credential attribute — it is never shown
          to other users. Your nex-XXXXX handle is your public
          identity for friend connections. You may change your display
          name at any time from your profile.
        </Section>

        <Section num="9" title="Removal and closure">
          You may close your NEX account at any time. When you do, we
          remove your public identity data and mark your account
          inactive. Because we never held your chats, there is nothing
          for us to hand back to you at closure — you already had it.
        </Section>

        <Section num="10" title="Changes to these terms">
          If we change these terms materially — for example if we
          introduce a new class of service that changes what NEX may
          see — we will surface the change in the app before it takes
          effect and update the version stamp above. Continued use
          after that point means acceptance.
        </Section>

        <Section num="11" title="No warranty">
          NEX is provided "as-is." We work hard to keep it running
          reliably and privately, but we cannot guarantee uninterrupted
          service or that every message will reach its recipient — the
          nature of encrypted peer-to-peer communication is that
          delivery depends on both parties' devices being reachable.
        </Section>

        <Section num="12" title="Governing law + contact">
          These terms are governed by the laws of the jurisdiction where
          NEX is operated. For questions about this document or your
          account, message the official NEX support account
          (nex-00001) inside the app.
        </Section>

        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/nex-native/about/privacy"
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              background: NEX.orange,
              color: "#0B0F1A",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textDecoration: "none",
            }}
          >
            Read the Privacy pledge
          </Link>
          <Link
            href="/nex-native/create-account"
            style={{
              padding: "12px 20px",
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
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------- *
 * Helpers                                                          *
 * --------------------------------------------------------------- */

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2
        style={{
          margin: "0 0 8px",
          fontFamily: SERIF,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.005em",
        }}
      >
        <span style={{ color: NEX.cyan, marginRight: 10 }}>§ {num}</span>
        {title}
      </h2>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: NEX.textDim,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function List({ items }: { items: string[] }): React.JSX.Element {
  return (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {items.map((it) => (
        <li key={it} style={{ marginBottom: 6 }}>
          {it}
        </li>
      ))}
    </ul>
  );
}
