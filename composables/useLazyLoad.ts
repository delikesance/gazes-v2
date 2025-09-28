// Optimized lazy loading composable for images and components
export const useLazyLoad = () => {
  // Shared IntersectionObserver for better performance
  let observer: IntersectionObserver | null = null

  const getObserver = () => {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement

              // Handle lazy images
              if (target.tagName === 'IMG' && target.dataset.src) {
                const img = target as HTMLImageElement
                img.src = target.dataset.src
                img.classList.add('loaded')
                delete target.dataset.src
                observer!.unobserve(target)
              }

              // Handle lazy backgrounds
              if (target.dataset.bgSrc) {
                target.style.backgroundImage = `url(${target.dataset.bgSrc})`
                target.classList.add('bg-loaded')
                delete target.dataset.bgSrc
                observer!.unobserve(target)
              }

              // Handle lazy components
              if (target.dataset.component) {
                // Trigger component loading
                const event = new CustomEvent('lazy-load-component', {
                  detail: { component: target.dataset.component, element: target }
                })
                window.dispatchEvent(event)
                observer!.unobserve(target)
              }
            }
          })
        },
        {
          root: null,
          rootMargin: '50px 0px', // Start loading 50px before entering viewport
          threshold: 0.01 // Trigger as soon as 1% is visible
        }
      )
    }
    return observer
  }

  // Lazy load image
  const lazyLoadImage = (img: HTMLImageElement, src: string, placeholder?: string) => {
    if (placeholder) {
      img.src = placeholder
    }
    img.dataset.src = src
    img.classList.add('lazy-image')
    getObserver().observe(img)
  }

  // Lazy load background image
  const lazyLoadBackground = (element: HTMLElement, src: string) => {
    element.dataset.bgSrc = src
    element.classList.add('lazy-bg')
    getObserver().observe(element)
  }

  // Lazy load component
  const lazyLoadComponent = (element: HTMLElement, componentName: string) => {
    element.dataset.component = componentName
    element.classList.add('lazy-component')
    getObserver().observe(element)
  }

  // Preload critical images
  const preloadCriticalImages = (images: string[]) => {
    images.forEach(src => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = src
      link.as = 'image'
      document.head.appendChild(link)
    })
  }

  // Preload critical scripts
  const preloadCriticalScripts = (scripts: string[]) => {
    scripts.forEach(src => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = src
      link.as = 'script'
      document.head.appendChild(link)
    })
  }

  // Cleanup observer
  const cleanup = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  return {
    lazyLoadImage,
    lazyLoadBackground,
    lazyLoadComponent,
    preloadCriticalImages,
    preloadCriticalScripts,
    cleanup
  }
}