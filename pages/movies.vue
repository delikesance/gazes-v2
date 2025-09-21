<script setup lang="ts">
import { ref, computed } from 'vue'
import CarouselRow from '~/components/CarouselRow.vue'

// Set page metadata
useSeoMeta({
  title: 'Films - Gazes',
  description: 'Découvrez notre collection de films animés'
})

type Item = { id: string; title: string; image: string }

const loading = ref(false)
const movies = ref<Item[]>([])

// Popular movie genres
const movieGenres = [
  'Action',
  'Aventure',
  'Comédie',
  'Drame',
  'Fantastique',
  'Horreur',
  'Romance',
  'Science-Fiction'
]

// Fetch featured movie for hero section
const { data: featuredData } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
  params: {
    genre: 'Action',
    type: 'movie',
    limit: 1,
    random: '1'
  },
  key: 'movies:featured'
})

const featuredMovie = computed(() => featuredData.value?.items?.[0] || null)
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section v-if="featuredMovie" class="hero-section relative h-[50vh] md:h-[60vh] flex items-center justify-center overflow-hidden">
      <img
        :src="featuredMovie.image"
        :alt="featuredMovie.title"
        class="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent"></div>

      <div class="relative z-10 text-center px-5 md:px-20">
        <h1 class="text-4xl md:text-6xl font-black mb-4">Films</h1>
        <p class="text-zinc-300 text-lg md:text-xl max-w-2xl mx-auto">
          Découvrez des chefs-d'œuvre cinématographiques animés
        </p>
        <div class="mt-6">
          <NuxtLink
            to="/catalogue?type=movie"
            class="btn primary"
          >
            Parcourir tous les films
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Movies by Genre -->
    <div class="flex flex-col gap-10 mt-10">
      <div v-for="genre in movieGenres" :key="genre">
        <Suspense>
          <CarouselRow
            :title="`Films ${genre}`"
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

    <!-- Studio Highlights -->
    <section class="section px-5 md:px-20 mt-16">
      <div class="text-center mb-8">
        <h2>Films de studios renommés</h2>
        <p class="muted">Découvrez les créations des meilleurs studios d'animation</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="card p-6 text-center">
          <h3 class="mb-3">Studio Ghibli</h3>
          <p class="muted mb-4">Films emblématiques du célèbre studio japonais</p>
          <NuxtLink
            to="/catalogue?studio=ghibli"
            class="btn secondary"
          >
            Découvrir
          </NuxtLink>
        </div>
        <div class="card p-6 text-center">
          <h3 class="mb-3">Films Makoto Shinkai</h3>
          <p class="muted mb-4">Œuvres du maître de l'animation moderne</p>
          <NuxtLink
            to="/catalogue?director=shinkai"
            class="btn secondary"
          >
            Découvrir
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Top Rated Movies -->
    <section class="section px-5 md:px-20 mt-16">
      <div class="text-center mb-8">
        <h2>Films les mieux notés</h2>
        <p class="muted">Les incontournables du cinéma d'animation</p>
      </div>

      <Suspense>
        <CarouselRow
          title="Chef-d'œuvres"
          genre="Drame,Fantastique"
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
        <h2 class="mb-4">Explorez notre cinémathèque</h2>
        <p class="muted mb-6 max-w-2xl mx-auto">
          Des longs-métrages épiques aux courts-métrages touchants, découvrez le meilleur du cinéma d'animation.
        </p>
        <NuxtLink
          to="/catalogue?type=movie"
          class="btn primary"
        >
          Voir tous les films
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
