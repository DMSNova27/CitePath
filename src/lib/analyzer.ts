import dns from "node:dns/promises";
import net from "node:net";

const MAX_BODY_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 8_000;
const USER_AGENT = "CitePathBot/0.1 (+https://citepath.example/security)";

export type FindingSeverity = "GOOD" | "NEEDS_ATTENTION" | "IMPORTANT" | "CRITICAL";

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
  sitemap: "found" | "missing" | "unavailable";
  readiness: "STRONG" | "GOOD" | "NEEDS ATTENTION" | "IMPORTANT GAPS" | "CRITICAL GAPS";
  findings: Finding[];
};

function normalizeUrl(input: string): URL {
  const value = input.trim();
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP and HTTPS websites can be scanned.");
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed.");
  return url;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd");
  }
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Private or local network destinations are not allowed.");
  }
  const addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("The destination resolves to a private or restricted network address.");
  }
}

async function fetchPublic(url: URL): Promise<{ response: Response; finalUrl: URL; text: string }> {
  let current = url;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
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
      if (current.protocol !== "http:" && current.protocol !== "https:") throw new Error("The redirect target uses an unsupported protocol.");
      continue;
    }

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml") && !type.includes("text/plain")) {
      throw new Error("The submitted URL does not return a supported public web document.");
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new Error("The page is larger than the safe scan limit.");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("The website returned an unreadable response.");
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
  return decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function firstMatch(html: string, regex: RegExp): string | undefined {
  const match = html.match(regex);
  return match?.[1] ? decodeEntities(stripTags(match[1])).trim() : undefined;
}

function allMatches(html: string, regex: RegExp): string[] {
  return [...html.matchAll(regex)].map((m) => decodeEntities(stripTags(m[1] ?? "")).trim()).filter(Boolean);
}

function structuredTypes(html: string): string[] {
  const types = new Set<string>();
  for (const block of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1]);
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
      // Invalid JSON-LD is reported separately by the deterministic check below.
    }
  }
  return [...types].sort();
}

function buildFindings(args: { url: URL; finalUrl: URL; html: string; title?: string; description?: string; headings: string[]; links: number; types: string[]; robots: ScanReport["robots"]; sitemap: ScanReport["sitemap"] }): Finding[] {
  const { finalUrl, html, title, description, headings, links, types, robots, sitemap } = args;
  const findings: Finding[] = [];
  const visible = stripTags(html).toLowerCase();
  const hasLocalBusiness = types.some((type) => /localbusiness/i.test(type));
  const hasAddress = /\b(address|street|road|avenue|location|located)\b/i.test(visible);
  const hasServices = /\b(services?|landscap(?:e|ing)|garden|lawn|irrigation|hardscap|patio|planting|maintenance)\b/i.test(visible);
  const hasContact = /\b(contact|phone|email|call us|get in touch)\b/i.test(visible);

  findings.push(title ? {
    id: "identity-title", category: "Business identity", severity: "GOOD", title: "A page title is present", what: "The homepage exposes a document title.", why: "A clear title gives machines an immediate identity signal for the page.", fix: "Keep the title specific to the business and primary offering.", evidence: title, url: finalUrl.toString()
  } : {
    id: "identity-title", category: "Business identity", severity: "IMPORTANT", title: "The homepage is missing a clear title", what: "No usable HTML title was detected.", why: "The title is one of the clearest machine-readable identity signals for a page.", fix: "Add a concise title containing the business name and primary service.", url: finalUrl.toString()
  });

  findings.push(description ? {
    id: "content-description", category: "Content clarity", severity: "GOOD", title: "A meta description is present", what: "The page provides a description for the document.", why: "A concise description can help systems understand the page's purpose.", fix: "Keep it accurate, specific and aligned with visible content.", evidence: description, url: finalUrl.toString()
  } : {
    id: "content-description", category: "Content clarity", severity: "NEEDS_ATTENTION", title: "No meta description was detected", what: "The homepage does not expose a meta description.", why: "This removes a useful concise summary signal.", fix: "Add an accurate description of the business, service and location where appropriate.", url: finalUrl.toString()
  });

  findings.push(hasLocalBusiness ? {
    id: "schema-localbusiness", category: "Structured data", severity: "GOOD", title: "Local business structured data detected", what: "Schema.org LocalBusiness information was found in JSON-LD.", why: "Structured business identity can make key facts easier for machines to interpret.", fix: "Keep structured data accurate and synchronized with visible information.", evidence: types.join(", "), url: finalUrl.toString()
  } : {
    id: "schema-localbusiness", category: "Structured data", severity: "IMPORTANT", title: "No LocalBusiness structured data detected", what: "No LocalBusiness type was found in valid JSON-LD.", why: "Important business facts may be less explicitly machine-readable.", fix: "Consider implementing the most specific applicable Schema.org LocalBusiness subtype and keep every field truthful.", url: finalUrl.toString()
  });

  findings.push(hasAddress ? {
    id: "location", category: "Location", severity: "GOOD", title: "Location-related information is visible", what: "The public page contains location/address language.", why: "Clear location information helps systems distinguish the business and its service area.", fix: "Make the service area and physical address explicit where applicable.", url: finalUrl.toString()
  } : {
    id: "location", category: "Location", severity: "IMPORTANT", title: "Location information is unclear", what: "No strong address/location language was detected on the scanned page.", why: "A local business needs an unambiguous geographic signal to be understood in local contexts.", fix: "Clearly state the city/service area and, where appropriate, the public business address.", url: finalUrl.toString()
  });

  findings.push(hasServices ? {
    id: "services", category: "Services", severity: "GOOD", title: "Service language is visible", what: "The page contains service-related terms relevant to landscaping/local services.", why: "Explicit service language helps systems understand what the business actually does.", fix: "Use dedicated, descriptive service pages where important offerings deserve more detail.", url: finalUrl.toString()
  } : {
    id: "services", category: "Services", severity: "IMPORTANT", title: "Services are not clearly detectable", what: "The scanner found little explicit service language on the scanned page.", why: "A business cannot be confidently described if its core offerings are vague or absent.", fix: "List the primary services in clear, customer-facing language and link to useful detail pages.", url: finalUrl.toString()
  });

  findings.push(hasContact ? {
    id: "contact", category: "Business identity", severity: "GOOD", title: "Contact information signals are visible", what: "The page contains contact-related language.", why: "Clear contact paths help establish a real business and support customer action.", fix: "Keep phone/email/contact details consistent across important pages.", url: finalUrl.toString()
  } : {
    id: "contact", category: "Business identity", severity: "NEEDS_ATTENTION", title: "Contact information is not obvious", what: "The scanner did not detect strong contact language on the scanned page.", why: "A local business should make a clear contact path easy to understand.", fix: "Provide a prominent contact method and keep it consistent across the site.", url: finalUrl.toString()
  });

  findings.push(robots === "found" ? {
    id: "robots", category: "Technical accessibility", severity: "GOOD", title: "robots.txt is reachable", what: "A robots.txt resource was successfully retrieved.", why: "It provides an explicit crawler-policy surface.", fix: "Review it periodically so important public pages are not unintentionally blocked.", url: `${finalUrl.origin}/robots.txt`
  } : {
    id: "robots", category: "Technical accessibility", severity: robots === "blocked" ? "IMPORTANT" : "NEEDS_ATTENTION", title: "robots.txt needs review", what: robots === "blocked" ? "robots.txt could not be read safely." : "robots.txt was not detected at the standard location.", why: "Crawler directives can affect how automated systems access public content.", fix: "Publish and review a valid robots.txt appropriate for the public website.", url: `${finalUrl.origin}/robots.txt`
  });

  findings.push(sitemap === "found" ? {
    id: "sitemap", category: "Technical accessibility", severity: "GOOD", title: "An XML sitemap is available", what: "A standard sitemap resource was found.", why: "A sitemap provides a useful inventory of public URLs.", fix: "Keep the sitemap current and limited to canonical public URLs.", url: `${finalUrl.origin}/sitemap.xml`
  } : {
    id: "sitemap", category: "Technical accessibility", severity: "NEEDS_ATTENTION", title: "No sitemap was detected", what: "The standard sitemap location was not available.", why: "A sitemap can make a site's public URL structure easier to discover.", fix: "Publish an XML sitemap containing important canonical public URLs.", url: `${finalUrl.origin}/sitemap.xml`
  });

  if (links === 0 || headings.length === 0) findings.push({
    id: "structure", category: "Content clarity", severity: "IMPORTANT", title: "The page has weak document structure", what: `Detected ${headings.length} heading(s) and ${links} link(s).`, why: "Clear headings and navigation help both people and automated systems understand page structure.", fix: "Use descriptive headings and meaningful internal links that explain the site's information architecture.", url: finalUrl.toString()
  });

  return findings;
}

async function probe(url: URL, path: string): Promise<"found" | "missing" | "blocked" | "unavailable"> {
  const target = new URL(path, url);
  try {
    await assertPublicHost(target);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    const response = await fetch(target, { redirect: "error", signal: controller.signal, headers: { "user-agent": USER_AGENT }, cache: "no-store" }).finally(() => clearTimeout(timer));
    if (response.ok) return "found";
    if (response.status === 403 || response.status === 401) return "blocked";
    if (response.status === 404) return "missing";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function scanWebsite(input: string, businessName?: string): Promise<ScanReport> {
  const url = normalizeUrl(input);
  const { finalUrl, text } = await fetchPublic(url);
  const title = firstMatch(text, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(text, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ?? firstMatch(text, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const headings = allMatches(text, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi).slice(0, 20);
  const links = [...text.matchAll(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi)].length;
  const types = structuredTypes(text);
  const robots = await probe(finalUrl, "/robots.txt");
  const sitemap = await probe(finalUrl, "/sitemap.xml");
  const findings = buildFindings({ url, finalUrl, html: text, title, description, headings, links, types, robots, sitemap });
  const critical = findings.filter((f) => f.severity === "CRITICAL").length;
  const important = findings.filter((f) => f.severity === "IMPORTANT").length;
  const attention = findings.filter((f) => f.severity === "NEEDS_ATTENTION").length;
  const readiness = critical ? "CRITICAL GAPS" : important >= 3 ? "IMPORTANT GAPS" : important || attention >= 3 ? "NEEDS ATTENTION" : findings.every((f) => f.severity === "GOOD") ? "STRONG" : "GOOD";
  return { url: url.toString(), finalUrl: finalUrl.toString(), scannedAt: new Date().toISOString(), businessName, title, description, headings, links, structuredDataTypes: types, robots, sitemap, readiness, findings };
}
