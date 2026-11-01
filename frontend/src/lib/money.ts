export function parseBalance(value: string): string {
  const input = value.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input)) {
    throw new Error("Informe um valor como 1.250,90 ou -100,00.");
  }
  const [whole, cents = ""] = input.replace(/\./g, "").replace(/^-/, "").split(",");
  const integer = whole.replace(/^0+(?=\d)/, "");
  if (integer.length > 17) throw new Error("O saldo pode ter no máximo 17 dígitos antes da vírgula.");
  return `${input.startsWith("-") ? "-" : ""}${integer}.${cents.padEnd(2, "0")}`;
}

export function formatMoney(value: string): string {
  const [whole, cents = "00"] = value.split(".");
  const integer = new Intl.NumberFormat("pt-BR").format(BigInt(whole.replace(/^-/, "")));
  return `${value.startsWith("-") ? "-" : ""}R$\u00a0${integer},${cents.padEnd(2, "0")}`;
}
