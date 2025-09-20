<template>
  <NuxtLink
    class="poster relative block overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/30 aspect-[9/12]"
    :to="to"
    :style="{ '--poster-w': posterWidth } as any"
  >
    <NuxtImg
      :src="src"
      :alt="title"
      :sizes="sizesAttr"
      class="absolute inset-0 h-full w-full object-cover"
    />
    <div class="absolute inset-0 z-10 bg-gradient-to-t from-zinc-950" />
    <div class="absolute inset-x-0 bottom-0 z-20 px-2 pb-2 pt-1 font-medium overflow-hidden line-clamp-2 [text-wrap:balance] [hyphens:auto]"
      :class="[titleSizeClass, titleWrapClass]">
      {{ title }}
    </div>
  </NuxtLink>
  
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Size = 'sm' | 'md' | 'lg'
const props = defineProps<{ to: string; src: string; title: string; size?: Size }>()

const posterWidth = computed(() => ({ sm: '170px', md: '200px', lg: '240px' }[(props.size || 'md')]))
const sizesAttr = computed(() => {
  const map: Record<Size, string> = {
    sm: '170px sm:190px md:200px',
    md: '200px sm:220px md:240px',
    lg: '240px sm:260px md:300px',
  }
  return map[(props.size || 'md') as Size]
})

// Tweak font size/leading to maximize readability within two clamped lines
const titleSizeClass = computed(() => {
  const len = (props.title || '').length
  if (len > 90) return 'text-[10px] leading-tight tracking-tighter'
  if (len > 70) return 'text-[11px] leading-tight tracking-tighter'
  if (len > 50) return 'text-[12px] leading-tight tracking-tight'
  if (len > 38) return 'text-[13px] leading-tight tracking-tight'
  return 'text-sm md:text-base leading-snug'
})

const titleWrapClass = computed(() => {
  const t = (props.title || '').trim()
  if (!t) return 'break-words'
  const tokens = t.split(/[\s\-–—·:]+/).filter(Boolean)
  const longest = tokens.reduce((m, s) => Math.max(m, s.length), 0)
  const hasSpace = /\s/.test(t)
  if (!hasSpace || longest > 24) {
    // Extremely long or spaceless strings: allow breaking anywhere
    return '[overflow-wrap:anywhere] break-words'
  }
  if (longest > 16) {
    // Long tokens: be more aggressive with wrapping
    return '[overflow-wrap:anywhere] break-words'
  }
  return 'whitespace-normal break-words'
})
</script>
