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
    searchApiUrl: process.env.SEARCH_API_URL || "https://179.43.149.218/template-php/defaut/fetch.php",
    catalogueApiUrl: process.env.CATALOGUE_API_URL || "https://179.43.149.218",
    searchApiTimeoutMs: "10000",
    catalogueTimeoutMs: "15000",
    // JWT configuration
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    // Supabase configuration
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    // Public configuration (exposed to client-side)
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      siteUrl: process.env.SITE_URL || 'https://gazes.fr'
    }
  },

  // Simplified Vite configuration for Vercel compatibility
  vite: {
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    resolve: {
      alias: {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        os: require.resolve('os-browserify/browser'),
        path: require.resolve('path-browserify')
      },
      dedupe: ['vue', 'vue-router', '@vue/runtime-core', '@vue/runtime-dom']
    },
    build: {
      rollupOptions: {
        // Ne rien externaliser côté client pour éviter les erreurs d'exports
        external: [],
        output: {
          manualChunks: {
            // Separate large libraries
            vue: ['vue', 'vue-router'],
            videojs: ['video.js', 'hls.js', '@videojs/http-streaming']
          }
        }
      },
      sourcemap: false,
      minify: 'terser',
      chunkSizeWarningLimit: 500,
      // Assurer la compatibilité CommonJS
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: false, // Disable this as it can cause issues
        // Configuration pour bien gérer les exports
        defaultIsModuleExports: 'auto'
      }
    },
    optimizeDeps: {
      include: [
        'video.js',
        'hls.js',
        '@videojs/http-streaming',
        'vue',
        'vue-router'
      ],
      exclude: ['@nuxt/devtools'],
      // Force la pré-optimisation des dépendances problématiques
      force: true
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
     // Configuration pour éviter les erreurs d'exports côté serveur
     rollupConfig: {
       external: ['bcryptjs', 'pg', '@supabase/supabase-js', '@supabase/postgrest-js', 'jsonwebtoken']
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
