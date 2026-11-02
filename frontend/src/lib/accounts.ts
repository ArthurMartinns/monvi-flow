import { ApiError, post, request, send } from "./http.ts";

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

export function renameAccount(id: number, name: string) {
  return send<Account>(
    "PATCH",
    `/api/accounts/${id}`,
    JSON.stringify({ name }),
  );
}

export async function deleteAccount(id: number) {
  try {
    await send<void>("DELETE", `/api/accounts/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new ApiError(
        409,
        "Esta conta possui registros vinculados e não pode ser excluída.",
      );
    }
    throw error;
  }
}
