<template>
  <div class="user-menu">
    <div class="user-menu__trigger" @click="toggleMenu">
      <div class="user-menu__avatar">
        <Icon name="heroicons-outline:user" class="user-menu__icon" />
      </div>
      <span class="user-menu__username">{{ user?.username }}</span>
      <Icon
        name="heroicons-outline:chevron-down"
        class="user-menu__chevron"
        :class="{ 'rotate-180': isOpen }"
      />
    </div>

    <!-- Dropdown Menu -->
    <div v-if="isOpen" class="user-menu__dropdown">
      <div class="user-menu__item user-menu__item--user">
        <div class="user-menu__user-info">
          <div class="user-menu__user-name">{{ user?.username }}</div>
          <div class="user-menu__user-email">{{ user?.email }}</div>
        </div>
      </div>

      <hr class="user-menu__divider" />

      <button @click="handleLogout" class="user-menu__item user-menu__item--logout">
        <Icon name="heroicons-outline:arrow-right-on-rectangle" class="user-menu__item-icon" />
        <span>Se déconnecter</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

interface Props {
  user: {
    id: string
    username: string
    email: string
  } | null
}

defineProps<Props>()

const emit = defineEmits<{
  logout: []
}>()

const { logout } = useAuth()
const isOpen = ref(false)

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const handleLogout = async () => {
  await logout()
  isOpen.value = false
  emit('logout')
}

// Close menu when clicking outside
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.user-menu {
  @apply relative;
}

.user-menu__trigger {
  @apply flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-zinc-700 transition-colors duration-200;
}

.user-menu__avatar {
  @apply w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center;
}

.user-menu__icon {
  @apply w-4 h-4 text-white;
}

.user-menu__username {
  @apply text-white font-medium hidden sm:block;
}

.user-menu__chevron {
  @apply w-4 h-4 text-zinc-400 transition-transform duration-200;
}

.user-menu__dropdown {
  @apply absolute right-0 top-full mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-50;
}

.user-menu__item {
  @apply w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-700 transition-colors duration-200;
}

.user-menu__item--user {
  @apply pointer-events-none;
}

.user-menu__user-info {
  @apply flex-1;
}

.user-menu__user-name {
  @apply text-white font-medium;
}

.user-menu__user-email {
  @apply text-zinc-400 text-sm;
}

.user-menu__divider {
  @apply border-zinc-600 my-1;
}

.user-menu__item--logout {
  @apply text-red-400 hover:text-red-300 hover:bg-red-900/20;
}

.user-menu__item-icon {
  @apply w-5 h-5;
}
</style>