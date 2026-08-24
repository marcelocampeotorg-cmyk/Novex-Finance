import { NextResponse } from "next/server";
import { syncMercadoPagoStatement } from "@/server/actions/transactions";

export async function POST(req: Request) {
  try {
    const result = await syncMercadoPagoStatement();
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Erro na rota de sync:", error);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
