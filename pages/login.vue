<template>
  <div class="login-page">
    <AuthForm initial-mode="login" @success="handleSuccess" />
  </div>
</template>

<script setup lang="ts">
const handleSuccess = (user: any) => {

  // Check for redirect cookie
  const redirectCookie = useCookie('redirectAfterLogin')
  const redirectTo = redirectCookie.value || '/'

  // Clear the cookie
  redirectCookie.value = null

  // Redirect to intended page or home
  navigateTo(redirectTo)
}
</script>

<style scoped>
.login-page {
  @apply min-h-screen bg-zinc-900;
}
</style>