import type { Transaction } from "../../lib/transactions";
import { formatMoney } from "../../lib/money";

export default function RecentTransactions({
  items,
  monthLabel,
}: {
  items: Transaction[];
  monthLabel: string;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="text-base font-semibold">Últimas movimentações</h2>
          <p className="mt-1 text-xs text-muted">
            Mais recentes de {monthLabel}
          </p>
        </div>
        <a
          href="#movimentacoes"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          Ver todas
        </a>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-muted sm:px-5">
          Nenhuma movimentação neste mês.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-2"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`shrink-0 text-muted ${item.type === "EXPENSE" ? "rotate-90" : ""}`}
              >
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={item.description}>
                  {item.description}
                </p>
                <p
                  className="mt-1 truncate text-xs text-muted"
                  title={`${item.accountName} · ${item.categoryName}`}
                >
                  {item.accountName} · {item.categoryName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`font-medium tabular-nums ${item.type === "INCOME" ? "text-accent" : "text-ink"}`}
                >
                  {item.type === "INCOME" ? "+" : "−"}{" "}
                  {formatMoney(item.amount)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  <time dateTime={item.date}>
                    {item.date.split("-").reverse().join("/")}
                  </time>{" "}
                  · {item.type === "INCOME" ? "Receita" : "Despesa"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
