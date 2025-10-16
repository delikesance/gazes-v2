<template>
  <section class="py-8">
    <div class="mb-6 flex items-center justify-between px-4 md:px-20">
      <h3 class="text-xl font-semibold text-white">{{ title }}</h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-zinc-400">{{ recommendations.length }} recommandations</span>
        <button
          @click="refreshRecommendations"
          :disabled="loading"
          class="text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          title="Actualiser les recommandations"
        >
          <Icon name="heroicons:arrow-path" class="w-5 h-5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <div class="relative">
      <!-- Loading state -->
      <div v-if="loading" class="flex gap-4 overflow-x-auto scroll-smooth px-4 md:px-20">
        <div
          v-for="i in 8"
          :key="i"
          class="flex-shrink-0 w-40"
        >
          <div class="aspect-[3/4] rounded-lg bg-zinc-800 animate-pulse" />
          <div class="mt-3 p-3">
            <div class="h-4 bg-zinc-800 rounded mb-2" />
            <div class="h-4 bg-zinc-800 rounded w-3/4" />
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex items-center justify-center h-32 text-zinc-400 px-4 md:px-20">
        <div class="text-center">
          <Icon name="heroicons:exclamation-triangle" class="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p class="text-sm">Impossible de charger les recommandations</p>
          <button @click="refreshRecommendations" class="text-xs text-violet-400 hover:text-violet-300 mt-2">
            Réessayer
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="recommendations.length === 0" class="flex items-center justify-center h-32 text-zinc-400 px-4 md:px-20">
        <div class="text-center">
          <Icon name="heroicons:sparkles" class="w-8 h-8 text-zinc-500 mx-auto mb-2" />
          <p class="text-sm">Regardez plus de contenu pour obtenir des recommandations personnalisées</p>
        </div>
      </div>

      <!-- Recommendations -->
      <div v-else class="relative">
        <div class="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-zinc-950 to-transparent" />
        <div class="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-zinc-950 to-transparent" />
        <div class="flex gap-4 overflow-x-auto scroll-smooth px-4 md:px-20">
          <div
            v-for="rec in recommendations"
            :key="rec.animeId"
            class="flex-shrink-0 group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 w-40 cursor-pointer"
            @click="handleItemClick(rec)"
          >
            <!-- Poster image -->
            <div class="aspect-[3/4] relative overflow-hidden">
              <NuxtImg
                :src="rec.cover"
                :alt="`Poster for ${rec.title}`"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                :placeholder="[50, 25, 75, 5]"
                :placeholder-class="'bg-zinc-800 animate-pulse'"
              />

              <!-- Score badge -->
              <div class="absolute top-2 right-2 bg-violet-600/90 text-white text-xs px-2 py-1 rounded font-medium">
                {{ Math.round(rec.score * 100) }}%
              </div>

              <!-- Hover overlay with reason -->
              <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3">
                <p class="text-white text-xs text-center line-clamp-3">{{ rec.reason }}</p>
              </div>
            </div>

            <!-- Title and genres -->
            <div class="p-3 bg-black">
              <h4 class="text-sm font-semibold text-white line-clamp-2 mb-1">{{ rec.title }}</h4>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="genre in rec.genres.slice(0, 2)"
                  :key="genre"
                  class="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded"
                >
                  {{ genre }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Recommendation {
  animeId: string
  title: string
  cover: string
  genres: string[]
  score: number
  reason: string
}

interface Props {
  title?: string
  type?: 'mixed' | 'content' | 'collaborative' | 'popular'
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Recommandé pour vous',
  type: 'mixed',
  limit: 20
})

const recommendations = ref<Recommendation[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Fetch recommendations
const fetchRecommendations = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{
      success: boolean
      recommendations: Recommendation[]
      metadata: any
    }>('/api/recommendations', {
      params: {
        type: props.type,
        limit: props.limit
      }
    })

    if (response.success) {
      recommendations.value = response.recommendations
    } else {
      throw new Error('Failed to fetch recommendations')
    }
  } catch (err: any) {
    console.error('Failed to fetch recommendations:', err)
    error.value = err.message || 'Erreur lors du chargement des recommandations'
    recommendations.value = []
  } finally {
    loading.value = false
  }
}

// Handle item click
const handleItemClick = (rec: Recommendation) => {
  navigateTo(`/anime/${rec.animeId}`)
}

// Refresh recommendations
const refreshRecommendations = () => {
  fetchRecommendations()
}

// Fetch on mount
onMounted(() => {
  fetchRecommendations()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>