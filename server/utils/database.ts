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

    // Create index on username for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username
      ON users(username)
    `)

    console.log('📁 [DATABASE] Database schema initialized successfully')
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

    return this.findUserById(id)!
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

  close(): void {
    console.log('📁 [DATABASE] Closing database connection')
    this.db.close()
  }

  // Get database instance for advanced operations
  getDatabase(): Database.Database {
    return this.db
  }
}
