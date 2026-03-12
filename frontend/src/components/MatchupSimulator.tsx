import { useCallback, useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { PoolSets } from "./PoolSets";
import { PokemonSprite } from "./PokemonSprite";
import { useApp, type Config } from "../context/AppContext";
import { api, dexOpts } from "../api";
import { cn } from "../lib/utils";

const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];

const REGIONS = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Paldea", "Other"];

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

const EVOLUTION_OPTIONS = [
  { value: "base", label: "First stage" },
  { value: "middle", label: "Mid evolution" },
  { value: "final", label: "Full evolution" },
];

function FilterChip({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-md text-sm font-medium transition-all",
        active
          ? "bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/50 shadow-[0_0_12px_rgba(0,245,255,0.2)]"
          : "bg-transparent text-[var(--text-muted)] border border-[var(--border)]/50 hover:text-[var(--text)] hover:border-[var(--border)]",
        className
      )}
    >
      {label}
    </button>
  );
}

function FilterSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)]/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--text)] hover:bg-[var(--primary)]/5 transition-colors"
      >
        <span>{title}</span>
        <svg
          className={cn("w-4 h-4 text-[var(--text-muted)] transition-transform", expanded && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="px-3 pb-3 pt-0 border-t border-[var(--border)]/30">{children}</div>}
    </div>
  );
}

interface Species {
  id: string;
  name: string;
  num?: number;
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
  const { appendLog, setStatus, saveConfig, triggerOutputsRefresh, config, setConfig, status } = useApp();
  const [species, setSpecies] = useState<Species[]>([]);
  const [abilities, setAbilities] = useState<DexItem[]>([]);
  const [moves, setMoves] = useState<DexItem[]>([]);
  const [learnsets, setLearnsets] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showDropdown1, setShowDropdown1] = useState(false);
  const [showDropdown2, setShowDropdown2] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    evolution: true,
    type: true,
    category: true,
    region: true,
    bst: false,
    role: false,
    ability: false,
    tags: false,
    eggGroup: false,
    color: false,
    generation: false,
    physical: false,
    poolLimit: true,
  });
  const toggleFilterSection = (key: string) =>
    setExpandedFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  const dropdownRef1 = useRef<HTMLDivElement>(null);
  const dropdownRef2 = useRef<HTMLDivElement>(null);
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastOutputLengthRef = useRef(0);

  const m = config.matchups ?? {};
  const updateMatchup = (updates: Record<string, unknown>) => {
    setConfig((prev) => ({
      ...prev,
      matchups: { ...(prev.matchups ?? {}), ...updates },
    }));
  };
  const togglePoolArray = (key: keyof NonNullable<Config["matchups"]>, value: string) => {
    const arr = (m[key] as string[] | undefined) ?? [];
    const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    updateMatchup({ [key]: next });
  };

  const [dexLoadError, setDexLoadError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<"species" | "abilities" | "moves" | "learnsets" | null>(null);
  const [spritesReady, setSpritesReady] = useState(false);

  const DEX_STEPS = ["species", "abilities", "moves", "learnsets"] as const;
  const loadingStepIndex = loadingStep ? DEX_STEPS.indexOf(loadingStep) + 1 : 0;
  const loadingProgress = loadingStep ? (loadingStepIndex / DEX_STEPS.length) * 100 : 0;

  const loadDexData = useCallback(async () => {
    setDexLoadError(null);
    setLoading(true);
    setLoadingStep("species");
    console.log("[Matchup] Data gathering: starting");
    try {
      // Dex endpoints are public; skip auth to avoid Supabase getSession() hanging
      console.log("[Matchup] Data gathering: 1/4 fetching species...");
      setLoadingStep("species");
      const speciesData = await api.get<Species[]>("/dex/species", dexOpts);
      setSpecies(Array.isArray(speciesData) ? speciesData : []);
      console.log("[Matchup] Data gathering: 1/4 species done", Array.isArray(speciesData) ? speciesData.length : 0, "items");
      if (!Array.isArray(speciesData) || speciesData.length === 0) {
        setDexLoadError("Dex data empty or invalid. Run Data/UsefulDatasets/fetch_dex_data.py first.");
      }

      console.log("[Matchup] Data gathering: 2/4 fetching abilities...");
      setLoadingStep("abilities");
      const abilitiesData = await api.get<DexItem[]>("/dex/abilities", dexOpts);
      setAbilities(Array.isArray(abilitiesData) ? abilitiesData : []);
      console.log("[Matchup] Data gathering: 2/4 abilities done", Array.isArray(abilitiesData) ? abilitiesData.length : 0, "items");

      console.log("[Matchup] Data gathering: 3/4 fetching moves...");
      setLoadingStep("moves");
      const movesData = await api.get<DexItem[]>("/dex/moves", dexOpts);
      setMoves(Array.isArray(movesData) ? movesData : []);
      console.log("[Matchup] Data gathering: 3/4 moves done", Array.isArray(movesData) ? movesData.length : 0, "items");

      console.log("[Matchup] Data gathering: 4/4 fetching learnsets...");
      setLoadingStep("learnsets");
      const learnsetsData = await api.get<Record<string, string[]>>("/dex/learnsets", dexOpts);
      setLearnsets(learnsetsData && typeof learnsetsData === "object" ? learnsetsData : {});
      console.log("[Matchup] Data gathering: 4/4 learnsets done", learnsetsData && typeof learnsetsData === "object" ? Object.keys(learnsetsData).length : 0, "species");

      console.log("[Matchup] Data gathering: complete");
    } catch (e) {
      const msg = (e as Error).message;
      console.error("[Matchup] Data gathering failed:", msg);
      setDexLoadError(msg || "Failed to load dex data");
      appendLog("Failed to load dex data: " + msg, "error");
      setSpecies([]);
      setAbilities([]);
      setMoves([]);
      setLearnsets({});
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  }, [appendLog]);

  useEffect(() => {
    loadDexData();
  }, [loadDexData]);

  useEffect(() => {
    if (loading) {
      setSpritesReady(false);
      return;
    }
    const id = requestAnimationFrame(() => setSpritesReady(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

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
    lastOutputLengthRef.current = 0;
    try {
      await api.post("/run-matchups");
      pollRef.current = setInterval(async () => {
        try {
          const data = await api.get<{ running?: boolean; output?: string }>("/status");
          const output = data.output ?? "";
          if (output.length > lastOutputLengthRef.current) {
            const newContent = output.slice(lastOutputLengthRef.current);
            appendLog(newContent.trimEnd());
            lastOutputLengthRef.current = output.length;
          }
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

  const ensureList = useCallback((val: unknown): string[] =>
    Array.isArray(val) ? val.filter((x): x is string => !!x) : val ? [String(val)] : [], []);

  const getPoolMaxCount = useCallback((): number => {
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
    const evo = ensureList(m.poolEvolutionStages);
    if (evo.length) filtered = filtered.filter((s) => evo.includes(s.evolutionStage ?? ""));
    const types = ensureList(m.poolTypes);
    if (types.length) filtered = filtered.filter((s) => (s.types ?? []).some((t) => types.includes(t)));
    const cat = m.poolCategory ?? "all";
    if (cat === "legendary") filtered = filtered.filter((s) => (s.tags ?? []).length > 0);
    else if (cat === "regular") filtered = filtered.filter((s) => (s.tags ?? []).length === 0);
    const mega = m.poolCanMega ?? "all";
    if (mega === "yes") filtered = filtered.filter((s) => s.canMega);
    else if (mega === "no") filtered = filtered.filter((s) => !s.canMega);
    const regions = ensureList(m.poolRegions);
    if (regions.length) filtered = filtered.filter((s) => regions.includes(s.region ?? ""));
    if (m.poolBst && m.poolBst !== "any") filtered = filtered.filter((s) => matchesBst(s.bst ?? 0, m.poolBst as string));
    const roles = ensureList(m.poolRoles);
    if (roles.length) filtered = filtered.filter((s) => roles.includes(s.role ?? ""));
    if (m.poolAbility) filtered = filtered.filter((s) => Object.values(s.abilities ?? {}).includes(m.poolAbility as string));
    if (m.poolMove) {
      const moveId = (m.poolMove as string).toLowerCase().replace(/[\s-]/g, "");
      filtered = filtered.filter((s) => {
        const sid = (s.id ?? "").toLowerCase().replace(/[\s-]/g, "");
        const baseId = (s.baseSpecies ?? s.id ?? "").toLowerCase().replace(/[\s-]/g, "");
        const moves = learnsets[sid] ?? learnsets[baseId] ?? [];
        return Array.isArray(moves) && moves.includes(moveId);
      });
    }
    const tags = ensureList(m.poolTags);
    if (tags.length) filtered = filtered.filter((s) => (s.tags ?? []).some((t) => tags.includes(t)));
    const eggGroups = ensureList(m.poolEggGroups);
    if (eggGroups.length) filtered = filtered.filter((s) => (s.eggGroups ?? []).some((eg) => eggGroups.includes(eg)));
    const colors = ensureList(m.poolColors);
    if (colors.length) filtered = filtered.filter((s) => colors.includes(s.color ?? ""));
    const gens = ensureList(m.poolGenerations).map((g) => parseInt(g, 10)).filter((g) => !isNaN(g));
    if (gens.length) filtered = filtered.filter((s) => gens.includes(s.generation ?? 0));
    if (m.poolWeight && m.poolWeight !== "any") filtered = filtered.filter((s) => matchesWeight(s.weightkg, m.poolWeight as string));
    if (m.poolHeight && m.poolHeight !== "any") filtered = filtered.filter((s) => matchesHeight(s.heightm, m.poolHeight as string));
    const tc = m.poolTypeCount;
    if (tc === "single") filtered = filtered.filter((s) => (s.typeCount ?? 1) === 1);
    else if (tc === "dual") filtered = filtered.filter((s) => (s.typeCount ?? 1) === 2);
    return filtered.length;
  }, [species, learnsets, m, ensureList]);

  const getFilteredPool = useCallback((): string[] => {
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
    const evo = ensureList(m.poolEvolutionStages);
    if (evo.length) filtered = filtered.filter((s) => evo.includes(s.evolutionStage ?? ""));
    const types = ensureList(m.poolTypes);
    if (types.length) filtered = filtered.filter((s) => (s.types ?? []).some((t) => types.includes(t)));
    const cat = m.poolCategory ?? "all";
    if (cat === "legendary") filtered = filtered.filter((s) => (s.tags ?? []).length > 0);
    else if (cat === "regular") filtered = filtered.filter((s) => (s.tags ?? []).length === 0);
    const mega = m.poolCanMega ?? "all";
    if (mega === "yes") filtered = filtered.filter((s) => s.canMega);
    else if (mega === "no") filtered = filtered.filter((s) => !s.canMega);
    const regions = ensureList(m.poolRegions);
    if (regions.length) filtered = filtered.filter((s) => regions.includes(s.region ?? ""));
    if (m.poolBst && m.poolBst !== "any") filtered = filtered.filter((s) => matchesBst(s.bst ?? 0, m.poolBst as string));
    const roles = ensureList(m.poolRoles);
    if (roles.length) filtered = filtered.filter((s) => roles.includes(s.role ?? ""));
    if (m.poolAbility) filtered = filtered.filter((s) => Object.values(s.abilities ?? {}).includes(m.poolAbility as string));
    if (m.poolMove) {
      const moveId = (m.poolMove as string).toLowerCase().replace(/[\s-]/g, "");
      filtered = filtered.filter((s) => {
        const sid = (s.id ?? "").toLowerCase().replace(/[\s-]/g, "");
        const baseId = (s.baseSpecies ?? s.id ?? "").toLowerCase().replace(/[\s-]/g, "");
        const moves = learnsets[sid] ?? learnsets[baseId] ?? [];
        return Array.isArray(moves) && moves.includes(moveId);
      });
    }
    const tags = ensureList(m.poolTags);
    if (tags.length) filtered = filtered.filter((s) => (s.tags ?? []).some((t) => tags.includes(t)));
    const eggGroups = ensureList(m.poolEggGroups);
    if (eggGroups.length) filtered = filtered.filter((s) => (s.eggGroups ?? []).some((eg) => eggGroups.includes(eg)));
    const colors = ensureList(m.poolColors);
    if (colors.length) filtered = filtered.filter((s) => colors.includes(s.color ?? ""));
    const gens = ensureList(m.poolGenerations).map((g) => parseInt(g, 10)).filter((g) => !isNaN(g));
    if (gens.length) filtered = filtered.filter((s) => gens.includes(s.generation ?? 0));
    if (m.poolWeight && m.poolWeight !== "any") filtered = filtered.filter((s) => matchesWeight(s.weightkg, m.poolWeight as string));
    if (m.poolHeight && m.poolHeight !== "any") filtered = filtered.filter((s) => matchesHeight(s.heightm, m.poolHeight as string));
    const tc = m.poolTypeCount;
    if (tc === "single") filtered = filtered.filter((s) => (s.typeCount ?? 1) === 1);
    else if (tc === "dual") filtered = filtered.filter((s) => (s.typeCount ?? 1) === 2);
    const limit = m.poolLimit ?? 50;
    return filtered.slice(0, limit).map((s) => s.name).sort();
  }, [species, learnsets, m, ensureList]);

  const getMatchupCount = useCallback((): number => {
    const mode = m.mode ?? "head-to-head";
    if (mode === "head-to-head") return (m.pokemon1 && m.pokemon2) ? 1 : 0;
    const poolSize = Math.min(getPoolMaxCount(), m.poolLimit ?? 50);
    return (poolSize * (poolSize - 1)) / 2;
  }, [m.mode, m.pokemon1, m.pokemon2, m.poolLimit, getPoolMaxCount]);

  const getEstimatedTimeSeconds = useCallback((): number | null => {
    const matchups = getMatchupCount();
    const strategy = m.simulationStrategy ?? "full";
    if (strategy === "heuristic") return 0;
    let battlesPerMatchup = m.battlesPerMatchup ?? 5;
    let effectiveMatchups = matchups;
    if (strategy === "quick") battlesPerMatchup = 1;
    if (strategy === "sampled") {
      const frac = Math.max(0.05, Math.min(1, m.sampleFraction ?? 0.2));
      effectiveMatchups = Math.max(1, Math.floor(matchups * frac));
    }
    const totalBattles = effectiveMatchups * battlesPerMatchup;
    if (totalBattles <= 0) return null;
    const SECONDS_PER_BATTLE = 2;
    const threads = m.noOfThreads ?? 4;
    return Math.ceil((totalBattles / threads) * SECONDS_PER_BATTLE);
  }, [getMatchupCount, m.battlesPerMatchup, m.noOfThreads, m.simulationStrategy, m.sampleFraction]);

  const formatEstimatedTime = (seconds: number): string => {
    if (seconds <= 0) return "Instant (heuristic)";
    if (seconds < 60) return `~${seconds} sec`;
    if (seconds < 3600) return `~${Math.round(seconds / 60)} min`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `~${h} hr ${m} min` : `~${h} hr`;
  };

  const getFilterValueLabel = (): string => {
    const parts: string[] = [];
    const evo = ensureList(m.poolEvolutionStages);
    if (evo.length) parts.push(`Evolution: ${evo.map((v) => EVOLUTION_OPTIONS.find((e) => e.value === v)?.label ?? v).join(", ")}`);
    const types = ensureList(m.poolTypes);
    if (types.length) parts.push(`Type: ${types.join(", ")}`);
    const cat = m.poolCategory ?? "all";
    if (cat !== "all") parts.push(`Category: ${cat === "legendary" ? "Legendary" : "Regular"}`);
    const mega = m.poolCanMega ?? "all";
    if (mega !== "all") parts.push(`Mega: ${mega === "yes" ? "Yes" : "No"}`);
    const regions = ensureList(m.poolRegions);
    if (regions.length) parts.push(`Region: ${regions.join(", ")}`);
    if (m.poolBst && m.poolBst !== "any") parts.push(`BST: ${BST_RANGES.find((b) => b.value === m.poolBst)?.label ?? m.poolBst}`);
    const roles = ensureList(m.poolRoles);
    if (roles.length) parts.push(`Role: ${roles.join(", ")}`);
    if (m.poolTypeCount) parts.push(`Type count: ${TYPE_COUNT.find((t) => t.value === m.poolTypeCount)?.label ?? m.poolTypeCount}`);
    if (m.poolAbility) parts.push(`Ability: ${m.poolAbility}`);
    if (m.poolMove) parts.push(`Move: ${moves.find((mv) => mv.id === m.poolMove)?.name ?? m.poolMove}`);
    const tags = ensureList(m.poolTags);
    if (tags.length) parts.push(`Tags: ${tags.join(", ")}`);
    const eggGroups = ensureList(m.poolEggGroups);
    if (eggGroups.length) parts.push(`Egg group: ${eggGroups.join(", ")}`);
    const colors = ensureList(m.poolColors);
    if (colors.length) parts.push(`Color: ${colors.join(", ")}`);
    const gens = ensureList(m.poolGenerations);
    if (gens.length) parts.push(`Gen: ${gens.join(", ")}`);
    if (m.poolWeight && m.poolWeight !== "any") parts.push(`Weight: ${WEIGHT_RANGES.find((w) => w.value === m.poolWeight)?.label ?? m.poolWeight}`);
    if (m.poolHeight && m.poolHeight !== "any") parts.push(`Height: ${HEIGHT_RANGES.find((h) => h.value === m.poolHeight)?.label ?? m.poolHeight}`);
    return parts.length ? parts.join(" | ") : "—";
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
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-[var(--text-muted)]">Pool filters</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setExpandedFilters((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, true])))}
                    className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50 hover:text-[var(--text)] transition-colors"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedFilters((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, false])))}
                    className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50 hover:text-[var(--text)] transition-colors"
                  >
                    Collapse all
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMatchup({
                    poolEvolutionStages: [],
                    poolTypes: [],
                    poolCategory: "all",
                    poolCanMega: "all",
                    poolRegions: [],
                    poolBst: "any",
                    poolRoles: [],
                    poolTypeCount: "",
                    poolAbility: "",
                    poolMove: "",
                    poolTags: [],
                    poolEggGroups: [],
                    poolColors: [],
                    poolGenerations: [],
                    poolWeight: "any",
                    poolHeight: "any",
                  })}
                    className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50 hover:text-[var(--text)] transition-colors"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
              <FilterSection
                title="Evolution stage"
                expanded={expandedFilters.evolution}
                onToggle={() => toggleFilterSection("evolution")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {EVOLUTION_OPTIONS.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={(m.poolEvolutionStages ?? []).includes(opt.value)}
                      onClick={() => togglePoolArray("poolEvolutionStages", opt.value)}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="Type"
                expanded={expandedFilters.type}
                onToggle={() => toggleFilterSection("type")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {TYPES.map((t) => (
                    <FilterChip
                      key={t}
                      label={t}
                      active={(m.poolTypes ?? []).includes(t)}
                      onClick={() => togglePoolArray("poolTypes", t)}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="Category & Mega"
                expanded={expandedFilters.category}
                onToggle={() => toggleFilterSection("category")}
              >
                <div className="grid grid-cols-2 gap-4 pt-3">
                  <label className={labelCls}>
                    <span>Category</span>
                    <select
                      value={m.poolCategory ?? "all"}
                      onChange={(e) => updateMatchup({ poolCategory: e.target.value })}
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                    >
                    <option value="all">All</option>
                    <option value="legendary">Legendary / Mythical</option>
                    <option value="regular">Regular only</option>
                  </select>
                </label>
                <label className={labelCls}>
                  <span>Can Mega Evolve</span>
                  <select
                    value={m.poolCanMega ?? "all"}
                    onChange={(e) => updateMatchup({ poolCanMega: e.target.value })}
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                  >
                    <option value="all">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                </div>
              </FilterSection>
              <FilterSection
                title="Region"
                expanded={expandedFilters.region}
                onToggle={() => toggleFilterSection("region")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {REGIONS.map((r) => (
                    <FilterChip
                      key={r}
                      label={r}
                      active={(m.poolRegions ?? []).includes(r)}
                      onClick={() => togglePoolArray("poolRegions", r)}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="BST & Type count"
                expanded={expandedFilters.bst}
                onToggle={() => toggleFilterSection("bst")}
              >
                <div className="grid grid-cols-2 gap-4 pt-3">
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
                  <label className={labelCls}>
                    <span>Type count</span>
                    <select
                      value={m.poolTypeCount ?? ""}
                      onChange={(e) => updateMatchup({ poolTypeCount: e.target.value })}
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
                    >
                      <option value="">Any</option>
                      {TYPE_COUNT.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </FilterSection>
              <FilterSection
                title="Role"
                expanded={expandedFilters.role}
                onToggle={() => toggleFilterSection("role")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {ROLES.map((r) => (
                    <FilterChip
                      key={r}
                      label={r}
                      active={(m.poolRoles ?? []).includes(r)}
                      onClick={() => togglePoolArray("poolRoles", r)}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="Ability & Move"
                expanded={expandedFilters.ability}
                onToggle={() => toggleFilterSection("ability")}
              >
                <div className="grid grid-cols-2 gap-4 pt-3">
                  <label className={labelCls}>
                    <span>Ability</span>
                    <select
                      value={m.poolAbility ?? ""}
                      onChange={(e) => updateMatchup({ poolAbility: e.target.value })}
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] max-h-64"
                    >
                      <option value="">Any</option>
                      {abilities.map((a) => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelCls}>
                    <span>Can learn move</span>
                    <select
                      value={m.poolMove ?? ""}
                      onChange={(e) => updateMatchup({ poolMove: e.target.value })}
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] max-h-64"
                    >
                      <option value="">Any</option>
                      {moves.map((move) => (
                        <option key={move.id} value={move.id}>{move.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </FilterSection>
              <FilterSection
                title="Tags (Legendary types)"
                expanded={expandedFilters.tags}
                onToggle={() => toggleFilterSection("tags")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {TAGS.map((t) => (
                    <FilterChip
                      key={t.value}
                      label={t.label}
                      active={(m.poolTags ?? []).includes(t.value)}
                      onClick={() => togglePoolArray("poolTags", t.value)}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="Egg group"
                expanded={expandedFilters.eggGroup}
                onToggle={() => toggleFilterSection("eggGroup")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {EGG_GROUPS.map((g) => (
                    <FilterChip
                      key={g}
                      label={g}
                      active={(m.poolEggGroups ?? []).includes(g)}
                      onClick={() => togglePoolArray("poolEggGroups", g)}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="Color"
                expanded={expandedFilters.color}
                onToggle={() => toggleFilterSection("color")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {COLORS.map((c) => (
                    <FilterChip
                      key={c}
                      label={c}
                      active={(m.poolColors ?? []).includes(c)}
                      onClick={() => togglePoolArray("poolColors", c)}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="Generation"
                expanded={expandedFilters.generation}
                onToggle={() => toggleFilterSection("generation")}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {GENERATIONS.map((g) => (
                    <FilterChip
                      key={g}
                      label={`Gen ${g}`}
                      active={(m.poolGenerations ?? []).includes(String(g))}
                      onClick={() => togglePoolArray("poolGenerations", String(g))}
                    />
                  ))}
                </div>
              </FilterSection>
              <FilterSection
                title="Weight & Height"
                expanded={expandedFilters.physical}
                onToggle={() => toggleFilterSection("physical")}
              >
                <div className="grid grid-cols-2 gap-4 pt-3">
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
                </div>
              </FilterSection>
              <FilterSection
                title="Pool size limit"
                expanded={expandedFilters.poolLimit}
                onToggle={() => toggleFilterSection("poolLimit")}
              >
                <label className={cn(labelCls, "block pt-3")}>
                  <span>Maximum Pokemon in pool</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    value={m.poolLimit ?? 50}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      updateMatchup({ poolLimit: Number.isNaN(v) ? 50 : Math.max(0, Math.min(2000, v)) });
                    }}
                    className={cn(inputCls, "flex-1 min-w-0")}
                  />
                  <button
                    type="button"
                    onClick={() => updateMatchup({ poolLimit: Math.max(0, getPoolMaxCount()) })}
                    className="px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] text-sm font-medium hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50 transition-colors whitespace-nowrap"
                  >
                    Maximum
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-[var(--text-muted)]">
                    {loading
                      ? `Loading ${loadingStep ?? "dex"}... (${loadingStepIndex}/${DEX_STEPS.length})`
                      : dexLoadError
                        ? "Dex data not loaded."
                        : species.length === 0
                          ? "No dex data."
                          : getPoolMaxCount() === 0 && species.length > 0
                            ? "No Pokemon match. Try resetting filters."
                            : `${getPoolMaxCount()} Pokemon match current filter`}
                  </span>
                  {loading && (
                    <div className="h-1.5 w-full rounded-full bg-[var(--bg-input)] overflow-hidden border border-[var(--border)]/50">
                      <div
                        className="h-full bg-[var(--primary)]/70 transition-all duration-300 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                      />
                    </div>
                  )}
                </div>
                {dexLoadError && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={loadDexData}
                      className="text-xs px-2 py-1 rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                    >
                      Retry
                    </button>
                    <span className="text-xs text-[var(--text-muted)]">
                      Run: python Data/UsefulDatasets/fetch_dex_data.py
                    </span>
                  </div>
                )}
              </label>
              </FilterSection>
            </div>
          )}
        </motion.div>

        <motion.div className="space-y-4 p-4 rounded-xl bg-black/20 border border-[var(--border)]/50" whileHover={{ borderColor: "rgba(0,245,255,0.15)" }}>
          <h3 className="font-display font-semibold text-[var(--primary)]">Battle Config</h3>
          <label className={labelCls}>
            <span>Simulation strategy</span>
            <select
              value={m.simulationStrategy ?? "full"}
              onChange={(e) => updateMatchup({ simulationStrategy: e.target.value as "full" | "quick" | "sampled" | "heuristic" })}
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
            >
              <option value="full">Full — All battles via Showdown (most accurate, slowest)</option>
              <option value="quick">Quick — 1 battle per matchup (~5× faster)</option>
              <option value="sampled">Sampled — Random subset of matchups</option>
              <option value="heuristic">Heuristic — Type/BST estimate (instant, approximate)</option>
            </select>
            <span className="text-xs text-[var(--text-muted)]">
              {m.simulationStrategy === "heuristic" && "No battles run; uses type chart + BST."}
              {m.simulationStrategy === "quick" && "1 battle per matchup instead of 5."}
              {m.simulationStrategy === "sampled" && "Runs a fraction of matchups for faster results."}
              {(!m.simulationStrategy || m.simulationStrategy === "full") && "Runs every battle through Pokemon Showdown."}
            </span>
          </label>
          {(m.simulationStrategy ?? "full") === "sampled" && (
            <label className={labelCls}>
              <span>Sample fraction</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={(m.sampleFraction ?? 0.2) * 100}
                  onChange={(e) => updateMatchup({ sampleFraction: parseInt(e.target.value) / 100 })}
                  className="flex-1"
                />
                <span className="text-sm text-[var(--text)] w-12">{(m.sampleFraction ?? 0.2) * 100}%</span>
              </div>
            </label>
          )}
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
          <FilterChip
            label="Use Smogon presets (recommended)"
            active={m.useSmogonSets !== false}
            onClick={() => updateMatchup({ useSmogonSets: m.useSmogonSets === false })}
          />
          {m.useSmogonSets !== false && (
            <label className={labelCls}>
              <span>Smogon format</span>
              <select
                value={m.smogonFormat ?? "gen9ou"}
                onChange={(e) => updateMatchup({ smogonFormat: e.target.value })}
                className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)]"
              >
                <option value="newest">Newest (most recent set per Pokemon)</option>
                {["gen9ou", "gen9uu", "gen9ru", "gen9nu", "gen9pu", "gen9zu", "gen9"].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
          )}
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
                <dt className="text-[var(--text-muted)] min-w-[100px]">Pool filters</dt>
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
            <dt className="text-[var(--text-muted)] min-w-[100px]">Strategy</dt>
            <dd className="text-[var(--text)] font-medium">
              {(m.simulationStrategy ?? "full") === "full" && "Full"}
              {(m.simulationStrategy ?? "full") === "quick" && "Quick (1 battle)"}
              {(m.simulationStrategy ?? "full") === "sampled" && `Sampled (${((m.sampleFraction ?? 0.2) * 100).toFixed(0)}%)`}
              {(m.simulationStrategy ?? "full") === "heuristic" && "Heuristic"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[var(--text-muted)] min-w-[100px]">Battles/matchup</dt>
            <dd className="text-[var(--text)] font-medium">
              {(m.simulationStrategy ?? "full") === "quick" ? 1 : (m.battlesPerMatchup ?? 5)}
            </dd>
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

      <div className="mb-6 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
        <h3 className="font-display font-semibold text-[var(--primary)] mb-3">Pool & Sets</h3>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Pokemon that will compete and their sets. Click a card to expand and view set details before running.
        </p>
        {!spritesReady ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-sm">
            {loading ? "Loading dex data..." : "Preparing..."}
          </div>
        ) : (
          <PoolSets
            pokemon={
              (m.mode ?? "head-to-head") === "head-to-head"
                ? [m.pokemon1, m.pokemon2].filter((x): x is string => !!x)
                : getFilteredPool()
            }
            format={m.smogonFormat ?? "gen9ou"}
            onFormatChange={(f) => updateMatchup({ smogonFormat: f })}
            customSets={m.customSets ?? {}}
            onCustomSetChange={(species, set) => {
              const prev = m.customSets ?? {};
              const next = set ? { ...prev, [species]: set } : (() => { const n = { ...prev }; delete n[species]; return n; })();
              updateMatchup({ customSets: next });
            }}
            editable
          />
        )}
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
                      className="px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-[var(--primary)]/10"
                      onMouseDown={(e) => { e.preventDefault(); updateMatchup({ pokemon1: s.name }); setShowDropdown1(false); }}
                    >
                      {spritesReady ? (
                        <PokemonSprite name={s.name} num={s.num} size={24} />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--bg-input)] border border-[var(--border)] shrink-0" />
                      )}
                      <span>{s.name}</span>
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
                      className="px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-[var(--primary)]/10"
                      onMouseDown={(e) => { e.preventDefault(); updateMatchup({ pokemon2: s.name }); setShowDropdown2(false); }}
                    >
                      {spritesReady ? (
                        <PokemonSprite name={s.name} num={s.num} size={24} />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--bg-input)] border border-[var(--border)] shrink-0" />
                      )}
                      <span>{s.name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <motion.button
          type="button"
          onClick={runMatchups}
          disabled={status.running || (m.mode === "matrix" && (m.poolLimit ?? 50) === 0)}
          className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:shadow-[0_0_24px_var(--accent-glow)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: status.running ? 1 : 1.02 }}
          whileTap={{ scale: status.running ? 1 : 0.98 }}
        >
          Run Matchup Simulations
        </motion.button>
        {status.running && (
          <motion.button
            type="button"
            onClick={async () => {
              try {
                await api.post("/terminate-task");
                appendLog("Simulation terminated by user.");
                setStatus(false, "Ready");
                if (pollRef.current) {
                  clearInterval(pollRef.current);
                  pollRef.current = null;
                }
                triggerOutputsRefresh();
              } catch (e) {
                appendLog("Failed to terminate: " + (e as Error).message, "error");
              }
            }}
            className="px-6 py-3 rounded-xl border-2 border-red-500/80 text-red-400 font-medium hover:bg-red-500/20 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Stop Simulation
          </motion.button>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)] mt-4">
        Results: matchup_results.json, matchup_matrix.csv (download from Outputs below)
      </p>
    </Panel>
  );
}
