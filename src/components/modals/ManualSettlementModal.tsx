"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Banknote,
  Smartphone,
  Building2,
  FileText,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { settleInstallmentManually } from "@/server/actions/manual-settlement";
import { notifyStoreChange } from "@/services/financial-store";

export type PaymentMethodType = "CASH" | "PIX_MANUAL" | "BANK_TRANSFER" | "OTHER";

interface ManualSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  installment: {
    id: string;
    sequence: number;
    totalSequences?: number;
    amountCents: number;
    settledAmountCents?: number;
    dueDate: string;
  } | null;
  itemTitle: string;
  contactName?: string;
  direction: "RECEIVABLE" | "PAYABLE";
}

export function ManualSettlementModal({
  isOpen,
  onClose,
  onSuccess,
  installment,
  itemTitle,
  contactName,
  direction,
}: ManualSettlementModalProps) {
  const isReceivable = direction === "RECEIVABLE";

  const remainingCents = installment
    ? installment.amountCents - (installment.settledAmountCents || 0)
    : 0;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
  const [settlementDate, setSettlementDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  );
  const [amountStr, setAmountStr] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && installment) {
      const remaining = installment.amountCents - (installment.settledAmountCents || 0);
      setAmountStr((remaining / 100).toFixed(2).replace(".", ","));
      setSettlementDate(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
      setPaymentMethod("CASH");
      setNotes("");
      setErrorMessage(null);
    }
  }, [isOpen, installment]);

  if (!isOpen || !installment) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (!val) {
      setAmountStr("0,00");
      return;
    }
    const num = parseInt(val, 10) / 100;
    setAmountStr(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const parsedAmountCents = Math.round(
    Number(amountStr.replace(/\./g, "").replace(",", ".")) * 100
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmountCents <= 0) {
      setErrorMessage("Informe um valor válido maior que zero.");
      return;
    }

    if (parsedAmountCents > remainingCents) {
      setErrorMessage(
        `O valor informado não pode ser maior que o saldo restante da parcela (${formatCurrency(remainingCents)}).`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await settleInstallmentManually({
        installmentId: installment.id,
        amountCents: parsedAmountCents,
        settlementDate,
        paymentMethod,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        notifyStoreChange();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || "Erro ao registrar liquidação manual.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Falha de comunicação com o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const methodOptions: {
    key: PaymentMethodType;
    label: string;
    icon: React.ElementType;
    desc: string;
  }[] = [
    {
      key: "CASH",
      label: "Cédula / Dinheiro",
      icon: Banknote,
      desc: "Pago ou recebido em espécie",
    },
    {
      key: "PIX_MANUAL",
      label: "Pix por fora",
      icon: Smartphone,
      desc: "Pix direto sem chave do sistema",
    },
    {
      key: "BANK_TRANSFER",
      label: "Transferência / TED",
      icon: Building2,
      desc: "Depósito ou conta bancária",
    },
    {
      key: "OTHER",
      label: "Outro meio",
      icon: FileText,
      desc: "Acerto direto ou permuta",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-novex-border bg-novex-surface1 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-novex-border p-5 bg-novex-surface2/50">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isReceivable
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-novex-cyan/15 border-novex-cyan/30 text-novex-cyan"
              }`}
            >
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-novex-text-primary">
                  {isReceivable ? "Registrar Recebimento Manual" : "Registrar Pagamento Manual"}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isReceivable
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-novex-cyan/20 text-novex-cyan"
                  }`}
                >
                  {isReceivable ? "Entrada" : "Saída"}
                </span>
              </div>
              <p className="text-xs text-novex-text-muted mt-0.5">
                {isReceivable
                  ? "Baixa a conta e credita o valor na Conta Geral (livro-caixa)."
                  : "Baixa a obrigação e debita o valor na Conta Geral."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-novex-text-muted hover:text-novex-text-primary hover:bg-novex-surface2 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo da Parcela */}
        <div className="p-5 border-b border-novex-border/60 bg-novex-surface2/20">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold text-novex-text-muted uppercase tracking-wider block">
                {isReceivable ? "Devedor / Conta" : "Favorecido / Conta"}
              </span>
              <h3 className="text-sm font-bold text-novex-text-primary mt-0.5">{itemTitle}</h3>
              {contactName && (
                <span className="text-xs text-novex-text-secondary mt-0.5 block">
                  {contactName}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] text-novex-text-muted block">
                Parcela {installment.sequence}
                {installment.totalSequences ? `/${installment.totalSequences}` : ""}
              </span>
              <span
                className={`text-base font-bold ${
                  isReceivable ? "text-emerald-400" : "text-novex-cyan"
                }`}
              >
                {formatCurrency(remainingCents)}
              </span>
              <span className="text-[10px] text-novex-text-muted block">
                Vencimento: {formatDate(installment.dueDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Seleção do Método */}
          <div>
            <label className="text-xs font-semibold text-novex-text-secondary block mb-2">
              Forma de Liquidação / Pagamento:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {methodOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = paymentMethod === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPaymentMethod(opt.key)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? isReceivable
                          ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                          : "border-novex-cyan bg-novex-cyan/10 shadow-sm"
                        : "border-novex-border bg-novex-surface2/40 hover:bg-novex-surface2 text-novex-text-muted"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        isSelected
                          ? isReceivable
                            ? "text-emerald-400"
                            : "text-novex-cyan"
                          : "text-novex-text-muted"
                      }`}
                    />
                    <div>
                      <span
                        className={`text-xs font-bold block ${
                          isSelected ? "text-novex-text-primary" : "text-novex-text-secondary"
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-novex-text-muted block">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campos de Data e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-novex-text-secondary block mb-1">
                Data da Baixa:
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-novex-text-muted pointer-events-none" />
                <input
                  type="date"
                  value={settlementDate}
                  onChange={(e) => setSettlementDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-novex-border bg-novex-bg py-2 pl-9 pr-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-novex-text-secondary block mb-1">
                Valor Recebido / Pago (R$):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-novex-text-muted pointer-events-none">
                  R$
                </span>
                <input
                  type="text"
                  value={amountStr}
                  onChange={handleAmountChange}
                  required
                  className={`w-full rounded-xl border border-novex-border bg-novex-bg py-2 pl-9 pr-3 text-xs font-bold text-novex-text-primary focus:outline-none ${
                    isReceivable ? "focus:border-emerald-500" : "focus:border-novex-cyan"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-semibold text-novex-text-secondary block mb-1">
              Observações (opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isReceivable
                  ? "Ex: Recebido em cédula em mãos pelo devedor"
                  : "Ex: Pago em dinheiro / cédula"
              }
              className="w-full rounded-xl border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
            />
          </div>

          {/* Rodapé / Ações */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-novex-text-muted hover:text-novex-text-primary transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-all shadow-md cursor-pointer ${
                isReceivable
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/30"
                  : "bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg shadow-cyan-950/30 font-extrabold"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gravando Baixa...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {isReceivable ? "Confirmar Entrada" : "Confirmar Saída"} (R$ {amountStr})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
