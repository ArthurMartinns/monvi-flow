import { post, request } from "./http.ts";

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
