-- Add missing columns and unique constraint for leagues to support sleeper-import writes
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS settings_json jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Ensure unique constraint for upsert target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='leagues' AND indexname='leagues_provider_external_id_key'
  ) THEN
    ALTER TABLE public.leagues
      ADD CONSTRAINT leagues_provider_external_id_key UNIQUE (provider, external_id);
  END IF;
END $$;