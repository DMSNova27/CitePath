"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { ScanReport } from "@/lib/analyzer";

const severityOrder = { CRITICAL: 0, IMPORTANT: 1, NEEDS_ATTENTION: 2, GOOD: 3 } as const;

export default function ScanPage() {
  const [url, setUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setReport(null);
    setBusy(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, businessName: businessName || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The website could not be scanned.");
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The website could not be scanned.");
    } finally {
      setBusy(false);
    }
  }

  const findings = report ? [...report.findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]) : [];
  const priority = findings.filter((finding) => finding.severity !== "GOOD").slice(0, 3);

  return (
    <main className="page-shell">
      <nav className="nav">
        <Link href="/" className="brand">CitePath</Link>
        <Link href="/methodology" className="nav-link">Methodology</Link>
      </nav>

      <section className="scan-hero">
        <p className="eyebrow">Live website analysis</p>
        <h1>See what your public website actually communicates.</h1>
        <p className="lead">We inspect observable signals across your public site and turn them into evidence-backed fixes. No guaranteed AI rankings. No invented visibility claims.</p>
        <form className="scan-form" onSubmit={submit}>
          <label>Website URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourbusiness.com" type="url" required /></label>
          <label>Business name <span>(optional)</span><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Landscapes" maxLength={160} /></label>
          <button disabled={busy} type="submit">{busy ? "Scanning…" : "Scan website"}</button>
        </form>
        {busy && <div className="progress" role="status" aria-live="polite">Checking accessibility · discovering public pages · extracting facts · reviewing structure · building findings</div>}
        {error && <div className="error" role="alert">{error}</div>}
      </section>

      {report && (
        <section className="report" aria-label="Website readiness report">
          <div className="report-head">
            <div>
              <p className="eyebrow">Evidence report · {new Date(report.scannedAt).toLocaleString()}</p>
              <h2>{report.businessName || report.title || new URL(report.finalUrl).hostname}</h2>
              <p className="muted">{report.finalUrl}</p>
            </div>
            <div className="readiness"><span>{report.category}</span><strong>{report.readiness}</strong><small>{report.readinessScore}/100 readiness indicator</small></div>
          </div>

          <div className="snapshot">
            <div><b>{report.pagesScanned}</b><span>pages analyzed</span></div>
            <div><b>{report.findings.filter((f) => f.severity === "GOOD").length}</b><span>strong signals</span></div>
            <div><b>{report.findings.filter((f) => f.severity === "IMPORTANT").length}</b><span>important gaps</span></div>
            <div><b>{report.structuredDataTypes.length}</b><span>structured types</span></div>
          </div>

          {priority.length > 0 && (
            <div className="priority-card">
              <p className="eyebrow">Start here</p>
              <h3>Your three highest-priority improvements</h3>
              <ol>{priority.map((finding) => <li key={finding.id}><strong>{finding.title}</strong><span>{finding.fix}</span></li>)}</ol>
            </div>
          )}

          <div className="findings">
            <div className="section-title"><p className="eyebrow">Evidence</p><h3>What we found</h3><p className="muted">Every recommendation below is tied to an observable signal from the public website.</p></div>
            {findings.map((finding) => (
              <article className="finding" key={finding.id}>
                <div className={`severity severity-${finding.severity.toLowerCase().replaceAll("_", "-")}`}>{finding.severity.replaceAll("_", " ")}</div>
                <div>
                  <h4>{finding.title}</h4>
                  <p><b>What:</b> {finding.what}</p>
                  <p><b>Why:</b> {finding.why}</p>
                  <p><b>Fix:</b> {finding.fix}</p>
                  {finding.evidence && <p className="evidence"><b>Evidence:</b> {finding.evidence}</p>}
                  {finding.url && <p className="source">Source: {finding.url}</p>}
                </div>
              </article>
            ))}
          </div>

          <div className="facts">
            <h3>Observed website signals</h3>
            <p><b>Title:</b> {report.title || "Not detected"}</p>
            <p><b>Headings:</b> {report.headings.length ? report.headings.join(" · ") : "None detected"}</p>
            <p><b>Links:</b> {report.links}</p>
            <p><b>Structured data:</b> {report.structuredDataTypes.length ? report.structuredDataTypes.join(", ") : "None detected"}</p>
            <p><b>robots.txt:</b> {report.robots} · <b>sitemap:</b> {report.sitemap}</p>
          </div>
        </section>
      )}
    </main>
  );
}
