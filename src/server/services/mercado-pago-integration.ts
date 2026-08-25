import "server-only";
import { db } from "@/server/db";

export async function getActiveMercadoPagoIntegrationForWorkspace(workspaceId: string) {
  const accounts = await db.integrationAccount.findMany({
    where: { workspaceId, provider: "MERCADO_PAGO", status: "CONNECTED", isActive: true },
    take: 2,
  });
  if (accounts.length !== 1 || !accounts[0].encryptedCredentials) {
    throw new Error(accounts.length > 1
      ? "Configuração inválida: múltiplas integrações Mercado Pago ativas."
      : "Nenhuma integração do Mercado Pago ativa ou conectada.");
  }
  return accounts[0];
}
