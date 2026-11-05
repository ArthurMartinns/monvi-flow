import { useState } from "react";

const items = [
  { id: "overview", href: "#inicio", label: "Visão geral", path: "m3 10 9-7 9 7v11H3V10ZM9 21v-8h6v8" },
  { id: "accounts", href: "#contas", label: "Contas", path: "M3 7a3 3 0 0 1 3-3h12v5H6a3 3 0 0 1 0-6M3 7v13h18V9H6M16 14h5v3h-5z" },
  { id: "categories", href: "#categorias", label: "Categorias", path: "M3 3h8l10 10-8 8L3 11zM7 7h.01" },
  { id: "transactions", href: "#movimentacoes", label: "Movimentações", path: "M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4" },
  { id: "budgets", href: "#orcamentos", label: "Orçamentos", path: "M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12l9-9M17 3h4v4" },
  { id: "settings", href: "#configuracoes", label: "Configurações", path: "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6" },
];

type Props = { page: string; expanded: boolean; onToggle: () => void; name: string; onLogout: () => void; signingOut: boolean };

export default function Sidebar({ page, expanded, onToggle, name, onLogout, signingOut }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <aside className="border-b border-line bg-canvas lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:self-start lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className={`flex h-16 items-center gap-2 px-4 lg:h-20 ${expanded ? "lg:px-5" : "lg:flex-col lg:justify-center lg:gap-1 lg:px-2"}`}>
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-serif text-lg text-white">M</span>
        <span className={`font-semibold tracking-tight text-ink ${expanded ? "" : "lg:hidden"}`}>MonviFlow</span>
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls="sidebar-navigation" aria-label={expanded ? "Recolher menu" : "Expandir menu"} title={expanded ? "Recolher menu" : "Expandir menu"} className={`ml-auto hidden size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted hover:bg-[#e8ece8] focus-visible:outline-2 focus-visible:outline-accent lg:grid ${expanded ? "" : "lg:ml-0"}`}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={expanded ? "m14 5-7 7 7 7" : "m10 5 7 7-7 7"} /></svg>
        </button>
        <button type="button" onClick={() => setMobileOpen((open) => !open)} aria-expanded={mobileOpen} aria-controls="sidebar-navigation" className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium text-ink hover:bg-[#e8ece8] focus-visible:outline-2 focus-visible:outline-accent lg:hidden">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d={mobileOpen ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>{mobileOpen ? "Fechar" : "Menu"}
        </button>
      </div>
      <div id="sidebar-navigation" className={`${mobileOpen ? "flex" : "hidden"} flex-col px-3 pb-4 lg:flex lg:min-h-0 lg:flex-1 lg:pb-5`}>
        <nav aria-label="Menu principal" className="space-y-1 lg:mt-5">
          {items.map((item) => <a key={item.id} href={item.href} onClick={() => setMobileOpen(false)} aria-current={page === item.id ? "page" : undefined} title={item.label} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-10 ${page === item.id ? "bg-[#e6ebe5] font-medium text-ink" : "text-muted hover:bg-[#ecefeb] hover:text-ink"} ${expanded ? "" : "lg:justify-center lg:px-2"}`}>
            <svg className="shrink-0" aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
            <span className={expanded ? "" : "lg:sr-only"}>{item.label}</span>
          </a>)}
        </nav>
        <div className="mt-5 border-t border-line pt-4 lg:mt-auto">
          <div className={`mb-3 px-3 ${expanded ? "" : "lg:hidden"}`}><p className="truncate text-sm font-medium text-ink">{name}</p><p className="mt-1 text-xs text-muted">Finanças pessoais</p></div>
          <button type="button" onClick={onLogout} disabled={signingOut} title="Sair" className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-[#ecefeb] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 lg:min-h-10 ${expanded ? "" : "lg:justify-center lg:px-2"}`}>
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5v16h4M13 8l4 4-4 4M9 12h12" /></svg><span className={expanded ? "" : "lg:sr-only"}>{signingOut ? "Saindo…" : "Sair"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
