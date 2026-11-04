import { useEffect, useRef } from "react";

type Action = { label: string; danger?: boolean; onSelect: (trigger: HTMLElement) => void };

export default function RowMenu({ name, actions }: { name: string; actions: Action[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const menu = ref.current;
    function dismiss(event: PointerEvent) {
      if (menu && !menu.contains(event.target as Node)) menu.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <details ref={ref} data-row-menu className="relative shrink-0" onToggle={(event) => {
      if (event.currentTarget.open) document.querySelectorAll<HTMLDetailsElement>("details[data-row-menu]").forEach((menu) => { if (menu !== event.currentTarget) menu.open = false; });
    }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
    }}>
      <summary aria-label={`Ações de ${name}`} title={`Ações de ${name}`} className="grid size-11 cursor-pointer list-none place-items-center rounded-lg text-muted hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent sm:size-9 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
      </summary>
      <div className="absolute top-full right-0 z-20 mt-1 w-44 rounded-lg border border-line bg-white p-1 shadow-lg">
        {actions.map((action) => <button key={action.label} type="button" onClick={() => {
          const menu = ref.current;
          const trigger = menu?.querySelector("summary");
          if (menu && trigger) { menu.open = false; action.onSelect(trigger); }
        }} className={`block min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent sm:min-h-9 ${action.danger ? "text-danger hover:bg-red-50" : "text-ink hover:bg-soft"}`}>{action.label}</button>)}
      </div>
    </details>
  );
}
