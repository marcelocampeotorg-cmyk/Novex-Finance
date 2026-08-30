"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Settings,
  ShieldCheck,
  Key,
  Check,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Power,
  Info,
  MessageSquare,
  QrCode,
  Send,
  Sliders,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { changePassword } from "@/server/actions/user";
import { updateWorkspaceName, getWorkspaceName } from "@/server/actions/workspace";
import {
  getMercadoPagoIntegrationStatus,
  saveMercadoPagoCredentials,
  validateMercadoPagoConnection,
  disconnectMercadoPagoIntegration,
  getEvolutionApiStatus,
  saveEvolutionApiCredentials,
  IntegrationStatusResult,
} from "@/server/actions/integrations";
import {
  checkEvolutionConnectionState,
  fetchEvolutionQRCode,
  sendNeutralWhatsAppTest,
} from "@/server/actions/notifications";

export default function ConfiguracoesPage() {
  const [saved, setSaved] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdStatus, setPwdStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Mercado Pago States (Public Key + Access Token + Ambiente)
  const [mpStatus, setMpStatus] = useState<IntegrationStatusResult | null>(null);
  const [publicKeyInput, setPublicKeyInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [mpEnvInput, setMpEnvInput] = useState<"PRODUCTION" | "SANDBOX">("PRODUCTION");
  const [showToken, setShowToken] = useState(false);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpTestLoading, setMpTestLoading] = useState(false);
  const [mpFeedback, setMpFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // WhatsApp / Evolution API States (Desacoplado & Simplificado)
  const [showAdvancedEvo, setShowAdvancedEvo] = useState(false);
  const [evoUrl, setEvoUrl] = useState("http://localhost:8081");
  const [evoApiKey, setEvoApiKey] = useState("");
  const [evoInstance, setEvoInstance] = useState("novex-finance");
  const [waConnected, setWaConnected] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waFeedback, setWaFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      const wks = await getWorkspaceName();
      if (wks.success) setWorkspaceName(wks.name);

      const status = await getMercadoPagoIntegrationStatus();
      setMpStatus(status);
      if (status?.publicKey) {
        setPublicKeyInput(status.publicKey);
      }
      if (status?.environment) {
        setMpEnvInput(status.environment as "PRODUCTION" | "SANDBOX");
      }

      const evo = await getEvolutionApiStatus();
      if (evo.baseUrl) setEvoUrl(evo.baseUrl);
      setEvoApiKey("");
      if (evo.instanceName) setEvoInstance(evo.instanceName);
    } catch (e) {
      console.error("Erro ao carregar status:", e);
    }
  };

  const handleSaveWorkspace = async () => {
    setWorkspaceLoading(true);
    try {
      const res = await updateWorkspaceName({ name: workspaceName });
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert(res.error || "Erro ao salvar workspace");
      }
    } catch (e) {
      alert("Erro ao salvar workspace");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);

    if (!currentPassword) {
      setPwdStatus({ type: "error", msg: "Informe a sua senha atual." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdStatus({ type: "error", msg: "A confirmação de senha não confere." });
      return;
    }

    if (newPassword.length < 6) {
      setPwdStatus({ type: "error", msg: "A nova senha deve possuir pelo menos 6 caracteres." });
      return;
    }

    setPwdLoading(true);

    try {
      const res = await changePassword({ currentPassword, newPassword });
      if (res.success) {
        setPwdStatus({ type: "success", msg: "Sua senha foi alterada com sucesso!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwdStatus({ type: "error", msg: res.error || "Erro ao alterar a senha." });
      }
    } catch (err: any) {
      setPwdStatus({ type: "error", msg: "Erro ao comunicar com o servidor." });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleConnectMercadoPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setMpFeedback(null);

    if (!tokenInput.trim()) {
      setMpFeedback({ type: "error", msg: "Informe seu Access Token do Mercado Pago; o ambiente será detectado no servidor." });
      return;
    }

    setMpLoading(true);

    try {
      const res = await saveMercadoPagoCredentials({
        accessToken: tokenInput.trim(),
        publicKey: publicKeyInput.trim(),
        environment: mpEnvInput,
      });

      if (res.success) {
        setMpFeedback({ type: "success", msg: "Credenciais do Mercado Pago salvas e validadas com sucesso!" });
        setTokenInput("");
        setShowToken(false);
        await loadIntegrationStatus();
      } else {
        setMpFeedback({ type: "error", msg: res.error || "Erro ao conectar credenciais." });
      }
    } catch (err: any) {
      setMpFeedback({ type: "error", msg: "Erro ao comunicar com o servidor." });
    } finally {
      setMpLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setMpFeedback(null);
    setMpTestLoading(true);

    try {
      const res = await validateMercadoPagoConnection();
      if (res.success) {
        const envLabel = mpStatus?.environment === "PRODUCTION" ? "Produção" : "Sandbox";
        setMpFeedback({ type: "success", msg: `Conexão de ${envLabel} testada e validada com sucesso!` });
      } else {
        setMpFeedback({ type: "error", msg: res.errorMessage || "Falha ao testar a conexão com o Mercado Pago." });
      }
      await loadIntegrationStatus();
    } catch (err: any) {
      setMpFeedback({ type: "error", msg: "Erro ao testar a conexão." });
    } finally {
      setMpTestLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setMpFeedback(null);
    setShowDisconnectModal(false);
    setMpLoading(true);

    try {
      const res = await disconnectMercadoPagoIntegration();
      if (res.success) {
        setMpFeedback({ type: "success", msg: "Integração desconectada com sucesso." });
        setPublicKeyInput("");
        await loadIntegrationStatus();
      } else {
        setMpFeedback({ type: "error", msg: res.error || "Erro ao desconectar." });
      }
    } catch (err: any) {
      setMpFeedback({ type: "error", msg: "Erro ao comunicar com o servidor." });
    } finally {
      setMpLoading(false);
    }
  };

  // WhatsApp Evolution API Actions
  const handleCheckWhatsAppStatus = async () => {
    setWaLoading(true);
    setWaFeedback(null);
    try {
      const res = await checkEvolutionConnectionState();

      if (res.success && res.state === "open") {
        setWaConnected(true);
        setQrCodeBase64(null);
        setWaFeedback({ type: "success", msg: "WhatsApp Conectado com sucesso!" });
      } else {
        setWaConnected(false);
        setWaFeedback({ type: "error", msg: res.error || "Instância do WhatsApp não está conectada no momento." });
      }
    } catch (err: any) {
      setWaConnected(false);
      setWaFeedback({ type: "error", msg: "Erro ao consultar estado da instância." });
    } finally {
      setWaLoading(false);
    }
  };

  const handleFetchQRCode = async () => {
    setWaLoading(true);
    setWaFeedback(null);

    try {
      const res = await fetchEvolutionQRCode();

      if (res.success && "base64" in res && res.base64) {
        setQrCodeBase64(res.base64);
        setWaFeedback({ type: "success", msg: "QR Code gerado! Escaneie no quadro ao lado com seu celular." });
      } else {
        setWaFeedback({ type: "error", msg: res.error || "Aguardando inicialização da instância WhatsApp." });
      }
    } catch (err: any) {
      setWaFeedback({ type: "error", msg: "Erro de comunicação ao buscar QR Code." });
    } finally {
      setWaLoading(false);
    }
  };

  const handleSaveEvoCredentials = async () => {
    setWaLoading(true);
    setWaFeedback(null);
    try {
      const res = await saveEvolutionApiCredentials({
        baseUrl: evoUrl,
        apiKey: evoApiKey,
        instanceName: evoInstance,
      });
      if (res.success) {
        setWaFeedback({ type: "success", msg: "Credenciais do WhatsApp salvas no banco com sucesso!" });
      } else {
        setWaFeedback({ type: "error", msg: res.error || "Erro ao salvar configurações do WhatsApp." });
      }
    } catch (err: any) {
      setWaFeedback({ type: "error", msg: "Erro ao salvar." });
    } finally {
      setWaLoading(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    if (!testPhone.trim()) {
      setWaFeedback({ type: "error", msg: "Informe um número de telefone com DDD para teste." });
      return;
    }

    setWaLoading(true);
    setWaFeedback(null);

    try {
      const res = await sendNeutralWhatsAppTest({ phone: testPhone });

      if (res.success) {
        setWaFeedback({ type: "success", msg: `Mensagem de teste enviada com sucesso para ${testPhone}!` });
      } else {
        setWaFeedback({ type: "error", msg: res.error || "Falha ao enviar mensagem de teste via Evolution API." });
      }
    } catch (err: any) {
      setWaFeedback({ type: "error", msg: "Erro de comunicação ao disparar WhatsApp." });
    } finally {
      setWaLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Configurações do Sistema"
        description="Parâmetros do Workspace, alteração de senha, credenciais Mercado Pago e WhatsApp."
      />

      <div className="max-w-3xl space-y-6">
        {/* Workspace */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-novex-border pb-3">
            <Settings className="h-5 w-5 text-novex-cyan" />
            <h3 className="text-base font-bold text-novex-text-primary">Dados do Workspace</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Nome do Workspace</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Fuso Horário Padrão</label>
              <input
                type="text"
                disabled
                defaultValue="America/Sao_Paulo (UTC-3)"
                className="w-full rounded-lg border border-novex-border bg-novex-surface2 p-2.5 text-novex-text-muted cursor-not-allowed"
              />
            </div>
          </div>

          <button
            onClick={handleSaveWorkspace}
            disabled={workspaceLoading}
            className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-5 py-2 font-semibold text-xs transition-colors shadow-sm glow-cyan-subtle cursor-pointer disabled:opacity-50"
          >
            {workspaceLoading ? <span className="animate-spin block w-4 h-4 border-2 border-novex-bg border-t-transparent rounded-full" /> : saved ? <Check className="h-4 w-4" /> : null}
            <span>{saved ? "Alterações Salvas!" : workspaceLoading ? "Salvando..." : "Salvar Workspace"}</span>
          </button>
        </div>

        {/* Alterar Senha */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-novex-border pb-3">
            <Lock className="h-5 w-5 text-novex-cyan" />
            <h3 className="text-base font-bold text-novex-text-primary">Segurança &amp; Alteração de Senha</h3>
          </div>

          {pwdStatus && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                pwdStatus.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {pwdStatus.type === "success" ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{pwdStatus.msg}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Senha Atual *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual..."
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-novex-text-secondary block mb-1">Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-novex-text-secondary block mb-1">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-5 py-2.5 font-semibold text-xs transition-colors shadow-sm glow-cyan-subtle disabled:opacity-50 cursor-pointer"
            >
              {pwdLoading ? (
                <span className="inline-block h-4 w-4 border-2 border-novex-bg border-t-transparent rounded-full animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              <span>{pwdLoading ? "Atualizando..." : "Alterar Senha de Acesso"}</span>
            </button>
          </form>
        </div>

        {/* Integração Mercado Pago (Public Key + Access Token) */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-novex-border pb-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-novex-text-primary">Integração Mercado Pago</h3>
                <span className="text-[11px] text-novex-text-muted">Credenciais do Desenvolvedor ({mpStatus?.environment === "PRODUCTION" ? "Produção" : "Sandbox"})</span>
              </div>
            </div>

            <div>
              {mpStatus?.isConnected ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
              ) : mpStatus?.status === "ERROR" ? (
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-semibold text-xs flex items-center gap-1.5 border border-red-500/30">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Erro de Conexão
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-400 font-semibold text-xs flex items-center gap-1.5 border border-slate-500/30">
                  Não Conectado
                </span>
              )}
            </div>
          </div>

          {mpFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                mpFeedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {mpFeedback.type === "success" ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{mpFeedback.msg}</span>
            </div>
          )}

          {/* Informações se Conectado */}
          {mpStatus?.isConnected && (
            <div className="rounded-lg bg-novex-surface2 p-4 border border-novex-border/60 space-y-3 text-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <span className="text-novex-text-muted text-[11px] block uppercase font-semibold tracking-wider">
                    Access Token Ativo (Mascarado)
                  </span>
                  <span className="font-mono font-bold text-novex-cyan text-sm tracking-widest">
                    {mpStatus.maskedToken || "••••••••••••"}
                  </span>
                </div>

                {mpStatus.lastValidatedAt && (
                  <div className="text-right">
                    <span className="text-novex-text-muted text-[10px] block">Última Validação Remota</span>
                    <span className="text-novex-text-secondary font-medium text-[11px]">
                      {new Date(mpStatus.lastValidatedAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={mpTestLoading}
                  className="flex items-center gap-2 rounded-lg bg-novex-surface1 border border-novex-border px-3.5 py-1.5 text-xs font-semibold text-novex-text-primary hover:border-novex-cyan hover:text-novex-cyan transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${mpTestLoading ? "animate-spin text-novex-cyan" : ""}`} />
                  <span>{mpTestLoading ? "Testando..." : "Testar Conexão"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDisconnectModal(true)}
                  disabled={mpLoading}
                  className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>Desconectar Integração</span>
                </button>
              </div>
            </div>
          )}

          {/* Formulário de Conexão com Public Key e Access Token */}
          <form onSubmit={handleConnectMercadoPago} className="space-y-4 text-xs pt-2">
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">
                Ambiente da Conta *
              </label>
              <select
                value={mpEnvInput}
                onChange={(e) => setMpEnvInput(e.target.value as "PRODUCTION" | "SANDBOX")}
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              >
                <option value="PRODUCTION">Produção (Conta Real)</option>
                <option value="SANDBOX">Sandbox (Conta de Testes)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">
                Public Key (Chave Pública)
              </label>
              <input
                type="text"
                value={publicKeyInput}
                onChange={(e) => setPublicKeyInput(e.target.value)}
                placeholder="APP_USR-c5511c56-3ddc-425e-80fb-..."
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary font-mono focus:border-novex-cyan focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">
                Access Token *
              </label>

              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="APP_USR-..."
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 pr-10 text-novex-text-primary font-mono focus:border-novex-cyan focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-novex-text-muted hover:text-novex-text-primary transition-colors cursor-pointer"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <span className="text-[10px] text-novex-text-muted mt-1.5 block">
                🔒 Criptografado com **AES-256-GCM** no servidor. Validação em tempo real via `https://api.mercadolibre.com/users/me`.
              </span>
            </div>

            <button
              type="submit"
              disabled={mpLoading || !tokenInput.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-5 py-2.5 font-semibold text-xs transition-colors shadow-sm glow-cyan-subtle disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {mpLoading ? (
                <span className="inline-block h-4 w-4 border-2 border-novex-bg border-t-transparent rounded-full animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              <span>
                {mpLoading
                  ? "Validando e Criptografando..."
                  : mpStatus?.isConnected
                  ? "Substituir Credenciais Mercado Pago"
                  : "Salvar e Conectar Mercado Pago"}
              </span>
            </button>
          </form>
        </div>

        {/* Integração WhatsApp via Evolution API (Interface Direta & QR Code Instantâneo) */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-novex-border pb-3">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-novex-text-primary">Conexão WhatsApp (Evolution API)</h3>
                <span className="text-[11px] text-novex-text-muted">Disparo de lembretes e cobranças Pix para devedores</span>
              </div>
            </div>

            <div>
              {waConnected ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-400 font-semibold text-xs flex items-center gap-1.5 border border-slate-500/30">
                  Desconectado
                </span>
              )}
            </div>
          </div>

          {waFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                waFeedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {waFeedback.type === "success" ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{waFeedback.msg}</span>
            </div>
          )}

          {/* Painel do WhatsApp Simplificado para o Usuário Final */}
          <div className="space-y-4 text-xs">
            <p className="text-novex-text-secondary text-xs">
              Clique em <strong>&quot;Gerar QR Code de Conexão&quot;</strong> e escaneie o código com seu aplicativo do WhatsApp no celular (em <em>Dispositivos Conectados &gt; Conectar um aparelho</em>).
            </p>

            {/* Layout Flex: Ações + QR Code no Canto */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pt-2 border-t border-novex-border/60">
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFetchQRCode}
                    disabled={waLoading}
                    className="flex items-center gap-2 rounded-xl bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold px-4 py-2.5 text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>{waLoading ? "Gerando QR Code..." : "Gerar QR Code de Conexão"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckWhatsAppStatus}
                    disabled={waLoading}
                    className="flex items-center gap-2 rounded-xl bg-novex-surface2 hover:bg-novex-border text-novex-text-primary font-semibold px-4 py-2.5 text-xs border border-novex-border transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${waLoading ? "animate-spin" : ""}`} />
                    <span>Verificar Conexão</span>
                  </button>
                </div>

                {/* Seção de Teste de Disparo Real */}
                <div className="pt-3 space-y-2">
                  <span className="font-semibold text-novex-text-primary block">Testar Disparo de Mensagem</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="DDD + Número (ex: 5511999999999)"
                      className="rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary font-mono focus:border-novex-cyan focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendTestWhatsApp}
                      disabled={waLoading || !testPhone.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 text-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{waLoading ? "Disparando..." : "Enviar Mensagem Teste"}</span>
                    </button>
                  </div>
                </div>

                {/* Sanfonado de Configurações Avançadas (Opcional) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedEvo(!showAdvancedEvo)}
                    className="flex items-center gap-1.5 text-[11px] text-novex-text-muted hover:text-novex-cyan transition-colors"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    <span>{showAdvancedEvo ? "Ocultar Parâmetros Avançados" : "Configurações Avançadas do Servidor"}</span>
                  </button>

                  {showAdvancedEvo && (
                    <div className="mt-3 p-3 rounded-lg bg-novex-surface2/60 border border-novex-border/60 space-y-3 animate-in fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-novex-text-secondary block mb-1">URL da API</label>
                          <input
                            type="text"
                            value={evoUrl}
                            onChange={(e) => setEvoUrl(e.target.value)}
                            placeholder="https://api.evolution-api.com"
                            className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 text-novex-text-primary font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-novex-text-secondary block mb-1">Instância</label>
                          <input
                            type="text"
                            value={evoInstance}
                            onChange={(e) => setEvoInstance(e.target.value)}
                            placeholder="novex-finance"
                            className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 text-novex-text-primary font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="font-semibold text-novex-text-secondary block mb-1">API Key Personalizada</label>
                        <input
                          type="password"
                          value={evoApiKey}
                          onChange={(e) => setEvoApiKey(e.target.value)}
                          placeholder="Deixe vazio para preservar a chave atual"
                          className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 text-novex-text-primary font-mono"
                        />
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleSaveEvoCredentials}
                          disabled={waLoading}
                          className="flex items-center justify-center gap-2 w-full rounded-lg bg-novex-cyan text-novex-bg font-semibold px-4 py-2.5 text-xs transition-all cursor-pointer hover:bg-novex-cyan/90 disabled:opacity-50"
                        >
                          {waLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Salvar Configurações no Banco
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quadro do QR Code no Canto Superior Direito do Card */}
              {qrCodeBase64 && (
                <div className="rounded-xl border-2 border-novex-cyan/60 bg-white p-3 text-center space-y-2 shrink-0 self-center md:self-start shadow-lg">
                  <span className="text-[10px] font-bold text-slate-800 uppercase block">Escaneie no WhatsApp</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
                    alt="QR Code WhatsApp Evolution API"
                    className="w-36 h-36 mx-auto rounded border border-slate-200"
                  />
                  <span className="text-[9px] text-slate-500 block">Dispositivos Conectados &gt; Conectar</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação para Desconectar Mercado Pago */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-novex-surface1 border border-novex-border rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-novex-text-primary">Desconectar Mercado Pago?</h3>
            </div>

            <p className="text-xs text-novex-text-secondary">
              Esta ação removerá as credenciais do Mercado Pago do seu Workspace. Transações financeiras e registros de auditoria existentes <strong>NÃO</strong> serão apagados.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                className="px-4 py-2 rounded-lg border border-novex-border text-xs font-semibold text-novex-text-secondary hover:bg-novex-surface2 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={mpLoading}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Sim, Desconectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
