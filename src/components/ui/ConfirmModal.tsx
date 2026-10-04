"use client";

import React, { useEffect } from "react";
import { AlertTriangle, AlertCircle, HelpCircle, Loader2 } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  subNote?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  isLoading = false,
  subNote,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const iconMap = {
    danger: <AlertTriangle className="h-6 w-6 text-red-400" />,
    warning: <AlertCircle className="h-6 w-6 text-amber-400" />,
    primary: <HelpCircle className="h-6 w-6 text-novex-cyan" />,
  };

  const iconBgMap = {
    danger: "bg-red-500/10 border-red-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    primary: "bg-novex-cyan/10 border-novex-cyan/20",
  };

  const confirmBtnStyle = {
    danger:
      "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/30 shadow-xs",
    warning:
      "bg-amber-500 text-black hover:bg-amber-600 focus:ring-amber-500/30 shadow-xs",
    primary:
      "bg-novex-cyan text-novex-bg hover:bg-novex-cyan-hover focus:ring-novex-cyan/30 shadow-xs glow-cyan-subtle",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`rounded-xl border p-3 flex-shrink-0 ${iconBgMap[variant]}`}
          >
            {iconMap[variant]}
          </div>

          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-bold text-novex-text-primary tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-novex-text-secondary leading-relaxed">
              {description}
            </p>

            {subNote && (
              <div className="mt-3 rounded-lg border border-novex-border/80 bg-novex-surface2/60 p-2.5 text-[11px] text-novex-text-muted">
                {subNote}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-novex-border/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-novex-border bg-novex-surface2 px-4 py-2 text-xs font-semibold text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2/80 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 ${confirmBtnStyle[variant]}`}
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
