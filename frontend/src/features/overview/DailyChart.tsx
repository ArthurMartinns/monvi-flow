import { useEffect, useRef, useState } from "react";
import { formatMoney } from "../../lib/money";
import { cents, percentage } from "./chartData";

type Day = { date: string; income: string; expense: string };

function scaleTop(maximum: bigint) {
  if (maximum === 0n) return 0n;
  const target = (maximum * 11n / 10n + 3n) / 4n;
  let base = 1n;
  while (base * 10n <= target) base *= 10n;
  const step = [10n, 20n, 25n, 50n, 100n].map((factor) => base * factor / 10n).find((step) => step >= target) ?? base * 10n;
  return step * 4n;
}

export default function DailyChart({ days }: { days: Day[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const maximum = days.reduce((max, day) => [max, cents(day.income), cents(day.expense)].reduce((a, b) => a > b ? a : b), 0n);
  const top = scaleTop(maximum);
  const left = 68, right = 8, height = width > 450 ? 240 : 200, bottom = 25;
  const plotHeight = height - 40;
  const plotWidth = width - left - right;
  const slot = plotWidth / Math.max(1, days.length);
  const bar = Math.max(1, Math.min(8, (slot - 2) / 2));
  const ticks = top === 0n ? [0] : [0, 1, 2, 3, 4];
  const tickStep = width < 450 ? 10 : 7;
  const formatAxis = (value: bigint) => `R$ ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) / 100)}`;
  return (
    <div ref={ref} className="relative min-w-0">
      <svg role="img" aria-label="Receitas e despesas registradas por dia, em reais" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
        {ticks.map((tick) => {
          const y = height - bottom - tick * plotHeight / 4;
          const value = top * BigInt(tick) / 4n;
          return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e0e6df" strokeWidth="1" /><text x={left - 10} y={y + 4} textAnchor="end" fill="#58675e" fontSize="11">{formatAxis(value)}</text></g>;
        })}
        {days.map((day, index) => {
          const x = left + index * slot + slot / 2;
          const incomeHeight = percentage(cents(day.income), top) / 100 * plotHeight;
          const expenseHeight = percentage(cents(day.expense), top) / 100 * plotHeight;
          return <g key={day.date}>
            <title>{`${day.date.split("-").reverse().join("/")}: receitas ${formatMoney(day.income)}, despesas ${formatMoney(day.expense)}`}</title>
            <rect x={x - bar - .5} y={height - bottom - incomeHeight} width={bar} height={incomeHeight} fill="#004d3c" />
            <rect x={x + .5} y={height - bottom - expenseHeight} width={bar} height={expenseHeight} fill="#aab7ae" />
            {index % tickStep === 0 && <text x={x} y={height - 5} textAnchor="middle" fill="#58675e" fontSize="11">{index + 1}</text>}
          </g>;
        })}
        {maximum === 0n && <text x={left + plotWidth / 2} y={90} textAnchor="middle" fill="#58675e" fontSize="13">Nenhuma movimentação no período.</text>}
      </svg>
      <div className="sr-only"><table><caption>Valores diários de receitas e despesas</caption><thead><tr><th>Data</th><th>Receitas</th><th>Despesas</th></tr></thead><tbody>{days.map((day) => <tr key={day.date}><td>{day.date.split("-").reverse().join("/")}</td><td>{formatMoney(day.income)}</td><td>{formatMoney(day.expense)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
