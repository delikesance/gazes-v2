import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {

  try {
    // Clear authentication cookies
    AuthService.clearAuthCookies(event)

    return {
      success: true,
      message: 'Déconnexion réussie'
    }
  } catch (error) {
    console.error('❌ [LOGOUT] Error occurred:', error)
    throw error
  }
})