<template>
  <div>
    <AuthForm initial-mode="register" @success="handleSuccess" />
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: false // Use no layout for auth pages
})

const { checkAuth } = useAuth()

const handleSuccess = async (user: any) => {
  console.log('🚀 [REGISTER_PAGE] Registration successful, user:', user.username)
  console.log('🚀 [REGISTER_PAGE] Checking auth status...')

  // Check auth status and redirect
  await checkAuth()
  console.log('🚀 [REGISTER_PAGE] Auth status checked')

  // Redirect to home page
  console.log('🚀 [REGISTER_PAGE] Redirecting to home page')
  await navigateTo('/')
}

// Check if already authenticated
onMounted(async () => {
  console.log('🚀 [REGISTER_PAGE] Page mounted, checking authentication...')

  try {
    const { clearCookies, checkAuth, user } = useAuth()
    console.log('🚀 [REGISTER_PAGE] Clearing leftover cookies...')
    // Clear any leftover cookies first
    clearCookies()

    console.log('🚀 [REGISTER_PAGE] Checking authentication status...')
    await checkAuth()

    if (user.value) {
      console.log('🚀 [REGISTER_PAGE] User already authenticated, redirecting to home')
      await navigateTo('/')
    } else {
      console.log('🚀 [REGISTER_PAGE] User not authenticated, showing register form')
    }
  } catch (error) {
    // If check fails, user is not authenticated - continue to register form
    console.log('🚀 [REGISTER_PAGE] Auth check failed, showing register form')
    console.error('🚀 [REGISTER_PAGE] Auth check error:', error)
  }
})
</script>
