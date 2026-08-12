import Link from "next/link";

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const params = await searchParams;
  const url = params.url ?? "";

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 100px" }}>
      <Link href="/" style={{ fontWeight: 800 }}>CitePath</Link>
      <section style={{ paddingTop: 90 }}>
        <p style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em" }}>Website scan</p>
        <h1 style={{ fontSize: "clamp(40px, 7vw, 64px)", lineHeight: 1, letterSpacing: "-0.05em", margin: "18px 0" }}>Let’s inspect the public web presence.</h1>
        <p style={{ color: "var(--muted)", fontSize: 18, lineHeight: 1.55 }}>The secure crawler and deterministic analysis engine are being built here. This route already validates the product flow without pretending that a scan has happened.</p>
        <div style={{ marginTop: 34, padding: 22, border: "1px solid var(--line)", borderRadius: 18, background: "var(--soft)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>URL submitted</div>
          <code style={{ wordBreak: "break-all" }}>{url || "No URL supplied"}</code>
        </div>
        <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 13 }}>No result is fabricated at this stage. The crawler will be connected in the next implementation phase.</p>
      </section>
    </main>
  );
}
