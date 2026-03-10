-- Pokemon Battle Simulator: User configs and simulation results
-- Run in Supabase SQL Editor or via supabase db push

-- User configs (one row per user, upserted on save)
CREATE TABLE IF NOT EXISTS user_configs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Simulation runs (metadata for each run)
CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('matchup', 'trainer', 'pokemon')),
  config_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Simulation results (output data per run)
CREATE TABLE IF NOT EXISTS simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matchup_results JSONB,
  matchup_matrix_csv TEXT,
  matchup_battle_logs JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;

-- user_configs: users can only access their own
DROP POLICY IF EXISTS "Users can read own config" ON user_configs;
DROP POLICY IF EXISTS "Users can insert own config" ON user_configs;
DROP POLICY IF EXISTS "Users can update own config" ON user_configs;
CREATE POLICY "Users can read own config" ON user_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON user_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON user_configs
  FOR UPDATE USING (auth.uid() = user_id);

-- simulation_runs: users can only access their own
DROP POLICY IF EXISTS "Users can read own runs" ON simulation_runs;
DROP POLICY IF EXISTS "Users can insert own runs" ON simulation_runs;
DROP POLICY IF EXISTS "Users can update own runs" ON simulation_runs;
CREATE POLICY "Users can read own runs" ON simulation_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON simulation_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON simulation_runs
  FOR UPDATE USING (auth.uid() = user_id);

-- simulation_results: users can only access their own (via run ownership)
DROP POLICY IF EXISTS "Users can read own results" ON simulation_results;
DROP POLICY IF EXISTS "Users can insert own results" ON simulation_results;
CREATE POLICY "Users can read own results" ON simulation_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own results" ON simulation_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS for backend writes
-- (Flask uses service_role key for server-side inserts)
