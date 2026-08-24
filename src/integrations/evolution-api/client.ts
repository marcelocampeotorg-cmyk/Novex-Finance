export interface SendWhatsAppMessageInput {
  number: string; // Número do telefone do devedor (ex: 5511999999999)
  text: string;   // Conteúdo da mensagem
  baseUrl?: string;
  apiKey?: string;
  instanceName?: string;
}

export interface EvolutionAPIResponse {
  success: boolean;
  messageId?: string | null;
  error?: string;
}

export interface EvolutionQRCodeResponse {
  success: boolean;
  base64?: string;
  pairingCode?: string;
  error?: string;
}

export interface EvolutionStatusResponse {
  success: boolean;
  state: "open" | "connecting" | "close" | "disconnected";
  error?: string;
}

export class EvolutionAPIClient {
  private getTargetUrls(customUrl?: string): string[] {
    const urls: string[] = [];
    
    // Forçar IPv4 no Windows para localhost
    if (customUrl && customUrl.trim()) {
      urls.push(customUrl.trim().replace(/\/$/, "").replace("localhost", "127.0.0.1"));
    }
    if (process.env.EVOLUTION_API_URL) {
      urls.push(process.env.EVOLUTION_API_URL.trim().replace(/\/$/, "").replace("localhost", "127.0.0.1"));
    }
    
    urls.push("http://127.0.0.1:8081");
    urls.push("http://127.0.0.1:8080");
    urls.push("http://evolution:8080");
    urls.push("http://evoapicloud:8080");
    
    return Array.from(new Set(urls));
  }

  private getApiKey(customKey?: string): string {
    const apiKey = customKey || process.env.EVOLUTION_API_KEY;
    if (!apiKey) throw new Error("EVOLUTION_API_KEY não configurada.");
    return apiKey;
  }

  private getInstanceName(customInstance?: string): string {
    return customInstance || process.env.EVOLUTION_INSTANCE_NAME || "novex-finance";
  }

  /**
   * Verificar estado real da conexão da instância no servidor Evolution API
   */
  async checkConnectionState(url?: string, key?: string, instance?: string): Promise<EvolutionStatusResponse> {
    const targetUrls = this.getTargetUrls(url);
    const apiKey = this.getApiKey(key);
    const instanceName = this.getInstanceName(instance);

    for (const baseUrl of targetUrls) {
      try {
        const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
          method: "GET",
          headers: { apikey: apiKey },
        });

        if (response.ok) {
          const data = await response.json();
          const state = data.instance?.state || data.state || "close";
          const normalizedState = state === "open" ? "open" : state === "connecting" ? "connecting" : "disconnected";
          return { success: true, state: normalizedState };
        }
      } catch (e) {
        // Tentar próximo endpoint em porta local
      }
    }

    return {
      success: false,
      state: "disconnected",
      error: "Nenhum container Evolution API ativo em http://localhost:8081.",
    };
  }

  /**
   * Solicitar QR Code real para pareamento de instância WhatsApp
   */
  async fetchQRCode(url?: string, key?: string, instance?: string): Promise<EvolutionQRCodeResponse> {
    const targetUrls = this.getTargetUrls(url);
    const apiKey = this.getApiKey(key);
    const instanceName = this.getInstanceName(instance);

    for (const baseUrl of targetUrls) {
      try {
        let response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: { apikey: apiKey },
        });

        if (response.status === 404) {
          await fetch(`${baseUrl}/instance/create`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: apiKey,
            },
            body: JSON.stringify({
              instanceName,
              qrcode: true,
              integration: "WHATSAPP-BAILEYS",
            }),
          }).catch(() => {});

          response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
            method: "GET",
            headers: { apikey: apiKey },
          });
        }

        if (response.ok) {
          const data = await response.json();
          const base64 = data.base64 || data.code || data.qrcode?.base64;
          const pairingCode = data.pairingCode || data.code;
          
          if (base64) {
            const formattedBase64 = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
            return { success: true, base64: formattedBase64, pairingCode };
          } else {
            // Servidor respondeu, mas não há QR code (geralmente porque o Baileys está iniciando)
            return {
              success: false,
              error: "A instância do WhatsApp está iniciando. Por favor, aguarde 10 segundos e clique em 'Gerar QR Code' novamente.",
            };
          }
        }
      } catch (e) {
        // Tentar próximo endpoint
      }
    }

    return {
      success: false,
      error: "Servidor Evolution API inacessível. Verifique se o container evoapicloud está em execução no Docker.",
    };
  }

  /**
   * Enviar mensagem de texto via WhatsApp (Evolution API)
   */
  async sendTextMessage(input: SendWhatsAppMessageInput): Promise<EvolutionAPIResponse> {
    const targetUrls = this.getTargetUrls(input.baseUrl);
    const apiKey = this.getApiKey(input.apiKey);
    const instanceName = this.getInstanceName(input.instanceName);

    const cleanNumber = input.number.replace(/\D/g, "");
    const formattedNumber = cleanNumber.startsWith("55") ? cleanNumber : `55${cleanNumber}`;

    for (const baseUrl of targetUrls) {
      try {
        const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({
            number: formattedNumber,
            text: input.text,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            messageId: data.key?.id || (data.id != null ? String(data.id) : null),
          };
        }
      } catch (e) {}
    }

    return {
      success: false,
      error: "Não foi possível enviar mensagem via WhatsApp. Container Evolution indisponível.",
    };
  }

  /**
   * Enviar cobrança Pix com QR Code Copia e Cola via WhatsApp para o Devedor
   */
  async sendPixChargeReminder(input: {
    debtorName: string;
    debtorPhone: string;
    amountCents: number;
    dueDate: string;
    pixCopiaECola?: string;
    baseUrl?: string;
    apiKey?: string;
    instanceName?: string;
  }): Promise<EvolutionAPIResponse> {
    const valorFormatted = (input.amountCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    let messageText = `Olá, *${input.debtorName}*! tudo bem?\n\nPassando para lembrar sobre o valor de *${valorFormatted}* com vencimento em *${input.dueDate}*.`;

    if (input.pixCopiaECola) {
      messageText += `\n\nVocê pode realizar o pagamento diretamente via Pix Copia e Cola:\n\n\`\`\`${input.pixCopiaECola}\`\`\``;
    }

    messageText += `\n\nAgradecemos a atenção! — *NOVEX Finance*`;

    return this.sendTextMessage({
      number: input.debtorPhone,
      text: messageText,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      instanceName: input.instanceName,
    });
  }
}

export const evolutionAPIClient = new EvolutionAPIClient();
