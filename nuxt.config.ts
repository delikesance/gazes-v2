// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/icon', '@nuxt/image', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  // Ensure a single Vue runtime instance in the client bundle to avoid hydration issues
  vite: {
    resolve: {
      dedupe: ['vue', 'vue-router', '@vue/runtime-core', '@vue/runtime-dom']
    }
  },
  tailwindcss: {
    exposeConfig: true,
    viewer: true,
    // and more...
  },
  future: {
    compatibilityVersion: 4
  },
  srcDir: '.',
  dir: {
    pages: 'pages'
  },
  nitro: {
    routeRules: {
      '/api/**': { cors: true, headers: { 'access-control-allow-methods': 'GET' } }
    }
  },
  ssr: true
})