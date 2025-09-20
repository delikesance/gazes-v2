<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import CarouselRow from '~/components/CarouselRow.vue'
import HeroBanner from '~/components/HeroBanner.vue'
const route = useRoute()
type Item = { id: string; title: string; image: string }

const hero = ref<Item | null>(null)
const heroSynopsis = ref<string>('')
const heroBanner = ref<string | undefined>(undefined)
const heroAltTitle = ref<string | undefined>(undefined)
const heroGenres = ref<string[]>([])
const query = ref<string>(String(route.query.q || ''))
const searchResults = ref<Item[]>([])
const searching = ref(false)

// Curate a handful of genres for homepage rows
const genres = ['Action', 'Aventure', 'Comédie', 'Drame', 'Fantastique', 'Horreur', 'Romance', 'Science-Fiction', 'Sport']

async function fetchBySearch(term: string): Promise<Item[]> {
  const { data } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
    params: { search: term }
  })
  return data.value?.items || []
}

// SSR-friendly initial load
if (query.value && query.value.trim()) {
  searching.value = true
  const { data } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
    params: { search: query.value },
    key: `home:search:${query.value}`
  })
  searchResults.value = data.value?.items || []
  searching.value = false
} else {
  const { data } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
    params: { genre: genres[0], random: '1' },
    key: `home:hero:${genres[0]}:random`
  })
  const first = data.value?.items?.[0]
  hero.value = first || null
  if (hero.value) await fetchHeroDetails(hero.value.id)
}

watch(() => route.query.q, async (q) => {
  query.value = String(q || '')
  if (query.value && query.value.trim()) {
    searching.value = true
    try {
      const items = await fetchBySearch(query.value.trim())
      searchResults.value = items
    } finally {
      searching.value = false
    }
  } else {
    if (!hero.value) {
      const { data } = await useFetch<{ items: Item[] }>(`/api/catalogue`, { params: { genre: genres[0], random: '1' }, key: `home:hero:${genres[0]}:random` })
      hero.value = data.value?.items?.[0] || null
      if (hero.value) await fetchHeroDetails(hero.value.id)
    }
  }
})

// Minimal shape of anime info we care about
type AnimeInfo = { synopsis: string; banner?: string; altTitle?: string; genres: string[] }

// Fetch detailed info for the hero (synopsis and optional banner)
async function fetchHeroDetails(id: string) {
  // Reset to avoid stale display
  heroSynopsis.value = ''
  heroBanner.value = undefined
  heroAltTitle.value = undefined
  heroGenres.value = []
  try {
    const { data } = await useFetch<AnimeInfo>(`/api/anime/${id}`)
    if (data.value) {
      heroSynopsis.value = data.value.synopsis || ''
      heroBanner.value = data.value.banner || undefined
      heroAltTitle.value = data.value.altTitle || undefined
      heroGenres.value = Array.isArray(data.value.genres) ? data.value.genres : []
    }
  } catch (e) {
    console.error('Failed to fetch hero details', e)
  }
}

// Prefer up to 3 genres as subtitle
const heroSubtitle = computed(() => {
  const g = heroGenres.value?.filter(Boolean) || []
  return g.slice(0, 3).join(' • ')
})
</script>

<template>
  <section>
    <template v-if="!query">
      <HeroBanner v-if="hero" :title="hero.title" :subtitle="heroSubtitle" :image="heroBanner || hero.image"
        :primary-to="`/anime/${hero.id}`" :secondary-to="`/anime/${hero.id}`" :synopsis="heroSynopsis" />

      <div class="flex flex-col gap-10 ">
        <div v-for="g in genres" :key="g">
          <Suspense>
            <CarouselRow :title="g" :genre="g" card-size="sm" />
            <template #fallback>
              <section class="section">
                <div class="flex justify-between items-center mb-4 px-20">
                  <h3 class="row-title">{{ g }}</h3>
                  <div class="flex items-center gap-5">
                    <button type="button"><ClientOnly><Icon name="grommet-icons:form-previous" /></ClientOnly></button>
                    <button type="button"><ClientOnly><Icon name="grommet-icons:form-next" /></ClientOnly></button>
                  </div>
                </div>
                <div class="relative">
                  <div aria-hidden class="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-zinc-950 to-transparent" />
                  <div aria-hidden class="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-zinc-950 to-transparent" />
                  <div class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-20 pr-20 scroll-pl-20 scroll-pr-20">
                    <div v-for="i in 8" :key="i" class="snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12] w-[170px]" />
                  </div>
                </div>
              </section>
            </template>
          </Suspense>
        </div>
      </div>
    </template>
    <template v-else>
      <section class="section">
        <h2 class="px-20 mb-4">Search results</h2>
        <div v-if="searching" class="px-20 text-zinc-400">Loading…</div>
        <div v-else-if="!searchResults.length" class="px-20 text-zinc-400">No results</div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 px-20">
          <NuxtLink v-for="it in searchResults" :key="it.id" :to="`/anime/${it.id}`" class="block">
            <CardPoster :to="`/anime/${it.id}`" :src="it.image" :title="it.title" size="sm" />
          </NuxtLink>
        </div>
      </section>
    </template>
  </section>
</template>