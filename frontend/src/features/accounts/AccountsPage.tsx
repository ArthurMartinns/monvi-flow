import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  renameAccount,
} from "../../lib/accounts";
import type { Account } from "../../lib/accounts";
import { ApiError } from "../../lib/http";
import { formatMoney, parseBalance } from "../../lib/money";
import { sumBalances } from "./accountTotals";

const primaryButtonClass =
  "inline-flex min-h-11 w-auto shrink-0 cursor-pointer items-center justify-center gap-[9px] justify-self-start rounded-xl border border-transparent bg-accent px-5 py-2.5 text-sm leading-[22px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#0b624d]  focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none @min-[541px]:justify-self-end";
const accountIconClass =
  "grid size-8 shrink-0 place-items-center text-muted";
const amountClass =
  "m-0 mt-[5px] text-[27px] leading-[1.3] font-semibold tracking-[-.025em] text-accent tabular-nums [overflow-wrap:anywhere] data-[negative=true]:text-[#8c5b3e]";
const inputClass =
  "block m-0 h-11 w-full rounded-[10px] border border-control bg-white px-3.5 py-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-[#004d3c] focus:ring-2 focus:ring-accent/15 aria-invalid:border-[#c86d64] motion-reduce:transition-none";

function WalletIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7" />
      <path d="M20 13h-4v4h4M17.5 15h.01" />
    </svg>
  );
}

type Props = { onSessionExpired: () => void };

export default function AccountsPage({ onSessionExpired }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [modal, setModal] = useState<"create" | Account | null>(null);
  const [accountAction, setAccountAction] = useState<
    "details" | "rename" | "delete"
  >("details");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError("");
    listAccounts(controller.signal)
      .then((accounts) => {
        if (!controller.signal.aborted) setAccounts(accounts);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired();
        else
          setListError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as contas.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, onSessionExpired]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.close();
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else pageRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
  }, [modal]);

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      pageRef.current
        ?.querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((menu) => {
          if (!menu.contains(event.target as Node)) menu.open = false;
        });
    }
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);

  function openCreate(button: HTMLButtonElement) {
    triggerRef.current = button;
    setFormError("");
    setFields([]);
    setNotice("");
    setModal("create");
  }

  function openDetails(
    account: Account,
    button: HTMLButtonElement,
    action: "details" | "rename" | "delete" = "details",
  ) {
    const menu = button.closest("details");
    triggerRef.current = menu?.querySelector("summary") ?? null;
    if (menu) menu.open = false;
    setAccountAction(action);
    setFormError("");
    setFields([]);
    setNotice("");
    setModal(account);
  }

  async function submitAccountAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount || saving || accountAction === "details") return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    setFormError("");
    setFields([]);
    if (accountAction === "rename" && !name) {
      setFields(["name"]);
      setFormError("Informe o nome da conta.");
      return;
    }
    setSaving(true);
    try {
      if (accountAction === "rename") {
        const updated = await renameAccount(selectedAccount.id, name);
        setAccounts((accounts) =>
          accounts.map((account) =>
            account.id === updated.id ? updated : account,
          ),
        );
        setNotice("Conta renomeada com sucesso.");
      } else {
        await deleteAccount(selectedAccount.id);
        setAccounts((accounts) =>
          accounts.filter((account) => account.id !== selectedAccount.id),
        );
        setNotice("Conta excluída.");
      }
      setModal(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else {
        setFormError(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação.",
        );
        if (error instanceof ApiError) setFields(error.fields);
      }
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    setFormError("");
    setNotice("");
    setFields([]);
    if (!name) {
      setFields(["name"]);
      setFormError("Informe o nome da conta.");
      return;
    }

    let balance: string;
    try {
      balance = parseBalance(String(data.get("initialBalance") ?? ""));
    } catch (error) {
      setFields(["initialBalance"]);
      setFormError((error as Error).message);
      return;
    }

    setSaving(true);
    try {
      const account = await createAccount(name, balance);
      setAccounts((accounts) => [...accounts, account]);
      form.reset();
      setModal(null);
      setNotice("Conta criada com sucesso.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else {
        setFormError(
          error instanceof Error
            ? error.message
            : "Não foi possível criar a conta.",
        );
        if (error instanceof ApiError) setFields(error.fields);
      }
    } finally {
      setSaving(false);
    }
  }

  const total = sumBalances(accounts.map((account) => account.currentBalance));
  const selectedAccount = modal && modal !== "create" ? modal : null;

  return (
    <section
      ref={pageRef}
      id="contas"
      className={
        "@container mx-auto w-full max-w-[1120px] bg-canvas pt-8 pb-10 text-sm leading-normal text-ink max-[600px]:pt-6"
      }
      aria-labelledby="accounts-title"
    >
      <header
        className={
          "grid grid-cols-[minmax(0,1fr)] items-center gap-5 @min-[541px]:grid-cols-[minmax(0,1fr)_auto] @min-[541px]:gap-6"
        }
      >
        <div className={"min-w-0"}>
          <h1
            id="accounts-title"
            className={
              "m-0 text-2xl leading-[1.2] font-semibold tracking-[-.035em] @min-[541px]:text-2xl"
            }
          >
            Minhas contas
          </h1>
          <p className={"m-0 mt-2.5 text-sm leading-[22px] text-muted"}>
            Gerencie seu dinheiro em um só lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => openCreate(event.currentTarget)}
          disabled={loading || Boolean(listError)}
          className={primaryButtonClass}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova conta
        </button>
      </header>

      <section
        aria-label="Saldo consolidado"
        className={
          "mt-8 flex items-start justify-between gap-4 rounded-lg border border-[#dde6d6] bg-soft p-6 @min-[541px]:gap-6 @min-[541px]:px-7 @min-[541px]:py-[26px]"
        }
      >
        <div className={"min-w-0"}>
          <p className={"m-0 text-sm text-[#526a59]"}>Saldo total das contas</p>
          <p
            className={
              "m-0 mt-[15px] text-[30px] leading-[1.25] font-semibold tracking-[-.035em] text-accent tabular-nums [overflow-wrap:anywhere] @min-[541px]:text-[34px]"
            }
          >
            {loading || listError ? "—" : formatMoney(total)}
          </p>
          <p className={"m-0 mt-2.5 text-[13px] text-[#526a59]"}>
            {loading
              ? "Carregando suas contas…"
              : listError
                ? "Saldo indisponível"
                : "Distribuído em " +
                  accounts.length +
                  (accounts.length === 1 ? " conta" : " contas")}
          </p>
        </div>
        <span
          className={
            "grid size-8 shrink-0 place-items-center text-muted"
          }
        >
          <WalletIcon />
        </span>
      </section>

      {notice && (
        <p role="status" className={"m-0 mt-5 text-[13px] text-accent"}>
          {notice}
        </p>
      )}

      <div
        className={
          "mt-8 mb-5 flex flex-wrap items-center justify-between gap-3 [&>h2]:m-0 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-[-.015em] [&>span]:text-xs [&>span]:text-muted @min-[541px]:[&>span]:text-[13px]"
        }
      >
        <h2>Suas contas</h2>
        {!loading && !listError && (
          <span>
            {accounts.length}{" "}
            {accounts.length === 1 ? "conta cadastrada" : "contas cadastradas"}
          </span>
        )}
      </div>

      <div aria-busy={loading}>
        {loading ? (
          <p
            role="status"
            className={
              "m-0 rounded-lg border border-line bg-white p-7 text-muted"
            }
          >
            Carregando suas contas…
          </p>
        ) : listError ? (
          <div
            className={
              "m-0 rounded-lg border border-line bg-white p-7 text-muted"
            }
          >
            <p role="alert" className={"m-0 text-sm text-[#a33932]"}>
              {listError}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className={
                "mt-5 inline-flex min-h-11 w-auto cursor-pointer items-center justify-center rounded-xl border border-transparent bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0b624d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c]"
              }
            >
              Tentar novamente
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div
            className={
              "flex flex-col items-center rounded-lg border border-dashed border-[#ccd6c5] bg-[#f9faf6] px-6 py-12 text-center [&>h3]:m-0 [&>h3]:mt-5 [&>h3]:text-[19px] [&>h3]:font-semibold [&>h3]:tracking-[-.02em] [&>p]:m-0 [&>p]:mt-[9px] [&>p]:mb-6 [&>p]:max-w-[300px] [&>p]:leading-[23px] [&>p]:text-muted"
            }
          >
            <span
              className={
                "grid size-[52px] shrink-0 place-items-center rounded-[15px] bg-[#e9efe2] text-accent"
              }
            >
              <WalletIcon />
            </span>
            <h3>Seu primeiro passo começa aqui</h3>
            <p>
              Adicione uma conta para acompanhar seus saldos em um só lugar.
            </p>
            <button
              type="button"
              onClick={(event) => openCreate(event.currentTarget)}
              className={primaryButtonClass}
            >
              Criar primeira conta
            </button>
          </div>
        ) : (
          <ul
            className={
              "m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-[22px] p-0 @min-[640px]:grid-cols-2"
            }
            aria-label="Suas contas"
          >
            {accounts.map((account, index) => (
              <li
                key={account.id}
                className={
                  "min-w-0 rounded-lg border border-line bg-white p-6  transition-[transform,border-color,box-shadow] duration-200  hover:border-[#b9c9b3]  motion-reduce:hover:translate-y-0 motion-reduce:transition-none"
                }
              >
                <div className={"flex items-center justify-between gap-4"}>
                  <span className={accountIconClass} data-tone={index % 3}>
                    <WalletIcon />
                  </span>
                  <details
                    className={"relative"}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.currentTarget.open = false;
                        event.currentTarget.querySelector("summary")?.focus();
                      }
                    }}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget))
                        event.currentTarget.open = false;
                    }}
                  >
                    <summary
                      aria-label={"Ações da conta " + account.name}
                      title="Ações da conta"
                      className={
                        "grid size-8 cursor-pointer list-none place-items-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-[#f1f4ed] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] [&::-webkit-details-marker]:hidden"
                      }
                    >
                      <svg
                        aria-hidden="true"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="19" cy="12" r="1.5" />
                      </svg>
                    </summary>
                    <div
                      className={
                        "absolute top-10 right-0 z-5 w-40 rounded-xl border border-line bg-white p-1.5 shadow-[0_8px_24px_#153c3212] [&>button]:w-full [&>button]:cursor-pointer [&>button]:rounded-[7px] [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-3 [&>button]:py-2.5 [&>button]:text-left [&>button]:text-[13px] [&>button]:text-ink [&>button:hover]:bg-[#f4f6f0] [&>button:focus-visible]:outline-2 [&>button:focus-visible]:outline-offset-2 [&>button:focus-visible]:outline-[#004d3c]"
                      }
                    >
                      <button
                        type="button"
                        onClick={(event) =>
                          openDetails(account, event.currentTarget)
                        }
                      >
                        Ver detalhes
                      </button>
                      <button
                        type="button"
                        onClick={(event) =>
                          openDetails(account, event.currentTarget, "rename")
                        }
                      >
                        Renomear
                      </button>
                      <button
                        type="button"
                        onClick={(event) =>
                          openDetails(account, event.currentTarget, "delete")
                        }
                      >
                        Excluir conta
                      </button>
                    </div>
                  </details>
                </div>
                <h3
                  className={
                    "m-0 mt-5 text-[17px] leading-6 font-semibold tracking-[-.015em] [overflow-wrap:anywhere]"
                  }
                >
                  {account.name}
                </h3>
                <dl className={"m-0 mt-5"}>
                  <div className={"[&>dt]:text-[13px] [&>dt]:text-muted"}>
                    <dt>Saldo atual</dt>
                    <dd
                      className={amountClass}
                      data-negative={account.currentBalance.startsWith("-")}
                    >
                      {formatMoney(account.currentBalance)}
                    </dd>
                  </div>
                  <div
                    className={
                      "mt-[22px] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-[#e9ede6] pt-[15px] text-[13px] [&>dt]:text-muted [&>dd]:m-0 [&>dd]:font-medium [&>dd]:tabular-nums [&>dd]:[overflow-wrap:anywhere]"
                    }
                  >
                    <dt>Saldo inicial</dt>
                    <dd>{formatMoney(account.initialBalance)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className={
          "fixed inset-0 m-auto max-h-[calc(100dvh-40px)] w-[min(460px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-line bg-[#fffefa] p-0 text-ink shadow-[0_24px_80px_#10271f30] backdrop:bg-[#182c244d] "
        }
        aria-labelledby="account-modal-title"
        aria-describedby="account-modal-description"
        onClose={() => setModal(null)}
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !saving) setModal(null);
        }}
      >
        <div className={"p-6 min-[601px]:p-7"}>
          <div className={"flex items-center justify-between gap-4"}>
            <span className={accountIconClass}>
              <WalletIcon />
            </span>
            <button
              type="button"
              onClick={() => setModal(null)}
              disabled={saving}
              aria-label="Fechar janela"
              className={
                "grid size-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-[#f1f4ed] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
          <h2
            id="account-modal-title"
            className={
              "m-0 mt-6 text-[27px] leading-[1.25] font-semibold tracking-[-.03em] [overflow-wrap:anywhere]"
            }
          >
            {selectedAccount
              ? accountAction === "rename"
                ? "Renomear conta"
                : accountAction === "delete"
                  ? "Excluir conta?"
                  : selectedAccount.name
              : "Nova conta"}
          </h2>
          <p
            id="account-modal-description"
            className={"m-0 mt-2.5 text-sm leading-[23px] text-muted"}
          >
            {selectedAccount
              ? accountAction === "rename"
                ? "Altere o nome. Os saldos serão mantidos."
                : accountAction === "delete"
                  ? `A conta “${selectedAccount.name}” será excluída. Esta ação não pode ser desfeita.`
                  : "Os saldos desta conta, em reais."
              : "Dê um nome à conta e informe seu saldo de partida."}
          </p>

          {modal === "create" && (
            <form onSubmit={submit} aria-busy={saving} className={"mt-7"}>
              <fieldset
                disabled={saving}
                className={"m-0 grid min-w-0 gap-[22px] border-0 p-0"}
              >
                <div
                  className={
                    "grid gap-[9px] [&>label]:text-[13px] [&>label]:font-semibold"
                  }
                >
                  <label htmlFor="account-name">Nome da conta</label>
                  <input
                    id="account-name"
                    name="name"
                    className={inputClass}
                    autoFocus
                    required
                    maxLength={100}
                    placeholder="Ex.: Carteira, conta corrente…"
                    aria-invalid={fields.includes("name")}
                    aria-describedby={
                      fields.includes("name") ? "account-error" : undefined
                    }
                  />
                </div>
                <div
                  className={
                    "grid gap-[9px] [&>label]:text-[13px] [&>label]:font-semibold"
                  }
                >
                  <label htmlFor="initial-balance">Saldo inicial</label>
                  <div
                    className={
                      "relative [&>span]:pointer-events-none [&>span]:absolute [&>span]:top-1/2 [&>span]:left-3.5 [&>span]:-translate-y-1/2 [&>span]:text-sm [&>span]:text-muted [&>input]:pl-11 [&>input]:tabular-nums"
                    }
                  >
                    <span aria-hidden="true">R$</span>
                    <input
                      id="initial-balance"
                      name="initialBalance"
                      className={inputClass}
                      type="text"
                      inputMode="decimal"
                      required
                      maxLength={32}
                      defaultValue="0,00"
                      aria-label="Saldo inicial em reais"
                      aria-invalid={fields.includes("initialBalance")}
                      aria-describedby={
                        fields.includes("initialBalance")
                          ? "account-error balance-help"
                          : "balance-help"
                      }
                    />
                  </div>
                  <p
                    id="balance-help"
                    className={"m-0 text-xs leading-[19px] text-muted"}
                  >
                    Use o formato 1.250,90. Valores negativos são permitidos.
                  </p>
                </div>
                {formError && (
                  <p
                    id="account-error"
                    role="alert"
                    className={
                      "m-0 rounded-[10px] bg-[#fcf0ec] px-3.5 py-3 text-[13px] text-[#a33932]"
                    }
                  >
                    {formError}
                  </p>
                )}
                <div
                  className={
                    "mt-0.5 flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-[22px]"
                  }
                >
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className={
                      "inline-flex min-h-11 w-auto shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-transparent px-5 py-2.5 text-sm leading-[22px] font-medium text-[#657160] hover:bg-[#f0f3eb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    Cancelar
                  </button>
                  <button type="submit" className={primaryButtonClass}>
                    {saving ? "Criando…" : "Criar conta"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {selectedAccount && accountAction !== "details" && (
            <form
              onSubmit={submitAccountAction}
              aria-busy={saving}
              className="mt-7"
            >
              <fieldset
                disabled={saving}
                className="m-0 grid min-w-0 gap-5 border-0 p-0"
              >
                {accountAction === "rename" && (
                  <div className="grid gap-2">
                    <label
                      htmlFor="rename-account"
                      className="text-sm font-medium"
                    >
                      Nome da conta
                    </label>
                    <input
                      id="rename-account"
                      name="name"
                      className={inputClass}
                      defaultValue={selectedAccount.name}
                      autoFocus
                      required
                      maxLength={100}
                      aria-invalid={fields.includes("name")}
                      aria-describedby={
                        fields.includes("name")
                          ? "account-action-error"
                          : undefined
                      }
                    />
                  </div>
                )}
                {formError && (
                  <p
                    id="account-action-error"
                    role="alert"
                    className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
                  >
                    {formError}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    autoFocus={accountAction === "delete"}
                    className="min-h-11 cursor-pointer rounded-xl border border-line px-5 text-sm text-[#657160] hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c]"
                  >
                    Cancelar
                  </button>
                  {accountAction === "rename" ? (
                    <button type="submit" className={primaryButtonClass}>
                      {saving ? "Salvando…" : "Salvar nome"}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="min-h-11 cursor-pointer rounded-xl bg-[#a33932] px-5 text-sm font-semibold text-white hover:bg-[#892e29] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a33932] disabled:cursor-wait disabled:opacity-50"
                    >
                      {saving ? "Excluindo…" : "Excluir conta"}
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          )}

          {selectedAccount && accountAction === "details" && (
            <dl
              className={
                "m-0 mt-[26px] rounded-[14px] border border-line bg-[#f5f7f0] p-5 [&>div+div]:mt-5 [&>div+div]:border-t [&>div+div]:border-line [&>div+div]:pt-4 [&_dt]:text-[13px] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:mt-2 [&_dd]:tabular-nums [&_dd]:[overflow-wrap:anywhere]"
              }
            >
              <div>
                <dt>Saldo atual</dt>
                <dd className={amountClass}>
                  {formatMoney(selectedAccount.currentBalance)}
                </dd>
              </div>
              <div>
                <dt>Saldo inicial</dt>
                <dd>{formatMoney(selectedAccount.initialBalance)}</dd>
              </div>
            </dl>
          )}
        </div>
      </dialog>
    </section>
  );
}
