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
} from "lucide-react";
import { changePassword } from "@/server/actions/user";
import {
  getMercadoPagoIntegrationStatus,
  saveMercadoPagoCredentials,
  validateMercadoPagoConnection,
  disconnectMercadoPagoIntegration,
  IntegrationStatusResult,
} from "@/server/actions/integrations";

export default function ConfiguracoesPage() {
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdStatus, setPwdStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Estados do Mercado Pago Sandbox
  const [mpStatus, setMpStatus] = useState<IntegrationStatusResult | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpTestLoading, setMpTestLoading] = useState(false);
  const [mpFeedback, setMpFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      const status = await getMercadoPagoIntegrationStatus();
      setMpStatus(status);
    } catch (e) {
      console.error("Erro ao carregar status do Mercado Pago:", e);
    }
  };

  const handleSaveWorkspace = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);

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
      const res = await changePassword({
        currentPassword,
        newPassword,
      });

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
      setMpFeedback({ type: "error", msg: "Por favor, digite o Access Token de Sandbox." });
      return;
    }

    setMpLoading(true);

    try {
      const res = await saveMercadoPagoCredentials({
        accessToken: tokenInput.trim(),
        environment: "SANDBOX",
      });

      if (res.success) {
        setMpFeedback({ type: "success", msg: "Credencial validada e salva com sucesso!" });
        setTokenInput(""); // Limpar o formulário imediatamente
        setShowToken(false);
        await loadIntegrationStatus();
      } else {
        setMpFeedback({ type: "error", msg: res.error || "Erro ao conectar credencial." });
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
        setMpFeedback({ type: "success", msg: "Conexão de Sandbox testada e validada com sucesso!" });
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Configurações do Sistema"
        description="Parâmetros do Workspace, alteração de senha e credenciais do Mercado Pago."
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
                defaultValue="Finanças pessoais"
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
            className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-5 py-2 font-semibold text-xs transition-colors shadow-sm glow-cyan-subtle cursor-pointer"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            <span>{saved ? "Alterações Salvas!" : "Salvar Workspace"}</span>
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
              <label className="font-semibold text-novex-text-secondary block mb-1">E-mail Cadastrado</label>
              <input
                type="email"
                disabled
                defaultValue="franklinjr18@hotmail.com"
                className="w-full rounded-lg border border-novex-border bg-novex-surface2 p-2.5 text-novex-text-muted cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-novex-text-secondary block mb-1">Nova Senha</label>
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
                <label className="font-semibold text-novex-text-secondary block mb-1">Confirmar Nova Senha</label>
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

        {/* Integração Mercado Pago — Marco 4 */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-novex-border pb-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-novex-text-primary">Integração Mercado Pago</h3>
                <span className="text-[11px] text-novex-text-muted">Ambiente: Sandbox (Testes SEGUROS)</span>
              </div>
            </div>

            {/* Badge de Status do Banco */}
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

          {/* Feedback de erro ou sucesso */}
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

          {/* Informações da Integração Conectada */}
          {mpStatus?.isConnected && (
            <div className="rounded-lg bg-novex-surface2 p-4 border border-novex-border/60 space-y-3 text-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <span className="text-novex-text-muted text-[11px] block uppercase font-semibold tracking-wider">
                    Credencial Ativa (Mascarada)
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

              {/* Botões de Ação para Conectados */}
              {mpStatus.canManage && (
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
              )}
            </div>
          )}

          {/* Formulário de Conexão / Substituição */}
          {mpStatus?.canManage && (
            <form onSubmit={handleConnectMercadoPago} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-novex-text-secondary block mb-1">
                  {mpStatus.isConnected ? "Substituir Access Token (Sandbox)" : "Novo Access Token (Sandbox)"}
                </label>

                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    required
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Cole seu Access Token de Sandbox do Mercado Pago..."
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
                    : mpStatus.isConnected
                    ? "Substituir Credencial"
                    : "Conectar Mercado Pago Sandbox"}
                </span>
              </button>
            </form>
          )}

          {/* Aviso sobre os próximos marcos */}
          <div className="p-3 rounded-lg bg-novex-surface2/60 border border-novex-border/40 text-[11px] text-novex-text-muted flex items-start gap-2.5">
            <Info className="h-4 w-4 text-novex-cyan shrink-0 mt-0.5" />
            <span>
              <strong>Nota Arquitetural:</strong> Neste Marco 4, apenas o token e a conectividade Sandbox são validados e salvos com criptografia autenticada. A criação de cobranças Pix via **Orders API** (Marco 5) e a importação de extrato completo via **Relatório Dinheiro em Conta** (Marco 6) serão ativadas nos próximos marcos.
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação para Desconectar */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-novex-surface1 border border-novex-border rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-novex-text-primary">Desconectar Mercado Pago?</h3>
            </div>

            <p className="text-xs text-novex-text-secondary">
              Esta ação removerá o Access Token criptografado do seu Workspace. Transações financeiras e registros de auditoria existentes <strong>NÃO</strong> serão apagados.
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
