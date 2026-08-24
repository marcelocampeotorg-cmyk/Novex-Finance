import { NextRequest, NextResponse } from "next/server";
import { workerDaemon } from "@/services/worker-daemon";

import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const workerSecret = process.env.WORKER_SECRET;

    if (!workerSecret) {
      return NextResponse.json({ error: "Configuração do worker incompleta." }, { status: 500 });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.substring(7).trim();
    
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(workerSecret);

    if (tokenBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(tokenBuffer, secretBuffer)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const result = await workerDaemon.runBackgroundJobs();
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("Erro no endpoint do Worker Daemon:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "Worker Daemon Endpoint Ativo. Use POST para disparar." });
}
