import { useEffect, useRef, useState } from "react";
import RowMenu from "../../components/RowMenu";
import type { FormEvent } from "react";
import { listAccounts } from "../../lib/accounts";
import type { Account } from "../../lib/accounts";
import { listCategories } from "../../lib/categories";
import type { Category, CategoryType } from "../../lib/categories";
import { ApiError } from "../../lib/http";
import { formatMoney, parseBalance } from "../../lib/money";
import { readTransactionFilters, transactionsHref } from "../../lib/navigation";
import {
  createTransaction,
  deleteTransaction,
  exportTransactions,
  searchTransactions,
  updateTransaction,
} from "../../lib/transactions";
import type { Transaction, TransactionFilters } from "../../lib/transactions";

const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b624d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "mt-2 block h-11 w-full rounded-xl border border-control bg-white px-3.5 text-sm text-ink outline-none focus:border-[#004d3c] focus:ring-3 focus:ring-[#004d3c]/5 aria-invalid:border-red-600";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type Modal =
  | { action: "create" }
  | { action: "edit" | "delete"; transaction: Transaction };

export default function TransactionsPage({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<TransactionFilters>(readTransactionFilters);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [filterError, setFilterError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportRef = useRef<AbortController | null>(null);
  const filterFormRef = useRef<HTMLFormElement>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    history.replaceState(null, "", transactionsHref(readTransactionFilters()));
    function restoreFilters() {
      if (window.location.hash.split("?")[0] !== "#movimentacoes") return;
      setLoading(true);
      setError("");
      setFilterError("");
      setNotice("");
      setModal(null);
      const next = readTransactionFilters();
      history.replaceState(null, "", transactionsHref(next));
      setFilters(next);
    }
    window.addEventListener("hashchange", restoreFilters);
    return () => window.removeEventListener("hashchange", restoreFilters);
  }, []);

  useEffect(() => () => exportRef.current?.abort(), []);

  async function downloadCsv() {
    if (exporting) { exportRef.current?.abort(); return; }
    const controller = new AbortController();
    exportRef.current = controller;
    setExporting(true);
    setExportError("");
    try {
      const blob = await exportTransactions(filters, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `movimentacoes-${today()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setExportError(error instanceof Error ? error.message : "Não foi possível exportar as movimentações.");
    } finally {
      exportRef.current = null;
      setExporting(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let correctedPage = false;
    Promise.all([
      searchTransactions(filters, controller.signal),
      listAccounts(controller.signal),
      listCategories(controller.signal),
    ])
      .then(([result, accounts, categories]) => {
        if (controller.signal.aborted) return;
        if (result.page > 0 && result.page >= result.totalPages) {
          correctedPage = true;
          const next = {
            ...filters,
            page: Math.max(0, result.totalPages - 1),
          };
          history.replaceState(null, "", transactionsHref(next));
          setFilters(next);
          return;
        }
        setTransactions(result.content);
        setTotal(result.totalElements);
        setPages(result.totalPages);
        setAccounts(accounts);
        setCategories(categories);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired();
        else
          setError(
            error instanceof ApiError && error.status === 404
              ? "A API de movimentações não está disponível. Reinicie o backend atualizado e tente novamente."
              : error instanceof Error
                ? error.message
                : "Não foi possível carregar as movimentações.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted && !correctedPage) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, filters, onSessionExpired]);

  function reload() {
    setLoading(true);
    setError("");
    setAttempt((value) => value + 1);
  }

  function changeFilters(next: TransactionFilters) {
    setLoading(true);
    setError("");
    setNotice("");
    setFilterError("");
    const href = transactionsHref(next);
    if (window.location.hash !== href) history.pushState(null, "", href);
    setFilters(next);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const from = String(form.get("from") ?? "");
    const to = String(form.get("to") ?? "");
    if (from && to && from > to) {
      setFilterError("A data inicial deve ser anterior ou igual à data final.");
      return;
    }
    setFilterError("");
    const value = String(form.get("filterType") ?? "");
    changeFilters({
      from,
      to,
      accountId: String(form.get("filterAccount") ?? ""),
      categoryId: String(form.get("filterCategory") ?? ""),
      query: String(form.get("query") ?? "").trim(),
      type: value === "INCOME" || value === "EXPENSE" ? value : "",
      page: 0,
      size: 20,
    });
  }

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

  function openModal(next: Modal, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setType(
      next.action === "create"
        ? filters.type || (categories.some((category) => category.type === "EXPENSE")
          ? "EXPENSE"
          : "INCOME")
        : next.transaction.type,
    );
    setFormError("");
    setFields([]);
    setNotice("");
    setModal(next);
  }

  function showFormError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) onSessionExpired();
    else {
      setFormError(
        error instanceof ApiError && error.status === 404
          ? "A movimentação, conta ou categoria não está mais disponível. Atualize a página."
          : error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação.",
      );
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
      setModal(null);
      setNotice("Movimentação excluída. O saldo da conta foi atualizado.");
      reload();
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
    if (!accounts.some((account) => account.id === accountId))
      invalid.push("accountId");
    if (
      !categories.some(
        (category) => category.id === categoryId && category.type === type,
      )
    )
      invalid.push("categoryId");
    if (invalid.length) {
      setFields(invalid);
      setFormError("Confira os campos informados.");
      return;
    }
    let amount: string;
    try {
      amount = parseBalance(String(form.get("amount") ?? ""));
      if (amount.startsWith("-") || amount === "0.00")
        throw new Error("Informe um valor maior que zero.");
    } catch (error) {
      setFields(["amount"]);
      setFormError(
        error instanceof Error ? error.message : "Informe um valor válido.",
      );
      return;
    }
    setSaving(true);
    try {
      const data = { accountId, categoryId, description, amount, date };
      if (modal.action === "edit")
        await updateTransaction(modal.transaction.id, data);
      else await createTransaction(data);
      setModal(null);
      setNotice(
        modal.action === "edit"
          ? "Movimentação atualizada. Os saldos foram recalculados."
          : "Movimentação registrada. O saldo da conta foi atualizado.",
      );
      reload();
    } catch (error) {
      showFormError(error);
    } finally {
      setSaving(false);
    }
  }

  const canCreate =
    !loading && !error && accounts.length > 0 && categories.length > 0;
  const availableCategories = categories.filter(
    (category) => category.type === type,
  );
  const selected =
    modal && modal.action !== "create" ? modal.transaction : null;

  return (
    <section
      id="movimentacoes"
      className="mx-auto w-full max-w-[1120px] pt-8 pb-10 text-sm text-ink max-[600px]:pt-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">
            Movimentações
          </h1>
          <p className="mt-2 leading-relaxed text-muted">
            Acompanhe o que entra e o que sai das suas contas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!exporting && (loading || !!error || total === 0)} onClick={downloadCsv} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-control bg-white px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-not-allowed disabled:opacity-50">{exporting ? "Cancelar exportação" : "Exportar CSV"}</button>
        <button
          ref={triggerRef}
          type="button"
          disabled={!canCreate}
          className={buttonClass}
          onClick={(event) =>
            openModal({ action: "create" }, event.currentTarget)
          }
        >
          <span aria-hidden="true" className="text-lg font-normal">
            +
          </span>{" "}
          Nova movimentação
        </button>
        </div>
      </header>

      <p role="status" className={notice ? "mt-4 text-accent" : "sr-only"}>
        {notice}
      </p>
      {exportError && <p role="alert" className="mt-3 text-sm text-red-800">{exportError}</p>}
      {exporting && <p role="status" className="mt-3 text-sm text-muted">Preparando todos os resultados dos filtros aplicados…</p>}

      <details className="mt-5 rounded-lg border border-line bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" /></svg>
        Filtros
        <span className="ml-auto text-xs font-normal text-muted">{(() => {
          const count = Object.entries(filters).filter(([key, value]) => key !== "page" && key !== "size" && value !== "" && value !== undefined).length;
          return count ? `${count} ${count === 1 ? "aplicado" : "aplicados"}` : "Nenhum filtro aplicado";
        })()}</span>
      </summary>
      <form
        key={`${transactionsHref(filters)}:${accounts.map((account) => account.id).join(",")}:${categories.map((category) => category.id).join(",")}`}
        ref={filterFormRef}
        onSubmit={applyFilters}
        aria-label="Filtrar movimentações"
        className="border-t border-line p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-medium text-muted">
            Buscar descrição
            <input
              name="query"
              defaultValue={filters.query ?? ""}
              type="search"
              maxLength={100}
              placeholder="Ex.: mercado"
              className={inputClass}
            />
          </label>
          <label className="text-xs font-medium text-muted">
            De
            <input
              name="from"
              defaultValue={filters.from ?? ""}
              type="date"
              className={`${inputClass} min-w-0`}
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Até
            <input name="to" type="date" defaultValue={filters.to ?? ""} className={`${inputClass} min-w-0`} />
          </label>
          <label className="text-xs font-medium text-muted">
            Conta
            <select name="filterAccount" defaultValue={filters.accountId ?? ""} className={inputClass}>
              <option value="">Todas as contas</option>
              {filters.accountId && !accounts.some((account) => String(account.id) === filters.accountId) && <option value={filters.accountId}>Conta indisponível</option>}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Tipo
            <select name="filterType" defaultValue={filters.type ?? ""} className={inputClass}>
              <option value="">Receitas e despesas</option>
              <option value="INCOME">Receita</option>
              <option value="EXPENSE">Despesa</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Categoria
            <select
              name="filterCategory"
              defaultValue={filters.categoryId ?? ""}
              className={inputClass}
            >
              <option value="">Todas as categorias</option>
              {filters.categoryId && !categories.some((category) => String(category.id) === filters.categoryId) && <option value={filters.categoryId}>Categoria indisponível</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              filterFormRef.current?.reset();
              setFilterError("");
              changeFilters({ page: 0, size: 20 });
            }}
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-[#004d3c]"
          >
            Limpar filtros
          </button>
          <button type="submit" className={buttonClass}>
            Aplicar filtros
          </button>
        </div>
        {filterError && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {filterError}
          </p>
        )}
      </form>
      </details>

      {loading ? (
        <p role="status" className="py-12 text-muted">
          Carregando movimentações…
        </p>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-white p-6">
          <p role="alert" className="text-red-800">
            {error}
          </p>
          <button
            type="button"
            className={`${buttonClass} mt-4`}
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {!canCreate && (
            <p className="mt-5 rounded-lg bg-[#f1f3ee] p-5 leading-relaxed text-[#705139]">
              Para registrar movimentações, cadastre{" "}
              {accounts.length === 0 && <a href="#contas" className="font-semibold underline underline-offset-4">uma conta</a>}
              {accounts.length === 0 && categories.length === 0 && " e "}
              {categories.length === 0 && <a href="#categorias" className="font-semibold underline underline-offset-4">uma categoria</a>}
              .
            </p>
          )}
          {transactions.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-control bg-white px-6 py-14 text-center">
              <h2 className="text-lg font-semibold">
                Nenhuma movimentação encontrada
              </h2>
              <p className="mt-2 text-muted">
                Registre um lançamento ou ajuste os filtros para consultar outro
                período.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-line bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <h2 className="text-base font-semibold">Histórico</h2>
                <span className="text-xs text-muted">
                  {total}{" "}
                  {total === 1
                    ? "registro encontrado"
                    : "registros encontrados"}
                </span>
              </div>
              <ul className="divide-y divide-[#edf0e9]">
                {transactions.map((transaction) => (
                  <li
                    key={transaction.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_36px] items-center gap-3 px-4 py-4 sm:grid-cols-[28px_minmax(0,1fr)_auto_36px] sm:px-5 transition-colors hover:bg-canvas motion-reduce:transition-none"
                  >
                    <span
                      aria-hidden="true"
                      className="hidden size-7 shrink-0 place-items-center text-muted sm:grid"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={
                          transaction.type === "EXPENSE"
                            ? "rotate-90"
                            : undefined
                        }
                      >
                        <path d="M6 18 18 6M6 6h12v12" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium break-words">
                        {transaction.description}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed break-words text-muted">
                        {transaction.categoryName} · {transaction.accountName}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        <time dateTime={transaction.date}>
                          {transaction.date.split("-").reverse().join("/")}
                        </time>{" "}
                        ·{" "}
                        {transaction.type === "INCOME" ? "Receita" : "Despesa"}
                      </p>
                    </div>
                    <p
                      className={`ml-auto max-w-full text-right text-base font-semibold break-words tabular-nums ${transaction.type === "INCOME" ? "text-accent" : "text-ink"}`}
                    >
                      {transaction.type === "INCOME" ? "+" : "−"}{" "}
                      {formatMoney(transaction.amount)}
                    </p>
                    <RowMenu name={transaction.description} actions={[
                      { label: "Editar", onSelect: (trigger) => openModal({ action: "edit", transaction }, trigger) },
                      { label: "Excluir", danger: true, onSelect: (trigger) => openModal({ action: "delete", transaction }, trigger) },
                    ]} />
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <nav
                  aria-label="Páginas de movimentações"
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-sm"
                >
                  <button
                    type="button"
                    disabled={filters.page === 0}
                    onClick={() =>
                      changeFilters({ ...filters, page: filters.page - 1 })
                    }
                    className="cursor-pointer rounded-lg border border-control px-3 py-2 hover:bg-[#e9efe2] disabled:cursor-default disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-muted">
                    Página {filters.page + 1} de {pages}
                  </span>
                  <button
                    type="button"
                    disabled={filters.page + 1 >= pages}
                    onClick={() =>
                      changeFilters({ ...filters, page: filters.page + 1 })
                    }
                    className="cursor-pointer rounded-lg border border-control px-3 py-2 hover:bg-[#e9efe2] disabled:cursor-default disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </nav>
              )}
            </div>
          )}
        </>
      )}

      {modal && (
        <dialog
          ref={dialogRef}
          aria-labelledby="transaction-title"
          aria-describedby="transaction-description"
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-line bg-canvas p-6 text-ink shadow-xl backdrop:bg-[#153c32]/35  sm:p-8"
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) setModal(null);
          }}
        >
          <h2
            id="transaction-title"
            className="text-2xl font-semibold tracking-tight"
          >
            {modal.action === "create"
              ? "Nova movimentação"
              : modal.action === "edit"
                ? "Editar movimentação"
                : "Excluir movimentação"}
          </h2>
          <p
            id="transaction-description"
            className="mt-2 text-sm leading-relaxed text-muted"
          >
            {modal.action === "delete" ? (
              <>
                Excluir{" "}
                <strong className="break-words">
                  {modal.transaction.description}
                </strong>{" "}
                de {formatMoney(modal.transaction.amount)}? O saldo será
                recalculado. Esta ação não pode ser desfeita.
              </>
            ) : modal.action === "edit" ? (
              "Altere os dados do lançamento. Os saldos serão recalculados."
            ) : (
              "Registre uma entrada ou saída já realizada."
            )}
          </p>
          <form
            onSubmit={modal.action === "delete" ? remove : submit}
            className="mt-6"
          >
            {modal.action !== "delete" && (
              <fieldset
                disabled={saving}
                className="space-y-5 disabled:opacity-60"
              >
                <fieldset className="flex gap-3">
                  <legend className="mb-2 text-sm font-medium">Tipo</legend>
                  {(["EXPENSE", "INCOME"] as const).map((option) => (
                    <label
                      key={option}
                      className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-[#004d3c] ${type === option ? "border-[#004d3c] bg-[#e9efe2]" : "border-control bg-white"}`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={option}
                        checked={type === option}
                        onChange={() => setType(option)}
                        className="accent-[#004d3c]"
                      />
                      {option === "INCOME" ? "Receita" : "Despesa"}
                    </label>
                  ))}
                </fieldset>
                <label
                  className="block text-sm font-medium"
                  htmlFor="transaction-description-input"
                >
                  Descrição
                  <input
                    id="transaction-description-input"
                    name="description"
                    defaultValue={selected?.description ?? ""}
                    required
                    maxLength={255}
                    autoFocus
                    placeholder="Ex.: Compras do mercado"
                    aria-invalid={fields.includes("description")}
                    className={inputClass}
                  />
                </label>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label
                    className="block text-sm font-medium"
                    htmlFor="transaction-amount"
                  >
                    Valor (R$)
                    <input
                      id="transaction-amount"
                      name="amount"
                      defaultValue={selected?.amount.replace(".", ",") ?? ""}
                      required
                      inputMode="decimal"
                      placeholder="0,00"
                      autoComplete="off"
                      aria-invalid={fields.includes("amount")}
                      className={inputClass}
                    />
                  </label>
                  <label
                    className="block text-sm font-medium"
                    htmlFor="transaction-date"
                  >
                    Data
                    <input
                      id="transaction-date"
                      name="date"
                      type="date"
                      required
                      defaultValue={selected?.date ?? today()}
                      max={today()}
                      aria-invalid={fields.includes("date")}
                      className={`${inputClass} min-w-0`}
                    />
                  </label>
                </div>
                <label
                  className="block text-sm font-medium"
                  htmlFor="transaction-account"
                >
                  Conta
                  <select
                    id="transaction-account"
                    name="accountId"
                    required
                    defaultValue={selected?.accountId ?? (accounts.some((account) => String(account.id) === filters.accountId) ? filters.accountId : "")}
                    aria-invalid={fields.includes("accountId")}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Selecione uma conta
                    </option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="block text-sm font-medium"
                  htmlFor="transaction-category"
                >
                  Categoria
                  <select
                    key={type}
                    id="transaction-category"
                    name="categoryId"
                    required
                    defaultValue={
                      selected?.type === type ? selected.categoryId : availableCategories.some((category) => String(category.id) === filters.categoryId) ? filters.categoryId : ""
                    }
                    aria-invalid={fields.includes("categoryId")}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Selecione uma categoria
                    </option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                {availableCategories.length === 0 && (
                  <p className="text-sm text-[#8c5b3e]">
                    Cadastre uma{" "}
                    <a
                      href="#categorias"
                      className="font-semibold underline underline-offset-4"
                    >
                      categoria de {type === "INCOME" ? "receita" : "despesa"}
                    </a>{" "}
                    para continuar.
                  </p>
                )}
              </fieldset>
            )}
            {formError && (
              <p role="alert" className="mt-4 text-sm text-red-800">
                {formError}
              </p>
            )}
            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                autoFocus={modal.action === "delete"}
                onClick={() => setModal(null)}
                className="min-h-11 cursor-pointer rounded-xl border border-control px-4 py-2 text-sm font-medium hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  (modal.action !== "delete" &&
                    availableCategories.length === 0)
                }
                data-danger={modal.action === "delete"}
                className={`${buttonClass} data-[danger=true]:bg-red-800 data-[danger=true]:hover:bg-red-900 data-[danger=true]:focus-visible:outline-red-800`}
              >
                {saving
                  ? "Salvando…"
                  : modal.action === "delete"
                    ? "Excluir movimentação"
                    : modal.action === "edit"
                      ? "Salvar alterações"
                      : "Registrar movimentação"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
