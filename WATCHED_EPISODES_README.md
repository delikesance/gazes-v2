## Latest Episode Logic

The system now tracks the **highest episode number** that has been watched, not the most recently watched by time. This ensures that:

- If you watch episode 5, then go back to episode 2, continue watching will still show episode 5
- The "latest episode" is determined by episode number, not watch timestamp
- Seasons are ordered by parsed season number (e.g., "saison1" → 1, "saison2" → 2)

### Season Parsing Logic

Seasons are parsed using regex patterns to extract numeric values:
- `saison1` → season 1
- `season2` → season 2
- `s3` → season 3
- Unrecognized formats default to season 0

Episodes are then ordered by: `season number DESC, episode number DESC`

## Database Changes

### New Table: `watched_episodes`
- **Purpose**: Stores which episodes have been watched for each series
- **Fields**:
  - `id`: Primary key
  - `user_id`: Reference to users table
  - `anime_id`: Anime identifier
  - `season`: Season identifier
  - `episode`: Episode number
  - `watched_at`: Timestamp when episode was marked as watched
- **Constraints**: Unique constraint on (user_id, anime_id, season, episode)

### Database Functions
- `get_watched_episodes(p_user_id, p_anime_id)`: Returns all watched episodes for a series
- `get_latest_watched_episode(p_user_id, p_anime_id)`: Returns the most recently watched episode
- Updated `get_aggregated_series_progress()`: Now uses watched_episodes for more accurate tracking

### Triggers
- `trigger_mark_episode_watched`: Automatically adds episodes to watched_episodes when they reach 90% completion in watching_progress

## API Endpoints

### GET `/api/watch/episodes/[animeId]`
Get all watched episodes for a series.
```json
{
  "success": true,
  "episodes": [
    {
      "season": "saison1",
      "episode": 1,
      "watchedAt": "2025-09-29T09:00:00.000Z"
    }
  ]
}
```

### POST `/api/watch/episodes/[animeId]`
Mark an episode as watched.
```json
{
  "season": "saison1",
  "episode": 5
}
```

### DELETE `/api/watch/episodes/[animeId]`
- With query params `season` and `episode`: Unmark specific episode
- Without params: Clear all watched episodes for the series

### GET `/api/watch/episodes/[animeId]/[season]/[episode]/watched`
Check if a specific episode is watched.
```json
{
  "success": true,
  "isWatched": true
}
```

## Database Service Methods

- `markEpisodeWatched(userId, animeId, season, episode)`: Mark episode as watched
- `unmarkEpisodeWatched(userId, animeId, season, episode)`: Unmark episode as watched
- `getWatchedEpisodes(userId, animeId)`: Get all watched episodes for series
- `getLatestWatchedEpisode(userId, animeId)`: Get latest watched episode
- `isEpisodeWatched(userId, animeId, season, episode)`: Check if episode is watched
- `clearWatchedEpisodesForSeries(userId, animeId)`: Clear all watched episodes

## Benefits

1. **Accurate Episode Counting**: The continue watching feature now shows the exact number of episodes watched
2. **Latest Episode Tracking**: Can reliably determine the most recently watched episode
3. **Episode History**: Maintains a complete history of watched episodes per series
4. **Automatic Management**: Episodes are automatically marked as watched when completed
5. **Manual Control**: API allows manual marking/unmarking of episodes

## Migration Required

To deploy this feature, run the database migration:

```bash
# Set your POSTGRES_URL environment variable
export POSTGRES_URL="your-database-connection-string"

# Run the migrations
node run-migrations.mjs
```

The migration includes:
- Creation of `watched_episodes` table
- Database functions for querying watched episodes
- Trigger for automatic episode marking
- Updated aggregation function

## Backward Compatibility

The existing `watching_progress` table remains unchanged. The new `watched_episodes` table provides additional tracking while the progress table continues to store detailed watching data.