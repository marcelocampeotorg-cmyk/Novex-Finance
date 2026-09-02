import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor em centavos para Moeda BRL (Ex: 150000 -> R$ 1.500,00)
 */
export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(Number(cents))) {
    return "R$ 0,00";
  }
  const value = Number(cents) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata datas em formato brasileiro dd/mm/yyyy ou relativo de modo estritamente seguro
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = typeof dateString === "string" || typeof dateString === "number" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

/**
 * Formata data e hora de modo estritamente seguro
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = typeof dateString === "string" || typeof dateString === "number" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

