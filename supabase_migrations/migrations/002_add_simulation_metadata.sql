-- Add pool and pokemon_sets to simulation_results for full simulation context
ALTER TABLE simulation_results
  ADD COLUMN IF NOT EXISTS pool JSONB,
  ADD COLUMN IF NOT EXISTS pokemon_sets JSONB;
