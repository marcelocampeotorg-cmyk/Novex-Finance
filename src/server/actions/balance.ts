"use server";

import { refreshMercadoPagoBalance as refreshBalanceService } from "@/server/services/mercado-pago-balance-service";

export async function refreshMercadoPagoBalance() {
  return refreshBalanceService();
}
