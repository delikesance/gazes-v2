import { DatabaseService } from '../utils/database'

export default defineNitroPlugin(async (nitroApp) => {

  try {
    // Check if required environment variables are available
    const config = useRuntimeConfig()
    if (!config.supabaseUrl || !config.supabaseKey) {
      console.warn('⚠️ [PLUGIN] Missing Supabase environment variables - skipping database initialization')
      return
    }

    // Initialize the database service
    const db = DatabaseService.getInstance()

    // Check database schema with timeout

    const supabase = db.getSupabaseClient()
    let tablesExist = true

    // Check if users table exists with timeout
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database check timeout')), 5000)
      )
      
      const checkPromise = supabase.from('users').select('id').limit(1)
      await Promise.race([checkPromise, timeoutPromise])
    } catch (error: any) {
      if (error.message?.includes('timeout')) {
        console.warn('⚠️ [INIT] Database check timed out - continuing without verification')
      } else if (error.message?.includes('relation "public.users" does not exist') ||
          error.message?.includes('Could not find the table \'public.users\' in the schema cache')) {
        console.warn('⚠️ [INIT] Users table does not exist - running auto migration...')
        tablesExist = false
      } else {
        console.error('❌ [INIT] Unexpected error checking users table:', error.message)
        tablesExist = false
      }
    }

    // Check if watching_progress table exists with timeout
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database check timeout')), 5000)
      )
      
      const checkPromise = supabase.from('watching_progress').select('id').limit(1)
      await Promise.race([checkPromise, timeoutPromise])
    } catch (error: any) {
      if (error.message?.includes('timeout')) {
        console.warn('⚠️ [INIT] Database check timed out - continuing without verification')
      } else if (error.message?.includes('relation "public.watching_progress" does not exist')) {
        console.warn('⚠️ [INIT] Watching progress table does not exist - running auto migration...')
        tablesExist = false
      }
    }

    if (!tablesExist) {
    } else {
    }
  } catch (error) {
    console.error('❌ [PLUGIN] Database plugin failed to initialize:', error)
    // Don't throw the error to prevent the entire app from crashing
  }
})