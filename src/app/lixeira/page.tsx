"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Trash2, RotateCcw, ShieldAlert } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default function LixeiraPage() {
  const [items, setItems] = useState([
    {
      id: "trash-1",
      title: "Assinatura Antiga Revista Tech",
      category: "Outros",
      amountCents: 4500,
      deletedAt: "2026-08-02T10:00:00.000Z",
    },
    {
      id: "trash-2",
      title: "Orçamento Cancelado Equipamento",
      category: "Equipamentos",
      amountCents: 120000,
      deletedAt: "2026-07-28T16:30:00.000Z",
    },
  ]);

  const handleRestore = (id: string, title: string) => {
    setItems(items.filter((i) => i.id !== id));
    alert(`Item "${title}" restaurado com sucesso!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Lixeira e Recuperação"
        description="Cadastros excluídos temporariamente. Transações importadas do Mercado Pago preservam histórico de auditoria."
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
        <span>
          Itens na lixeira são removidos definitivamente após 30 dias. Movimentações reais do Mercado Pago não são apagadas fisicamente.
        </span>
      </div>

      <div className="rounded-xl border border-novex-border bg-novex-surface1 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-novex-text-muted">
            <Trash2 className="h-8 w-8 mx-auto mb-2 text-novex-text-muted opacity-50" />
            <span>A lixeira está vazia.</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-novex-border bg-novex-surface2/60 text-novex-text-muted uppercase text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Item Excluído</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Valor</th>
                <th className="py-3.5 px-4">Data da Exclusão</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-novex-border/60">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-novex-surface2/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-novex-text-primary">{item.title}</td>
                  <td className="py-3.5 px-4 text-novex-text-secondary">{item.category}</td>
                  <td className="py-3.5 px-4 font-bold text-novex-text-primary">{formatCurrency(item.amountCents)}</td>
                  <td className="py-3.5 px-4 text-novex-text-muted">{formatDate(item.deletedAt)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleRestore(item.id, item.title)}
                      className="inline-flex items-center gap-1 rounded bg-novex-cyan px-2.5 py-1 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restaurar</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
