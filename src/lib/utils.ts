import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInDays, isPast } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "GH₵"): string {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy h:mm a");
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function daysUntilExpiry(expiryDate: Date | string): number {
  return differenceInDays(new Date(expiryDate), new Date());
}

export function isExpired(expiryDate: Date | string): boolean {
  return isPast(new Date(expiryDate));
}

export function isExpiringSoon(expiryDate: Date | string, days: number = 30): boolean {
  const daysLeft = daysUntilExpiry(expiryDate);
  return daysLeft >= 0 && daysLeft <= days;
}

export function generateBatchNumber(prefix: string = "BATCH"): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${year}${month}-${random}`;
}

export function generateRequestNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `REQ-${year}${month}-${random}`;
}

export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `PO-${year}${month}-${random}`;
}

export function getStockStatusColor(quantity: number, minimum: number): string {
  if (quantity <= 0) return "text-red-600";
  if (quantity <= minimum * 0.5) return "text-red-500";
  if (quantity <= minimum) return "text-amber-500";
  return "text-green-600";
}

export function getExpiryStatusColor(expiryDate: Date | string): string {
  if (isExpired(expiryDate)) return "text-red-600";
  if (isExpiringSoon(expiryDate, 7)) return "text-red-500";
  if (isExpiringSoon(expiryDate, 30)) return "text-amber-500";
  return "text-green-600";
}

/**
 * Extract array data from API responses.
 * Some APIs return plain arrays, others return { data: [...] }.
 * This helper handles both formats consistently.
 */
export function extractData<T>(response: any): T[] {
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
}
