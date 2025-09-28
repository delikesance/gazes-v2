-- Initial database schema for Gazes application
-- Run this in your Supabase SQL editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create watching progress table
CREATE TABLE IF NOT EXISTS watching_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL,
  season TEXT NOT NULL,
  episode INTEGER NOT NULL,
  "current_time" REAL NOT NULL DEFAULT 0,
  duration REAL NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, anime_id, season, episode)
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_watching_progress_user_id ON watching_progress(user_id);

-- Create index on last_watched_at for sorting recent progress
CREATE INDEX IF NOT EXISTS idx_watching_progress_last_watched ON watching_progress("last_watched_at" DESC);

-- Note: Row Level Security is not enabled because this app uses custom JWT authentication
-- instead of Supabase Auth. RLS policies would need to be implemented differently.