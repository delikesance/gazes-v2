import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  console.log('👤 [ME] Request received - checking authentication')

  try {
    console.log('👤 [ME] Getting user from request...')
    const user = await AuthService.getUserFromRequest(event)
    console.log('👤 [ME] User retrieved:', user ? 'AUTHENTICATED' : 'NOT AUTHENTICATED')

    if (!user) {
      console.log('❌ [ME] No authenticated user found')
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      })
    }

    console.log('✅ [ME] User authenticated successfully:', user.username)
    return {
      success: true,
      user
    }
  } catch (error) {
    console.error('❌ [ME] Error occurred:', error)
    throw error
  }
})
