"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  RefreshCw,
  QrCode as QrIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  ExternalLink,
  Phone,
  Edit2,
  CheckCheck,
} from "lucide-react";
import {
  getReceivablePixChargeStatus,
  generateReceivablePixCharge,
  sendManualReceivableWhatsAppReminder,
  PixChargeStatusResult,
} from "@/server/actions/pix-receivables";
import { updateContactPhoneByInstallment } from "@/server/actions/contacts";
import { buildDebtorPixChargeMessage } from "@/integrations/evolution-api/client";
import { formatCurrency } from "@/lib/formatters";

interface ReceivablePixChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  installmentId: string;
  amountCents: number;
  title: string;
  debtorName?: string;
  dueDate?: string;
  onSuccess?: () => void;
}

export function ReceivablePixChargeModal({
  isOpen,
  onClose,
  installmentId,
  amountCents,
  title,
  debtorName = "Devedor",
  dueDate,
  onSuccess,
}: ReceivablePixChargeModalProps) {
  const [chargeData, setChargeData] = useState<PixChargeStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de WhatsApp e Telefone
  const [phoneInput, setPhoneInput] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const [sendingBot, setSendingBot] = useState(false);
  const [botFeedback, setBotFeedback] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollDelayRef = useRef(5000); // 5s inicial

  useEffect(() => {
    if (isOpen && installmentId) {
      initCharge();
    } else {
      stopPolling();
      setBotFeedback(null);
      setIsEditingPhone(false);
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, installmentId]);

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  const initCharge = async () => {
    setLoading(true);
    setErrorMsg(null);
    stopPolling();

    try {
      const res = await generateReceivablePixCharge({ installmentId });
      if (res.success) {
        setChargeData(res);
        if (res.debtorPhone) {
          setPhoneInput(res.debtorPhone);
        }
        if (res.isPaid) {
          if (onSuccess) onSuccess();
        } else if (res.pixChargeId) {
          startPolling(res.pixChargeId);
        }
      } else {
        setErrorMsg(res.error || "Não foi possível gerar a cobrança Pix.");
      }
    } catch (e: any) {
      setErrorMsg("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (pixChargeId: string) => {
    try {
      setRefreshing(true);
      const res = await getReceivablePixChargeStatus({ pixChargeId });
      if (res.success) {
        setChargeData(res);
        if (res.debtorPhone && !phoneInput) {
          setPhoneInput(res.debtorPhone);
        }
        if (res.isPaid) {
          stopPolling();
          if (onSuccess) onSuccess();
        }
      }
    } catch (e) {
      console.error("Erro ao verificar status Pix:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const startPolling = (pixChargeId: string) => {
    stopPolling();

    const scheduleNext = () => {
      pollingTimerRef.current = setTimeout(async () => {
        if (document.visibilityState !== "hidden") {
          await checkStatus(pixChargeId);
        }
        pollDelayRef.current = Math.min(pollDelayRef.current + 3000, 12000);
        scheduleNext();
      }, pollDelayRef.current);
    };

    scheduleNext();
  };

  const handleCopyPix = () => {
    if (!chargeData?.qrCode) return;
    navigator.clipboard.writeText(chargeData.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Gerar o texto completo formatado da cobrança
  const activeDebtorName = chargeData?.debtorName || debtorName;
  const activeTitle = chargeData?.title || title;
  const activeDueDate =
    chargeData?.dueDate ||
    (dueDate ? new Date(dueDate).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR"));
  const activeSenderName = chargeData?.senderName || "Franklin Jr";
  const activeAmountCents = chargeData?.amountCents || amountCents;

  const formattedWhatsAppMessage = buildDebtorPixChargeMessage({
    debtorName: activeDebtorName,
    amountCents: activeAmountCents,
    dueDate: activeDueDate,
    pixCopiaECola: chargeData?.qrCode,
    title: activeTitle,
    description: chargeData?.description,
    senderName: activeSenderName,
  });

  // Telefone para link WhatsApp Web
  const cleanPhone = (phoneInput || chargeData?.debtorPhone || "").replace(/\D/g, "");
  const waPhone = cleanPhone
    ? cleanPhone.startsWith("55")
      ? cleanPhone
      : `55${cleanPhone}`
    : "";
  const waWebUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(formattedWhatsAppMessage)}`
    : null;

  const handleSavePhone = async () => {
    if (!phoneInput.trim()) return;
    setSavingPhone(true);
    try {
      const res = await updateContactPhoneByInstallment({
        installmentId,
        phone: phoneInput.trim(),
      });
      if (res.success) {
        setPhoneSaved(true);
        setIsEditingPhone(false);
        setTimeout(() => setPhoneSaved(false), 2500);
      }
    } catch (e) {
      console.error("Erro ao salvar telefone:", e);
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSendViaBot = async () => {
    setSendingBot(true);
    setBotFeedback(null);
    try {
      const res = await sendManualReceivableWhatsAppReminder({
        installmentId,
        pixChargeId: chargeData?.pixChargeId,
        phone: phoneInput.trim() || undefined,
      });

      if (res.success) {
        setBotFeedback({
          type: "success",
          text: `Mensagem disparada com sucesso para ${phoneInput || chargeData?.debtorPhone}!`,
        });
      } else {
        const isDisconnected =
          res.error?.includes("desconectado") ||
          res.error?.includes("open ausente") ||
          res.error?.includes("estado open");
        setBotFeedback({
          type: isDisconnected ? "warning" : "error",
          text: isDisconnected
            ? "O bot do WhatsApp está desconectado no servidor. Use o botão 'WhatsApp Web' ao lado para enviar em 1 clique pelo seu aplicativo!"
            : (res.error || "Falha no envio da cobrança pelo bot."),
        });
      }
    } catch (e: any) {
      setBotFeedback({
        type: "error",
        text: "Erro de comunicação ao enviar via bot.",
      });
    } finally {
      setSendingBot(false);
    }
  };

  const handleCopyFullMessage = () => {
    navigator.clipboard.writeText(formattedWhatsAppMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-novex-surface1 border border-novex-border rounded-2xl p-6 space-y-5 shadow-2xl relative">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-novex-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-novex-cyan/10 border border-novex-cyan/30 text-novex-cyan">
              <QrIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-novex-text-primary">Cobrar via Pix & WhatsApp</h3>
              <p className="text-xs text-novex-text-muted">
                Emissão Mercado Pago Orders com opções de envio manual e automático
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-novex-text-muted hover:text-novex-text-primary hover:bg-novex-surface2 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <span className="h-8 w-8 border-3 border-novex-cyan border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-novex-text-secondary">
              Gerando QR Code Pix do Mercado Pago...
            </span>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Falha na Cobrança</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        ) : chargeData?.isPaid ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-bounce">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-emerald-400">Pagamento Recebido!</h4>
              <p className="text-xs text-novex-text-secondary">
                A cobrança de <strong>{formatCurrency(activeAmountCents)}</strong> referente a{" "}
                <strong>{activeTitle}</strong> foi quitada e registrada no caixa.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-novex-bg font-bold text-xs transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cartão de Detalhes da Cobrança */}
            <div className="rounded-xl bg-novex-surface2 p-3.5 border border-novex-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-novex-text-muted uppercase font-bold tracking-wider block">
                  Devedor / Motivo
                </span>
                <span className="text-sm font-bold text-novex-text-primary block">{activeDebtorName}</span>
                <span className="text-xs text-emerald-400 font-semibold">{activeTitle}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-novex-text-muted uppercase font-bold tracking-wider block">
                  Valor a Receber
                </span>
                <span className="text-lg font-black text-novex-cyan tracking-tight block">
                  {formatCurrency(activeAmountCents)}
                </span>
              </div>
            </div>

            {/* QR Code Real Renderizado */}
            <div className="flex flex-col items-center justify-center p-3.5 bg-white/95 rounded-xl border border-novex-border shadow-inner">
              {chargeData?.qrCodeBase64 ? (
                <div className="p-1.5 bg-white rounded-lg flex flex-col items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL oficial não é recurso otimizável pelo next/image. */}
                  <img src={chargeData.qrCodeBase64} alt="QR Code Pix" className="w-40 h-40 object-contain" />
                  <span className="text-[10px] text-slate-600 font-mono font-bold">Escaneie no App do Banco</span>
                </div>
              ) : chargeData?.qrCode ? (
                <div className="p-2 bg-white rounded-lg flex flex-col items-center gap-2">
                  <svg className="w-40 h-40 opacity-20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="white" />
                    <rect x="5" y="5" width="30" height="30" fill="black" />
                    <rect x="10" y="10" width="20" height="20" fill="white" />
                    <rect x="15" y="15" width="10" height="10" fill="black" />
                    <rect x="65" y="5" width="30" height="30" fill="black" />
                    <rect x="5" y="65" width="30" height="30" fill="black" />
                  </svg>
                  <span className="text-[10px] text-amber-600 font-mono font-bold">
                    QR Code Visual Indisponível. Utilize o Pix Copia e Cola.
                  </span>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">QR Code indisponível</div>
              )}
            </div>

            {/* Pix Copia e Cola */}
            {chargeData?.qrCode && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-novex-text-secondary block">
                  Pix Copia e Cola
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={chargeData.qrCode}
                    className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 text-xs font-mono text-novex-text-muted focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyPix}
                    className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      copied
                        ? "bg-emerald-500 text-novex-bg shadow-sm"
                        : "bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg shadow-sm glow-cyan-subtle"
                    }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Seção Exclusiva: Cobrança Manual e Automática via WhatsApp */}
            <div className="rounded-xl bg-novex-surface2/50 border border-novex-border p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-novex-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-novex-text-primary flex items-center gap-1.5">
                      <span>Cobrança via WhatsApp</span>
                      <span className="text-[10px] text-emerald-400 font-normal bg-emerald-500/10 px-1.5 py-0.2 rounded">
                        Manual ou Bot
                      </span>
                    </h4>
                  </div>
                </div>

                {/* Telefone do Devedor (com Edição Rápida) */}
                <div className="flex items-center gap-1.5 text-xs">
                  {isEditingPhone ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="62992053928"
                        className="w-32 rounded border border-novex-cyan bg-novex-bg px-2 py-1 text-[11px] font-mono text-novex-text-primary focus:outline-none"
                      />
                      <button
                        onClick={handleSavePhone}
                        disabled={savingPhone}
                        className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-bold text-novex-bg hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {savingPhone ? "..." : "Salvar"}
                      </button>
                      <button
                        onClick={() => setIsEditingPhone(false)}
                        className="text-novex-text-muted hover:text-novex-text-primary text-[10px] px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-novex-text-muted" />
                      <span className="font-mono text-[11px] text-novex-text-secondary">
                        {phoneInput || chargeData?.debtorPhone || "Sem telefone"}
                      </span>
                      <button
                        onClick={() => setIsEditingPhone(true)}
                        className="p-1 text-novex-text-muted hover:text-novex-cyan transition-colors"
                        title="Editar telefone do devedor"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      {phoneSaved && (
                        <span className="text-[10px] text-emerald-400 font-bold">Salvo!</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Prévia da Mensagem Humanizada com Motivo */}
              <div className="rounded-lg bg-novex-bg/60 border border-novex-border/60 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-novex-text-muted uppercase">
                  <span>Mensagem Pronta para Envio</span>
                  <span className="text-emerald-400">Motivo: {activeTitle}</span>
                </div>
                <p className="text-[11px] text-novex-text-secondary leading-relaxed line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                  {formattedWhatsAppMessage}
                </p>
              </div>

              {/* Feedback de envio do bot */}
              {botFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    botFeedback.type === "success"
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                      : botFeedback.type === "warning"
                      ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                      : "bg-red-500/15 border border-red-500/30 text-red-300"
                  }`}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{botFeedback.text}</span>
                </div>
              )}

              {/* Botões de Ação de Cobrança Manual e Bot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {/* 1. Abrir no WhatsApp Web */}
                {waWebUrl ? (
                  <a
                    href={waWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all text-center cursor-pointer"
                    title="Abre o WhatsApp com a mensagem e Pix Copia e Cola já prontos"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>WhatsApp Web</span>
                  </a>
                ) : (
                  <button
                    onClick={() => setIsEditingPhone(true)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-700/60 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                    title="Informe o telefone para abrir no WhatsApp"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Digitar Telefone</span>
                  </button>
                )}

                {/* 2. Disparar via Bot */}
                <button
                  onClick={handleSendViaBot}
                  disabled={sendingBot}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-novex-surface1 hover:bg-novex-surface2 border border-novex-border text-novex-text-primary font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
                  title="Disparar mensagem pelo bot da Evolution API"
                >
                  <Send className={`h-3.5 w-3.5 text-emerald-400 ${sendingBot ? "animate-spin" : ""}`} />
                  <span>{sendingBot ? "Disparando..." : "Disparar Bot"}</span>
                </button>

                {/* 3. Copiar Mensagem Completa */}
                <button
                  onClick={handleCopyFullMessage}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-novex-surface1 hover:bg-novex-surface2 border border-novex-border text-novex-text-secondary hover:text-novex-text-primary font-bold text-xs transition-all cursor-pointer"
                  title="Copia o texto completo da cobrança para a área de transferência"
                >
                  {copiedMessage ? (
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedMessage ? "Copiado!" : "Copiar Texto"}</span>
                </button>
              </div>
            </div>

            {/* Rodapé de Status e Polling */}
            <div className="pt-2 border-t border-novex-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <Clock className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-[11px]">Aguardando pagamento pelo devedor...</span>
              </div>

              <button
                onClick={() => chargeData?.pixChargeId && checkStatus(chargeData.pixChargeId)}
                disabled={refreshing}
                className="flex items-center justify-center gap-2 rounded-lg bg-novex-surface2 hover:bg-novex-surface1 border border-novex-border px-3.5 py-1.5 text-novex-text-primary text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-novex-cyan" : ""}`} />
                <span>{refreshing ? "Verificando..." : "Atualizar Status"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

