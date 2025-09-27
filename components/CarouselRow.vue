<script setup lang="ts">
import { ref, watchEffect } from 'vue'

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
  <Carousel :title="title">
    <!-- Loading state -->
    <div v-if="loading" class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
      <div
        v-for="i in 8"
        :key="i"
        class="snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse w-[200px] h-[320px]"
      />
    </div>

    <!-- Items -->
    <div v-else class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-5 md:pl-20 pr-5 md:pr-20 scroll-pl-5 md:scroll-pl-20 scroll-pr-5 md:scroll-pr-20">
      <CardPoster
        v-for="item in items"
        :key="item.id"
        :to="`/anime/${item.id}`"
        :src="item.image"
        :title="item.title"
      />
    </div>
  </Carousel>
</template>

<style scoped>
</style>