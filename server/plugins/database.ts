import { DatabaseService } from '../utils/database'

export default defineNitroPlugin(async (nitroApp) => {
  console.log('🚀 [PLUGIN] Database plugin initializing...')

  try {
    // Initialize the database service
    const db = DatabaseService.getInstance()

    // Check database schema
    console.log('🚀 [INIT] Checking database schema...')

    const supabase = db.getSupabaseClient()
    let tablesExist = true

    // Check if users table exists
    try {
      await supabase.from('users').select('id').limit(1)
      console.log('✅ [INIT] Users table exists')
    } catch (error: any) {
      if (error.message?.includes('relation "public.users" does not exist') ||
          error.message?.includes('Could not find the table \'public.users\' in the schema cache')) {
        console.warn('⚠️ [INIT] Users table does not exist - running auto migration...')
        tablesExist = false
      } else {
        console.error('❌ [INIT] Unexpected error checking users table:', error.message)
        tablesExist = false
      }
    }

    // Check if watching_progress table exists
    try {
      await supabase.from('watching_progress').select('id').limit(1)
      console.log('✅ [INIT] Watching progress table exists')
    } catch (error: any) {
      if (error.message?.includes('relation "public.watching_progress" does not exist')) {
        console.warn('⚠️ [INIT] Watching progress table does not exist - running auto migration...')
        tablesExist = false
      }
    }

    if (!tablesExist) {
      console.log('📋 [INIT] Database tables not found. Please run the migration SQL in your Supabase SQL editor:')
      console.log('   1. database/migrations/001_initial_schema.sql')
      console.log('⚠️ [INIT] App will continue but database operations may fail until migrations are run')
    } else {
      console.log('✅ [INIT] Database schema is ready')
    }
    console.log('✅ [PLUGIN] Database plugin initialized successfully')
  } catch (error) {
    console.error('❌ [PLUGIN] Database plugin failed to initialize:', error)
  }
})