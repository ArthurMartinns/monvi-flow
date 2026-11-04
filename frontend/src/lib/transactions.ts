import type { CategoryType } from "./categories.ts";
import { post, request, requestResponse, send } from "./http.ts";

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

function filterParams(filters: TransactionFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params;
}

export function searchTransactions(
  filters: TransactionFilters,
  signal?: AbortSignal,
) {
  return request<TransactionPage>(
    `/api/transactions/search?${filterParams(filters)}`,
    { signal },
  );
}

export async function exportTransactions(
  filters: TransactionFilters,
  signal?: AbortSignal,
) {
  const params = filterParams(filters);
  params.delete("page");
  params.delete("size");
  return (
    await requestResponse(`/api/transactions/export?${params}`, { signal })
  ).blob();
}

export function createTransaction(data: CreateTransaction) {
  return post<Transaction>(
    "/api/transactions",
    JSON.stringify(data),
    "application/json",
  );
}

export function updateTransaction(id: number, data: CreateTransaction) {
  return send<Transaction>(
    "PUT",
    `/api/transactions/${id}`,
    JSON.stringify(data),
  );
}

export function deleteTransaction(id: number) {
  return send<void>("DELETE", `/api/transactions/${id}`);
}
