import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";
import { cn } from "../lib/utils";

const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];
const REGIONS = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Paldea", "Other"];
const ROLES = ["Physical Attacker", "Special Attacker", "Wall", "Mixed", "Balanced"];
const SMOGON_FORMATS = [
  { value: "gen9ou", label: "Gen 9 OU" },
  { value: "gen9uu", label: "Gen 9 UU" },
  { value: "gen9ru", label: "Gen 9 RU" },
  { value: "gen9nu", label: "Gen 9 NU" },
  { value: "gen9", label: "All Gen 9" },
];

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-amber-100/80 text-amber-900",
  Fire: "bg-orange-500/80 text-white",
  Water: "bg-blue-500/80 text-white",
  Electric: "bg-yellow-400/90 text-yellow-900",
  Grass: "bg-green-500/80 text-white",
  Ice: "bg-cyan-300/80 text-cyan-900",
  Fighting: "bg-red-600/80 text-white",
  Poison: "bg-purple-500/80 text-white",
  Ground: "bg-amber-700/80 text-amber-100",
  Flying: "bg-purple-300/80 text-purple-900",
  Psychic: "bg-pink-500/80 text-white",
  Bug: "bg-lime-500/80 text-white",
  Rock: "bg-stone-600/80 text-stone-100",
  Ghost: "bg-violet-700/80 text-violet-100",
  Dragon: "bg-indigo-600/80 text-indigo-100",
  Dark: "bg-slate-800/80 text-slate-100",
  Steel: "bg-slate-400/80 text-slate-900",
  Fairy: "bg-pink-300/80 text-pink-900",
};

interface Species {
  id: string;
  name: string;
  baseSpecies?: string;
  types?: string[];
  region?: string;
  role?: string;
  baseStats?: Record<string, number>;
  abilities?: Record<string, string>;
}

interface DexData {
  species: Species[];
  moves: { id: string; name: string }[];
  abilities: { id: string; name: string }[];
  items: { id: string; name: string }[];
  learnsets: Record<string, string[]>;
  natures: string[];
}

const STAT_LABELS: Record<string, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };

function toId(s: string) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickFirst<T>(val: T | T[]): T {
  return Array.isArray(val) ? val[0] : val;
}

function flattenMoves(moves: unknown[]): string[] {
  const result: string[] = [];
  for (const m of moves || []) {
    result.push(Array.isArray(m) ? (m[0] as string) : (m as string));
  }
  return result.slice(0, 4);
}

export function TeamBuilder() {
  const { appendLog, setEditorContent, setEditorPath } = useApp();
  const [dexData, setDexData] = useState<DexData>({
    species: [],
    moves: [],
    abilities: [],
    items: [],
    learnsets: {},
    natures: [],
  });
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSpecies, setSelectedSpeciesState] = useState<Species | null>(null);
  const [ability, setAbility] = useState("");
  const [item, setItem] = useState("");
  const [nature, setNature] = useState("Hardy");
  const [moves, setMoves] = useState(["", "", "", ""]);
  const [level, setLevel] = useState(50);
  const [smogonFormat, setSmogonFormat] = useState("gen9ou");
  const [smogonSets, setSmogonSets] = useState<Record<string, unknown>>({});
  const [smogonLoading, setSmogonLoading] = useState(false);
  const [team, setTeam] = useState<string[]>([]);
  const [dexLoading, setDexLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target) || inputRef.current?.contains(target)) return;
      setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadDexData = useCallback(async () => {
    setDexLoading(true);
    try {
      const [species, moves, abilities, items, learnsets, natures] = await Promise.all([
        api.get<Species[]>("/dex/species"),
        api.get<{ id: string; name: string }[]>("/dex/moves"),
        api.get<{ id: string; name: string }[]>("/dex/abilities"),
        api.get<{ id: string; name: string }[]>("/dex/items"),
        api.get<Record<string, string[]>>("/dex/learnsets"),
        api.get<string[]>("/dex/natures"),
      ]);
      setDexData({ species, moves, abilities, items, learnsets, natures });
      if (species.length === 0) {
        appendLog("Dex data empty. Run Data/UsefulDatasets/fetch_dex_data.py first.", "error");
      }
    } catch (e) {
      const msg = (e as Error).message;
      appendLog("Dex load failed: " + msg, "error");
      if (msg.includes("fetch") || msg.includes("Failed") || msg.includes("Network")) {
        appendLog("Is Flask running? Start with: python app.py", "error");
      }
    } finally {
      setDexLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    loadDexData();
  }, [loadDexData]);

  const getFilteredSpecies = () => {
    return dexData.species.filter((s) => {
      if (typeFilter && !(s.types || []).includes(typeFilter)) return false;
      if (regionFilter && s.region !== regionFilter) return false;
      if (roleFilter && s.role !== roleFilter) return false;
      return true;
    });
  };

  const getDropdownMatches = () => {
    let filtered = getFilteredSpecies();
    if (speciesQuery.length >= 2) {
      const q = speciesQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q));
    }
    return filtered.slice(0, speciesQuery.length >= 2 ? 25 : 50);
  };

  const selectSpecies = (s: Species) => {
    setSelectedSpeciesState(s);
    setSpeciesQuery(s.name);
    setShowDropdown(false);

    const abs = s.abilities || {};
    const abOpts = Object.values(abs).filter(Boolean);
    setAbility(abOpts[0] || "");
    setMoves(["", "", "", ""]);
    loadSmogonSets(s);
  };

  const loadSmogonSets = async (species: Species) => {
    setSmogonLoading(true);
    try {
      const data = await api.get<Record<string, Record<string, unknown>>>(`/smogon/sets/${smogonFormat}`);
      const sets = data[species.name] ?? data[species.baseSpecies || ""] ?? null;
      if (!sets || Object.keys(sets).length === 0) {
        setSmogonSets({});
      } else {
        setSmogonSets(sets);
      }
    } catch (e) {
      appendLog("Smogon sets: " + (e as Error).message, "error");
      setSmogonSets({});
    } finally {
      setSmogonLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSpecies && !smogonLoading) {
      loadSmogonSets(selectedSpecies);
    }
  }, [smogonFormat]);

  const importSmogonSet = (setName: string) => {
    const set = smogonSets[setName] as { ability?: unknown; item?: unknown; nature?: unknown; moves?: unknown[] };
    if (!set) return;
    const ab = pickFirst(set.ability);
    const it = pickFirst(set.item);
    const nat = pickFirst(set.nature) || "Hardy";
    const mov = flattenMoves(set.moves || []);
    if (ab) setAbility(ab as string);
    if (it) setItem(it as string);
    setNature(nat as string);
    setMoves([mov[0] || "", mov[1] || "", mov[2] || "", mov[3] || ""]);
    appendLog(`Imported Smogon set: ${setName}`);
  };

  const buildSet = () => {
    if (!selectedSpecies) return null;
    const speciesLine = item ? `${selectedSpecies.name} @ ${item}` : selectedSpecies.name;
    let out = `|${speciesLine}\nLevel: ${level}\n${nature} Nature\n`;
    if (ability) out += `Ability: ${ability}\n`;
    moves.filter(Boolean).forEach((m) => (out += `- ${m}\n`));
    return out;
  };

  const addToTeam = () => {
    const set = buildSet();
    if (set) {
      setTeam((prev) => [...prev, set]);
      appendLog("Added to team.");
    }
  };

  const exportToEditor = () => {
    if (team.length === 0) {
      appendLog("Add at least one Pokemon first.", "error");
      return;
    }
    const content = team.join("\n") + "\n";
    setEditorContent((prev) => (prev ? prev.trimEnd() + "\n\n" + content : content));
    setEditorPath("Inputs/GymLeaderPokemon.txt");
    appendLog(`Exported ${team.length} Pokemon(s) to editor.`);
  };

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] transition-all focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]";
  const selectCls = "bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] font-mono text-sm min-w-[140px] transition-all focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]";
  const labelCls = "flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]";

  const matches = getDropdownMatches();
  const moveOpts = selectedSpecies
    ? (() => {
        const baseId = selectedSpecies.baseSpecies && selectedSpecies.baseSpecies !== selectedSpecies.name ? toId(selectedSpecies.baseSpecies) : selectedSpecies.id;
        let learnset = dexData.learnsets[selectedSpecies.id] || dexData.learnsets[toId(selectedSpecies.name)] || dexData.learnsets[baseId] || [];
        if (learnset.length === 0) learnset = dexData.moves.map((m) => m.id);
        return learnset
          .map((mid) => {
            const m = dexData.moves.find((x) => toId(x.id) === toId(mid));
            return m ? { id: m.id, name: m.name } : { id: mid, name: mid.replace(/([a-z])([A-Z])/g, "$1 $2") };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      })()
    : [];

  const abilityOpts = selectedSpecies ? Object.values(selectedSpecies.abilities || {}).filter(Boolean) : [];

  return (
    <Panel title="Team Builder">
      <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
        Build Pokemon in Showdown format. Filter by type, region, or role. Import popular Smogon sets.
      </p>
      <div className="flex flex-wrap gap-4 mb-5">
        <label className={labelCls}>
          <span>Type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          <span>Region</span>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className={selectCls}>
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          <span>Role</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls}>
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4 mb-5 items-end">
        <label className={cn(labelCls, "relative")}>
          <span>Pokemon</span>
          <input
            ref={inputRef}
            type="text"
            value={speciesQuery}
            onChange={(e) => setSpeciesQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search species (e.g. Pikachu)"
            className={cn(inputCls, "min-w-[200px]")}
          />
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 mt-2 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl max-h-52 overflow-auto z-[100] min-w-[200px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              >
                {dexLoading ? (
                  <div className="px-4 py-3 text-[var(--text-muted)] text-sm flex items-center gap-2">
                    <motion.span className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                    Loading dex...
                  </div>
                ) : matches.length === 0 ? (
                  <div className="px-4 py-3 text-[var(--text-muted)] text-sm space-y-2">
                    <div>
                      {dexData.species.length === 0
                        ? "API unreachable. Start Flask: python app.py"
                        : "No matches"}
                    </div>
                    {dexData.species.length === 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); loadDexData(); }}
                        className="text-[var(--accent)] hover:underline text-sm font-medium"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ) : (
                  matches.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="px-4 py-2.5 cursor-pointer hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); selectSpecies(s); }}
                    >
                      <span>{s.name}</span>
                      {s.types && s.types.length > 0 && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TYPE_COLORS[s.types[0]] || "bg-gray-500/80 text-white")}>
                          {s.types[0]}
                        </span>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </label>
        <label className={labelCls}>
          <span>Level</span>
          <div className="flex items-center gap-2">
            <input type="number" value={level} onChange={(e) => setLevel(parseInt(e.target.value) || 50)} min={1} max={100} className={cn(inputCls, "w-16")} />
            <motion.button type="button" onClick={() => setLevel(50)} className="px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              50
            </motion.button>
            <motion.button type="button" onClick={() => setLevel(100)} className="px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              100
            </motion.button>
          </div>
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {(["hp", "atk", "def", "spa", "spd", "spe"] as const).map((stat) => (
          <motion.span
            key={stat}
            className="px-3 py-1.5 text-sm font-mono bg-[var(--bg-input)] rounded-lg border border-[var(--border)]/50"
            whileHover={{ scale: 1.05, borderColor: "rgba(0,245,255,0.3)" }}
          >
            {STAT_LABELS[stat]} {selectedSpecies?.baseStats?.[stat] ?? "—"}
          </motion.span>
        ))}
      </div>
      <div className="flex flex-col gap-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <label className={labelCls}>
            <span>Smogon Sets</span>
            <select value={smogonFormat} onChange={(e) => setSmogonFormat(e.target.value)} className={selectCls}>
              {SMOGON_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {smogonLoading ? (
              <span className="text-[var(--text-muted)] text-sm flex items-center gap-2">
                <motion.span className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : Object.keys(smogonSets).length === 0 && selectedSpecies ? (
              <span className="text-[var(--text-muted)] text-sm">No sets for this Pokemon.</span>
            ) : (
              Object.keys(smogonSets).map((name) => (
                <motion.button
                  key={name}
                  type="button"
                  onClick={() => importSmogonSet(name)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all"
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  {name}
                </motion.button>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className={labelCls}>
            <span>Ability</span>
            <select value={ability} onChange={(e) => setAbility(e.target.value)} className={selectCls}>
              {abilityOpts.length ? abilityOpts.map((a) => <option key={a} value={a}>{a}</option>) : <option value="">(unknown)</option>}
            </select>
          </label>
          <label className={labelCls}>
            <span>Item</span>
            <select value={item} onChange={(e) => setItem(e.target.value)} className={selectCls}>
              <option value="">(none)</option>
              {dexData.items.map((i) => (
                <option key={i.id} value={i.name}>{i.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            <span>Nature</span>
            <select value={nature} onChange={(e) => setNature(e.target.value)} className={selectCls}>
              {dexData.natures.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          {[0, 1, 2, 3].map((i) => (
            <label key={i} className={labelCls}>
              <span>Move {i + 1}</span>
              <select value={moves[i]} onChange={(e) => setMoves((prev) => [...prev.slice(0, i), e.target.value, ...prev.slice(i + 1)])} className={selectCls}>
                <option value="">(none)</option>
                {moveOpts.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <motion.button type="button" onClick={addToTeam} className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium hover:shadow-[0_0_24px_var(--accent-glow)] transition-all" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            Add to Team
          </motion.button>
          <motion.button type="button" onClick={exportToEditor} className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[#050508] font-medium hover:shadow-[0_0_24px_var(--primary-glow)] transition-all" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            Export to Editor
          </motion.button>
        </div>
      </div>
      <div>
        <h4 className="font-display font-semibold mb-3 text-[var(--primary)]">Current Team</h4>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {team.map((set, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="flex items-center justify-between bg-[var(--bg-input)] rounded-xl px-4 py-3 border border-[var(--border)]/50 hover:border-[var(--primary)]/30 transition-colors"
              >
                <span className="font-medium">{set.split("\n")[0].replace("|", "")}</span>
                <motion.button type="button" onClick={() => setTeam((prev) => prev.filter((_, j) => j !== i))} className="text-[var(--danger)] hover:text-[var(--danger)]/80 hover:scale-110 transition-all text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--danger)]/10" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  ×
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </Panel>
  );
}
