import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createCategory, listCategories } from "../../lib/categories";
import type { Category } from "../../lib/categories";
import { ApiError } from "../../lib/http";

const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#004d3c] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b624d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:cursor-wait disabled:opacity-50";
const inputClass =
  "mt-2 block h-12 w-full rounded-xl border border-[#d9e1d4] bg-white px-3.5 text-sm text-[#153c32] outline-none focus:border-[#004d3c] focus:ring-3 focus:ring-[#004d3c]/5 aria-invalid:border-red-600";

export default function CategoriesPage({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    if (!open || !dialog) return;
    dialog.showModal();
    const trigger = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      dialog.close();
      trigger?.focus();
    };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const type = String(data.get("type"));
    setFields([]);
    setFormError("");
    if (!name || name.length > 100) {
      setFields(["name"]);
      setFormError("Informe um nome com até 100 caracteres.");
      return;
    }
    if (type !== "INCOME" && type !== "EXPENSE") {
      setFields(["type"]);
      setFormError("Selecione o tipo da categoria.");
      return;
    }
    setSaving(true);
    try {
      const category = await createCategory(name, type);
      setCategories((items) => [...items, category]);
      setOpen(false);
      setNotice("Categoria criada com sucesso.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else {
        setFormError(
          error instanceof Error
            ? error.message
            : "Não foi possível criar a categoria.",
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
          onClick={() => {
            setFormError("");
            setFields([]);
            setNotice("");
            setOpen(true);
          }}
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
                        <span className="min-w-0 font-medium break-words">
                          {category.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby="category-title"
          aria-describedby="category-description"
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-[#e3e7df] bg-[#fafaf7] p-6 text-[#153c32] shadow-xl backdrop:bg-[#153c32]/35 backdrop:backdrop-blur-sm sm:p-8"
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) setOpen(false);
          }}
        >
          <h2
            id="category-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Nova categoria
          </h2>
          <p
            id="category-description"
            className="mt-2 text-sm leading-relaxed text-[#748075]"
          >
            Escolha um nome e o tipo de movimentação.
          </p>
          <form onSubmit={submit} className="mt-6">
            <fieldset
              disabled={saving}
              className="space-y-5 disabled:opacity-60"
            >
              <label
                className="block text-sm font-medium"
                htmlFor="category-name"
              >
                Nome
                <input
                  id="category-name"
                  name="name"
                  required
                  maxLength={100}
                  autoFocus
                  autoComplete="off"
                  placeholder="Ex.: Alimentação"
                  aria-invalid={fields.includes("name")}
                  className={inputClass}
                />
              </label>
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
                onClick={() => setOpen(false)}
                className="min-h-11 cursor-pointer rounded-xl border border-[#d9e1d4] px-4 py-2 text-sm font-medium hover:bg-[#e9efe2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004d3c] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving} className={buttonClass}>
                {saving ? "Salvando…" : "Criar categoria"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
