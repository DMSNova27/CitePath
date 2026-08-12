import Link from "next/link";

const faqs = [
  ["Does CitePath guarantee AI recommendations?", "No. It reports observable website signals and clearly separates evidence from inference. No AI engine recommendation or ranking is guaranteed."],
  ["Do I need an account?", "The initial product is designed to provide a scan without requiring an account."],
  ["What information do I submit?", "A public website URL is enough for the initial scan. A public business name is optional."],
  ["What does the scanner look at?", "It checks public technical accessibility, page structure, identity, location, services, structured data and related machine-readable signals."],
  ["Does it access private pages?", "No. The scanner is designed for public web pages and does not bypass authentication, CAPTCHAs or paywalls."],
];

export default function FaqPage() { return <main className="page-shell"><nav className="nav"><Link href="/" className="brand">CitePath</Link><Link href="/methodology" className="nav-link">Methodology</Link></nav><article style={{maxWidth:900,margin:"0 auto",padding:"56px 24px 100px"}}><p className="eyebrow">FAQ</p><h1 style={{fontSize:"clamp(42px,7vw,70px)",letterSpacing:"-.06em",margin:0}}>Straight answers.</h1><div style={{display:"grid",gap:14,marginTop:48}}>{faqs.map(([q,a])=><section key={q} style={{border:"1px solid var(--line)",borderRadius:18,padding:24}}><h2 style={{margin:0,fontSize:20}}>{q}</h2><p style={{margin:"10px 0 0",color:"var(--muted)",lineHeight:1.6}}>{a}</p></section>)}</div></article></main>; }
