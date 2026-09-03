import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

export const dynamic = "force-dynamic";

const clientLogSchema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(2000).optional(),
  componentStack: z.string().max(2000).optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(300).optional(),
});

// Rate limiting defensivo em memória por IP (máx 20 logs por minuto)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_LOGS_PER_MINUTE = 20;

export async function POST(req: NextRequest) {
  try {
    const rawIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "loopback";
    const ip = rawIp.split(",")[0].trim();

    const now = Date.now();
    const rateData = rateLimitMap.get(ip) || { count: 0, resetTime: now + 60000 };

    if (now > rateData.resetTime) {
      rateData.count = 0;
      rateData.resetTime = now + 60000;
    }

    rateData.count += 1;
    rateLimitMap.set(ip, rateData);

    // Limpeza periódica de chaves expiradas para evitar crescimento de memória
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetTime) rateLimitMap.delete(k);
      }
    }

    if (rateData.count > MAX_LOGS_PER_MINUTE) {
      return NextResponse.json({ error: "Taxa de logs excedida (rate limit)" }, { status: 429 });
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
    }

    const parseResult = clientLogSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Estrutura de log inválida", details: parseResult.error.flatten() }, { status: 400 });
    }

    const { message, stack, componentStack, url, userAgent } = parseResult.data;

    logger.error("CLIENT_EXCEPTION", message, {
      url: url || req.headers.get("referer") || "unknown",
      userAgent: userAgent || req.headers.get("user-agent") || "unknown",
      stack,
      componentStack,
      ip,
    });

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ received: false, error: "Erro interno no processamento de log" }, { status: 500 });
  }
}
