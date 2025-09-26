import { DatabaseService } from './database'

export function initializeDatabase() {
  console.log('🚀 [INIT] Initializing database...')

  try {
    const db = DatabaseService.getInstance()

    // Test the database connection
    const userCount = db.getUserCount()
    console.log('🚀 [INIT] Database connection successful')
    console.log('🚀 [INIT] Current user count:', userCount)

    console.log('✅ [INIT] Database initialization completed successfully')
    return true
  } catch (error) {
    console.error('❌ [INIT] Database initialization failed:', error)
    return false
  }
}
