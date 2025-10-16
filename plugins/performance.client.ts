// Performance optimization plugin for critical loading improvements
export default defineNuxtPlugin(() => {
  // Only run on client side
  if (import.meta.server) return

  // Preload critical resources
  const preloadCriticalResources = () => {
    // Critical CSS for instant visual feedback - above the fold content
    const criticalCSS = `
      /* Base theme tokens - critical for initial render */
      :root {
        --bg: #09090b;
        --panel: rgba(24,24,27,0.6);
        --border: #27272a;
        --text: #fafafa;
        --ink: #e4e4e7;
        --muted: #a1a1aa;
        --accent: #7c3aed;
        --accent-600: #6d28d9;
      }

      /* Critical HTML/body styles */
      html {
        background: #09090b;
        color: #fafafa;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-display: swap;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
      }

      /* Critical loading states */
      .loading {
        opacity: 0;
        animation: criticalFadeIn 0.15s ease-out forwards;
      }

      .loaded {
        opacity: 1;
      }

      @keyframes criticalFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Ultra-fast loading spinner */
      .loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #7c3aed;
        animation: criticalSpin 0.8s linear infinite;
      }

      @keyframes criticalSpin {
        to { transform: rotate(360deg); }
      }

      /* Critical button styles for interactions */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        transition: colors 0.15s ease;
        border: 1px solid transparent;
        background: transparent;
        color: #e4e4e7;
        text-decoration: none;
        cursor: pointer;
      }

      .btn.primary {
        background: #7c3aed;
        color: white;
        border-color: #7c3aed;
      }

      .btn.primary:hover {
        background: #6d28d9;
      }

      /* Critical card styles */
      .card {
        background: rgba(24,24,27,0.6);
        backdrop-filter: blur(8px);
        border: 1px solid #27272a;
        border-radius: 0.75rem;
      }

      /* Hide scrollbar during loading */
      body.loading {
        overflow: hidden;
      }

      /* Critical responsive utilities */
      @media (max-width: 640px) {
        .hidden-mobile { display: none; }
      }

      /* Critical header styles for above-the-fold */
      header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 50;
        background: rgba(9, 9, 11, 0.8);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid #27272a;
      }

      /* Critical hero/banner styles */
      .hero-banner {
        min-height: 60vh;
        display: flex;
        align-items: center;
        background: linear-gradient(135deg, #09090b 0%, #1a1a1e 100%);
      }

      /* Critical poster grid for above-the-fold content */
      .poster-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .poster-item {
        flex: 1 1 calc(50% - 1rem);
        aspect-ratio: 9/12;
      }

      @media (min-width: 640px) {
        .poster-item { flex: 1 1 calc(33.333% - 1rem); }
      }

      @media (min-width: 768px) {
        .poster-item { flex: 1 1 calc(25% - 1rem); }
      }

      @media (min-width: 1024px) {
        .poster-item { flex: 1 1 calc(20% - 1rem); }
      }
    `

    // Inject critical CSS immediately
    const style = document.createElement('style')
    style.textContent = criticalCSS
    document.head.appendChild(style)

    // Load full CSS asynchronously to avoid render blocking
    const loadFullCSS = () => {
      // Find existing CSS links and make them load asynchronously
      const cssLinks = document.querySelectorAll('link[rel="stylesheet"]')
      cssLinks.forEach(link => {
        const linkElement = link as HTMLLinkElement
        const href = linkElement.getAttribute('href')
        if (href && !href.includes('entry')) { // Don't async load entry CSS as it's critical
          linkElement.setAttribute('media', 'print')
          linkElement.onload = () => {
            linkElement.setAttribute('media', 'all')
          }
        }
      })
    }

    // Load full CSS after critical render
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadFullCSS)
    } else {
      loadFullCSS()
    }

    // Preload critical fonts
    const fontLink = document.createElement('link')
    fontLink.rel = 'preload'
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
    fontLink.as = 'style'
    fontLink.onload = () => {
      fontLink.rel = 'stylesheet'
    }
    document.head.appendChild(fontLink)

    // Preconnect to external domains
    const domains = ['https://179.43.149.218', 'https://video.sibnet.ru', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']
    domains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = domain
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })
  }

  // Optimize loading states
  const optimizeLoadingStates = () => {
    // Add loading class to body for CSS optimizations
    document.body.classList.add('loading')

    // Remove loading class when page is ready
    const removeLoading = () => {
      document.body.classList.remove('loading')
      document.body.classList.add('loaded')
    }

    // Remove loading after initial render
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', removeLoading)
    } else {
      removeLoading()
    }

    // Also remove on Nuxt ready
    useNuxtApp().$router?.afterEach?.(() => {
      setTimeout(removeLoading, 100)
    })
  }

  // Implement resource hints for critical pages
  const addResourceHints = () => {
    const currentRoute = useRoute()

    // Preload video player resources for watch pages
    if (currentRoute.path.startsWith('/watch/')) {
      // Use dynamic imports to preload video player chunk
      import('video.js').then(() => {
        // Video.js loaded
      })
    }
  }
  const optimizeIntersectionObserver = () => {
    // Use a single shared IntersectionObserver for better performance
    const observerOptions = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement
          // Handle lazy loading
          if (target.dataset.src) {
            (target as HTMLImageElement).src = target.dataset.src
            delete target.dataset.src
          }
          // Handle lazy CSS classes
          if (target.dataset.lazyClass) {
            target.classList.add(target.dataset.lazyClass)
            delete target.dataset.lazyClass
          }
          observer.unobserve(target)
        }
      })
    }, observerOptions)

    // Make observer globally available
    ;(window as any).lazyObserver = observer
  }

  // Optimize scroll performance
  const optimizeScrollPerformance = () => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Handle scroll-based optimizations here
          ticking = false
        })
        ticking = true
      }
    }

    // Throttle scroll events
    window.addEventListener('scroll', handleScroll, { passive: true })
  }

  // Register service worker for caching
  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })


        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
              }
            })
          }
        })

      } catch (error) {
      }
    }
  }

  // Initialize all optimizations
  const init = () => {
    preloadCriticalResources()
    optimizeLoadingStates()
    addResourceHints()
    optimizeIntersectionObserver()
    optimizeScrollPerformance()
    registerServiceWorker()

  }

  // Run optimizations on mount
  onMounted(() => {
    init()
  })

  // Cleanup on unmount
  onBeforeUnmount(() => {
    if ((window as any).lazyObserver) {
      (window as any).lazyObserver.disconnect()
    }
  })
})