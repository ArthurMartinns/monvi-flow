import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { deleteBudget, listBudgets, saveBudget } from "../../lib/budgets";
import type { Budget } from "../../lib/budgets";
import { listCategories } from "../../lib/categories";
import type { Category } from "../../lib/categories";
import { ApiError } from "../../lib/http";
import { formatMoney, parseBalance } from "../../lib/money";
import { budgetProgress } from "./budgetProgress";

const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b624d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "mt-2 block h-11 w-full rounded-xl border border-control bg-white px-3.5 text-sm text-ink outline-none focus:border-[#004d3c] focus:ring-3 focus:ring-[#004d3c]/5 disabled:bg-stone-100";
type Modal =
  | { action: "create" }
  | { action: "edit" | "delete"; budget: Budget };

export default function BudgetsPage({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [month, setMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listBudgets(month, controller.signal),
      listCategories(controller.signal),
    ])
      .then(([budgets, categories]) => {
        if (controller.signal.aborted) return;
        setBudgets(budgets);
        setCategories(
          categories.filter((category) => category.type === "EXPENSE"),
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired();
        else
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os orçamentos.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, attempt, onSessionExpired]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;
    dialog.showModal();
    const trigger = triggerRef.current;
    const fallback = createRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
      else fallback?.focus();
    };
  }, [modal]);

  function openModal(next: Modal, button: HTMLButtonElement) {
    triggerRef.current = button;
    setFormError("");
    setNotice("");
    setModal(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || saving) return;
    setFormError("");
    const form = new FormData(event.currentTarget);
    let limitAmount = "";
    const categoryId =
      modal.action === "edit"
        ? modal.budget.categoryId
        : Number(form.get("categoryId"));
    if (modal.action !== "delete") {
      try {
        limitAmount = parseBalance(String(form.get("limitAmount") ?? ""));
        if (limitAmount.startsWith("-") || limitAmount === "0.00")
          throw new Error("Informe um limite maior que zero.");
        if (!categories.some((category) => category.id === categoryId))
          throw new Error("Selecione uma categoria de despesa.");
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "Confira os campos informados.",
        );
        return;
      }
    }
    setSaving(true);
    try {
      if (modal.action === "delete") {
        await deleteBudget(modal.budget.id);
        setBudgets((items) =>
          items.filter((item) => item.id !== modal.budget.id),
        );
        setNotice("Orçamento removido. As movimentações foram preservadas.");
      } else {
        const budget = await saveBudget(categoryId, month, limitAmount);
        setBudgets((items) =>
          [...items.filter((item) => item.id !== budget.id), budget].sort(
            (a, b) => a.categoryName.localeCompare(b.categoryName, "pt-BR"),
          ),
        );
        setNotice("Limite mensal salvo.");
      }
      setModal(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else
        setFormError(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação.",
        );
    } finally {
      setSaving(false);
    }
  }

  const available = categories.filter(
    (category) => !budgets.some((budget) => budget.categoryId === category.id),
  );
  const selected = modal && modal.action !== "create" ? modal.budget : null;

  return (
    <section
      id="orcamentos"
      className="mx-auto max-w-[1120px] pt-8 pb-10 text-sm text-ink max-[600px]:pt-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">
            Orçamentos
          </h1>
          <p className="mt-2 leading-relaxed text-muted">
            Defina limites por categoria e acompanhe seus gastos.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-muted">
            Período
            <input
              type="month"
              min="0001-01"
              max="9999-12"
              required
              value={month}
              onChange={(event) => {
                if (
                  !/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) ||
                  event.target.value.startsWith("0000")
                )
                  return;
                setLoading(true);
                setError("");
                setNotice("");
                setMonth(event.target.value);
              }}
              className="mt-2 block h-11 rounded-xl border border-control bg-white px-3 text-sm text-ink outline-none focus:border-[#004d3c]"
            />
          </label>
          <button
            ref={createRef}
            type="button"
            disabled={loading || !!error || available.length === 0}
            onClick={(event) =>
              openModal({ action: "create" }, event.currentTarget)
            }
            className={buttonClass}
          >
            <span aria-hidden="true">+</span> Definir limite
          </button>
        </div>
      </header>
      <p role="status" className={notice ? "mt-4 text-accent" : "sr-only"}>
        {notice}
      </p>
      {loading ? (
        <p role="status" className="py-12 text-muted">
          Carregando orçamentos…
        </p>
      ) : error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-white p-6">
          <p role="alert" className="text-red-800">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((value) => value + 1);
            }}
            className={`${buttonClass} mt-4`}
          >
            Tentar novamente
          </button>
        </div>
      ) : budgets.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-control bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">
            Dê um limite aos seus planos
          </h2>
          <p className="mt-2 text-muted">
            Nenhum orçamento definido neste mês.
          </p>
          {categories.length === 0 && (
            <p className="mt-4 text-muted">
              Comece cadastrando uma{" "}
              <a
                href="#categorias"
                className="font-semibold text-accent underline underline-offset-4"
              >
                categoria de despesa
              </a>
              .
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {budgets.map((budget) => {
            const progress = budgetProgress(budget);
            const over = progress.status === "over";
            const warn = progress.status !== "under";
            return (
              <article
                key={budget.id}
                className="min-w-0 rounded-lg border border-line bg-white p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold break-words">
                      {budget.categoryName}
                    </h2>
                    <p
                      className={`mt-1 text-xs ${warn ? "text-[#8c5b3e]" : "text-muted"}`}
                    >
                      {progress.label}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      title="Editar limite"
                      aria-label={`Editar limite de ${budget.categoryName}`}
                      onClick={(event) =>
                        openModal(
                          { action: "edit", budget },
                          event.currentTarget,
                        )
                      }
                      className="grid size-11 cursor-pointer sm:size-9 place-items-center rounded-lg text-muted hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-[#004d3c]"
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m16 3 5 5L9 20l-6 1 1-6L16 3ZM14 5l5 5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Remover orçamento"
                      aria-label={`Remover orçamento de ${budget.categoryName}`}
                      onClick={(event) =>
                        openModal(
                          { action: "delete", budget },
                          event.currentTarget,
                        )
                      }
                      className="grid size-11 cursor-pointer sm:size-9 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-red-800"
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-tight break-words text-accent tabular-nums">
                  {formatMoney(budget.spent)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Gasto de um limite de {formatMoney(budget.limitAmount)}
                </p>
                <div
                  aria-hidden="true"
                  className="mt-5 h-2 overflow-hidden rounded-full bg-[#e9efe2]"
                >
                  <div
                    style={{ width: `${progress.width}%` }}
                    className={`h-full rounded-full ${over ? "bg-red-800" : warn ? "bg-[#b48b65]" : "bg-accent"}`}
                  />
                </div>
                <p
                  className={`mt-3 text-sm ${warn ? "text-[#8c5b3e]" : "text-muted"}`}
                >
                  {over
                    ? `${formatMoney(budget.remaining.slice(1))} acima do limite`
                    : `${formatMoney(budget.remaining)} disponíveis neste orçamento`}
                </p>
              </article>
            );
          })}
        </div>
      )}
      {modal && (
        <dialog
          ref={dialogRef}
          aria-labelledby="budget-title"
          aria-describedby="budget-description"
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-line bg-canvas p-6 text-ink shadow-xl backdrop:bg-[#153c32]/35  sm:p-8"
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) setModal(null);
          }}
        >
          <h2
            id="budget-title"
            className="text-2xl font-semibold tracking-tight"
          >
            {modal.action === "delete"
              ? "Remover orçamento"
              : modal.action === "edit"
                ? "Editar limite"
                : "Definir limite"}
          </h2>
          <p
            id="budget-description"
            className="mt-2 text-sm leading-relaxed text-muted"
          >
            {modal.action === "delete" ? (
              <>
                Remover o limite de{" "}
                <strong className="break-words">
                  {modal.budget.categoryName}
                </strong>{" "}
                em {month.split("-").reverse().join("/")}? As movimentações
                serão mantidas.
              </>
            ) : (
              `Este limite vale somente para ${month.split("-").reverse().join("/")}.`
            )}
          </p>
          <form onSubmit={submit} className="mt-6">
            {modal.action !== "delete" && (
              <fieldset
                disabled={saving}
                className="space-y-5 disabled:opacity-60"
              >
                <label
                  className="block text-sm font-medium"
                  htmlFor="budget-category"
                >
                  Categoria
                  <select
                    id="budget-category"
                    name="categoryId"
                    required
                    defaultValue={selected?.categoryId ?? ""}
                    disabled={modal.action === "edit"}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Selecione uma categoria
                    </option>
                    {(modal.action === "edit" ? categories : available).map(
                      (category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label
                  className="block text-sm font-medium"
                  htmlFor="budget-limit"
                >
                  Limite mensal (R$)
                  <input
                    id="budget-limit"
                    name="limitAmount"
                    required
                    autoFocus
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Ex.: 800,00"
                    defaultValue={selected?.limitAmount.replace(".", ",") ?? ""}
                    className={inputClass}
                  />
                </label>
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
                className="min-h-11 cursor-pointer rounded-xl border border-control px-4 py-2 text-sm font-medium hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-[#004d3c] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-danger={modal.action === "delete"}
                className={`${buttonClass} data-[danger=true]:bg-red-800 data-[danger=true]:hover:bg-red-900`}
              >
                {saving
                  ? "Salvando…"
                  : modal.action === "delete"
                    ? "Remover orçamento"
                    : "Salvar limite"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
