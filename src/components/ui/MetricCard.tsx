import React from "react";
import { formatCurrency, cn } from "@/lib/formatters";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  amountCents: number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "cyan" | "danger" | "success" | "warning";
  badgeText?: string;
  className?: string;
  valueColor?: "red" | "green" | "white" | "auto";
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  amountCents,
  subtitle,
  icon: Icon,
  variant = "default",
  badgeText,
  className,
  valueColor,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "cyan":
        return "border-novex-cyan/40 bg-gradient-to-br from-novex-surface1 via-novex-surface2 to-novex-cyan/10 text-novex-cyan glow-cyan-subtle";
      case "danger":
        return "border-red-500/30 bg-gradient-to-br from-novex-surface1 to-red-950/20 text-red-400";
      case "success":
        return "border-emerald-500/30 bg-gradient-to-br from-novex-surface1 to-emerald-950/20 text-emerald-400";
      case "warning":
        return "border-amber-500/30 bg-gradient-to-br from-novex-surface1 to-amber-950/20 text-amber-400";
      default:
        return "border-novex-border bg-novex-surface1 text-novex-text-primary";
    }
  };

  const getValueColorClass = () => {
    if (valueColor === "red") return "text-red-400";
    if (valueColor === "green") return "text-emerald-400";
    if (valueColor === "white") return "text-novex-text-primary";
    if (valueColor === "auto") {
      if (amountCents < 0) return "text-red-400";
      if (amountCents > 0) return "text-emerald-400";
      return "text-novex-text-primary";
    }
    return "text-novex-text-primary";
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 transition-all hover:border-novex-cyan/50 flex flex-col justify-between",
        getVariantStyles(),
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-novex-text-secondary leading-tight">{title}</span>
          {badgeText && (
            <span className="inline-self-start self-start rounded bg-novex-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-novex-cyan border border-novex-cyan/30 mt-0.5">
              {badgeText}
            </span>
          )}
        </div>

        <div className="rounded-lg bg-novex-surface2/80 p-2 text-current border border-novex-border/50 shrink-0">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4">
        <div className={cn("text-2xl font-bold tracking-tight", getValueColorClass())}>
          {formatCurrency(amountCents)}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-novex-text-secondary flex items-center gap-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
