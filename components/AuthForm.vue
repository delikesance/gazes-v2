<template>
  <div class="auth-form">
    <div class="auth-form__container">
      <!-- Header -->
      <div class="auth-form__header">
        <h1 class="auth-form__title">
          {{ isLogin ? 'Se connecter' : 'S\'inscrire' }}
        </h1>
        <p class="auth-form__subtitle">
          {{ isLogin ? 'Bienvenue sur Gazes' : 'Rejoignez la communauté Gazes' }}
        </p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="auth-form__form">
        <!-- Email -->
        <div class="auth-form__field">
          <label for="email" class="auth-form__label">Email</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            class="auth-form__input"
            placeholder="votre@email.com"
            required
          />
        </div>

        <!-- Username (only for register) -->
        <div v-if="!isLogin" class="auth-form__field">
          <label for="username" class="auth-form__label">Nom d'utilisateur</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            class="auth-form__input"
            placeholder="votre_nom"
            required
          />
        </div>

        <!-- Password -->
        <div class="auth-form__field">
          <label for="password" class="auth-form__label">Mot de passe</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            class="auth-form__input"
            placeholder="••••••••"
            required
          />
        </div>

        <!-- Error Message -->
        <div v-if="error" class="auth-form__error">
          {{ error }}
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading"
          class="auth-form__submit"
        >
          <span v-if="loading" class="auth-form__loading">Chargement...</span>
          <span v-else>{{ isLogin ? 'Se connecter' : 'S\'inscrire' }}</span>
        </button>
      </form>

      <!-- Toggle Mode -->
      <div class="auth-form__toggle">
        <button
          @click="toggleMode"
          class="auth-form__toggle-btn"
        >
          {{ isLogin ? 'Pas de compte ? S\'inscrire' : 'Déjà un compte ? Se connecter' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '~/composables/useAuth'

interface Props {
  initialMode?: 'login' | 'register'
}

const props = withDefaults(defineProps<Props>(), {
  initialMode: 'login'
})

const emit = defineEmits<{
  success: [user: any]
}>()

const isLogin = ref(props.initialMode === 'login')
const form = ref({
  email: '',
  username: '',
  password: ''
})

const { login, register, loading, error, clearError } = useAuth()

const handleSubmit = async () => {
  clearError()

  if (isLogin.value) {
    const result = await login(form.value.email, form.value.password)
    if (result.success) {
      emit('success', result.user)
    }
  } else {
    const result = await register(form.value.email, form.value.username, form.value.password)
    if (result.success) {
      emit('success', result.user)
    }
  }
}

const toggleMode = () => {
  isLogin.value = !isLogin.value
  form.value = {
    email: '',
    username: '',
    password: ''
  }
  clearError()
}
</script>

<style scoped>
.auth-form {
  @apply min-h-screen flex items-center justify-center bg-zinc-900 px-4;
}

.auth-form__container {
  @apply w-full max-w-md bg-zinc-800 rounded-lg p-8 shadow-xl;
}

.auth-form__header {
  @apply text-center mb-8;
}

.auth-form__title {
  @apply text-2xl font-bold text-white mb-2;
}

.auth-form__subtitle {
  @apply text-zinc-400;
}

.auth-form__form {
  @apply space-y-6;
}

.auth-form__field {
  @apply space-y-2;
}

.auth-form__label {
  @apply block text-sm font-medium text-zinc-300;
}

.auth-form__input {
  @apply w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent;
}

.auth-form__error {
  @apply text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded-md p-3;
}

.auth-form__submit {
  @apply w-full bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors duration-200;
}

.auth-form__loading {
  @apply flex items-center justify-center;
}

.auth-form__toggle {
  @apply text-center mt-6;
}

.auth-form__toggle-btn {
  @apply text-violet-400 hover:text-violet-300 text-sm underline;
}
</style>