/**
 * Pokemon sprite URLs with fallback chain.
 * 1. Pokemon Showdown dex sprites
 * 2. Pokemon Showdown gen5 sprites
 * 3. PokéAPI official artwork (fetched on demand)
 * 4. PokéAPI default sprite
 */

const SHOWDOWN_BASE = "https://play.pokemonshowdown.com/sprites";
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

/** Convert display name to Showdown/PokeAPI id (lowercase, hyphens). */
export function toSpriteId(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || name.toLowerCase().replace(/\s/g, "-");
}

/** Get sprite URL candidates in fallback order (no async). */
export function getSpriteUrlCandidates(name: string, num?: number): string[] {
  const id = toSpriteId(name);
  const urls: string[] = [];

  if (id) {
    urls.push(`${SHOWDOWN_BASE}/dex/${id}.png`);
    urls.push(`${SHOWDOWN_BASE}/gen5/${id}.png`);
  }

  if (num != null && num > 0) {
    urls.push(
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`
    );
    urls.push(
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${num}.png`
    );
  }

  return urls;
}

/** Fetch sprite URL from PokéAPI by name. Cached per session. */
const pokeApiCache = new Map<string, string>();

export async function fetchSpriteFromPokeApi(
  name: string,
  signal?: AbortSignal
): Promise<string | null> {
  const cached = pokeApiCache.get(name);
  if (cached) return cached;

  const id = toSpriteId(name);
  if (!id) return null;

  try {
    const res = await fetch(`${POKEAPI_BASE}/pokemon/${id}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const url =
      data.sprites?.other?.["official-artwork"]?.front_default ??
      data.sprites?.other?.home?.front_default ??
      data.sprites?.front_default ??
      null;
    if (url) pokeApiCache.set(name, url);
    return url;
  } catch {
    return null;
  }
}
