// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false }, // Disable in production for better performance

  modules: [
    [
      '@nuxt/icon',
      {
        serverBundle: 'local' // Optimize icon loading
      }
    ],
    '@nuxt/image',
    '@nuxtjs/tailwindcss'
  ],

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
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    // Public configuration (exposed to client-side)
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
    }
  },

  // Advanced Vite optimizations
  vite: {
    resolve: {
      dedupe: ['vue', 'vue-router', '@vue/runtime-core', '@vue/runtime-dom']
    },
    build: {
      rollupOptions: {
        external: [
          'bcryptjs', // Exclude bcryptjs from client bundle
          '@supabase/supabase-js', // Exclude Supabase from client bundle
          '@supabase/postgrest-js', // Exclude PostgREST from client bundle
          'pg', // Exclude PostgreSQL client from client bundle
          'cheerio' // Exclude Cheerio from client bundle
        ],
        output: {
          manualChunks: (id) => {
            // Split large libraries into separate chunks
            if (id.includes('video.js') || id.includes('hls.js')) {
              return 'video-player'
            }
            if (id.includes('jsonwebtoken')) {
              return 'auth'
            }
            if (id.includes('@nuxt/icon')) {
              return 'icons'
            }
            // Split Vue ecosystem
            if (id.includes('vue') || id.includes('vue-router')) {
              return 'vue-vendor'
            }
            // Split UI components
            if (id.includes('tailwindcss') || id.includes('@nuxt')) {
              return 'ui-vendor'
            }
          }
        }
      },
      // Enable source maps only in development
      sourcemap: process.env.NODE_ENV === 'development',
      // Optimize chunk size
      chunkSizeWarningLimit: 1000, // Increase limit to reduce warnings
      // Aggressive minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
          drop_debugger: process.env.NODE_ENV === 'production',
          pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.info', 'console.debug'] : []
        }
      }
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'video.js',
        'hls.js',
        '@videojs/http-streaming',
        'vue',
        'vue-router'
      ],
      exclude: ['@nuxt/devtools'] // Exclude dev tools from optimization
    },
    // CSS optimization
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/css/main.css" as *;'
        }
      }
    }
  },

  // Image optimization
  image: {
    format: ['webp', 'avif', 'png', 'jpg'],
    quality: 80,
    sizes: '320,640,768,1024,1280,1536'
  },

  // CSS optimization
  tailwindcss: {
    // Enable JIT mode for better performance
    config: {
      mode: 'jit',
      content: [
        "./components/**/*.{js,vue,ts}",
        "./layouts/**/*.vue",
        "./pages/**/*.vue",
        "./plugins/**/*.{js,ts}",
        "./nuxt.config.{js,ts}",
        "./app.vue"
      ]
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
    // Enable compression
    compressPublicAssets: true,
    // Optimize prerendering
    prerender: {
      routes: ['/']
    },
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': 'Content-Type,Authorization',
          'access-control-allow-credentials': 'true'
        }
      },
      // Aggressive caching for static assets
      '/favicon.ico': { cache: { maxAge: 86400 * 30 } }, // 30 days
      '/robots.txt': { cache: { maxAge: 86400 * 7 } }, // 7 days
      '/sw.js': { cache: { maxAge: 0 } }, // No cache for service worker
      // Cache Nuxt chunks aggressively
      '/_nuxt/**': { cache: { maxAge: 86400 * 30, immutable: true } }
    },
    // Optimize bundle
    experimental: {
      wasm: true
    },
    // HTTP/2 optimizations
    http2: {
      push: [
        '/_nuxt/entry.css',
        '/_nuxt/entry.js'
      ]
    }
  },

  ssr: true,



  // Performance optimizations
  experimental: {
    payloadExtraction: false // Reduce initial bundle size
  },

  // Critical CSS and resource hints
  app: {
    head: {
      htmlAttrs: {
        lang: 'fr'
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#000000' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        // Preload critical fonts
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        // DNS prefetch for external resources
        { rel: 'dns-prefetch', href: 'https://anime-sama.fr' },
        { rel: 'dns-prefetch', href: 'https://video.sibnet.ru' }
      ]
    }
  }
})