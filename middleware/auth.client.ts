import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware((to) => {
  // Skip auth for public pages
  const publicPages = ['/', '/login', '/register', '/catalogue', '/series', '/movies', '/others', '/anime']
  if (publicPages.includes(to.path)) {
    return
  }

  // Skip auth for watch pages (they can be public)
  if (to.path.startsWith('/watch')) {
    return
  }

  const { isAuthenticated, pending } = useAuth()

  // If auth is still loading, wait
  if (pending.value) {
    return
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated.value) {
    // Store the intended destination
    const redirectCookie = useCookie('redirectAfterLogin')
    redirectCookie.value = to.fullPath

    return navigateTo('/login')
  }
})