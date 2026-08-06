"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Trash2, Calendar, DollarSign, Tag, User, Repeat, Bell, ShieldCheck } from "lucide-react";
import { MOCK_CONTACTS } from "@/mocks/financial-data";
import { formatCurrency } from "@/lib/formatters";

const newAccountSchema = z.object({
  direction: z.enum(["PAYABLE", "RECEIVABLE"]),
  kind: z.enum(["ONE_TIME", "INSTALLMENT_PLAN", "RECURRING"]),
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  contactId: z.string().min(1, "Selecione ou informe um contato"),
  category: z.string().min(1, "Selecione uma categoria"),
  totalAmount: z.coerce.number().min(0.01, "Informe um valor maior que R$ 0,00"),
  startDate: z.string().min(1, "Selecione a data de vencimento ou início"),
  installmentsCount: z.coerce.number().min(1).max(60).default(1),
  frequency: z.enum(["MONTHLY", "WEEKLY", "YEARLY"]).optional(),
  pixKey: z.string().optional(),
});

type NewAccountFormData = z.infer<typeof newAccountSchema>;

interface NewAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewAccountModal: React.FC<NewAccountModalProps> = ({ isOpen, onClose }) => {
  const [installmentsList, setInstallmentsList] = useState<
    { sequence: number; amount: number; dueDate: string }[]
  >([]);

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
      direction: "PAYABLE",
      kind: "ONE_TIME",
      title: "",
      description: "",
      contactId: MOCK_CONTACTS[0].id,
      category: "Moradia",
      totalAmount: 100,
      startDate: new Date().toISOString().split("T")[0],
      installmentsCount: 1,
      frequency: "MONTHLY",
    },
  });

  const direction = watch("direction");
  const kind = watch("kind");
  const totalAmount = watch("totalAmount");
  const startDate = watch("startDate");
  const installmentsCount = watch("installmentsCount");

  // Recalcular parcelas quando o tipo for parcelado
  React.useEffect(() => {
    if (kind === "INSTALLMENT_PLAN" && totalAmount > 0 && installmentsCount > 0) {
      const perInstallment = Number((totalAmount / installmentsCount).toFixed(2));
      const list = [];
      const baseDate = startDate ? new Date(startDate) : new Date();

      for (let i = 0; i < installmentsCount; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        list.push({
          sequence: i + 1,
          amount: perInstallment,
          dueDate: d.toISOString().split("T")[0],
        });
      }
      setInstallmentsList(list);
    }
  }, [kind, totalAmount, installmentsCount, startDate]);

  if (!isOpen) return null;

  const onSubmit = (data: NewAccountFormData) => {
    console.log("Nova conta criada (Local state mock):", data, installmentsList);
    alert(`Sucesso! ${data.direction === "PAYABLE" ? "Conta a pagar" : "Conta a receber"} "${data.title}" cadastrada.`);
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-novex-text-muted hover:text-novex-text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-novex-border pb-4 mb-6">
          <h2 className="text-xl font-bold text-novex-text-primary">Cadastrar Nova Conta / Compromisso</h2>
          <p className="text-xs text-novex-text-secondary mt-0.5">
            Cadastre compromissos previstos a pagar ou a receber com parcelas variáveis e conciliação automática.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-xs">
          {/* Seletor Pagar vs Receber */}
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
              Conta a Pagar (Débito)
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
              Conta a Receber (Crédito)
            </button>
          </div>

          {/* Tipo de Obrigação: Avulsa, Parcelada, Recorrente */}
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
                placeholder="Ex: Aluguel, Servidor VPS, Consultoria"
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
              {errors.title?.message && <span className="text-red-400 text-[10px] mt-1 block">{String(errors.title.message)}</span>}
            </div>

            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Contato / Favorecido *</label>
              <select
                {...register("contactId")}
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              >
                {MOCK_CONTACTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type === "COMPANY" ? "PJ" : "PF"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Valor Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                {...register("totalAmount")}
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
              {errors.totalAmount?.message && <span className="text-red-400 text-[10px] mt-1 block">{String(errors.totalAmount.message)}</span>}
            </div>

            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Categoria *</label>
              <select
                {...register("category")}
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              >
                <option value="Moradia">Moradia</option>
                <option value="Contas Básicas">Contas Básicas</option>
                <option value="Serviços & Tech">Serviços & Tech</option>
                <option value="Serviços Prestados">Serviços Prestados</option>
                <option value="Transferências & Acertos">Transferências & Acertos</option>
                <option value="Alimentação">Alimentação</option>
                <option value="Transporte & Veículo">Transporte & Veículo</option>
              </select>
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

              {/* Lista de Parcelas Editáveis */}
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
              onClick={onClose}
              className="rounded-lg border border-novex-border px-4 py-2.5 font-semibold text-novex-text-secondary hover:bg-novex-surface2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-novex-cyan px-6 py-2.5 font-semibold text-novex-bg hover:bg-novex-cyan-hover shadow-sm glow-cyan-subtle"
            >
              Salvar Conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
