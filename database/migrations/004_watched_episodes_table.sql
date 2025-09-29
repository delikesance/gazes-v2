-- Migration: 004_watched_episodes_table
-- Description: Add table to track watched episodes per series for accurate progress tracking

-- Create watched_episodes table to maintain accurate list of watched episodes per series
CREATE TABLE IF NOT EXISTS watched_episodes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL,
  season TEXT NOT NULL,
  episode INTEGER NOT NULL,
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, anime_id, season, episode)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_watched_episodes_user_id ON watched_episodes(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_episodes_anime_id ON watched_episodes(anime_id);
CREATE INDEX IF NOT EXISTS idx_watched_episodes_user_anime ON watched_episodes(user_id, anime_id);
CREATE INDEX IF NOT EXISTS idx_watched_episodes_watched_at ON watched_episodes(watched_at DESC);

-- Function to automatically mark episodes as watched when progress reaches completion threshold
CREATE OR REPLACE FUNCTION mark_episode_watched()
RETURNS TRIGGER AS $$
BEGIN
  -- If the episode is now completed, add it to watched_episodes
  IF NEW.completed = true AND (OLD.completed = false OR OLD.completed IS NULL) THEN
    INSERT INTO watched_episodes (id, user_id, anime_id, season, episode, watched_at)
    VALUES (gen_random_uuid()::text, NEW.user_id, NEW.anime_id, NEW.season, NEW.episode, NEW.last_watched_at)
    ON CONFLICT (user_id, anime_id, season, episode) DO NOTHING;
  END IF;

  -- If progress was deleted or completion was revoked, remove from watched_episodes
  IF NEW.completed = false AND OLD.completed = true THEN
    DELETE FROM watched_episodes
    WHERE user_id = NEW.user_id
      AND anime_id = NEW.anime_id
      AND season = NEW.season
      AND episode = NEW.episode;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically maintain watched_episodes table
DROP TRIGGER IF EXISTS trigger_mark_episode_watched ON watching_progress;
CREATE TRIGGER trigger_mark_episode_watched
  AFTER INSERT OR UPDATE ON watching_progress
  FOR EACH ROW
  EXECUTE FUNCTION mark_episode_watched();

-- Function to get watched episodes for a series
CREATE OR REPLACE FUNCTION get_watched_episodes(p_user_id UUID, p_anime_id TEXT)
RETURNS TABLE (
  season TEXT,
  episode INTEGER,
  watched_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT we.season, we.episode, we.watched_at
  FROM watched_episodes we
  WHERE we.user_id = p_user_id AND we.anime_id = p_anime_id
  ORDER BY we.season, we.episode;
END;
$$;

-- Function to get the latest watched episode for a series (highest episode number)
CREATE OR REPLACE FUNCTION get_latest_watched_episode(p_user_id UUID, p_anime_id TEXT)
RETURNS TABLE (
  season TEXT,
  episode INTEGER,
  watched_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT we.season, we.episode, we.watched_at
  FROM watched_episodes we
  WHERE we.user_id = p_user_id AND we.anime_id = p_anime_id
  ORDER BY
    -- Try to parse season number from season string (e.g., 'saison1' -> 1)
    CASE
      WHEN we.season ~ 'saison(\d+)' THEN CAST(substring(we.season from 'saison(\d+)') AS INTEGER)
      WHEN we.season ~ 'season(\d+)' THEN CAST(substring(we.season from 'season(\d+)') AS INTEGER)
      WHEN we.season ~ 's(\d+)' THEN CAST(substring(we.season from 's(\d+)') AS INTEGER)
      ELSE 0
    END DESC,
    we.episode DESC
  LIMIT 1;
END;
$$;

-- Update the aggregated series progress function to use the highest episode number
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
      we.anime_id,
      COUNT(*) as total_episodes_watched,
      COUNT(*) as completed_episodes, -- All watched episodes are considered completed
      MAX(we.watched_at) as last_watched_at
    FROM watched_episodes we
    WHERE we.user_id = p_user_id
    GROUP BY we.anime_id
  ),
  latest_episodes AS (
    SELECT DISTINCT ON (we.anime_id)
      we.anime_id,
      we.season,
      we.episode,
      wp.current_time,
      wp.duration,
      we.watched_at
    FROM watched_episodes we
    LEFT JOIN watching_progress wp ON
      wp.user_id = we.user_id AND
      wp.anime_id = we.anime_id AND
      wp.season = we.season AND
      wp.episode = we.episode
    WHERE we.user_id = p_user_id
    ORDER BY we.anime_id,
      -- Order by season number (parsed from season string)
      CASE
        WHEN we.season ~ 'saison(\d+)' THEN CAST(substring(we.season from 'saison(\d+)') AS INTEGER)
        WHEN we.season ~ 'season(\d+)' THEN CAST(substring(we.season from 'season(\d+)') AS INTEGER)
        WHEN we.season ~ 's(\d+)' THEN CAST(substring(we.season from 's(\d+)') AS INTEGER)
        ELSE 0
      END DESC,
      we.episode DESC
  )
  SELECT
    ss.anime_id,
    ss.total_episodes_watched,
    ss.completed_episodes,
    ss.last_watched_at,
    le.season as latest_season,
    le.episode as latest_episode,
    COALESCE(le.current_time, 0) as latest_current_time,
    COALESCE(le.duration, 0) as latest_duration
  FROM series_stats ss
  JOIN latest_episodes le ON ss.anime_id = le.anime_id
  ORDER BY ss.last_watched_at DESC;
END;
$$;