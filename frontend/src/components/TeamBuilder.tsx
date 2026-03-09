import { useEffect, useState, useRef } from "react";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current?.contains(e.target as Node) || inputRef.current?.contains(e.target as Node)) return;
      setShowDropdown(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<Species[]>("/dex/species").catch(() => []),
      api.get<{ id: string; name: string }[]>("/dex/moves").catch(() => []),
      api.get<{ id: string; name: string }[]>("/dex/abilities").catch(() => []),
      api.get<{ id: string; name: string }[]>("/dex/items").catch(() => []),
      api.get<Record<string, string[]>>("/dex/learnsets").catch(() => ({})),
      api.get<string[]>("/dex/natures").catch(() => []),
    ]).then(([species, moves, abilities, items, learnsets, natures]) => {
      setDexData({ species, moves, abilities, items, learnsets, natures });
      if (species.length === 0) {
        appendLog("Dex data not loaded. Run Data/UsefulDatasets/fetch_dex_data.py first.", "error");
      }
    }).catch((e) => appendLog("Failed to load dex data: " + (e as Error).message, "error"));
  }, [appendLog]);

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

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]";
  const selectCls = "bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] font-mono text-sm min-w-[140px]";
  const labelCls = "flex flex-col gap-1 text-sm font-medium";

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
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Build Pokemon in Showdown format. Filter by type, region, or role. Import popular Smogon sets.
      </p>
      <div className="flex flex-wrap gap-4 mb-4">
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
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <label className={`${labelCls} relative`}>
          <span>Pokemon</span>
          <input
            ref={inputRef}
            type="text"
            value={speciesQuery}
            onChange={(e) => setSpeciesQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search species (e.g. Pikachu)"
            className={`${inputCls} min-w-[200px]`}
          />
          {showDropdown && matches.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-[var(--border)] rounded max-h-48 overflow-auto z-10 min-w-[200px]"
            >
              {matches.map((s) => (
                <div
                  key={s.id}
                  className="px-3 py-2 cursor-pointer hover:bg-white/10"
                  onClick={() => selectSpecies(s)}
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </label>
        <label className={labelCls}>
          <span>Level</span>
          <div className="flex items-center gap-2">
            <input type="number" value={level} onChange={(e) => setLevel(parseInt(e.target.value) || 50)} min={1} max={100} className={`${inputCls} w-16`} />
            <button type="button" onClick={() => setLevel(50)} className="px-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--bg-input)] hover:bg-white/5">
              50
            </button>
            <button type="button" onClick={() => setLevel(100)} className="px-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--bg-input)] hover:bg-white/5">
              100
            </button>
          </div>
        </label>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        {(["hp", "atk", "def", "spa", "spd", "spe"] as const).map((stat) => (
          <span key={stat} className="px-2 py-1 text-sm font-mono bg-[var(--bg-input)] rounded">
            {STAT_LABELS[stat]} {selectedSpecies?.baseStats?.[stat] ?? "—"}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-4 mb-4">
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
              <span className="text-[var(--text-muted)] text-sm">Loading...</span>
            ) : Object.keys(smogonSets).length === 0 && selectedSpecies ? (
              <span className="text-[var(--text-muted)] text-sm">No sets for this Pokemon.</span>
            ) : (
              Object.keys(smogonSets).map((name) => (
                <button key={name} type="button" onClick={() => importSmogonSet(name)} className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--accent)] hover:text-[#1a1a1a]">
                  {name}
                </button>
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
        <div className="flex gap-2">
          <button type="button" onClick={addToTeam} className="px-4 py-2 rounded bg-[var(--accent)] text-[#1a1a1a] hover:opacity-90">
            Add to Team
          </button>
          <button type="button" onClick={exportToEditor} className="px-4 py-2 rounded bg-[var(--primary)] text-white hover:opacity-90">
            Export to Editor
          </button>
        </div>
      </div>
      <div>
        <h4 className="font-semibold mb-2">Current Team</h4>
        <div className="space-y-2">
          {team.map((set, i) => (
            <div key={i} className="flex items-center justify-between bg-[var(--bg-input)] rounded px-3 py-2">
              <span>{set.split("\n")[0].replace("|", "")}</span>
              <button type="button" onClick={() => setTeam((prev) => prev.filter((_, j) => j !== i))} className="text-[var(--danger)] hover:underline">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
