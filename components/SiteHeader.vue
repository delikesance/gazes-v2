<template>
    <nav :class="['p-10 w-full', isHome ? 'absolute top-0 left-0' : 'relative']">
        <ul class="flex w-full items-center py-3 px-9 gap-10 pl-5 justify-center items-center">
            <li class="-mb-2 text-xl">
                <NuxtLink to="/catalogue">
                    <ClientOnly>
                        <Icon name="heroicons-outline:search" />
                    </ClientOnly>
                </NuxtLink>
            </li>

            <li>
                <NuxtLink to="/">Accueil</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/series">Séries</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/movies">Films</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/others">Autre</NuxtLink>
            </li>
        </ul>
    </nav>
</template>

    <script setup lang="ts">
    import { computed } from 'vue'
    const route = useRoute()
    const isHome = computed(() => route.path === '/')
    </script>
