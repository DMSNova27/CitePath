# CitePath — Engineering Constitution

## Product
CitePath is a self-service AI Discoverability Readiness Auditor for local businesses. It analyzes publicly accessible business websites and reports measurable signals that affect how clearly a business can be understood by search and AI-powered discovery systems.

Core principle: CHECK → EXPLAIN → FIX.

CitePath must never claim guaranteed AI recommendations, ChatGPT ranking, guaranteed citations, guaranteed AI visibility, or guaranteed AI-search placement. Findings must distinguish observable evidence from inference.

## Initial Market
Initial beachhead: landscaping and landscape-design businesses with public websites. Architecture must support additional non-regulated local-business categories later.

## Privacy
- Public web information only.
- No passwords, confidential documents, customer databases, or unnecessary personal information.
- No account required for the initial scan.
- Minimize retention and avoid permanent storage of raw HTML unless explicitly justified.
- Never commit secrets or API keys.

## Security
Treat every submitted URL as hostile input. Defend against SSRF, localhost/loopback, private IPv4/IPv6, link-local addresses, cloud metadata endpoints, DNS rebinding, malicious redirects, oversized responses, resource exhaustion, XSS, prompt injection, denial of service, crawler abuse, and rate-limit abuse.

Use URL validation, DNS/IP validation, redirect revalidation and limits, request timeouts, response-size limits, crawl/concurrency limits, rate limiting, safe parsing, and appropriate content-type restrictions. Never bypass authentication, CAPTCHA, paywalls, or private content.

## Analysis
Prefer deterministic rules for factual findings. AI may later assist with categorization or explanations, but must not be the sole authority for technical findings.

Every finding should include, where applicable: what is wrong, why it matters, evidence, recommended fix, affected URL/page, severity, and implementation difficulty.

Never fabricate evidence, statistics, testimonials, reviews, customers, logos, or technical findings.

## Initial Landscaping Checks
Where applicable inspect publicly observable signals including landscape design, garden design, lawn care, planting, irrigation, hardscaping, patios, retaining walls, outdoor lighting, maintenance, residential/commercial services, service area, consultation/estimate, portfolio/projects, contact information, and publicly stated pricing. Never assume a service exists.

## Technical Checks
Where applicable inspect HTTPS, HTTP status, redirects, robots.txt, sitemap, canonical, indexability signals, title, meta description, headings, language, JSON-LD/schema.org, LocalBusiness, Organization, sameAs, address, geographic information, opening hours, services, and contact information. Compare structured information with visible information where possible.

## UX / Brand
Premium, minimal, polished, mobile-first, accessible, fast, trustworthy. Use excellent typography and information hierarchy. Avoid unnecessary animation, excessive gradients, fake futuristic AI aesthetics, dark patterns, and clutter.

## Engineering
- Inspect existing work before changing it.
- Prefer simple, maintainable architecture and minimal dependencies.
- Keep the public frontend and website scanner appropriately isolated.
- Use environment variables for secrets.
- Write tests for security-sensitive and core analysis functionality.
- Run relevant tests after changes and fix failures.
- Do not claim completion without verification.

## Accessibility
Use semantic HTML, keyboard navigation, visible focus states, accessible labels, sufficient contrast, useful error messages, and reduced-motion support.

## Performance
Avoid unnecessary JavaScript and dependencies. Keep the landing page fast and optimize for strong Core Web Vitals.

## Quality
No lorem ipsum, fake data presented as real, fake testimonials, fake statistics, dead links, broken buttons, or placeholder copy presented as finished functionality.

## Working Style
When requirements are clear, proceed without repeatedly asking the owner what to do next. Stop only for genuine external authorization, credentials, legal actions, or irreversible owner decisions. Never claim deployment, payments, security completeness, legal compliance, or bug-free status without verification.

At each major milestone report: what changed, tests run, results, remaining limitations, and next recommended action.
