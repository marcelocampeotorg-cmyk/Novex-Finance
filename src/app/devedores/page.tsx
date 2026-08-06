"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Users, Phone, Mail, QrCode, Plus, Search, ShieldCheck } from "lucide-react";
import { MOCK_CONTACTS } from "@/mocks/financial-data";
import { formatCurrency } from "@/lib/formatters";

export default function DevedoresPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const debtors = MOCK_CONTACTS.filter(
    (c) =>
      c.isDebtor &&
      (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Gestão de Devedores"
        description="Pessoas e empresas que possuem valores pendentes ou empréstimos ativos a acertar."
        actions={
          <button
            onClick={() => alert("Exemplo demonstrativo: Adicionar novo devedor.")}
            className="flex items-center gap-2 rounded-lg bg-novex-cyan px-4 py-2 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors shadow-sm glow-cyan-subtle"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Novo Devedor</span>
          </button>
        }
      />

      {/* Busca */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome ou e-mail do devedor..."
            className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
          />
        </div>
      </div>

      {/* Grid de Cards de Devedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {debtors.map((debtor) => (
          <div
            key={debtor.id}
            className="rounded-xl border border-novex-border bg-novex-surface1 p-5 space-y-4 flex flex-col justify-between hover:border-novex-cyan/50 transition-all"
          >
            <div>
              <div className="flex items-center justify-between border-b border-novex-border pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-novex-cyan/15 text-novex-cyan font-bold border border-novex-cyan/30">
                    {debtor.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-novex-text-primary">{debtor.name}</h3>
                    <span className="text-[10px] text-novex-text-muted">
                      {debtor.type === "COMPANY" ? "Pessoa Jurídica" : "Pessoa Física"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informações de Contato */}
              <div className="space-y-2 text-xs text-novex-text-secondary">
                {debtor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-novex-text-muted" />
                    <span>{debtor.phone}</span>
                  </div>
                )}
                {debtor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-novex-text-muted" />
                    <span>{debtor.email}</span>
                  </div>
                )}
                {debtor.notes && (
                  <div className="text-[11px] text-novex-text-muted italic pt-1">
                    &quot;{debtor.notes}&quot;
                  </div>
                )}
              </div>
            </div>

            {/* Total Devido pelo Contato */}
            <div className="pt-4 border-t border-novex-border flex items-center justify-between">
              <div>
                <span className="text-[10px] text-novex-text-muted block">Saldo Pendente</span>
                <span className="text-lg font-bold text-emerald-400">
                  {formatCurrency(debtor.totalOwedCents || 0)}
                </span>
              </div>

              <a
                href="/contas-a-receber"
                className="rounded-lg bg-novex-surface2 px-3 py-1.5 text-xs font-semibold text-novex-cyan hover:bg-novex-border border border-novex-border transition-colors"
              >
                Cobrar Pix
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
