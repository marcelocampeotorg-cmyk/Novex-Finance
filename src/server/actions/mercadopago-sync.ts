"use server";

import { db } from "@/server/db";
import { decryptCredentials } from "@/lib/server/credentials-crypto";
import { revalidatePath } from "next/cache";

export async function syncMercadoPago(workspaceId: string, force: boolean = false) {
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

    // Trava de Segurança (Cache de 5 minutos) ignorada se force === true
    const CACHE_MINUTES = 5;
    if (!force && mpIntegration.lastSyncAt) {
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

    let creds: any;
    try {
      creds = JSON.parse(decryptCredentials(mpIntegration.encryptedCredentials));
    } catch (e) {
      return { success: false, error: "Falha ao descriptografar credenciais do Mercado Pago." };
    }

    if (!creds?.accessToken) {
      return { success: false, error: "Access Token do Mercado Pago não encontrado." };
    }

    // 1. Identificar Usuário e Testar Conexão Real
    const userRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (!userRes.ok) {
      await db.integrationAccount.update({
        where: { id: mpIntegration.id },
        data: {
          lastValidationErrorCode: `HTTP_${userRes.status}`,
        },
      });
      return { success: false, error: `Credenciais Mercado Pago inválidas ou expiradas (${userRes.status}).` };
    }

    const userData = await userRes.json();
    const myUserId = userData.id;

    // 1.5 Buscar Saldo Real da Conta Mercado Pago na API Oficial
    let fetchedRealBalanceCents: number | null = null;
    try {
      const balanceEndpoints = [
        `https://api.mercadopago.com/users/${myUserId}/mercadopago_account/balance`,
        `https://api.mercadopago.com/users/me/mercadopago_account/balance`,
        `https://api.mercadopago.com/v1/account/balance`,
      ];

      for (const endpoint of balanceEndpoints) {
        const bRes = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${creds.accessToken}` },
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          const rawAmount = bData.total_amount ?? bData.available_balance ?? bData.balance;
          if (typeof rawAmount === "number") {
            fetchedRealBalanceCents = Math.round(rawAmount * 100);
            break;
          }
        }
      }
    } catch (bErr) {
      console.warn("Aviso ao consultar saldo real do Mercado Pago:", bErr);
    }

    // 2. Busca pagamentos recebidos (Collector) E pagamentos efetuados pelo usuário (Payer)
    const collectorRes = await fetch(
      "https://api.mercadopago.com/v1/payments/search?sort=date_last_updated&criteria=desc&limit=100",
      { headers: { Authorization: `Bearer ${creds.accessToken}` } }
    );

    const payerRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?sort=date_last_updated&criteria=desc&limit=100&payer.id=${myUserId}`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } }
    );

    let allPayments: any[] = [];
    const seenIds = new Set<string>();

    if (collectorRes.ok) {
      const colData = await collectorRes.json();
      (colData.results || []).forEach((p: any) => {
        if (p.id && !seenIds.has(String(p.id))) {
          seenIds.add(String(p.id));
          allPayments.push(p);
        }
      });
    }

    if (payerRes.ok) {
      const payerData = await payerRes.json();
      (payerData.results || []).forEach((p: any) => {
        if (p.id && !seenIds.has(String(p.id))) {
          seenIds.add(String(p.id));
          allPayments.push(p);
        }
      });
    }

    let importedCount = 0;

    for (const payment of allPayments) {
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
        if (isPayer && !isCollector) {
          direction = "DEBIT";
        } else if (isFund || isCollector) {
          direction = "CREDIT";
        } else if (payment.transaction_amount < 0) {
          direction = "DEBIT";
        }

        const isTransfer = isFund || payment.operation_type === "money_transfer" || (isPayer && isCollector);
        const type = isTransfer ? "TRANSFER" : (direction === "CREDIT" ? "PIX_RECEIVED" : "PIX_SENT");

        let counterpartName = direction === "DEBIT"
          ? (payment.collector?.first_name || payment.description || "Pagamento Efetuado")
          : (payment.payer?.first_name || payment.payer?.email || payment.description || "Pagamento Recebido");

        if (typeof counterpartName === "string" && counterpartName.replace(/X/gi, "").trim() === "") {
          counterpartName = payment.description || (direction === "DEBIT" ? "Pagamento Efetuado" : "Pagamento Recebido");
        }

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
            status: payment.status || "approved",
            occurredAt: new Date(payment.date_created || Date.now()),
            description: payment.description || (direction === "DEBIT" ? "Pagamento Efetuado Mercado Pago" : "Pagamento Recebido Mercado Pago"),
            counterpartName,
            rawReference: JSON.stringify(payment),
          },
        });
        importedCount++;
      }
    }

    // Atualiza a trava de cache (lastSyncAt), saldo real retornado e limpa códigos de erro
    const currentCapabilities = (mpIntegration.capabilities as any) || {};
    const updatedCapabilities = {
      ...currentCapabilities,
      ...(fetchedRealBalanceCents !== null ? { realBalanceCents: fetchedRealBalanceCents } : {}),
      lastSyncMessage: `${importedCount} novas transações importadas.`,
    };

    await db.integrationAccount.update({
      where: { id: mpIntegration.id },
      data: {
        lastSyncAt: new Date(),
        lastValidationErrorCode: null,
        capabilities: updatedCapabilities,
      },
    });

    try {
      revalidatePath("/");
    } catch (e) {
      console.warn("revalidatePath aviso:", e);
    }
    
    return { 
      success: true, 
      cached: false, 
      message: `Sincronização concluída. ${importedCount} novas transações importadas.` 
    };

  } catch (error: any) {
    console.error("Erro ao sincronizar Mercado Pago:", error);
    return { success: false, error: error.message || "Falha na comunicação com o Mercado Pago." };
  }
}
