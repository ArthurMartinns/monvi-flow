import { useCallback, useEffect, useState } from "react";
import AuthForm from "./features/auth/AuthForm";
import AccountsPage from "./features/accounts/AccountsPage";
import CategoriesPage from "./features/categories/CategoriesPage";
import TransactionsPage from "./features/transactions/TransactionsPage";
import OverviewPage from "./features/overview/OverviewPage";
import { currentUser, logout } from "./lib/auth";
import type { User } from "./lib/auth";

function pageFromHash() {
  if (window.location.hash === "#movimentacoes") return "transactions";
  if (window.location.hash === "#categorias") return "categories";
  return window.location.hash === "#contas" ? "accounts" : "overview";
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [menuOpen, setMenuOpen] = useState(true);
  const [page, setPage] = useState(pageFromHash);
  const clearSession = useCallback(() => setUser(null), []);

  useEffect(() => {
    function changePage() {
      setPage(pageFromHash());
    }
    window.addEventListener("hashchange", changePage);
    return () => window.removeEventListener("hashchange", changePage);
  }, []);

  async function signOut() {
    setSigningOut(true);
    setLogoutError("");
    try {
      await logout();
      setUser(null);
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Não foi possível sair.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    currentUser(controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) setUser(user);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível verificar sua sessão.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div
      className={`min-h-screen text-stone-900 antialiased ${user ? `bg-stone-50 lg:grid ${menuOpen ? "lg:grid-cols-[224px_minmax(0,1fr)]" : "lg:grid-cols-[72px_minmax(0,1fr)]"}` : "bg-[#fdfdfb]"}`}
    >
      {user && (
        <aside
          className={`flex flex-wrap items-center gap-4 border-b border-stone-200 bg-white py-5 lg:sticky lg:top-0 lg:h-svh lg:flex-col lg:items-stretch lg:border-r lg:border-b-0 lg:py-8 ${menuOpen ? "px-6" : "px-3"}`}
        >
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`${menuOpen ? "grid" : "hidden"} size-8 shrink-0 place-items-center rounded-full bg-emerald-900 font-serif text-lg text-white`}
            >
              M
            </span>
            <span
              className={`${menuOpen ? "" : "hidden"} text-lg font-semibold tracking-tight text-emerald-950`}
            >
              MonviFlow
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="sidebar-nav"
              aria-label={menuOpen ? "Recolher menu" : "Expandir menu"}
              title={menuOpen ? "Recolher menu" : "Expandir menu"}
              className="ml-auto grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 lg:mx-auto"
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
                strokeLinejoin="round"
              >
                <path d={menuOpen ? "M14 5l-7 7 7 7" : "M10 5l7 7-7 7"} />
              </svg>
            </button>
          </div>
          <nav
            id="sidebar-nav"
            aria-label="Menu principal"
            className={`order-3 w-full space-y-1 lg:order-none lg:mt-10 ${menuOpen ? "" : "hidden lg:block"}`}
          >
            <a
              href="#inicio"
              aria-current={page === "overview" ? "page" : undefined}
              title="Visão geral"
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 ${page === "overview" ? "bg-[#eef3e6] text-emerald-900" : "text-stone-500 hover:bg-stone-100 hover:text-emerald-900"} ${menuOpen ? "" : "justify-center"}`}
            >
              <svg
                className="shrink-0"
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 10 9-7 9 7v11H3V10ZM9 21v-8h6v8" />
              </svg>
              <span className={menuOpen ? "" : "sr-only"}>Visão geral</span>
            </a>
            <a
              href="#contas"
              aria-current={page === "accounts" ? "page" : undefined}
              title="Contas"
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 ${page === "accounts" ? "bg-[#eef3e6] text-emerald-900" : "text-stone-500 hover:bg-stone-100 hover:text-emerald-900"} ${menuOpen ? "" : "justify-center"}`}
            >
              <svg
                className="shrink-0"
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="15" rx="3" />
                <path d="M3 9h18M17 14h1" />
              </svg>
              <span className={menuOpen ? "" : "sr-only"}>Contas</span>
            </a>
            <a
              href="#categorias"
              aria-current={page === "categories" ? "page" : undefined}
              title="Categorias"
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 ${page === "categories" ? "bg-[#eef3e6] text-emerald-900" : "text-stone-500 hover:bg-stone-100 hover:text-emerald-900"} ${menuOpen ? "" : "justify-center"}`}
            >
              <svg
                className="shrink-0"
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3h8l10 10-8 8L3 11z" />
                <circle cx="7.5" cy="7.5" r="1" />
              </svg>
              <span className={menuOpen ? "" : "sr-only"}>Categorias</span>
            </a>
            <a
              href="#movimentacoes"
              aria-current={page === "transactions" ? "page" : undefined}
              title="Movimentações"
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 ${page === "transactions" ? "bg-[#eef3e6] text-emerald-900" : "text-stone-500 hover:bg-stone-100 hover:text-emerald-900"} ${menuOpen ? "" : "justify-center"}`}
            >
              <svg
                className="shrink-0"
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4" />
              </svg>
              <span className={menuOpen ? "" : "sr-only"}>Movimentações</span>
            </a>
          </nav>
          {user && !loading && !error && (
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              title={signingOut ? "Saindo…" : "Sair"}
              className={`ml-auto flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60 lg:mt-auto lg:ml-0 ${menuOpen ? "" : "justify-center"}`}
            >
              <svg
                className="shrink-0"
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 4H5v16h4M13 8l4 4-4 4M9 12h12" />
              </svg>
              <span className={menuOpen ? "" : "sr-only"}>
                {signingOut ? "Saindo…" : "Sair"}
              </span>
            </button>
          )}
        </aside>
      )}

      <main
        aria-label="Área principal"
        className={
          user ? "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-10" : "w-full"
        }
      >
        {loading ? (
          <p role="status" className="py-16 text-stone-600">
            Verificando sua sessão…
          </p>
        ) : error ? (
          <section className="py-16">
            <h1 className="text-2xl font-semibold">
              Não foi possível abrir sua conta
            </h1>
            <p role="alert" className="mt-4 text-stone-600">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-6 cursor-pointer rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"
            >
              Tentar novamente
            </button>
          </section>
        ) : !user ? (
          <AuthForm onLogin={setUser} />
        ) : page === "categories" ? (
          <CategoriesPage key={user.id} onSessionExpired={clearSession} />
        ) : page === "transactions" ? (
          <TransactionsPage key={user.id} onSessionExpired={clearSession} />
        ) : page === "overview" ? (
          <OverviewPage key={user.id} onSessionExpired={clearSession} />
        ) : (
          <AccountsPage key={user.id} onSessionExpired={clearSession} />
        )}
        {user && logoutError && (
          <p role="alert" className="py-6 text-sm text-red-800">
            {logoutError}
          </p>
        )}
      </main>
    </div>
  );
}

export default App;
