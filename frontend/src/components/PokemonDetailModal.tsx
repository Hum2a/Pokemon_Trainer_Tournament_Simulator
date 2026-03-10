import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { api } from "../api";
import { PokemonSprite } from "./PokemonSprite";
import { TYPE_COLORS } from "../lib/typeColors";
import type { SpeciesEntry, MoveEntry, LearnsetsData } from "../pages/PokedexPage";

export type SmogonSetData = {
  moves?: unknown[];
  ability?: string | string[];
  item?: string | string[];
  nature?: string | string[];
  evs?: Record<string, number>;
};
export type SmogonSets = Record<string, Record<string, SmogonSetData>>;

function flattenMoves(moves: unknown[] | undefined): string[] {
  if (!moves || !Array.isArray(moves)) return [];
  return moves.slice(0, 4).map((m) => (Array.isArray(m) ? (m[0] as string) : (m as string)));
}

function formatEvs(evs: Record<string, number> | undefined): string {
  if (!evs || typeof evs !== "object") return "";
  return Object.entries(evs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${k.toUpperCase()}`)
    .sort()
    .join(" / ");
}

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "#888";
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${color}40`, color }}
    >
      {type}
    </span>
  );
}

export function PokemonDetailModal({
  species,
  learnsets,
  movesById,
  onClose,
}: {
  species: SpeciesEntry;
  learnsets: LearnsetsData;
  movesById: Record<string, MoveEntry>;
  onClose: () => void;
}) {
  const [formats, setFormats] = useState<string[]>([]);
  const [smogonFormat, setSmogonFormat] = useState("gen9ou");
  const [smogonSets, setSmogonSets] = useState<SmogonSets | null>(null);
  const [loadingSets, setLoadingSets] = useState(false);

  const lookupId = species.id.toLowerCase().replace(/[\s.-]/g, "");
  const moveIds = learnsets[species.id] ?? learnsets[lookupId] ?? learnsets[species.id.replace(/[\s-]/g, "")] ?? [];
  const moveList = moveIds
    .map((id) => movesById[id])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  const abilityList = Object.values(species.abilities ?? {})
    .map((a) => (typeof a === "string" ? a : ""))
    .filter(Boolean);

  const DEFAULT_FORMATS = ["gen9ou", "gen9uu", "gen9ru", "gen9nu", "gen8ou", "gen8uu", "gen7ou", "newest"];

  useEffect(() => {
    api.get<string[]>("/smogon/formats").then(setFormats).catch(() => setFormats(DEFAULT_FORMATS));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingSets(true);
    api
      .get<SmogonSets>(`/smogon/sets/${smogonFormat}`)
      .then((s) => {
        if (!cancelled) setSmogonSets(s);
      })
      .catch(() => {
        if (!cancelled) setSmogonSets(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSets(false);
      });
    return () => { cancelled = true; };
  }, [smogonFormat]);

  const normalizedName = species.name.replace(/[\s-]/g, "");
  const pokemonSmogonSets = smogonSets
    ? Object.entries(smogonSets).find(
        ([key]) =>
          key.replace(/[\s-]/g, "").toLowerCase() === normalizedName.toLowerCase()
      )?.[1]
    : null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const modalContent = (
    <div
      className="flex items-center justify-center p-4"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2147483647,
        overflow: "auto",
      }}
    >
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pokemon-detail-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ margin: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <h2 id="pokemon-detail-title" className="font-display font-semibold text-[var(--primary)]">
            #{species.num} {species.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-6">
          <div className="flex flex-wrap gap-4 items-start">
            <PokemonSprite name={species.name} num={species.num} size={120} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1 mb-2">
                {species.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-[var(--text-muted)]">BST</dt>
                <dd className="text-[var(--text)]">{species.bst ?? Object.values(species.baseStats ?? {}).reduce((a, b) => a + b, 0)}</dd>
                {species.region && (
                  <>
                    <dt className="text-[var(--text-muted)]">Region</dt>
                    <dd className="text-[var(--text)]">{species.region}</dd>
                  </>
                )}
                {species.generation && (
                  <>
                    <dt className="text-[var(--text-muted)]">Generation</dt>
                    <dd className="text-[var(--text)]">{species.generation}</dd>
                  </>
                )}
                {species.weightkg != null && (
                  <>
                    <dt className="text-[var(--text-muted)]">Weight</dt>
                    <dd className="text-[var(--text)]">{species.weightkg} kg</dd>
                  </>
                )}
                {species.heightm != null && (
                  <>
                    <dt className="text-[var(--text-muted)]">Height</dt>
                    <dd className="text-[var(--text)]">{species.heightm} m</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {species.baseStats && (
            <div>
              <h3 className="text-sm font-medium text-[var(--primary)] mb-2">Base Stats</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(["hp", "atk", "def", "spa", "spd", "spe"] as const).map((stat) => (
                  <div key={stat} className="text-center p-2 rounded-lg bg-[var(--bg-input)]">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">
                      {stat === "spa" ? "SpA" : stat === "spd" ? "SpD" : stat}
                    </div>
                    <div className="font-semibold text-[var(--text)]">{species.baseStats[stat]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abilityList.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--primary)] mb-2">Abilities</h3>
              <div className="flex flex-wrap gap-2">
                {abilityList.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-1 rounded bg-[var(--bg-input)] text-sm text-[var(--text)]"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-[var(--primary)] mb-2">Available Moves ({moveList.length})</h3>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              <div className="flex flex-wrap gap-1">
                {moveList.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--bg-input)]"
                    title={`${m.type} · ${m.category} · ${m.basePower || "—"} BP · ${m.pp} PP`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: TYPE_COLORS[m.type] ?? "#888" }}
                    />
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-[var(--primary)]">Smogon Sets</h3>
              <select
                value={smogonFormat}
                onChange={(e) => setSmogonFormat(e.target.value)}
                className="px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-xs"
                aria-label="Smogon format"
              >
                <option value="newest">Newest</option>
                {(formats.length ? formats : DEFAULT_FORMATS).slice(0, 30).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {loadingSets && (
                <span className="text-xs text-[var(--primary)]">Loading…</span>
              )}
            </div>
            {pokemonSmogonSets ? (
              <div className="space-y-2">
                {Object.entries(pokemonSmogonSets).map(([setName, setData]) => (
                  <div
                    key={setName}
                    className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm"
                  >
                    <div className="font-medium text-[var(--primary)] mb-1">{setName}</div>
                    <div className="text-[var(--text-muted)] space-y-0.5">
                      {setData.moves && (
                        <div>
                          <span className="text-[var(--text)]">Moves: </span>
                          {flattenMoves(setData.moves).join(", ")}
                        </div>
                      )}
                      {setData.ability && (
                        <div>
                          <span className="text-[var(--text)]">Ability: </span>
                          {Array.isArray(setData.ability) ? setData.ability[0] : setData.ability}
                        </div>
                      )}
                      {setData.item && (
                        <div>
                          <span className="text-[var(--text)]">Item: </span>
                          {Array.isArray(setData.item) ? setData.item[0] : setData.item}
                        </div>
                      )}
                      {setData.nature && (
                        <div>
                          <span className="text-[var(--text)]">Nature: </span>
                          {Array.isArray(setData.nature) ? setData.nature[0] : setData.nature}
                        </div>
                      )}
                      {setData.evs && Object.keys(setData.evs).length > 0 && (
                        <div>
                          <span className="text-[var(--text)]">EVs: </span>
                          {formatEvs(setData.evs)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : !loadingSets ? (
              <p className="text-sm text-[var(--text-muted)] italic">No Smogon sets for this format.</p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
