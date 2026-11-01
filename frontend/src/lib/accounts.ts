import { post, request } from "./http.ts";

export type Account = {
  id: number;
  name: string;
  initialBalance: string;
  currentBalance: string;
};

export function listAccounts(signal?: AbortSignal) {
  return request<Account[]>("/api/accounts", { signal });
}

export function createAccount(name: string, initialBalance: string) {
  return post<Account>(
    "/api/accounts",
    JSON.stringify({ name, initialBalance }),
    "application/json",
  );
}
