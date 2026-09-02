import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, stack, componentStack, url, userAgent } = body;

    logger.error("CLIENT_EXCEPTION", message || "Exceção não identificada no cliente", {
      url: url || req.headers.get("referer") || "unknown",
      userAgent: userAgent || req.headers.get("user-agent") || "unknown",
      stack: stack ? String(stack).slice(0, 2000) : undefined,
      componentStack: componentStack ? String(componentStack).slice(0, 2000) : undefined,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "loopback",
    });

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ received: false, error: err.message }, { status: 500 });
  }
}
