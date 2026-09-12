// src/app/nex/share/[token]/page.tsx
//
// Founder Phase 13 · P13-4 · Public read-only conversation view.
// Server component · fetches directly · no client JS required.

import { getSharedConversation } from "@/lib/nex/conversations";

export const dynamic = "force-dynamic";

export default async function SharedConversationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedConversation(token);

  if (!data) {
    return (
      <main style={{ maxWidth: 720, margin: "3rem auto", padding: "1rem", fontFamily: "system-ui" }}>
        <h1>Shared conversation not found</h1>
        <p style={{ color: "#666" }}>The link may have been revoked or never existed.</p>
      </main>
    );
  }

  const { conversation, messages } = data;

  return (
    <main style={{ maxWidth: 760, margin: "2rem auto", padding: "1rem", fontFamily: "system-ui" }}>
      <header style={{ borderBottom: "1px solid #e4e4e7", paddingBottom: "0.75rem", marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "0.75rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Shared NEX conversation
        </div>
        <h1 style={{ margin: "0.25rem 0", fontSize: "1.5rem" }}>{conversation.title}</h1>
        <div style={{ fontSize: "0.75rem", color: "#71717a" }}>
          Read-only view · {messages.length} message{messages.length === 1 ? "" : "s"} · started {new Date(conversation.created_at).toLocaleDateString()}
        </div>
      </header>

      <section aria-label="messages">
        {messages.map((m) => (
          <article
            key={m.message_id}
            style={{
              padding: "0.75rem 1rem",
              margin: "0.5rem 0",
              background: m.role === "user" ? "#f4f4f5" : "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: "0.7rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
              {m.role}
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: 1.5 }}>{m.content}</div>
          </article>
        ))}
      </section>

      <footer style={{ marginTop: "2rem", padding: "0.75rem 1rem", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: "0.8rem", color: "#52525b" }}>
        <strong>NEX doctrine:</strong> This is a rendering of a past conversation. Any factual claim still requires the underlying evidence chain — a share link never establishes truth on its own.
      </footer>
    </main>
  );
}
