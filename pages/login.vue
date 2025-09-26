<template>
  <div>
    <AuthForm initial-mode="login" @success="handleSuccess" />
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: false // Use no layout for auth pages
})

const { checkAuth } = useAuth()

const handleSuccess = async (user: any) => {
  console.log('🚀 [LOGIN_PAGE] Login successful, user:', user.username)
  console.log('🚀 [LOGIN_PAGE] Checking auth status...')

  // Check auth status and redirect
  await checkAuth()
  console.log('🚀 [LOGIN_PAGE] Auth status checked')

  // Redirect to home page or intended destination
  const intendedPath = useCookie('redirectAfterLogin').value || '/'
  console.log('🚀 [LOGIN_PAGE] Redirecting to:', intendedPath)
  await navigateTo(intendedPath)

  // Clear the redirect cookie
  const redirectCookie = useCookie('redirectAfterLogin')
  redirectCookie.value = null
  console.log('🚀 [LOGIN_PAGE] Redirect cookie cleared')
}

// Check if already authenticated
onMounted(async () => {
  console.log('🚀 [LOGIN_PAGE] Page mounted, checking authentication...')

  try {
    const { clearCookies, checkAuth, user } = useAuth()
    console.log('🚀 [LOGIN_PAGE] Clearing leftover cookies...')
    // Clear any leftover cookies first
    clearCookies()

    console.log('🚀 [LOGIN_PAGE] Checking authentication status...')
    await checkAuth()

    if (user.value) {
      console.log('🚀 [LOGIN_PAGE] User already authenticated, redirecting to home')
      await navigateTo('/')
    } else {
      console.log('🚀 [LOGIN_PAGE] User not authenticated, showing login form')
    }
  } catch (error) {
    // If check fails, user is not authenticated - continue to login form
    console.log('🚀 [LOGIN_PAGE] Auth check failed, showing login form')
    console.error('🚀 [LOGIN_PAGE] Auth check error:', error)
  }
})
</script>
