import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {

  try {
    const refreshToken = getCookie(event, 'refreshToken')

    if (!refreshToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Refresh token manquant'
      })
    }

    // Verify refresh token
    const payload = AuthService.verifyToken(refreshToken, 'refresh')

    // Get user
    const user = await AuthService.findUserById(payload.userId)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Utilisateur non trouvé'
      })
    }

    // Generate new tokens
    const tokens = AuthService.generateTokens(user)

    // Set new cookies
    AuthService.setAuthCookies(event, tokens)

    return {
      success: true,
      message: 'Tokens rafraîchis',
      user
    }
  } catch (error) {
    console.error('❌ [REFRESH] Error occurred:', error)
    throw error
  }
})