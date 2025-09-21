<script setup lang="ts">
import { ref, computed } from 'vue'
import CarouselRow from '~/components/CarouselRow.vue'

// Set page metadata
useSeoMeta({
  title: 'Séries - Gazes',
  description: 'Découvrez notre collection de séries animées'
})

type Item = { id: string; title: string; image: string }

const loading = ref(false)
const series = ref<Item[]>([])

// Popular series genres
const seriesGenres = [
  'Action',
  'Aventure',
  'Comédie',
  'Drame',
  'Fantastique',
  'Science-Fiction'
]

// Fetch featured series for hero section
const { data: featuredData } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
  params: {
    genre: 'Action',
    type: 'series',
    limit: 1,
    random: '1'
  },
  key: 'series:featured'
})

const featuredSeries = computed(() => featuredData.value?.items?.[0] || null)
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section v-if="featuredSeries" class="hero-section relative h-[50vh] md:h-[60vh] flex items-center justify-center overflow-hidden">
      <img
        :src="featuredSeries.image"
        :alt="featuredSeries.title"
        class="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent"></div>

      <div class="relative z-10 text-center px-5 md:px-20">
        <h1 class="text-4xl md:text-6xl font-black mb-4">Séries</h1>
        <p class="text-zinc-300 text-lg md:text-xl max-w-2xl mx-auto">
          Plongez dans l'univers captivant des séries animées
        </p>
        <div class="mt-6">
          <NuxtLink
            to="/catalogue?type=series"
            class="btn primary"
          >
            Parcourir toutes les séries
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Series by Genre -->
    <div class="flex flex-col gap-10 mt-10">
      <div v-for="genre in seriesGenres" :key="genre">
        <Suspense>
          <CarouselRow
            :title="`Séries ${genre}`"
            :genre="genre"
            card-size="md"
          />
          <template #fallback>
            <section class="section">
              <div class="flex justify-between items-center mb-4 px-20">
                <h3 class="row-title">{{ genre }}</h3>
                <div class="flex items-center gap-5">
                  <button type="button">
                    <ClientOnly>
                      <Icon name="grommet-icons:form-previous" />
                    </ClientOnly>
                  </button>
                  <button type="button">
                    <ClientOnly>
                      <Icon name="grommet-icons:form-next" />
                    </ClientOnly>
                  </button>
                </div>
              </div>
              <div class="relative">
                <div aria-hidden class="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-zinc-950 to-transparent" />
                <div aria-hidden class="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-zinc-950 to-transparent" />
                <div class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-20 pr-20 scroll-pl-20 scroll-pr-20">
                  <div
                    v-for="i in 8"
                    :key="i"
                    class="snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12] w-[200px]"
                  />
                </div>
              </div>
            </section>
          </template>
        </Suspense>
      </div>
    </div>

    <!-- Popular This Week Section -->
    <section class="section px-5 md:px-20 mt-16">
      <div class="text-center mb-8">
        <h2>Populaire cette semaine</h2>
        <p class="muted">Les séries les plus regardées</p>
      </div>

      <Suspense>
        <CarouselRow
          title="Tendances"
          genre="Action,Aventure"
          card-size="lg"
        />
        <template #fallback>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div
              v-for="i in 10"
              :key="i"
              class="rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12]"
            />
          </div>
        </template>
      </Suspense>
    </section>

    <!-- Browse All Section -->
    <section class="section px-5 md:px-20 mt-16 text-center">
      <div class="bg-zinc-900/40 backdrop-blur border border-zinc-800 rounded-xl p-8">
        <h2 class="mb-4">Explorez notre catalogue complet</h2>
        <p class="muted mb-6 max-w-2xl mx-auto">
          Découvrez des milliers de séries animées, des classiques incontournables aux dernières sorties.
        </p>
        <NuxtLink
          to="/catalogue?type=series"
          class="btn primary"
        >
          Voir tout le catalogue
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero-section {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}
</style>
