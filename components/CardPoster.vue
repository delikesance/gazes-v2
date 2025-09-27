<template>
  <NuxtLink
    :to="to"
    :aria-label="`Watch ${title}`"
    class="snap-start shrink-0 group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 w-[200px] h-[320px] flex flex-col"
  >
    <!-- Poster image -->
    <div class="h-[240px] relative overflow-hidden">
      <NuxtImg
        :src="src"
        :alt="title"
        :sizes="imageSizes"
        class="w-[200px] h-[240px] object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />

      <!-- Play overlay -->
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
        <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Icon name="heroicons:play" class="w-12 h-12 text-white drop-shadow-lg" />
        </div>
      </div>
    </div>

    <!-- Content info -->
    <div class="h-[80px] p-3 bg-zinc-900 flex flex-col justify-between">
      <div>
        <h4 class="font-medium text-white text-sm line-clamp-2 mb-1 group-hover:text-violet-400 transition-colors">
          {{ title }}
        </h4>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
interface Props {
  to: string
  src: string
  title: string
}

defineProps<Props>()

const imageSizes = '200px'
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
}
</style>