import { useCallback, useEffect, useState } from "react";
import AuthForm from "./features/auth/AuthForm";
import AccountsPage from "./features/accounts/AccountsPage";
import CategoriesPage from "./features/categories/CategoriesPage";
import TransactionsPage from "./features/transactions/TransactionsPage";
import OverviewPage from "./features/overview/OverviewPage";
import Sidebar from "./components/Sidebar";
import BudgetsPage from "./features/budgets/BudgetsPage";
import { currentUser, logout } from "./lib/auth";
import type { User } from "./lib/auth";

function pageFromHash() {
  if (window.location.hash === "#orcamentos") return "budgets";
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
      className={`min-h-dvh text-ink antialiased ${user ? `bg-canvas lg:grid ${menuOpen ? "lg:grid-cols-[224px_minmax(0,1fr)]" : "lg:grid-cols-[72px_minmax(0,1fr)]"}` : "bg-[#fdfdfb]"}`}
    >
      {user && <Sidebar page={page} expanded={menuOpen} onToggle={() => setMenuOpen((open) => !open)} name={user.name} onLogout={signOut} signingOut={signingOut} />}

      <main
        aria-label="Área principal"
        className={
          user ? "mx-auto w-full min-w-0 max-w-[1280px] px-4 sm:px-6 lg:px-8" : "w-full"
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
        ) : page === "budgets" ? (
          <BudgetsPage key={user.id} onSessionExpired={clearSession} />
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
