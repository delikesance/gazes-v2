import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {

  try {
    const body = await readBody(event)

    const { email, password } = body

    // Validate input
    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email et mot de passe requis'
      })
    }

    // Authenticate user
    const user = await AuthService.authenticateUser(email, password)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Email ou mot de passe incorrect'
      })
    }

    // Generate tokens
    const tokens = AuthService.generateTokens(user)

    // Set cookies
    AuthService.setAuthCookies(event, tokens)

    return {
      success: true,
      message: 'Connexion réussie',
      user
    }
  } catch (error) {
    console.error('❌ [LOGIN] Error occurred:', error)
    throw error
  }
})