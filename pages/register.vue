<template>
  <div class="register-page">
    <AuthForm initial-mode="register" @success="handleSuccess" />
  </div>
</template>

<script setup lang="ts">
const handleSuccess = (user: any) => {
  console.log('Registration successful:', user)

  // Redirect to home page after successful registration
  navigateTo('/')
}
</script>

<style scoped>
.register-page {
  @apply min-h-screen bg-zinc-900;
}
</style>