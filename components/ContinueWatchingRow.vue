<template>
  <Carousel title="Continuer à regarder">
    <!-- Loading state -->
    <div v-if="loading" class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
      <div
        v-for="i in 8"
        :key="i"
        class="snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse w-[200px] min-h-[320px]"
      />
    </div>

    <!-- Empty state -->
    <div v-else-if="items.length === 0" class="flex items-center justify-center h-32 text-zinc-400">
      <p>Aucun contenu en cours</p>
    </div>

    <!-- Items -->
    <div v-else class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
      <div
        v-for="item in items"
        :key="`${item.animeId}-${item.season}-${item.episode}`"
        class="snap-start shrink-0 group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 w-[200px] min-h-[320px] flex flex-col cursor-pointer"
        @click="handleItemClick(item)"
      >
        <!-- Poster image -->
        <div class="h-[240px] relative overflow-hidden">
          <img
            :src="getPosterUrl(item)"
            :alt="`Poster for ${item.title || item.animeId}`"
            class="w-[200px] h-[240px] object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <!-- Progress bar -->
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-zinc-600">
            <div
              class="h-full transition-all duration-300"
              :class="getProgressColor(item.progressPercent)"
              :style="{ width: item.progressPercent + '%' }"
            ></div>
          </div>

          <!-- Play overlay -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Icon name="heroicons:play" class="w-12 h-12 text-white drop-shadow-lg" />
            </div>
          </div>
        </div>

        <!-- Content info -->
        <div class="min-h-[80px] p-3 bg-zinc-900 flex flex-col justify-between">
          <div>
            <h4 class="font-medium text-white text-sm mb-1 group-hover:text-violet-400 transition-colors">
              {{ item.title || item.animeId }}
            </h4>
            <p class="text-zinc-400 text-xs mb-1">
              {{ formatSeason(item.season) }} • Épisode {{ item.episode }}
            </p>
            <p class="text-zinc-500 text-xs">
              {{ Math.round(item.progressPercent) }}% vu
            </p>
          </div>
        </div>
      </div>
    </div>
  </Carousel>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface WatchingProgress {
  id: string
  userId: string
  animeId: string
  season: string
  episode: number
  currentTime: number
  duration: number
  lastWatchedAt: Date
  completed: boolean
  progressPercent: number
  title?: string
  image?: string
  defaultLang?: string
}

const items = ref<WatchingProgress[]>([])
const loading = ref(true)
const error = ref('')

const fetchContinueWatching = async () => {
  try {
    loading.value = true
    const response = await $fetch('/api/watch/progress')

    if (response.success) {
      // Get unique anime IDs
      const animeIds = [...new Set(response.progress.map((item: any) => item.animeId))]

      // Fetch anime data for images, titles, and language information
      const animeDataMap = new Map<string, { title: string; cover: string; defaultLang?: string }>()
      for (const animeId of animeIds) {
        try {
          const animeData = await $fetch(`/api/anime/${animeId}`)
          if (animeData?.title && animeData?.cover) {
            // Get the first available language from languageFlags, default to 'vostfr'
            const defaultLang = animeData.languageFlags ? Object.keys(animeData.languageFlags)[0] : 'vostfr'
            animeDataMap.set(animeId, {
              title: animeData.title,
              cover: animeData.cover,
              defaultLang: defaultLang || 'vostfr'
            })
          }
        } catch (err) {
          console.warn(`Failed to fetch anime data for ${animeId}:`, err)
        }
      }

      // Calculate progress percentage and add anime data
      items.value = response.progress.map((item: any) => {
        const animeData = animeDataMap.get(item.animeId)
        return {
          ...item,
          lastWatchedAt: new Date(item.lastWatchedAt),
          progressPercent: item.duration > 0 ? (item.currentTime / item.duration) * 100 : 0,
          title: animeData?.title || item.animeId,
          image: animeData?.cover || '',
          defaultLang: animeData?.defaultLang || 'vostfr'
        }
      })
    } else {
      error.value = 'Failed to load continue watching items'
    }
  } catch (err) {
    console.error('Failed to load continue watching:', err)
    error.value = 'Failed to load continue watching items'
  } finally {
    loading.value = false
  }
}

const getPosterUrl = (item: WatchingProgress) => {
  return item.image || '/placeholder-poster.jpg' // Fallback to placeholder if no image
}

const getProgressColor = (percent: number) => {
  if (percent >= 90) return 'bg-green-500'
  if (percent >= 50) return 'bg-yellow-500'
  return 'bg-blue-500'
}

const formatSeason = (season: string) => {
  // Only format if it starts with "saison" (case insensitive)
  if (season.toLowerCase().startsWith('saison')) {
    const match = season.match(/saison(\d+)/i)
    if (match) {
      return `Saison ${match[1]}`
    }
  }
  return season
}

const handleItemClick = (item: WatchingProgress) => {
  // Navigate to the watch page with proper URL structure: /watch/{anime-slug}/{season}/{lang}/{episode}
  // Add a query parameter to indicate this is a continue watching action
  const lang = item.defaultLang || 'vostfr'
  navigateTo(`/watch/${item.animeId}/${item.season}/${lang}/${item.episode}?continue=true`)
}

onMounted(() => {
  fetchContinueWatching()
})
</script>

<style scoped>
</style>