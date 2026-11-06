import { useEffect, useState } from "react";
import { ApiError } from "../../lib/http";
import {
  createTelegramLinkCode,
  telegramLinkStatus,
  unlinkTelegram,
} from "../../lib/telegram";
import type { TelegramLinkCode, TelegramLinkStatus } from "../../lib/telegram";

export default function TelegramSettings({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [code, setCode] = useState<TelegramLinkCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    telegramLinkStatus(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setStatus(value);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired();
        else
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível consultar a vinculação.",
          );
      });
    return () => controller.abort();
  }, [onSessionExpired]);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const result = await telegramLinkStatus();
      setStatus(result);
      if (result.linked) setCode(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a vinculação.",
        );
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setCode(await createTelegramLinkCode());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o código.",
        );
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await unlinkTelegram();
      setStatus((current) => ({
        enabled: true,
        linked: false,
        botUsername: current?.botUsername ?? "",
      }));
      setCode(null);
      setNotice("Telegram desvinculado.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível desvincular.",
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 sm:p-6 lg:col-span-2">
      <h2 className="text-base font-semibold">Telegram</h2>
      <p className="mt-2 text-muted">
        Consulte o saldo das suas contas pelo comando /saldo em uma conversa
        privada com o bot.
      </p>
      {!status && !error && (
        <p className="mt-4 text-muted">Consultando vinculação…</p>
      )}
      {status && !status.enabled && (
        <p className="mt-4 text-muted">
          O bot ainda não está configurado neste servidor.
        </p>
      )}
      {status?.enabled && (
        <>
          {status.botUsername && (
            <p className="mt-3">
              <a
                className="font-medium text-accent underline"
                href={`https://t.me/${status.botUsername.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir bot no Telegram
              </a>
            </p>
          )}
          <p className="mt-4">
            {status.linked
              ? "Conta vinculada ao Telegram."
              : "Conta ainda não vinculada."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={status.linked ? unlink : generate}
              className="min-h-11 cursor-pointer rounded-lg bg-accent px-5 font-semibold text-white hover:bg-ink disabled:opacity-50"
            >
              {status.linked ? "Desvincular" : "Gerar código de vinculação"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={refresh}
              className="min-h-11 cursor-pointer rounded-lg border border-control px-4 font-medium disabled:opacity-50"
            >
              Atualizar estado
            </button>
          </div>
          {code && !status.linked && (
            <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
              <p>Envie esta mensagem ao bot em uma conversa privada:</p>
              <code className="mt-2 block select-all break-all font-mono text-sm">
                /vincular {code.code}
              </code>
              <p className="mt-2 text-xs text-muted">
                O código expira em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(code.expiresAt))}
                . Não o compartilhe.
              </p>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-accent">
          {notice}
        </p>
      )}
    </section>
  );
}
