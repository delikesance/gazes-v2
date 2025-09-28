import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  console.log('🔄 [REFRESH] Request received')

  try {
    const refreshToken = getCookie(event, 'refreshToken')
    console.log('🔄 [REFRESH] Refresh token found:', !!refreshToken)

    if (!refreshToken) {
      console.log('❌ [REFRESH] No refresh token')
      throw createError({
        statusCode: 401,
        statusMessage: 'Refresh token manquant'
      })
    }

    // Verify refresh token
    console.log('🔄 [REFRESH] Verifying refresh token...')
    const payload = AuthService.verifyToken(refreshToken, 'refresh')
    console.log('🔄 [REFRESH] Refresh token verified for user ID:', payload.userId)

    // Get user
    console.log('🔄 [REFRESH] Finding user by ID...')
    const user = await AuthService.findUserById(payload.userId)
    if (!user) {
      console.log('❌ [REFRESH] User not found')
      throw createError({
        statusCode: 401,
        statusMessage: 'Utilisateur non trouvé'
      })
    }

    // Generate new tokens
    console.log('🔄 [REFRESH] Generating new tokens...')
    const tokens = AuthService.generateTokens(user)
    console.log('🔄 [REFRESH] New tokens generated')

    // Set new cookies
    console.log('🔄 [REFRESH] Setting new authentication cookies')
    AuthService.setAuthCookies(event, tokens)
    console.log('🔄 [REFRESH] Cookies set successfully')

    console.log('✅ [REFRESH] Token refresh successful for user:', user.username)
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