// Optimized logging utility for video resolver

export interface LoggerOptions {
  prefix: string
  debug: boolean
  level: 'info' | 'warn' | 'error'
}

export class Logger {
  private prefix: string
  private debug: boolean
  
  constructor(prefix: string, debug = false) {
    this.prefix = prefix
    this.debug = debug
  }

  info(message: string, ...args: any[]): void {
    if (this.debug) {
      console.info(`${this.prefix} ${message}`, ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix} ${message}`, ...args)
  }

  error(message: string, ...args: any[]): void {
    console.error(`${this.prefix} ${message}`, ...args)
  }

  // Always log these regardless of debug mode
  always(message: string, ...args: any[]): void {
    console.info(`${this.prefix} ${message}`, ...args)
  }

  // Performance-optimized debug logging
  debugGroup(label: string, fn: () => void): void {
    if (!this.debug) return
    
    console.group(`${this.prefix} ${label}`)
    try {
      fn()
    } finally {
      console.groupEnd()
    }
  }

  // Conditional logging with lazy evaluation
  debugIf(condition: boolean, messageFactory: () => string, ...args: any[]): void {
    if (this.debug && condition) {
      console.info(`${this.prefix} ${messageFactory()}`, ...args)
    }
  }

  // Log timing information
  time(label: string): () => void {
    const start = performance.now()
    return () => {
      if (this.debug) {
        const duration = (performance.now() - start).toFixed(2)
        console.info(`${this.prefix} ${label}: ${duration}ms`)
      }
    }
  }
}

// Create logger factory
export function createLogger(prefix: string, debug = false): Logger {
  return new Logger(`[${prefix}]`, debug)
}