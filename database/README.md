# Database Setup

This directory contains the database migrations and setup instructions for the Gazes application using Supabase.

## Setup Instructions

1. **Create a Supabase project** at https://supabase.com

2. **Run the initial schema migration**:
   - Go to your Supabase dashboard → SQL Editor
   - Copy and paste the contents of `migrations/001_initial_schema.sql`
   - Run the query

3. **Set up Row Level Security policies**:
   - Copy and paste the contents of `migrations/002_rls_policies.sql`
   - Run the query

4. **Configure environment variables**:
   - Copy the values from your Supabase project settings
   - Update the `.env` file with your actual credentials

## Tables

### users
- `id` (TEXT, PRIMARY KEY): User UUID
- `email` (TEXT, UNIQUE): User email
- `username` (TEXT): Username
- `password` (TEXT): Hashed password
- `created_at` (TIMESTAMP): Account creation time
- `updated_at` (TIMESTAMP): Last update time

### watching_progress
- `id` (TEXT, PRIMARY KEY): Progress record UUID
- `user_id` (TEXT, FOREIGN KEY): Reference to users.id
- `anime_id` (TEXT): Anime identifier
- `season` (TEXT): Season identifier
- `episode` (INTEGER): Episode number
- `current_time` (REAL): Current playback position
- `duration` (REAL): Total episode duration
- `last_watched_at` (TIMESTAMP): Last watch time
- `completed` (BOOLEAN): Whether episode is completed

## Security

Row Level Security (RLS) is enabled on all tables. Users can only access their own data.