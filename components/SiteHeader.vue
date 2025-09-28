<template>
    <nav
        :class="[
            'p-10 w-full z-[99] bg-transparent',
            (isAnimePage || isCataloguePage) ? 'relative' : 'absolute top-0 left-0',
        ]"
    >
        <div class="flex w-full items-center py-3 px-9 gap-10 pl-5 justify-between">
            <!-- Navigation Links -->
            <ul class="flex items-center gap-10">
                <li class="-mb-2 text-xl">
                    <NuxtLink to="/catalogue" :class="{ 'text-violet-400': isCataloguePage }">
                        <ClientOnly>
                            <Icon name="heroicons-outline:search" />
                        </ClientOnly>
                    </NuxtLink>
                </li>

                <li>
                    <NuxtLink to="/" :class="{ 'text-violet-400': isHome }">Accueil</NuxtLink>
                </li>
                <li>
                    <NuxtLink to="/series" :class="{ 'text-violet-400': isSeries }">Séries</NuxtLink>
                </li>
                <li>
                    <NuxtLink to="/movies" :class="{ 'text-violet-400': isMovies }">Films</NuxtLink>
                </li>
            </ul>

            <!-- Authentication Section -->
            <div class="flex items-center gap-4">
                <ClientOnly>
                    <template v-if="pending">
                        <div class="w-8 h-8 bg-zinc-800 rounded-full animate-pulse"></div>
                    </template>
                    <template v-else-if="user">
                        <UserMenu :user="user" @logout="handleLogout" />
                    </template>
                    <template v-else>
                        <div class="flex items-center gap-2">
                            <NuxtLink
                                to="/login"
                                class="btn secondary text-sm"
                            >
                                Se connecter
                            </NuxtLink>
                            <NuxtLink
                                to="/register"
                                class="btn primary text-sm"
                            >
                                S'inscrire
                            </NuxtLink>
                        </div>
                    </template>
                </ClientOnly>
            </div>
        </div>
    </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAuth } from '~/composables/useAuth'

const route = useRoute();
const isAnimePage = computed(() => route.path.startsWith("/anime/"));
const isCataloguePage = computed(() => route.path === "/catalogue");

const isHome = computed(() => route.path === "/");
const isSeries = computed(() => route.path === "/series");
const isMovies = computed(() => route.path === "/movies");

const { user, pending, checkAuth } = useAuth()

// Check authentication on mount
const handleLogout = () => {
  // The logout is handled in UserMenu component
  // This is just for any additional cleanup if needed
}

onMounted(() => {
  checkAuth()
})
</script>
