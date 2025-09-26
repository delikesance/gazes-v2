<template>
  <div class="relative" ref="menuRef">
    <button
      @click="toggleMenu"
      class="flex items-center space-x-2 text-zinc-200 hover:text-white transition-colors"
    >
      <div class="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center">
        <span class="text-sm font-medium">{{ userInitials }}</span>
      </div>
      <span class="hidden sm:block">{{ user?.username }}</span>
      <Icon
        name="heroicons:chevron-down"
        :class="['w-4 h-4 transition-transform', { 'rotate-180': isOpen }]"
      />
    </button>

    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50"
      >
        <div class="py-1">
          <div class="px-4 py-2 border-b border-zinc-700">
            <p class="text-sm font-medium text-white">{{ user?.username }}</p>
            <p class="text-xs text-zinc-400">{{ user?.email }}</p>
          </div>

          <button
            @click="handleLogout"
            :disabled="loggingOut"
            class="w-full text-left px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4 mr-2" />
            {{ loggingOut ? 'Déconnexion...' : 'Se déconnecter' }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

interface Props {
  user?: {
    id: string
    email: string
    username: string
  } | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  logout: []
}>()

const { logout } = useAuth()
const isOpen = ref(false)
const menuRef = ref<HTMLElement>()
const loggingOut = ref(false)

const userInitials = computed(() => {
  if (!props.user?.username) return 'U'
  return props.user.username
    .split(' ')
    .map(name => name.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
})

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const closeMenu = (event: Event) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

const handleLogout = async () => {
  loggingOut.value = true
  const result = await logout()
  if (result.success) {
    emit('logout')
  }
  loggingOut.value = false
  isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>
