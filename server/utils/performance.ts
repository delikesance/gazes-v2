interface PerformanceMetric {
  endpoint: string
  method: string
  duration: number
  statusCode: number
  userAgent?: string
  ip?: string
  timestamp: Date
  error?: string
}

interface PerformanceStats {
  totalRequests: number
  averageResponseTime: number
  errorRate: number
  requestsPerMinute: number
  topEndpoints: Array<{ endpoint: string; count: number; avgDuration: number }>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 10000 // Keep last 10k metrics
  private statsInterval: NodeJS.Timeout

  constructor() {
    // Calculate stats every minute
    this.statsInterval = setInterval(() => {
      this.logStats()
    }, 60 * 1000)
  }

  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>) {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date()
    }

    this.metrics.push(fullMetric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log slow requests (>1 second)
    if (metric.duration > 1000) {
      console.warn('🐌 Slow request detected:', {
        endpoint: metric.endpoint,
        method: metric.method,
        duration: `${metric.duration}ms`,
        statusCode: metric.statusCode
      })
    }

    // Log errors
    if (metric.statusCode >= 400) {
      console.error('❌ Request error:', {
        endpoint: metric.endpoint,
        method: metric.method,
        statusCode: metric.statusCode,
        duration: `${metric.duration}ms`,
        error: metric.error
      })
    }
  }

  getStats(timeWindowMs: number = 5 * 60 * 1000): PerformanceStats {
    const now = Date.now()
    const recentMetrics = this.metrics.filter(m => now - m.timestamp.getTime() < timeWindowMs)

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0,
        topEndpoints: []
      }
    }

    const totalRequests = recentMetrics.length
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0)
    const averageResponseTime = totalDuration / totalRequests

    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length
    const errorRate = (errorCount / totalRequests) * 100

    const requestsPerMinute = (totalRequests / timeWindowMs) * 60 * 1000

    // Calculate top endpoints
    const endpointStats = new Map<string, { count: number; totalDuration: number }>()
    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`
      const existing = endpointStats.get(key) || { count: 0, totalDuration: 0 }
      endpointStats.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + metric.duration
      })
    })

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      requestsPerMinute,
      topEndpoints
    }
  }

  private logStats() {
    const stats = this.getStats()
    console.log({
      totalRequests: stats.totalRequests,
      avgResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
      errorRate: `${stats.errorRate.toFixed(2)}%`,
      requestsPerMinute: stats.requestsPerMinute.toFixed(2),
      topEndpoints: stats.topEndpoints.slice(0, 5).map(e => ({
        endpoint: e.endpoint,
        count: e.count,
        avgDuration: `${e.avgDuration.toFixed(2)}ms`
      }))
    })
  }

  destroy() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
    }
  }
}

// Global performance monitor instance
let performanceMonitor: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor()
  }
  return performanceMonitor
}

// Performance tracking utility
export function trackPerformance(event: any, handler: () => Promise<any>) {
  const startTime = Date.now()
  const monitor = getPerformanceMonitor()

  // Extract request info
  const url = getRequestURL(event)
  const method = event.node.req.method || 'GET'
  const endpoint = url.pathname

  // Get client info
  const userAgent = getHeader(event, 'user-agent')
  const forwarded = getHeader(event, 'x-forwarded-for')
  const realIP = getHeader(event, 'x-real-ip')
  const cfIP = getHeader(event, 'cf-connecting-ip')
  const clientIP = (forwarded || realIP || cfIP || event.node.req.socket?.remoteAddress || 'unknown') as string

  return handler()
    .then((result) => {
      const duration = Date.now() - startTime
      monitor.recordMetric({
        endpoint,
        method,
        duration,
        statusCode: getResponseStatus(event) || 200,
        userAgent,
        ip: clientIP
      })
      return result
    })
    .catch((error) => {
      const duration = Date.now() - startTime
      monitor.recordMetric({
        endpoint,
        method,
        duration,
        statusCode: error.statusCode || 500,
        userAgent,
        ip: clientIP,
        error: error.message || 'Unknown error'
      })
      throw error
    })
}

// Health check endpoint data
export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  performance: PerformanceStats
  database: {
    status: 'connected' | 'disconnected'
    lastCheck: Date
  }
}

let startTime = Date.now()
let lastDbCheck = new Date()
let dbStatus: 'connected' | 'disconnected' = 'disconnected'

export function updateDbStatus(status: 'connected' | 'disconnected') {
  dbStatus = status
  lastDbCheck = new Date()
}

export function getHealthCheckData(): HealthCheckData {
  const monitor = getPerformanceMonitor()
  const stats = monitor.getStats()

  // Memory usage (Node.js)
  const memUsage = process.memoryUsage()
  const totalMem = memUsage.heapTotal
  const usedMem = memUsage.heapUsed
  const memPercentage = (usedMem / totalMem) * 100

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (stats.errorRate > 10 || dbStatus === 'disconnected') {
    status = 'unhealthy'
  } else if (stats.errorRate > 5 || stats.averageResponseTime > 2000) {
    status = 'degraded'
  }

  return {
    status,
    timestamp: new Date(),
    uptime: Date.now() - startTime,
    memory: {
      used: usedMem,
      total: totalMem,
      percentage: memPercentage
    },
    performance: stats,
    database: {
      status: dbStatus,
      lastCheck: lastDbCheck
    }
  }
}