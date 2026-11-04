import { useEffect, useRef, useState } from "react";
import RowMenu from "../../components/RowMenu";
import type { FormEvent } from "react";
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from "../../lib/categories";
import type { Category, CategoryType } from "../../lib/categories";
import { ApiError } from "../../lib/http";

const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b624d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-wait disabled:opacity-50";
const inputClass =
  "mt-2 block h-11 w-full rounded-xl border border-control bg-white px-3.5 text-sm text-ink outline-none focus:border-[#004d3c] focus:ring-3 focus:ring-[#004d3c]/5 aria-invalid:border-red-600";

type Modal =
  | { action: "create" }
  | { action: "rename" | "delete"; category: Category };

export default function CategoriesPage({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<CategoryType | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listCategories(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setCategories(items);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired();
        else
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as categorias.",
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
    setFormError("");
    setFields([]);
    setNotice("");
    setModal(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !modal) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const type = String(data.get("type"));
    setFields([]);
    setFormError("");
    if (modal.action !== "delete" && (!name || name.length > 100)) {
      setFields(["name"]);
      setFormError("Informe um nome com até 100 caracteres.");
      return;
    }
    if (modal.action === "create" && type !== "INCOME" && type !== "EXPENSE") {
      setFields(["type"]);
      setFormError("Selecione o tipo da categoria.");
      return;
    }
    setSaving(true);
    try {
      if (modal.action === "delete") {
        await deleteCategory(modal.category.id);
        setCategories((items) =>
          items.filter((item) => item.id !== modal.category.id),
        );
        setNotice("Categoria excluída.");
      } else if (modal.action === "rename") {
        const updated = await renameCategory(modal.category.id, name);
        setCategories((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        setNotice("Categoria renomeada com sucesso.");
      } else if (type === "INCOME" || type === "EXPENSE") {
        const category = await createCategory(name, type);
        setCategories((items) => [...items, category]);
        setNotice("Categoria criada com sucesso.");
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

  return (
    <section
      id="categorias"
      className="mx-auto w-full max-w-[1120px] pt-8 pb-10 text-sm text-ink max-[600px]:pt-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">
            Categorias
          </h1>
          <p className="mt-2 leading-relaxed text-muted">
            Organize suas receitas e despesas do seu jeito.
          </p>
        </div>
        <button
          ref={triggerRef}
          type="button"
          className={buttonClass}
          onClick={(event) =>
            openModal({ action: "create" }, event.currentTarget)
          }
        >
          <span aria-hidden="true" className="text-lg font-normal">
            +
          </span>{" "}
          Nova categoria
        </button>
      </header>

      <p role="status" className={notice ? "mt-4 text-accent" : "sr-only"}>
        {notice}
      </p>

      {loading ? (
        <p role="status" className="py-12 text-muted">
          Carregando categorias…
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
      ) : categories.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-control bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">
            Tudo começa com uma categoria
          </h2>
          <p className="mt-2 text-muted">
            Adicione opções como salário, alimentação ou transporte.
          </p>
        </div>
      ) : (
        <section className="mt-5 rounded-lg border border-line bg-white">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3 sm:px-5">
            <h2 className="text-base font-semibold">Categorias cadastradas</h2>
            <div className="flex gap-1" aria-label="Filtrar categorias por tipo">
              {(["ALL", "INCOME", "EXPENSE"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 cursor-pointer rounded-md px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent sm:min-h-9 ${filter === value ? "bg-soft font-medium text-ink" : "text-muted hover:bg-soft"}`}>{value === "ALL" ? "Todas" : value === "INCOME" ? "Receitas" : "Despesas"}</button>)}
            </div>
          </header>
          <ul className="grid md:grid-cols-2">
            {categories.filter((category) => filter === "ALL" || category.type === filter).map((category) => <li key={category.id} className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 md:even:border-l sm:px-5">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-muted ${category.type === "EXPENSE" ? "rotate-90" : ""}`}><path d="M6 18 18 6M6 6h12v12" /></svg>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" title={category.name}>{category.name}</span><span className="mt-1 block text-[13px] text-muted">{category.type === "INCOME" ? "Receita" : "Despesa"}</span></span>
              <RowMenu name={category.name} actions={[
                { label: "Renomear", onSelect: (trigger) => openModal({ action: "rename", category }, trigger) },
                { label: "Excluir", danger: true, onSelect: (trigger) => openModal({ action: "delete", category }, trigger) },
              ]} />
            </li>)}
            {!categories.some((category) => filter === "ALL" || category.type === filter) && <li className="col-span-full px-5 py-6 text-muted">Nenhuma categoria encontrada.</li>}
          </ul>
        </section>
      )}

      {modal && (
        <dialog
          ref={dialogRef}
          aria-labelledby="category-title"
          aria-describedby="category-description"
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-line bg-canvas p-6 text-ink shadow-xl backdrop:bg-[#153c32]/35  sm:p-8"
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) setModal(null);
          }}
        >
          <h2
            id="category-title"
            className="text-2xl font-semibold tracking-tight"
          >
            {modal.action === "create"
              ? "Nova categoria"
              : modal.action === "rename"
                ? "Renomear categoria"
                : "Excluir categoria"}
          </h2>
          <p
            id="category-description"
            className="mt-2 text-sm leading-relaxed text-muted"
          >
            {modal.action === "create" ? (
              "Escolha um nome e o tipo de movimentação."
            ) : modal.action === "rename" ? (
              "Altere o nome mantendo o tipo da categoria."
            ) : (
              <>
                Deseja excluir{" "}
                <strong className="break-words">{modal.category.name}</strong>?
                Esta ação não pode ser desfeita.
              </>
            )}
          </p>
          <form onSubmit={submit} className="mt-6">
            <fieldset
              disabled={saving}
              className="space-y-5 disabled:opacity-60"
            >
              {modal.action !== "delete" && (
                <label
                  className="block text-sm font-medium"
                  htmlFor="category-name"
                >
                  Nome
                  <input
                    id="category-name"
                    name="name"
                    defaultValue={
                      modal.action === "rename" ? modal.category.name : ""
                    }
                    required
                    maxLength={100}
                    autoFocus
                    autoComplete="off"
                    placeholder="Ex.: Alimentação"
                    aria-invalid={fields.includes("name")}
                    className={inputClass}
                  />
                </label>
              )}
              {modal.action === "create" && (
                <label
                  className="block text-sm font-medium"
                  htmlFor="category-type"
                >
                  Tipo
                  <select
                    id="category-type"
                    name="type"
                    defaultValue="EXPENSE"
                    required
                    aria-invalid={fields.includes("type")}
                    className={inputClass}
                  >
                    <option value="EXPENSE">Despesa</option>
                    <option value="INCOME">Receita</option>
                  </select>
                </label>
              )}
            </fieldset>
            {formError && (
              <p role="alert" className="mt-4 text-sm text-red-800">
                {formError}
              </p>
            )}
            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModal(null)}
                autoFocus={modal.action === "delete"}
                className="min-h-11 cursor-pointer rounded-xl border border-control px-4 py-2 text-sm font-medium hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-danger={modal.action === "delete"}
                className={`${buttonClass} data-[danger=true]:bg-red-800 data-[danger=true]:hover:bg-red-900 data-[danger=true]:focus-visible:outline-red-800`}
              >
                {saving
                  ? modal.action === "delete"
                    ? "Excluindo…"
                    : "Salvando…"
                  : modal.action === "delete"
                    ? "Excluir categoria"
                    : modal.action === "rename"
                      ? "Salvar nome"
                      : "Criar categoria"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
