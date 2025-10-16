-- Migration: 006_add_anime_metadata_cache.sql
-- Description: Add table to cache anime metadata including total episodes
-- Date: 2025-10-16

-- Create anime metadata cache table
CREATE TABLE IF NOT EXISTS anime_metadata (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cover TEXT,
  banner TEXT,
  synopsis TEXT,
  genres TEXT[], -- Array of genres
  total_episodes INTEGER,
  seasons_data JSONB, -- Store seasons info
  language_flags JSONB, -- Store language flags
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_anime_metadata_last_updated ON anime_metadata (last_updated);
CREATE INDEX IF NOT EXISTS idx_anime_metadata_title ON anime_metadata (title);

-- Add function to get or create anime metadata
CREATE OR REPLACE FUNCTION get_or_create_anime_metadata(p_anime_id TEXT)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  cover TEXT,
  banner TEXT,
  synopsis TEXT,
  genres TEXT[],
  total_episodes INTEGER,
  seasons_data JSONB,
  language_flags JSONB,
  last_updated TIMESTAMPTZ
) AS $$
DECLARE
  v_metadata RECORD;
BEGIN
  -- Try to get existing metadata
  SELECT * INTO v_metadata FROM anime_metadata WHERE id = p_anime_id;

  IF FOUND THEN
    -- Return existing data if it's recent (less than 24 hours old)
    IF v_metadata.last_updated > NOW() - INTERVAL '24 hours' THEN
      RETURN QUERY SELECT
        v_metadata.id,
        v_metadata.title,
        v_metadata.cover,
        v_metadata.banner,
        v_metadata.synopsis,
        v_metadata.genres,
        v_metadata.total_episodes,
        v_metadata.seasons_data,
        v_metadata.language_flags,
        v_metadata.last_updated;
      RETURN;
    END IF;
  END IF;

  -- If not found or too old, we would fetch from external API here
  -- For now, return null to indicate we need to fetch
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON TABLE anime_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_anime_metadata(TEXT) TO authenticated;