import type { CategoryType } from "./categories.ts";
import { post, request, send } from "./http.ts";

export type Transaction = {
  id: number;
  accountId: number;
  accountName: string;
  categoryId: number;
  categoryName: string;
  type: CategoryType;
  description: string;
  amount: string;
  date: string;
};

export type CreateTransaction = {
  accountId: number;
  categoryId: number;
  description: string;
  amount: string;
  date: string;
};

export function listTransactions(signal?: AbortSignal) {
  return request<Transaction[]>("/api/transactions", { signal });
}

export type TransactionFilters = {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: CategoryType | "";
  query?: string;
  page: number;
  size: number;
};

export type TransactionPage = {
  content: Transaction[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function searchTransactions(filters: TransactionFilters, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return request<TransactionPage>(`/api/transactions/search?${params}`, { signal });
}

export function createTransaction(data: CreateTransaction) {
  return post<Transaction>("/api/transactions", JSON.stringify(data), "application/json");
}

export function updateTransaction(id: number, data: CreateTransaction) {
  return send<Transaction>("PUT", `/api/transactions/${id}`, JSON.stringify(data));
}

export function deleteTransaction(id: number) {
  return send<void>("DELETE", `/api/transactions/${id}`);
}
