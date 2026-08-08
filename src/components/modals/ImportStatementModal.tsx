"use client";

import React, { useState } from "react";
import { X, Upload, RefreshCw, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { syncMercadoPagoStatement, importExternalTransactions } from "@/server/actions/transactions";
import { parseCSVStatement } from "@/services/csv-statement-parser";

interface ImportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportStatementModal({ isOpen, onClose, onSuccess }: ImportStatementModalProps) {
  const [activeTab, setActiveTab] = useState<"API" | "CSV">("API");
  const [loading, setLoading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncApi = async () => {
    setLoading(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      const res = await syncMercadoPagoStatement();
      if (res.success) {
        setResultMessage(
          `Sincronização concluída! ${res.insertedCount} movimentações importadas/atualizadas. (${res.autoMatchedCount} conciliadas automaticamente)`
        );
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMessage(res.error || "Falha na sincronização via API.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content || "");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      setErrorMessage("Por favor, selecione ou cole o conteúdo do arquivo CSV.");
      return;
    }

    setLoading(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      const parsedTxs = parseCSVStatement(csvText);
      if (parsedTxs.length === 0) {
        setErrorMessage("Nenhuma transação válida encontrada no CSV informado.");
        setLoading(false);
        return;
      }

      const res = await importExternalTransactions(parsedTxs);
      if (res.success) {
        setResultMessage(
          `Importação de CSV realizada com sucesso! ${res.insertedCount} movimentações processadas. (${res.autoMatchedCount} conciliadas automaticamente)`
        );
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMessage(res.error || "Falha ao importar movimentações do CSV.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao processar arquivo CSV.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-novex-border pb-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-novex-cyan" />
            <h2 className="text-lg font-bold text-novex-text-primary">Importar Extrato Bancário</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-novex-text-muted hover:bg-novex-surface2 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-novex-border">
          <button
            onClick={() => setActiveTab("API")}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "API"
                ? "border-novex-cyan text-novex-cyan"
                : "border-transparent text-novex-text-muted hover:text-novex-text-primary"
            }`}
          >
            Sincronização API (Mercado Pago)
          </button>
          <button
            onClick={() => setActiveTab("CSV")}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "CSV"
                ? "border-novex-cyan text-novex-cyan"
                : "border-transparent text-novex-text-muted hover:text-novex-text-primary"
            }`}
          >
            Upload de Arquivo CSV
          </button>
        </div>

        {/* Feedback Mensagens */}
        {resultMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/20 p-3 text-xs text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{resultMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/20 p-3 text-xs text-rose-300 border border-rose-500/40">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Conteúdo Aba API */}
        {activeTab === "API" && (
          <div className="space-y-4 text-xs">
            <p className="text-novex-text-secondary leading-relaxed">
              O NOVEX Finance se conectará com a API de Relatórios (&quot;Dinheiro em Conta&quot;) da sua conta Mercado Pago para baixar
              automaticamente as movimentações mais recentes.
            </p>
            <div className="rounded-xl border border-novex-border bg-novex-surface2/50 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-novex-text-primary">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Deduplicação automática ativada</span>
              </div>
              <p className="text-novex-text-muted text-[11px]">
                Transações previamente importadas serão identificadas pelo ID único e não serão duplicadas.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={handleSyncApi}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold py-3 text-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Sincronizando..." : "Iniciar Sincronização Direta"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Aba CSV */}
        {activeTab === "CSV" && (
          <div className="space-y-4 text-xs">
            <p className="text-novex-text-secondary">
              Selecione um arquivo CSV de extrato bancário ou cole seu conteúdo abaixo:
            </p>

            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer border-novex-border bg-novex-surface2/40 hover:bg-novex-surface2 transition-colors">
                <div className="flex flex-col items-center justify-center pt-3 pb-3">
                  <Upload className="w-6 h-6 mb-2 text-novex-cyan" />
                  <p className="text-xs text-novex-text-secondary">
                    <span className="font-semibold text-novex-cyan">Clique para selecionar</span> o arquivo CSV
                  </p>
                  <p className="text-[10px] text-novex-text-muted">Formato suportado: CSV (.csv)</p>
                </div>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            {csvText && (
              <div className="space-y-1">
                <span className="text-[10px] text-novex-text-muted uppercase font-semibold">Pré-visualização do Conteúdo</span>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 text-[11px] font-mono text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleImportCsv}
                disabled={loading || !csvText.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold py-3 text-xs transition-all disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                <span>{loading ? "Processando..." : "Processar e Importar CSV"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
