import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api";
import { cn } from "../lib/utils";

interface MatchupResult {
  p1: string;
  p2: string;
  p1_wins: number;
  p2_wins: number;
  total: number;
}

interface SimulationResult {
  matchup_results: Record<string, MatchupResult>;
  matchup_matrix_csv?: string;
  matchup_battle_logs?: unknown;
}

const CHART_COLORS = {
  primary: "#00f5ff",
  accent: "#ff00aa",
  muted: "#8b96b0",
};

export function SavedSimulationDetail({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<SimulationResult>(`/simulations/${runId}`)
      .then((d) => {
        if (!cancelled) setResult(d);
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
  }, [runId]);

  if (loading) {
    return <p className="text-[var(--text-muted)] py-4">Loading…</p>;
  }

  if (error || !result) {
    return (
      <p className="text-[var(--danger)] py-4">{error ?? "Failed to load simulation"}</p>
    );
  }

  const data = result.matchup_results ?? {};
  const entries = Object.values(data);
  const totalMatchups = entries.length;
  const totalBattles = entries.reduce((s, e) => s + e.total, 0);
  const p1TotalWins = entries.reduce((s, e) => s + e.p1_wins, 0);
  const p2TotalWins = entries.reduce((s, e) => s + e.p2_wins, 0);

  const chartData = Object.entries(
    entries.reduce<Record<string, number>>((acc, m) => {
      if (m.total > 0) {
        acc[m.p1] = (acc[m.p1] ?? 0) + m.p1_wins;
        acc[m.p2] = (acc[m.p2] ?? 0) + m.p2_wins;
      }
      return acc;
    }, {})
  )
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 12);

  const handleDownloadCsv = () => {
    if (!result.matchup_matrix_csv) return;
    const blob = new Blob([result.matchup_matrix_csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matchup_matrix_${runId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--primary)]">Results</h3>
        <div className="flex gap-2">
          {result.matchup_matrix_csv && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30"
            >
              Download CSV
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Matchups", value: totalMatchups },
          { label: "Total Battles", value: totalBattles },
          { label: "P1 Wins", value: p1TotalWins, color: CHART_COLORS.primary },
          { label: "P2 Wins", value: p2TotalWins, color: CHART_COLORS.accent },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]/50"
            style={color ? { borderLeftColor: color, borderLeftWidth: 3 } : undefined}
          >
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              {label}
            </div>
            <div className="text-lg font-semibold text-[var(--text)] mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">
            Top performers (wins)
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
                <XAxis type="number" stroke={CHART_COLORS.muted} fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  stroke={CHART_COLORS.muted}
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "var(--text)" }}
                />
                <Bar
                  dataKey="wins"
                  fill={CHART_COLORS.primary}
                  radius={[0, 4, 4, 0]}
                  name="Wins"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Matchup table</h4>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-panel)] z-10">
                <tr className="bg-[var(--bg-input)]">
                  <th className="px-3 py-2 text-left text-[var(--text-muted)]">P1</th>
                  <th className="px-3 py-2 text-left text-[var(--text-muted)]">P2</th>
                  <th className="px-3 py-2 text-right text-[var(--text-muted)]">P1 Wins</th>
                  <th className="px-3 py-2 text-right text-[var(--text-muted)]">P2 Wins</th>
                  <th className="px-3 py-2 text-right text-[var(--text-muted)]">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 50).map((m, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      "border-t border-[var(--border)]",
                      idx % 2 === 1 && "bg-[var(--bg-input)]/30"
                    )}
                  >
                    <td className="px-3 py-2 text-[var(--text)]">{m.p1}</td>
                    <td className="px-3 py-2 text-[var(--text)]">{m.p2}</td>
                    <td className="px-3 py-2 text-right text-[var(--text)]">{m.p1_wins}</td>
                    <td className="px-3 py-2 text-right text-[var(--text)]">{m.p2_wins}</td>
                    <td className="px-3 py-2 text-right text-[var(--primary)]">
                      {m.total > 0 ? ((m.p1_wins / m.total) * 100).toFixed(1) : "-"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entries.length > 50 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Showing first 50 of {entries.length} matchups
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
