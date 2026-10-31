import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, login, register } from "../../lib/auth";
import type { User } from "../../lib/auth";

type Props = {
  onLogin: (user: User) => void;
};

const inputClass =
  "mt-2 w-full rounded-lg border border-stone-200 bg-white px-4 py-3.5 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:bg-stone-50";

export default function AuthForm({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const isRegister = mode === "register";

  function changeMode() {
    setMode(isRegister ? "login" : "register");
    setError("");
    setFields([]);
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    setPending(true);
    setError("");
    setFields([]);
    setNotice("");

    try {
      if (isRegister) {
        await register(String(data.get("name") ?? ""), email, password);
        form.reset();
        setMode("login");
        setNotice("Conta criada! Entre com seu e-mail e senha.");
      } else {
        onLogin(await login(email, password));
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação.",
      );
      if (error instanceof ApiError) setFields(error.fields);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-svh items-center lg:grid-cols-2">
      <section className="relative flex min-h-28 flex-col justify-between overflow-hidden bg-[#eef3e6] p-7 sm:p-10 lg:min-h-svh lg:p-16 xl:p-20">
        <div className="relative z-10 flex items-center gap-3 text-emerald-950">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full bg-emerald-900 font-serif text-xl text-white"
          >
            M
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            MonviFlow
          </span>
        </div>
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-32 hidden size-[590px] rounded-full border border-white/80 bg-[#e0ebd1]/60 lg:block"
        />
        <div
          aria-hidden="true"
          className="absolute top-16 -right-14 hidden size-[470px] rounded-full border border-white/80 bg-[#d3e2bd]/40 lg:block"
        />
        <div className="relative z-10 hidden lg:block">
          <h1 className="max-w-md font-serif text-5xl leading-[1.12] tracking-tight text-emerald-950 xl:text-[56px]">
            Mais clareza.
            <br />
            <span className="whitespace-nowrap">Mais tranquilidade.</span>
          </h1>
          <p className="mt-5 max-w-xs text-sm leading-7 text-emerald-950/70">
            Um espaço simples para cuidar do seu dinheiro, um passo de cada vez.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="form-title"
        className="mx-auto w-full max-w-md px-6 py-10 sm:px-8 sm:py-14"
      >
        <h2
          id="form-title"
          className="font-serif text-4xl tracking-tight text-stone-900"
        >
          {isRegister ? "Crie sua conta" : "Bem-vindo de volta"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          {isRegister
            ? "Comece com seus dados abaixo."
            : "Entre para continuar no MonviFlow."}
        </p>

        {notice && (
          <p
            role="status"
            className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            id="form-error"
            role="alert"
            className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <form
          key={mode}
          onSubmit={submit}
          className="mt-9 space-y-5"
          aria-busy={pending}
        >
          <fieldset disabled={pending} className="space-y-5">
            {isRegister && (
              <div>
                <label htmlFor="name" className="text-sm font-medium">
                  Nome
                </label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  aria-invalid={fields.includes("name")}
                  aria-describedby={
                    fields.includes("name") ? "form-error" : undefined
                  }
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={fields.includes("email")}
                aria-describedby={
                  fields.includes("email") ? "form-error" : undefined
                }
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 8 : undefined}
                maxLength={isRegister ? 128 : undefined}
                aria-invalid={fields.includes("password")}
                aria-describedby={
                  fields.includes("password")
                    ? "form-error"
                    : isRegister
                      ? "password-help"
                      : undefined
                }
                className={inputClass}
              />
              {isRegister && (
                <p id="password-help" className="mt-2 text-sm text-stone-500">
                  Use entre 8 e 128 caracteres.
                </p>
              )}
            </div>
            <button
              type="submit"
              className="mt-2 w-full cursor-pointer rounded-lg bg-emerald-900 px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Aguarde…" : isRegister ? "Criar conta" : "Entrar"}
            </button>
          </fieldset>
        </form>

        <p className="mt-7 text-center text-sm text-stone-500">
          {isRegister ? "Já tem uma conta? " : "Ainda não tem uma conta? "}
          <button
            type="button"
            onClick={changeMode}
            disabled={pending}
            className="cursor-pointer font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60"
          >
            {isRegister ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </section>
    </div>
  );
}
