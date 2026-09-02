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
  stage?: "SERVICE" | "AUTHENTICATION" | "INSTANCE" | "PAIRING" | "CONNECTED";
  error?: string;
}

export interface EvolutionSettingsResponse {
  success: boolean;
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
    
    if (process.env.NODE_ENV !== "production") urls.push("http://127.0.0.1:8081");
    
    return Array.from(new Set(urls));
  }

  private getApiKey(customKey?: string): string {
    const apiKey = customKey || process.env.EVOLUTION_API_KEY;
    if (!apiKey) throw new Error("EVOLUTION_API_KEY não configurada.");
    return apiKey;
  }

  private getInstanceName(customInstance?: string): string {
    const instanceName = customInstance || process.env.EVOLUTION_INSTANCE_NAME || (process.env.NODE_ENV !== "production" ? "novex-finance" : "");
    if (!instanceName) throw new Error("EVOLUTION_INSTANCE_NAME não configurada.");
    return instanceName;
  }

  /**
   * Perfil mínimo do NOVEX: enviar cobranças sem importar histórico,
   * grupos, mensagens pessoais ou confirmações de leitura.
   */
  async ensureOutboundOnlySettings(url?: string, key?: string, instance?: string): Promise<EvolutionSettingsResponse> {
    const targetUrls = this.getTargetUrls(url);
    const apiKey = this.getApiKey(key);
    const instanceName = this.getInstanceName(instance);
    let lastError = "Evolution API não aceitou as configurações seguras da instância.";

    for (const baseUrl of targetUrls) {
      try {
        const response = await fetch(`${baseUrl}/settings/set/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            rejectCall: false,
            msgCall: "",
            groupsIgnore: true,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false,
            syncFullHistory: false,
          }),
        });
        if (response.ok) return { success: true };
        lastError = `HTTP ${response.status} ao configurar a instância Evolution.`;
      } catch (error: any) {
        lastError = error?.message || String(error);
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * Verificar estado real da conexão da instância no servidor Evolution API
   */
  async checkConnectionState(url?: string, key?: string, instance?: string): Promise<EvolutionStatusResponse> {
    const targetUrls = this.getTargetUrls(url);
    const apiKey = this.getApiKey(key);
    const instanceName = this.getInstanceName(instance);

    let lastError = "Evolution API não respondeu.";
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
          return { success: true, state: normalizedState, stage: normalizedState === "open" ? "CONNECTED" : "PAIRING" };
        }
        if (response.status === 401 || response.status === 403) return { success: false, state: "disconnected", stage: "AUTHENTICATION", error: `Evolution recusou a API key (HTTP ${response.status}).` };
        if (response.status === 404) return { success: false, state: "disconnected", stage: "INSTANCE", error: "Instância ainda não criada; solicite o QR Code para criá-la." };
        lastError = `HTTP ${response.status} ao consultar a instância.`;
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }

    return {
      success: false,
      state: "disconnected",
      stage: "SERVICE",
      error: lastError,
    };
  }

  /**
   * Solicitar QR Code real para pareamento de instância WhatsApp
   */
  async fetchQRCode(url?: string, key?: string, instance?: string): Promise<EvolutionQRCodeResponse> {
    const targetUrls = this.getTargetUrls(url);
    const apiKey = this.getApiKey(key);
    const instanceName = this.getInstanceName(instance);

    let lastError = "Evolution API não respondeu ao solicitar QR Code.";
    for (const baseUrl of targetUrls) {
      try {
        let response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: { apikey: apiKey },
        });

        if (response.status === 404) {
          const createResponse = await fetch(`${baseUrl}/instance/create`, {
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
          });
          if (!createResponse.ok && createResponse.status !== 409) {
            lastError = `HTTP ${createResponse.status} ao criar a instância Evolution.`;
            continue;
          }

          if (createResponse.ok) {
            const created = await createResponse.json();
            const createdBase64 = created.qrcode?.base64;
            if (createdBase64) {
              return { success: true, base64: createdBase64.startsWith("data:") ? createdBase64 : `data:image/png;base64,${createdBase64}`, pairingCode: created.qrcode?.pairingCode || created.qrcode?.code };
            }
          }

          response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
            method: "GET",
            headers: { apikey: apiKey },
          });
        }

        if (response.ok) {
          const data = await response.json();
          let base64 = data.base64 || data.qrcode?.base64;
          let pairingCode = data.pairingCode || data.code;
          
          if (!base64) {
            // Fazer até 3 tentativas com intervalo de 1.5s para aguardar o motor Baileys emitir o QR Code
            for (let attempt = 0; attempt < 3; attempt++) {
              await new Promise((r) => setTimeout(r, 1500));
              const retryRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
                method: "GET",
                headers: { apikey: apiKey },
              });
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                base64 = retryData.base64 || retryData.qrcode?.base64;
                pairingCode = retryData.pairingCode || retryData.code;
                if (base64) break;
              }
            }
          }

          if (base64) {
            const formattedBase64 = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
            return { success: true, base64: formattedBase64, pairingCode };
          } else {
            return {
              success: false,
              error: "A instância do WhatsApp está iniciando. Por favor, aguarde alguns segundos e clique em 'Gerar QR Code' novamente.",
            };
          }
        } else {
          lastError = `HTTP ${response.status} ao conectar a instância Evolution.`;
        }
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }

    return {
      success: false,
      error: lastError,
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

    let lastError = "Evolution API não respondeu ao envio.";
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
        lastError = `HTTP ${response.status} ao enviar mensagem.`;
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }

    return {
      success: false,
      error: lastError,
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
