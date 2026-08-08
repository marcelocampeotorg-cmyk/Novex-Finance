"use server";

import { db } from "@/server/db";
import { decryptCredentials } from "@/lib/server/credentials-crypto";
import { revalidatePath } from "next/cache";

export async function syncMercadoPago(workspaceId: string) {
  try {
    const mpIntegration = await db.integrationAccount.findFirst({
      where: {
        workspaceId,
        provider: "MERCADO_PAGO",
        status: "CONNECTED",
      },
    });

    if (!mpIntegration) {
      return { success: false, error: "Nenhuma integração do Mercado Pago conectada." };
    }

    // Trava de Segurança (Cache de 5 minutos) para evitar Rate Limit (Erro 429)
    const CACHE_MINUTES = 5;
    if (mpIntegration.lastSyncAt) {
      const now = new Date();
      const diffInMinutes = (now.getTime() - mpIntegration.lastSyncAt.getTime()) / (1000 * 60);
      
      if (diffInMinutes < CACHE_MINUTES) {
        return { 
          success: true, 
          cached: true, 
          message: "Sincronização recente (menos de 5 min). Retornando dados do cache local." 
        };
      }
    }

    if (!mpIntegration.encryptedCredentials) {
      return { success: false, error: "Credenciais do Mercado Pago ausentes." };
    }

    const creds = JSON.parse(decryptCredentials(mpIntegration.encryptedCredentials));

    // Busca os pagamentos mais recentes usando a API de Search do Mercado Pago
    // Como combinamos no plano, esta é uma busca ativa (Polling) que dispensa Webhooks locais
    const userRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    const userData = await userRes.json();
    const myUserId = userData.id;

    // 2. Busca pagamentos recentes
    const res = await fetch(
      "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50",
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      }
    );

    if (!res.ok) {
      throw new Error(`Erro na API do MP: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const payments = data.results || [];
    let importedCount = 0;

    for (const payment of payments) {
      const externalId = payment.id.toString();
      
      // Verifica se a transação já foi importada antes
      const exists = await db.externalTransaction.findFirst({
        where: {
          integrationAccountId: mpIntegration.id,
          provider: "MERCADO_PAGO",
          externalId,
        },
      });

      if (!exists) {
        const amountCents = Math.round((payment.transaction_amount || 0) * 100);
        
        // Lógica de Direção (CREDIT vs DEBIT) e Tipo (TRANSFER vs Pagamento)
        const isCollector = payment.collector_id == myUserId;
        const isFund = payment.operation_type === "account_fund";
        const isPayer = payment.payer_id == myUserId || payment.payer?.id == myUserId;

        let direction: "CREDIT" | "DEBIT" = "CREDIT";
        if (isFund || isCollector) {
          direction = "CREDIT";
        } else if (isPayer) {
          direction = "DEBIT";
        }

        const isTransfer = isFund || payment.operation_type === "money_transfer" || (isPayer && isCollector);
        const type = isTransfer ? "TRANSFER" : (direction === "CREDIT" ? "PIX_RECEIVED" : "PIX_SENT");

        await db.externalTransaction.create({
          data: {
            workspaceId,
            integrationAccountId: mpIntegration.id,
            provider: "MERCADO_PAGO",
            externalId,
            type,
            direction,
            amountCents,
            netAmountCents: amountCents,
            status: payment.status,
            occurredAt: new Date(payment.date_created),
            description: payment.description || "Pagamento Mercado Pago",
            rawReference: JSON.stringify(payment),
          },
        });
        importedCount++;
      }
    }

    // Atualiza a trava de cache (lastSyncAt)
    await db.integrationAccount.update({
      where: { id: mpIntegration.id },
      data: { lastSyncAt: new Date() },
    });

    revalidatePath("/");
    
    return { 
      success: true, 
      cached: false, 
      message: `Sincronização concluída. ${importedCount} novas transações importadas.` 
    };

  } catch (error: any) {
    console.error("Erro ao sincronizar Mercado Pago:", error);
    return { success: false, error: error.message };
  }
}
