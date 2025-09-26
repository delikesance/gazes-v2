<template>
  <div class="min-h-screen flex items-center justify-center bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-white">
          {{ isLogin ? 'Se connecter' : 'Créer un compte' }}
        </h2>
        <p class="mt-2 text-center text-sm text-zinc-400">
          {{ isLogin ? 'Connectez-vous à votre compte' : 'Rejoignez-nous dès aujourd\'hui' }}
        </p>
      </div>

      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div v-if="error" class="bg-red-900/50 border border-red-500 rounded-lg p-4">
          <div class="flex">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
            <p class="text-red-200 text-sm">{{ error }}</p>
          </div>
        </div>

        <div v-if="!isLogin" class="space-y-6">
          <div>
            <label for="username" class="block text-sm font-medium text-zinc-300 mb-2">
              Nom d'utilisateur
            </label>
            <input
              id="username"
              v-model="form.username"
              name="username"
              type="text"
              autocomplete="username"
              required
              :disabled="loading"
              class="appearance-none relative block w-full px-3 py-2 border border-zinc-700 placeholder-zinc-500 text-white bg-zinc-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
              placeholder="Votre nom d'utilisateur"
            />
          </div>
        </div>

        <div class="space-y-6">
          <div>
            <label for="email" class="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              id="email"
              v-model="form.email"
              name="email"
              type="email"
              autocomplete="email"
              required
              :disabled="loading"
              class="appearance-none relative block w-full px-3 py-2 border border-zinc-700 placeholder-zinc-500 text-white bg-zinc-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-zinc-300 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              v-model="form.password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              :disabled="loading"
              class="appearance-none relative block w-full px-3 py-2 border border-zinc-700 placeholder-zinc-500 text-white bg-zinc-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
              :placeholder="isLogin ? 'Votre mot de passe' : 'Au moins 6 caractères'"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-violet-700 hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="mr-2">
              <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
            </span>
            {{ loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'Créer le compte') }}
          </button>
        </div>

        <div class="text-center">
          <button
            type="button"
            @click="toggleMode"
            :disabled="loading"
            class="text-sm text-violet-400 hover:text-violet-300 disabled:opacity-50"
          >
            {{ isLogin ? 'Pas encore de compte ? Inscrivez-vous' : 'Déjà un compte ? Connectez-vous' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
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

const { login, register, loading, error, clearError } = useAuth()

const isLogin = ref(props.initialMode === 'login')
const form = reactive({
  email: '',
  username: '',
  password: ''
})

const handleSubmit = async () => {
  console.log('📝 [AUTH_FORM] Form submitted')
  console.log('📝 [AUTH_FORM] Mode:', isLogin.value ? 'LOGIN' : 'REGISTER')
  console.log('📝 [AUTH_FORM] Form data:', {
    email: form.email,
    username: form.username,
    hasPassword: !!form.password
  })

  clearError()

  if (isLogin.value) {
    console.log('📝 [AUTH_FORM] Calling login function...')
    const result = await login(form.email, form.password)
    console.log('📝 [AUTH_FORM] Login result:', result)

    if (result.success) {
      console.log('✅ [AUTH_FORM] Login successful, emitting success event')
      emit('success', result.user)
    } else {
      console.log('❌ [AUTH_FORM] Login failed')
    }
  } else {
    console.log('📝 [AUTH_FORM] Calling register function...')
    const result = await register(form.email, form.username, form.password)
    console.log('📝 [AUTH_FORM] Register result:', result)

    if (result.success) {
      console.log('✅ [AUTH_FORM] Registration successful, emitting success event')
      emit('success', result.user)
    } else {
      console.log('❌ [AUTH_FORM] Registration failed')
    }
  }
}

const toggleMode = () => {
  const oldMode = isLogin.value ? 'LOGIN' : 'REGISTER'
  const newMode = !isLogin.value ? 'LOGIN' : 'REGISTER'

  console.log('📝 [AUTH_FORM] Toggling mode from', oldMode, 'to', newMode)

  isLogin.value = !isLogin.value
  clearError()

  // Reset form when switching modes
  console.log('📝 [AUTH_FORM] Resetting form data')
  form.email = ''
  form.username = ''
  form.password = ''

  console.log('📝 [AUTH_FORM] Mode toggle completed')
}
</script>
