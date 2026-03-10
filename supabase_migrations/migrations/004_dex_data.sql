-- Pokedex reference data: species, moves, abilities, items, learnsets, natures
-- Synced from fetch_dex_data.py. JSON files remain as fallback.
-- Future-proof for new generations: re-run fetch script to update.

CREATE TABLE IF NOT EXISTS dex_data (
  data_type TEXT PRIMARY KEY CHECK (data_type IN ('species', 'moves', 'abilities', 'items', 'learnsets', 'natures')),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS: reference data, read via backend API. Service role used for sync.
COMMENT ON TABLE dex_data IS 'Pokedex reference data. Synced by fetch_dex_data.py. API falls back to JSON files if empty.';
