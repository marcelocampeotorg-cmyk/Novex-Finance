"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Trash2, RotateCcw, ShieldAlert, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { getTrashedItems, restoreTrashedItem, TrashedItemDTO } from "@/server/actions/trash";

export default function LixeiraPage() {
  const [items, setItems] = useState<TrashedItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getTrashedItems();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleRestore = async (id: string, title: string) => {
    setRestoringId(id);
    try {
      const res = await restoreTrashedItem(id);
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      } else {
        alert(res.error || "Falha ao restaurar item.");
      }
    } catch (e) {
      alert("Erro de comunicação.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Lixeira e Recuperação"
        description="Contas e cadastros desativados por exclusão lógica. Transações importadas do Mercado Pago preservam histórico de auditoria."
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
        <span>
          Os itens listados abaixo foram excluídos e podem ser restaurados a qualquer momento. Movimentações oficiais do Mercado Pago não são apagadas fisicamente.
        </span>
      </div>

      <div className="rounded-xl border border-novex-border bg-novex-surface1 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-novex-text-muted flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-novex-cyan" />
            <span>Carregando itens excluídos...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-novex-text-muted">
            <Trash2 className="h-8 w-8 mx-auto mb-2 text-novex-text-muted opacity-50" />
            <span>A lixeira está vazia. Nenhuma conta excluída.</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-novex-border bg-novex-surface2/60 text-novex-text-muted uppercase text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Item Excluído</th>
                <th className="py-3.5 px-4">Tipo</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Data da Exclusão</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-novex-border/60">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-novex-surface2/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-novex-text-primary">{item.title}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.direction === "PAYABLE" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {item.direction === "PAYABLE" ? "Conta a Pagar" : "Conta a Receber"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-novex-text-secondary">{item.category}</td>
                  <td className="py-3.5 px-4 text-novex-text-muted">{formatDate(item.deletedAt)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleRestore(item.id, item.title)}
                      disabled={restoringId === item.id}
                      className="inline-flex items-center gap-1 rounded bg-novex-cyan px-2.5 py-1 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${restoringId === item.id ? "animate-spin" : ""}`} />
                      <span>{restoringId === item.id ? "Restaurando..." : "Restaurar"}</span>
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
