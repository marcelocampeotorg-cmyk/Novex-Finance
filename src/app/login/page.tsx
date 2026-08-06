"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Lock, Mail, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res.error) {
        setErrorMsg("Credenciais inválidas. Verifique seu e-mail e senha.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg("Não foi possível realizar o login. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Glow de fundo ciano */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00E5FF]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#12172B] border border-[#2A354D] rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Logo Oficial */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-48 h-12 mb-3">
            <Image
              src="/brand/novex_logo_horizontal_original.png"
              alt="NOVEX Finance"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-slate-400 text-sm font-medium text-center">
            Gestão Financeira Pessoal &amp; Fluxo de Caixa
          </p>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-100 tracking-wide mb-1">
            Acesse sua conta
          </h1>
          <p className="text-xs text-slate-400">
            Digite suas credenciais para acessar seu cofre financeiro.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                aria-label="E-mail de acesso"
                className="w-full bg-[#1E2638] border border-[#2A354D] rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00E5FF] transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Senha
              </label>
              <button
                type="button"
                disabled
                className="text-xs text-slate-500 cursor-not-allowed hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Senha de acesso"
                className="w-full bg-[#1E2638] border border-[#2A354D] rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00E5FF] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0E14] font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-[#00E5FF]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-[#0B0E14] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar no Painel</span>
              </>
            )}
          </button>
        </form>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 pt-4 border-t border-[#2A354D]/60 text-center">
            <p className="text-[11px] text-slate-500">
              Ambiente Local / Dev — Seed Disponível
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
