import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { H3Event } from 'h3'
import { DatabaseService } from './database'
import type { User } from './database'

export interface JWTPayload {
  userId: string
  email: string
  username: string
  type: 'access' | 'refresh'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Generate JWT tokens for a user
   */
  static generateTokens(user: User): AuthTokens {
    const config = useRuntimeConfig()

    // Ensure we have valid string values with explicit typing
    const jwtSecret = (config.jwtSecret as string) || 'default-secret'
    const jwtRefreshSecret = (config.jwtRefreshSecret as string) || 'default-refresh-secret'
    const jwtExpiresIn = (config.jwtExpiresIn as string) || '7d'
    const jwtRefreshExpiresIn = (config.jwtRefreshExpiresIn as string) || '30d'

    const accessPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      type: 'access'
    }

    const refreshPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      type: 'refresh'
    }

    // Use explicit type assertion to match the correct overload
    const accessToken = jwt.sign(accessPayload, jwtSecret, {
      expiresIn: jwtExpiresIn,
      issuer: 'gazes-app'
    } as jwt.SignOptions)

    const refreshToken = jwt.sign(refreshPayload, jwtRefreshSecret, {
      expiresIn: jwtRefreshExpiresIn,
      issuer: 'gazes-app'
    } as jwt.SignOptions)

    return { accessToken, refreshToken }
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string, type: 'access' | 'refresh' = 'access'): JWTPayload {
    const config = useRuntimeConfig()
    const secret = type === 'access' ? config.jwtSecret : config.jwtRefreshSecret

    try {
      const decoded = jwt.verify(token, secret, { issuer: 'gazes-app' }) as JWTPayload
      return decoded
    } catch (error) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token'
      })
    }
  }

  /**
   * Create a new user
   */
  static async createUser(email: string, username: string, password: string): Promise<User> {
    console.log('🔐 [AUTH_SERVICE] Creating user:', username, 'with email:', email)

    console.log('🔐 [AUTH_SERVICE] Hashing password...')
    const hashedPassword = await this.hashPassword(password)
    console.log('🔐 [AUTH_SERVICE] Password hashed successfully')

    const db = DatabaseService.getInstance()
    const user = await db.createUser(email, username, hashedPassword)
    console.log('🔐 [AUTH_SERVICE] User created successfully, returning without password')

    return user
  }

  /**
   * Find user by email
   */
  static async findUserByEmail(email: string): Promise<(User & { password: string }) | null> {
    console.log('🔐 [AUTH_SERVICE] Looking for user by email:', email)
    const db = DatabaseService.getInstance()
    const user = await db.findUserByEmail(email)
    console.log('🔐 [AUTH_SERVICE] User found:', user ? 'YES' : 'NO')
    return user
  }

  /**
   * Find user by ID
   */
  static async findUserById(id: string): Promise<User | null> {
    console.log('🔐 [AUTH_SERVICE] Looking for user by ID:', id)
    const db = DatabaseService.getInstance()
    const user = await db.findUserById(id)
    console.log('🔐 [AUTH_SERVICE] User found:', user ? 'YES' : 'NO')
    return user
  }

  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(email: string, password: string): Promise<User | null> {
    console.log('🔐 [AUTH_SERVICE] Attempting to authenticate user:', email)

    const user = await this.findUserByEmail(email)
    if (!user) {
      console.log('❌ [AUTH_SERVICE] User not found:', email)
      return null
    }

    console.log('🔐 [AUTH_SERVICE] User found, verifying password...')
    const isValidPassword = await this.verifyPassword(password, user.password)
    console.log('🔐 [AUTH_SERVICE] Password verification result:', isValidPassword ? 'VALID' : 'INVALID')

    if (!isValidPassword) {
      console.log('❌ [AUTH_SERVICE] Invalid password for user:', email)
      return null
    }

    const { password: _, ...userWithoutPassword } = user
    console.log('✅ [AUTH_SERVICE] Authentication successful for user:', user.username)
    return userWithoutPassword
  }

  /**
   * Get user from JWT token in request
   */
  static async getUserFromRequest(event: H3Event): Promise<User | null> {
    console.log('🔐 [AUTH_SERVICE] Getting user from request...')

    try {
      const token = getCookie(event, 'accessToken')
      console.log('🔐 [AUTH_SERVICE] Access token found:', !!token)

      if (!token) {
        console.log('❌ [AUTH_SERVICE] No access token in request')
        return null
      }

      console.log('🔐 [AUTH_SERVICE] Verifying access token...')
      const payload = this.verifyToken(token, 'access')
      console.log('🔐 [AUTH_SERVICE] Token verified for user ID:', payload.userId)

      console.log('🔐 [AUTH_SERVICE] Finding user by ID...')
      const user = await this.findUserById(payload.userId)
      console.log('🔐 [AUTH_SERVICE] User found from token:', user ? 'YES' : 'NO')

      return user
    } catch (error) {
      console.error('❌ [AUTH_SERVICE] Error getting user from request:', error)
      return null
    }
  }

  /**
   * Set authentication cookies
   */
  static setAuthCookies(event: H3Event, tokens: AuthTokens) {
    const config = useRuntimeConfig()

    // Set HTTP-only cookies for security
    setCookie(event, 'accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    setCookie(event, 'refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    })
  }

  /**
   * Clear authentication cookies
   */
  static clearAuthCookies(event: H3Event) {
    deleteCookie(event, 'accessToken')
    deleteCookie(event, 'refreshToken')
  }
}
