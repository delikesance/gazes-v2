import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // This endpoint can be used for health checks or general auth status
  const user = await AuthService.getUserFromRequest(event)

  return {
    authenticated: !!user,
    timestamp: new Date().toISOString()
  }
})
