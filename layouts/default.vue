<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <div>
    <SiteHeader />

    <main>
      <slot />
    </main>
  </div>
</template>