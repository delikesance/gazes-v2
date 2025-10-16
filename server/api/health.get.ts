import { getHealthCheckData, updateDbStatus } from '~/server/utils/performance'
import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {
  // Test database connection with proper health check
  try {
    const db = DatabaseService.getInstance()
    const healthResult = await db.healthCheck()

    if (healthResult.status === 'healthy') {
      updateDbStatus('connected')
    } else {
      updateDbStatus('disconnected')
      console.error(`📁 Database unhealthy, latency: ${healthResult.latency}ms`)
    }
  } catch (error) {
    updateDbStatus('disconnected')
    console.error('Database health check failed:', error)
  }

  const healthData = getHealthCheckData()

  // Return appropriate status code based on health
  const statusCode = healthData.status === 'healthy' ? 200 :
                    healthData.status === 'degraded' ? 200 : 503

  setResponseStatus(event, statusCode)

  return healthData
})