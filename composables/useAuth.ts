import { ref, computed } from 'vue'
import type { User } from '~/server/utils/auth'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

const authState = ref<AuthState>({
  user: null,
  loading: false,
  error: null
})

export const useAuth = () => {
  const isAuthenticated = computed(() => !!authState.value.user)

  const login = async (email: string, password: string) => {
    console.log('🔐 [CLIENT] Login attempt for email:', email)
    authState.value.loading = true
    authState.value.error = null

    try {
      console.log('🔐 [CLIENT] Sending login request...')
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })
      console.log('🔐 [CLIENT] Raw response received:', response)
      console.log('🔐 [CLIENT] Response type:', typeof response)

      // Handle different response formats
      let data;
      if (response && typeof response === 'object' && 'data' in response) {
        data = response.data;
        console.log('🔐 [CLIENT] Found data property:', data)
      } else {
        data = response;
        console.log('🔐 [CLIENT] Using response as data:', data)
      }

      if (!data) {
        console.error('❌ [CLIENT] No data in response:', response)
        throw new Error('No data in response')
      }

      console.log('🔐 [CLIENT] Final data object:', data)

      if (!data.user) {
        console.error('❌ [CLIENT] No user in data:', data)
        throw new Error('No user in response data')
      }

      authState.value.user = data.user
      console.log('✅ [CLIENT] Login successful for user:', data.user.username)
      return { success: true, user: data.user }
    } catch (error: any) {
      console.error('❌ [CLIENT] Login failed:', error)
      console.error('❌ [CLIENT] Error details:', {
        name: error.name,
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        data: error.data
      })
      authState.value.error = error.data?.message || error.message || 'Erreur de connexion'
      console.log('❌ [CLIENT] Error message:', authState.value.error)
      return { success: false, error: authState.value.error }
    } finally {
      authState.value.loading = false
      console.log('🔐 [CLIENT] Login process completed')
    }
  }

  const register = async (email: string, username: string, password: string) => {
    console.log('👤 [CLIENT] Registration attempt for:', username, 'with email:', email)
    authState.value.loading = true
    authState.value.error = null

    try {
      console.log('👤 [CLIENT] Sending registration request...')
      const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { email, username, password }
      })
      console.log('👤 [CLIENT] Raw response received:', response)
      console.log('👤 [CLIENT] Response type:', typeof response)

      // Handle different response formats
      let data;
      if (response && typeof response === 'object' && 'data' in response) {
        data = response.data;
        console.log('👤 [CLIENT] Found data property:', data)
      } else {
        data = response;
        console.log('👤 [CLIENT] Using response as data:', data)
      }

      if (!data) {
        console.error('❌ [CLIENT] No data in response:', response)
        throw new Error('No data in response')
      }

      console.log('👤 [CLIENT] Final data object:', data)

      if (!data.user) {
        console.error('❌ [CLIENT] No user in data:', data)
        throw new Error('No user in response data')
      }

      authState.value.user = data.user
      console.log('✅ [CLIENT] Registration successful for user:', data.user.username)
      return { success: true, user: data.user }
    } catch (error: any) {
      console.error('❌ [CLIENT] Registration failed:', error)
      console.error('❌ [CLIENT] Error details:', {
        name: error.name,
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        data: error.data
      })
      authState.value.error = error.data?.message || error.message || 'Erreur d\'inscription'
      console.log('❌ [CLIENT] Final error message:', authState.value.error)
      return { success: false, error: authState.value.error }
    } finally {
      authState.value.loading = false
      console.log('👤 [CLIENT] Registration process completed')
    }
  }

  const logout = async () => {
    authState.value.loading = true

    try {
      await $fetch('/api/auth/logout', {
        method: 'POST'
      })

      authState.value.user = null
      return { success: true }
    } catch (error: any) {
      // Even if logout fails, clear local state
      authState.value.user = null
      return { success: false, error: error.data?.message }
    } finally {
      authState.value.loading = false
    }
  }

  const refreshToken = async () => {
    try {
      const { data } = await $fetch('/api/auth/refresh', {
        method: 'POST'
      })

      authState.value.user = data.user
      return { success: true, user: data.user }
    } catch (error: any) {
      // If refresh fails, user needs to login again
      authState.value.user = null
      return { success: false, error: error.data?.message }
    }
  }

  const checkAuth = async () => {
    console.log('🔐 [CLIENT] Checking authentication status...')
    authState.value.loading = true

    try {
      console.log('🔐 [CLIENT] Sending auth check request...')
      const response = await $fetch('/api/auth/me')
      console.log('🔐 [CLIENT] Raw auth check response:', response)
      console.log('🔐 [CLIENT] Response type:', typeof response)

      // Handle different response formats
      let data;
      if (response && typeof response === 'object' && 'data' in response) {
        data = response.data;
        console.log('🔐 [CLIENT] Found data property:', data)
      } else {
        data = response;
        console.log('🔐 [CLIENT] Using response as data:', data)
      }

      if (!data) {
        console.error('❌ [CLIENT] No data in auth check response:', response)
        throw new Error('No data in response')
      }

      console.log('🔐 [CLIENT] Final auth check data:', data)

      authState.value.user = data.user || null
      if (data.user) {
        console.log('✅ [CLIENT] Auth check successful, user found:', data.user.username)
        return { success: true, user: data.user }
      } else {
        console.log('🔐 [CLIENT] Auth check successful, no authenticated user')
        return { success: true, user: null }
      }
    } catch (error: any) {
      console.log('❌ [CLIENT] Auth check failed:', error.data?.message || error.message)
      authState.value.user = null
      return { success: false, error: error.data?.message || error.message }
    } finally {
      authState.value.loading = false
      console.log('🔐 [CLIENT] Auth check process completed')
    }
  }

  const clearError = () => {
    authState.value.error = null
  }

  const clearCookies = () => {
    if (process.client) {
      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    }
  }

  return {
    // State
    user: computed(() => authState.value.user),
    loading: computed(() => authState.value.loading),
    error: computed(() => authState.value.error),
    isAuthenticated,

    // Actions
    login,
    register,
    logout,
    refreshToken,
    checkAuth,
    clearError,
    clearCookies
  }
}
