"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, QrCode, Info, CheckCircle2 } from "lucide-react";


import { AlertCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const newAccountSchema = z.object({
  direction: z.enum(["PAYABLE", "RECEIVABLE"]),
  kind: z.enum(["ONE_TIME", "INSTALLMENT_PLAN", "RECURRING"]),
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  contactName: z.string().min(2, "Digite o nome do contato ou favorecido"),
  category: z.string().min(1, "Selecione uma categoria"),
  totalAmount: z.coerce.number().min(0.01, "Informe um valor maior que R$ 0,00"),
  startDate: z.string().min(1, "Selecione a data de vencimento ou início"),
  installmentsCount: z.coerce.number().min(1).max(60).default(1),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]).optional(),
  pixKey: z.string().optional(),
  pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]).optional(),
});

type NewAccountFormData = z.infer<typeof newAccountSchema>;

import { FinancialItemDTO } from "@/types";

interface NewAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: FinancialItemDTO | null;
  defaultDirection?: "PAYABLE" | "RECEIVABLE";
  lockDirection?: boolean;
}

export const NewAccountModal: React.FC<NewAccountModalProps> = ({
  isOpen,
  onClose,
  editItem,
  defaultDirection = "PAYABLE",
  lockDirection = false,
}) => {
  const [installmentsList, setInstallmentsList] = useState<
    { sequence: number; amount: number; dueDate: string }[]
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<NewAccountFormData>({
    resolver: zodResolver(newAccountSchema),
    defaultValues: {
      direction: defaultDirection,
      kind: "ONE_TIME",
      title: "",
      description: "",
      contactName: "",
      category: defaultDirection === "RECEIVABLE" ? "Serviços Prestados" : "Moradia",
      totalAmount: 0,
      startDate: new Date().toISOString().split("T")[0],
      installmentsCount: 1,
      frequency: "MONTHLY",
      pixKey: "",
      pixKeyType: "EMAIL",
    },
  });

  const direction = watch("direction");
  const kind = watch("kind");
  const totalAmount = watch("totalAmount");
  const startDate = watch("startDate");
  const installmentsCount = watch("installmentsCount");
  const frequency = watch("frequency");

  React.useEffect(() => {
    if (isOpen) {
      setSuccessMessage(null);
      setFormErrorMessage(null);
      if (editItem) {
        reset({
          direction: editItem.direction,
          kind: editItem.kind,
          title: editItem.title,
          description: editItem.description || "",
          contactName: editItem.contact?.name || "",
          category: editItem.category || (editItem.direction === "RECEIVABLE" ? "Serviços Prestados" : "Moradia"),
          totalAmount: editItem.totalAmountCents / 100,
          startDate: editItem.startDate ? editItem.startDate.split("T")[0] : new Date().toISOString().split("T")[0],
          installmentsCount: editItem.installments?.length || 1,
          frequency: "MONTHLY",
          pixKey: editItem.pixKey || "",
          pixKeyType: (editItem.contact?.pixKeys?.[0]?.type as any) || "EMAIL",
        });

        if (editItem.installments && editItem.installments.length > 0) {
          setInstallmentsList(
            editItem.installments.map((inst) => ({
              sequence: inst.sequence,
              amount: inst.amountCents / 100,
              dueDate: inst.dueDate ? inst.dueDate.split("T")[0] : new Date().toISOString().split("T")[0],
            }))
          );
        }
      } else {
        reset({
          direction: defaultDirection,
          kind: "ONE_TIME",
          title: "",
          description: "",
          contactName: "",
          category: defaultDirection === "RECEIVABLE" ? "Serviços Prestados" : "Moradia",
          totalAmount: 0,
          startDate: new Date().toISOString().split("T")[0],
          installmentsCount: 1,
          frequency: "MONTHLY",
          pixKey: "",
          pixKeyType: "EMAIL",
        });
        setInstallmentsList([]);
      }
    }
  }, [isOpen, editItem, defaultDirection, reset]);

  React.useEffect(() => {
    if (!editItem && kind === "INSTALLMENT_PLAN" && totalAmount > 0 && installmentsCount > 0) {
      const perInstallment = Number((totalAmount / installmentsCount).toFixed(2));
      const list = [];
      const baseDate = startDate ? new Date(startDate) : new Date();

      for (let i = 0; i < installmentsCount; i++) {
        const d = new Date(baseDate);
        if (frequency === "DAILY") {
          d.setDate(d.getDate() + i);
        } else if (frequency === "WEEKLY") {
          d.setDate(d.getDate() + (i * 7));
        } else if (frequency === "BIWEEKLY") {
          d.setDate(d.getDate() + (i * 14));
        } else if (frequency === "YEARLY") {
          d.setFullYear(d.getFullYear() + i);
        } else {
          d.setMonth(d.getMonth() + i);
        }
        
        list.push({
          sequence: i + 1,
          amount: perInstallment,
          dueDate: d.toISOString().split("T")[0],
        });
      }
      setInstallmentsList(list);
    }
  }, [kind, totalAmount, installmentsCount, startDate, frequency, editItem]);

  const handleCloseModal = () => {
    reset();
    setInstallmentsList([]);
    onClose();
  };

  if (!isOpen) return null;

  const onSubmit = async (data: NewAccountFormData) => {
    setFormErrorMessage(null);
    try {
      const finalInstallments =
        data.kind === "INSTALLMENT_PLAN" && installmentsList.length > 0
          ? installmentsList.map((inst) => ({
              sequence: inst.sequence,
              amountCents: Math.round(inst.amount * 100),
              dueDate: inst.dueDate,
            }))
          : [
              {
                sequence: 1,
                amountCents: Math.round(data.totalAmount * 100),
                dueDate: data.startDate,
              },
            ];

      if (editItem) {
        const { updateFinancialItem } = await import("@/server/actions/financial-items");
        const res = await updateFinancialItem({
          id: editItem.id,
          direction: data.direction,
          kind: data.kind,
          title: data.title,
          description: data.description,
          contactName: data.contactName,
          pixKey: data.pixKey,
          pixKeyType: data.pixKeyType,
          categoryName: data.category,
          totalAmountCents: Math.round(data.totalAmount * 100),
          startDate: data.startDate,
          installments: finalInstallments,
        });

        if (!res.success) {
          throw new Error((res as any).error || "Erro ao atualizar conta no banco de dados.");
        }
      } else {
        const { createFinancialItem } = await import("@/server/actions/financial-items");
        const res = await createFinancialItem({
          direction: data.direction,
          kind: data.kind,
          title: data.title,
          description: data.description,
          contactName: data.contactName,
          pixKey: data.pixKey,
          pixKeyType: data.pixKeyType,
          categoryName: data.category,
          totalAmountCents: Math.round(data.totalAmount * 100),
          startDate: data.startDate,
          installments: finalInstallments,
        });

        if (!res.success) {
          throw new Error((res as any).error || "Erro ao cadastrar conta no banco de dados.");
        }
      }

      const { notifyStoreChange } = await import("@/services/financial-store");
      notifyStoreChange();

      setSuccessMessage(
        `Sucesso! ${data.direction === "PAYABLE" ? "Conta a pagar" : "Conta a receber"} "${data.title}" (${data.contactName}) ${editItem ? "atualizada" : "cadastrada"} com sucesso.`
      );
      setTimeout(() => {
        setSuccessMessage(null);
        reset();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Erro ao salvar conta no banco de dados:", err);
      setFormErrorMessage(err.message || "Falha ao salvar no banco de dados local. Tente novamente.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={handleCloseModal}
          className="absolute top-4 right-4 text-novex-text-muted hover:text-novex-text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-novex-border pb-4 mb-6">
          <h2 className="text-xl font-bold text-novex-text-primary">
            {editItem
              ? direction === "RECEIVABLE"
                ? "Editar Conta a Receber"
                : "Editar Conta a Pagar"
              : direction === "RECEIVABLE"
              ? "Cadastrar Nova Conta a Receber"
              : "Cadastrar Nova Conta a Pagar"}
          </h2>
          <p className="text-xs text-novex-text-secondary mt-0.5">
            {direction === "RECEIVABLE"
              ? "Cadastre recebimentos e direitos a receber com acompanhamento de vencimentos e cobrança Pix."
              : "Cadastre compromissos a pagar com vencimentos, parcelas e chave Pix do favorecido."}
          </p>
        </div>

        {successMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/20 p-3 text-xs text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {formErrorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-500/20 p-3 text-xs text-rose-300 border border-rose-500/40">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formErrorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-xs">
          {/* Seletor Pagar vs Receber */}
          {lockDirection ? (
            <div
              className={`p-3 rounded-lg border flex items-center justify-between ${
                direction === "RECEIVABLE"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {direction === "RECEIVABLE" ? (
                  <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-red-400" />
                )}
                <span className="font-semibold text-xs">
                  {direction === "RECEIVABLE"
                    ? "Fluxo de Entrada: Conta a Receber (Receita / Crédito Previsto)"
                    : "Fluxo de Saída: Conta a Pagar (Despesa / Débito Previsto)"}
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 px-2 py-0.5 rounded bg-novex-surface2 border border-novex-border">
                {direction === "RECEIVABLE" ? "A Receber" : "A Pagar"}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-1 rounded-lg bg-novex-surface2 border border-novex-border">
              <button
                type="button"
                onClick={() => setValue("direction", "PAYABLE")}
                className={`py-2.5 rounded-md font-semibold text-center transition-all ${
                  direction === "PAYABLE"
                    ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm"
                    : "text-novex-text-muted hover:text-novex-text-primary"
                }`}
              >
                Conta a Pagar (Saída / Despesa)
              </button>
              <button
                type="button"
                onClick={() => setValue("direction", "RECEIVABLE")}
                className={`py-2.5 rounded-md font-semibold text-center transition-all ${
                  direction === "RECEIVABLE"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                    : "text-novex-text-muted hover:text-novex-text-primary"
                }`}
              >
                Conta a Receber (Entrada / Receita)
              </button>
            </div>
          )}

          {/* Tipo de Obrigação */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "ONE_TIME", label: "Avulsa" },
              { id: "INSTALLMENT_PLAN", label: "Parcelada" },
              { id: "RECURRING", label: "Recorrente Fixa" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setValue("kind", t.id as any)}
                className={`py-2 rounded-lg border text-center font-medium transition-all ${
                  kind === t.id
                    ? "border-novex-cyan bg-novex-cyan/15 text-novex-cyan"
                    : "border-novex-border bg-novex-surface2/60 text-novex-text-secondary hover:bg-novex-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Dados Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Título da Conta *</label>
              <input
                {...register("title")}
                placeholder="Ex: Pensão Alimentícia, Aluguel, Servidor"
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
              {errors.title?.message && <span className="text-red-400 text-[10px] mt-1 block">{String(errors.title.message)}</span>}
            </div>

            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Contato / Favorecido (Digite o nome) *</label>
              <input
                {...register("contactName")}
                placeholder="Digite o nome do contato, empresa ou pessoa..."
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
              {errors.contactName?.message && <span className="text-red-400 text-[10px] mt-1 block">{String(errors.contactName.message)}</span>}
            </div>
          </div>

          {/* Campo Chave Pix para Pagamento / Cobrança com Seletor de Tipo */}
          <div className="rounded-lg border border-novex-border bg-novex-surface2/40 p-3 space-y-2">
            <label className="font-semibold text-novex-cyan flex items-center gap-1.5">
              <QrCode className="h-4 w-4" />
              <span>Chave Pix do Favorecido / Recebedor (Opcional)</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                {...register("pixKeyType")}
                className="rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="EMAIL">E-mail</option>
                <option value="PHONE">Celular/Telefone</option>
                <option value="EVP">Chave Aleatória (EVP)</option>
              </select>
              <input
                {...register("pixKey")}
                placeholder="Valor da Chave Pix..."
                className="md:col-span-2 rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary font-mono focus:border-novex-cyan focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-novex-text-muted flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0 text-novex-cyan" />
              <span>A Chave Pix informada será utilizada na emissão instantânea de QR Code e cobranças automatizadas.</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Valor Total (R$) *</label>
              <input
                type="text"
                value={
                  totalAmount > 0
                    ? totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "0,00"
                }
                onChange={(e) => {
                  const rawDigits = e.target.value.replace(/\D/g, "");
                  const numericVal = Number(rawDigits) / 100;
                  setValue("totalAmount", numericVal, { shouldValidate: true });
                }}
                placeholder="0,00"
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 font-mono text-base font-bold text-novex-cyan focus:border-novex-cyan focus:outline-none"
              />
              {errors.totalAmount?.message && <span className="text-red-400 text-[10px] mt-1 block">{String(errors.totalAmount.message)}</span>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-novex-text-secondary block">Categoria *</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(!isCustomCategory);
                    if (!isCustomCategory) setValue("category", "");
                    else setValue("category", "Moradia");
                  }}
                  className="text-[10px] text-novex-cyan hover:underline font-medium"
                >
                  {isCustomCategory ? "← Escolher da lista" : "+ Digitar outra"}
                </button>
              </div>

              {isCustomCategory ? (
                <input
                  {...register("category")}
                  placeholder="Digite o nome da categoria..."
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                />
              ) : (
                <select
                  {...register("category")}
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                >
                  <option value="Pessoal">Pessoal</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Contas Básicas">Contas Básicas</option>
                  <option value="Serviços & Tech">Serviços & Tech</option>
                  <option value="Serviços Prestados">Serviços Prestados</option>
                  <option value="Transferências & Acertos">Transferências & Acertos</option>
                  <option value="Alimentação">Alimentação</option>
                  <option value="Transporte & Veículo">Transporte & Veículo</option>
                </select>
              )}
            </div>

            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Vencimento / Início *</label>
              <input
                type="date"
                {...register("startDate")}
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
            </div>
          </div>

          {/* Frequência (Para Parceladas e Recorrentes) */}
          {(kind === "INSTALLMENT_PLAN" || kind === "RECURRING") && (
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Frequência da Movimentação *</label>
              <select
                {...register("frequency")}
                className="w-full rounded-lg border border-novex-border bg-novex-surface2/40 p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              >
                <option value="DAILY">Diário</option>
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>
          )}

          {/* Configuração de Parcelamento se for Parcelada */}
          {kind === "INSTALLMENT_PLAN" && (
            <div className="rounded-lg border border-novex-border bg-novex-surface2/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-novex-cyan">Parcelamento Variável</span>
                <div className="flex items-center gap-2">
                  <span className="text-novex-text-muted">Nº de Parcelas:</span>
                  <input
                    type="number"
                    min="2"
                    max="36"
                    {...register("installmentsCount")}
                    className="w-16 rounded border border-novex-border bg-novex-bg p-1 text-center font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {installmentsList.map((inst, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-novex-bg p-2 rounded border border-novex-border/60">
                    <span className="font-semibold text-novex-text-muted text-[11px] w-20">Parcela {inst.sequence}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={inst.amount}
                      onChange={(e) => {
                        const updated = [...installmentsList];
                        updated[idx].amount = Number(e.target.value);
                        setInstallmentsList(updated);
                      }}
                      className="w-28 rounded border border-novex-border bg-novex-surface1 p-1 text-right"
                    />
                    <input
                      type="date"
                      value={inst.dueDate}
                      onChange={(e) => {
                        const updated = [...installmentsList];
                        updated[idx].dueDate = e.target.value;
                        setInstallmentsList(updated);
                      }}
                      className="rounded border border-novex-border bg-novex-surface1 p-1 text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="font-semibold text-novex-text-secondary block mb-1">Descrição / Observações</label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="Detalhes opcionais sobre o compromisso..."
              className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
            />
          </div>

          {/* Botões do Formulário */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-novex-border">
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-lg border border-novex-border px-4 py-2.5 font-semibold text-novex-text-secondary hover:bg-novex-surface2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-novex-cyan px-6 py-2.5 font-semibold text-novex-bg hover:bg-novex-cyan-hover shadow-sm glow-cyan-subtle"
            >
              {isSubmitting ? "Salvando..." : editItem ? "Salvar Alterações" : "Salvar Conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
