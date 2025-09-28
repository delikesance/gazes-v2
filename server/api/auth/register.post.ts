import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  console.log('👤 [REGISTER] Request received')

  try {
    const body = await readBody(event)
    console.log('👤 [REGISTER] Request body:', { email: body.email, username: body.username, hasPassword: !!body.password })

    const { email, username, password } = body

    // Validate input
    console.log('👤 [REGISTER] Validating input...')
    if (!email || !username || !password) {
      console.log('❌ [REGISTER] Missing required fields')
      throw createError({
        statusCode: 400,
        statusMessage: 'Email, nom d\'utilisateur et mot de passe requis'
      })
    }

    // Basic validation
    if (password.length < 6) {
      console.log('❌ [REGISTER] Password too short')
      throw createError({
        statusCode: 400,
        statusMessage: 'Le mot de passe doit contenir au moins 6 caractères'
      })
    }

    // Create user
    console.log('👤 [REGISTER] Creating user:', username, 'with email:', email)
    const user = await AuthService.createUser(email, username, password)
    console.log('👤 [REGISTER] User created successfully')

    // Generate tokens
    console.log('👤 [REGISTER] Generating tokens for new user:', user.username)
    const tokens = AuthService.generateTokens(user)
    console.log('👤 [REGISTER] Tokens generated successfully')

    // Set cookies
    console.log('👤 [REGISTER] Setting authentication cookies')
    AuthService.setAuthCookies(event, tokens)
    console.log('👤 [REGISTER] Cookies set successfully')

    console.log('✅ [REGISTER] Registration successful for user:', user.username)
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