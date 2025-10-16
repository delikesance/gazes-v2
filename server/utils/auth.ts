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
  static async createUser(email: string, username: string, hashedPassword: string): Promise<User> {
    const db = DatabaseService.getInstance()
    const user = await db.createUser(email, username, hashedPassword)

    return user
  }

  /**
   * Find user by email
   */
  static async findUserByEmail(email: string): Promise<(User & { password: string }) | null> {
    const db = DatabaseService.getInstance()
    const user = await db.findUserByEmail(email)
    return user
  }

  /**
    * Find user by ID
    */
  static async findUserById(id: string): Promise<User | null> {
    const db = DatabaseService.getInstance()
    const user = await db.findUserById(id)
    return user
  }  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findUserByEmail(email)
    if (!user) {
      return null
    }

    const isValidPassword = await this.verifyPassword(password, user.password)
    if (!isValidPassword) {
      return null
    }

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  /**
   * Get user from JWT token in request
   */
  static async getUserFromRequest(event: H3Event): Promise<User | null> {
    try {
      const token = getCookie(event, 'accessToken')
      if (!token) {
        return null
      }

      const payload = this.verifyToken(token, 'access')
      const user = await this.findUserById(payload.userId)
      return user
    } catch (error) {
      return null
    }
  }

  /**
   * Set authentication cookies
   */
  static setAuthCookies(event: H3Event, tokens: AuthTokens) {
    const config = useRuntimeConfig()

    setCookie(event, 'accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    setCookie(event, 'refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
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