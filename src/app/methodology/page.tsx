import Link from "next/link";

const checks = [
  ["Business identity", "Does the public site clearly establish what the business is and how it identifies itself?"],
  ["Location", "Can a visitor and machine understand where the business operates and, where appropriate, its public address?"],
  ["Services", "Are the actual offerings explicitly described rather than inferred from vague marketing language?"],
  ["Structured information", "Is useful Schema.org/JSON-LD information present, valid and aligned with visible content?"],
  ["Technical accessibility", "Can important public resources be retrieved without bypassing access controls?"],
  ["Content clarity", "Do titles, descriptions, headings and links make the site's purpose and structure understandable?"],
  ["Consistency", "Where enough evidence exists, do important business facts agree across the information we inspect?"],
];

export default function MethodologyPage() {
  return <main className="page-shell"><nav className="nav"><Link href="/" className="brand">CitePath</Link><Link href="/faq" className="nav-link">FAQ</Link></nav><article style={{maxWidth:980,margin:"0 auto",padding:"56px 24px 100px"}}><p className="eyebrow">Methodology</p><h1 style={{fontSize:"clamp(42px,7vw,72px)",lineHeight:1,letterSpacing:"-.06em",margin:0}}>Evidence first.</h1><p className="lead">CitePath evaluates observable public website signals. It does not predict or guarantee what ChatGPT, Gemini, Claude, Perplexity or another AI system will recommend.</p><div style={{display:"grid",gap:14,marginTop:48}}>{checks.map(([title,copy])=><section key={title} style={{border:"1px solid var(--line)",borderRadius:18,padding:24,background:"#fff"}}><h2 style={{margin:0,fontSize:20}}>{title}</h2><p style={{margin:"8px 0 0",color:"var(--muted)",lineHeight:1.55}}>{copy}</p></section>)}</div><section style={{marginTop:42,padding:24,borderRadius:18,background:"var(--soft)",lineHeight:1.6,color:"var(--muted)"}}><h2 style={{marginTop:0,color:"var(--ink)"}}>What the report means</h2><p>Findings are evidence-backed observations and recommendations, not guarantees of search or AI performance. A strong website foundation can improve clarity and machine readability, but external systems make their own decisions.</p><p>Results depend on the public content available at scan time. A single-page scan is not a substitute for a full technical audit, legal review or professional SEO/GEO engagement.</p></section></article></main>;
}
