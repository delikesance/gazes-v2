<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
const CarouselRow = defineAsyncComponent(() => import('~/components/CarouselRow.vue'))
const HeroBanner = defineAsyncComponent(() => import('~/components/HeroBanner.vue'))

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
    limit: 1
  },
  key: 'movies:featured'
})

const featuredMovie = computed(() => featuredData.value?.items?.[0] || null)
</script>

<template>
  <div>
    <!-- Hero Banner -->
    <div class="absolute top-0 left-0 w-full z-0">
      <!-- Loading Hero -->
      <div
        v-if="!featuredMovie"
        class="h-[60vh] md:h-[80vh] lg:h-[90vh] bg-gradient-to-br from-violet-900/20 via-zinc-900 to-zinc-950 flex items-center justify-center"
      >
        <div class="text-center">
          <div
            class="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          ></div>
          <h2 class="text-xl font-semibold mb-2">Chargement...</h2>
          <p class="text-zinc-400">Préparation du contenu</p>
        </div>
      </div>

      <!-- Actual Hero -->
      <HeroBanner
        v-else
        title="Films"
        :image="featuredMovie.image"
        :featured-id="featuredMovie.id"
        :featured-title="featuredMovie.title"
        primary-to="/catalogue?type=movie"
        synopsis="Découvrez notre collection de films d'animation. Des chefs-d'œuvre du Studio Ghibli aux dernières productions."
      />
    </div>



    <!-- Movies by Genre -->
    <div class="flex flex-col gap-12 pt-[60vh] md:pt-[80vh] lg:pt-[90vh] mt-16">
      <div v-for="genre in movieGenres" :key="genre">
        <Suspense>
          <CarouselRow
            :title="`Films ${genre}`"
            :genre="genre"
            :type="'movie'"
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






  </div>
</template>


