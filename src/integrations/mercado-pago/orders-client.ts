if (typeof window !== "undefined") {
  throw new Error("SERVER_ONLY_ERROR: O cliente da Orders API só pode ser executado no servidor.");
}

export interface CreatePixOrderInput {
  accessToken: string;
  amountCents: number;
  externalReference: string;
  idempotencyKey: string;
  payerEmail: string;
  description?: string;
  expirationMinutes?: number;
}

export interface CreatePixOrderResult {
  success: boolean;
  orderId?: string;
  status?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface GetOrderResult {
  success: boolean;
  orderId?: string;
  status?: string;
  isPaid?: boolean;
  amountCents?: number;
  paidAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Converte valor em centavos (BigInt/number) para string decimal formatada "0.00" determinística.
 */
export function centsToDecimalString(amountCents: number | bigint): string {
  const cents = typeof amountCents === "bigint" ? Number(amountCents) : amountCents;
  if (isNaN(cents) || cents <= 0) {
    throw new Error("VALOR_INVALIDO: O valor em centavos deve ser maior que zero.");
  }
  return (cents / 100).toFixed(2);
}

/**
 * Cria uma Order de Cobrança Pix no Mercado Pago via POST https://api.mercadopago.com/v1/orders
 * Exige X-Idempotency-Key única e persistente.
 */
export async function createPixOrder(input: CreatePixOrderInput): Promise<CreatePixOrderResult> {
  const { accessToken, amountCents, externalReference, idempotencyKey, payerEmail, expirationMinutes = 30 } = input;

  if (!accessToken || !accessToken.trim()) {
    return { success: false, errorCode: "MISSING_TOKEN", errorMessage: "Access Token não informado." };
  }

  if (!idempotencyKey || !idempotencyKey.trim()) {
    return { success: false, errorCode: "MISSING_IDEMPOTENCY_KEY", errorMessage: "Chave de idempotência necessária." };
  }

  if (!payerEmail || !payerEmail.includes("@")) {
    return {
      success: false,
      errorCode: "INVALID_PAYER_EMAIL",
      errorMessage: "O devedor/pagador deve possuir um e-mail válido para cobrança via Orders API.",
    };
  }

  const decimalAmount = centsToDecimalString(amountCents);

  // Calcula data de expiração ISO 8601
  const expDate = new Date(Date.now() + expirationMinutes * 60 * 1000);
  const expirationIso = expDate.toISOString();

  const payload = {
    type: "online",
    total_amount: decimalAmount,
    external_reference: externalReference,
    processing_mode: "automatic",
    transactions: {
      payments: [
        {
          amount: decimalAmount,
          payment_method: {
            id: "pix",
            type: "bank_transfer",
          },
          expiration_time: `PT${expirationMinutes}M`,
        },
      ],
    },
    payer: {
      email: payerEmail.trim(),
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey.trim(),
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (response.status === 201 || response.status === 200) {
      const paymentData = data.transactions?.payments?.[0];
      const qrCode =
        paymentData?.payment_method?.qr_code ||
        paymentData?.point_of_interaction?.transaction_data?.qr_code ||
        data.qr_code ||
        undefined;

      let qrCodeBase64 =
        paymentData?.payment_method?.qr_code_base64 ||
        paymentData?.point_of_interaction?.transaction_data?.qr_code_base64 ||
        undefined;

      if (qrCodeBase64 && !qrCodeBase64.startsWith("data:image")) {
        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
      }

      const ticketUrl =
        paymentData?.payment_method?.ticket_url ||
        paymentData?.ticket_url ||
        data.ticket_url ||
        undefined;

      return {
        success: true,
        orderId: String(data.id || data.order_id),
        status: data.status || "PENDING",
        qrCode,
        qrCodeBase64,
        ticketUrl,
        expiresAt: expirationIso,
      };
    }

    // Tratamento de erros
    const errorMessage = data.message || data.error || `Erro HTTP ${response.status} na API Orders`;
    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      return { success: false, errorCode: "TIMEOUT", errorMessage: "Tempo limite de 10s excedido ao criar Order." };
    }
    return { success: false, errorCode: "NETWORK_ERROR", errorMessage: "Falha de conectividade com a API de Orders." };
  }
}

/**
 * Consulta o status oficial da Order no Mercado Pago via GET https://api.mercadopago.com/v1/orders/{orderId}
 */
export async function getOrderById(input: { accessToken: string; orderId: string }): Promise<GetOrderResult> {
  const { accessToken, orderId } = input;

  if (!accessToken || !orderId) {
    return { success: false, errorCode: "INVALID_PARAMS", errorMessage: "Parâmetros inválidos para consulta da Order." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (response.status === 200) {
      const paymentsArray = data.transactions?.payments || data.payments || [];
      const paymentObj = paymentsArray[0];

      const orderStatus = String(data.status || "").toUpperCase();
      const paymentStatus = String(paymentObj?.status || "").toLowerCase();
      const statusDetail = String(paymentObj?.status_detail || "").toLowerCase();

      // Regra 26: Validação estrita de status, payment transaction status e status_detail (acreditado)
      const isOrderStatusPaid = ["PAID", "PROCESSED", "CLOSED"].includes(orderStatus);
      const isPaymentApproved = paymentStatus === "approved";
      const isAccredited = statusDetail === "accredited" || statusDetail === "approved" || statusDetail === "";

      const isPaid = isOrderStatusPaid && isPaymentApproved && isAccredited;

      // Regra 27: Nunca inventar data de pagamento. Sem data oficial de aprovação -> paidAt = null
      const paidAt = paymentObj?.date_approved || data.date_approved || null;

      return {
        success: true,
        orderId: String(data.id),
        status: orderStatus,
        isPaid,
        paidAt: paidAt || undefined,
      };
    }

    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: data.message || `Erro ${response.status} ao consultar Order.`,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      return { success: false, errorCode: "TIMEOUT", errorMessage: "Timeout ao consultar Order." };
    }
    return { success: false, errorCode: "NETWORK_ERROR", errorMessage: "Erro de rede ao consultar Order." };
  }
}
