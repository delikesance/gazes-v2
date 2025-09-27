import { DatabaseService } from './database'

export async function initializeDatabase() {
  console.log('🚀 [INIT] Initializing Supabase database...')

  try {
    const db = DatabaseService.getInstance()

    // Test the database connection
    const userCount = await db.getUserCount()
    console.log('🚀 [INIT] Database connection successful')
    console.log('🚀 [INIT] Current user count:', userCount)

    console.log('✅ [INIT] Database initialization completed successfully')
    return true
  } catch (error: any) {
    console.error('❌ [INIT] Database initialization failed:', {
      message: error?.message || error?.toString() || 'Unknown error',
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack
    })
    return false
  }
}
