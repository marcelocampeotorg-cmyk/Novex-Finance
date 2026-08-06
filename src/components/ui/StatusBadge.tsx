import React from "react";
import { cn } from "@/lib/formatters";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const getStatusConfig = (st: string) => {
    switch (st.toUpperCase()) {
      case "SETTLED":
      case "APPROVED":
      case "MATCHED":
      case "COMPLETED":
        return {
          label: st === "SETTLED" ? "Paga / Efetivada" : st === "MATCHED" ? "Conciliada" : "Aprovado",
          bg: "bg-emerald-500/10",
          text: "text-emerald-400",
          border: "border-emerald-500/30",
        };
      case "OVERDUE":
        return {
          label: "Vencida",
          bg: "bg-red-500/10",
          text: "text-red-400",
          border: "border-red-500/30",
        };
      case "SCHEDULED":
      case "ACTIVE":
        return {
          label: "Prevista / A Vencer",
          bg: "bg-blue-500/10",
          text: "text-blue-400",
          border: "border-blue-500/30",
        };
      case "PARTIAL":
        return {
          label: "Parcial",
          bg: "bg-amber-500/10",
          text: "text-amber-400",
          border: "border-amber-500/30",
        };
      case "SUGGESTED":
        return {
          label: "Sugestão de Vínculo",
          bg: "bg-purple-500/10",
          text: "text-purple-400",
          border: "border-purple-500/30",
        };
      case "UNMATCHED":
        return {
          label: "Não Conciliada",
          bg: "bg-zinc-500/10",
          text: "text-zinc-400",
          border: "border-zinc-500/30",
        };
      case "PENDING":
        return {
          label: "Pendente",
          bg: "bg-amber-500/10",
          text: "text-amber-400",
          border: "border-amber-500/30",
        };
      default:
        return {
          label: st,
          bg: "bg-zinc-800",
          text: "text-zinc-300",
          border: "border-zinc-700",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
      {config.label}
    </span>
  );
};
