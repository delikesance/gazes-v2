<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface ContinueWatchingItem {
  id: string
  season: string
  seasonDisplay: string
  episode: number
  currentTime: number
  duration: number
  lastWatchedAt: string
  completed: boolean
  anime: any
  progressPercent: number
}

const props = defineProps<{
  title?: string
  maxItems?: number
}>()

const continueWatchingItems = ref<ContinueWatchingItem[]>([])
const loading = ref(true)
const error = ref('')

const loadContinueWatching = async () => {
  try {
    loading.value = true
    error.value = ''

    const response = await $fetch('/api/watch/progress')
    if (response?.success) {
      continueWatchingItems.value = response.items.slice(0, props.maxItems || 20)
    } else {
      error.value = 'Failed to load continue watching items'
    }
  } catch (err) {
    console.error('Failed to load continue watching:', err)
    error.value = 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const getProgressColor = (percent: number): string => {
  if (percent < 25) return 'bg-red-500'
  if (percent < 50) return 'bg-yellow-500'
  if (percent < 75) return 'bg-blue-500'
  return 'bg-green-500'
}

onMounted(() => {
  loadContinueWatching()
})
</script>

<template>
  <section class="section">
    <div class="flex justify-between items-center mb-4 px-5 md:px-20">
      <h3 class="row-title">{{ title || 'Continuer à regarder' }}</h3>
      <div class="flex items-center gap-5">
        <button
          type="button"
          class="opacity-50"
          disabled
        >
          <Icon name="grommet-icons:form-previous" />
        </button>
        <button
          type="button"
          class="opacity-50"
          disabled
        >
          <Icon name="grommet-icons:form-next" />
        </button>
      </div>
    </div>

    <div class="relative">
      <!-- Gradient overlays -->
      <div
        aria-hidden
        class="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-zinc-950 to-transparent"
      />
      <div
        aria-hidden
        class="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-zinc-950 to-transparent"
      />

      <!-- Loading state -->
      <div v-if="loading" class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
        <div
          v-for="i in 8"
          :key="i"
          class="snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12] w-[170px]"
        />
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="px-5 md:px-20">
        <div class="text-center py-8">
          <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <p class="text-zinc-400">{{ error }}</p>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="continueWatchingItems.length === 0" class="px-5 md:px-20">
        <div class="text-center py-8">
          <Icon name="heroicons:play-circle" class="w-12 h-12 mx-auto mb-4 text-zinc-500" />
          <p class="text-zinc-400">Aucun contenu en cours</p>
          <p class="text-sm text-zinc-500 mt-2">Commencez à regarder pour voir vos progrès ici</p>
        </div>
      </div>

      <!-- Continue watching items -->
      <div v-else class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
        <NuxtLink
          v-for="item in continueWatchingItems"
          :key="`${item.anime.id}-${item.season}-${item.episode}`"
          :to="`/watch/${item.anime.id}/${item.season}/vostfr/${item.episode}`"
          class="snap-start shrink-0 group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 w-[170px]"
        >
          <!-- Poster image -->
          <div class="aspect-[9/12] relative overflow-hidden">
            <img
              :src="item.anime.image"
              :alt="item.anime.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            <!-- Progress overlay -->
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
              <div
                class="h-full transition-all duration-300"
                :class="getProgressColor(item.progressPercent)"
                :style="{ width: item.progressPercent + '%' }"
              />
            </div>

            <!-- Play overlay -->
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Icon name="heroicons:play" class="w-12 h-12 text-white drop-shadow-lg" />
              </div>
            </div>

            <!-- Episode info overlay -->
            <div class="absolute top-2 right-2 bg-black/80 rounded px-2 py-1 text-xs text-white font-medium">
              {{ item.seasonDisplay }} E{{ item.episode.toString().padStart(2, '0') }}
            </div>
          </div>

          <!-- Content info -->
          <div class="p-3 bg-zinc-900">
            <h4 class="font-medium text-white text-sm line-clamp-2 mb-1 group-hover:text-violet-400 transition-colors">
              {{ item.anime.title }}
            </h4>
            <p class="text-xs text-zinc-400 mb-2">
              {{ formatTime(item.currentTime) }} / {{ formatTime(item.duration) }}
            </p>
            <div class="flex items-center justify-between text-xs text-zinc-500">
              <span>{{ Math.round(item.progressPercent) }}% vu</span>
              <span>{{ new Date(item.lastWatchedAt).toLocaleDateString('fr-FR') }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
}
</style>