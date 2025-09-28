import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  console.log('🚪 [LOGOUT] Request received')

  try {
    // Clear authentication cookies
    console.log('🚪 [LOGOUT] Clearing authentication cookies')
    AuthService.clearAuthCookies(event)
    console.log('🚪 [LOGOUT] Cookies cleared successfully')

    console.log('✅ [LOGOUT] Logout successful')
    return {
      success: true,
      message: 'Déconnexion réussie'
    }
  } catch (error) {
    console.error('❌ [LOGOUT] Error occurred:', error)
    throw error
  }
})