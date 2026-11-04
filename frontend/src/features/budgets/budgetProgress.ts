import type { Budget } from "../../lib/budgets.ts";

export function budgetProgress(budget: Budget) {
  const spent = BigInt(budget.spent.replace(".", ""));
  const limit = BigInt(budget.limitAmount.replace(".", ""));
  const status =
    spent > limit
      ? "over"
      : spent === limit
        ? "reached"
        : spent * 100n >= limit * 80n
          ? "near"
          : "under";
  const labels = {
    over: "Limite ultrapassado",
    reached: "Limite atingido",
    near: "Próximo do limite",
    under: "Dentro do limite",
  };
  return {
    status,
    label: labels[status],
    width: Number(((spent > limit ? limit : spent) * 10000n) / limit) / 100,
  };
}
