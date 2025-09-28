-- Row Level Security policies for Gazes application

-- Users table policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Watching progress policies
CREATE POLICY "Users can view their own watching progress" ON watching_progress
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own watching progress" ON watching_progress
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own watching progress" ON watching_progress
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own watching progress" ON watching_progress
  FOR DELETE USING (auth.uid()::text = user_id);