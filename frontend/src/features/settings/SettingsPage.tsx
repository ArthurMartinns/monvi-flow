import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, changePassword, updateProfile } from "../../lib/auth";
import type { User } from "../../lib/auth";

type Props = {
  user: User;
  onUpdated: (user: User) => void;
  onSessionExpired: () => void;
};

export default function SettingsPage({
  user,
  onUpdated,
  onSessionExpired,
}: Props) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || name.trim() === user.name) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setError("");
    setNotice("");
    setInvalid(false);
    try {
      const updated = await updateProfile(name, controller.signal);
      if (controller.signal.aborted) return;
      onUpdated(updated);
      setName(updated.name);
      setNotice("Nome atualizado com sucesso.");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else {
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar seu nome.",
        );
        setInvalid(error instanceof ApiError && error.fields.includes("name"));
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordSaving) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas novas não coincidem.");
      setPasswordNotice("");
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordNotice("");
    try {
      await changePassword(currentPassword, newPassword, controller.signal);
      if (controller.signal.aborted) return;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Senha alterada com sucesso.");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else
        setPasswordError(
          error instanceof Error
            ? error.message
            : "Não foi possível alterar sua senha.",
        );
    } finally {
      if (!controller.signal.aborted) setPasswordSaving(false);
    }
  }

  const changed = name.trim() !== user.name;
  return (
    <section className="mx-auto w-full max-w-[1200px] py-8 text-sm text-ink max-[600px]:pt-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-2 text-muted">
          Os dados da sua conta, em um só lugar.
        </p>
      </header>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
        <section className="rounded-lg border border-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold">Perfil</h2>
          <p className="mt-2 text-muted">
            Escolha como seu nome aparece no MonviFlow.
          </p>
          <form onSubmit={submit} className="mt-6">
            <fieldset disabled={saving} className="space-y-5">
              <label htmlFor="profile-name" className="block font-medium">
                Nome
                <input
                  id="profile-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNotice("");
                    setError("");
                    setInvalid(false);
                  }}
                  aria-invalid={invalid}
                  aria-describedby={error ? "profile-error" : undefined}
                  className="mt-2 block h-11 w-full rounded-lg border border-control px-3 font-normal outline-none focus:border-accent aria-invalid:border-danger disabled:bg-canvas"
                />
              </label>
              <label htmlFor="profile-email" className="block font-medium">
                E-mail
                <input
                  id="profile-email"
                  type="email"
                  value={user.email}
                  readOnly
                  autoComplete="email"
                  aria-describedby="profile-email-note"
                  className="mt-2 block h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-muted outline-none focus:border-accent"
                />
                <span
                  id="profile-email-note"
                  className="mt-2 block text-xs font-normal text-muted"
                >
                  Este é o e-mail usado para entrar na sua conta.
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={!changed}
                  className="min-h-11 cursor-pointer rounded-lg bg-accent px-5 font-semibold text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
                {changed && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(user.name);
                      setError("");
                      setNotice("");
                      setInvalid(false);
                    }}
                    className="min-h-11 cursor-pointer rounded-lg px-3 font-medium text-muted hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Descartar alterações
                  </button>
                )}
              </div>
            </fieldset>
            {error && (
              <p id="profile-error" role="alert" className="mt-4 text-danger">
                {error}
              </p>
            )}
            <p
              role="status"
              className={notice ? "mt-4 text-accent" : "sr-only"}
            >
              {notice}
            </p>
          </form>
        </section>
        <section className="rounded-lg border border-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold">Sua conta</h2>
          <dl className="mt-5 space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-xs text-muted">Nome</dt>
              <dd className="min-w-0 break-words text-right font-medium">
                {user.name}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-xs text-muted">Membro desde</dt>
              <dd className="min-w-0 text-right font-medium">
                <time dateTime={user.createdAt}>
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "long",
                  }).format(new Date(user.createdAt))}
                </time>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-xs text-muted">Moeda</dt>
              <dd className="min-w-0 text-right font-medium">
                Real brasileiro · BRL
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-lg border border-line bg-white p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold">Segurança</h2>
          <p className="mt-2 text-muted">
            Use sua senha atual para definir uma nova.
          </p>
          <form onSubmit={submitPassword} className="mt-6 max-w-2xl">
            <fieldset
              disabled={passwordSaving}
              className="grid gap-5 sm:grid-cols-2"
            >
              <label
                htmlFor="current-password"
                className="block font-medium sm:col-span-2"
              >
                Senha atual
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    setPasswordError("");
                    setPasswordNotice("");
                  }}
                  className="mt-2 block h-11 w-full rounded-lg border border-control px-3 font-normal outline-none focus:border-accent disabled:bg-canvas"
                />
              </label>
              <label htmlFor="new-password" className="block font-medium">
                Nova senha
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordError("");
                    setPasswordNotice("");
                  }}
                  aria-describedby="password-requirement"
                  className="mt-2 block h-11 w-full rounded-lg border border-control px-3 font-normal outline-none focus:border-accent disabled:bg-canvas"
                />
                <span
                  id="password-requirement"
                  className="mt-2 block text-xs font-normal text-muted"
                >
                  Use pelo menos 8 caracteres.
                </span>
              </label>
              <label htmlFor="confirm-password" className="block font-medium">
                Confirme a nova senha
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setPasswordError("");
                    setPasswordNotice("");
                  }}
                  className="mt-2 block h-11 w-full rounded-lg border border-control px-3 font-normal outline-none focus:border-accent disabled:bg-canvas"
                />
              </label>
            </fieldset>
            <button
              type="submit"
              disabled={
                passwordSaving ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="mt-5 min-h-11 cursor-pointer rounded-lg bg-accent px-5 font-semibold text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
            >
              {passwordSaving ? "Salvando…" : "Alterar senha"}
            </button>
            {passwordError && (
              <p role="alert" className="mt-4 text-danger">
                {passwordError}
              </p>
            )}
            <p
              role="status"
              className={passwordNotice ? "mt-4 text-accent" : "sr-only"}
            >
              {passwordNotice}
            </p>
          </form>
        </section>
      </div>
    </section>
  );
}
