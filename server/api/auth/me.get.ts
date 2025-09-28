import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  console.log('🔐 [ME] Request received')

  try {
    const user = await AuthService.getUserFromRequest(event)

    if (!user) {
      console.log('❌ [ME] No authenticated user')
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      })
    }

    console.log('✅ [ME] User found:', user.username)
    return {
      success: true,
      user
    }
  } catch (error) {
    console.error('❌ [ME] Error occurred:', error)
    throw error
  }
})