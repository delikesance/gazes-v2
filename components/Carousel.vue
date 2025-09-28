<template>
  <section class="section">
    <div class="flex justify-between items-center mb-4 px-5 md:px-20">
  <h3 class="row-title">{{ props.title || 'Continuer à regarder' }}</h3>
          <div class="flex items-center gap-5">
            <button
              type="button"
              :class="['transition-opacity', { 'opacity-50': props.prevDisabled, 'opacity-100': !props.prevDisabled } ]"
              :disabled="props.prevDisabled"
              @click="$emit('prev')"
            >
              <Icon name="grommet-icons:form-previous" />
            </button>
            <button
              type="button"
              :class="['transition-opacity', { 'opacity-50': props.nextDisabled, 'opacity-100': !props.nextDisabled } ]"
              :disabled="props.nextDisabled"
              @click="$emit('next')"
            >
              <Icon name="grommet-icons:form-next" />
            </button>
          </div>
    </div>

    <div class="relative">
      <!-- Gradient overlays -->
      <div
        aria-hidden
        class="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-zinc-950 to-transparent"
      />
      <div
        aria-hidden
        class="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-zinc-950 to-transparent"
      />

      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  title?: string
  prevDisabled?: boolean | undefined
  nextDisabled?: boolean | undefined
}>()
const emit = defineEmits(['prev', 'next'])
</script>

<style scoped>
</style>