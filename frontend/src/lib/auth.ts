export type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

type CsrfToken = {
  token: string;
  headerName: string;
};

export class ApiError extends Error {
  status: number;
  fields: string[];

  constructor(status: number, message: string, fields: string[] = []) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "Não foi possível conectar. Confira sua conexão e tente novamente.",
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const messages: Record<number, string> = {
      400: "Confira os campos informados.",
      401: "E-mail ou senha incorretos.",
      403: "Sua sessão de segurança expirou. Tente novamente.",
      409: "Este e-mail já está cadastrado.",
    };
    const fields = Array.isArray(body?.fields)
      ? body.fields.filter(
          (field: unknown): field is string => typeof field === "string",
        )
      : [];
    throw new ApiError(
      response.status,
      messages[response.status] ??
        "Não foi possível concluir a operação. Tente novamente.",
      fields,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function post<T>(
  path: string,
  body: string,
  contentType: string,
): Promise<T> {
  const csrf = await request<CsrfToken>("/api/auth/csrf");
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": contentType, [csrf.headerName]: csrf.token },
    body,
  });
}

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
  await post<void>(
    "/api/auth/login",
    new URLSearchParams({ email, password }).toString(),
    "application/x-www-form-urlencoded",
  );
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
