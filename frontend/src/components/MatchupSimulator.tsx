import { useCallback, useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";
import { cn } from "../lib/utils";

const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];

interface Species {
  id: string;
  name: string;
  types?: string[];
}

export function MatchupSimulator() {
  const { appendLog, setStatus, saveConfig, triggerOutputsRefresh, config, setConfig } = useApp();
  const [species, setSpecies] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown1, setShowDropdown1] = useState(false);
  const [showDropdown2, setShowDropdown2] = useState(false);
  const dropdownRef1 = useRef<HTMLDivElement>(null);
  const dropdownRef2 = useRef<HTMLDivElement>(null);
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const m = config.matchups ?? {};
  const updateMatchup = (updates: Record<string, unknown>) => {
    setConfig((prev) => ({
      ...prev,
      matchups: { ...(prev.matchups ?? {}), ...updates },
    }));
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<Species[]>("/dex/species");
        setSpecies(data);
      } catch (e) {
        appendLog("Failed to load species: " + (e as Error).message, "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appendLog]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        dropdownRef1.current?.contains(t) || inputRef1.current?.contains(t) ||
        dropdownRef2.current?.contains(t) || inputRef2.current?.contains(t)
      ) return;
      setShowDropdown1(false);
      setShowDropdown2(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const getMatches = (query: string) => {
    if (!query) return species.slice(0, 30);
    const q = query.toLowerCase();
    if (q.length < 2) return species.slice(0, 30);
    return species.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 25);
  };

  const runMatchups = useCallback(async () => {
    await saveConfig();
    setStatus(true, "Running matchup simulations...");
    appendLog("Starting matchup simulations.");
    try {
      await api.post("/run-matchups");
      pollRef.current = setInterval(async () => {
        try {
          const data = await api.get<{ running?: boolean }>("/status");
          if (!data.running) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setStatus(false, "Ready");
            appendLog("Matchup simulations finished.");
            triggerOutputsRefresh();
          }
        } catch { /* ignore */ }
      }, 1000);
    } catch (e) {
      appendLog("Error: " + (e as Error).message, "error");
      setStatus(false, "Ready");
    }
  }, [appendLog, saveConfig, setStatus, triggerOutputsRefresh]);

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] transition-all focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]";
  const labelCls = "flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]";

  const matches1 = getMatches(m.pokemon1 ?? "");
  const matches2 = getMatches(m.pokemon2 ?? "");

  return (
    <Panel title="Pokemon Matchup Simulator">
      <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
        Run 1v1 simulations between Pokemon. Head-to-head: pick two Pokemon. Matrix: run every Pokemon in a pool against each other (filter by type, limit pool size).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <motion.div className="space-y-4 p-4 rounded-xl bg-black/20 border border-[var(--border)]/50" whileHover={{ borderColor: "rgba(0,245,255,0.15)" }}>
          <h3 className="font-display font-semibold text-[var(--primary)]">Mode & Pool</h3>
          <label className={labelCls}>
            <span>Mode</span>
            <select
              value={m.mode ?? "head-to-head"}
              onChange={(e) => updateMatchup({ mode: e.target.value })}
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
            >
              <option value="head-to-head">Head-to-Head (two Pokemon)</option>
              <option value="matrix">Matrix (all vs all in pool)</option>
            </select>
          </label>
          {(m.mode ?? "head-to-head") === "matrix" && (
            <>
              <label className={labelCls}>
                <span>Filter by Type</span>
                <select
                  value={m.poolFilter ?? "all"}
                  onChange={(e) => updateMatchup({ poolFilter: e.target.value })}
                  className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                >
                  <option value="all">All types</option>
                  <option value="type">Specific type</option>
                </select>
              </label>
              {m.poolFilter === "type" && (
                <label className={labelCls}>
                  <span>Type</span>
                  <select
                    value={m.poolType ?? ""}
                    onChange={(e) => updateMatchup({ poolType: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select type</option>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className={labelCls}>
                <span>Pool size limit</span>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={m.poolLimit ?? 50}
                  onChange={(e) => updateMatchup({ poolLimit: parseInt(e.target.value) || 50 })}
                  className={inputCls}
                />
              </label>
            </>
          )}
        </motion.div>

        <motion.div className="space-y-4 p-4 rounded-xl bg-black/20 border border-[var(--border)]/50" whileHover={{ borderColor: "rgba(0,245,255,0.15)" }}>
          <h3 className="font-display font-semibold text-[var(--primary)]">Battle Config</h3>
          <label className={labelCls}>
            <span>Level</span>
            <input
              type="number"
              min={1}
              max={100}
              value={m.setLevel ?? 50}
              onChange={(e) => updateMatchup({ setLevel: parseInt(e.target.value) || 50 })}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            <span>Battles per matchup</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={m.battlesPerMatchup ?? 100}
              onChange={(e) => updateMatchup({ battlesPerMatchup: parseInt(e.target.value) || 100 })}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            <span>Threads</span>
            <input
              type="number"
              min={1}
              max={16}
              value={m.noOfThreads ?? 4}
              onChange={(e) => updateMatchup({ noOfThreads: parseInt(e.target.value) || 4 })}
              className={inputCls}
            />
          </label>
        </motion.div>
      </div>

      {(m.mode ?? "head-to-head") === "head-to-head" && (
        <div className="flex flex-wrap gap-4 mb-6">
          <label className={cn(labelCls, "relative")}>
            <span>Pokemon 1</span>
            <input
              ref={inputRef1}
              type="text"
              value={m.pokemon1 ?? ""}
              onChange={(e) => updateMatchup({ pokemon1: e.target.value })}
              onFocus={() => setShowDropdown1(true)}
              placeholder="e.g. Pikachu"
              className={cn(inputCls, "min-w-[180px]")}
            />
            {showDropdown1 && (
              <div
                ref={dropdownRef1}
                className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl max-h-48 overflow-auto z-[100] min-w-[180px] shadow-lg"
              >
                {loading ? (
                  <div className="px-4 py-3 text-[var(--text-muted)] text-sm">Loading...</div>
                ) : (
                  matches1.map((s) => (
                    <div
                      key={s.id}
                      className="px-4 py-2 cursor-pointer hover:bg-[var(--primary)]/10"
                      onMouseDown={(e) => { e.preventDefault(); updateMatchup({ pokemon1: s.name }); setShowDropdown1(false); }}
                    >
                      {s.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </label>
          <span className="self-end pb-2 text-[var(--text-muted)]">vs</span>
          <label className={cn(labelCls, "relative")}>
            <span>Pokemon 2</span>
            <input
              ref={inputRef2}
              type="text"
              value={m.pokemon2 ?? ""}
              onChange={(e) => updateMatchup({ pokemon2: e.target.value })}
              onFocus={() => setShowDropdown2(true)}
              placeholder="e.g. Charizard"
              className={cn(inputCls, "min-w-[180px]")}
            />
            {showDropdown2 && (
              <div
                ref={dropdownRef2}
                className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl max-h-48 overflow-auto z-[100] min-w-[180px] shadow-lg"
              >
                {loading ? (
                  <div className="px-4 py-3 text-[var(--text-muted)] text-sm">Loading...</div>
                ) : (
                  matches2.map((s) => (
                    <div
                      key={s.id}
                      className="px-4 py-2 cursor-pointer hover:bg-[var(--primary)]/10"
                      onMouseDown={(e) => { e.preventDefault(); updateMatchup({ pokemon2: s.name }); setShowDropdown2(false); }}
                    >
                      {s.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </label>
        </div>
      )}

      <motion.button
        type="button"
        onClick={runMatchups}
        className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:shadow-[0_0_24px_var(--accent-glow)] transition-all"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Run Matchup Simulations
      </motion.button>

      <p className="text-xs text-[var(--text-muted)] mt-4">
        Results: matchup_results.json, matchup_matrix.csv (download from Outputs below)
      </p>
    </Panel>
  );
}
