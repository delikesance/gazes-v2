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
    searchApiUrl: "https://179.43.149.218/template-php/defaut/fetch.php",
    searchApiTimeoutMs: "10000",
    catalogueTimeoutMs: "15000",
    // JWT configuration
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-this-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    // Supabase configuration
    supabaseUrl: process.env.SUPABASE_URL || 'https://znhwphabiefwnxzfgxjw.supabase.co',
    supabaseKey: process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuaHdwaGFiaWVmd254emZneGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNDgzMjcsImV4cCI6MjA3NDYyNDMyN30.r3QOo29KoEKnTMpJhSEPRnbp0RNirLBJAN3VOL4ByTs',
    // Public configuration (exposed to client-side)
    public: {
      supabaseUrl: process.env.SUPABASE_URL || 'https://znhwphabiefwnxzfgxjw.supabase.co',
      supabaseKey: process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuaHdwaGFiaWVmd254emZneGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNDgzMjcsImV4cCI6MjA3NDYyNDMyN30.r3QOo29KoEKnTMpJhSEPRnbp0RNirLBJAN3VOL4ByTs',
    }
  },

  // Simplified Vite configuration for Vercel compatibility
  vite: {
    resolve: {
      dedupe: ['vue', 'vue-router', '@vue/runtime-core', '@vue/runtime-dom']
    },
    build: {
      rollupOptions: {
        external: [
          'bcryptjs',
          '@supabase/supabase-js',
          '@supabase/postgrest-js',
          'pg'
        ],
        output: {
          manualChunks(id) {
            // Video libraries chunk
            if (id.includes('video.js') || 
                id.includes('hls.js') || 
                id.includes('@videojs/http-streaming') ||
                id.includes('videojs')) {
              return 'video-vendor';
            }
            // Large libraries that should be separated
            if (id.includes('node_modules')) {
              // Group common large libraries
              if (id.includes('vue') || id.includes('vue-router')) {
                return 'vue-vendor';
              }
              if (id.includes('@nuxt') || id.includes('nuxt')) {
                return 'nuxt-vendor';
              }
              if (id.includes('tailwindcss') || id.includes('autoprefixer')) {
                return 'css-vendor';
              }
              // Other node_modules in a general vendor chunk
              return 'vendor';
            }
          }
        }
      },
      sourcemap: false,
      minify: 'terser',
      chunkSizeWarningLimit: 1000
    },
    optimizeDeps: {
      include: [
        'video.js',
        'hls.js',
        '@videojs/http-streaming',
        'vue',
        'vue-router'
      ],
      exclude: ['@nuxt/devtools']
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
    config: {
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
     preset: process.env.VERCEL ? 'vercel' : 'node-server',
     compressPublicAssets: true,
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
        // Static assets with aggressive caching
        '/favicon.ico': { cache: { maxAge: 86400 * 30 } },
        '/robots.txt': { cache: { maxAge: 86400 * 7 } },
        '/sw.js': { cache: { maxAge: 0 } },
        '/_nuxt/**': {
          cache: {
            maxAge: 86400 * 30
          },
          headers: {
            'cache-control': 'public, max-age=2592000, immutable'
          }
        },
        // Images with appropriate caching
        '/_ipx/**': {
          cache: {
            maxAge: 86400 * 7
          },
          headers: {
            'cache-control': 'public, max-age=604800'
          }
        }
      }
   },

  ssr: true,

  // Performance optimizations
  experimental: {
    payloadExtraction: false,
    // Enable component lazy loading
    componentIslands: true
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
        { rel: 'dns-prefetch', href: 'https://179.43.149.218' },
        { rel: 'dns-prefetch', href: 'https://video.sibnet.ru' }
      ]
    }
  }
})
