import { NextResponse } from "next/server";
import { z } from "zod";
import { scanWebsite } from "@/lib/analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  businessName: z.string().trim().max(160).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid public website URL." }, { status: 400 });

    const report = await scanWebsite(parsed.data.url, parsed.data.businessName);
    return NextResponse.json({ report }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The website could not be scanned.";
    return NextResponse.json({ error: message }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
