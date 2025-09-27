// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/icon', '@nuxt/image', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
    // Runtime configuration for environment variables
    runtimeConfig: {
      // Server-side configuration (private keys) - these will be overridden by env vars
      searchApiUrl: "https://anime-sama.fr/template-php/defaut/fetch.php",
      searchApiTimeoutMs: "10000",
      // JWT configuration
      jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-this-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      // Supabase configuration
      supabaseUrl: process.env.gazes_SUPABASE_URL,
      supabaseAnonKey: process.env.gazes_SUPABASE_ANON_KEY,
      supabaseJwtSecret: process.env.gazes_SUPABASE_JWT_SECRET,
      supabaseServiceRoleKey: process.env.gazes_SUPABASE_SERVICE_ROLE_KEY,
      // Database configuration (for compatibility)
      postgresUrl: process.env.gazes_POSTGRES_URL,
      postgresPrismaUrl: process.env.gazes_POSTGRES_PRISMA_URL,
      postgresUrlNonPooling: process.env.gazes_POSTGRES_URL_NON_POOLING,
      postgresUser: process.env.gazes_POSTGRES_USER,
      postgresHost: process.env.gazes_POSTGRES_HOST,
      postgresPassword: process.env.gazes_POSTGRES_PASSWORD,
      postgresDatabase: process.env.gazes_POSTGRES_DATABASE,
      // Public configuration (exposed to client-side)
      public: {
        supabaseUrl: process.env.gazes_NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: process.env.gazes_NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    },
  // Ensure a single Vue runtime instance in the client bundle to avoid hydration issues
  vite: {
    resolve: {
      dedupe: ['vue', 'vue-router', '@vue/runtime-core', '@vue/runtime-dom']
    }
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
      '/api/**': {
        cors: true,
        headers: {
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': 'Content-Type,Authorization',
          'access-control-allow-credentials': 'true'
        }
      }
    }
  },
  ssr: true
})