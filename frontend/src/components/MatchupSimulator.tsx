import { useCallback, useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";
import { cn } from "../lib/utils";

const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];

const REGIONS = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Paldea", "Other"];

const EVOLUTION_STAGES = [
  { value: "base", label: "Base (first stage)" },
  { value: "middle", label: "Middle (evolves further)" },
  { value: "final", label: "Final (fully evolved)" },
];

const ROLES = ["Physical Attacker", "Special Attacker", "Wall", "Mixed", "Balanced"];

const BST_RANGES = [
  { value: "any", label: "Any BST" },
  { value: "under400", label: "Under 400" },
  { value: "400-500", label: "400–500" },
  { value: "500-600", label: "500–600" },
  { value: "600+", label: "600+" },
];

const TYPE_COUNT = [
  { value: "single", label: "Single type" },
  { value: "dual", label: "Dual type" },
];

const TAGS = [
  { value: "Mythical", label: "Mythical" },
  { value: "Restricted Legendary", label: "Restricted Legendary" },
  { value: "Sub-Legendary", label: "Sub-Legendary" },
  { value: "Paradox", label: "Paradox" },
  { value: "Ultra Beast", label: "Ultra Beast" },
];

const EGG_GROUPS = ["Amorphous", "Bug", "Ditto", "Dragon", "Fairy", "Field", "Flying", "Grass", "Human-Like", "Mineral", "Monster", "Undiscovered", "Water 1", "Water 2", "Water 3"];

const COLORS = ["Black", "Blue", "Brown", "Gray", "Green", "Pink", "Purple", "Red", "White", "Yellow"];

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const WEIGHT_RANGES = [
  { value: "any", label: "Any weight" },
  { value: "light", label: "Light (< 50 kg)" },
  { value: "medium", label: "Medium (50–150 kg)" },
  { value: "heavy", label: "Heavy (> 150 kg)" },
];

const HEIGHT_RANGES = [
  { value: "any", label: "Any height" },
  { value: "small", label: "Small (< 1 m)" },
  { value: "medium", label: "Medium (1–2 m)" },
  { value: "large", label: "Large (> 2 m)" },
];

const POOL_FILTER_LABELS: Record<string, string> = {
  all: "All Pokemon",
  type: "Specific type",
  region: "Specific region",
  evolution: "Evolution stage",
  ability: "Has ability",
  move: "Can learn move",
  role: "Role",
  bst: "BST range",
  typeCount: "Single vs dual type",
  tags: "Legendary / Mythical / etc",
  eggGroup: "Egg group",
  color: "Color",
  generation: "Generation",
  weight: "Weight range",
  height: "Height range",
  canMega: "Can Mega Evolve",
};

const POOL_FILTER_RESET: Record<string, string> = {
  poolType: "",
  poolRegion: "",
  poolEvolutionStage: "",
  poolAbility: "",
  poolMove: "",
  poolRole: "",
  poolBst: "any",
  poolTypeCount: "",
  poolTags: "",
  poolEggGroup: "",
  poolColor: "",
  poolGeneration: "",
  poolWeight: "any",
  poolHeight: "any",
  poolCanMega: "yes",
};

interface Species {
  id: string;
  name: string;
  types?: string[];
  region?: string;
  evolutionStage?: string;
  abilities?: Record<string, string>;
  role?: string;
  bst?: number;
  color?: string;
  eggGroups?: string[];
  weightkg?: number;
  heightm?: number;
  tags?: string[];
  canMega?: boolean;
  typeCount?: number;
  generation?: number;
  baseSpecies?: string;
}

interface DexItem {
  id: string;
  name: string;
}

export function MatchupSimulator() {
  const { appendLog, setStatus, saveConfig, triggerOutputsRefresh, config, setConfig } = useApp();
  const [species, setSpecies] = useState<Species[]>([]);
  const [abilities, setAbilities] = useState<DexItem[]>([]);
  const [moves, setMoves] = useState<DexItem[]>([]);
  const [learnsets, setLearnsets] = useState<Record<string, string[]>>({});
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
        const [speciesData, abilitiesData, movesData, learnsetsData] = await Promise.all([
          api.get<Species[]>("/dex/species"),
          api.get<DexItem[]>("/dex/abilities"),
          api.get<DexItem[]>("/dex/moves"),
          api.get<Record<string, string[]>>("/dex/learnsets"),
        ]);
        setSpecies(speciesData);
        setAbilities(abilitiesData);
        setMoves(movesData);
        setLearnsets(learnsetsData ?? {});
      } catch (e) {
        appendLog("Failed to load dex data: " + (e as Error).message, "error");
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

  const getPoolMaxCount = useCallback((): number => {
    const f = m.poolFilter ?? "all";
    const matchesBst = (bst: number, key: string) => {
      if (!key || key === "any") return true;
      if (key === "under400") return bst < 400;
      if (key === "400-500") return 400 <= bst && bst < 500;
      if (key === "500-600") return 500 <= bst && bst < 600;
      if (key === "600+") return bst >= 600;
      return true;
    };
    const matchesWeight = (w: number | undefined, key: string) => {
      if (!key || key === "any") return true;
      const val = w ?? 0;
      if (key === "light") return val < 50;
      if (key === "medium") return val >= 50 && val <= 150;
      if (key === "heavy") return val > 150;
      return true;
    };
    const matchesHeight = (h: number | undefined, key: string) => {
      if (!key || key === "any") return true;
      const val = h ?? 0;
      if (key === "small") return val < 1;
      if (key === "medium") return val >= 1 && val <= 2;
      if (key === "large") return val > 2;
      return true;
    };
    let filtered = [...species];
    if (f === "all") return filtered.length;
    if (f === "type" && m.poolType) filtered = filtered.filter((s) => (s.types ?? []).includes(m.poolType!));
    else if (f === "region" && m.poolRegion) filtered = filtered.filter((s) => s.region === m.poolRegion);
    else if (f === "evolution" && m.poolEvolutionStage) filtered = filtered.filter((s) => s.evolutionStage === m.poolEvolutionStage);
    else if (f === "ability" && m.poolAbility) filtered = filtered.filter((s) => Object.values(s.abilities ?? {}).includes(m.poolAbility!));
    else if (f === "move" && m.poolMove) {
      const moveId = m.poolMove.toLowerCase().replace(/[\s-]/g, "");
      filtered = filtered.filter((s) => {
        const sid = (s.id ?? "").toLowerCase().replace(/[\s-]/g, "");
        const baseId = (s.baseSpecies ?? s.id ?? "").toLowerCase().replace(/[\s-]/g, "");
        const moves = learnsets[sid] ?? learnsets[baseId] ?? [];
        return Array.isArray(moves) && moves.includes(moveId);
      });
    } else if (f === "role" && m.poolRole) filtered = filtered.filter((s) => s.role === m.poolRole);
    else if (f === "bst" && m.poolBst && m.poolBst !== "any") filtered = filtered.filter((s) => matchesBst(s.bst ?? 0, m.poolBst!));
    else if (f === "typeCount" && m.poolTypeCount) {
      const tc = m.poolTypeCount === "dual" ? 2 : 1;
      filtered = filtered.filter((s) => (s.typeCount ?? 1) === tc);
    } else if (f === "tags" && m.poolTags) filtered = filtered.filter((s) => (s.tags ?? []).includes(m.poolTags!));
    else if (f === "eggGroup" && m.poolEggGroup) filtered = filtered.filter((s) => (s.eggGroups ?? []).includes(m.poolEggGroup!));
    else if (f === "color" && m.poolColor) filtered = filtered.filter((s) => s.color === m.poolColor);
    else if (f === "generation" && m.poolGeneration) {
      const gen = parseInt(m.poolGeneration, 10);
      if (!isNaN(gen)) filtered = filtered.filter((s) => s.generation === gen);
    } else if (f === "weight" && m.poolWeight && m.poolWeight !== "any") filtered = filtered.filter((s) => matchesWeight(s.weightkg, m.poolWeight!));
    else if (f === "height" && m.poolHeight && m.poolHeight !== "any") filtered = filtered.filter((s) => matchesHeight(s.heightm, m.poolHeight!));
    else if (f === "canMega" && m.poolCanMega) {
      const wantMega = m.poolCanMega === "yes";
      filtered = filtered.filter((s) => Boolean(s.canMega) === wantMega);
    }
    return filtered.length;
  }, [species, learnsets, m.poolFilter, m.poolType, m.poolRegion, m.poolEvolutionStage, m.poolAbility, m.poolMove, m.poolRole, m.poolBst, m.poolTypeCount, m.poolTags, m.poolEggGroup, m.poolColor, m.poolGeneration, m.poolWeight, m.poolHeight, m.poolCanMega]);

  const getMatchupCount = useCallback((): number => {
    const mode = m.mode ?? "head-to-head";
    if (mode === "head-to-head") return (m.pokemon1 && m.pokemon2) ? 1 : 0;
    const poolSize = Math.min(getPoolMaxCount(), m.poolLimit ?? 50);
    return (poolSize * (poolSize - 1)) / 2;
  }, [m.mode, m.pokemon1, m.pokemon2, m.poolLimit, getPoolMaxCount]);

  const getEstimatedTimeSeconds = useCallback((): number | null => {
    const matchups = getMatchupCount();
    const battlesPerMatchup = m.battlesPerMatchup ?? 5;
    const threads = m.noOfThreads ?? 4;
    const totalBattles = matchups * battlesPerMatchup;
    if (totalBattles <= 0) return null;
    const SECONDS_PER_BATTLE = 2;
    return Math.ceil((totalBattles / threads) * SECONDS_PER_BATTLE);
  }, [getMatchupCount, m.battlesPerMatchup, m.noOfThreads]);

  const formatEstimatedTime = (seconds: number): string => {
    if (seconds < 60) return `~${seconds} sec`;
    if (seconds < 3600) return `~${Math.round(seconds / 60)} min`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `~${h} hr ${m} min` : `~${h} hr`;
  };

  const getFilterValueLabel = (): string => {
    const f = m.poolFilter ?? "all";
    if (f === "all") return "—";
    if (f === "type") return m.poolType || "—";
    if (f === "region") return m.poolRegion || "—";
    if (f === "evolution") return EVOLUTION_STAGES.find((e) => e.value === m.poolEvolutionStage)?.label ?? "—";
    if (f === "ability") return m.poolAbility || "—";
    if (f === "move") return moves.find((mv) => mv.id === m.poolMove)?.name ?? m.poolMove ?? "—";
    if (f === "role") return m.poolRole || "—";
    if (f === "bst") return BST_RANGES.find((b) => b.value === m.poolBst)?.label ?? "—";
    if (f === "typeCount") return TYPE_COUNT.find((t) => t.value === m.poolTypeCount)?.label ?? "—";
    if (f === "tags") return m.poolTags || "—";
    if (f === "eggGroup") return m.poolEggGroup || "—";
    if (f === "color") return m.poolColor || "—";
    if (f === "generation") return m.poolGeneration ? `Gen ${m.poolGeneration}` : "—";
    if (f === "weight") return WEIGHT_RANGES.find((w) => w.value === m.poolWeight)?.label ?? "—";
    if (f === "height") return HEIGHT_RANGES.find((h) => h.value === m.poolHeight)?.label ?? "—";
    if (f === "canMega") return m.poolCanMega === "yes" ? "Yes" : "No";
    return "—";
  };

  const matches1 = getMatches(m.pokemon1 ?? "");
  const matches2 = getMatches(m.pokemon2 ?? "");

  return (
    <Panel title="Pokemon Matchup Simulator">
      <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
        Run 1v1 simulations between Pokemon. Head-to-head: pick two Pokemon. Matrix: run every Pokemon in a pool against each other. Filter by type, region, evolution stage, ability, move, role, BST, single/dual type, legendary/mythical, egg group, color, generation, weight, height, or Mega-capable.
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
                <span>Pool filter</span>
                <select
                  value={m.poolFilter ?? "all"}
                  onChange={(e) => updateMatchup({ poolFilter: e.target.value, ...POOL_FILTER_RESET })}
                  className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                >
                  <option value="all">All Pokemon</option>
                  <option value="type">Specific type</option>
                  <option value="region">Specific region</option>
                  <option value="evolution">Evolution stage</option>
                  <option value="ability">Has ability</option>
                  <option value="move">Can learn move</option>
                  <option value="role">Role (stat-based)</option>
                  <option value="bst">Base stat total range</option>
                  <option value="typeCount">Single vs dual type</option>
                  <option value="tags">Legendary / Mythical / etc</option>
                  <option value="eggGroup">Egg group</option>
                  <option value="color">Color</option>
                  <option value="generation">Generation</option>
                  <option value="weight">Weight range</option>
                  <option value="height">Height range</option>
                  <option value="canMega">Can Mega Evolve</option>
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
              {m.poolFilter === "region" && (
                <label className={labelCls}>
                  <span>Region</span>
                  <select
                    value={m.poolRegion ?? ""}
                    onChange={(e) => updateMatchup({ poolRegion: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select region</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "evolution" && (
                <label className={labelCls}>
                  <span>Evolution stage</span>
                  <select
                    value={m.poolEvolutionStage ?? ""}
                    onChange={(e) => updateMatchup({ poolEvolutionStage: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select stage</option>
                    {EVOLUTION_STAGES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "ability" && (
                <label className={labelCls}>
                  <span>Ability</span>
                  <select
                    value={m.poolAbility ?? ""}
                    onChange={(e) => updateMatchup({ poolAbility: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] max-h-64"
                  >
                    <option value="">Select ability</option>
                    {abilities.map((a) => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "move" && (
                <label className={labelCls}>
                  <span>Move</span>
                  <select
                    value={m.poolMove ?? ""}
                    onChange={(e) => updateMatchup({ poolMove: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] max-h-64"
                  >
                    <option value="">Select move</option>
                    {moves.map((move) => (
                      <option key={move.id} value={move.id}>{move.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "role" && (
                <label className={labelCls}>
                  <span>Role</span>
                  <select
                    value={m.poolRole ?? ""}
                    onChange={(e) => updateMatchup({ poolRole: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select role</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "bst" && (
                <label className={labelCls}>
                  <span>BST range</span>
                  <select
                    value={m.poolBst ?? "any"}
                    onChange={(e) => updateMatchup({ poolBst: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    {BST_RANGES.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "typeCount" && (
                <label className={labelCls}>
                  <span>Type count</span>
                  <select
                    value={m.poolTypeCount ?? ""}
                    onChange={(e) => updateMatchup({ poolTypeCount: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select</option>
                    {TYPE_COUNT.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "tags" && (
                <label className={labelCls}>
                  <span>Category</span>
                  <select
                    value={m.poolTags ?? ""}
                    onChange={(e) => updateMatchup({ poolTags: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select</option>
                    {TAGS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "eggGroup" && (
                <label className={labelCls}>
                  <span>Egg group</span>
                  <select
                    value={m.poolEggGroup ?? ""}
                    onChange={(e) => updateMatchup({ poolEggGroup: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select</option>
                    {EGG_GROUPS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "color" && (
                <label className={labelCls}>
                  <span>Color</span>
                  <select
                    value={m.poolColor ?? ""}
                    onChange={(e) => updateMatchup({ poolColor: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select</option>
                    {COLORS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "generation" && (
                <label className={labelCls}>
                  <span>Generation</span>
                  <select
                    value={m.poolGeneration ?? ""}
                    onChange={(e) => updateMatchup({ poolGeneration: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="">Select</option>
                    {GENERATIONS.map((g) => (
                      <option key={g} value={String(g)}>Gen {g}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "weight" && (
                <label className={labelCls}>
                  <span>Weight range</span>
                  <select
                    value={m.poolWeight ?? "any"}
                    onChange={(e) => updateMatchup({ poolWeight: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    {WEIGHT_RANGES.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "height" && (
                <label className={labelCls}>
                  <span>Height range</span>
                  <select
                    value={m.poolHeight ?? "any"}
                    onChange={(e) => updateMatchup({ poolHeight: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    {HEIGHT_RANGES.map((h) => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {m.poolFilter === "canMega" && (
                <label className={labelCls}>
                  <span>Can Mega Evolve</span>
                  <select
                    value={m.poolCanMega ?? "yes"}
                    onChange={(e) => updateMatchup({ poolCanMega: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              )}
              <label className={labelCls}>
                <span>Pool size limit</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={2}
                    max={2000}
                    value={m.poolLimit ?? 50}
                    onChange={(e) => updateMatchup({ poolLimit: Math.max(2, parseInt(e.target.value) || 50) })}
                    className={cn(inputCls, "flex-1 min-w-0")}
                  />
                  <button
                    type="button"
                    onClick={() => updateMatchup({ poolLimit: Math.max(2, getPoolMaxCount()) })}
                    className="px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] text-sm font-medium hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50 transition-colors whitespace-nowrap"
                  >
                    Maximum
                  </button>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {getPoolMaxCount()} Pokemon match current filter
                </span>
              </label>
            </>
          )}
        </motion.div>

        <motion.div className="space-y-4 p-4 rounded-xl bg-black/20 border border-[var(--border)]/50" whileHover={{ borderColor: "rgba(0,245,255,0.15)" }}>
          <h3 className="font-display font-semibold text-[var(--primary)]">Battle Config</h3>
          <label className={labelCls}>
            <span>Level</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={m.setLevel ?? 100}
                onChange={(e) => updateMatchup({ setLevel: parseInt(e.target.value) || 100 })}
                className={cn(inputCls, "flex-1 min-w-0")}
              />
              {[1, 50, 100].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateMatchup({ setLevel: lvl })}
                  className={cn(
                    "px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap",
                    (m.setLevel ?? 100) === lvl
                      ? "border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </label>
          <label className={labelCls}>
            <span>Battles per matchup</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={m.battlesPerMatchup ?? 5}
              onChange={(e) => updateMatchup({ battlesPerMatchup: parseInt(e.target.value) || 5 })}
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

      <div className="mb-6 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
        <h3 className="font-display font-semibold text-[var(--primary)] mb-3">Current Parameters</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-[var(--text-muted)] min-w-[100px]">Mode</dt>
            <dd className="text-[var(--text)] font-medium">{(m.mode ?? "head-to-head") === "head-to-head" ? "Head-to-Head" : "Matrix"}</dd>
          </div>
          {(m.mode ?? "head-to-head") === "head-to-head" ? (
            <>
              <div className="flex gap-2">
                <dt className="text-[var(--text-muted)] min-w-[100px]">Pokemon 1</dt>
                <dd className="text-[var(--text)] font-medium">{m.pokemon1 || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[var(--text-muted)] min-w-[100px]">Pokemon 2</dt>
                <dd className="text-[var(--text)] font-medium">{m.pokemon2 || "—"}</dd>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <dt className="text-[var(--text-muted)] min-w-[100px]">Pool filter</dt>
                <dd className="text-[var(--text)] font-medium">{POOL_FILTER_LABELS[m.poolFilter ?? "all"] ?? m.poolFilter}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[var(--text-muted)] min-w-[100px]">Filter value</dt>
                <dd className="text-[var(--text)] font-medium">{getFilterValueLabel()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[var(--text-muted)] min-w-[100px]">Pool limit</dt>
                <dd className="text-[var(--text)] font-medium">{m.poolLimit ?? 50}</dd>
              </div>
            </>
          )}
          <div className="flex gap-2">
            <dt className="text-[var(--text-muted)] min-w-[100px]">Level</dt>
            <dd className="text-[var(--text)] font-medium">{m.setLevel ?? 100}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[var(--text-muted)] min-w-[100px]">Battles/matchup</dt>
            <dd className="text-[var(--text)] font-medium">{m.battlesPerMatchup ?? 5}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[var(--text-muted)] min-w-[100px]">Threads</dt>
            <dd className="text-[var(--text)] font-medium">{m.noOfThreads ?? 4}</dd>
          </div>
          {getEstimatedTimeSeconds() !== null && (
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <dt className="text-[var(--text-muted)] min-w-[100px]">Est. time</dt>
              <dd className="text-[var(--text)] font-medium">
                {formatEstimatedTime(getEstimatedTimeSeconds()!)}
                <span className="text-xs text-[var(--text-muted)] font-normal ml-1">(approx, varies by machine)</span>
              </dd>
            </div>
          )}
        </dl>
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
