import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  console.log('🔐 [LOGIN] Request received')

  try {
    const body = await readBody(event)
    console.log('🔐 [LOGIN] Request body:', { email: body.email, hasPassword: !!body.password })

    const { email, password } = body

    // Validate input
    console.log('🔐 [LOGIN] Validating input...')
    if (!email || !password) {
      console.log('❌ [LOGIN] Missing email or password')
      throw createError({
        statusCode: 400,
        statusMessage: 'Email et mot de passe requis'
      })
    }

    // Authenticate user
    console.log('🔐 [LOGIN] Attempting to authenticate user:', email)
    const user = await AuthService.authenticateUser(email, password)
    console.log('🔐 [LOGIN] Authentication result:', user ? 'SUCCESS' : 'FAILED')

    if (!user) {
      console.log('❌ [LOGIN] Invalid credentials for user:', email)
      throw createError({
        statusCode: 401,
        statusMessage: 'Email ou mot de passe incorrect'
      })
    }

    // Generate tokens
    console.log('🔐 [LOGIN] Generating tokens for user:', user.username)
    const tokens = AuthService.generateTokens(user)
    console.log('🔐 [LOGIN] Tokens generated successfully')

    // Set cookies
    console.log('🔐 [LOGIN] Setting authentication cookies')
    AuthService.setAuthCookies(event, tokens)
    console.log('🔐 [LOGIN] Cookies set successfully')

    console.log('✅ [LOGIN] Login successful for user:', user.username)
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