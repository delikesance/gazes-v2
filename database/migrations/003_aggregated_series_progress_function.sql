-- Migration: 003_aggregated_series_progress_function
-- Description: Add database function for efficient series progress aggregation

-- Create function to get aggregated series progress for a user
CREATE OR REPLACE FUNCTION get_aggregated_series_progress(p_user_id UUID)
RETURNS TABLE (
  anime_id TEXT,
  total_episodes_watched BIGINT,
  completed_episodes BIGINT,
  last_watched_at TIMESTAMPTZ,
  latest_season TEXT,
  latest_episode INTEGER,
  latest_current_time REAL,
  latest_duration REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH series_stats AS (
    SELECT
      wp.anime_id,
      COUNT(*) FILTER (WHERE wp.current_time > 0) as total_episodes_watched,
      COUNT(*) FILTER (WHERE wp.completed = true) as completed_episodes,
      MAX(wp.last_watched_at) as last_watched_at
    FROM watching_progress wp
    WHERE wp.user_id = p_user_id
    GROUP BY wp.anime_id
  ),
  latest_episodes AS (
    SELECT DISTINCT ON (wp.anime_id)
      wp.anime_id,
      wp.season,
      wp.episode,
      wp.current_time,
      wp.duration,
      wp.last_watched_at
    FROM watching_progress wp
    WHERE wp.user_id = p_user_id
    ORDER BY wp.anime_id, wp.last_watched_at DESC
  )
  SELECT
    ss.anime_id,
    ss.total_episodes_watched,
    ss.completed_episodes,
    ss.last_watched_at,
    le.season as latest_season,
    le.episode as latest_episode,
    le.current_time as latest_current_time,
    le.duration as latest_duration
  FROM series_stats ss
  JOIN latest_episodes le ON ss.anime_id = le.anime_id
  ORDER BY ss.last_watched_at DESC;
END;
$$;