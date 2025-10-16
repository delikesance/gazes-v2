import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {

  try {
    const user = await AuthService.getUserFromRequest(event)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      })
    }

    return {
      success: true,
      user
    }
  } catch (error) {
    console.error('❌ [ME] Error occurred:', error)
    throw error
  }
})