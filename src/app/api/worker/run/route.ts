import { NextRequest, NextResponse } from "next/server";
import { workerDaemon } from "@/services/worker-daemon";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const workerSecret = process.env.WORKER_SECRET || "NOVEX_WORKER_SECRET_KEY";

    // Verificar token Bearer em produção/homologação
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token !== workerSecret) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      }
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
