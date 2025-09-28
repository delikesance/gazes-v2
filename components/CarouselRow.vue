<script setup lang="ts">
import { ref, watchEffect, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

interface Item {
  id: string
  title: string
  image: string
}

interface Props {
  title: string
  items?: Item[]
  genre?: string | string[]
  type?: string | string[]
}

const props = defineProps<Props>()

const loading = ref(false)
const items = ref<Item[]>(props.items || [])

// Scroll container ref
const container = ref<HTMLElement | null>(null)
const prevDisabled = ref(true)
const nextDisabled = ref(true)

function updateDisabled() {
  const el = container.value
  if (!el) return
  prevDisabled.value = el.scrollLeft <= 0
  // small epsilon to account for fractional pixels
  nextDisabled.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}

function scrollBy(delta: number) {
  const el = container.value
  if (!el) return
  el.scrollBy({ left: delta, behavior: 'smooth' })
}

function prev() {
  const el = container.value
  if (!el) return
  scrollBy(-el.clientWidth * 0.9)
}

function next() {
  const el = container.value
  if (!el) return
  scrollBy(el.clientWidth * 0.9)
}

let resizeObserver: ResizeObserver | null = null

function attachListeners(el: HTMLElement | null) {
  if (!el) return
  el.addEventListener('scroll', updateDisabled, { passive: true })
  resizeObserver = new ResizeObserver(updateDisabled)
  resizeObserver.observe(el)
}

function detachListeners(el: HTMLElement | null) {
  if (!el) return
  el.removeEventListener('scroll', updateDisabled)
  if (resizeObserver) {
    try { resizeObserver.unobserve(el) } catch (e) { /* ignore */ }
  }
  resizeObserver = null
}

onMounted(() => {
  // initial attach (if container already set)
  nextTick(() => {
    attachListeners(container.value)
    updateDisabled()
  })
})

// Watch for container ref changes (loading -> items swap) and reattach listeners
watch(container, async (newEl, oldEl) => {
  detachListeners(oldEl)
  if (newEl) {
    // wait for layout to stabilize
    await nextTick()
    attachListeners(newEl)
    // small timeout to ensure measurements reflect rendered content
    setTimeout(updateDisabled, 50)
  }
})

onBeforeUnmount(() => {
  detachListeners(container.value)
})

// Fetch data if needed
if (!props.items && (props.genre || props.type)) {
  const params: any = {}
  if (props.genre) params.genre = props.genre
  if (props.type) params.type = props.type

  const key = `carousel-${props.title}-${JSON.stringify(params)}`

  const { data, pending } = useFetch<{ items: Item[] }>('/api/catalogue', {
    params,
    key,
    server: false
  })

  // Watch for data changes
  watchEffect(() => {
    loading.value = pending.value
    items.value = data.value?.items || []
  })
}
</script>

<template>
  <Carousel
    :title="title"
    :prevDisabled="prevDisabled"
    :nextDisabled="nextDisabled"
    @prev="prev"
    @next="next"
  >
  <!-- Loading state -->
  <div v-if="loading" class="carousel-scroll flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
      <div
        v-for="i in 8"
        :key="i"
        class="snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse w-[200px] min-h-[320px]"
      />
    </div>

    <!-- Items -->
  <div v-else ref="container" class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
      <div v-for="item in items" :key="item.id" class="snap-start shrink-0 group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 w-[200px] min-h-[320px] flex flex-col cursor-pointer">
        <NuxtLink
          :to="`/anime/${item.id}`"
          class="group block w-[200px] h-[320px] flex-none shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          :aria-label="item.title"
        >

            <!-- Image area -->
            <div class="h-[240px] relative overflow-hidden">
              <img :src="item.image" :alt="item.title" class="w-[200px] h-[240px] object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" fetchpriority="low" />

              <!-- Play overlay -->
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Icon name="heroicons:play" class="w-12 h-12 text-white drop-shadow-lg" />
                </div>
              </div>

            </div>

            <!-- Title area -->
            <div class="min-h-[80px] p-3 bg-zinc-900 flex flex-col justify-between">
              <h3 class="font-medium text-white text-sm mb-1 group-hover:text-violet-400 transition-colors line-clamp-3">{{ item.title }}</h3>
            </div>
        </NuxtLink>
      </div>
    </div>
  </Carousel>
</template>

<style scoped>
/* Hide native scrollbar but keep scrolling functional */
.carousel-scroll {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
.carousel-scroll::-webkit-scrollbar {
  display: none; /* WebKit */
}
.object-cover { image-rendering: -webkit-optimize-contrast; }
</style>