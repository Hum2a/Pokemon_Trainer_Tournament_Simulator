import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { PokemonSprite } from "../components/PokemonSprite";
import { PokemonDetailModal } from "../components/PokemonDetailModal";
import { TYPE_COLORS } from "../lib/typeColors";

export type SpeciesEntry = {
  id: string;
  name: string;
  baseSpecies?: string;
  num: number;
  types: string[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  abilities: Record<string, string>;
  region?: string;
  bst?: number;
  evolutionStage?: string;
  generation?: number;
  weightkg?: number;
  heightm?: number;
  color?: string;
  eggGroups?: string[];
};

export type MoveEntry = { id: string; name: string; type: string; category: string; basePower: number; pp: number };
export type LearnsetsData = Record<string, string[]>;

const TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison",
  "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
];

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "#888";
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
      style={{ backgroundColor: `${color}40`, color }}
    >
      {type}
    </span>
  );
}

function PokemonCard({
  species,
  onClick,
}: {
  species: SpeciesEntry;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 hover:border-[var(--primary)]/50 hover:shadow-[0_0_0_1px_rgba(0,245,255,0.2)] transition-all"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-3">
        <PokemonSprite name={species.name} num={species.num} size={48} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[var(--text)] truncate">#{species.num} {species.name}</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {species.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function PokedexPage() {
  const [species, setSpecies] = useState<SpeciesEntry[]>([]);
  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [learnsets, setLearnsets] = useState<LearnsetsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [genFilter, setGenFilter] = useState<number | "">("");
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<SpeciesEntry[]>("/dex/species"),
      api.get<MoveEntry[]>("/dex/moves"),
      api.get<LearnsetsData>("/dex/learnsets"),
    ])
      .then(([s, m, l]) => {
        if (cancelled) return;
        setSpecies(Array.isArray(s) ? s : []);
        setMoves(Array.isArray(m) ? m : []);
        setLearnsets(typeof l === "object" && l !== null ? l : {});
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dex data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredSpecies = useMemo(() => {
    let list = species;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          String(s.num).includes(q)
      );
    }
    if (typeFilter) {
      list = list.filter((s) => s.types.includes(typeFilter));
    }
    if (genFilter !== "") {
      list = list.filter((s) => s.generation === genFilter);
    }
    return list.sort((a, b) => a.num - b.num);
  }, [species, search, typeFilter, genFilter]);

  const movesById = useMemo(() => {
    const map: Record<string, MoveEntry> = {};
    for (const m of moves) map[m.id] = m;
    return map;
  }, [moves]);

  return (
    <main className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] overflow-visible backdrop-blur-xl bg-[var(--bg-panel)] p-5 shadow-[0_0_0_1px_rgba(0,245,255,0.05),0_4px_24px_rgba(0,0,0,0.3)]">
        <h2 className="font-display font-semibold text-[var(--primary)] mb-4">Pokedex</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Browse all Pokemon with stats, moves, abilities, and Smogon sets.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            placeholder="Search by name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm min-w-[200px] placeholder:text-[var(--text-muted)]"
            aria-label="Search Pokemon"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm"
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={genFilter}
            onChange={(e) => setGenFilter(e.target.value === "" ? "" : Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm"
            aria-label="Filter by generation"
          >
            <option value="">All generations</option>
            {GENERATIONS.map((g) => (
              <option key={g} value={g}>Gen {g}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-[var(--text-muted)]">Loading dex data…</div>
        ) : (
          <div className="text-xs text-[var(--text-muted)] mb-3">
            {filteredSpecies.length} Pokemon
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] overflow-visible backdrop-blur-xl bg-[var(--bg-panel)] p-5">
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {filteredSpecies.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i * 0.01, 0.3) }}
                >
                  <PokemonCard species={s} onClick={() => setSelectedSpecies(s)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selectedSpecies && (
          <PokemonDetailModal
            species={selectedSpecies}
            learnsets={learnsets}
            movesById={movesById}
            onClose={() => setSelectedSpecies(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
