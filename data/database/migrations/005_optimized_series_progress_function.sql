-- Migration: 005_optimized_series_progress_function.sql
-- Description: Replace client-side aggregation with optimized database function
-- Date: 2025-10-07

-- Create optimized function for user series progress aggregation
CREATE OR REPLACE FUNCTION get_user_series_progress_optimized(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  anime_id TEXT,
  total_episodes_watched BIGINT,
  completed_episodes BIGINT,
  last_watched_at TIMESTAMPTZ,
  latest_season TEXT,
  latest_episode INTEGER,
  latest_current_time REAL,
  latest_duration REAL,
  total_count BIGINT
) AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Get total count first
  SELECT COUNT(*) INTO v_total_count
  FROM (
    SELECT wp.anime_id
    FROM watching_progress wp
    WHERE wp.user_id = p_user_id
    GROUP BY wp.anime_id
  ) series_count;

  -- Return aggregated data with pagination
  RETURN QUERY
  WITH series_stats AS (
    SELECT
      wp.anime_id,
      COUNT(*) FILTER (WHERE wp.current_time > 0) as total_episodes_watched,
      COUNT(*) FILTER (WHERE wp.completed) as completed_episodes,
      MAX(wp.last_watched_at) as last_watched_at,
      -- Get latest episode by season and episode number
      (ARRAY_AGG(
        ROW(wp.season, wp.episode, wp.current_time, wp.duration, wp.last_watched_at)
        ORDER BY
          CASE
            WHEN wp.season ~ '^saison\s*\d+$' THEN CAST(substring(wp.season from 'saison\s*(\d+)') AS INTEGER)
            WHEN wp.season ~ '^season\s*\d+$' THEN CAST(substring(wp.season from 'season\s*(\d+)') AS INTEGER)
            WHEN wp.season ~ '^s\d+$' THEN CAST(substring(wp.season from 's(\d+)') AS INTEGER)
            ELSE 0
          END DESC,
          wp.episode DESC
      ))[1] as latest_episode_data
    FROM watching_progress wp
    WHERE wp.user_id = p_user_id
    GROUP BY wp.anime_id
  )
  SELECT
    ss.anime_id,
    ss.total_episodes_watched,
    ss.completed_episodes,
    ss.last_watched_at,
    (ss.latest_episode_data).season as latest_season,
    (ss.latest_episode_data).episode as latest_episode,
    (ss.latest_episode_data).current_time as latest_current_time,
    (ss.latest_episode_data).duration as latest_duration,
    v_total_count as total_count
  FROM series_stats ss
  ORDER BY ss.last_watched_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_watching_progress_user_anime_season_episode
ON watching_progress (user_id, anime_id, season, episode);

CREATE INDEX IF NOT EXISTS idx_watching_progress_user_last_watched
ON watching_progress (user_id, last_watched_at DESC);

CREATE INDEX IF NOT EXISTS idx_watching_progress_completed
ON watching_progress (user_id, completed) WHERE completed = true;

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_watching_progress_user_anime
ON watching_progress (user_id, anime_id);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_series_progress_optimized(UUID, INTEGER, INTEGER) TO authenticated;