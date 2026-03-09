import { useEffect, useRef } from "react";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/utils";

export function Log() {
  const { logEntries, clearLog } = useApp();
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logEntries]);

  return (
    <Panel title="Log / Progress">
      <pre
        ref={preRef}
        className="bg-[var(--bg-input)] rounded p-4 text-sm font-mono overflow-auto max-h-48 mb-3 whitespace-pre-wrap"
      >
        {logEntries.map((e, i) => (
          <div
            key={i}
            className={cn(e.type === "error" && "text-[var(--danger)]")}
          >
            {e.text}
          </div>
        ))}
      </pre>
      <button
        type="button"
        onClick={clearLog}
        className="px-3 py-1.5 text-xs rounded border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:bg-white/5"
      >
        Clear
      </button>
    </Panel>
  );
}
