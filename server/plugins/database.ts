import { initializeDatabase } from '../utils/init-db'

export default defineNitroPlugin((nitroApp) => {
  console.log('🚀 [PLUGIN] Database plugin initializing...')

  const success = initializeDatabase()

  if (success) {
    console.log('✅ [PLUGIN] Database plugin initialized successfully')
  } else {
    console.error('❌ [PLUGIN] Database plugin failed to initialize')
  }
})
