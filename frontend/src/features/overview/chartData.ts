export function cents(amount: string) {
  return BigInt(amount.replace(".", ""));
}

export function percentage(amount: bigint, total: bigint) {
  return total > 0n ? Number(amount * 10000n / total) / 100 : 0;
}

export function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  const length = new Date(year, number, 0).getDate();
  return Array.from({ length }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}
