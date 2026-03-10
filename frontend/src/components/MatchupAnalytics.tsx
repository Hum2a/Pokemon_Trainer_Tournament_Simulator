import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { api } from "../api";
import { cn } from "../lib/utils";
import { PoolSets } from "./PoolSets";

interface MatchupResult {
  p1: string;
  p2: string;
  p1_wins: number;
  p2_wins: number;
  total: number;
}

type MatchupData = Record<string, MatchupResult>;

interface BattleLogAnalytics {
  global: {
    totalBattles: number;
    totalMatchups: number;
    avgTurns: number;
    totalMoves: number;
    superEffective: number;
    resisted: number;
    crits: number;
    misses: number;
    boosts: number;
    heals: number;
    recoil: number;
    itemsConsumed: number;
    statuses: Record<string, number>;
    turnDistribution: Record<number, number>;
  };
  byMatchup: Record<
    string,
    {
      p1: string;
      p2: string;
      totalBattles: number;
      p1Wins: number;
      p2Wins: number;
      avgTurns: number;
      turns: number[];
      movesP1: Record<string, number>;
      movesP2: Record<string, number>;
      superEffective: number;
      resisted: number;
      crits: number;
      misses: number;
      statuses: Record<string, number>;
      boosts: number;
      heals: number;
      recoil: number;
    }
  >;
  byPokemon: Record<
    string,
    {
      wins: number;
      losses: number;
      totalBattles: number;
      avgTurnsWhenWin: number;
      avgTurnsWhenLoss: number;
      moves: Record<string, number>;
      koMoves: Record<string, number>;
      superEffective: number;
      crits: number;
      misses: number;
    }
  >;
  topMoves: { move: string; count: number }[];
  topStatuses: { status: string; count: number }[];
}

const CHART_COLORS = {
  primary: "#00f5ff",
  accent: "#ff00aa",
  success: "#00ff88",
  danger: "#ff3366",
  amber: "#ffb800",
  muted: "#8b96b0",
};

function AnalyticsDetailModal({
  title,
  description,
  children,
  open,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const modalContent = open && typeof document !== "undefined" ? (
    <AnimatePresence>
      <motion.div
        key="analytics-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed left-1/2 top-1/2 z-[9999] flex w-[calc(100%-2rem)] max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl overflow-hidden sm:max-w-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-detail-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="min-w-0">
            <h2 id="analytics-detail-title" className="font-display font-semibold text-base text-[var(--primary)] truncate">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-input)] transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {children ?? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">No data to display</p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  ) : null;

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}

function useMatchupData(refreshTrigger: number) {
  const [data, setData] = useState<MatchupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<MatchupData>("/outputs/matchup-data")
      .then((d) => {
        if (!cancelled) setData(d);
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
  }, [refreshTrigger]);

  return { data, loading, error };
}

function useBattleLogAnalytics(refreshTrigger: number) {
  const [analytics, setAnalytics] = useState<BattleLogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<BattleLogAnalytics>("/outputs/matchup-battle-analytics")
      .then((d) => {
        if (!cancelled) setAnalytics(d);
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
  }, [refreshTrigger]);

  return { analytics, loading, error };
}

function SummaryStats({ data }: { data: MatchupData }) {
  const stats = useMemo(() => {
    const entries = Object.values(data);
    const totalMatchups = entries.length;
    const totalBattles = entries.reduce((s, e) => s + e.total, 0);
    const completedMatchups = entries.filter((e) => e.total > 0).length;
    const p1TotalWins = entries.reduce((s, e) => s + e.p1_wins, 0);
    const p2TotalWins = entries.reduce((s, e) => s + e.p2_wins, 0);
    const draws = totalBattles - p1TotalWins - p2TotalWins;
    return {
      totalMatchups,
      totalBattles,
      completedMatchups,
      p1TotalWins,
      p2TotalWins,
      draws,
      completionRate: totalMatchups > 0 ? (completedMatchups / totalMatchups) * 100 : 0,
    };
  }, [data]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        { label: "Total Matchups", value: stats.totalMatchups },
        { label: "Total Battles", value: stats.totalBattles },
        { label: "Completed", value: stats.completedMatchups },
        { label: "P1 Wins", value: stats.p1TotalWins, color: CHART_COLORS.primary },
        { label: "P2 Wins", value: stats.p2TotalWins, color: CHART_COLORS.accent },
        { label: "Completion %", value: `${stats.completionRate.toFixed(1)}%` },
      ].map(({ label, value, color }) => (
        <div
          key={label}
          className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]/50"
          style={color ? { borderLeftColor: color, borderLeftWidth: 3 } : undefined}
        >
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</div>
          <div className="text-lg font-semibold text-[var(--text)] mt-0.5">{value}</div>
        </div>
      ))}
    </div>
  );
}

function TopPerformersChart({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    const wins: Record<string, number> = {};
    for (const m of Object.values(data)) {
      if (m.total > 0) {
        wins[m.p1] = (wins[m.p1] ?? 0) + m.p1_wins;
        wins[m.p2] = (wins[m.p2] ?? 0) + m.p2_wins;
      }
    }
    return Object.entries(wins)
      .map(([name, w]) => ({ name, wins: w }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, expanded ? 25 : 15);
  }, [data, expanded]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-64"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis type="number" stroke={CHART_COLORS.muted} fontSize={11} />
          <YAxis type="category" dataKey="name" width={90} stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--text)" }}
          />
          <Bar dataKey="wins" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} name="Wins" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WinRateDistributionChart({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 0; i <= 10; i++) {
      buckets[`${i * 10}-${(i + 1) * 10}`] = 0;
    }
    for (const m of Object.values(data)) {
      if (m.total > 0) {
        const rate = (m.p1_wins / m.total) * 100;
        const bucket = Math.min(Math.floor(rate / 10) * 10, 100);
        const key = `${bucket}-${bucket + 10}`;
        buckets[key] = (buckets[key] ?? 0) + 1;
      }
    }
    return Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([name, count]) => ({ range: name, count }));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-72" : "h-48"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis dataKey="range" stroke={CHART_COLORS.muted} fontSize={expanded ? 12 : 10} />
          <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Bar dataKey="count" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} name="Matchups" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WinLossPieChart({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const pieData = useMemo(() => {
    let p1 = 0,
      p2 = 0,
      draws = 0;
    for (const m of Object.values(data)) {
      p1 += m.p1_wins;
      p2 += m.p2_wins;
      draws += m.total - m.p1_wins - m.p2_wins;
    }
    return [
      { name: "P1 Wins", value: p1, color: CHART_COLORS.primary },
      { name: "P2 Wins", value: p2, color: CHART_COLORS.accent },
      { name: "Draws/Incomplete", value: draws, color: CHART_COLORS.muted },
    ].filter((d) => d.value > 0);
  }, [data]);

  if (pieData.length === 0) return null;

  return (
    <div className={expanded ? "h-72" : "h-48"}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={expanded ? 55 : 40}
            outerRadius={expanded ? 85 : 70}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
            formatter={(value) => [Number(value ?? 0), ""] as [React.ReactNode, string]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function DominanceChart({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    const dominance: Record<string, number> = {};
    for (const m of Object.values(data)) {
      if (m.total > 0) {
        const d = m.p1_wins - m.p2_wins;
        dominance[m.p1] = (dominance[m.p1] ?? 0) + d;
        dominance[m.p2] = (dominance[m.p2] ?? 0) - d;
      }
    }
    return Object.entries(dominance)
      .map(([name, d]) => ({ name, dominance: d }))
      .sort((a, b) => b.dominance - a.dominance)
      .slice(0, expanded ? 20 : 12);
  }, [data, expanded]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-56"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis dataKey="name" stroke={CHART_COLORS.muted} fontSize={expanded ? 12 : 10} angle={-35} textAnchor="end" height={60} />
          <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Bar
            dataKey="dominance"
            fill={CHART_COLORS.primary}
            radius={[4, 4, 0, 0]}
            name="Net Wins (P1 perspective)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MostOneSidedChart({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([, m]) => m.total >= 3)
      .map(([key, m]) => {
        const rate = m.total > 0 ? m.p1_wins / m.total : 0;
        const margin = Math.abs(rate - 0.5) * 2;
        return {
          matchup: key,
          p1WinRate: rate * 100,
          margin,
          total: m.total,
        };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, expanded ? 20 : 10);
  }, [data, expanded]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-56"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis type="number" domain={[0, 100]} stroke={CHART_COLORS.muted} fontSize={expanded ? 12 : 11} unit="%" />
          <YAxis type="category" dataKey="matchup" width={expanded ? 160 : 120} stroke={CHART_COLORS.muted} fontSize={expanded ? 11 : 10} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
            formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "P1 Win Rate"] as [React.ReactNode, string]}
            labelFormatter={(label) => `Matchup: ${label}`}
          />
          <Bar
            dataKey="p1WinRate"
            fill={CHART_COLORS.amber}
            radius={[0, 4, 4, 0]}
            name="P1 Win %"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BattlesPerMatchupChart({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    const dist: Record<number, number> = {};
    for (const m of Object.values(data)) {
      const t = m.total;
      dist[t] = (dist[t] ?? 0) + 1;
    }
    return Object.entries(dist)
      .map(([total, count]) => ({ total: parseInt(total, 10), count }))
      .sort((a, b) => a.total - b.total)
      .slice(0, 20);
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-72" : "h-48"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 20 }}>
          <defs>
            <linearGradient id="battlesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.4} />
              <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis dataKey="total" stroke={CHART_COLORS.muted} fontSize={11} name="Battles" />
          <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART_COLORS.success}
            fill="url(#battlesGrad)"
            name="Matchups"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BattleLengthChart({ analytics, expanded }: { analytics: BattleLogAnalytics; expanded?: boolean }) {
  const g = analytics.global;
  if (g.totalBattles === 0) return null;
  const turnDist = Object.entries(g.turnDistribution)
    .map(([t, c]) => ({ turns: parseInt(t, 10), count: c }))
    .sort((a, b) => a.turns - b.turns);
  if (turnDist.length === 0) return null;

  return (
    <div className={expanded ? "h-72" : "h-48"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={turnDist} margin={{ top: 5, right: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis dataKey="turns" stroke={CHART_COLORS.muted} fontSize={11} name="Turns" />
          <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} name="Battles" />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--text-muted)] mt-2">Avg: {g.avgTurns.toFixed(1)} turns per battle</p>
    </div>
  );
}

function TopMovesChart({ analytics, expanded }: { analytics: BattleLogAnalytics; expanded?: boolean }) {
  const top = analytics.topMoves.slice(0, expanded ? 20 : 12);
  if (top.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-56"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ left: 8, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis type="number" stroke={CHART_COLORS.muted} fontSize={11} />
          <YAxis type="category" dataKey="move" width={100} stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Bar dataKey="count" fill={CHART_COLORS.amber} radius={[0, 4, 4, 0]} name="Uses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TypeEffectivenessPie({ analytics, expanded }: { analytics: BattleLogAnalytics; expanded?: boolean }) {
  const g = analytics.global;
  const total = g.superEffective + g.resisted + Math.max(0, g.totalMoves - g.superEffective - g.resisted);
  if (total === 0) return null;
  const neutral = Math.max(0, g.totalMoves - g.superEffective - g.resisted);
  const data = [
    { name: "Super effective", value: g.superEffective, color: CHART_COLORS.success },
    { name: "Resisted", value: g.resisted, color: CHART_COLORS.danger },
    { name: "Neutral", value: neutral, color: CHART_COLORS.muted },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <div className={expanded ? "h-72" : "h-48"}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={expanded ? 55 : 35}
            outerRadius={expanded ? 85 : 65}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CritMissStats({ analytics }: { analytics: BattleLogAnalytics }) {
  const g = analytics.global;
  if (g.totalMoves === 0) return null;
  const critRate = ((g.crits / g.totalMoves) * 100).toFixed(2);
  const missRate = ((g.misses / g.totalMoves) * 100).toFixed(2);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)]/50">
          <div className="text-xs text-[var(--text-muted)] uppercase">Critical Hits</div>
          <div className="text-xl font-bold text-[var(--danger)]">{g.crits}</div>
          <div className="text-xs text-[var(--text-muted)]">{critRate}% of moves</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)]/50">
          <div className="text-xs text-[var(--text-muted)] uppercase">Misses</div>
          <div className="text-xl font-bold text-[var(--amber)]">{g.misses}</div>
          <div className="text-xs text-[var(--text-muted)]">{missRate}% of moves</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-1 rounded bg-[var(--success)]/20 text-[var(--success)] text-xs">
          Boosts: {g.boosts}
        </span>
        <span className="px-2 py-1 rounded bg-[var(--primary)]/20 text-[var(--primary)] text-xs">
          Heals: {g.heals}
        </span>
        <span className="px-2 py-1 rounded bg-[var(--danger)]/20 text-[var(--danger)] text-xs">
          Recoil: {g.recoil}
        </span>
        <span className="px-2 py-1 rounded bg-[var(--amber)]/20 text-[var(--amber)] text-xs">
          Items consumed: {g.itemsConsumed}
        </span>
      </div>
    </div>
  );
}

function StatusBreakdownChart({ analytics, expanded }: { analytics: BattleLogAnalytics; expanded?: boolean }) {
  const statuses = analytics.topStatuses;
  if (statuses.length === 0) return null;

  const statusLabels: Record<string, string> = {
    frz: "Freeze",
    brn: "Burn",
    par: "Paralysis",
    psn: "Poison",
    tox: "Toxic",
    slp: "Sleep",
  };

  const data = statuses.map((s) => ({
    name: statusLabels[s.status] ?? s.status,
    count: s.count,
  }));

  return (
    <div className={expanded ? "h-72" : "h-40"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis dataKey="name" stroke={CHART_COLORS.muted} fontSize={expanded ? 12 : 10} />
          <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Bar dataKey="count" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} name="Occurrences" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AvgTurnsByPokemonChart({ analytics, expanded }: { analytics: BattleLogAnalytics; expanded?: boolean }) {
  const chartData = useMemo(() => {
    return Object.entries(analytics.byPokemon)
      .filter(([, p]) => p.totalBattles >= 2)
      .map(([name, p]) => ({
        name,
        avgWin: p.avgTurnsWhenWin,
        avgLoss: p.avgTurnsWhenLoss,
        wins: p.wins,
        losses: p.losses,
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, expanded ? 20 : 10);
  }, [analytics, expanded]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-56"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis dataKey="name" stroke={CHART_COLORS.muted} fontSize={expanded ? 12 : 10} angle={-35} textAnchor="end" height={60} />
          <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Bar dataKey="avgWin" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} name="Avg turns when winning" />
          <Bar dataKey="avgLoss" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} name="Avg turns when losing" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MatchupDetailPanel({ analytics }: { analytics: BattleLogAnalytics }) {
  const [selected, setSelected] = useState("");
  const matchups = Object.keys(analytics.byMatchup).sort();
  const detail = selected ? analytics.byMatchup[selected] : null;

  if (matchups.length === 0) return null;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--text-muted)]">Select matchup for details</label>
      <select
        aria-label="Select matchup for details"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text)] text-sm"
      >
        <option value="">—</option>
        {matchups.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {detail && (
        <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]/50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><span className="text-[var(--text-muted)]">Battles:</span> {detail.totalBattles}</div>
            <div><span className="text-[var(--text-muted)]">P1 wins:</span> {detail.p1Wins}</div>
            <div><span className="text-[var(--text-muted)]">P2 wins:</span> {detail.p2Wins}</div>
            <div><span className="text-[var(--text-muted)]">Avg turns:</span> {detail.avgTurns.toFixed(1)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded bg-[var(--amber)]/20 text-xs">Super: {detail.superEffective}</span>
            <span className="px-2 py-1 rounded bg-[var(--danger)]/20 text-xs">Resisted: {detail.resisted}</span>
            <span className="px-2 py-1 rounded bg-[var(--danger)]/20 text-xs">Crits: {detail.crits}</span>
            <span className="px-2 py-1 rounded bg-[var(--text-muted)]/20 text-xs">Misses: {detail.misses}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[var(--primary)] font-medium mb-1">{detail.p1} moves</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(detail.movesP1)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([m, c]) => (
                    <span key={m} className="px-2 py-0.5 rounded bg-[var(--primary)]/20 text-xs">{m} ({c})</span>
                  ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--accent)] font-medium mb-1">{detail.p2} moves</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(detail.movesP2)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([m, c]) => (
                    <span key={m} className="px-2 py-0.5 rounded bg-[var(--accent)]/20 text-xs">{m} ({c})</span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchupHeatmapPreview({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const { pokemon, matrix } = useMemo(() => {
    const allPokemon = new Set<string>();
    for (const m of Object.values(data)) {
      allPokemon.add(m.p1);
      allPokemon.add(m.p2);
    }
    const list = Array.from(allPokemon).sort().slice(0, expanded ? 20 : 12);
    const idx = Object.fromEntries(list.map((p, i) => [p, i]));
    const size = list.length;
    const mat: number[][] = Array(size)
      .fill(0)
      .map(() => Array(size).fill(NaN));
    for (const m of Object.values(data)) {
      if (m.total > 0 && idx[m.p1] !== undefined && idx[m.p2] !== undefined) {
        const i = idx[m.p1];
        const j = idx[m.p2];
        mat[i][j] = (m.p1_wins / m.total) * 100;
      }
    }
    return { pokemon: list, matrix: mat };
  }, [data, expanded]);

  if (pokemon.length === 0) return null;

  const cellSize = expanded ? Math.min(32, Math.floor(600 / pokemon.length)) : Math.min(24, Math.floor(280 / pokemon.length));

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-0">
        <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${pokemon.length + 1}, ${cellSize}px)` }}>
          <div className="bg-transparent" />
          {pokemon.map((p) => (
            <div
              key={`col-${p}`}
              className="text-[10px] text-[var(--text-muted)] truncate flex items-center justify-center bg-[var(--bg-input)]"
              title={p}
            >
              {p.slice(0, 4)}
            </div>
          ))}
          {matrix.map((row, i) => (
            <React.Fragment key={`row-${i}`}>
              <div
                className="text-[10px] text-[var(--text-muted)] truncate flex items-center justify-end pr-1 bg-[var(--bg-input)]"
                title={pokemon[i]}
              >
                {pokemon[i].slice(0, 4)}
              </div>
              {row.map((val, j) => (
                <div
                  key={`${i}-${j}`}
                  className="rounded-sm flex items-center justify-center text-[9px] font-medium"
                  style={{
                    backgroundColor:
                      Number.isNaN(val) || val === undefined
                        ? "rgba(139,150,176,0.1)"
                        : `rgba(0,245,255,${0.2 + (val / 100) * 0.8})`,
                    color: val >= 50 ? "#050508" : "var(--text)",
                  }}
                  title={`${pokemon[i]} vs ${pokemon[j]}: ${Number.isNaN(val) ? "—" : val.toFixed(0) + "%"}`}
                >
                  {Number.isNaN(val) ? "—" : val.toFixed(0)}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-2">
          Rows = P1 (attacker), Cols = P2 (defender). Value = P1 win %.
        </div>
      </div>
    </div>
  );
}

function PokemonWinRateRadar({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    const byPokemon: Record<string, { wins: number; total: number }> = {};
    for (const m of Object.values(data)) {
      if (m.total > 0) {
        byPokemon[m.p1] = {
          wins: (byPokemon[m.p1]?.wins ?? 0) + m.p1_wins,
          total: (byPokemon[m.p1]?.total ?? 0) + m.total,
        };
        byPokemon[m.p2] = {
          wins: (byPokemon[m.p2]?.wins ?? 0) + m.p2_wins,
          total: (byPokemon[m.p2]?.total ?? 0) + m.total,
        };
      }
    }
    return Object.entries(byPokemon)
      .filter(([, v]) => v.total >= 5)
      .map(([name, v]) => ({
        name,
        winRate: (v.wins / v.total) * 100,
        fullMark: 100,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, expanded ? 10 : 6);
  }, [data, expanded]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-56"}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData}>
          <PolarGrid stroke={CHART_COLORS.muted} strokeOpacity={0.3} />
          <PolarAngleAxis dataKey="name" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} />
          <Radar
            name="Win Rate %"
            dataKey="winRate"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.3}
          />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
            formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Win Rate"] as [React.ReactNode, string]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LossLeadersChart({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    const losses: Record<string, number> = {};
    for (const m of Object.values(data)) {
      if (m.total > 0) {
        losses[m.p1] = (losses[m.p1] ?? 0) + m.p2_wins;
        losses[m.p2] = (losses[m.p2] ?? 0) + m.p1_wins;
      }
    }
    return Object.entries(losses)
      .map(([name, l]) => ({ name, losses: l }))
      .sort((a, b) => b.losses - a.losses)
      .slice(0, expanded ? 20 : 10);
  }, [data, expanded]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-48"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis type="number" stroke={CHART_COLORS.muted} fontSize={expanded ? 12 : 11} />
          <YAxis type="category" dataKey="name" width={expanded ? 120 : 90} stroke={CHART_COLORS.muted} fontSize={expanded ? 12 : 11} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Bar dataKey="losses" fill={CHART_COLORS.danger} radius={[0, 4, 4, 0]} name="Losses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScatterWinRateVsBattles({ data, expanded }: { data: MatchupData; expanded?: boolean }) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([, m]) => m.total >= 1)
      .map(([key, m]) => ({
        matchup: key,
        winRate: (m.p1_wins / m.total) * 100,
        battles: m.total,
      }));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className={expanded ? "h-80" : "h-56"}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,150,176,0.2)" />
          <XAxis dataKey="battles" name="Battles" stroke={CHART_COLORS.muted} fontSize={11} />
          <YAxis dataKey="winRate" name="P1 Win %" stroke={CHART_COLORS.muted} fontSize={11} domain={[0, 100]} />
          <ZAxis range={[50, 200]} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8 }}
            formatter={(value, name) => [
              String(name) === "winRate" ? `${Number(value ?? 0).toFixed(1)}%` : String(value ?? ""),
              String(name) === "winRate" ? "P1 Win %" : "Battles",
            ] as [React.ReactNode, string]}
            labelFormatter={(label) => `Matchup: ${label}`}
          />
          <Scatter name="Matchups" data={chartData} fill={CHART_COLORS.primary} fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function PoolSetsWidget({ data, refreshTrigger, smogonFormat }: { data: MatchupData; refreshTrigger: number; smogonFormat?: string }) {
  const [format, setFormat] = useState(smogonFormat ?? "gen9ou");
  useEffect(() => {
    if (smogonFormat) setFormat(smogonFormat);
  }, [smogonFormat]);
  const pokemon = useMemo(() => {
    const set = new Set<string>();
    for (const m of Object.values(data)) {
      set.add(m.p1);
      set.add(m.p2);
    }
    return Array.from(set).sort();
  }, [data]);

  return (
    <PoolSets
      pokemon={pokemon}
      format={format}
      onFormatChange={setFormat}
      refreshTrigger={refreshTrigger}
    />
  );
}

type BattleLogsData = Record<string, Array<{ winner: string | null; log: string }>>;

interface ParsedEvent {
  type: "switch" | "move" | "damage" | "heal" | "boost" | "unboost" | "status" | "faint" | "supereffective" | "resisted" | "crit" | "miss" | "weather" | "ability" | "enditem" | "prepare" | "activate" | "other";
  side?: "p1" | "p2";
  pokemon?: string;
  target?: string;
  move?: string;
  value?: string;
  raw?: string;
}

interface ParsedTurn {
  turnNum: number;
  events: ParsedEvent[];
  p1Hp?: { current: number; max: number };
  p2Hp?: { current: number; max: number };
}

function parseBattleLog(log: string, matchup: string): { turns: ParsedTurn[]; p1Name: string; p2Name: string; winner: string | null } {
  const [p1Name, p2Name] = matchup.split(" vs ");
  const lines = log.split("\n").map((l) => l.trim()).filter(Boolean);
  const turns: ParsedTurn[] = [];
  let currentTurn: ParsedTurn | null = null;
  let p1Hp: { current: number; max: number } | null = null;
  let p2Hp: { current: number; max: number } | null = null;
  let winner: string | null = null;

  const parseHp = (hpStr: string): { current: number; max: number } | null => {
    const m = hpStr.match(/(\d+)\/(\d+)|(\d+)\s*fnt/);
    if (!m) return null;
    if (m[3]) return { current: 0, max: p1Hp?.max ?? p2Hp?.max ?? 1 };
    return { current: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  };

  const getSide = (pos: string): "p1" | "p2" => (pos.startsWith("p1") ? "p1" : "p2");
  const getPokemon = (pos: string): string => {
    const m = pos.match(/(?:p1a|p2a):\s*([^|]+)/);
    return m ? m[1].trim() : pos;
  };

  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const parts = line.slice(1).split("|");
    const cmd = parts[0];
    const arg1 = parts[1] ?? "";
    const arg2 = parts[2] ?? "";
    const arg3 = parts[3] ?? "";

    if (cmd === "switch") {
      const hp = parseHp(arg2);
      if (arg1.includes("p1a")) {
        p1Hp = hp ?? p1Hp;
      } else if (arg1.includes("p2a")) {
        p2Hp = hp ?? p2Hp;
      }
      if (currentTurn) {
        currentTurn.events.push({
          type: "switch",
          side: getSide(arg1),
          pokemon: getPokemon(arg1),
          value: arg2,
        });
        currentTurn.p1Hp = p1Hp ?? undefined;
        currentTurn.p2Hp = p2Hp ?? undefined;
      }
    } else if (cmd === "-damage") {
      const hp = parseHp(arg2);
      if (arg1.includes("p1a")) p1Hp = hp ?? p1Hp;
      else if (arg1.includes("p2a")) p2Hp = hp ?? p2Hp;
      if (currentTurn) {
        currentTurn.events.push({
          type: "damage",
          side: getSide(arg1),
          pokemon: getPokemon(arg1),
          value: arg2,
          raw: arg3,
        });
        currentTurn.p1Hp = p1Hp ?? undefined;
        currentTurn.p2Hp = p2Hp ?? undefined;
      }
    } else if (cmd === "-heal") {
      const hp = parseHp(arg2);
      if (arg1.includes("p1a")) p1Hp = hp ?? p1Hp;
      else if (arg1.includes("p2a")) p2Hp = hp ?? p2Hp;
      if (currentTurn) {
        currentTurn.events.push({ type: "heal", side: getSide(arg1), pokemon: getPokemon(arg1), value: arg2, raw: arg3 });
        currentTurn.p1Hp = p1Hp ?? undefined;
        currentTurn.p2Hp = p2Hp ?? undefined;
      }
    } else if (cmd === "move") {
      if (!currentTurn) continue;
      currentTurn.events.push({
        type: "move",
        side: getSide(arg1),
        pokemon: getPokemon(arg1),
        move: arg2,
        target: arg3 ? getPokemon(arg3) : undefined,
      });
    } else if (cmd === "-boost") {
      if (currentTurn) {
        currentTurn.events.push({
          type: "boost",
          side: getSide(arg1),
          pokemon: getPokemon(arg1),
          value: `${arg2} +${arg3}`,
        });
      }
    } else if (cmd === "-unboost") {
      if (currentTurn) {
        currentTurn.events.push({
          type: "unboost",
          side: getSide(arg1),
          pokemon: getPokemon(arg1),
          value: `${arg2} -${arg3}`,
        });
      }
    } else if (cmd === "-faint") {
      if (arg1.includes("p1a")) p1Hp = { current: 0, max: p1Hp ? (p1Hp as { max: number }).max : 1 };
      else if (arg1.includes("p2a")) p2Hp = { current: 0, max: p2Hp ? (p2Hp as { max: number }).max : 1 };
      if (currentTurn) {
        currentTurn.events.push({ type: "faint", side: getSide(arg1), pokemon: getPokemon(arg1) });
        currentTurn.p1Hp = p1Hp ?? undefined;
        currentTurn.p2Hp = p2Hp ?? undefined;
      }
    } else if (cmd === "-supereffective") {
      if (currentTurn) currentTurn.events.push({ type: "supereffective", side: getSide(arg1), pokemon: getPokemon(arg1) });
    } else if (cmd === "-resisted") {
      if (currentTurn) currentTurn.events.push({ type: "resisted", side: getSide(arg1), pokemon: getPokemon(arg1) });
    } else if (cmd === "-crit") {
      if (currentTurn) currentTurn.events.push({ type: "crit", side: getSide(arg1), pokemon: getPokemon(arg1) });
    } else if (cmd === "-miss") {
      if (currentTurn) currentTurn.events.push({ type: "miss", pokemon: arg1, target: arg2 });
    } else if (cmd === "-weather") {
      if (currentTurn) currentTurn.events.push({ type: "weather", value: arg1 });
    } else if (cmd === "-ability") {
      if (currentTurn) currentTurn.events.push({ type: "ability", side: getSide(arg1), pokemon: getPokemon(arg1), value: arg2 });
    } else if (cmd === "-enditem") {
      if (currentTurn) currentTurn.events.push({ type: "enditem", side: getSide(arg1), pokemon: getPokemon(arg1), value: arg2 });
    } else if (cmd === "-prepare") {
      if (currentTurn) currentTurn.events.push({ type: "prepare", side: getSide(arg1), pokemon: getPokemon(arg1), move: arg2 });
    } else if (cmd === "-activate" && arg2 !== "confusion") {
      if (currentTurn) currentTurn.events.push({ type: "activate", side: getSide(arg1), pokemon: getPokemon(arg1), value: arg2 });
    } else if (cmd === "-status") {
      if (currentTurn) currentTurn.events.push({ type: "status", side: getSide(arg1), pokemon: getPokemon(arg1), value: arg2 });
    } else if (cmd === "turn") {
      currentTurn = { turnNum: parseInt(arg1, 10) || 0, events: [], p1Hp: p1Hp ?? undefined, p2Hp: p2Hp ?? undefined };
      turns.push(currentTurn);
    } else if (cmd === "win") {
      winner = arg1.includes("Bot 1") ? "p1" : arg1.includes("Bot 2") ? "p2" : null;
    } else if (cmd === "start" && !currentTurn) {
      currentTurn = { turnNum: 0, events: [], p1Hp: p1Hp ?? undefined, p2Hp: p2Hp ?? undefined };
      turns.push(currentTurn);
    }
  }

  return { turns, p1Name, p2Name, winner };
}

function BattleReplay({ log, matchup, winner }: { log: string; matchup: string; winner: string | null }) {
  const parsed = useMemo(() => parseBattleLog(log, matchup), [log, matchup]);
  const { turns, p1Name, p2Name } = parsed;

  const isErrorLog = log.includes("Error:") || log.includes("MODULE_NOT_FOUND") || log.includes("node:internal");
  if (isErrorLog || !log.includes("|turn|")) {
    return (
      <pre className="p-4 text-xs text-[var(--text-muted)] bg-[var(--bg-input)] rounded-lg overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap font-mono border border-[var(--border)]/50">
        {log}
      </pre>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-xl bg-[var(--bg-panel)]/80 border border-[var(--border)]/40">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--primary)] truncate">{p1Name}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Player 1</div>
        </div>
        <div className="flex-shrink-0 px-2 py-1 rounded-lg bg-[var(--bg-input)] text-sm font-medium text-[var(--text-muted)]">
          VS
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="font-semibold text-[var(--accent)] truncate">{p2Name}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Player 2</div>
        </div>
      </div>

      {turns.map((turn, idx) => (
        <motion.div
          key={turn.turnNum}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03 }}
          className="rounded-xl border border-[var(--border)]/50 overflow-hidden bg-[var(--bg-input)]/30"
        >
          <div className="px-4 py-2 bg-[var(--bg-panel)]/60 border-b border-[var(--border)]/30">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-semibold text-[var(--primary)]">Turn {turn.turnNum}</span>
            </div>
            {(turn.p1Hp || turn.p2Hp) && (
              <div className="flex gap-4">
                {turn.p1Hp && (
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-[var(--primary)] truncate">{p1Name}</span>
                      <span className="text-[var(--text-muted)]">{turn.p1Hp.current}/{turn.p1Hp.max}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--border)]/50 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          turn.p1Hp.current / turn.p1Hp.max > 0.5 ? "bg-[var(--primary)]" : turn.p1Hp.current / turn.p1Hp.max > 0.2 ? "bg-[var(--amber)]" : "bg-[var(--danger)]"
                        )}
                        style={{ width: `${Math.max(0, (turn.p1Hp.current / turn.p1Hp.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {turn.p2Hp && (
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-[var(--accent)] truncate">{p2Name}</span>
                      <span className="text-[var(--text-muted)]">{turn.p2Hp.current}/{turn.p2Hp.max}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--border)]/50 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          turn.p2Hp.current / turn.p2Hp.max > 0.5 ? "bg-[var(--accent)]" : turn.p2Hp.current / turn.p2Hp.max > 0.2 ? "bg-[var(--amber)]" : "bg-[var(--danger)]"
                        )}
                        style={{ width: `${Math.max(0, (turn.p2Hp.current / turn.p2Hp.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-3 space-y-2">
            {turn.events.map((ev, i) => {
              if (ev.type === "switch") {
                const m = ev.value?.match(/(\d+)\/(\d+)/);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={cn("px-2 py-1 rounded-lg text-sm font-medium", ev.side === "p1" ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--accent)]/20 text-[var(--accent)]")}>
                      {ev.pokemon}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">entered the battle</span>
                    {m && <span className="text-xs text-[var(--text-muted)]">({m[1]}/{m[2]} HP)</span>}
                  </div>
                );
              }
              if (ev.type === "move") {
                return (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <span className={cn("px-2 py-1 rounded-lg text-sm font-medium", ev.side === "p1" ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--accent)]/20 text-[var(--accent)]")}>
                      {ev.pokemon}
                    </span>
                    <span className="text-[var(--text-muted)]">used</span>
                    <span className="px-2 py-1 rounded-lg bg-[var(--amber)]/20 text-[var(--amber)] font-medium text-sm">
                      {ev.move}
                    </span>
                    {ev.target && ev.target !== ev.pokemon && (
                      <>
                        <span className="text-[var(--text-muted)]">→</span>
                        <span className="text-[var(--text)]">{ev.target}</span>
                      </>
                    )}
                  </div>
                );
              }
              if (ev.type === "damage") {
                const m = ev.value?.match(/(\d+)\/(\d+)|(\d+)\s*fnt/);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", ev.side === "p1" ? "bg-[var(--primary)]" : "bg-[var(--accent)]")} />
                    <span className="text-sm text-[var(--text-muted)]">
                      {ev.pokemon} took damage
                      {ev.raw && <span className="text-[var(--text)]/70"> ({ev.raw})</span>}
                    </span>
                    {m && !m[3] && (
                      <span className="text-xs text-[var(--danger)]">→ {m[1]}/{m[2]}</span>
                    )}
                  </div>
                );
              }
              if (ev.type === "heal") {
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                    <span className="text-sm text-[var(--success)]">{ev.pokemon} healed</span>
                    {ev.raw && <span className="text-xs text-[var(--text-muted)]">{ev.raw}</span>}
                  </div>
                );
              }
              if (ev.type === "boost") {
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                    <span className="text-sm text-[var(--success)]">{ev.pokemon} {ev.value}</span>
                  </div>
                );
              }
              if (ev.type === "unboost") {
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--danger)]" />
                    <span className="text-sm text-[var(--danger)]">{ev.pokemon} {ev.value}</span>
                  </div>
                );
              }
              if (ev.type === "faint") {
                return (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="px-2 py-0.5 rounded bg-[var(--danger)]/30 text-[var(--danger)] font-medium text-sm">
                      {ev.pokemon} fainted!
                    </span>
                  </div>
                );
              }
              if (ev.type === "supereffective") {
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--amber)]/20 text-[var(--amber)] text-xs font-medium">
                    Super effective!
                  </span>
                );
              }
              if (ev.type === "resisted") {
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary)] text-xs">
                    Resisted
                  </span>
                );
              }
              if (ev.type === "crit") {
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--danger)]/20 text-[var(--danger)] text-xs font-medium">
                    Critical hit!
                  </span>
                );
              }
              if (ev.type === "miss") {
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--text-muted)]/20 text-[var(--text-muted)] text-xs">
                    Miss!
                  </span>
                );
              }
              if (ev.type === "weather") {
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] text-xs">
                    Weather: {ev.value}
                  </span>
                );
              }
              if (ev.type === "ability") {
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] text-xs">
                    {ev.pokemon}'s {ev.value}
                  </span>
                );
              }
              if (ev.type === "status") {
                const statusPhrases: Record<string, string> = { tox: "was poisoned", brn: "was burned", par: "was paralyzed", slp: "fell asleep", frz: "was frozen" };
                const phrase = statusPhrases[ev.value ?? ""] ?? `got ${ev.value}`;
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--danger)]/20 text-[var(--danger)] text-xs">
                    {ev.pokemon} {phrase}
                  </span>
                );
              }
              if (ev.type === "prepare") {
                return (
                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-[var(--amber)]/20 text-[var(--amber)] text-xs">
                    {ev.pokemon} is preparing {ev.move}!
                  </span>
                );
              }
              return null;
            })}
          </div>
        </motion.div>
      ))}

      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border-2 border-[var(--success)]/50 bg-[var(--success)]/10 p-4 text-center"
        >
          <div className="text-sm text-[var(--text-muted)]">Winner</div>
          <div className={cn("font-display font-bold text-lg mt-1", winner === "p1" ? "text-[var(--primary)]" : "text-[var(--accent)]")}>
            {winner === "p1" ? p1Name : p2Name}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function BattleLogsViewer({ refreshTrigger }: { refreshTrigger: number }) {
  const [logs, setLogs] = useState<BattleLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMatchup, setSelectedMatchup] = useState("");
  const [expandedBattle, setExpandedBattle] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<BattleLogsData>("/outputs/matchup-battle-logs")
      .then((d) => { if (!cancelled) setLogs(d); })
      .catch(() => { if (!cancelled) setLogs(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Loading battle logs…</p>;
  if (!logs || Object.keys(logs).length === 0) return <p className="text-sm text-[var(--text-muted)]">No battle logs. Run simulations to generate turn-by-turn logs.</p>;

  const matchups = Object.keys(logs).sort();
  const battles = selectedMatchup ? (logs[selectedMatchup] ?? []) : [];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--text-muted)]">
        Select matchup to view turn-by-turn logs
      </label>
      <select
        aria-label="Select matchup to view turn-by-turn logs"
        value={selectedMatchup}
        onChange={(e) => {
          setSelectedMatchup(e.target.value);
          setExpandedBattle(null);
        }}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text)] text-sm"
      >
        <option value="">—</option>
        {matchups.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {selectedMatchup && battles.length > 0 && (
        <div className="space-y-2">
          {battles.map((b, i) => {
            const [p1, p2] = selectedMatchup.split(" vs ");
            const winnerName = b.winner === "p1" ? p1 : b.winner === "p2" ? p2 : null;
            return (
              <div key={i} className="rounded-xl border border-[var(--border)]/50 overflow-hidden bg-[var(--bg-input)]/30">
                <button
                  type="button"
                  onClick={() => setExpandedBattle(expandedBattle === i ? null : i)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--primary)]/5 transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--text)]">
                    Battle {i + 1}
                    {winnerName && (
                      <span className={cn("ml-2 px-2 py-0.5 rounded-lg text-xs font-semibold", b.winner === "p1" ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--accent)]/20 text-[var(--accent)]")}>
                        {winnerName} wins
                      </span>
                    )}
                  </span>
                  <span className="text-[var(--primary)] text-sm">{expandedBattle === i ? "▲" : "▼"}</span>
                </button>
                {expandedBattle === i && (
                  <div className="p-4 bg-[var(--bg-panel)] max-h-[70vh] overflow-y-auto border-t border-[var(--border)]/30">
                    <BattleReplay log={b.log} matchup={selectedMatchup} winner={b.winner} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RankingsCard({ data }: { data: MatchupData }) {
  const rankings = useMemo(() => {
    const byPokemon: Record<string, { wins: number; losses: number }> = {};
    for (const m of Object.values(data)) {
      if (m.total > 0) {
        byPokemon[m.p1] = {
          wins: (byPokemon[m.p1]?.wins ?? 0) + m.p1_wins,
          losses: (byPokemon[m.p1]?.losses ?? 0) + m.p2_wins,
        };
        byPokemon[m.p2] = {
          wins: (byPokemon[m.p2]?.wins ?? 0) + m.p2_wins,
          losses: (byPokemon[m.p2]?.losses ?? 0) + m.p1_wins,
        };
      }
    }
    return Object.entries(byPokemon)
      .map(([name, v]) => ({
        name,
        wins: v.wins,
        losses: v.losses,
        total: v.wins + v.losses,
        winRate: v.wins + v.losses > 0 ? (v.wins / (v.wins + v.losses)) * 100 : 0,
      }))
      .sort((a, b) => {
        const rateDiff = b.winRate - a.winRate;
        if (Math.abs(rateDiff) > 0.01) return rateDiff;
        return b.wins - a.wins;
      })
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [data]);

  if (rankings.length === 0) return null;

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "from-amber-400 to-yellow-600 text-amber-950 shadow-amber-500/30";
    if (rank === 2) return "from-slate-300 to-slate-500 text-slate-900 shadow-slate-400/30";
    if (rank === 3) return "from-amber-600 to-amber-800 text-amber-100 shadow-amber-700/30";
    return "from-[var(--bg-input)] to-[var(--border)] text-[var(--text-muted)]";
  };

  return (
    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
      {rankings.map((r, i) => (
        <motion.div
          key={r.name}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.02 }}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[var(--border)]/40",
            "bg-[var(--bg-input)]/50 hover:bg-[var(--primary)]/5 transition-colors"
          )}
        >
          <div
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg",
              "bg-gradient-to-br",
              getRankStyle(r.rank)
            )}
          >
            {r.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text)] truncate">{r.name}</div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
              <span>{r.wins}W</span>
              <span>{r.losses}L</span>
              <span>{r.total} battles</span>
            </div>
          </div>
          <div className="flex-shrink-0 w-24">
            <div className="h-2 rounded-full bg-[var(--border)]/50 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${r.winRate}%` }}
                transition={{ duration: 0.6, delay: i * 0.02 }}
                className={cn(
                  "h-full rounded-full",
                  r.winRate >= 60 ? "bg-[var(--primary)]" : r.winRate >= 40 ? "bg-[var(--accent)]" : "bg-[var(--danger)]"
                )}
              />
            </div>
            <div className="text-right text-sm font-medium text-[var(--text)] mt-0.5">
              {r.winRate.toFixed(1)}%
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SearchableMatchupTable({ data }: { data: MatchupData }) {
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"matchup" | "p1WinRate" | "total">("matchup");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const tableData = useMemo(() => {
    let rows = Object.entries(data).map(([key, m]) => ({
      matchup: key,
      p1: m.p1,
      p2: m.p2,
      p1Wins: m.p1_wins,
      p2Wins: m.p2_wins,
      total: m.total,
      p1WinRate: m.total > 0 ? (m.p1_wins / m.total) * 100 : null,
    }));
    if (filter.trim()) {
      const q = filter.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.p1.toLowerCase().includes(q) || r.p2.toLowerCase().includes(q) || r.matchup.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "matchup") cmp = a.matchup.localeCompare(b.matchup);
      else if (sortBy === "p1WinRate")
        cmp = (a.p1WinRate ?? -1) - (b.p1WinRate ?? -1);
      else cmp = a.total - b.total;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows.slice(0, 50);
  }, [data, filter, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir(col === "matchup" ? "asc" : "desc");
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Filter by Pokemon name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
      />
      <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-[var(--border)]/50">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--bg-input)] border-b border-[var(--border)]">
            <tr>
              <th
                className="px-3 py-2 text-left cursor-pointer hover:text-[var(--primary)]"
                onClick={() => toggleSort("matchup")}
              >
                Matchup {sortBy === "matchup" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-3 py-2 text-right">P1 W</th>
              <th className="px-3 py-2 text-right">P2 W</th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-[var(--primary)]"
                onClick={() => toggleSort("total")}
              >
                Total {sortBy === "total" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-[var(--primary)]"
                onClick={() => toggleSort("p1WinRate")}
              >
                P1 % {sortBy === "p1WinRate" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((r) => (
              <tr key={r.matchup} className="border-b border-[var(--border)]/30 hover:bg-[var(--primary)]/5">
                <td className="px-3 py-1.5 text-[var(--text)]">{r.matchup}</td>
                <td className="px-3 py-1.5 text-right text-[var(--primary)]">{r.p1Wins}</td>
                <td className="px-3 py-1.5 text-right text-[var(--accent)]">{r.p2Wins}</td>
                <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">{r.total}</td>
                <td className="px-3 py-1.5 text-right">
                  {r.p1WinRate != null ? `${r.p1WinRate.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Showing up to 50 matchups. Use filter to narrow. Click column headers to sort.
      </p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className,
  onClick,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-display font-semibold text-[var(--primary)] mb-1">{title}</h4>
        {onClick && (
          <span className="text-xs text-[var(--primary)] font-medium flex items-center gap-1 shrink-0">
            View details
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        )}
      </div>
      {description && <p className="text-xs text-[var(--text-muted)] mb-3">{description}</p>}
      {children}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]/50 overflow-hidden",
        onClick && "cursor-pointer hover:border-[var(--primary)]/50 hover:shadow-[0_0_0_1px_rgba(0,245,255,0.1)] transition-all",
        className
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      {content}
    </motion.div>
  );
}

type DetailViewId =
  | "pool-sets"
  | "summary"
  | "top-performers"
  | "win-rate-dist"
  | "win-loss-split"
  | "dominance"
  | "one-sided"
  | "battles-per-matchup"
  | "scatter"
  | "radar"
  | "loss-leaders"
  | "heatmap"
  | "battle-length"
  | "top-moves"
  | "type-effectiveness"
  | "crits-misses"
  | "status"
  | "turns-by-pokemon"
  | "matchup-detail"
  | "matchup-table"
  | "battle-logs"
  | "rankings";

export function MatchupAnalytics({ refreshTrigger, smogonFormat }: { refreshTrigger: number; smogonFormat?: string }) {
  const { data, loading, error } = useMatchupData(refreshTrigger);
  const { analytics: battleAnalytics, loading: analyticsLoading } = useBattleLogAnalytics(refreshTrigger);
  const [activeDetail, setActiveDetail] = useState<DetailViewId | null>(null);

  if (loading) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">
        Loading matchup data…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-4 text-sm text-[var(--text-muted)]">
        {error ? `Could not load matchup data: ${error}` : "No matchup data available. Run simulations first."}
      </div>
    );
  }

  const hasData = Object.values(data).some((m) => m.total > 0);

  return (
    <div className="space-y-6">
      {!hasData && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          Matchup results exist but no battles completed (all 0 wins). This often happens when Pokemon lack proper movesets. Use Smogon presets below and re-run simulations.
        </div>
      )}
      <div
        onClick={() => setActiveDetail("pool-sets")}
        className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]/50 cursor-pointer hover:border-[var(--primary)]/50 hover:shadow-[0_0_0_1px_rgba(0,245,255,0.1)] transition-all"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setActiveDetail("pool-sets")}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display font-semibold text-[var(--primary)]">Pool Sets</h3>
          <span className="text-xs text-[var(--primary)] font-medium flex items-center gap-1">
            View details
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Pokemon in the pool and their Smogon sets. Simulations use these by default.
        </p>
        <div onClick={(e) => e.stopPropagation()}>
          <PoolSetsWidget data={data} refreshTrigger={refreshTrigger} smogonFormat={smogonFormat} />
        </div>
      </div>
      {hasData && (
        <>
          <div
            onClick={() => setActiveDetail("summary")}
            className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]/50 cursor-pointer hover:border-[var(--primary)]/50 hover:shadow-[0_0_0_1px_rgba(0,245,255,0.1)] transition-all"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setActiveDetail("summary")}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-display font-semibold text-[var(--primary)]">Summary</h3>
              <span className="text-xs text-[var(--primary)] font-medium flex items-center gap-1">
                View details
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            </div>
            <SummaryStats data={data} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="Top Performers" description="Pokemon with most total wins" onClick={() => setActiveDetail("top-performers")}>
          <TopPerformersChart data={data} />
        </ChartCard>

        <ChartCard title="Win Rate Distribution" description="P1 win rate buckets (0–10%, 10–20%, …)" onClick={() => setActiveDetail("win-rate-dist")}>
          <WinRateDistributionChart data={data} />
        </ChartCard>

        <ChartCard title="Win / Loss Split" description="Overall battle outcomes" onClick={() => setActiveDetail("win-loss-split")}>
          <WinLossPieChart data={data} />
        </ChartCard>

        <ChartCard title="Dominance Score" description="Net wins per Pokemon (P1 wins − P2 wins)" onClick={() => setActiveDetail("dominance")}>
          <DominanceChart data={data} />
        </ChartCard>

        <ChartCard title="Most One-Sided Matchups" description="Largest win rate margins (min 3 battles)" onClick={() => setActiveDetail("one-sided")}>
          <MostOneSidedChart data={data} />
        </ChartCard>

        <ChartCard title="Battles per Matchup" description="Distribution of battle counts" onClick={() => setActiveDetail("battles-per-matchup")}>
          <BattlesPerMatchupChart data={data} />
        </ChartCard>

        <ChartCard title="Win Rate vs Battle Count" description="Scatter: P1 win % vs battles run" onClick={() => setActiveDetail("scatter")}>
          <ScatterWinRateVsBattles data={data} />
        </ChartCard>

        <ChartCard title="Win Rate by Pokemon" description="Radar of top 6 by win rate (min 5 battles)" onClick={() => setActiveDetail("radar")}>
          <PokemonWinRateRadar data={data} />
        </ChartCard>

        <ChartCard title="Most Losses" description="Pokemon with highest total losses" onClick={() => setActiveDetail("loss-leaders")}>
          <LossLeadersChart data={data} />
        </ChartCard>

        <ChartCard title="Matchup Heatmap" description="P1 vs P2 win rate matrix (first 12 Pokemon)" className="md:col-span-2 xl:col-span-3" onClick={() => setActiveDetail("heatmap")}>
          <MatchupHeatmapPreview data={data} />
        </ChartCard>

      </div>

          {!analyticsLoading && battleAnalytics && battleAnalytics.global.totalBattles > 0 && (
            <>
              <h3 className="font-display font-semibold text-[var(--primary)] mt-8 mb-3">Battle Log Analytics</h3>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Stats derived from turn-by-turn battle logs: move usage, type effectiveness, crits, status, and more.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <ChartCard title="Battle Length" description="Distribution of turns per battle" onClick={() => setActiveDetail("battle-length")}>
                  <BattleLengthChart analytics={battleAnalytics} />
                </ChartCard>
                <ChartCard title="Top Moves" description="Most used moves across all battles" onClick={() => setActiveDetail("top-moves")}>
                  <TopMovesChart analytics={battleAnalytics} />
                </ChartCard>
                <ChartCard title="Type Effectiveness" description="Super effective vs resisted vs neutral" onClick={() => setActiveDetail("type-effectiveness")}>
                  <TypeEffectivenessPie analytics={battleAnalytics} />
                </ChartCard>
                <ChartCard title="Crits & Misses" description="Critical hits, misses, boosts, heals" onClick={() => setActiveDetail("crits-misses")}>
                  <CritMissStats analytics={battleAnalytics} />
                </ChartCard>
                <ChartCard title="Status Effects" description="Most common status conditions" onClick={() => setActiveDetail("status")}>
                  <StatusBreakdownChart analytics={battleAnalytics} />
                </ChartCard>
                <ChartCard title="Turns by Pokemon" description="Avg turns when winning vs losing (min 2 battles)" onClick={() => setActiveDetail("turns-by-pokemon")}>
                  <AvgTurnsByPokemonChart analytics={battleAnalytics} />
                </ChartCard>
                <ChartCard title="Per-Matchup Details" description="Drill down into moves and stats for a specific matchup" className="md:col-span-2 xl:col-span-3" onClick={() => setActiveDetail("matchup-detail")}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <MatchupDetailPanel analytics={battleAnalytics} />
                  </div>
                </ChartCard>
              </div>
            </>
          )}
        </>
      )}
      <ChartCard title="Matchup Table" description="Search and sort all matchups" className="md:col-span-2 xl:col-span-3" onClick={() => setActiveDetail("matchup-table")}>
        <div onClick={(e) => e.stopPropagation()}>
          <SearchableMatchupTable data={data} />
        </div>
      </ChartCard>
      <ChartCard title="Battle Logs" description="Turn-by-turn logs for each fight" className="md:col-span-2 xl:col-span-3" onClick={() => setActiveDetail("battle-logs")}>
        <div onClick={(e) => e.stopPropagation()}>
          <BattleLogsViewer refreshTrigger={refreshTrigger} />
        </div>
      </ChartCard>
      {hasData && (
        <ChartCard title="Rankings" description="All Pokemon ranked by win rate (top to bottom)" className="md:col-span-2 xl:col-span-3" onClick={() => setActiveDetail("rankings")}>
          <RankingsCard data={data} />
        </ChartCard>
      )}

      <AnalyticsDetailModal
        title="Pool Sets"
        description="Pokemon in the pool and their Smogon sets. Simulations use these by default."
        open={activeDetail === "pool-sets"}
        onClose={() => setActiveDetail(null)}
      >
        <PoolSetsWidget data={data} refreshTrigger={refreshTrigger} smogonFormat={smogonFormat} />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Summary"
        description="Overview of matchup and battle statistics"
        open={activeDetail === "summary"}
        onClose={() => setActiveDetail(null)}
      >
        <SummaryStats data={data} />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Top Performers"
        description="Pokemon with most total wins"
        open={activeDetail === "top-performers"}
        onClose={() => setActiveDetail(null)}
      >
        <TopPerformersChart data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Win Rate Distribution"
        description="P1 win rate buckets (0–10%, 10–20%, …)"
        open={activeDetail === "win-rate-dist"}
        onClose={() => setActiveDetail(null)}
      >
        <WinRateDistributionChart data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Win / Loss Split"
        description="Overall battle outcomes"
        open={activeDetail === "win-loss-split"}
        onClose={() => setActiveDetail(null)}
      >
        <WinLossPieChart data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Dominance Score"
        description="Net wins per Pokemon (P1 wins − P2 wins)"
        open={activeDetail === "dominance"}
        onClose={() => setActiveDetail(null)}
      >
        <DominanceChart data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Most One-Sided Matchups"
        description="Largest win rate margins (min 3 battles)"
        open={activeDetail === "one-sided"}
        onClose={() => setActiveDetail(null)}
      >
        <MostOneSidedChart data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Battles per Matchup"
        description="Distribution of battle counts"
        open={activeDetail === "battles-per-matchup"}
        onClose={() => setActiveDetail(null)}
      >
        <BattlesPerMatchupChart data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Win Rate vs Battle Count"
        description="Scatter: P1 win % vs battles run"
        open={activeDetail === "scatter"}
        onClose={() => setActiveDetail(null)}
      >
        <ScatterWinRateVsBattles data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Win Rate by Pokemon"
        description="Radar of top Pokemon by win rate (min 5 battles)"
        open={activeDetail === "radar"}
        onClose={() => setActiveDetail(null)}
      >
        <PokemonWinRateRadar data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Most Losses"
        description="Pokemon with highest total losses"
        open={activeDetail === "loss-leaders"}
        onClose={() => setActiveDetail(null)}
      >
        <LossLeadersChart data={data} expanded />
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Matchup Heatmap"
        description="P1 vs P2 win rate matrix. Rows = P1 (attacker), Cols = P2 (defender). Value = P1 win %."
        open={activeDetail === "heatmap"}
        onClose={() => setActiveDetail(null)}
      >
        <MatchupHeatmapPreview data={data} expanded />
      </AnalyticsDetailModal>

      {battleAnalytics && battleAnalytics.global.totalBattles > 0 && (
        <>
          <AnalyticsDetailModal
            title="Battle Length"
            description="Distribution of turns per battle"
            open={activeDetail === "battle-length"}
            onClose={() => setActiveDetail(null)}
          >
            <BattleLengthChart analytics={battleAnalytics} expanded />
          </AnalyticsDetailModal>

          <AnalyticsDetailModal
            title="Top Moves"
            description="Most used moves across all battles"
            open={activeDetail === "top-moves"}
            onClose={() => setActiveDetail(null)}
          >
            <TopMovesChart analytics={battleAnalytics} expanded />
          </AnalyticsDetailModal>

          <AnalyticsDetailModal
            title="Type Effectiveness"
            description="Super effective vs resisted vs neutral"
            open={activeDetail === "type-effectiveness"}
            onClose={() => setActiveDetail(null)}
          >
            <TypeEffectivenessPie analytics={battleAnalytics} expanded />
          </AnalyticsDetailModal>

          <AnalyticsDetailModal
            title="Crits & Misses"
            description="Critical hits, misses, boosts, heals, recoil, items"
            open={activeDetail === "crits-misses"}
            onClose={() => setActiveDetail(null)}
          >
            <CritMissStats analytics={battleAnalytics} />
          </AnalyticsDetailModal>

          <AnalyticsDetailModal
            title="Status Effects"
            description="Most common status conditions"
            open={activeDetail === "status"}
            onClose={() => setActiveDetail(null)}
          >
            <StatusBreakdownChart analytics={battleAnalytics} expanded />
          </AnalyticsDetailModal>

          <AnalyticsDetailModal
            title="Turns by Pokemon"
            description="Avg turns when winning vs losing (min 2 battles)"
            open={activeDetail === "turns-by-pokemon"}
            onClose={() => setActiveDetail(null)}
          >
            <AvgTurnsByPokemonChart analytics={battleAnalytics} expanded />
          </AnalyticsDetailModal>

          <AnalyticsDetailModal
            title="Per-Matchup Details"
            description="Drill down into moves and stats for a specific matchup"
            open={activeDetail === "matchup-detail"}
            onClose={() => setActiveDetail(null)}
          >
            <MatchupDetailPanel analytics={battleAnalytics} />
          </AnalyticsDetailModal>
        </>
      )}

      <AnalyticsDetailModal
        title="Matchup Table"
        description="Search and sort all matchups"
        open={activeDetail === "matchup-table"}
        onClose={() => setActiveDetail(null)}
      >
        <div className="max-h-[60vh]">
          <SearchableMatchupTable data={data} />
        </div>
      </AnalyticsDetailModal>

      <AnalyticsDetailModal
        title="Battle Logs"
        description="Turn-by-turn logs for each fight"
        open={activeDetail === "battle-logs"}
        onClose={() => setActiveDetail(null)}
      >
        <div className="max-h-[70vh] overflow-auto">
          <BattleLogsViewer refreshTrigger={refreshTrigger} />
        </div>
      </AnalyticsDetailModal>

      {hasData && (
        <AnalyticsDetailModal
          title="Rankings"
          description="All Pokemon ranked by win rate (top to bottom)"
          open={activeDetail === "rankings"}
          onClose={() => setActiveDetail(null)}
        >
          <div className="max-h-[70vh] overflow-auto">
            <RankingsCard data={data} />
          </div>
        </AnalyticsDetailModal>
      )}
    </div>
  );
}
