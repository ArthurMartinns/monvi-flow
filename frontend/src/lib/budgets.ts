import { request, send } from "./http.ts";

export type Budget = {
  id: number;
  categoryId: number;
  categoryName: string;
  month: string;
  limitAmount: string;
  spent: string;
  remaining: string;
};

export function listBudgets(month: string, signal?: AbortSignal) {
  return request<Budget[]>(`/api/budgets?${new URLSearchParams({ month })}`, {
    signal,
  });
}

export function saveBudget(
  categoryId: number,
  month: string,
  limitAmount: string,
) {
  return send<Budget>(
    "PUT",
    `/api/budgets/${categoryId}`,
    JSON.stringify({ month, limitAmount }),
  );
}

export function deleteBudget(id: number) {
  return send<void>("DELETE", `/api/budgets/${id}`);
}
