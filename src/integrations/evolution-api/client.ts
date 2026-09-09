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
  alreadyConnected?: boolean;
  state?: string;
  error?: string;
}

export interface EvolutionStatusResponse {
  success: boolean;
  state: "open" | "connecting" | "close" | "disconnected";
  stage?: "SERVICE" | "AUTHENTICATION" | "INSTANCE" | "PAIRING" | "CONNECTED";
  profileName?: string;
  ownerJid?: string;
  profilePicUrl?: string;
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

          let profileName: string | undefined;
          let ownerJid: string | undefined;
          let profilePicUrl: string | undefined;

          if (normalizedState === "open") {
            try {
              const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
                headers: { apikey: apiKey },
              });
              if (fetchRes.ok) {
                const instances = await fetchRes.json();
                const current = Array.isArray(instances) ? instances.find((i: any) => i.name === instanceName) : null;
                if (current) {
                  profileName = current.profileName || undefined;
                  ownerJid = current.ownerJid || undefined;
                  profilePicUrl = current.profilePicUrl || undefined;
                }
              }
            } catch {
              // não bloqueia
            }
          }

          return {
            success: true,
            state: normalizedState,
            stage: normalizedState === "open" ? "CONNECTED" : "PAIRING",
            profileName,
            ownerJid,
            profilePicUrl,
          };
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
          if (data.instance?.state === "open" || data.state === "open") {
            return { success: true, alreadyConnected: true, state: "open" };
          }
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
                if (retryData.instance?.state === "open" || retryData.state === "open") {
                  return { success: true, alreadyConnected: true, state: "open" };
                }
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
   * Desconectar/deslogar a instância WhatsApp para permitir novo pareamento
   */
  async logoutInstance(url?: string, key?: string, instance?: string): Promise<{ success: boolean; error?: string }> {
    const targetUrls = this.getTargetUrls(url);
    const apiKey = this.getApiKey(key);
    const instanceName = this.getInstanceName(instance);

    let lastError = "Evolution API não respondeu ao desconectar.";
    for (const baseUrl of targetUrls) {
      try {
        const response = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: { apikey: apiKey },
        });
        if (response.ok || response.status === 404) {
          return { success: true };
        }
        lastError = `HTTP ${response.status} ao desconectar instância.`;
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }
    return { success: false, error: lastError };
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
   * Enviar cobrança Pix com QR Code Copia e Cola via WhatsApp para o Devedor.
   * Envia o texto humanizado e, logo em seguida, o código Pix Copia e Cola em mensagem
   * avulsa e limpa, permitindo que o cliente copie a chave com 1 toque no celular.
   */
  async sendPixChargeReminder(input: {
    debtorName: string;
    debtorPhone: string;
    amountCents: number;
    dueDate: string;
    pixCopiaECola?: string;
    title?: string;
    description?: string;
    senderName?: string;
    baseUrl?: string;
    apiKey?: string;
    instanceName?: string;
  }): Promise<EvolutionAPIResponse> {
    const introText = buildDebtorPixChargeMessage({
      debtorName: input.debtorName,
      amountCents: input.amountCents,
      dueDate: input.dueDate,
      title: input.title,
      description: input.description,
      senderName: input.senderName,
      hasPixFollowUp: Boolean(input.pixCopiaECola?.trim()),
    });

    // 1. Enviar mensagem de apresentação e instruções
    const firstMsgResult = await this.sendTextMessage({
      number: input.debtorPhone,
      text: introText,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      instanceName: input.instanceName,
    });

    if (!firstMsgResult.success) {
      return firstMsgResult;
    }

    // 2. Se houver Pix Copia e Cola, enviar em mensagem isolada e limpa logo abaixo
    if (input.pixCopiaECola?.trim()) {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const pixMsgResult = await this.sendTextMessage({
        number: input.debtorPhone,
        text: input.pixCopiaECola.trim(),
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        instanceName: input.instanceName,
      });

      if (!pixMsgResult.success) {
        console.warn("Aviso: Mensagem de introdução enviada, mas falha ao enviar código Pix isolado:", pixMsgResult.error);
      }
    }

    return firstMsgResult;
  }
}

/**
 * Constrói a mensagem formatada de cobrança Pix humanizada para envio via WhatsApp ou cópia
 */
export function buildDebtorPixChargeMessage(input: {
  debtorName: string;
  amountCents: number;
  dueDate: string;
  pixCopiaECola?: string;
  title?: string;
  description?: string;
  senderName?: string;
  hasPixFollowUp?: boolean;
}): string {
  const valorFormatted = (input.amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const senderIntro = input.senderName?.trim()
    ? `Aqui é o *${input.senderName.trim()}*. `
    : "Aqui é do *NOVEX Finance*. ";

  const motivoSubject = input.title?.trim()
    ? `referente à cobrança sobre *${input.title.trim()}*`
    : "referente à cobrança da sua conta";

  const desc = input.description?.trim() ? `\n_Detalhes: ${input.description.trim()}_\n` : "";
  const signature = input.senderName?.trim() ? `*${input.senderName.trim()}*` : `*NOVEX Finance*`;

  let messageText = `Olá, *${input.debtorName}*! Tudo bem?\n\n${senderIntro}Estou entrando em contato ${motivoSubject}, no valor de *${valorFormatted}* com vencimento em *${input.dueDate}*.${desc}\n\n_Após realizar o pagamento no aplicativo do seu banco, o sistema reconhece a baixa automaticamente._\n\nAgradeço a atenção! — ${signature}`;

  if (input.hasPixFollowUp) {
    messageText += `\n\n👇 *Copie o código Pix na mensagem logo abaixo para pagar no app do seu banco:*`;
  } else if (input.pixCopiaECola) {
    messageText += `\n\n👇 *Chave Pix Copia e Cola:*\n\`\`\`${input.pixCopiaECola.trim()}\`\`\``;
  }

  return messageText;
}

export const evolutionAPIClient = new EvolutionAPIClient();

