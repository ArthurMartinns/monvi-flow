import type { TransactionFilters } from "./transactions";

const params = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "");
const positiveId = (value: string | null) => value && value.length <= 19 && /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n ? value : "";

export function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function validMonth(value: string | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith("0000");
}

export function readOverviewScope() {
  const query = params();
  const month = query.get("month");
  return { month: validMonth(month) ? month : currentMonth(), accountId: positiveId(query.get("accountId")) };
}

export function overviewHref(month: string, accountId: string) {
  const query = new URLSearchParams({ month });
  if (accountId) query.set("accountId", accountId);
  return `#inicio?${query}`;
}

export function budgetsHref(month: string) {
  return `#orcamentos?${new URLSearchParams({ month })}`;
}

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function readTransactionFilters(): TransactionFilters {
  const query = params();
  let from = validDate(query.get("from"));
  let to = validDate(query.get("to"));
  if (from && to && from > to) { from = ""; to = ""; }
  const page = Number(query.get("page"));
  const size = Number(query.get("size"));
  const type = query.get("type");
  return {
    from, to,
    accountId: positiveId(query.get("accountId")),
    categoryId: positiveId(query.get("categoryId")),
    type: type === "INCOME" || type === "EXPENSE" ? type : "",
    query: query.get("query")?.trim().slice(0, 100) ?? "",
    page: Number.isInteger(page) && page >= 0 && page <= 2147483647 ? page : 0,
    size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : 20,
  };
}

export function transactionsHref(filters: Partial<TransactionFilters>) {
  const query = new URLSearchParams();
  for (const key of ["from", "to", "accountId", "categoryId", "type", "query", "page", "size"] as const) {
    const value = filters[key];
    if (value === undefined || value === "" || key === "page" && value === 0 || key === "size" && value === 20) continue;
    query.set(key, String(value));
  }
  return `#movimentacoes${query.size ? `?${query}` : ""}`;
}
