import { useState } from "react";
// ChevronDown icon inline to avoid lucide dependency

interface PanelProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function Panel({ title, children, defaultCollapsed = false }: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <section className="bg-[var(--bg-panel)] rounded-lg border border-[var(--border)] mb-4 overflow-hidden">
      <h2
        className="m-0 px-5 py-4 text-base font-semibold flex items-center justify-between cursor-pointer select-none bg-black/20"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>{title}</span>
        <span
          className={`inline-block w-4 h-4 text-[var(--text-muted)] transition-transform ${collapsed ? "rotate-[-90deg]" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </h2>
      {!collapsed && <div className="p-4">{children}</div>}
    </section>
  );
}
