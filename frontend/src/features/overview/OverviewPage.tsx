import { useEffect, useState } from "react";
import { ApiError } from "../../lib/http";
import { formatMoney } from "../../lib/money";
import { getOverview } from "../../lib/overview";
import type { Overview } from "../../lib/overview";
import { listAccounts } from "../../lib/accounts";
import type { Account } from "../../lib/accounts";
import { cents, monthDays, percentage } from "./chartData";
import CashFlowChart from "./CashFlowChart";
import RecentTransactions from "./RecentTransactions";
import { budgetProgress } from "../budgets/budgetProgress";
import { budgetsHref, overviewHref, readOverviewScope, transactionsHref } from "../../lib/navigation";

const formatMonth = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-15T12:00:00`));

export default function OverviewPage({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [{ month, accountId }, setScope] = useState(readOverviewScope);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [chartPeriod, setChartPeriod] = useState<"day" | "month">("month");

  useEffect(() => {
    function restoreScope() {
      const path = window.location.hash.split("?")[0];
      if (path !== "#inicio" && path !== "") return;
      setLoading(true);
      setError("");
      setScope(readOverviewScope());
      setAttempt((value) => value + 1);
    }
    window.addEventListener("hashchange", restoreScope);
    return () => window.removeEventListener("hashchange", restoreScope);
  }, []);

  function changeScope(month: string, accountId: string) {
    setLoading(true);
    setError("");
    const href = overviewHref(month, accountId);
    if (window.location.hash !== href) window.history.pushState(null, "", href);
    setScope({ month, accountId });
  }

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getOverview(month, accountId, controller.signal),
      listAccounts(controller.signal),
    ])
      .then(([data, accounts]) => {
        if (controller.signal.aborted) return;
        setData(data);
        setAccounts(accounts);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired();
        else
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o resumo.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, accountId, attempt, onSessionExpired]);

  function reload() {
    setLoading(true);
    setError("");
    setAttempt((value) => value + 1);
  }

  const days = data
    ? monthDays(data.month).map(
        (date) =>
          data.days.find((day) => day.date === date) ?? {
            date,
            income: "0.00",
            expense: "0.00",
          },
      )
    : [];
  const monthLabel = formatMonth(month);
  const history = data?.months ?? [];
  const monthlyRows = history.map((item) => ({
    date: `${item.month}-01`,
    income: item.income,
    expense: item.expense,
  }));
  const historyLabel =
    history.length > 1
      ? `${formatMonth(history[0].month)} a ${formatMonth(history[history.length - 1].month)}`
      : history.length === 1
        ? formatMonth(history[0].month)
        : "Sem histórico disponível.";
  const budgetAlerts = (data?.budgets ?? []).filter(
    (budget) => budgetProgress(budget).status !== "under",
  );

  const overBudget = budgetAlerts.filter(
    (budget) => budgetProgress(budget).status === "over",
  );
  const priorityBudgets = [...budgetAlerts].sort(
    (a, b) =>
      Number(budgetProgress(b).status === "over") -
      Number(budgetProgress(a).status === "over"),
  );
  const stats = data
    ? [
        {
          label: accountId ? "Saldo da conta" : "Saldo atual",
          value: data.totalBalance,
          note: accountId
            ? "Saldo acumulado"
            : `${data.accountCount} ${data.accountCount === 1 ? "conta" : "contas"} · saldo acumulado`,
          main: false,
        },
        {
          label: "Receitas do mês",
          value: data.income,
          note: monthLabel,
          main: false,
        },
        {
          label: "Despesas do mês",
          value: data.expense,
          note: monthLabel,
          main: false,
        },
        {
          label: "Resultado do mês",
          value: data.result,
          note: "Receitas menos despesas",
          main: true,
        },
      ]
    : [];
  const transactionScope = { from: `${month}-01`, to: monthDays(month).at(-1), accountId };
  const transactionsLink = transactionsHref(transactionScope);
  return (
    <section className="mx-auto w-full max-w-[1200px] pt-8 pb-10 text-sm text-ink max-[600px]:pt-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-2 text-muted">
            Seu resultado financeiro, mês a mês.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <label className="min-w-[160px] flex-1 text-xs font-medium text-muted sm:w-48">
            Conta
            <select
              value={accountId}
              onChange={(event) => {
                changeScope(month, event.target.value);
              }}
              className="mt-2 block h-11 w-full min-w-0 rounded-lg border border-control bg-white px-3 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">Todas as contas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="w-[168px] text-xs font-medium text-muted">
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
                changeScope(event.target.value, accountId);
              }}
              className="mt-2 block h-11 w-full rounded-lg border border-control bg-white px-3 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
        </div>
      </header>
      {loading ? (
        <p role="status" className="py-14 text-muted">
          Preparando seu resumo…
        </p>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-line bg-white p-6">
          <p role="alert" className="text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 min-h-11 cursor-pointer rounded-lg bg-ink px-5 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Tentar novamente
          </button>
          {accountId && <button type="button" onClick={() => changeScope(month, "")} className="ml-3 mt-4 min-h-11 cursor-pointer rounded-lg px-4 font-medium hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent">Ver todas as contas</button>}
        </div>
      ) : (
        data && (
          <div className="mt-6 space-y-5">
            <section
              aria-label="Resumo financeiro"
              className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-white lg:grid-cols-4"
            >
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`min-w-0 p-4 sm:p-5 ${index % 2 === 1 ? "border-l border-line" : ""} ${index > 1 ? "border-t border-line lg:border-t-0 lg:border-l" : ""}`}
                >
                  <p className="text-[13px] text-muted">{stat.label}</p>
                  <p
                    className={`mt-2 leading-tight font-semibold tracking-tight break-words tabular-nums ${stat.main ? "text-[28px]" : "text-[23px]"} ${stat.value.startsWith("-") ? "text-danger" : "text-ink"}`}
                  >
                    {formatMoney(stat.value)}
                  </p>
                  <p className="mt-2 text-xs text-muted">{stat.note}</p>
                </div>
              ))}
            </section>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <figure className="min-w-0 rounded-lg border border-line bg-white p-4 sm:p-5">
                <figcaption className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">
                        Fluxo de caixa
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        {chartPeriod === "month"
                          ? historyLabel
                          : `${data.transactionCount} ${data.transactionCount === 1 ? "movimentação" : "movimentações"} em ${monthLabel}`}
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label="Visualização do fluxo de caixa"
                      className="flex rounded-lg bg-canvas p-1"
                    >
                      {(["day", "month"] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          aria-pressed={chartPeriod === period}
                          onClick={() => setChartPeriod(period)}
                          className={`min-h-11 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors sm:min-h-9 ${chartPeriod === period ? "bg-soft text-ink" : "text-muted hover:text-ink"} focus-visible:outline-2 focus-visible:outline-accent`}
                        >
                          {period === "month" ? "Mensal" : "Diário"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs text-muted">
                    <span>
                      <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block h-2 w-2 bg-accent"
                      />
                      Receitas
                    </span>
                    <span>
                      <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block h-2 w-2 bg-[#aab7ae]"
                      />
                      Despesas
                    </span>
                  </div>
                </figcaption>
                <div className="mt-5">
                  <CashFlowChart
                    days={chartPeriod === "month" ? monthlyRows : days}
                    monthly={chartPeriod === "month"}
                  />
                </div>
              </figure>
              <section className="min-w-0 rounded-lg border border-line bg-white p-4 sm:p-5">
                <h2 className="text-base font-semibold">
                  Despesas por categoria
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Do maior gasto para o menor
                </p>
                {data.categories.length === 0 ? (
                  <p className="py-10 text-muted">
                    Nenhuma despesa registrada neste mês.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-4">
                    {data.categories.slice(0, 5).map((category, index) => (
                      <li key={category.id}>
                        <div className="flex items-baseline justify-between gap-4">
                          <a
                            href={transactionsHref({ ...transactionScope, categoryId: String(category.id), type: "EXPENSE" })}
                            className="min-w-0 truncate rounded-sm text-sm hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                            title={category.name}
                          >
                            {category.name}
                          </a>
                          <span className="shrink-0 text-sm font-medium text-ink tabular-nums">
                            {formatMoney(category.amount)}
                          </span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="mt-2 h-0.5 bg-[#f0f3ef]"
                        >
                          <div
                            style={{
                              width: `${percentage(cents(category.amount), cents(data.expense))}%`,
                            }}
                            className={`h-full ${index === 0 ? "bg-accent" : "bg-[#aab7ae]"}`}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {data.categories.length > 5 && (
                  <p className="mt-4 text-xs text-muted">
                    Mais {data.categories.length - 5} categorias ·{" "}
                    <a
                      href={transactionsHref({ ...transactionScope, type: "EXPENSE" })}
                      className="font-medium text-ink underline underline-offset-4"
                    >
                      Consultar histórico
                    </a>
                  </p>
                )}
              </section>
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
              <section className="min-w-0 rounded-lg border border-line bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      {accountId ? "Limites gerais do mês" : "Limites do mês"}
                    </h2>
                    <p className="mt-1 text-[13px] text-muted">
                      {accountId && "Consideram todas as suas contas. "}
                      {overBudget.length > 0
                        ? `${overBudget.length} ${overBudget.length === 1 ? "categoria ultrapassou" : "categorias ultrapassaram"} o limite planejado.`
                        : budgetAlerts.length > 0
                          ? "Algumas categorias estão próximas do limite planejado."
                          : "Acompanhe seus limites por categoria."}
                    </p>
                  </div>
                  <a
                    href={budgetsHref(month)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Ver orçamentos
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
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  </a>
                </div>
                {priorityBudgets.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">
                    {data.budgets?.length
                      ? "Os orçamentos estão abaixo de 80% do limite."
                      : "Nenhum limite definido para este mês."}
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-line">
                    {priorityBudgets.slice(0, 5).map((budget) => (
                      <li
                        key={budget.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
                      >
                        <span className="min-w-0 text-sm font-medium sm:flex sm:items-center sm:gap-3">
                          {budget.categoryName}
                          <span
                            className={`mt-1 block text-xs font-normal sm:mt-0 ${budgetProgress(budget).status === "over" ? "text-danger" : "text-muted"}`}
                          >
                            {budgetProgress(budget).label}
                          </span>
                        </span>
                        <span className="text-right text-sm tabular-nums">
                          {formatMoney(budget.spent)}{" "}
                          <span className="text-xs text-muted">
                            de {formatMoney(budget.limitAmount)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {priorityBudgets.length > 5 && (
                  <p className="mt-2 text-xs text-muted">
                    Mais {priorityBudgets.length - 5} categorias precisam de
                    atenção.
                  </p>
                )}
              </section>
              <RecentTransactions
                items={data.recentTransactions ?? []}
                monthLabel={monthLabel}
                href={transactionsLink}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <a
                href="#contas"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                Ver contas
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
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </a>
              <a
                href={transactionsLink}
                className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 font-medium text-white transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Ver movimentações
              </a>
            </div>
          </div>
        )
      )}
    </section>
  );
}
