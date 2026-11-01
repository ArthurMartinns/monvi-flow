export function sumBalances(values: string[]): string {
  const total = values.reduce((sum, value) => {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    return sum + (negative ? -cents : cents);
  }, 0n);
  const amount = total < 0n ? -total : total;
  return `${total < 0n ? "-" : ""}${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
}
