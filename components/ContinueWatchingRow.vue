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
        :key="item.animeId"
        class="snap-start shrink-0 group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 w-[200px] h-[320px] flex flex-col cursor-pointer"
        @click="handleItemClick(item)"
      >
        <!-- Remove button - moved to left -->
        <button
          @click.stop="removeItem(item)"
          class="absolute top-2 left-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Remove from continue watching"
        >
          <Icon name="heroicons:x-mark" class="w-4 h-4" />
        </button>

        <!-- Combined episode and progress badge -->
        <div class="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded z-10">
          {{ formatSeasonEpisode(item.lastWatchedEpisode) }}
        </div>

        <!-- Poster image -->
        <div class="h-[240px] relative overflow-hidden">
          <img
            :src="item.image"
            :alt="`Poster for ${item.title}`"
            class="w-[200px] h-[240px] object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <!-- Progress bar -->
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-zinc-600">
            <div
              class="h-full transition-all duration-300"
              :class="getProgressColor(item.overallProgress)"
              :style="{ width: item.overallProgress + '%' }"
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
        <div class="flex-1 p-3 bg-zinc-900 flex flex-col justify-between">
          <div>
            <p class="text-zinc-400 text-xs mb-1">
              {{ item.completedEpisodes }}/{{ item.totalEpisodes }} épisodes
            </p>
            <h4 class="font-medium text-white text-sm group-hover:text-violet-400 transition-colors line-clamp-3">
              {{ item.title }}
            </h4>
          </div>
        </div>
      </div>
    </div>
  </Carousel>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface SeriesProgress {
  animeId: string
  title: string
  image: string
  lastWatchedEpisode: {
    season: string
    episode: number
    currentTime: number
    duration: number
    progressPercent: number
  }
  completedEpisodes: number // Actually represents watched episodes (episodes with progress > 0)
  totalEpisodes: number
  overallProgress: number
  lastWatchedAt: string
  defaultLang?: string
}

const items = ref<SeriesProgress[]>([])
const loading = ref(true)
const error = ref('')

const fetchContinueWatching = async () => {
  try {
    loading.value = true
    const response = await $fetch('/api/watch/progress/series')

    if (response.success) {
      items.value = response.series
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

const getProgressColor = (percent: number) => {
  if (percent >= 90) return 'bg-green-500'
  if (percent >= 50) return 'bg-yellow-500'
  return 'bg-blue-500'
}

const formatSeasonEpisode = (episode: SeriesProgress['lastWatchedEpisode']) => {
  const seasonNum = episode.season.match(/(\d+)/)?.[1] || '1'
  return `S${seasonNum.padStart(2, '0')}E${episode.episode.toString().padStart(2, '0')}`
}

const handleItemClick = (item: SeriesProgress) => {
  // Navigate to the appropriate episode in the series
  // If the last watched episode is not fully watched, resume it
  // Otherwise, go to the next episode
  const lastEpisode = item.lastWatchedEpisode
  let targetEpisode = lastEpisode.episode

  if (lastEpisode.progressPercent < 90) {
    // Resume current episode
    targetEpisode = lastEpisode.episode
  } else {
    // Go to next episode
    targetEpisode = lastEpisode.episode + 1
  }

  const lang = item.defaultLang || 'vostfr'
  const season = lastEpisode.season

  navigateTo(`/watch/${item.animeId}/${season}/${lang}/${targetEpisode}?continue=true`)
}

const removeItem = async (item: SeriesProgress) => {
  try {
    // Remove all progress for this anime series (no season/episode specified)
    await $fetch(`/api/watch/progress/${item.animeId}`, {
      method: 'DELETE'
    })
    // Remove from local items
    const index = items.value.findIndex(i => i.animeId === item.animeId)
    if (index > -1) {
      items.value.splice(index, 1)
    }
  } catch (error) {
    console.error('Failed to remove item:', error)
    // TODO: Show error message to user
  }
}

onMounted(() => {
  fetchContinueWatching()
})
</script>

<style scoped>
</style>