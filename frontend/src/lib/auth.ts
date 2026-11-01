import { ApiError, request, post } from "./http.ts";
export { ApiError } from "./http.ts";

export type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

export async function currentUser(signal?: AbortSignal): Promise<User | null> {
  try {
    return await request<User>("/api/auth/me", { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function register(name: string, email: string, password: string) {
  return post<User>(
    "/api/users",
    JSON.stringify({ name, email, password }),
    "application/json",
  );
}

export async function login(email: string, password: string) {
  try {
    await post<void>("/api/auth/login", new URLSearchParams({ email, password }).toString(),
      "application/x-www-form-urlencoded");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, "E-mail ou senha incorretos.");
    }
    throw error;
  }
  const user = await currentUser();
  if (!user)
    throw new ApiError(
      401,
      "Não foi possível confirmar sua sessão. Entre novamente.",
    );
  return user;
}

export function logout() {
  return post<void>(
    "/api/auth/logout",
    "",
    "application/x-www-form-urlencoded",
  );
}
