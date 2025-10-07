import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

export interface User {
  id: string
  email: string
  username: string
  createdAt: Date
  updatedAt: Date
}

export interface UserWithPassword extends User {
  password: string
  created_at: string
  updated_at: string
}

export interface WatchingProgress {
  id: string
  userId: string
  animeId: string
  season: string
  episode: number
  currentTime: number
  duration: number
  lastWatchedAt: Date
  completed: boolean
  title?: string
  image?: string
}

export class DatabaseService {
  private static instance: DatabaseService
  private supabase: any

  private constructor() {
    console.log('📁 [DATABASE] Initializing Supabase connection...')

    try {
      const config = useRuntimeConfig()

      const supabaseUrl = config.supabaseUrl as string
      const supabaseKey = config.supabaseKey as string

      if (!supabaseUrl || !supabaseKey) {
        const errorMsg = 'Missing required Supabase environment variables'
        console.error('❌ [DATABASE] ' + errorMsg)
        throw new Error(errorMsg)
      }

      this.supabase = createClient(supabaseUrl, supabaseKey)

      this.initDatabase()
    } catch (error) {
      console.error('❌ [DATABASE] Failed to initialize:', error)
      throw error
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  public getSupabaseClient() {
    return this.supabase
  }

  private async initDatabase() {
    console.log('📁 [DATABASE] Database schema initialization completed')
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', latency: number }> {
    const startTime = Date.now()

    try {
      // Simple query to test connection
      const { error } = await this.supabase
        .from('users')
        .select('count', { count: 'exact', head: true })
        .limit(1)

      const latency = Date.now() - startTime

      if (error) {
        console.error('📁 [DATABASE] Health check failed:', error)
        return { status: 'unhealthy', latency }
      }

      return { status: 'healthy', latency }
    } catch (error) {
      console.error('📁 [DATABASE] Health check error:', error)
      return { status: 'unhealthy', latency: Date.now() - startTime }
    }
  }

  // User operations
  async createUser(email: string, username: string, hashedPassword: string): Promise<User> {
    console.log('📁 [DATABASE] Creating user:', username, 'with email:', email)

    const id = crypto.randomUUID()
    const now = new Date()

    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert({
          id,
          email,
          username,
          password: hashedPassword,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('📁 [DATABASE] Error creating user:', error)
        if (error.code === '23505') {
          throw new Error('User with this email already exists')
        }
        throw error
      }

      console.log('📁 [DATABASE] User created successfully with ID:', id)

      return {
        id: data.id,
        email: data.email,
        username: data.username,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      }
    } catch (error: any) {
      console.error('📁 [DATABASE] Error creating user:', error)
      throw error
    }
  }

  async findUserByEmail(email: string): Promise<UserWithPassword | null> {
    console.log('📁 [DATABASE] Looking for user by email:', email)

    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, username, password, created_at, updated_at')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📁 [DATABASE] User not found:', email)
        return null
      }
      console.error('📁 [DATABASE] Error finding user:', error)
      throw error
    }

    console.log('📁 [DATABASE] User found:', data.username)
    return {
      ...data,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  async findUserById(id: string): Promise<User | null> {
    console.log('📁 [DATABASE] Looking for user by ID:', id)

    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, username, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📁 [DATABASE] User not found:', id)
        return null
      }
      console.error('📁 [DATABASE] Error finding user:', error)
      throw error
    }

    console.log('📁 [DATABASE] User found:', data.username)
    return {
      id: data.id,
      email: data.email,
      username: data.username,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  async findUserByUsername(username: string): Promise<UserWithPassword | null> {
    console.log('📁 [DATABASE] Looking for user by username:', username)

    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, username, password, created_at, updated_at')
      .eq('username', username)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📁 [DATABASE] User not found:', username)
        return null
      }
      console.error('📁 [DATABASE] Error finding user:', error)
      throw error
    }

    console.log('📁 [DATABASE] User found:', data.username)
    return {
      ...data,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  async updateUser(id: string, updates: Partial<User & { password?: string }>): Promise<User> {
    console.log('📁 [DATABASE] Updating user:', id)

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (updates.email !== undefined) {
      updateData.email = updates.email
    }

    if (updates.username !== undefined) {
      updateData.username = updates.username
    }

    if (updates.password !== undefined) {
      updateData.password = updates.password
    }

    const { data, error } = await this.supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, username, created_at, updated_at')
      .single()

    if (error) {
      console.error('📁 [DATABASE] Error updating user:', error)
      throw error
    }

    console.log('📁 [DATABASE] User updated successfully')

    return {
      id: data.id,
      email: data.email,
      username: data.username,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    console.log('📁 [DATABASE] Deleting user:', id)

    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('📁 [DATABASE] Error deleting user:', error)
      return false
    }

    console.log('📁 [DATABASE] User deleted successfully')
    return true
  }

  async getAllUsers(limit: number = 50, offset: number = 0): Promise<{ items: User[], total: number }> {
    console.log('📁 [DATABASE] Getting all users, limit:', limit, 'offset:', offset)

    // Get total count
    const { count: totalCount, error: countError } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('📁 [DATABASE] Error getting user count:', countError)
      throw countError
    }

    // Get paginated data
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, username, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('📁 [DATABASE] Error getting all users:', error)
      throw error
    }

    const users = data.map((row: any) => ({
      id: row.id,
      email: row.email,
      username: row.username,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }))

    console.log('📁 [DATABASE] Found', users.length, 'users (total:', totalCount, ')')
    return { items: users, total: totalCount || 0 }
  }

  async getUserCount(): Promise<number> {
    console.log('📁 [DATABASE] Getting user count')

    const { count, error } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('📁 [DATABASE] Error getting user count:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      throw error
    }

    console.log('📁 [DATABASE] User count:', count)
    return count || 0
  }

  // Watching progress operations
  async saveWatchingProgress(userId: string, animeId: string, season: string, episode: number, currentTime: number, duration: number): Promise<WatchingProgress> {
    console.log('📁 [DATABASE] Saving watching progress:', { userId, animeId, season, episode, currentTime, duration })

    const completed = duration > 0 && currentTime >= duration * 0.9
    const now = new Date()
    const id = crypto.randomUUID()

    const { data, error } = await this.supabase
      .from('watching_progress')
      .upsert({
        id,
        user_id: userId,
        anime_id: animeId,
        season,
        episode,
        current_time: currentTime,
        duration,
        last_watched_at: now.toISOString(),
        completed
      }, {
        onConflict: 'user_id,anime_id,season,episode'
      })
      .select()
      .single()

    if (error) {
      console.error('📁 [DATABASE] Error saving watching progress:', error)
      throw error
    }

    console.log('📁 [DATABASE] Watching progress saved successfully')

    return {
      id: data.id,
      userId: data.user_id,
      animeId: data.anime_id,
      season: data.season,
      episode: data.episode,
      currentTime: data.current_time,
      duration: data.duration,
      lastWatchedAt: new Date(data.last_watched_at),
      completed: data.completed
    }
  }

  async getWatchingProgress(userId: string, animeId: string, season: string, episode: number): Promise<WatchingProgress | null> {
    console.log('📁 [DATABASE] Getting watching progress:', { userId, animeId, season, episode })

    const { data, error } = await this.supabase
      .from('watching_progress')
      .select('id, user_id, anime_id, season, episode, current_time, duration, last_watched_at, completed')
      .eq('user_id', userId)
      .eq('anime_id', animeId)
      .eq('season', season)
      .eq('episode', episode)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📁 [DATABASE] No watching progress found')
        return null
      }
      console.error('📁 [DATABASE] Error getting watching progress:', error)
      throw error
    }

    console.log('📁 [DATABASE] Found watching progress:', data.current_time, '/', data.duration)
    return {
      id: data.id,
      userId: data.user_id,
      animeId: data.anime_id,
      season: data.season,
      episode: data.episode,
      currentTime: data.current_time,
      duration: data.duration,
      lastWatchedAt: new Date(data.last_watched_at),
      completed: data.completed
    }
  }

  async getUserSeriesProgress(userId: string, limit: number = 20, offset: number = 0): Promise<{ items: any[], total: number }> {
    console.log('📁 [DATABASE] Getting series progress for user:', userId, 'limit:', limit, 'offset:', offset)

    try {
      // Try optimized database function first
      const { data, error } = await this.supabase
        .rpc('get_user_series_progress_optimized', {
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset
        })

      if (!error && data) {
        console.log('📁 [DATABASE] Used optimized database function, found', data.length, 'series progress items')
        return { items: data, total: data.length > 0 ? data[0].total_count : 0 }
      }

      console.log('📁 [DATABASE] Optimized function failed, falling back to application aggregation:', error?.message)
    } catch (error) {
      console.log('📁 [DATABASE] Optimized function not available, falling back to application aggregation:', error)
    }

    // Fallback to application-level aggregation if RPC fails
    const allSeries = await this.getAggregatedSeriesProgressFallback(userId)
    const paginatedItems = allSeries.slice(offset, offset + limit)
    return { items: paginatedItems, total: allSeries.length }
  }

  async deleteWatchingProgress(userId: string, animeId: string, season: string, episode: number): Promise<boolean> {
    console.log('📁 [DATABASE] Deleting watching progress:', { userId, animeId, season, episode })

    const { error } = await this.supabase
      .from('watching_progress')
      .delete()
      .eq('user_id', userId)
      .eq('anime_id', animeId)
      .eq('season', season)
      .eq('episode', episode)

    if (error) {
      console.error('📁 [DATABASE] Error deleting watching progress:', error)
      return false
    }

    console.log('📁 [DATABASE] Watching progress deleted successfully')
    return true
  }

  async getAllUserWatchingProgress(userId: string): Promise<WatchingProgress[]> {
    console.log('📁 [DATABASE] Getting all watching progress for user:', userId)

    const { data, error } = await this.supabase
      .from('watching_progress')
      .select('id, user_id, anime_id, season, episode, current_time, duration, last_watched_at, completed')
      .eq('user_id', userId)
      .order('last_watched_at', { ascending: false })

    if (error) {
      console.error('📁 [DATABASE] Error getting all watching progress:', error)
      throw error
    }

    const progress = data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      animeId: row.anime_id,
      season: row.season,
      episode: row.episode,
      currentTime: row.current_time,
      duration: row.duration,
      lastWatchedAt: new Date(row.last_watched_at),
      completed: row.completed
    }))

    console.log('📁 [DATABASE] Found', progress.length, 'watching progress items')
    return progress
  }

  async getAggregatedUserSeriesProgress(userId: string): Promise<any[]> {
    console.log('📁 [DATABASE] Getting aggregated series progress for user:', userId)

    // Use a single query with aggregation to get series progress
    const { data, error } = await this.supabase
      .rpc('get_aggregated_series_progress', {
        p_user_id: userId
      })

    if (error) {
      console.error('📁 [DATABASE] Error getting aggregated series progress:', error)
      // Fallback to application-level aggregation if RPC fails
      console.log('📁 [DATABASE] Falling back to application-level aggregation')
      return this.getAggregatedSeriesProgressFallback(userId)
    }

    console.log('📁 [DATABASE] Found', data.length, 'aggregated series progress items')
    return data
  }

  private async getAggregatedSeriesProgressFallback(userId: string): Promise<any[]> {
    console.log('📁 [DATABASE] Using fallback aggregation method')

    const allProgress = await this.getAllUserWatchingProgress(userId)
    console.log('📁 [DATABASE] Found', allProgress.length, 'raw progress items for fallback aggregation')

    // Group and aggregate in application code - return same format as database function
    const seriesMap = new Map<string, any>()

    for (const progress of allProgress) {
      if (!seriesMap.has(progress.animeId)) {
        seriesMap.set(progress.animeId, {
          anime_id: progress.animeId,
          total_episodes_watched: 0, // This will be count of progress entries with current_time > 0
          completed_episodes: 0,
          last_watched_at: progress.lastWatchedAt,
          latest_season: progress.season,
          latest_episode: progress.episode,
          latest_current_time: progress.currentTime,
          latest_duration: progress.duration
        })
      }

      const series = seriesMap.get(progress.animeId)!

      // Count episodes watched (episodes that have been started - current_time > 0)
      if (progress.currentTime > 0) {
        series.total_episodes_watched++
      }

      // Count completed episodes (90%+ watched)
      if (progress.completed) {
        series.completed_episodes++
      }

      // Track the most recent episode by time (for last_watched_at)
      if (new Date(progress.lastWatchedAt) > new Date(series.last_watched_at)) {
        series.last_watched_at = progress.lastWatchedAt
      }

      // Track the highest episode number (not most recent by time)
      const currentSeasonNum = this.parseSeasonNumber(progress.season)
      const latestSeasonNum = this.parseSeasonNumber(series.latest_season)

      if (currentSeasonNum > latestSeasonNum ||
          (currentSeasonNum === latestSeasonNum && progress.episode > series.latest_episode)) {
        series.latest_season = progress.season
        series.latest_episode = progress.episode
        series.latest_current_time = progress.currentTime
        series.latest_duration = progress.duration
      }
    }

    const result = Array.from(seriesMap.values())
    console.log('📁 [DATABASE] Fallback aggregation produced', result.length, 'series items')
    return result
  }

  // Watched episodes operations
  async markEpisodeWatched(userId: string, animeId: string, season: string, episode: number): Promise<void> {
    console.log('📁 [DATABASE] Marking episode as watched:', { userId, animeId, season, episode })

    const id = crypto.randomUUID()
    const now = new Date()

    const { error } = await this.supabase
      .from('watched_episodes')
      .upsert({
        id,
        user_id: userId,
        anime_id: animeId,
        season,
        episode,
        watched_at: now.toISOString()
      }, {
        onConflict: 'user_id,anime_id,season,episode'
      })

    if (error) {
      console.error('📁 [DATABASE] Error marking episode as watched:', error)
      throw error
    }

    console.log('📁 [DATABASE] Episode marked as watched successfully')
  }

  async unmarkEpisodeWatched(userId: string, animeId: string, season: string, episode: number): Promise<boolean> {
    console.log('📁 [DATABASE] Unmarking episode as watched:', { userId, animeId, season, episode })

    const { error } = await this.supabase
      .from('watched_episodes')
      .delete()
      .eq('user_id', userId)
      .eq('anime_id', animeId)
      .eq('season', season)
      .eq('episode', episode)

    if (error) {
      console.error('📁 [DATABASE] Error unmarking episode as watched:', error)
      return false
    }

    console.log('📁 [DATABASE] Episode unmarked as watched successfully')
    return true
  }

  async getWatchedEpisodes(userId: string, animeId: string): Promise<{ season: string; episode: number; watchedAt: Date }[]> {
    console.log('📁 [DATABASE] Getting watched episodes for series:', { userId, animeId })

    const { data, error } = await this.supabase
      .from('watched_episodes')
      .select('season, episode, watched_at')
      .eq('user_id', userId)
      .eq('anime_id', animeId)
      .order('season')
      .order('episode')

    if (error) {
      console.error('📁 [DATABASE] Error getting watched episodes:', error)
      throw error
    }

    const watchedEpisodes = data.map((row: any) => ({
      season: row.season,
      episode: row.episode,
      watchedAt: new Date(row.watched_at)
    }))

    console.log('📁 [DATABASE] Found', watchedEpisodes.length, 'watched episodes')
    return watchedEpisodes
  }

  async getLatestWatchedEpisode(userId: string, animeId: string): Promise<{ season: string; episode: number; watchedAt: Date } | null> {
    console.log('📁 [DATABASE] Getting latest watched episode for series (highest episode number):', { userId, animeId })

    // Get all watched episodes and find the one with highest episode number
    const allWatched = await this.getWatchedEpisodes(userId, animeId)

    if (allWatched.length === 0) {
      return null
    }

    // Find the episode with the highest season and episode number
    let latestEpisode = allWatched[0]

    for (const episode of allWatched) {
      const currentSeasonNum = this.parseSeasonNumber(episode.season)
      const latestSeasonNum = this.parseSeasonNumber(latestEpisode.season)

      if (currentSeasonNum > latestSeasonNum ||
          (currentSeasonNum === latestSeasonNum && episode.episode > latestEpisode.episode)) {
        latestEpisode = episode
      }
    }

    console.log('📁 [DATABASE] Found latest watched episode (highest number):', latestEpisode.episode)
    return latestEpisode
  }

  private parseSeasonNumber(season: string): number {
    // Try to parse season number from various formats
    const patterns = [
      /saison(\d+)/i,
      /season(\d+)/i,
      /s(\d+)/i
    ]

    for (const pattern of patterns) {
      const match = season.match(pattern)
      if (match) {
        return parseInt(match[1])
      }
    }

    return 0 // Default for unrecognized season formats
  }

  async isEpisodeWatched(userId: string, animeId: string, season: string, episode: number): Promise<boolean> {
    console.log('📁 [DATABASE] Checking if episode is watched:', { userId, animeId, season, episode })

    const { data, error } = await this.supabase
      .from('watched_episodes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('anime_id', animeId)
      .eq('season', season)
      .eq('episode', episode)

    if (error) {
      console.error('📁 [DATABASE] Error checking if episode is watched:', error)
      throw error
    }

    const isWatched = (data || 0) > 0
    console.log('📁 [DATABASE] Episode watched status:', isWatched)
    return isWatched
  }

  async clearWatchedEpisodesForSeries(userId: string, animeId: string): Promise<boolean> {
    console.log('📁 [DATABASE] Clearing all watched episodes for series:', { userId, animeId })

    const { error } = await this.supabase
      .from('watched_episodes')
      .delete()
      .eq('user_id', userId)
      .eq('anime_id', animeId)

    if (error) {
      console.error('📁 [DATABASE] Error clearing watched episodes:', error)
      return false
    }

    console.log('📁 [DATABASE] Watched episodes cleared successfully')
    return true
  }
}