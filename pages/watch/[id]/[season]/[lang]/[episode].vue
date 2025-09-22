<script setup lang="ts">
import Hls from 'hls.js'
import { onBeforeUnmount, onMounted, ref, watch, nextTick, computed } from 'vue'

// Use player layout (no navbar)
definePageMeta({
  layout: 'player'
})

const route = useRoute()

// Get route params as refs
const id = ref(route.params.id as string)
const season = ref(route.params.season as string)
const lang = ref(route.params.lang as 'vostfr' | 'vf' | 'va' | 'var' | 'vkr' | 'vcn' | 'vqc' | 'vf1' | 'vf2' | 'vj')
const episodeNum = ref(Number(route.params.episode))
const debug = computed(() => route.query.debug === '1' || route.query.debug === 'true')

const showPlayer = ref(true)
const playUrl = ref('')
const currentSourceIndex = ref(0)
const resolving = ref(false)
const resolveError = ref('')
const resolvedList = ref<{ type: string; url: string; proxiedUrl: string; quality?: string }[]>([])
const notice = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)
const videoError = ref('')
const videoLoading = ref(false)

// Custom controls state
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isFullscreen = ref(false)
const showControls = ref(true)
const controlsTimeout = ref<number | null>(null)
const isDragging = ref(false)
const buffered = ref(0)
const isSeeking = ref(false)
const wasPlayingBeforeSeek = ref(false) // Track if video was playing before seek

// Animation frame for smooth progress updates
let progressAnimationFrame: number | null = null

function updateProgressSmoothly() {
  const el = videoRef.value
  if (el && !el.paused && !el.ended) {
    currentTime.value = el.currentTime
    if (el.buffered.length > 0) {
      buffered.value = el.buffered.end(el.buffered.length - 1)
    }
    progressAnimationFrame = requestAnimationFrame(updateProgressSmoothly)
  }
}

function startProgressUpdates() {
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame)
  }
  updateProgressSmoothly()
}

function stopProgressUpdates() {
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame)
    progressAnimationFrame = null
  }
}

// Episode selector state
const showEpisodes = ref(false)
const episodesList = ref<Array<{ episode: number; title?: string; url: string; urls?: string[] }>>([])
const loadingEpisodes = ref(false)

// Language switcher state
const availableLanguages = ref<{ 
  vostfr: boolean; 
  vf: boolean; 
  va: boolean; 
  var: boolean; 
  vkr: boolean; 
  vcn: boolean; 
  vqc: boolean; 
  vf1: boolean; 
  vf2: boolean; 
  vj: boolean 
}>({
  vostfr: false,
  vf: false,
  va: false,
  var: false,
  vkr: false,
  vcn: false,
  vqc: false,
  vf1: false,
  vf2: false,
  vj: false
})
const switchingLanguage = ref(false)
const showLanguageDropdown = ref(false)

// Computed for language options
const languageOptions = computed(() => {
  const options = []
  if (availableLanguages.value.vostfr) {
    const emoji = dynamicLanguageFlags.value['vostfr'] || '��🇳' // Fallback to Chinese flag
    options.push({ code: 'vostfr', label: `${emoji} VOSTFR`, fullLabel: 'Version Originale Sous-Titrée Français' })
  }
  if (availableLanguages.value.vf) {
    const emoji = dynamicLanguageFlags.value['vf'] || '🇫🇷'
    options.push({ code: 'vf', label: `${emoji} VF`, fullLabel: 'Version Française' })
  }
  if (availableLanguages.value.va) {
    const emoji = dynamicLanguageFlags.value['va'] || '🇺🇸'
    options.push({ code: 'va', label: `${emoji} VA`, fullLabel: 'Version Anglaise' })
  }
  if (availableLanguages.value.var) {
    const emoji = dynamicLanguageFlags.value['var'] || '🇸🇦'
    options.push({ code: 'var', label: `${emoji} VAR`, fullLabel: 'Version Arabe' })
  }
  if (availableLanguages.value.vkr) {
    const emoji = dynamicLanguageFlags.value['vkr'] || '🇰🇷'
    options.push({ code: 'vkr', label: `${emoji} VKR`, fullLabel: 'Version Coréenne' })
  }
  if (availableLanguages.value.vcn) {
    const emoji = dynamicLanguageFlags.value['vcn'] || '🇨🇳'
    options.push({ code: 'vcn', label: `${emoji} VCN`, fullLabel: 'Version Chinoise' })
  }
  if (availableLanguages.value.vqc) {
    const emoji = dynamicLanguageFlags.value['vqc'] || '🇨🇦'
    options.push({ code: 'vqc', label: `${emoji} VQC`, fullLabel: 'Version Québécoise' })
  }
  if (availableLanguages.value.vf1) {
    const emoji = dynamicLanguageFlags.value['vf1'] || '🇫🇷'
    options.push({ code: 'vf1', label: `${emoji} VF1`, fullLabel: 'Version Française 1' })
  }
  if (availableLanguages.value.vf2) {
    const emoji = dynamicLanguageFlags.value['vf2'] || '🇫🇷'
    options.push({ code: 'vf2', label: `${emoji} VF2`, fullLabel: 'Version Française 2' })
  }
  if (availableLanguages.value.vj) {
    const emoji = dynamicLanguageFlags.value['vj'] || '🇯🇵'
    options.push({ code: 'vj', label: `${emoji} VJ`, fullLabel: 'Version Japonaise' })
  }
  return options
})

// Computed for current language display
const currentLanguageDisplay = computed(() => {
  const current = languageOptions.value.find(opt => opt.code === lang.value)
  return current || { label: lang.value.toUpperCase(), fullLabel: lang.value.toUpperCase() }
})

// Anime and episode metadata
const animeTitle = ref('')
const currentEpisodeTitle = ref('')

// Dynamic language flags from anime-sama.fr
const dynamicLanguageFlags = ref<Record<string, string>>({})


// Computed progress values to avoid recalculating in template
const progressPercent = computed(() => {
  return duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
})

const bufferedPercent = computed(() => {
  return duration.value > 0 ? (buffered.value / duration.value) * 100 : 0
})

let hls: Hls | null = null

function isM3U8(url: string) { return /\.m3u8(\?.*)?$/i.test(url) }

let hlsLoadTimeout: ReturnType<typeof setTimeout> | null = null

function destroyHls() { 
  try {
    if (hls) {
      // Clear any pending timeouts
      if (hlsLoadTimeout) {
        clearTimeout(hlsLoadTimeout)
        hlsLoadTimeout = null
      }
      // Remove Hls event listeners before destroy
      if (hlsErrorHandler) hls.off(Hls.Events.ERROR, hlsErrorHandler)
      if (hlsManifestParsedHandler) hls.off(Hls.Events.MANIFEST_PARSED, hlsManifestParsedHandler)
      hls.destroy()
      hlsErrorHandler = null
      hlsManifestParsedHandler = null
    }
  } catch (e) {
    console.warn('Error destroying HLS:', e)
  }
  hls = null
  stopProgressUpdates() // Stop smooth progress updates
  // Also remove video event listeners
  removeVideoEventListeners(videoRef.value)
}

// Custom controls functions
function togglePlay() {
  const el = videoRef.value
  if (!el) return
  
  if (isPlaying.value) {
    el.pause()
  } else {
    el.play().catch(e => {
      console.log('Play failed:', e)
    })
  }
  showControlsTemporarily()
}

function handleVideoClick(event: MouseEvent) {
  // Just toggle play, don't interfere with episodes panel
  togglePlay()
}

function seek(time: number) {
  const el = videoRef.value
  if (!el) return
  el.currentTime = time
  // Update immediately for instant visual feedback on progress bar
  currentTime.value = time
}

function seekBy(seconds: number) {
  const el = videoRef.value
  if (!el) return
  const newTime = Math.max(0, Math.min(el.duration, el.currentTime + seconds))
  el.currentTime = newTime
  // Update immediately for instant visual feedback on progress bar
  currentTime.value = newTime
}

function toggleMute() {
  const el = videoRef.value
  if (!el) return
  el.muted = !el.muted
  isMuted.value = el.muted
}

function setVolume(newVolume: number) {
  const el = videoRef.value
  if (!el) return
  el.volume = Math.max(0, Math.min(1, newVolume))
  volume.value = el.volume
  if (el.volume > 0) {
    el.muted = false
    isMuted.value = false
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function showControlsTemporarily() {
  showControls.value = true
  if (controlsTimeout.value) {
    clearTimeout(controlsTimeout.value)
  }
  controlsTimeout.value = setTimeout(() => {
    if (isPlaying.value && !isDragging.value) {
      showControls.value = false
    }
  }, 3000)
}

function handleMouseMove() {
  showControlsTemporarily()
}

function handleProgressClick(event: MouseEvent) {
  const el = videoRef.value
  const progressBar = event.currentTarget as HTMLElement
  if (!el || !progressBar) return
  
  const rect = progressBar.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const percentage = clickX / rect.width
  const newTime = percentage * el.duration
  
  seek(newTime)
}

function handleKeyPress(event: KeyboardEvent) {
  const el = videoRef.value
  if (!el) return
  
  switch (event.key) {
    case ' ':
    case 'k':
      event.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
      event.preventDefault()
      seekBy(-10)
      break
    case 'ArrowRight':
      event.preventDefault()
      seekBy(10)
      break
    case 'ArrowUp':
      event.preventDefault()
      setVolume(volume.value + 0.1)
      break
    case 'ArrowDown':
      event.preventDefault()
      setVolume(volume.value - 0.1)
      break
    case 'm':
      event.preventDefault()
      toggleMute()
      break
    case 'f':
      event.preventDefault()
      toggleFullscreen()
      break
    case 'e':
    case 'E':
      event.preventDefault()
      toggleEpisodesPanel()
      break
    case 'l':
    case 'L':
      event.preventDefault()
      if (languageOptions.value.length > 1) {
        const currentIndex = languageOptions.value.findIndex(opt => opt.code === lang.value)
        const nextIndex = (currentIndex + 1) % languageOptions.value.length
        const nextOption = languageOptions.value[nextIndex]
        if (nextOption) {
          switchLanguage(nextOption.code as any)
        }
      }
      break
    case 'Escape':
      event.preventDefault()
      if (showEpisodes.value) {
        showEpisodes.value = false
      } else if (document.fullscreenElement) {
        document.exitFullscreen()
      }
      break
  }
  showControlsTemporarily()
}

// --- Stable handler references for video events ---
function onVideoPlay() { 
  console.log('Video play event - clearing loading state and autoplay error')
  isPlaying.value = true
  videoLoading.value = false // Clear loading when video actually starts
  if (videoError.value && videoError.value.includes('Cliquez')) {
    videoError.value = '' // Clear autoplay error when video starts
  }
  startProgressUpdates() // Start smooth progress updates
  showControlsTemporarily()
}
function onVideoPause() { 
  isPlaying.value = false
  stopProgressUpdates() // Stop smooth progress updates
  showControls.value = true
}
function onVideoTimeUpdate() { handleTimeUpdate() }
function onVideoLoadedMetadata() { handleLoadedMetadata() }
function onVideoVolumeChange() { handleVolumeChange() }
function onVideoSeeking() { 
  isSeeking.value = true
  // Pause video during seeking for smoother experience
  const el = videoRef.value
  if (el && !el.paused) {
    wasPlayingBeforeSeek.value = true
    el.pause()
  } else {
    wasPlayingBeforeSeek.value = false
  }
}
function onVideoSeeked() { 
  isSeeking.value = false
  // Resume playback if video was playing before seek
  const el = videoRef.value
  if (el && wasPlayingBeforeSeek.value && el.paused) {
    el.play().catch(e => {
      console.log('Auto-resume after seek failed:', e)
    })
  }
}
function onVideoError(e: Event) { 
  console.error('Native video error:', e); 
  videoError.value = 'Erreur de chargement vidéo'; 
  videoLoading.value = false
  // Automatically try next source on video error
  setTimeout(() => {
    tryNextSource()
  }, 1000)
}
// --- Stable handler references for Hls events ---
let hlsErrorHandler: ((event: string, data: any) => void) | null = null
let hlsManifestParsedHandler: (() => void) | null = null

// --- Stable handler references for global events ---
function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function removeVideoEventListeners(el: any) {
  if (!el) return
  el.removeEventListener('play', onVideoPlay)
  el.removeEventListener('pause', onVideoPause)
  el.removeEventListener('timeupdate', onVideoTimeUpdate)
  el.removeEventListener('loadedmetadata', onVideoLoadedMetadata)
  el.removeEventListener('volumechange', onVideoVolumeChange)
  el.removeEventListener('seeking', onVideoSeeking)
  el.removeEventListener('seeked', onVideoSeeked)
  el.removeEventListener('error', onVideoError)
}

function addVideoEventListeners(el: any) {
  if (!el) return
  el.addEventListener('play', onVideoPlay)
  el.addEventListener('pause', onVideoPause)
  el.addEventListener('timeupdate', onVideoTimeUpdate)
  el.addEventListener('loadedmetadata', onVideoLoadedMetadata)
  el.addEventListener('volumechange', onVideoVolumeChange)
  el.addEventListener('seeking', onVideoSeeking)
  el.addEventListener('seeked', onVideoSeeked)
  el.addEventListener('error', onVideoError)
}

function handleVideoEvents() {
  const el = videoRef.value
  if (!el) return
  removeVideoEventListeners(el)
  addVideoEventListeners(el)
}

function handlePlay() {
  isPlaying.value = true
  // Clear autoplay error when video actually starts playing
  if (videoError.value && videoError.value.includes('Autoplay')) {
    videoError.value = ''
  }
  showControlsTemporarily()
}

function handlePause() {
  isPlaying.value = false
  showControls.value = true
}

function handleTimeUpdate() {
  const el = videoRef.value
  if (!el) return
  // Only update if not using smooth updates (for paused/seeking states)
  if (!progressAnimationFrame) {
    currentTime.value = el.currentTime
    if (el.buffered.length > 0) {
      buffered.value = el.buffered.end(el.buffered.length - 1)
    }
  }
}

function handleLoadedMetadata() {
  const el = videoRef.value
  if (!el) return
  duration.value = el.duration
  volume.value = el.volume
  isMuted.value = el.muted
  // Ensure initial playing state matches the video element
  isPlaying.value = !el.paused
}

function handleVolumeChange() {
  const el = videoRef.value
  if (!el) return
  volume.value = el.volume
  isMuted.value = el.muted
}

function handleEnded() {
  isPlaying.value = false
  showControls.value = true
}

// Track setup attempts to prevent infinite loops
let setupAttempts = 0

async function setupVideo() {
  const el = videoRef.value
  if (!el || !playUrl.value) {
    console.warn('setupVideo: Missing video element or playUrl')
    return
  }

  // Prevent infinite loops - limit fallback attempts
  if (setupAttempts > 2) {
    console.error('setupVideo: Too many attempts, giving up')
    videoError.value = 'Impossible de charger la vidéo après plusieurs tentatives'
    videoLoading.value = false
    return
  }
  setupAttempts++

  videoError.value = ''
  videoLoading.value = true
  isPlaying.value = false

  // Clear any existing source and HLS instance
  el.pause()
  destroyHls()
  el.removeAttribute('src')
  el.load()

  console.log(`setupVideo: Attempt ${setupAttempts} - Setting up video with URL:`, playUrl.value)
  console.log('setupVideo: Is M3U8:', isM3U8(playUrl.value))
  console.log('setupVideo: HLS.js supported:', Hls.isSupported())
  console.log('setupVideo: Native HLS supported:', el.canPlayType('application/vnd.apple.mpegurl'))

  try {
    if (isM3U8(playUrl.value)) {
      if (Hls.isSupported()) {
        // Use HLS.js for browsers that don't have native HLS support
        hls = new Hls({ 
          enableWorker: true,
          lowLatencyMode: true, // Enable low latency mode for faster loading
          maxLoadingDelay: 1, // Reduce from 2 to 1 second for faster startup
          maxBufferLength: 10, // Reduce from 20 to 10 seconds for faster initial load
          maxBufferSize: 10 * 1000 * 1000, // Reduce from 20MB to 10MB buffer
          maxMaxBufferLength: 200, // Reduce from 300 to 200 seconds
          backBufferLength: 0, // Don't buffer behind current position
          levelLoadingMaxRetry: 2, // Reduce from 3 to 2 retries
          levelLoadingMaxRetryTimeout: 1000, // Reduce from 2000 to 1000ms
          manifestLoadingMaxRetry: 2, // Reduce manifest retries
          manifestLoadingMaxRetryTimeout: 1000, // Faster manifest retry
          fragLoadingMaxRetry: 2, // Reduce from 3 to 2 fragment retries
          fragLoadingMaxRetryTimeout: 1000, // Reduce from 2000 to 1000ms
          // Enable more verbose logging for debugging
          debug: debug.value,
          // Optimize for faster startup
          startLevel: -1, // Auto level selection
          startPosition: 0, // Start from beginning immediately
          maxBufferHole: 0.3, // Reduce from 0.5 to 0.3 for tighter buffering
          maxFragLookUpTolerance: 0.05, // Reduce from 0.1 to 0.05 for faster lookup
        })

        // Attach video element events BEFORE loading HLS
        handleVideoEvents()

        // --- Stable Hls event handlers ---
        hlsErrorHandler = (event, data) => {
          console.error('HLS Error:', data)
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Network error, attempting recovery...')
                videoError.value = 'Erreur réseau lors du chargement de la vidéo'
                // Try to recover network errors
                setTimeout(() => {
                  if (hls) hls.startLoad()
                }, 1000)
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Media error, attempting recovery...')
                videoError.value = 'Erreur de décodage vidéo'
                // Try to recover media errors
                setTimeout(() => {
                  if (hls) hls.recoverMediaError()
                }, 1000)
                break
              default:
                console.log('Fatal HLS error, trying next source...')
                videoError.value = 'Erreur fatale de lecture vidéo'
                destroyHls()
                // Automatically try next source instead of just failing
                setTimeout(() => {
                  tryNextSource()
                }, 1000)
                break
            }
          }
          videoLoading.value = false
        }
        
        hlsManifestParsedHandler = () => {
          console.log('HLS manifest parsed successfully')
          // Clear the loading timeout since manifest loaded successfully
          if (hlsLoadTimeout) {
            clearTimeout(hlsLoadTimeout)
            hlsLoadTimeout = null
          }
          // Don't set videoLoading to false here yet - wait for actual buffer
          
          // Try to play immediately, but don't fail if autoplay is blocked
          el.play().catch(e => {
            console.log('Autoplay prevented by browser, waiting for user interaction')
            videoError.value = 'Cliquez pour jouer' // Set autoplay error message
            videoLoading.value = false // Allow user interaction
          })
        }
        
        hls.on(Hls.Events.ERROR, hlsErrorHandler)
        hls.on(Hls.Events.MANIFEST_PARSED, hlsManifestParsedHandler)

        hls.loadSource(playUrl.value)
        hls.attachMedia(el as any)

        // Add a safety timeout to clear loading state if nothing happens
        // Store the timeout ID so it can be cleared on unmount
        const safetyTimeout = setTimeout(() => {
          if (videoLoading.value) {
            console.warn('Safety timeout: clearing loading state after 3 seconds')
            videoLoading.value = false
          }
        }, 3000)
        // Clear this timeout on unmount
        onBeforeUnmount(() => {
          clearTimeout(safetyTimeout)
        })

        // Set a shorter timeout for HLS loading (7 seconds instead of 10)
        hlsLoadTimeout = setTimeout(() => {
          console.warn('HLS loading timeout, trying fallback to direct video')
          destroyHls()
          
          // Try loading the original URL directly as a fallback
          const originalUrl = resolvedList.value.find(s => s.proxiedUrl === playUrl.value)?.url
          if (originalUrl) {
            console.log('Trying direct URL fallback:', originalUrl)
            playUrl.value = originalUrl
            setupVideo()
          } else {
            console.log('No direct fallback available, trying next source')
            videoError.value = 'Timeout lors du chargement de la vidéo HLS (7s)'
            videoLoading.value = false
            // Try next source on timeout
            setTimeout(() => {
              tryNextSource()
            }, 1000)
          }
        }, 7000)
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        el.src = playUrl.value
        el.play().catch(e => {
          console.log('Autoplay prevented by browser, waiting for user interaction')
        })

        // Add safety timeout for native HLS too
        setTimeout(() => {
          if (videoLoading.value) {
            console.warn('Safety timeout: clearing loading state after 3 seconds (native HLS)')
            videoLoading.value = false
          }
        }, 3000)
      } else {
        throw new Error('HLS not supported in this browser')
      }
    } else {
      // Direct video file (MP4, etc.)
      el.src = playUrl.value

      // Add safety timeout for direct video too
      setTimeout(() => {
        if (videoLoading.value) {
          console.warn('Safety timeout: clearing loading state after 3 seconds (direct video)')
          videoLoading.value = false
        }
      }, 3000)
    }
  } catch (error) {
    console.error('Setup video error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    videoError.value = `Erreur lors de la configuration vidéo: ${errorMessage}`
    videoLoading.value = false
  }
}

function tryNextSource() {
  if (resolvedList.value.length <= 1) return
  
  // Track how many sources we've tried to avoid infinite loops
  const startIndex = currentSourceIndex.value
  currentSourceIndex.value = (currentSourceIndex.value + 1) % resolvedList.value.length
  
  // If we've cycled through all sources, stop trying
  if (currentSourceIndex.value === startIndex) {
    console.log('Tried all sources, giving up')
    videoError.value = 'Toutes les sources vidéo ont échoué'
    return
  }
  
  const nextSource = resolvedList.value[currentSourceIndex.value]
  
  if (!nextSource) return
  
  // Reset attempts when trying a different source
  setupAttempts = 0
  playUrl.value = nextSource.proxiedUrl || nextSource.url
  videoError.value = '' // Clear previous error
  videoLoading.value = true // Set loading when switching
  setupVideo()
}

function switchToSource(source: { type: string; url: string; proxiedUrl: string; quality?: string }) {
  const index = resolvedList.value.findIndex(s => s.url === source.url)
  if (index !== -1) {
    currentSourceIndex.value = index
  }
  // Reset attempts when switching sources
  setupAttempts = 0
  playUrl.value = source.proxiedUrl || source.url
  videoError.value = ''
  videoLoading.value = true // Set loading when switching
  setupVideo()
}

// Episode selector functions
async function loadAnimeMetadata() {
  try {
    const response = await $fetch(`/api/anime/${id.value}`) as any
    animeTitle.value = response?.title || response?.name || `Anime ${id.value}`
    
    // Extract dynamic language flags from the response
    if (response?.languageFlags) {
      dynamicLanguageFlags.value = response.languageFlags
      console.log('Loaded dynamic language flags:', dynamicLanguageFlags.value)
    }
  } catch (error) {
    console.error('Failed to load anime metadata:', error)
    animeTitle.value = `Anime ${id.value}`
  }
}

async function loadEpisodesList() {
  if (episodesList.value.length > 0) return // Already loaded
  
  loadingEpisodes.value = true
  try {
    const url = `/api/anime/episodes/${id.value}/${season.value}/${lang.value}`
    console.log('Loading episodes from:', url)
    const response = await $fetch(url) as any
    episodesList.value = (response?.episodes || []) as Array<{ episode: number; title?: string; url: string; urls?: string[] }>
    console.log('Loaded episodes:', episodesList.value)
    
    // Update current episode title
    const currentEp = episodesList.value.find(ep => ep.episode === episodeNum.value)
    currentEpisodeTitle.value = currentEp?.title || `Épisode ${episodeNum.value}`
  } catch (error) {
    console.error('Failed to load episodes:', error)
    episodesList.value = []
    currentEpisodeTitle.value = `Épisode ${episodeNum.value}`
  } finally {
    loadingEpisodes.value = false
  }
}

function selectEpisode(episodeNumber: number) {
  if (episodeNumber === episodeNum.value) return // Already on this episode
  
  showEpisodes.value = false
  navigateTo({
    path: `/watch/${id.value}/${season.value}/${lang.value}/${episodeNumber}`,
    replace: true
  })
}

function toggleEpisodesPanel() {
  showEpisodes.value = !showEpisodes.value
  if (showEpisodes.value && episodesList.value.length === 0) {
    loadEpisodesList()
  }
}

async function switchLanguage(targetLang: 'vostfr' | 'vf' | 'va' | 'var' | 'vkr' | 'vcn' | 'vqc' | 'vf1' | 'vf2' | 'vj') {
  if (targetLang === lang.value || switchingLanguage.value) return
  
  switchingLanguage.value = true
  showLanguageDropdown.value = false // Close dropdown immediately
  
  try {
    console.log(`🔄 Switching from ${lang.value} to ${targetLang}`)
    await navigateTo({
      path: `/watch/${id.value}/${season.value}/${targetLang}/${episodeNum.value}`,
      replace: true
    })
  } catch (error) {
    console.error('Failed to switch language:', error)
  } finally {
    switchingLanguage.value = false
  }
}

function toggleLanguageDropdown() {
  if (languageOptions.value.length <= 1) return // Don't show dropdown if only one language
  showLanguageDropdown.value = !showLanguageDropdown.value
}

function closeLanguageDropdown() {
  showLanguageDropdown.value = false
}

onBeforeUnmount(() => {
  destroyHls()
  stopProgressUpdates() // Ensure animation frame is stopped
  removeVideoEventListeners(videoRef.value)
  
  // Clear any pending timeouts
  if (resolveTimeout) {
    clearTimeout(resolveTimeout)
    resolveTimeout = null
  }
  
  // Remove global event listeners to prevent memory leaks
  document.removeEventListener('keydown', handleKeyPress)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('click', closeLanguageDropdown)
})

async function fetchEpisodesFor(targetLang: 'vostfr' | 'vf' | 'va' | 'var' | 'vkr' | 'vcn' | 'vqc' | 'vf1' | 'vf2' | 'vj', maxRetries: number = 3): Promise<Array<{ episode: number; title?: string; url: string; urls?: string[] }>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await $fetch(`/api/anime/episodes/${id.value}/${season.value}/${targetLang}`) as any
      return (response?.episodes || []) as Array<{ episode: number; title?: string; url: string; urls?: string[] }>
    } catch (error) {
      console.warn(`Episode fetch attempt ${attempt}/${maxRetries} failed for ${targetLang}:`, error)
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Max retries exceeded')
}



async function resolveEpisode() {
  resolving.value = true
  resolveError.value = ''
  notice.value = ''
  playUrl.value = ''
  resolvedList.value = []
  
  // Reset setup attempts for new episode
  setupAttempts = 0
  
  console.log(`🎬 Resolving episode: ${id.value}/${season.value}/${lang.value}/${episodeNum.value}`)
  
  try {
    // Parallelize fetching episodes for all possible languages
    const allLanguages: ('vostfr' | 'vf' | 'va' | 'var' | 'vkr' | 'vcn' | 'vqc' | 'vf1' | 'vf2' | 'vj')[] = 
      ['vostfr', 'vf', 'va', 'var', 'vkr', 'vcn', 'vqc', 'vf1', 'vf2', 'vj']
    
    // Start fetching for all languages in parallel
    const languagePromises = allLanguages.map(langCode => 
      fetchEpisodesFor(langCode).then(episodes => ({ lang: langCode, episodes })).catch(() => ({ lang: langCode, episodes: [] }))
    )
    
    const results = await Promise.all(languagePromises)
    
    // Update available languages based on results
    results.forEach(({ lang, episodes }) => {
      availableLanguages.value[lang as keyof typeof availableLanguages.value] = episodes.length > 0
    })
    
    console.log(`✅ Checked all languages, available:`, availableLanguages.value)
    
    // Try requested language first
    const currentLangResult = results.find(r => r.lang === lang.value)
    let ep = currentLangResult?.episodes.find(e => Number(e.episode) === episodeNum.value)
    console.log(`🎯 Looking for episode ${episodeNum.value} in ${lang.value}, found:`, ep ? `Episode ${ep.episode}` : 'Not found')

    // If not found in current language, try other available languages in order
    if (!ep) {
      for (const { lang: altLang, episodes: altEpisodes } of results) {
        if (altLang !== lang.value && altEpisodes.length > 0) {
          const altEp = altEpisodes.find((e: any) => Number(e.episode) === episodeNum.value)
          if (altEp) {
            console.log(`🔄 Found episode ${episodeNum.value} in ${altLang}, switching...`)
            notice.value = `Langue ${lang.value.toUpperCase()} indisponible. Basculement en ${altLang.toUpperCase()}.`
            await navigateTo({
              path: `/watch/${id.value}/${season.value}/${altLang}/${episodeNum.value}`,
              query: { fallback: '1' },
              replace: true,
            })
            return
          }
        }
      }
      console.log(`❌ Episode ${episodeNum.value} not found in any available language`)
    }

    if (!ep) {
      resolveError.value = `Épisode ${episodeNum.value} introuvable pour ${lang.value.toUpperCase()}`
      return
    }
    const candidates = ep?.urls?.length ? ep.urls : ep?.url ? [ep.url] : []
    if (!candidates.length) { resolveError.value = 'Aucun lien pour cet épisode'; return }

    // Pick best provider URL and prepare stream resolution data in parallel
    const sortParams = new URLSearchParams(); candidates.forEach(u => sortParams.append('urls', u))
    
    // Start provider sorting
    const sortPromise = $fetch(`/api/providers?action=sort&${sortParams.toString()}`).catch(() => ({ sortedUrls: [candidates[0]] }))
    
    // Prepare stream resolution data in parallel
    const encoder = new TextEncoder();
    
    // Wait for provider sorting to complete
    const sorted: any = await sortPromise
    const targetUrl = sorted?.sortedUrls?.[0] || candidates[0] || ''
    
    if (!targetUrl) {
      resolveError.value = 'Aucune URL valide trouvée'
      return
    }

    // Resolve the provider URL to actual video stream
    const data = encoder.encode(targetUrl);
    const base64 = btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    
    let referer: string | undefined;
    try {
      const u = new URL(targetUrl);
      referer = u.origin + "/";
    } catch {}
    
    const resolveResponse = await $fetch<any>("/api/player/resolve", {
      params: {
        u64: base64,
        referer,
        ...(debug.value ? { debug: "1" } : {}),
      },
      timeout: 15000, // Reduce from 30s to 15s
    });
    
    if (!resolveResponse?.ok) {
      resolveError.value = resolveResponse?.message || "Failed to resolve video stream";
      return;
    }
    
    const urls = resolveResponse?.urls || [];
    resolvedList.value = urls;
    
    if (urls.length > 0) {
      currentSourceIndex.value = 0
      const hlsFirst = urls.find((u: any) => u.type === "hls") || urls[0];
      playUrl.value = hlsFirst.proxiedUrl || hlsFirst.url;
    } else {
      resolveError.value = "No video streams found";
    }
  } catch (e: any) {
    resolveError.value = e?.message || 'Erreur de résolution'
  } finally {
    resolving.value = false
  }
}

watch([showPlayer, playUrl], async () => {
  if (!showPlayer.value) { destroyHls(); return }
  await nextTick(); 
  setupVideo()
})

// Initial setup after component mounts
onMounted(async () => {
  // Start metadata and episode loading immediately (before route params are fully reactive)
  const metadataPromise = loadAnimeMetadata().catch(() => null)
  const episodesPromise = loadEpisodesList().catch(() => null)
  
  // Small delay to ensure route params are fully reactive
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Start resolving episode immediately (most critical)
  const resolvePromise = resolveEpisode()
  
  // Wait only for episode resolution
  await resolvePromise
  
  // Ensure video element events are set up immediately
  await nextTick()
  handleVideoEvents()
  
  // Sync initial state with video element
  const el = videoRef.value
  if (el) {
    isPlaying.value = !(el as HTMLVideoElement).paused
    currentTime.value = (el as HTMLVideoElement).currentTime
    duration.value = (el as HTMLVideoElement).duration || 0
    volume.value = (el as HTMLVideoElement).volume
    isMuted.value = (el as HTMLVideoElement).muted
  }
  
  // setupVideo() will be called automatically by the watch when playUrl is set
  
  // Global event listeners
  document.addEventListener('keydown', handleKeyPress)
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
  document.addEventListener('click', closeLanguageDropdown)
})

// Re-resolve when params change (e.g., after fallback navigation) - debounced to prevent rapid calls
let resolveTimeout: number | null = null
watch([season, lang, episodeNum], () => {
  if (resolveTimeout) clearTimeout(resolveTimeout)
  resolveTimeout = setTimeout(() => {
    // Reset language availability when switching episodes/languages
    availableLanguages.value = {
      vostfr: false,
      vf: false,
      va: false,
      var: false,
      vkr: false,
      vcn: false,
      vqc: false,
      vf1: false,
      vf2: false,
      vj: false
    }
    resolveEpisode()
  }, 100) // Small debounce to handle rapid param changes
})

// Update episode title when episode changes or episodes list loads - optimized to avoid unnecessary updates
watch([episodeNum, episodesList], () => {
  const currentEp = episodesList.value.find(ep => ep.episode === episodeNum.value)
  const newTitle = currentEp?.title || `Épisode ${episodeNum.value}`
  if (newTitle !== currentEpisodeTitle.value) {
    currentEpisodeTitle.value = newTitle
  }
}, { immediate: true })
</script>

<template>
  <!-- Full viewport video player like Netflix with custom controls -->
  <div class="fixed inset-0 bg-black z-50 flex flex-col h-screen overflow-hidden" @mousemove="handleMouseMove">
    <!-- Top navigation overlay -->
    <div 
      class="absolute top-0 left-0 right-0 z-20 transition-opacity duration-300"
      :class="showControls ? 'opacity-100' : 'opacity-0'"
    >
      <div class="bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 md:p-6">
        <div class="flex items-center justify-between text-white">
          <div class="flex items-center gap-4">
            <NuxtLink :to="`/anime/${id}`" class="flex items-center gap-2 hover:text-zinc-300 transition-colors">
              <Icon name="heroicons:arrow-left" class="w-5 h-5" />
              <span class="text-sm font-medium">Retour</span>
            </NuxtLink>
            <div class="h-5 w-px bg-white/30"></div>
            <div class="flex flex-col">
              <div class="text-base font-medium text-white">
                {{ animeTitle || `Anime ${id}` }}
              </div>
              <div class="text-sm text-zinc-300">
                {{ currentEpisodeTitle || `Épisode ${episodeNum}` }} • S{{ season }} • {{ lang.toUpperCase() }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="resolvedList.length > 1" @click="tryNextSource" class="p-2 hover:bg-white/10 rounded-full transition-colors" title="Source alternative">
              <Icon name="heroicons:arrow-path" class="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <!-- Notice banner -->
        <div v-if="notice" class="mt-3 px-4 py-2 bg-amber-600/90 rounded-lg text-amber-100 text-sm">
          {{ notice }}
        </div>
      </div>
    </div>

    <!-- Main video container - takes all available space -->
    <div class="flex-1 relative bg-black min-h-0">
      <!-- Loading state -->
      <div v-if="resolving" class="absolute inset-0 flex items-center justify-center text-white">
        <div class="flex flex-col items-center justify-center text-white">
          <div class="w-16 h-16 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4 mx-auto"></div>
          <p class="text-lg font-medium text-center">Chargement de l'épisode</p>
        </div>
      </div>
      
      <!-- Error state -->
      <div v-else-if="resolveError" class="absolute inset-0 flex items-center justify-center text-white">
        <div class="text-center max-w-md px-6">
          <Icon name="heroicons:exclamation-triangle" class="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h3 class="text-xl font-semibold mb-2">Impossible de charger l'épisode</h3>
          <p class="text-zinc-300 mb-6">{{ resolveError }}</p>
          <button @click="resolveEpisode" class="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-zinc-200 transition-colors">
            Réessayer
          </button>
        </div>
      </div>
      
      <!-- Video player -->
      <div v-else class="w-full h-full relative" @click="showEpisodes = false">
        <!-- Video loading overlay -->
        <div v-if="videoLoading" class="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-30">
          <div class="flex flex-col items-center justify-center text-white">
            <!-- Simple rotating circle -->
            <div class="w-16 h-16 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4 mx-auto"></div>
            <!-- Loading text -->
            <p class="text-lg font-medium text-center">Chargement de la vidéo</p>
          </div>
        </div>
        
        <!-- Video element - no native controls -->
        <video
          ref="videoRef"
          class="w-full h-full object-contain cursor-pointer"
          preload="metadata"
          @click="handleVideoClick"
          @dblclick="toggleFullscreen"
        >
          Votre navigateur ne supporte pas la lecture vidéo. Veuillez utiliser un navigateur moderne.
        </video>
        
        <!-- Episode Selector Panel (Netflix-style) -->
        <div 
          v-if="showEpisodes"
          class="absolute right-4 bottom-24 w-96 max-h-[32rem] bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg overflow-hidden z-30 shadow-2xl"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-zinc-700">
            <div>
              <h3 class="text-white font-semibold text-lg">Épisodes</h3>
              <p class="text-zinc-400 text-sm">Saison {{ season }} • {{ lang.toUpperCase() }}</p>
            </div>
            <button @click="showEpisodes = false" class="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded">
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Episodes List -->
          <div class="max-h-80 overflow-y-auto custom-scrollbar">
            <div v-if="loadingEpisodes" class="p-6 text-center text-zinc-400">
              <div class="w-8 h-8 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p>Chargement des épisodes...</p>
            </div>
            
            <div v-else-if="episodesList.length === 0" class="p-6 text-center text-zinc-400">
              <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 mx-auto mb-3 text-zinc-500" />
              <p>Aucun épisode trouvé</p>
            </div>
            
            <div v-else class="divide-y divide-zinc-800">
              <button 
                v-for="(ep, index) in episodesList" 
                :key="ep.episode"
                @click="selectEpisode(ep.episode)"
                class="w-full p-4 text-left hover:bg-zinc-800/50 transition-all duration-200 flex items-center gap-4 group relative"
                :class="ep.episode === episodeNum ? 'bg-violet-600/10 border-l-4 border-violet-500' : 'hover:border-l-4 hover:border-zinc-600'"
              >
                <!-- Episode thumbnail/number -->
                <div class="flex-shrink-0 w-20 h-12 bg-zinc-800 rounded-md overflow-hidden flex items-center justify-center relative group-hover:bg-zinc-700 transition-colors">
                  <span class="text-white font-bold text-lg">{{ ep.episode }}</span>
                  <div v-if="ep.episode === episodeNum" class="absolute inset-0 bg-violet-600/20 flex items-center justify-center">
                    <Icon name="heroicons:play-circle" class="w-6 h-6 text-violet-400" />
                  </div>
                  <div v-else class="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <Icon name="heroicons:play" class="w-5 h-5 text-white" />
                  </div>
                </div>
                
                <!-- Episode info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h4 class="text-white font-medium text-base">
                      {{ ep.title || `Épisode ${ep.episode}` }}
                    </h4>
                    <span v-if="ep.episode === episodeNum" class="text-xs bg-violet-600 text-white px-2 py-1 rounded-full font-medium">
                      En cours
                    </span>
                  </div>
                  <p class="text-zinc-400 text-sm">
                    {{ ep.episode === episodeNum ? 'Vous regardez actuellement cet épisode' : (ep.title ? `Épisode ${ep.episode} • ${season}` : `Épisode ${ep.episode} de la saison ${season}`) }}
                  </p>
                </div>
                
                <!-- Play indicator -->
                <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="heroicons:chevron-right" class="w-5 h-5 text-zinc-400" />
                </div>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Custom Controls Overlay - Fixed to bottom with proper spacing -->
        <div 
          class="absolute bottom-0 left-0 right-0 transition-opacity duration-300 pointer-events-none z-20"
          :class="showControls ? 'opacity-100' : 'opacity-0'"
          @click.stop
        >
          <!-- Bottom controls container -->
          <div class="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-8 md:px-6 md:pb-6 pointer-events-auto">
            <!-- Progress bar -->
            <div class="mb-3">
              <div 
                class="relative h-1 bg-white/20 rounded-full cursor-pointer hover:h-2 transition-all duration-200"
                :class="{ 'opacity-75': isSeeking }"
                @click="handleProgressClick"
                @mouseenter="isDragging = true"
                @mouseleave="isDragging = false"
              >
                <!-- Seeking indicator -->
                <div 
                  v-if="isSeeking"
                  class="absolute inset-0 bg-blue-500/20 rounded-full flex items-center justify-center"
                >
                  <div class="flex items-center gap-2 text-white text-xs">
                    <div class="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin"></div>
                    <span>Chargement...</span>
                  </div>
                </div>
                
                <!-- Buffered progress -->
                <div 
                  class="absolute top-0 left-0 h-full bg-white/40 rounded-full"
                  :style="{ width: bufferedPercent + '%' }"
                ></div>
                <!-- Current progress -->
                <div 
                  class="absolute top-0 left-0 h-full bg-violet-600 rounded-full transition-all duration-100"
                  :style="{ width: progressPercent + '%' }"
                ></div>
                <!-- Progress handle -->
                <div 
                  class="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-violet-600 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-200"
                  :style="{ left: progressPercent + '%', marginLeft: '-6px' }"
                ></div>
              </div>
            </div>
            
            <!-- Control buttons and info -->
            <div class="flex items-center justify-between text-white">
              <div class="flex items-center gap-3">
                <!-- Play/Pause -->
                <button @click="togglePlay" class="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Icon :name="isPlaying ? 'heroicons:pause' : 'heroicons:play'" class="w-6 h-6" />
                </button>
                
                <!-- Skip back/forward -->
                <button @click="seekBy(-10)" class="p-2 hover:bg-white/10 rounded-full transition-colors" title="Reculer 10s">
                  <Icon name="heroicons:backward" class="w-5 h-5" />
                </button>
                <button @click="seekBy(10)" class="p-2 hover:bg-white/10 rounded-full transition-colors" title="Avancer 10s">
                  <Icon name="heroicons:forward" class="w-5 h-5" />
                </button>
                
                <!-- Volume control -->
                <button @click="toggleMute" class="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Icon 
                    :name="isMuted || volume === 0 ? 'heroicons:speaker-x-mark' : volume < 0.5 ? 'heroicons:speaker' : 'heroicons:speaker-wave'" 
                    class="w-5 h-5" 
                  />
                </button>
                <div class="w-16 h-1 bg-white/20 rounded-full relative group">
                  <div class="h-full bg-violet-600 rounded-full" :style="{ width: (volume * 100) + '%' }"></div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    :value="volume" 
                    @input="setVolume(parseFloat(($event.target as HTMLInputElement).value))"
                    class="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                
                <!-- Time display -->
                <div class="text-sm text-zinc-300 whitespace-nowrap">
                  {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
                </div>
              </div>
              
              <div class="flex items-center gap-2">
                <!-- Language dropdown -->
                <div v-if="languageOptions.length > 1" class="relative">
                  <button
                    @click.stop="toggleLanguageDropdown"
                    :disabled="switchingLanguage"
                    class="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-sm font-medium"
                    :title="'Changer de langue'"
                  >
                    <span v-if="switchingLanguage" class="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></span>
                    <span v-else>{{ currentLanguageDisplay.label }}</span>
                    <Icon name="heroicons:chevron-down" class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showLanguageDropdown }" />
                  </button>
                  
                  <!-- Dropdown menu -->
                  <div
                    v-if="showLanguageDropdown"
                    class="absolute bottom-full right-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 w-80 overflow-hidden"
                    @click.stop
                  >
                    <div class="py-1">
                      <button
                        v-for="option in languageOptions"
                        :key="option.code"
                        @click="switchLanguage(option.code as 'vf' | 'vostfr')"
                        :disabled="option.code === lang"
                        class="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                        :class="{ 'bg-zinc-700 text-white': option.code === lang, 'text-zinc-300': option.code !== lang }"
                      >
                        <span>{{ option.label }}</span>
                        <span class="text-xs opacity-75 flex-1">{{ option.fullLabel }}</span>
                        <Icon v-if="option.code === lang" name="heroicons:check" class="w-4 h-4 ml-auto" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- Episodes list button -->
                <button @click="toggleEpisodesPanel" class="p-2 hover:bg-white/10 rounded-full transition-colors" title="Épisodes">
                  <Icon name="heroicons:list-bullet" class="w-5 h-5" />
                </button>
                
                <!-- Settings/Quality (if multiple sources) -->
                <button 
                  v-if="debug && resolvedList.length > 1" 
                  class="p-2 hover:bg-white/10 rounded-full transition-colors" 
                  title="Sources"
                >
                  <Icon name="heroicons:cog-6-tooth" class="w-5 h-5" />
                </button>
                
                <!-- Fullscreen -->
                <button @click="toggleFullscreen" class="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Icon :name="isFullscreen ? 'heroicons:arrows-pointing-in' : 'heroicons:arrows-pointing-out'" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Video error overlay -->
        <div v-if="videoError" class="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div class="text-center text-white max-w-md px-6">
            <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 mx-auto mb-3 text-red-400" />
            <h4 class="text-lg font-medium mb-2">{{ videoError }}</h4>
            <div class="text-sm text-zinc-400 mb-4 break-all">
              {{ playUrl }}
            </div>
            <div class="flex flex-wrap gap-2 justify-center">
              <button @click="setupVideo" class="bg-white text-black px-4 py-2 rounded font-medium hover:bg-zinc-200 transition-colors">
                Recharger
              </button>
              <button v-if="resolvedList.length > 1" @click="tryNextSource" class="bg-zinc-700 text-white px-4 py-2 rounded font-medium hover:bg-zinc-600 transition-colors">
                Source alternative
              </button>
            </div>
          </div>
        </div>
        
        <!-- Debug panel for development -->
        <div v-if="debug && resolvedList.length" class="absolute bottom-24 left-4 right-4 bg-black/90 border border-zinc-700 rounded-lg p-4 text-white text-sm z-30 max-h-32 overflow-y-auto">
          <h4 class="font-medium mb-2">Sources disponibles:</h4>
          <div class="space-y-1">
            <div v-for="(source, index) in resolvedList" :key="index" 
                 class="flex items-center gap-2 p-2 rounded"
                 :class="source.proxiedUrl === playUrl ? 'bg-violet-600/30 border border-violet-500' : 'bg-zinc-800/50'">
              <Icon name="heroicons:play" class="w-3 h-3 flex-shrink-0" />
              <span class="font-mono text-xs truncate flex-1">{{ source.type }} - {{ source.url }}</span>
              <button v-if="source.proxiedUrl !== playUrl" 
                      @click="switchToSource(source)" 
                      class="text-xs bg-white text-black px-2 py-1 rounded hover:bg-zinc-200 transition-colors">
                Utiliser
              </button>
            </div>
          </div>
          <div class="mt-2 pt-2 border-t border-zinc-600">
            <div class="text-xs text-zinc-400">
              Langues disponibles: VOSTFR={{ availableLanguages.vostfr }}, VF={{ availableLanguages.vf }}, VA={{ availableLanguages.va }}, VAR={{ availableLanguages.var }}, VKR={{ availableLanguages.vkr }}, VCN={{ availableLanguages.vcn }}, VQC={{ availableLanguages.vqc }}, VF1={{ availableLanguages.vf1 }}, VF2={{ availableLanguages.vf2 }}, VJ={{ availableLanguages.vj }}
            </div>
          </div>
        </div>

        <!-- Center play button overlay (when paused or autoplay blocked) -->
        <div v-if="(!isPlaying || videoError) && !videoLoading && !resolveError" 
             class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <button @click="togglePlay" class="w-20 h-20 bg-black/60 rounded-full hover:bg-black/80 transition-colors pointer-events-auto border-2 border-white/20 hover:border-white/40 flex items-center justify-center">
            <Icon name="heroicons:play" class="w-8 h-8 text-white ml-1" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(39, 39, 42, 0.5);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(161, 161, 170, 0.5);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(161, 161, 170, 0.8);
}
</style>