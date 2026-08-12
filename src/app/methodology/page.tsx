import Link from "next/link";

export default function MethodologyPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 100px" }}>
      <Link href="/" style={{ fontWeight: 800 }}>CitePath</Link>
      <article style={{ paddingTop: 80 }}>
        <p style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em" }}>Methodology</p>
        <h1 style={{ fontSize: "clamp(42px, 7vw, 72px)", lineHeight: 1, letterSpacing: "-0.05em" }}>Evidence first.</h1>
        <p style={{ color: "var(--muted)", fontSize: 19, lineHeight: 1.6, maxWidth: 700 }}>
          CitePath evaluates observable public website signals. It does not claim to predict what a particular AI system will recommend.
        </p>
        <div style={{ display: "grid", gap: 14, marginTop: 48 }}>
          {[
            ["Business identity", "Can the business name and identity be clearly established?"],
            ["Location", "Can the service area and physical/location information be understood?"],
            ["Services", "Are the actual services clearly described and supported by evidence?"],
            ["Technical accessibility", "Can important public information be fetched and interpreted reliably?"],
            ["Structured information", "Is useful machine-readable information present and consistent with visible content?"],
            ["Consistency", "Do important business signals agree across the pages that are analyzed?"],
          ].map(([title, copy]) => (
            <section key={title} style={{ border: "1px solid var(--line)", borderRadius: 18, padding: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.55 }}>{copy}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
