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

    // Get user from refresh token
    const user = await AuthService.findUserById(payload.userId)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Utilisateur non trouvé'
      })
    }

    // Generate new tokens
    const tokens = AuthService.generateTokens(user)

    // Set new cookies (refresh token stays the same)
    setCookie(event, 'accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    return {
      success: true,
      message: 'Token rafraîchi avec succès',
      user
    }
  } catch (error) {
    // Clear cookies on error
    AuthService.clearAuthCookies(event)
    throw error
  }
})
