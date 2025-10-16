import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {

  try {
    const body = await readBody(event)

    const { email, username, password } = body

    // Validate input
    if (!email || !username || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email, nom d\'utilisateur et mot de passe requis'
      })
    }

    // Basic validation
    if (password.length < 6) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le mot de passe doit contenir au moins 6 caractères'
      })
    }

    // Create user
    const user = await AuthService.createUser(email, username, password)

    // Generate tokens
    const tokens = AuthService.generateTokens(user)

    // Set cookies
    AuthService.setAuthCookies(event, tokens)

    return {
      success: true,
      message: 'Inscription réussie',
      user
    }
  } catch (error: any) {
    console.error('❌ [REGISTER] Error occurred:', error)

    // Handle specific database errors
    if (error.message?.includes('already exists')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Un utilisateur avec cet email existe déjà'
      })
    }

    throw error
  }
})