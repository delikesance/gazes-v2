-- Migration: 006_add_performance_indexes
-- Description: Add indexes on frequently queried fields for better performance

-- Add index on anime_id in watching_progress for faster queries
CREATE INDEX IF NOT EXISTS idx_watching_progress_anime_id ON watching_progress(anime_id);

-- Add composite index on user_id and anime_id in watching_progress for user-specific anime queries
CREATE INDEX IF NOT EXISTS idx_watching_progress_user_anime ON watching_progress(user_id, anime_id);

-- Add index on season in watching_progress if queries filter by season
CREATE INDEX IF NOT EXISTS idx_watching_progress_season ON watching_progress(season);