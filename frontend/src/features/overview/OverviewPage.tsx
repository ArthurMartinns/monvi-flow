import { useEffect, useState } from "react";
import { ApiError } from "../../lib/http";
import { formatMoney } from "../../lib/money";
import { getOverview } from "../../lib/overview";
import type { Overview } from "../../lib/overview";
import { cents, monthDays, percentage } from "./chartData";

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export default function OverviewPage({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getOverview(month, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setData(data);
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
  }, [month, attempt, onSessionExpired]);

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
  const max = days.reduce(
    (max, day) =>
      [max, cents(day.income), cents(day.expense)].reduce((a, b) =>
        a > b ? a : b,
      ),
    0n,
  );
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-15T12:00:00`));

  return (
    <section className="mx-auto max-w-[1120px] pt-11 pb-14 text-sm text-[#153c32] max-[600px]:pt-8">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wider text-[#8c5b3e] uppercase">
            Um olhar sobre suas finanças
          </p>
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight">
            Visão geral
          </h1>
          <p className="mt-2 text-[#748075]">
            Mais clareza para acompanhar seu mês.
          </p>
        </div>
        <label className="text-xs font-medium text-[#63766a]">
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
              setMonth(event.target.value);
            }}
            className="mt-2 block h-11 rounded-xl border border-[#d9e1d4] bg-white px-3 text-sm text-[#153c32] outline-none focus:border-[#004d3c]"
          />
        </label>
      </header>

      {loading ? (
        <p role="status" className="py-14 text-[#748075]">
          Preparando seu resumo…
        </p>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-white p-6">
          <p role="alert" className="text-red-800">
            {error}
          </p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 cursor-pointer rounded-xl bg-[#004d3c] px-5 py-3 font-semibold text-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        data && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-[#004d3c] px-6 py-7 text-white sm:px-8">
              <div className="min-w-0">
                <p className="text-sm text-[#d7e3ce]">
                  Saldo atual · todas as contas
                </p>
                <p className="mt-2 text-[32px] leading-tight font-semibold tracking-tight break-words tabular-nums">
                  {formatMoney(data.totalBalance)}
                </p>
                <p className="mt-2 text-xs text-[#d7e3ce]">
                  {data.accountCount}{" "}
                  {data.accountCount === 1
                    ? "conta cadastrada"
                    : "contas cadastradas"}{" "}
                  · inclui movimentações de todos os períodos
                </p>
              </div>
              <a
                href="#contas"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Ver contas
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Receitas do mês",
                  value: data.income,
                  tone: "text-[#004d3c]",
                  icon: "income",
                },
                {
                  label: "Despesas do mês",
                  value: data.expense,
                  tone: "text-[#8c5b3e]",
                  icon: "expense",
                },
                {
                  label: "Resultado do mês",
                  value: data.result,
                  tone: data.result.startsWith("-")
                    ? "text-[#8c5b3e]"
                    : "text-[#004d3c]",
                  icon: "result",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="min-w-0 rounded-2xl border border-[#e3e7df] bg-white p-5"
                >
                  <div className="flex items-center justify-between gap-2 text-[#748075]">
                    <p>{stat.label}</p>
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`${stat.tone} shrink-0 ${stat.icon === "expense" ? "rotate-90" : ""}`}
                    >
                      <path
                        d={
                          stat.icon === "result"
                            ? "M5 8h14M5 16h14"
                            : "M6 18 18 6M6 6h12v12"
                        }
                      />
                    </svg>
                  </div>
                  <p
                    className={`mt-3 text-2xl font-semibold tracking-tight break-words tabular-nums ${stat.tone}`}
                  >
                    {formatMoney(stat.value)}
                  </p>
                  <p className="mt-2 text-xs text-[#748075]">
                    {stat.label === "Resultado do mês"
                      ? "Receitas menos despesas"
                      : monthLabel}
                  </p>
                </div>
              ))}
            </div>

            {data.transactionCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9e1d4] bg-white p-8 text-center">
                <h2 className="text-lg font-semibold">
                  Um mês ainda em branco
                </h2>
                <p className="mt-2 text-[#748075]">
                  Nenhuma movimentação registrada em {monthLabel}.
                </p>
                <a
                  href="#movimentacoes"
                  className="mt-5 inline-flex rounded-xl bg-[#004d3c] px-5 py-3 font-semibold text-white"
                >
                  Ir para movimentações
                </a>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
                <figure className="relative min-w-0 rounded-2xl border border-[#e3e7df] bg-white p-5 sm:p-6">
                  <figcaption className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">
                        Entradas e saídas
                      </h2>
                      <p className="mt-1 text-xs text-[#748075]">
                        {data.transactionCount}{" "}
                        {data.transactionCount === 1
                          ? "movimentação no mês"
                          : "movimentações no mês"}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs text-[#748075]">
                      <span>
                        <span
                          aria-hidden="true"
                          className="mr-1.5 inline-block size-2 rounded-full bg-[#004d3c]"
                        />
                        Receitas
                      </span>
                      <span>
                        <span
                          aria-hidden="true"
                          className="mr-1.5 inline-block size-2 rounded-full bg-[#b48b65]"
                        />
                        Despesas
                      </span>
                    </div>
                  </figcaption>
                  <div
                    aria-hidden="true"
                    className="mt-8 flex h-44 items-end gap-1 border-b border-[#e3e7df]"
                  >
                    {days.map((day) => (
                      <div
                        key={day.date}
                        title={`${day.date.split("-").reverse().join("/")} · Receitas ${formatMoney(day.income)} · Despesas ${formatMoney(day.expense)}`}
                        className="flex h-full min-w-0 flex-1 items-end gap-px"
                      >
                        <span
                          style={{
                            height: `${percentage(cents(day.income), max)}%`,
                          }}
                          className="min-w-0 flex-1 rounded-t-sm bg-[#004d3c]"
                        />
                        <span
                          style={{
                            height: `${percentage(cents(day.expense), max)}%`,
                          }}
                          className="min-w-0 flex-1 rounded-t-sm bg-[#b48b65]"
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-2 flex justify-between text-[10px] text-[#748075]"
                  >
                    <span>01</span>
                    <span>08</span>
                    <span>15</span>
                    <span>22</span>
                    <span>{days.length}</span>
                  </div>
                  <div className="sr-only">
                    <table>
                      <caption>Movimentações diárias de {monthLabel}</caption>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Receitas</th>
                          <th>Despesas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((day) => (
                          <tr key={day.date}>
                            <td>{day.date.split("-").reverse().join("/")}</td>
                            <td>{formatMoney(day.income)}</td>
                            <td>{formatMoney(day.expense)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </figure>
                <section className="min-w-0 rounded-2xl border border-[#e3e7df] bg-white p-5 sm:p-6">
                  <h2 className="text-base font-semibold">
                    Para onde foi seu dinheiro
                  </h2>
                  <p className="mt-1 text-xs text-[#748075]">
                    Despesas por categoria em {monthLabel}
                  </p>
                  {data.categories.length === 0 ? (
                    <p className="py-10 text-[#748075]">
                      Nenhuma despesa neste mês.
                    </p>
                  ) : (
                    <ul className="mt-6 max-h-64 space-y-5 overflow-y-auto pr-1">
                      {data.categories.map((category) => (
                        <li key={category.id}>
                          <div className="flex flex-wrap justify-between gap-2">
                            <span className="min-w-0 font-medium break-words">
                              {category.name}
                            </span>
                            <span className="text-[#8c5b3e] tabular-nums">
                              {formatMoney(category.amount)}
                            </span>
                          </div>
                          <div
                            aria-hidden="true"
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f2e9d8]"
                          >
                            <div
                              style={{
                                width: `${percentage(cents(category.amount), cents(data.expense))}%`,
                              }}
                              className="h-full rounded-full bg-[#b48b65]"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
