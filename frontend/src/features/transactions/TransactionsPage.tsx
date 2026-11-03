import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { listAccounts } from "../../lib/accounts";
import type { Account } from "../../lib/accounts";
import { listCategories } from "../../lib/categories";
import type { Category, CategoryType } from "../../lib/categories";
import { ApiError } from "../../lib/http";
import { formatMoney, parseBalance } from "../../lib/money";
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from "../../lib/transactions";
import type { Transaction } from "../../lib/transactions";

const buttonClass = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#004d3c] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b624d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "mt-2 block h-12 w-full rounded-xl border border-[#d9e1d4] bg-white px-3.5 text-sm text-[#153c32] outline-none focus:border-[#004d3c] focus:ring-3 focus:ring-[#004d3c]/5 aria-invalid:border-red-600";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type Modal = { action: "create" } | { action: "edit" | "delete"; transaction: Transaction };

export default function TransactionsPage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null);
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listTransactions(controller.signal),
      listAccounts(controller.signal),
      listCategories(controller.signal),
    ])
      .then(([transactions, accounts, categories]) => {
        if (controller.signal.aborted) return;
        setTransactions(transactions);
        setAccounts(accounts);
        setCategories(categories);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) onSessionExpired();
        else setError(error instanceof ApiError && error.status === 404
          ? "A API de movimentações não está disponível. Reinicie o backend atualizado e tente novamente."
          : error instanceof Error ? error.message : "Não foi possível carregar as movimentações.");
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
    const trigger = returnFocusRef.current;
    const fallback = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
      else fallback?.focus();
    };
  }, [modal]);

  function openModal(next: Modal, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setType(next.action === "create"
      ? categories.some((category) => category.type === "EXPENSE") ? "EXPENSE" : "INCOME"
      : next.transaction.type);
    setFormError("");
    setFields([]);
    setNotice("");
    setModal(next);
  }

  function showFormError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) onSessionExpired();
    else {
      setFormError(error instanceof ApiError && error.status === 404
        ? "A movimentação, conta ou categoria não está mais disponível. Atualize a página."
        : error instanceof Error ? error.message : "Não foi possível concluir a operação.");
      if (error instanceof ApiError) setFields(error.fields);
    }
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || modal?.action !== "delete") return;
    setSaving(true);
    setFormError("");
    try {
      await deleteTransaction(modal.transaction.id);
      setTransactions((items) => items.filter((item) => item.id !== modal.transaction.id));
      setModal(null);
      setNotice("Movimentação excluída. O saldo da conta foi atualizado.");
    } catch (error) {
      showFormError(error);
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !modal || modal.action === "delete") return;
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const accountId = Number(form.get("accountId"));
    const categoryId = Number(form.get("categoryId"));
    setFields([]);
    setFormError("");
    const invalid = [];
    if (!description || description.length > 255) invalid.push("description");
    if (!date || date > today()) invalid.push("date");
    if (!accounts.some((account) => account.id === accountId)) invalid.push("accountId");
    if (!categories.some((category) => category.id === categoryId && category.type === type)) invalid.push("categoryId");
    if (invalid.length) {
      setFields(invalid);
      setFormError("Confira os campos informados.");
      return;
    }
    let amount: string;
    try {
      amount = parseBalance(String(form.get("amount") ?? ""));
      if (amount.startsWith("-") || amount === "0.00") throw new Error("Informe um valor maior que zero.");
    } catch (error) {
      setFields(["amount"]);
      setFormError(error instanceof Error ? error.message : "Informe um valor válido.");
      return;
    }
    setSaving(true);
    try {
      const data = { accountId, categoryId, description, amount, date };
      const transaction = modal.action === "edit"
        ? await updateTransaction(modal.transaction.id, data)
        : await createTransaction(data);
      setTransactions((items) => [...items.filter((item) => item.id !== transaction.id), transaction]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
      setModal(null);
      setNotice(modal.action === "edit" ? "Movimentação atualizada. Os saldos foram recalculados." : "Movimentação registrada. O saldo da conta foi atualizado.");
    } catch (error) {
      showFormError(error);
    } finally {
      setSaving(false);
    }
  }

  const canCreate = !loading && !error && accounts.length > 0 && categories.length > 0;
  const availableCategories = categories.filter((category) => category.type === type);
  const selected = modal && modal.action !== "create" ? modal.transaction : null;

  return (
    <section id="movimentacoes" className="mx-auto w-full max-w-[1120px] pt-11 pb-14 text-sm text-[#153c32] max-[600px]:pt-8">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wider text-[#8c5b3e] uppercase">Seu dinheiro em movimento</p>
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight">Movimentações</h1>
          <p className="mt-2 leading-relaxed text-[#748075]">Acompanhe o que entra e o que sai das suas contas.</p>
        </div>
        <button ref={triggerRef} type="button" disabled={!canCreate} className={buttonClass} onClick={(event) => openModal({ action: "create" }, event.currentTarget)}>
          <span aria-hidden="true" className="text-lg font-normal">+</span> Nova movimentação
        </button>
      </header>

      <p role="status" className="mt-5 text-[#004d3c]">{notice}</p>

      {loading ? <p role="status" className="py-12 text-[#748075]">Carregando movimentações…</p> : error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-white p-6">
          <p role="alert" className="text-red-800">{error}</p>
          <button type="button" className={`${buttonClass} mt-4`} onClick={() => {
            setLoading(true);
            setError("");
            setAttempt((value) => value + 1);
          }}>Tentar novamente</button>
        </div>
      ) : (
        <>
          {!canCreate && (
            <p className="mt-5 rounded-2xl bg-[#f2e9d8] p-5 leading-relaxed text-[#705139]">
              Para registrar movimentações, cadastre uma <a href="#contas" className="font-semibold underline underline-offset-4">conta</a> e uma <a href="#categorias" className="font-semibold underline underline-offset-4">categoria</a>.
            </p>
          )}
          {transactions.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d9e1d4] bg-white px-6 py-14 text-center">
              <h2 className="text-lg font-semibold">Nenhuma movimentação por enquanto</h2>
              <p className="mt-2 text-[#748075]">Registre uma receita ou despesa para começar.</p>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#e3e7df] bg-white">
              <div className="flex items-center justify-between gap-3 bg-[#e9efe2] px-5 py-4">
                <h2 className="text-base font-semibold">Histórico</h2>
                <span className="text-xs text-[#63766a]">{transactions.length} {transactions.length === 1 ? "registro" : "registros"}</span>
              </div>
              <ul className="divide-y divide-[#edf0e9]">
                {transactions.map((transaction) => (
                  <li key={transaction.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-5 transition-colors hover:bg-[#fafaf7] motion-reduce:transition-none">
                    <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl ${transaction.type === "INCOME" ? "bg-[#e9efe2] text-[#004d3c]" : "bg-[#f2e9d8] text-[#8c5b3e]"}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={transaction.type === "EXPENSE" ? "rotate-90" : undefined}><path d="M6 18 18 6M6 6h12v12" /></svg>
                    </span>
                    <div className="min-w-0 flex-1 basis-36">
                      <p className="font-medium break-words">{transaction.description}</p>
                      <p className="mt-1 text-xs leading-relaxed break-words text-[#748075]">{transaction.categoryName} · {transaction.accountName}</p>
                      <p className="mt-1 text-xs text-[#748075]"><time dateTime={transaction.date}>{transaction.date.split("-").reverse().join("/")}</time> · {transaction.type === "INCOME" ? "Receita" : "Despesa"}</p>
                    </div>
                    <p className={`ml-auto max-w-full text-right text-base font-semibold break-words tabular-nums ${transaction.type === "INCOME" ? "text-[#004d3c]" : "text-[#8c5b3e]"}`}>{transaction.type === "INCOME" ? "+" : "−"} {formatMoney(transaction.amount)}</p>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" aria-label={`Editar ${transaction.description}`} title="Editar" onClick={(event) => openModal({ action: "edit", transaction }, event.currentTarget)} className="grid size-9 cursor-pointer place-items-center rounded-lg text-[#748075] transition-colors hover:bg-[#e9efe2] hover:text-[#004d3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004d3c]">
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 5 5L9 20l-6 1 1-6L16 3ZM14 5l5 5" /></svg>
                      </button>
                      <button type="button" aria-label={`Excluir ${transaction.description}`} title="Excluir" onClick={(event) => openModal({ action: "delete", transaction }, event.currentTarget)} className="grid size-9 cursor-pointer place-items-center rounded-lg text-[#748075] transition-colors hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {modal && (
        <dialog ref={dialogRef} aria-labelledby="transaction-title" aria-describedby="transaction-description" className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-[#e3e7df] bg-[#fafaf7] p-6 text-[#153c32] shadow-xl backdrop:bg-[#153c32]/35 backdrop:backdrop-blur-sm sm:p-8" onCancel={(event) => {
          event.preventDefault();
          if (!saving) setModal(null);
        }}>
          <h2 id="transaction-title" className="text-2xl font-semibold tracking-tight">{modal.action === "create" ? "Nova movimentação" : modal.action === "edit" ? "Editar movimentação" : "Excluir movimentação"}</h2>
          <p id="transaction-description" className="mt-2 text-sm leading-relaxed text-[#748075]">{modal.action === "delete" ? <>Excluir <strong className="break-words">{modal.transaction.description}</strong> de {formatMoney(modal.transaction.amount)}? O saldo será recalculado. Esta ação não pode ser desfeita.</> : modal.action === "edit" ? "Altere os dados do lançamento. Os saldos serão recalculados." : "Registre uma entrada ou saída já realizada."}</p>
          <form onSubmit={modal.action === "delete" ? remove : submit} className="mt-6">
            {modal.action !== "delete" && <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
              <fieldset className="flex gap-3">
                <legend className="mb-2 text-sm font-medium">Tipo</legend>
                {(["EXPENSE", "INCOME"] as const).map((option) => (
                  <label key={option} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-[#004d3c] ${type === option ? "border-[#004d3c] bg-[#e9efe2]" : "border-[#d9e1d4] bg-white"}`}>
                    <input type="radio" name="type" value={option} checked={type === option} onChange={() => setType(option)} className="accent-[#004d3c]" />{option === "INCOME" ? "Receita" : "Despesa"}
                  </label>
                ))}
              </fieldset>
              <label className="block text-sm font-medium" htmlFor="transaction-description-input">Descrição
                <input id="transaction-description-input" name="description" defaultValue={selected?.description ?? ""} required maxLength={255} autoFocus placeholder="Ex.: Compras do mercado" aria-invalid={fields.includes("description")} className={inputClass} />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium" htmlFor="transaction-amount">Valor (R$)
                  <input id="transaction-amount" name="amount" defaultValue={selected?.amount.replace(".", ",") ?? ""} required inputMode="decimal" placeholder="0,00" autoComplete="off" aria-invalid={fields.includes("amount")} className={inputClass} />
                </label>
                <label className="block text-sm font-medium" htmlFor="transaction-date">Data
                  <input id="transaction-date" name="date" type="date" required defaultValue={selected?.date ?? today()} max={today()} aria-invalid={fields.includes("date")} className={`${inputClass} min-w-0`} />
                </label>
              </div>
              <label className="block text-sm font-medium" htmlFor="transaction-account">Conta
                <select id="transaction-account" name="accountId" required defaultValue={selected?.accountId ?? ""} aria-invalid={fields.includes("accountId")} className={inputClass}>
                  <option value="" disabled>Selecione uma conta</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium" htmlFor="transaction-category">Categoria
                <select key={type} id="transaction-category" name="categoryId" required defaultValue={selected?.type === type ? selected.categoryId : ""} aria-invalid={fields.includes("categoryId")} className={inputClass}>
                  <option value="" disabled>Selecione uma categoria</option>
                  {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              {availableCategories.length === 0 && <p className="text-sm text-[#8c5b3e]">Cadastre uma <a href="#categorias" className="font-semibold underline underline-offset-4">categoria de {type === "INCOME" ? "receita" : "despesa"}</a> para continuar.</p>}
            </fieldset>}
            {formError && <p role="alert" className="mt-4 text-sm text-red-800">{formError}</p>}
            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={saving} autoFocus={modal.action === "delete"} onClick={() => setModal(null)} className="min-h-11 cursor-pointer rounded-xl border border-[#d9e1d4] px-4 py-2 text-sm font-medium hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving || (modal.action !== "delete" && availableCategories.length === 0)} data-danger={modal.action === "delete"} className={`${buttonClass} data-[danger=true]:bg-red-800 data-[danger=true]:hover:bg-red-900 data-[danger=true]:focus-visible:outline-red-800`}>{saving ? "Salvando…" : modal.action === "delete" ? "Excluir movimentação" : modal.action === "edit" ? "Salvar alterações" : "Registrar movimentação"}</button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
