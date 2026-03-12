-- Smogon sets cache for faster data retrieval.
-- Synced by Data/UsefulDatasets/fetch_smogon_data.py.
-- API reads from this table first, falls back to data.pkmn.cc if empty.

CREATE TABLE IF NOT EXISTS smogon_sets (
  format_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE smogon_sets IS 'Smogon format index (format_id=index) and per-format sets. Synced by fetch_smogon_data.py.';
