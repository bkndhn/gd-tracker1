-- Migration: Enable Realtime Publications for Instant Synchronization
-- Adds stock_requirements, stock_requirement_events, and profiles to supabase_realtime publication
-- and sets REPLICA IDENTITY FULL so clients receive full payloads on UPDATE/DELETE events.

DO $$
BEGIN
  -- 1. Ensure stock_requirements is in supabase_realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stock_requirements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_requirements;
  END IF;

  -- 2. Ensure stock_requirement_events is in supabase_realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stock_requirement_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_requirement_events;
  END IF;

  -- 3. Ensure profiles is in supabase_realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- Enable REPLICA IDENTITY FULL so payload.old has all row fields for realtime listeners
ALTER TABLE public.stock_requirements REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
