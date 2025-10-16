import { ref, computed } from 'vue'

interface UserResponse {
  id: string
  email: string
  username: string
  createdAt: string
  updatedAt: string
}

interface AuthResponse {
  success: boolean
  message: string
  user: UserResponse
}

interface AuthState {
  user: UserResponse | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

const authState = ref<AuthState>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null
})

export const useAuth = () => {
  const isAuthenticated = computed(() => !!authState.value.user)

  const login = async (email: string, password: string) => {
    authState.value.isLoading = true
    authState.value.error = null

    try {
      const data = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })

      if (!data.user) {
        console.error('❌ [CLIENT] No user in data:', data)
        throw new Error('No user in response data')
      }

      authState.value.user = data.user
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
      return { success: false, error: authState.value.error }
    } finally {
      authState.value.isLoading = false
    }
  }

  const register = async (email: string, username: string, password: string) => {
    authState.value.isLoading = true
    authState.value.error = null

    try {
      const data = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { email, username, password }
      })

      if (!data.user) {
        console.error('❌ [CLIENT] No user in data:', data)
        throw new Error('No user in response data')
      }

      authState.value.user = data.user
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
      return { success: false, error: authState.value.error }
    } finally {
      authState.value.isLoading = false
    }
  }

  const logout = async () => {
    authState.value.isLoading = true

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
      authState.value.isLoading = false
    }
  }

  const refreshToken = async () => {
    try {
      const data = await $fetch('/api/auth/refresh', {
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
    authState.value.isLoading = true

    try {
      const data = await $fetch('/api/auth/me')

      authState.value.user = data.user || null
      if (data.user) {
        return { success: true, user: data.user }
      } else {
        return { success: true, user: null }
      }
    } catch (error: any) {
      authState.value.user = null
      return { success: false, error: error.data?.message || error.message }
    } finally {
      authState.value.isLoading = false
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
    loading: computed(() => authState.value.isLoading),
    pending: computed(() => authState.value.isLoading), // Alias for loading
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