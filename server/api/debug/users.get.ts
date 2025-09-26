import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {
  console.log('🔍 [DEBUG] Getting all users from database')

  try {
    const db = DatabaseService.getInstance()
    const users = db.getAllUsers()
    const userCount = db.getUserCount()

    console.log('🔍 [DEBUG] Retrieved', users.length, 'users')

    return {
      success: true,
      userCount,
      users: users.map(user => ({
        ...user,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString()
      }))
    }
  } catch (error) {
    console.error('❌ [DEBUG] Error getting users:', error)
    const err = error as Error
    console.error('❌ [DEBUG] Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    })
    throw createError({
      statusCode: 500,
      statusMessage: 'Database error',
      message: err.message
    })
  }
})
