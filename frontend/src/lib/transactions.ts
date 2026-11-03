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

export function createTransaction(data: CreateTransaction) {
  return post<Transaction>("/api/transactions", JSON.stringify(data), "application/json");
}

export function updateTransaction(id: number, data: CreateTransaction) {
  return send<Transaction>("PUT", `/api/transactions/${id}`, JSON.stringify(data));
}

export function deleteTransaction(id: number) {
  return send<void>("DELETE", `/api/transactions/${id}`);
}
