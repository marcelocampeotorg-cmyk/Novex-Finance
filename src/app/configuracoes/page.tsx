"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Settings, ShieldCheck, Key, Check, Lock, AlertCircle } from "lucide-react";
import { MOCK_BALANCE_SUMMARY } from "@/mocks/financial-data";
import { changePassword } from "@/server/actions/user";

export default function ConfiguracoesPage() {
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdStatus, setPwdStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Configurações do Sistema"
        description="Parâmetros do Workspace, alteração de senha e regras de segurança."
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
            className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-5 py-2 font-semibold text-xs transition-colors shadow-sm glow-cyan-subtle"
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
              className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-5 py-2.5 font-semibold text-xs transition-colors shadow-sm glow-cyan-subtle disabled:opacity-50"
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

        {/* Integração Mercado Pago */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-novex-border pb-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-novex-text-primary">Integração Mercado Pago</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
              <div>
                <span className="font-bold text-novex-text-primary block">{MOCK_BALANCE_SUMMARY.accountDisplayName}</span>
                <span className="text-[10px] text-novex-text-muted">Status: Conectado • Autenticação via Token de Produção</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
                Ativo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
