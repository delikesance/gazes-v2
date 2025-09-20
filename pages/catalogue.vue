<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import CardPoster from '~/components/CardPoster.vue'

type Item = { id: string; title: string; image: string }

const route = useRoute()
const router = useRouter()

const search = ref<string>(String(route.query.search || ''))
const selectedGenres = ref<string[]>(Array.isArray(route.query.genre) ? (route.query.genre as string[]) : (route.query.genre ? [String(route.query.genre)] : []))
const loading = ref(false)
const items = ref<Item[]>([])
const page = ref(1)
const hasMore = ref(true)
const sentinel = ref<HTMLDivElement | null>(null)
let observer: IntersectionObserver | null = null

const allGenres = ['Action', 'Aventure', 'Comédie', 'Drame', 'Fantastique', 'Horreur', 'Romance', 'Science-Fiction', 'Sport']

function updateQuery() {
  const q: Record<string, any> = {}
  if (search.value) q.search = search.value
  if (selectedGenres.value.length) q.genre = selectedGenres.value
  router.replace({ path: '/catalogue', query: q })
}

async function fetchPage(p: number) {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const { data, error } = await useFetch<{ items: Item[]; status?: number }>(`/api/catalogue`, {
      params: { search: search.value, genre: selectedGenres.value, page: String(p) },
      key: `catalogue:${search.value}:${selectedGenres.value.sort().join(',')}:${p}`
    })
    if (error.value) {
      hasMore.value = false
      return
    }
    const status = data.value?.status ?? 200
    if (status !== 200) {
      hasMore.value = false
      return
    }
    const newItems = data.value?.items || []
    if (p === 1) {
      items.value = newItems
    } else {
      // dedupe by id
      const seen = new Set(items.value.map(i => i.id))
      for (const it of newItems) if (!seen.has(it.id)) items.value.push(it)
    }
    hasMore.value = newItems.length > 0
  } finally {
    loading.value = false
  }
}

function resetAndFetch() {
  page.value = 1
  hasMore.value = true
  items.value = []
  fetchPage(1)
}

watch([search, selectedGenres], () => {
  // When filters change, reset and fetch first page
  resetAndFetch()
})

onMounted(() => {
  // Initialize from current query and fetch first page
  resetAndFetch()
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && hasMore.value && !loading.value) {
        page.value += 1
        fetchPage(page.value)
      }
    }
  }, { rootMargin: '400px 0px' })
  if (sentinel.value && observer) observer.observe(sentinel.value)
})

onBeforeUnmount(() => {
  if (observer && sentinel.value) observer.unobserve(sentinel.value)
  observer = null
})
</script>

<template>
  <section class="section px-5 md:px-20">
    <h1 class="mb-3">Catalogue</h1>
    <div class="flex flex-wrap gap-3 items-stretch">
      <input v-model="search" @change="updateQuery" type="search" class="input w-full sm:w-[420px]" placeholder="Search..." />
      <div class="pills">
        <label v-for="g in allGenres" :key="g" class="pill cursor-pointer select-none">
          <input type="checkbox" :value="g" v-model="selectedGenres" @change="updateQuery" class="hidden" />
          <span :class="selectedGenres.includes(g) ? 'text-violet-400' : 'text-zinc-200'">{{ g }}</span>
        </label>
      </div>
    </div>

    <div class="divider" />

    <div v-if="!loading && items.length === 0" class="muted">No results</div>

    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <CardPoster v-for="it in items" :key="it.id" :to="`/anime/${it.id}`" :src="it.image" :title="it.title" size="sm" />
    </div>
    <div ref="sentinel" class="h-px"></div>
    <div v-if="loading" class="muted mt-3">Loading…</div>
  </section>
</template>
