import dns from "node:dns/promises";
import net from "node:net";

const MAX_BODY_BYTES = 1_500_000;
const MAX_PAGES = 5;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 8_000;
const USER_AGENT = "CitePathBot/0.1 (+https://github.com/DMSNova27/CitePath)";

export type FindingSeverity = "GOOD" | "NEEDS_ATTENTION" | "IMPORTANT" | "CRITICAL";
export type Readiness = "STRONG" | "GOOD" | "NEEDS ATTENTION" | "IMPORTANT GAPS" | "CRITICAL GAPS";
export type BusinessCategory = "Landscaping" | "Local business";

export type Finding = {
  id: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  what: string;
  why: string;
  fix: string;
  evidence?: string;
  url?: string;
};

export type ScanReport = {
  url: string;
  finalUrl: string;
  scannedAt: string;
  businessName?: string;
  title?: string;
  description?: string;
  headings: string[];
  links: number;
  structuredDataTypes: string[];
  robots: "found" | "missing" | "blocked" | "unavailable";
  sitemap: "found" | "missing" | "blocked" | "unavailable";
  pagesScanned: number;
  category: BusinessCategory;
  readinessScore: number;
  readiness: Readiness;
  findings: Finding[];
};

function normalizeUrl(input: string): URL {
  const value = input.trim();
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only HTTP and HTTPS websites can be scanned.");
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed.");
  url.hash = "";
  return url;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
  }
  if (net.isIPv6(ip)) {
    const value = ip.toLowerCase();
    return value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
  }
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Private or local network destinations are not allowed.");
  }
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => isPrivateIp(address))) {
    throw new Error("The destination resolves to a private or restricted network address.");
  }
}

async function fetchPublic(url: URL): Promise<{ response: Response; finalUrl: URL; text: string }> {
  let current = url;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.5" },
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The website returned a redirect without a destination.");
      if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects.");
      current = new URL(location, current);
      if (!['http:', 'https:'].includes(current.protocol)) throw new Error("The redirect target uses an unsupported protocol.");
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
      throw new Error("The submitted URL does not return a supported public web document.");
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new Error("The page is larger than the safe scan limit.");
    if (!response.body) throw new Error("The website returned an unreadable response.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("The page is larger than the safe scan limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { response, finalUrl: current, text };
  }
  throw new Error("Unable to retrieve the public website.");
}

function decodeEntities(value: string): string {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function firstMatch(html: string, regex: RegExp): string | undefined {
  const match = html.match(regex);
  return match?.[1] ? decodeEntities(stripTags(match[1])).trim() : undefined;
}

function allMatches(html: string, regex: RegExp): string[] {
  return [...html.matchAll(regex)].map((m) => decodeEntities(stripTags(m[1] ?? "")).trim()).filter(Boolean);
}

function absoluteInternalLinks(html: string, base: URL): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const target = new URL(match[1], base);
      if (target.protocol !== base.protocol || target.host !== base.host) continue;
      target.hash = "";
      if (target.search.length > 180) continue;
      if (/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|css|js|xml)(?:$|\?)/i.test(target.pathname)) continue;
      urls.add(target.toString());
    } catch {
      // Ignore malformed links.
    }
  }
  return [...urls];
}

function structuredTypes(html: string): { types: string[]; validBlocks: number; invalidBlocks: number } {
  const types = new Set<string>();
  let validBlocks = 0;
  let invalidBlocks = 0;
  for (const block of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1]);
      validBlocks += 1;
      const visit = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) return node.forEach(visit);
        const obj = node as Record<string, unknown>;
        const type = obj["@type"];
        if (typeof type === "string") types.add(type);
        if (Array.isArray(type)) type.filter((v): v is string => typeof v === "string").forEach((v) => types.add(v));
        Object.values(obj).forEach(visit);
      };
      visit(parsed);
    } catch {
      invalidBlocks += 1;
    }
  }
  return { types: [...types].sort(), validBlocks, invalidBlocks };
}

function detectCategory(text: string, types: string[]): BusinessCategory {
  const signal = `${text} ${types.join(" ")}`.toLowerCase();
  return /landscap|lawn care|garden design|hardscap|irrigation|retaining wall|outdoor living/.test(signal) ? "Landscaping" : "Local business";
}

function probe(url: URL, path: string): Promise<"found" | "missing" | "blocked" | "unavailable"> {
  return (async () => {
    const target = new URL(path, url);
    try {
      await assertPublicHost(target);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);
      const response = await fetch(target, { redirect: "error", signal: controller.signal, headers: { "user-agent": USER_AGENT }, cache: "no-store" }).finally(() => clearTimeout(timer));
      if (response.ok) return "found";
      if (response.status === 401 || response.status === 403) return "blocked";
      if (response.status === 404) return "missing";
      return "unavailable";
    } catch {
      return "unavailable";
    }
  })();
}

function parseRobots(text: string): { allowsCrawl: boolean; sitemapUrls: string[] } {
  let applies = false;
  let allowsCrawl = true;
  const sitemapUrls: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (!key) continue;
    if (key.toLowerCase() === "user-agent") applies = value === "*";
    if (applies && key.toLowerCase() === "disallow" && (value === "/" || value === "")) allowsCrawl = value !== "/";
    if (key.toLowerCase() === "sitemap" && value) sitemapUrls.push(value);
  }
  return { allowsCrawl, sitemapUrls };
}

function buildFindings(args: {
  finalUrl: URL;
  pages: Array<{ url: URL; html: string; title?: string; description?: string; headings: string[]; links: number; types: string[]; invalidJsonLd: number }>;
  robots: ScanReport["robots"];
  sitemap: ScanReport["sitemap"];
  robotsText?: string;
  category: BusinessCategory;
}): Finding[] {
  const { finalUrl, pages, robots, sitemap, robotsText, category } = args;
  const findings: Finding[] = [];
  const combined = pages.map((page) => stripTags(page.html)).join(" ").toLowerCase();
  const titles = pages.map((p) => p.title).filter(Boolean) as string[];
  const descriptions = pages.map((p) => p.description).filter(Boolean) as string[];
  const allTypes = [...new Set(pages.flatMap((p) => p.types))];
  const hasLocalBusiness = allTypes.some((type) => /localbusiness/i.test(type));
  const hasAddress = /\b(address|street|road|avenue|location|located|service area|serving)\b/i.test(combined);
  const serviceTerms = category === "Landscaping" ? /\b(landscap(?:e|ing)|garden design|lawn|irrigation|hardscap|patio|planting|maintenance|retaining wall|outdoor living)\b/i : /\b(services?|what we do|solutions|offerings)\b/i;
  const hasServices = serviceTerms.test(combined);
  const hasContact = /\b(contact|phone|email|call us|get in touch|request (?:a )?(quote|estimate))\b/i.test(combined);
  const hasHours = /\b(hours|opening hours|open today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(combined);
  const hasPricing = /[$€£₹]\s?\d|\b(price|pricing|starting at|from)\b/i.test(combined);
  const hasAbout = /\b(about us|our story|who we are|about)\b/i.test(combined);
  const duplicateTitle = new Set(titles.map((v) => v.trim().toLowerCase())).size < titles.length && titles.length > 1;

  findings.push(titles.length ? { id: "identity-title", category: "Business identity", severity: "GOOD", title: "The site exposes page titles", what: `${titles.length} scanned page${titles.length === 1 ? " has" : "s have"} a usable title.`, why: "Titles provide concise identity and topic signals.", fix: "Keep titles specific, truthful and distinct across important pages.", evidence: titles.slice(0, 3).join(" · "), url: pages[0]?.url.toString() } : { id: "identity-title", category: "Business identity", severity: "IMPORTANT", title: "The site is missing usable page titles", what: "No usable HTML title was detected on the scanned pages.", why: "This removes a basic machine-readable identity signal.", fix: "Give each important page a concise, descriptive title containing the business or page topic.", url: finalUrl.toString() });

  findings.push(descriptions.length ? { id: "content-description", category: "Content clarity", severity: "GOOD", title: "Meta descriptions are present", what: `${descriptions.length} scanned page${descriptions.length === 1 ? " has" : "s have"} a meta description.`, why: "A concise description can reinforce what a page is about.", fix: "Keep descriptions accurate and aligned with visible content.", evidence: descriptions[0], url: pages[0]?.url.toString() } : { id: "content-description", category: "Content clarity", severity: "NEEDS_ATTENTION", title: "Meta descriptions are missing", what: "No meta description was detected on the scanned pages.", why: "The site loses a useful concise summary signal.", fix: "Add accurate descriptions to important pages, prioritizing the homepage and service pages.", url: finalUrl.toString() });

  findings.push(hasLocalBusiness ? { id: "schema-localbusiness", category: "Structured data", severity: "GOOD", title: "LocalBusiness structured data detected", what: "Valid JSON-LD includes a LocalBusiness type.", why: "Explicit structured business identity can make key facts easier for machines to interpret.", fix: "Keep the structured data truthful and synchronized with visible information.", evidence: allTypes.join(", "), url: pages[0]?.url.toString() } : { id: "schema-localbusiness", category: "Structured data", severity: "IMPORTANT", title: "No LocalBusiness structured data detected", what: "No LocalBusiness type was found in valid JSON-LD across the scanned pages.", why: "Important local-business facts may be less explicitly machine-readable.", fix: "Consider the most specific truthful Schema.org LocalBusiness subtype and populate only information actually supported by the site.", url: finalUrl.toString() });

  const invalidJsonLd = pages.reduce((sum, page) => sum + page.invalidJsonLd, 0);
  if (invalidJsonLd) findings.push({ id: "schema-invalid", category: "Structured data", severity: "IMPORTANT", title: "Some JSON-LD blocks are invalid", what: `${invalidJsonLd} JSON-LD block${invalidJsonLd === 1 ? " was" : "s were"} not valid JSON.`, why: "Malformed structured data cannot reliably communicate the intended facts.", fix: "Validate and repair the JSON-LD syntax, then confirm its fields match visible information.", url: finalUrl.toString() });

  findings.push(hasAddress ? { id: "location", category: "Location", severity: "GOOD", title: "Location or service-area language is visible", what: "The scanned content contains geographic/business-location language.", why: "Clear geography helps distinguish a local business and its service area.", fix: "State the city/service area explicitly and keep address information consistent where appropriate.", url: finalUrl.toString() } : { id: "location", category: "Location", severity: "IMPORTANT", title: "Location information is unclear", what: "The scanned pages did not expose a strong address or service-area signal.", why: "A local business is difficult to place confidently without an unambiguous geographic signal.", fix: "Clearly state the service area and, where appropriate, the public business address.", url: finalUrl.toString() });

  findings.push(hasServices ? { id: "services", category: "Services", severity: "GOOD", title: "Core services are described", what: `Service language relevant to ${category.toLowerCase()} was detected across the scanned content.`, why: "Explicit service language helps systems understand what the business actually offers.", fix: "Give important services dedicated, descriptive pages with concrete details.", url: finalUrl.toString() } : { id: "services", category: "Services", severity: "IMPORTANT", title: "Core services are not clearly described", what: "The scanner found limited explicit service language.", why: "A business cannot be confidently described if its core offerings are vague or absent.", fix: category === "Landscaping" ? "Clearly list services such as landscape design, lawn care, planting, irrigation or hardscaping only when actually offered." : "List the primary services in clear customer-facing language and link to useful detail pages.", url: finalUrl.toString() });

  findings.push(hasContact ? { id: "contact", category: "Business identity", severity: "GOOD", title: "A clear contact path is visible", what: "Contact-related language was detected across the scanned pages.", why: "A clear contact path helps establish a real business and supports customer action.", fix: "Keep contact details consistent and easy to find.", url: finalUrl.toString() } : { id: "contact", category: "Business identity", severity: "NEEDS_ATTENTION", title: "A clear contact path was not detected", what: "The scanner did not find strong contact/quote language.", why: "Customers and automated systems benefit from an explicit way to contact the business.", fix: "Provide a prominent phone, email, contact form or quote/booking path.", url: finalUrl.toString() });

  findings.push(hasAbout ? { id: "about", category: "Entity signals", severity: "GOOD", title: "Business-about information is present", what: "The site contains an about/company identity section.", why: "A coherent business narrative helps connect the services to a real entity.", fix: "Keep business history, identity and service claims factual and consistent.", url: finalUrl.toString() } : { id: "about", category: "Entity signals", severity: "NEEDS_ATTENTION", title: "Business identity could be clearer", what: "A clear about/company identity section was not detected.", why: "Machines and customers benefit from a concise explanation of who the business is.", fix: "Add a factual business/about page explaining the company, location and core work.", url: finalUrl.toString() });

  findings.push(hasHours ? { id: "hours", category: "Availability", severity: "GOOD", title: "Opening-hour language is visible", what: "The site exposes opening-hour/day information.", why: "Availability is useful context for local discovery and customer action.", fix: "Keep hours current and consistent with structured data where used.", url: finalUrl.toString() } : { id: "hours", category: "Availability", severity: "NEEDS_ATTENTION", title: "Opening hours are not obvious", what: "No strong opening-hours signal was detected.", why: "For businesses with customer-facing hours, missing availability information creates uncertainty.", fix: "Publish opening hours when applicable and keep them current.", url: finalUrl.toString() });

  findings.push(hasPricing ? { id: "pricing", category: "Offer clarity", severity: "GOOD", title: "Pricing language is present", what: "The site contains pricing or price-range signals.", why: "When a business chooses to publish pricing, explicit information reduces ambiguity.", fix: "Keep any published prices current and clearly scoped.", url: finalUrl.toString() } : { id: "pricing", category: "Offer clarity", severity: "NEEDS_ATTENTION", title: "No pricing signal was detected", what: "No clear public pricing or starting-price information was found.", why: "Pricing is useful context when the business can reasonably publish it, but it is not universally required.", fix: "If appropriate for the business, publish a truthful starting price/range or explain why a quote is required.", url: finalUrl.toString() });

  findings.push(robots === "found" ? { id: "robots", category: "Technical accessibility", severity: "GOOD", title: "robots.txt is reachable", what: "A robots.txt resource was retrieved.", why: "It provides an explicit crawler-policy surface.", fix: "Review it periodically so important public pages are not unintentionally blocked.", url: `${finalUrl.origin}/robots.txt` } : robots === "blocked" ? { id: "robots", category: "Technical accessibility", severity: "IMPORTANT", title: "robots.txt is not safely retrievable", what: "The standard robots.txt resource could not be retrieved because access was restricted.", why: "Crawler-policy visibility is reduced when the standard policy file cannot be read.", fix: "Ensure the public robots.txt endpoint is intentionally accessible and contains accurate directives.", url: `${finalUrl.origin}/robots.txt` } : { id: "robots", category: "Technical accessibility", severity: "NEEDS_ATTENTION", title: "robots.txt was not detected", what: "The standard robots.txt location was not available.", why: "Crawler directives can affect how automated systems access public content.", fix: "Publish a valid robots.txt appropriate for the public site and review it for accidental blocking.", url: `${finalUrl.origin}/robots.txt` });

  findings.push(sitemap === "found" ? { id: "sitemap", category: "Technical accessibility", severity: "GOOD", title: "An XML sitemap is available", what: "A standard sitemap resource was found.", why: "A sitemap provides a useful inventory of public URLs.", fix: "Keep it current and limited to canonical public URLs.", url: `${finalUrl.origin}/sitemap.xml` } : sitemap === "blocked" ? { id: "sitemap", category: "Technical accessibility", severity: "IMPORTANT", title: "The sitemap is not safely retrievable", what: "The standard sitemap location exists but access is restricted.", why: "Automated discovery is less reliable when the URL inventory cannot be retrieved.", fix: "Allow legitimate public retrieval of the sitemap and keep its contents accurate.", url: `${finalUrl.origin}/sitemap.xml` } : { id: "sitemap", category: "Technical accessibility", severity: "NEEDS_ATTENTION", title: "No sitemap was detected", what: "The standard sitemap location was not available.", why: "A sitemap can make a site's public URL structure easier to discover.", fix: "Publish an XML sitemap containing important canonical public URLs.", url: `${finalUrl.origin}/sitemap.xml` });

  if (duplicateTitle) findings.push({ id: "duplicate-titles", category: "Information consistency", severity: "NEEDS_ATTENTION", title: "Some scanned pages reuse the same title", what: "At least two scanned pages share the same normalized title.", why: "Repeated titles make it harder to distinguish pages and their topics.", fix: "Give important pages distinct titles that describe their specific content or service.", url: finalUrl.toString() });
  if (pages.length < 2) findings.push({ id: "crawl-depth", category: "Information completeness", severity: "NEEDS_ATTENTION", title: "Only the starting page could be analyzed", what: "The scan could not safely analyze additional same-site pages.", why: "A homepage alone may not represent the business's full service, location and identity information.", fix: "Ensure important internal pages are publicly reachable through ordinary HTML links.", url: finalUrl.toString() });
  if (robotsText) {
    const policy = parseRobots(robotsText);
    if (!policy.allowsCrawl) findings.push({ id: "robots-block", category: "Technical accessibility", severity: "IMPORTANT", title: "robots.txt disallows all crawlers", what: "The scanned robots policy contains a global Disallow: / rule.", why: "A blanket crawler block can prevent legitimate automated systems from accessing the site's public pages.", fix: "Review the directive and narrow it if blocking all crawlers is not intentional.", evidence: "User-agent: * / Disallow: /", url: `${finalUrl.origin}/robots.txt` });
  }

  return findings;
}

export async function scanWebsite(input: string, businessName?: string): Promise<ScanReport> {
  const startUrl = normalizeUrl(input);
  const first = await fetchPublic(startUrl);
  const finalUrl = first.finalUrl;
  const robotsStatus = await probe(finalUrl, "/robots.txt");
  const sitemapStatus = await probe(finalUrl, "/sitemap.xml");

  let robotsText: string | undefined;
  if (robotsStatus === "found") {
    try { robotsText = (await fetchPublic(new URL("/robots.txt", finalUrl))).text; } catch { /* status already captured */ }
  }
  const robotsPolicy = robotsText ? parseRobots(robotsText) : { allowsCrawl: true, sitemapUrls: [] };
  const sitemapCandidates = robotsPolicy.sitemapUrls.length ? robotsPolicy.sitemapUrls.slice(0, 2) : [new URL("/sitemap.xml", finalUrl).toString()];

  const pageQueue = [finalUrl.toString()];
  const seen = new Set<string>();
  const pages: Array<{ url: URL; html: string; title?: string; description?: string; headings: string[]; links: number; types: string[]; invalidJsonLd: number }> = [];

  while (pageQueue.length && pages.length < MAX_PAGES) {
    const currentValue = pageQueue.shift()!;
    if (seen.has(currentValue)) continue;
    seen.add(currentValue);
    let page: { finalUrl: URL; text: string };
    try { page = currentValue === finalUrl.toString() ? first : await fetchPublic(new URL(currentValue)); } catch { continue; }
    const title = firstMatch(page.text, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = firstMatch(page.text, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ?? firstMatch(page.text, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
    const headings = allMatches(page.text, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi).slice(0, 30);
    const links = [...page.text.matchAll(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi)].length;
    const structured = structuredTypes(page.text);
    pages.push({ url: page.finalUrl, html: page.text, title, description, headings, links, types: structured.types, invalidJsonLd: structured.invalidBlocks });
    if (robotsPolicy.allowsCrawl) {
      for (const next of absoluteInternalLinks(page.text, page.finalUrl)) {
        if (!seen.has(next) && pageQueue.length + pages.length < MAX_PAGES + 2) pageQueue.push(next);
      }
    }
  }

  const category = detectCategory(pages.map((p) => stripTags(p.html)).join(" "), pages.flatMap((p) => p.types));
  const findings = buildFindings({ finalUrl, pages, robots: robotsStatus, sitemap: sitemapStatus, robotsText, category });
  const critical = findings.filter((f) => f.severity === "CRITICAL").length;
  const important = findings.filter((f) => f.severity === "IMPORTANT").length;
  const attention = findings.filter((f) => f.severity === "NEEDS_ATTENTION").length;
  const good = findings.filter((f) => f.severity === "GOOD").length;
  const readinessScore = Math.max(0, Math.min(100, Math.round(((good * 2 + attention) / Math.max(1, findings.length * 2)) * 100)));
  const readiness: Readiness = critical ? "CRITICAL GAPS" : important >= 4 ? "IMPORTANT GAPS" : important || attention >= 4 ? "NEEDS ATTENTION" : findings.every((f) => f.severity === "GOOD") ? "STRONG" : "GOOD";
  const homepage = pages[0];
  const allTypes = [...new Set(pages.flatMap((p) => p.types))];

  return {
    url: startUrl.toString(),
    finalUrl: finalUrl.toString(),
    scannedAt: new Date().toISOString(),
    businessName,
    title: homepage?.title,
    description: homepage?.description,
    headings: homepage?.headings ?? [],
    links: pages.reduce((sum, page) => sum + page.links, 0),
    structuredDataTypes: allTypes,
    robots: robotsStatus,
    sitemap: sitemapStatus === "found" || sitemapStatus === "blocked" ? sitemapStatus : sitemapCandidates.length ? sitemapStatus : "unavailable",
    pagesScanned: pages.length,
    category,
    readinessScore,
    readiness,
    findings,
  };
}
