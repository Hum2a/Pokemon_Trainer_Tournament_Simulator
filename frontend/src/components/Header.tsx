import { useApp } from "../context/AppContext";

export function Header() {
  const { status } = useApp();
  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
      <h1 className="m-0 text-2xl font-bold bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] bg-clip-text text-transparent">
        Pokemon Battle Simulator
      </h1>
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <span
          className={`w-2 h-2 rounded-full ${
            status.running ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--success)]"
          }`}
        />
        <span>{status.text}</span>
      </div>
    </header>
  );
}
