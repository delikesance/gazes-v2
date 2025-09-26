import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  console.log('👤 [REGISTER] Request received')

  try {
    const body = await readBody(event)
    console.log('👤 [REGISTER] Request body:', {
      email: body.email,
      username: body.username,
      hasPassword: !!body.password
    })

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

    // Validate email format
    console.log('👤 [REGISTER] Validating email format...')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.log('❌ [REGISTER] Invalid email format:', email)
      throw createError({
        statusCode: 400,
        statusMessage: 'Format d\'email invalide'
      })
    }

    // Validate password strength
    console.log('👤 [REGISTER] Validating password strength...')
    if (password.length < 6) {
      console.log('❌ [REGISTER] Password too short:', password.length, 'characters')
      throw createError({
        statusCode: 400,
        statusMessage: 'Le mot de passe doit contenir au moins 6 caractères'
      })
    }

    // Validate username length
    console.log('👤 [REGISTER] Validating username length...')
    if (username.length < 3 || username.length > 50) {
      console.log('❌ [REGISTER] Invalid username length:', username.length)
      throw createError({
        statusCode: 400,
        statusMessage: 'Le nom d\'utilisateur doit contenir entre 3 et 50 caractères'
      })
    }

    // Create user
    console.log('👤 [REGISTER] Creating user:', username, 'with email:', email)
    const user = await AuthService.createUser(email, username, password)
    console.log('👤 [REGISTER] User created successfully:', user.username)

    // Generate tokens
    console.log('👤 [REGISTER] Generating tokens...')
    const tokens = AuthService.generateTokens(user)
    console.log('👤 [REGISTER] Tokens generated successfully')

    // Set cookies
    console.log('👤 [REGISTER] Setting authentication cookies')
    AuthService.setAuthCookies(event, tokens)
    console.log('👤 [REGISTER] Cookies set successfully')

    console.log('✅ [REGISTER] Registration successful for user:', user.username)
    return {
      success: true,
      message: 'Compte créé avec succès',
      user
    }
  } catch (error) {
    console.error('❌ [REGISTER] Error occurred:', error)
    throw error
  }
})
