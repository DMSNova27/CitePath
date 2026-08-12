import Link from "next/link";

export default function Home() {
  return (
    <main>
      <nav
        aria-label="Primary navigation"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "24px 24px",
        }}
      >
        <Link href="/" aria-label="CitePath home" style={{ fontWeight: 800, letterSpacing: "-0.03em", fontSize: 21 }}>
          CitePath
        </Link>
        <Link href="/methodology" style={{ color: "var(--muted)", fontSize: 14 }}>
          Methodology
        </Link>
      </nav>

      <section
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "clamp(72px, 13vw, 148px) 24px 100px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, color: "var(--accent)", fontWeight: 700, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Website intelligence for local businesses
        </p>
        <h1 style={{ fontSize: "clamp(48px, 8vw, 88px)", lineHeight: 0.98, letterSpacing: "-0.06em", margin: "22px auto", maxWidth: 900 }}>
          Can AI understand your business?
        </h1>
        <p style={{ maxWidth: 680, margin: "0 auto", color: "var(--muted)", fontSize: "clamp(18px, 2.5vw, 22px)", lineHeight: 1.55 }}>
          Scan your public website and discover the signals that help search and AI-powered discovery systems understand what your business is, what you offer, and where you operate.
        </p>

        <form action="/scan" method="get" style={{ display: "flex", gap: 10, maxWidth: 680, margin: "40px auto 0", padding: 7, border: "1px solid var(--line)", borderRadius: 18, boxShadow: "0 14px 50px rgba(16,17,20,.08)", background: "white" }}>
          <label htmlFor="url" className="sr-only">Business website URL</label>
          <input
            id="url"
            name="url"
            type="url"
            required
            placeholder="https://yourbusiness.com"
            autoComplete="url"
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, padding: "15px 14px", background: "transparent" }}
          />
          <button type="submit" style={{ border: 0, borderRadius: 13, padding: "0 22px", background: "var(--accent)", color: "white", fontWeight: 700 }}>
            Scan my website
          </button>
        </form>

        <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 13 }}>
          No account required for the initial scan. Public website information only.
        </p>
      </section>

      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px 100px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {[
            ["01", "Check", "Measure observable website signals."],
            ["02", "Explain", "Turn technical findings into plain language."],
            ["03", "Fix", "Get concrete, prioritized recommendations."],
          ].map(([number, title, copy]) => (
            <article key={number} style={{ padding: 28, border: "1px solid var(--line)", borderRadius: 22, background: "var(--soft)" }}>
              <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>{number}</div>
              <h2 style={{ margin: "28px 0 8px", fontSize: 24, letterSpacing: "-0.03em" }}>{title}</h2>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <style>{`.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; } @media (max-width: 640px) { form { flex-direction: column; } form button { min-height: 52px; } }`}</style>
    </main>
  );
}
