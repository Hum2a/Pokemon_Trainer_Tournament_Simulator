import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { SavedSimulationDetail } from "../components/SavedSimulationDetail";

interface SimulationRun {
  id: string;
  type: string;
  status: string;
  created_at: string;
}

export function MySimulationsPage() {
  const { user, loading: authLoading, refreshAuth } = useAuth();
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (!user) {
      setRuns([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<SimulationRun[]>("/simulations")
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
        <p className="text-[var(--text-muted)]">Sign in to view your saved simulations.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
        <p className="text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-[var(--text)]">My Simulations</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Saved matchup results. Click one to view details.
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
          <p className="text-[var(--text-muted)]">No saved simulations yet.</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Run a matchup simulation and click &quot;Save to my account&quot; to store results here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run, i) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "rounded-xl border bg-[var(--bg-panel)] transition-colors cursor-pointer",
                selectedId === run.id
                  ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                  : "border-[var(--border)] hover:border-[var(--primary)]/50"
              )}
              onClick={() => setSelectedId(selectedId === run.id ? null : run.id)}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium capitalize",
                      run.status === "completed"
                        ? "bg-[var(--success)]/20 text-[var(--success)]"
                        : "bg-[var(--text-muted)]/20 text-[var(--text-muted)]"
                    )}
                  >
                    {run.status}
                  </span>
                  <span className="text-sm font-medium text-[var(--text)] capitalize">
                    {run.type}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
                <span className="text-[var(--text-muted)]">
                  {selectedId === run.id ? "▼" : "▶"}
                </span>
              </div>
              {selectedId === run.id && (
                <div
                  className="border-t border-[var(--border)] p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SavedSimulationDetail runId={run.id} onClose={() => setSelectedId(null)} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
