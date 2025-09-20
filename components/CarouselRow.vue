<template>
  <section class="section">
    <div class="flex justify-between items-center mb-4 px-20">
      <h3 class="row-title">{{ title }}</h3>

      <div class="flex items-center gap-5">
        <button type="button" @click="scroll(-1)">
          <ClientOnly>
            <Icon name="grommet-icons:form-previous"></Icon>
          </ClientOnly>
        </button>

        <button type="button" @click="scroll(1)">
          <ClientOnly>
            <Icon name="grommet-icons:form-next"></Icon>
          </ClientOnly>
        </button>
      </div>
    </div>

    <div class="relative">
      <!-- Edge fades -->
      <div aria-hidden class="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-zinc-950 to-transparent" />
      <div aria-hidden class="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-zinc-950 to-transparent" />

      <div ref="track" class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-20 pr-20 scroll-pl-20 scroll-pr-20">
        <template v-if="loading && localItems.length === 0">
          <div v-for="i in 8" :key="i" :class="['snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12]', itemWidthClass]" />
        </template>
        <template v-else>
          <CardPoster v-for="item in localItems" :key="item.id" :to="`/anime/${item.id}`" :src="item.image" :title="item.title"
            :size="cardSize" :class="['snap-start shrink-0', itemWidthClass]" />
        </template>
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
type Item = { id: string; title: string; image: string }

const props = defineProps<{ title: string; cardSize?: 'sm' | 'md' | 'lg'; genre?: string | string[]; items?: Item[] }>()

// Tailwind arbitrary width classes for each poster card (larger sizes)
const itemWidthClass = computed(() => ({
  sm: 'w-[170px]',
  md: 'w-[200px]',
  lg: 'w-[240px]'
}[(props.cardSize || 'md')]))

const track = ref<HTMLDivElement | null>(null)
function scroll(dir: 1 | -1) {
  const el = track.value
  if (!el) return
  const child = el.querySelector('.poster') as HTMLElement | null
  // gap-5 = 1.25rem = 20px
  const gap = 20
  const step = child ? child.offsetWidth + gap : 180
  el.scrollBy({ left: dir * step * 3, behavior: 'smooth' })
}

// SSR-friendly fetch: if `genre` provided use API, otherwise use passed `items`
const hasGenre = Array.isArray(props.genre) ? props.genre.length > 0 : !!props.genre
let fetching = false
const loading = ref(false)
const localItems = ref<Item[]>(props.items || [])

if (hasGenre) {
  fetching = true
  loading.value = true
  const key = `carousel:${Array.isArray(props.genre) ? props.genre.join(',') : String(props.genre)}`
  const { data } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
    params: { genre: props.genre as any },
    key
  })
  localItems.value = data.value?.items || []
  loading.value = false
}
</script>
