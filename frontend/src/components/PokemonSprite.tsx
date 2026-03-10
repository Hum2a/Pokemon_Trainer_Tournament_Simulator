import { useState, useCallback, useEffect, useRef } from "react";
import {
  getSpriteUrlCandidates,
  fetchSpriteFromPokeApi,
} from "../lib/pokemonSprites";
import { cn } from "../lib/utils";

interface PokemonSpriteProps {
  /** Pokemon display name (e.g. "Pikachu", "Mr. Mime") */
  name: string;
  /** National dex number for direct PokeAPI sprite URLs (optional) */
  num?: number;
  /** Size in pixels */
  size?: number;
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
}

/** Placeholder when no sprite loads */
function SpritePlaceholder({ size }: { size: number }) {
  return (
    <div
      className="rounded-full bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-xs"
      style={{ width: size, height: size }}
      title="No sprite"
    >
      ?
    </div>
  );
}

export function PokemonSprite({
  name,
  num,
  size = 96,
  className,
  alt,
}: PokemonSpriteProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const tryIndexRef = useRef(0);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const candidates = getSpriteUrlCandidates(name, num);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const safeSetSrc = useCallback((url: string | null) => {
    if (mountedRef.current) setSrc(url);
  }, []);
  const safeSetFailed = useCallback((value: boolean) => {
    if (mountedRef.current) setFailed(value);
  }, []);

  const handleError = useCallback(() => {
    const urls = getSpriteUrlCandidates(name, num);
    const idx = tryIndexRef.current;
    if (idx + 1 < urls.length) {
      tryIndexRef.current = idx + 1;
      safeSetSrc(urls[idx + 1] ?? null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSpriteFromPokeApi(name, controller.signal)
      .then((pokeUrl) => {
        if (mountedRef.current) {
          if (pokeUrl) safeSetSrc(pokeUrl);
          else safeSetFailed(true);
        }
      })
      .catch(() => {
        if (mountedRef.current) safeSetFailed(true);
      })
      .finally(() => {
        if (abortRef.current === controller) abortRef.current = null;
      });
  }, [name, num, safeSetSrc, safeSetFailed]);

  useEffect(() => {
    if (!name) {
      setSrc(null);
      setFailed(false);
      tryIndexRef.current = 0;
      return;
    }
    const urls = getSpriteUrlCandidates(name, num);
    tryIndexRef.current = 0;
    setFailed(false);
    setSrc(urls[0] ?? null);
  }, [name, num]);

  if (!name) return <SpritePlaceholder size={size} />;
  if (failed || (!src && candidates.length === 0)) return <SpritePlaceholder size={size} />;

  if (!src) return <SpritePlaceholder size={size} />;

  return (
    <img
      src={src}
      alt={alt ?? name}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      onError={handleError}
      loading="lazy"
    />
  );
}
