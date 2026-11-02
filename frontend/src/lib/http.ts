export class ApiError extends Error {
  status: number;
  fields: string[];

  constructor(status: number, message: string, fields: string[] = []) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "Não foi possível conectar. Tente novamente.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const messages: Record<number, string> = {
      400: "Confira os campos informados.",
      401: "Sua sessão expirou. Entre novamente.",
      403: "Sua sessão de segurança expirou. Tente novamente.",
      404: "Registro não encontrado. Atualize a página.",
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

export async function post<T>(
  path: string,
  body: string,
  contentType: string,
): Promise<T> {
  return send<T>("POST", path, body, contentType);
}

export async function send<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: string,
  contentType = "application/json",
): Promise<T> {
  const csrf = await request<{ token: string; headerName: string }>(
    "/api/auth/csrf",
  );
  return request<T>(path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": contentType } : {}),
      [csrf.headerName]: csrf.token,
    },
    body,
  });
}
