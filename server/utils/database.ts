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

  async getAllUsers(): Promise<User[]> {
    console.log('📁 [DATABASE] Getting all users')

    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, username, created_at, updated_at')
      .order('created_at', { ascending: false })

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

    console.log('📁 [DATABASE] Found', users.length, 'users')
    return users
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

  async getUserContinueWatching(userId: string, limit: number = 20): Promise<WatchingProgress[]> {
    console.log('📁 [DATABASE] Getting continue watching for user:', userId)

    const { data, error } = await this.supabase
      .from('watching_progress')
      .select('id, user_id, anime_id, season, episode, current_time, duration, last_watched_at, completed')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('last_watched_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('📁 [DATABASE] Error getting continue watching:', error)
      throw error
    }

    const progress: WatchingProgress[] = data.map((row: any) => ({
      id: String(row.id),
      userId: String(row.user_id),
      animeId: String(row.anime_id),
      season: String(row.season),
      episode: Number(row.episode),
      currentTime: Number(row.current_time),
      duration: Number(row.duration),
      lastWatchedAt: new Date(row.last_watched_at),
      completed: Boolean(row.completed)
    }))

    console.log('📁 [DATABASE] Found', progress.length, 'continue watching items')
    return progress
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

  async markAsCompleted(userId: string, animeId: string, season: string, episode: number): Promise<boolean> {
    console.log('📁 [DATABASE] Marking episode as completed:', { userId, animeId, season, episode })

    const { error } = await this.supabase
      .from('watching_progress')
      .update({
        completed: true,
        last_watched_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('anime_id', animeId)
      .eq('season', season)
      .eq('episode', episode)

    if (error) {
      console.error('📁 [DATABASE] Error marking episode as completed:', error)
      return false
    }

    console.log('📁 [DATABASE] Episode marked as completed successfully')
    return true
  }

  // Execute raw SQL (for migrations)
  async executeSql(sql: string): Promise<void> {
    console.log('📁 [DATABASE] Executing SQL:', sql.substring(0, 100) + '...')
    const { error } = await this.supabase.rpc('exec_sql', { sql })
    if (error) {
      throw error
    }
  }
}