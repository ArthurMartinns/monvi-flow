import { useEffect, useState } from "react";
import AuthForm from "./features/auth/AuthForm";
import { currentUser, logout } from "./lib/auth";
import type { User } from "./lib/auth";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

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
    <div className="min-h-screen bg-[#fdfdfb] text-stone-900 antialiased">
      {user && (
        <header>
          <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-7">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-emerald-900 font-serif text-lg text-white"
            >
              M
            </span>
            <span className="text-lg font-semibold tracking-tight text-emerald-950">
              MonviFlow
            </span>
            {user && !loading && !error && (
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="ml-auto cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60"
              >
                {signingOut ? "Saindo…" : "Sair"}
              </button>
            )}
          </div>
        </header>
      )}

      <main
        aria-label="Área principal"
        className={user ? "mx-auto max-w-6xl px-6" : "w-full"}
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
        ) : null}
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
