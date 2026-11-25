-- No app query reads benchmark_observations by freshness: these three indexes show at most one scan
-- each since stats began, and take about 200 MB. Indexes hold no data, so dropping them loses nothing;
-- each can be recreated from model_intelligence_foundation.sql if a query ever needs it.
drop index if exists public.idx_benchmark_observations_source_freshness;
drop index if exists public.idx_benchmark_observations_model_freshness;
drop index if exists public.idx_benchmark_observations_benchmark_freshness;
