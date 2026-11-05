import { request } from "./http.ts";
import type { Budget } from "./budgets.ts";

export type Overview = {
  month: string;
  totalBalance: string;
  accountCount: number;
  income: string;
  expense: string;
  result: string;
  transactionCount: number;
  days: { date: string; income: string; expense: string }[];
  categories: { id: number; name: string; amount: string }[];
  budgets: Budget[];
};

export function getOverview(
  month: string,
  accountId: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ month });
  if (accountId) params.set("accountId", accountId);
  return request<Overview>(`/api/overview?${params}`, {
    signal,
  });
}
