import { ApiError, post, request, send } from "./http.ts";

export type CategoryType = "INCOME" | "EXPENSE";

export type Category = {
  id: number;
  name: string;
  type: CategoryType;
};

export function listCategories(signal?: AbortSignal) {
  return request<Category[]>("/api/categories", { signal });
}

export function createCategory(name: string, type: CategoryType) {
  return post<Category>(
    "/api/categories",
    JSON.stringify({ name, type }),
    "application/json",
  );
}

export function renameCategory(id: number, name: string) {
  return send<Category>(
    "PATCH",
    `/api/categories/${id}`,
    JSON.stringify({ name }),
  );
}

export async function deleteCategory(id: number) {
  try {
    await send<void>("DELETE", `/api/categories/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new ApiError(
        409,
        "Esta categoria possui registros vinculados e não pode ser excluída.",
      );
    }
    throw error;
  }
}
