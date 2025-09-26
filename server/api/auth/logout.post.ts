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
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la déconnexion'
    })
  }
})
