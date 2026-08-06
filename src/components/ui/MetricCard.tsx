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
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  amountCents,
  subtitle,
  icon: Icon,
  variant = "default",
  badgeText,
  className,
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 transition-all hover:border-novex-cyan/50",
        getVariantStyles(),
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-novex-text-secondary">{title}</span>
        <div className="rounded-lg bg-novex-surface2/80 p-2 text-current border border-novex-border/50">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-novex-text-primary">
          {formatCurrency(amountCents)}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-novex-text-secondary flex items-center gap-1">
            {subtitle}
          </p>
        )}
      </div>

      {badgeText && (
        <span className="absolute top-3 right-12 rounded bg-novex-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-novex-cyan border border-novex-cyan/30">
          {badgeText}
        </span>
      )}
    </div>
  );
};
