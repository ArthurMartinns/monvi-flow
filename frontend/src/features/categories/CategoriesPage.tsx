import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from "../../lib/categories";
import type { Category } from "../../lib/categories";
import { ApiError } from "../../lib/http";

const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#004d3c] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b624d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-wait disabled:opacity-50";
const inputClass =
  "mt-2 block h-12 w-full rounded-xl border border-[#d9e1d4] bg-white px-3.5 text-sm text-[#153c32] outline-none focus:border-[#004d3c] focus:ring-3 focus:ring-[#004d3c]/5 aria-invalid:border-red-600";

type Modal =
  | { action: "create" }
  | { action: "rename" | "delete"; category: Category };

export default function CategoriesPage({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
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
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

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

  function openModal(next: Modal, trigger: HTMLButtonElement) {
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
      className="mx-auto w-full max-w-[1120px] pt-11 pb-14 text-sm text-[#153c32] max-[600px]:pt-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wider text-[#8c5b3e] uppercase">
            Organização financeira
          </p>
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight">
            Categorias
          </h1>
          <p className="mt-2 leading-relaxed text-[#748075]">
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

      <p role="status" className="mt-5 text-[#004d3c]">
        {notice}
      </p>

      {loading ? (
        <p role="status" className="py-12 text-[#748075]">
          Carregando categorias…
        </p>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-white p-6">
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
        <div className="mt-5 rounded-2xl border border-dashed border-[#d9e1d4] bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">
            Tudo começa com uma categoria
          </h2>
          <p className="mt-2 text-[#748075]">
            Adicione opções como salário, alimentação ou transporte.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          {(["INCOME", "EXPENSE"] as const).map((type) => {
            const items = categories.filter(
              (category) => category.type === type,
            );
            return (
              <section
                key={type}
                className="min-w-0 self-start overflow-hidden rounded-2xl border border-[#e3e7df] bg-white"
              >
                <header
                  className={`flex items-center justify-between gap-3 px-5 py-4 ${type === "INCOME" ? "bg-[#e9efe2]" : "bg-[#f2e9d8]"}`}
                >
                  <h2 className="text-base font-semibold">
                    {type === "INCOME" ? "Receitas" : "Despesas"}
                  </h2>
                  <span className="text-xs text-[#63766a]">
                    {items.length}{" "}
                    {items.length === 1 ? "categoria" : "categorias"}
                  </span>
                </header>
                {items.length === 0 ? (
                  <p className="px-5 py-7 text-[#748075]">
                    Nenhuma categoria de{" "}
                    {type === "INCOME" ? "receita" : "despesa"} cadastrada.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#edf0e9]">
                    {items.map((category) => (
                      <li
                        key={category.id}
                        className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[#fafaf7] motion-reduce:transition-none"
                      >
                        <span
                          aria-hidden="true"
                          className={`grid size-9 shrink-0 place-items-center rounded-xl ${type === "INCOME" ? "bg-[#e9efe2] text-[#004d3c]" : "bg-[#f2e9d8] text-[#8c5b3e]"}`}
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
                              type === "EXPENSE" ? "rotate-90" : undefined
                            }
                          >
                            <path d="M6 18 18 6M6 6h12v12" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1 font-medium break-words">
                          {category.name}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`Renomear ${category.name}`}
                            title="Renomear"
                            onClick={(event) =>
                              openModal(
                                { action: "rename", category },
                                event.currentTarget,
                              )
                            }
                            className="grid size-9 cursor-pointer place-items-center rounded-lg text-[#748075] transition-colors hover:bg-[#e9efe2] hover:text-[#004d3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004d3c]"
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
                            aria-label={`Excluir ${category.name}`}
                            title="Excluir"
                            onClick={(event) =>
                              openModal(
                                { action: "delete", category },
                                event.currentTarget,
                              )
                            }
                            className="grid size-9 cursor-pointer place-items-center rounded-lg text-[#748075] transition-colors hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
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
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {modal && (
        <dialog
          ref={dialogRef}
          aria-labelledby="category-title"
          aria-describedby="category-description"
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-[#e3e7df] bg-[#fafaf7] p-6 text-[#153c32] shadow-xl backdrop:bg-[#153c32]/35 backdrop:backdrop-blur-sm sm:p-8"
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
            className="mt-2 text-sm leading-relaxed text-[#748075]"
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
                className="min-h-11 cursor-pointer rounded-xl border border-[#d9e1d4] px-4 py-2 text-sm font-medium hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:opacity-50"
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
