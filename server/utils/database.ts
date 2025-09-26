import Database from 'better-sqlite3'
import path from 'path'

export interface User {
  id: string
  email: string
  username: string
  createdAt: Date
  updatedAt: Date
}

export interface UserWithPassword extends User {
  password: string
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
}

export class DatabaseService {
  private static instance: DatabaseService
  private db: Database.Database

  private constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'gaze.db')
    console.log('📁 [DATABASE] Opening database at:', dbPath)

    this.db = new Database(dbPath)
    this.initDatabase()
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  private initDatabase() {
    console.log('📁 [DATABASE] Initializing database schema...')

    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create index on email for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email)
    `)

    // Create watching progress table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watching_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        anime_id TEXT NOT NULL,
        season TEXT NOT NULL,
        episode INTEGER NOT NULL,
        current_time REAL NOT NULL DEFAULT 0,
        duration REAL NOT NULL DEFAULT 0,
        last_watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, anime_id, season, episode)
      )
    `)

    // Create index on user_id for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_watching_progress_user_id
      ON watching_progress(user_id)
    `)

    // Create index on last_watched_at for sorting recent progress
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_watching_progress_last_watched
      ON watching_progress(last_watched_at DESC)
    `)
  }

  // User operations
  async createUser(email: string, username: string, hashedPassword: string): Promise<User> {
    console.log('📁 [DATABASE] Creating user:', username, 'with email:', email)

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, username, password)
      VALUES (?, ?, ?, ?)
    `)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    try {
      stmt.run(id, email, username, hashedPassword)
      console.log('📁 [DATABASE] User created successfully with ID:', id)

      return {
        id,
        email,
        username,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    } catch (error: any) {
      console.error('📁 [DATABASE] Error creating user:', error)
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('User with this email already exists')
      }
      throw error
    }
  }

  async findUserByEmail(email: string): Promise<UserWithPassword | null> {
    console.log('📁 [DATABASE] Looking for user by email:', email)

    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?')
    const user = stmt.get(email) as UserWithPassword | undefined

    if (user) {
      console.log('📁 [DATABASE] User found:', user.username)
    } else {
      console.log('📁 [DATABASE] User not found:', email)
    }

    return user || null
  }

  async findUserById(id: string): Promise<User | null> {
    console.log('📁 [DATABASE] Looking for user by ID:', id)

    const stmt = this.db.prepare('SELECT id, email, username, created_at, updated_at FROM users WHERE id = ?')
    const user = stmt.get(id) as User | undefined

    if (user) {
      console.log('📁 [DATABASE] User found:', user.username)
    } else {
      console.log('📁 [DATABASE] User not found:', id)
    }

    return user || null
  }

  async findUserByUsername(username: string): Promise<UserWithPassword | null> {
    console.log('📁 [DATABASE] Looking for user by username:', username)

    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?')
    const user = stmt.get(username) as UserWithPassword | undefined

    if (user) {
      console.log('📁 [DATABASE] User found:', user.username)
    } else {
      console.log('📁 [DATABASE] User not found:', username)
    }

    return user || null
  }

  async updateUser(id: string, updates: Partial<User & { password?: string }>): Promise<User> {
    console.log('📁 [DATABASE] Updating user:', id)

    const updateFields: string[] = []
    const values: any[] = []

    if (updates.email !== undefined) {
      updateFields.push('email = ?')
      values.push(updates.email)
    }

    if (updates.username !== undefined) {
      updateFields.push('username = ?')
      values.push(updates.username)
    }

    if (updates.password !== undefined) {
      updateFields.push('password = ?')
      values.push(updates.password)
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(id)

      const stmt = this.db.prepare(`
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)

      stmt.run(...values)
      console.log('📁 [DATABASE] User updated successfully')
    }

    const updatedUser = await this.findUserById(id)
    if (!updatedUser) {
      throw new Error(`User with ID ${id} not found after update`)
    }
    return updatedUser
  }

  async deleteUser(id: string): Promise<boolean> {
    console.log('📁 [DATABASE] Deleting user:', id)

    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?')
    const result = stmt.run(id)

    const success = result.changes > 0
    console.log('📁 [DATABASE] User deleted:', success ? 'YES' : 'NO')

    return success
  }

  getAllUsers(): User[] {
    console.log('📁 [DATABASE] Getting all users')

    const stmt = this.db.prepare('SELECT id, email, username, created_at, updated_at FROM users ORDER BY created_at DESC')
    const users = stmt.all() as User[]

    console.log('📁 [DATABASE] Found', users.length, 'users')
    return users
  }

  getUserCount(): number {
    console.log('📁 [DATABASE] Getting user count')

    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users')
    const result = stmt.get() as { count: number }

    console.log('📁 [DATABASE] User count:', result.count)
    return result.count
  }

  // Watching progress operations
  async saveWatchingProgress(userId: string, animeId: string, season: string, episode: number, currentTime: number, duration: number): Promise<WatchingProgress> {
    console.log('📁 [DATABASE] Saving watching progress:', { userId, animeId, season, episode, currentTime, duration })

    const completed = duration > 0 && currentTime >= duration * 0.9 // Consider completed if watched 90%
    const now = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO watching_progress
      (id, user_id, anime_id, season, episode, current_time, duration, last_watched_at, completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const id = crypto.randomUUID()

    stmt.run(id, userId, animeId, season, episode, currentTime, duration, now, completed ? 1 : 0)

    console.log('📁 [DATABASE] Watching progress saved successfully')

    return {
      id,
      userId,
      animeId,
      season,
      episode,
      currentTime,
      duration,
      lastWatchedAt: new Date(now),
      completed
    }
  }

  async getWatchingProgress(userId: string, animeId: string, season: string, episode: number): Promise<WatchingProgress | null> {
    console.log('📁 [DATABASE] Getting watching progress:', { userId, animeId, season, episode })

    const stmt = this.db.prepare(`
      SELECT * FROM watching_progress
      WHERE user_id = ? AND anime_id = ? AND season = ? AND episode = ?
    `)

    const row = stmt.get(userId, animeId, season, episode) as any

    if (row) {
      console.log('📁 [DATABASE] Found watching progress:', row.current_time, '/', row.duration)
      return {
        id: row.id,
        userId: row.user_id,
        animeId: row.anime_id,
        season: row.season,
        episode: row.episode,
        currentTime: row.current_time,
        duration: row.duration,
        lastWatchedAt: new Date(row.last_watched_at),
        completed: Boolean(row.completed)
      }
    }

    console.log('📁 [DATABASE] No watching progress found')
    return null
  }

  async getUserContinueWatching(userId: string, limit: number = 20): Promise<WatchingProgress[]> {
    console.log('📁 [DATABASE] Getting continue watching for user:', userId)

    const stmt = this.db.prepare(`
      SELECT * FROM watching_progress
      WHERE user_id = ? AND completed = FALSE
      ORDER BY last_watched_at DESC
      LIMIT ?
    `)

    const rows = stmt.all(userId, limit) as any[]

    const progress = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      animeId: row.anime_id,
      season: row.season,
      episode: row.episode,
      currentTime: row.current_time,
      duration: row.duration,
      lastWatchedAt: new Date(row.last_watched_at),
      completed: Boolean(row.completed)
    }))

    console.log('📁 [DATABASE] Found', progress.length, 'continue watching items')
    return progress
  }

  async deleteWatchingProgress(userId: string, animeId: string, season: string, episode: number): Promise<boolean> {
    console.log('📁 [DATABASE] Deleting watching progress:', { userId, animeId, season, episode })

    const stmt = this.db.prepare(`
      DELETE FROM watching_progress
      WHERE user_id = ? AND anime_id = ? AND season = ? AND episode = ?
    `)

    const result = stmt.run(userId, animeId, season, episode)
    const deleted = result.changes > 0

    console.log('📁 [DATABASE] Watching progress deleted:', deleted)
    return deleted
  }

  async markAsCompleted(userId: string, animeId: string, season: string, episode: number): Promise<boolean> {
    console.log('📁 [DATABASE] Marking episode as completed:', { userId, animeId, season, episode })

    const stmt = this.db.prepare(`
      UPDATE watching_progress
      SET completed = TRUE, last_watched_at = ?
      WHERE user_id = ? AND anime_id = ? AND season = ? AND episode = ?
    `)

    const result = stmt.run(new Date().toISOString(), userId, animeId, season, episode)
    const updated = result.changes > 0

    console.log('📁 [DATABASE] Episode marked as completed:', updated)
    return updated
  }

  close(): void {
    console.log('📁 [DATABASE] Closing database connection')
    this.db.close()
  }

  // Get database instance for advanced operations
  getDatabase(): Database.Database {
    return this.db
  }
}
