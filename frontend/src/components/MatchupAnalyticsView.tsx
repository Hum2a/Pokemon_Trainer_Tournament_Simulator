import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PokemonSprite } from "./PokemonSprite";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "../lib/utils";

export interface MatchupResult {
  p1: string;
  p2: string;
  p1_wins: number;
  p2_wins: number;
  total: number;
}

export interface MatchupAnalyticsData {
  matchup_results: Record<string, MatchupResult>;
  matchup_matrix_csv?: string;
  matchup_battle_logs?: Record<string, Array<{ winner?: string; log?: string }>>;
  pool?: string[];
  pokemon_sets?: Record<string, string>;
  config_snapshot?: Record<string, unknown>;
}

const CHART_COLORS = {
  primary: "#00f5ff",
  accent: "#ff00aa",
  muted: "#8b96b0",
};

interface MatchupAnalyticsViewProps {
  data: MatchupAnalyticsData;
  onDownloadCsv?: () => void;
  extraActions?: React.ReactNode;
}

export function MatchupAnalyticsView({
  data,
  onDownloadCsv,
  extraActions,
}: MatchupAnalyticsViewProps) {
  const matchupResults = data.matchup_results ?? {};
  const entries = Object.values(matchupResults);
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--primary)]">Results</h3>
        <div className="flex gap-2">
          {data.matchup_matrix_csv && onDownloadCsv && (
            <button
              type="button"
              onClick={onDownloadCsv}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30"
            >
              Download CSV
            </button>
          )}
          {extraActions}
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
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PokemonSprite name={m.p1} size={24} />
                        <span className="text-[var(--text)]">{m.p1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PokemonSprite name={m.p2} size={24} />
                        <span className="text-[var(--text)]">{m.p2}</span>
                      </div>
                    </td>
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

      {(data.pool?.length ?? 0) > 0 && (
        <SimulationDetailSection title="Pokemon pool" defaultOpen={false}>
          <p className="text-sm text-[var(--text-muted)] mb-2">
            {data.pool!.length} Pokemon in this simulation
          </p>
          <div className="flex flex-wrap gap-2">
            {data.pool!.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--bg-input)] text-sm text-[var(--text)]"
              >
                <PokemonSprite name={name} size={32} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </SimulationDetailSection>
      )}

      {data.pokemon_sets && Object.keys(data.pokemon_sets).length > 0 && (
        <SimulationDetailSection title="Pokemon sets" defaultOpen={false}>
          <p className="text-sm text-[var(--text-muted)] mb-2">
            Sets used for each Pokemon (Showdown format)
          </p>
          <div className="space-y-4">
            {Object.entries(data.pokemon_sets).map(([name, setStr]) => (
              <div
                key={name}
                className="rounded-lg border border-[var(--border)] overflow-hidden"
              >
                <div className="px-3 py-2 flex items-center gap-2 bg-[var(--bg-input)] text-sm font-medium text-[var(--primary)]">
                  <PokemonSprite name={name} size={32} />
                  <span>{name}</span>
                </div>
                <pre className="p-3 text-xs text-[var(--text)] overflow-x-auto whitespace-pre-wrap font-mono">
                  {setStr}
                </pre>
              </div>
            ))}
          </div>
        </SimulationDetailSection>
      )}

      {data.config_snapshot && Object.keys(data.config_snapshot).length > 0 && (
        <SimulationDetailSection title="Simulation filters" defaultOpen={false}>
          <p className="text-sm text-[var(--text-muted)] mb-2">
            Settings used for this run
          </p>
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <pre className="p-3 text-xs text-[var(--text)] overflow-x-auto max-h-48 overflow-y-auto font-mono">
              {JSON.stringify(data.config_snapshot, null, 2)}
            </pre>
          </div>
        </SimulationDetailSection>
      )}
    </motion.div>
  );
}

function SimulationDetailSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center justify-between text-left text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-input)]/50"
      >
        {title}
        <span className="text-[var(--text-muted)]">{open ? "▼" : "▶"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-3 pt-0 border-t border-[var(--border)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
