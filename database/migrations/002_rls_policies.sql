-- Row Level Security policies for Gazes application
-- Run this after the initial schema migration

-- Users table policies
-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Allow registration (insert) for authenticated users
CREATE POLICY "Users can create profile" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Watching progress policies
-- Users can view their own watching progress
CREATE POLICY "Users can view own watching progress" ON watching_progress
  FOR SELECT USING (auth.uid()::text = user_id);

-- Users can insert their own watching progress
CREATE POLICY "Users can create watching progress" ON watching_progress
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own watching progress
CREATE POLICY "Users can update own watching progress" ON watching_progress
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Users can delete their own watching progress
CREATE POLICY "Users can delete own watching progress" ON watching_progress
  FOR DELETE USING (auth.uid()::text = user_id);