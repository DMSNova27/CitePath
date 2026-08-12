import { NextResponse } from "next/server";
import { z } from "zod";
import { scanWebsite } from "@/lib/analyzer";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  url: z.string().trim().min(1).max(2048).refine((value) => !/^[a-z][a-z0-9+.-]*:/i.test(value) || /^https?:\/\//i.test(value), "Only HTTP and HTTPS URLs are allowed."),
  businessName: z.string().trim().max(160).optional(),
});

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous").slice(0, 120);
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many scans. Please wait a moment and try again." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid public HTTP or HTTPS website URL." }, { status: 400 });
    const report = await scanWebsite(parsed.data.url, parsed.data.businessName);
    return NextResponse.json({ report }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The website could not be scanned.";
    return NextResponse.json({ error: message }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
