import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { syncMercadoPago } from "@/server/actions/mercadopago-sync";

export async function POST(req: Request) {
  try {
    // Para simplificar a demonstração, vamos pegar o primeiro workspace
    // Em produção, isso viria da sessão do usuário autenticado (auth())
    const workspace = await db.workspace.findFirst();
    
    if (!workspace) {
      return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
    }

    const result = await syncMercadoPago(workspace.id);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Erro na rota de sync:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
