import { clearVideoCache } from '~/server/utils/videoCache'

export default defineEventHandler(async (event) => {
  // Only allow POST requests
  if (getMethod(event) !== 'POST') {
    setResponseStatus(event, 405)
    return { error: 'Method not allowed' }
  }

  // Optional: Add authentication check here if needed
  // const auth = getHeader(event, 'authorization')
  // if (!auth || !auth.startsWith('Bearer ')) {
  //   setResponseStatus(event, 401)
  //   return { error: 'Unauthorized' }
  // }

  try {
    clearVideoCache()
    setResponseStatus(event, 200)
    return {
      success: true,
      message: 'Video cache cleared successfully',
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('Failed to clear cache:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    }
  }
})