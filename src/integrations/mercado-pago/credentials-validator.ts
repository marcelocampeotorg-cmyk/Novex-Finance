if (typeof window !== "undefined") {
  throw new Error("SERVER_ONLY_ERROR: Validador de credenciais só pode ser executado no servidor.");
}

export interface ValidationResult {
  valid: boolean;
  externalAccountId?: string;
  externalApplicationId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Valida o Access Token Mercado Pago Sandbox chamando a API oficial de identidade do Mercado Livre:
 * GET https://api.mercadolibre.com/users/me
 * 
 * Executa exclusivamente no backend com AbortController (timeout 5s).
 * NUNCA registra o token, headers de autorização ou a resposta completa contendo dados pessoais.
 */
export async function validateAccessToken(token: string): Promise<ValidationResult> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      valid: false,
      errorCode: "EMPTY_TOKEN",
      errorMessage: "O token fornecido está vazio.",
    };
  }

  const trimmedToken = token.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://api.mercadolibre.com/users/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
        Accept: "application/json",
        "User-Agent": "NOVEX-Finance-Validator/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 200) {
      const data = await response.json();
      const externalAccountId = data.id ? String(data.id) : undefined;
      // Caso a API retorne client_id / application_id, capturar sem inventar
      const externalApplicationId = data.site_status?.client_id || data.client_id ? String(data.client_id) : undefined;

      return {
        valid: true,
        externalAccountId,
        externalApplicationId: externalApplicationId || undefined,
      };
    }

    if (response.status === 401) {
      return {
        valid: false,
        errorCode: "UNAUTHORIZED_401",
        errorMessage: "Token do Mercado Pago não autorizado ou expirado (401).",
      };
    }

    if (response.status === 403) {
      return {
        valid: false,
        errorCode: "FORBIDDEN_403",
        errorMessage: "Acesso negado para o token informado (403).",
      };
    }

    if (response.status === 429) {
      return {
        valid: false,
        errorCode: "RATE_LIMITED_429",
        errorMessage: "Limite de requisições excedido na API do Mercado Pago (429).",
      };
    }

    if (response.status >= 500) {
      return {
        valid: false,
        errorCode: `SERVER_ERROR_${response.status}`,
        errorMessage: `Serviço do Mercado Pago temporariamente indisponível (${response.status}).`,
      };
    }

    return {
      valid: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `Falha na validação do token com o servidor (${response.status}).`,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      return {
        valid: false,
        errorCode: "TIMEOUT",
        errorMessage: "Tempo limite excedido na resposta do Mercado Pago (Timeout 5s).",
      };
    }

    return {
      valid: false,
      errorCode: "NETWORK_ERROR",
      errorMessage: "Erro de conectividade ao se comunicar com o Mercado Pago.",
    };
  }
}
