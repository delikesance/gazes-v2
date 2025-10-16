<script setup lang="ts">
// Ultra-optimized video.js lazy loading with preloading hints
let videojs: any = null
let videojsPromise: Promise<any> | null = null

const loadVideoJS = async () => {
  if (videojs) return videojs
  if (videojsPromise) return videojsPromise

  // Add preload hint for video.js when component mounts
  if (typeof document !== 'undefined' && !document.querySelector('link[data-videojs-preload]')) {
    const preloadLink = document.createElement('link')
    preloadLink.rel = 'preload'
    preloadLink.href = '/_nuxt/video-player.js'
    preloadLink.as = 'script'
    preloadLink.setAttribute('data-videojs-preload', 'true')
    document.head.appendChild(preloadLink)
  }

  videojsPromise = import('video.js').then(async (module) => {
    videojs = module.default
    // Load minimal video.js CSS only when needed
    if (typeof document !== 'undefined') {
      // Load only essential video.js styles instead of full CSS bundle
      const essentialVideoCSS = `
        .video-js {
          width: 100%;
          height: 100%;
          font-size: 14px;
          color: #fff;
          background-color: #000;
          position: relative;
        }
        .vjs-tech {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
        }
        .vjs-loading-spinner {
          display: none !important;
        }
        .vjs-big-play-button {
          display: none !important;
        }
        .vjs-text-track-display {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          top: 0;
          pointer-events: none;
        }
        .vjs-modal-dialog {
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
        }
        .vjs-error-display {
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
        }
      `
      const style = document.createElement('style')
      style.textContent = essentialVideoCSS
      document.head.appendChild(style)
    }
    return videojs
  })

  return videojsPromise
}

import { onBeforeUnmount, onMounted, ref, watch, nextTick, computed } from 'vue'
import { formatSeasonDisplay } from '~/shared/utils/season'
import { getProviderInfo } from '~/server/utils/videoProviders'

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
const isContinueWatching = computed(() => route.query.continue === 'true')

const showPlayer = ref(true)
const playUrl = ref('')
const currentSourceIndex = ref(0)
const resolving = ref(false)
const resolveError = ref('')
const resolvedList = ref<{ type: string; url: string; directUrl: string; proxiedUrl: string; quality?: string }[]>([])
const notice = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)
const videoError = ref('')
const videoLoading = ref(false)
const isBuffering = ref(false)
const bufferProgress = ref(0)

// Track which languages are currently being resolved
const resolvingLanguages = ref<Set<string>>(new Set())

// Cache for resolved sources by language to enable instant switching
const resolvedSourcesByLanguage = ref<Record<string, { sources: Array<{ type: string; url: string; directUrl: string; proxiedUrl: string; quality?: string }>; resolvedAt: number; episode: number; season: string }>>({})

// Language switching state
const availableLanguages = ref<Array<{ code: string; name: string; available: boolean }>>([])
const languageOptions = computed(() => availableLanguages.value.filter(lang => lang.available))
const showLanguageDropdown = ref(false)

// Video player state
const currentTime = ref(0)
const duration = ref(0)
const buffered = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isPlaying = ref(false)
const isFullscreen = ref(false)
const showControls = ref(true)
const isSeeking = ref(false)
const isDragging = ref(false)
const controlsTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const wasPlayingBeforeSeek = ref(false)
const playbackSpeed = ref(1)
const showSpeedDropdown = ref(false)
const isPictureInPicture = ref(false)
const showQualityDropdown = ref(false)
const autoPlayNext = ref(true) // Enable/disable auto-play next episode
const showNextEpisodeOverlay = ref(false)
const nextEpisodeCountdown = ref(10) // 10 second countdown
const nextEpisodeTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// CORS and proxy fallback state
const triedDirectUrl = ref(false)
const corsFailedSources = ref<Set<string>>(new Set())

// Mobile touch state
const touchSeekOverlay = ref(false)
const touchSeekTime = ref(0)

// Volume localStorage functions
const VOLUME_STORAGE_KEY = 'gazes-player-volume'

function saveVolumeSettings() {
  try {
    const settings = {
      volume: volume.value,
      isMuted: isMuted.value,
      timestamp: Date.now()
    }
    localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.warn('Failed to save volume settings:', error)
  }
}

function loadVolumeSettings() {
  try {
    const stored = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (stored) {
      const settings = JSON.parse(stored)
      // Only load if settings are recent (within 30 days)
      const isRecent = settings.timestamp && (Date.now() - settings.timestamp) < (30 * 24 * 60 * 60 * 1000)
      
      if (isRecent) {
        volume.value = settings.volume ?? 1
        isMuted.value = settings.isMuted ?? false
        return true
      } else {
      }
    }
  } catch (error) {
    console.warn('Failed to load volume settings:', error)
  }
  return false
}

// Animation frame for smooth progress updates
let progressAnimationFrame: number | null = null

// Optimized progress updates with throttling
let lastProgressUpdate = 0
const PROGRESS_UPDATE_THROTTLE = 100 // Update at most every 100ms

// Buffer progress tracking
let bufferAnimationFrame: number | null = null

function updateProgressSmoothly() {
  const now = Date.now()
  if (now - lastProgressUpdate < PROGRESS_UPDATE_THROTTLE) {
    progressAnimationFrame = requestAnimationFrame(updateProgressSmoothly)
    return
  }

  const el = videoRef.value
  if (el && !el.paused && !el.ended) {
    const newTime = el.currentTime
    const newBuffered = el.buffered.length > 0 ? el.buffered.end(el.buffered.length - 1) : 0

    // Only update if values actually changed to reduce re-renders
    if (Math.abs(newTime - currentTime.value) > 0.1) {
      currentTime.value = newTime
    }
    if (Math.abs(newBuffered - buffered.value) > 0.5) {
      buffered.value = newBuffered
    }

    lastProgressUpdate = now
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

function updateBufferProgress() {
  const el = videoRef.value
  if (el && el.buffered.length > 0 && duration.value > 0) {
    const bufferedEnd = el.buffered.end(el.buffered.length - 1)
    bufferProgress.value = Math.min(100, (bufferedEnd / duration.value) * 100)
  }
  bufferAnimationFrame = requestAnimationFrame(updateBufferProgress)
}

function startBufferUpdates() {
  if (bufferAnimationFrame) {
    cancelAnimationFrame(bufferAnimationFrame)
  }
  updateBufferProgress()
}

function stopBufferUpdates() {
  if (bufferAnimationFrame) {
    cancelAnimationFrame(bufferAnimationFrame)
    bufferAnimationFrame = null
  }
}

// Episode selector state
const showEpisodes = ref(false)
const episodesList = ref<Array<{ episode: number; title?: string; url: string; urls?: string[] }>>([])
const loadingEpisodes = ref(false)
const episodesScrollContainer = ref<HTMLElement | null>(null)

// Progress tracking state
const savedProgress = ref<{ currentTime: number; duration: number } | null>(null)
const progressSaveInterval = ref<ReturnType<typeof setInterval> | null>(null)
const lastSavedTime = ref(0)



// Computed for current language display
const currentLanguageDisplay = computed(() => {
  const current = languageOptions.value.find(opt => opt.code === lang.value)
  return current || { name: lang.value.toUpperCase() }
})

// Computed for formatted season display
const formattedSeasonDisplay = computed(() => formatSeasonDisplay(season.value))

// Computed for formatted episode display
const formattedEpisodeDisplay = computed(() => `Épisode ${episodeNum.value.toString().padStart(2, '0')}`)

// Computed for picture-in-picture support
const pictureInPictureEnabled = computed(() => {
  if (typeof document === 'undefined') return false
  return document.pictureInPictureEnabled
})

// Anime and episode metadata
const animeTitle = ref('')
const currentEpisodeTitle = ref('')

// Dynamic language flags from 179.43.149.218
const dynamicLanguageFlags = ref<Record<string, string>>({})

// Skip functionality state
const skipTimes = ref<Array<{ type: 'op' | 'ed'; startTime: number; endTime: number }>>([])
const skipEnabled = ref(true) // Enable/disable skip functionality
const showSkipButtons = ref(false)
const currentSkipType = ref<'op' | 'ed' | null>(null)
const skipTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Track which skips have been dismissed for the current episode
const dismissedSkips = ref<Set<'op' | 'ed'>>(new Set())

// Sync localStorage progress to server (call this when user logs in)
async function syncLocalProgressToServer() {
  try {
    // Find all localStorage progress keys
    const progressKeys = Object.keys(localStorage).filter(key => key.startsWith('progress_'))
    
    for (const key of progressKeys) {
      try {
        const stored = localStorage.getItem(key)
        if (!stored) continue
        
        const progressData = JSON.parse(stored)
        
        // Try to save to server
        await $fetch(`/api/watch/progress/${progressData.animeId}`, {
          method: 'POST',
          body: {
            season: progressData.season,
            episode: progressData.episode,
            currentTime: progressData.currentTime,
            duration: progressData.duration
          }
        })
        
        // Remove from localStorage after successful sync
        localStorage.removeItem(key)
      } catch (error) {
        console.warn('Failed to sync progress for key:', key, error)
      }
    }
  } catch (error) {
    console.warn('Failed to sync local progress to server:', error)
  }
}
async function loadSavedProgress() {
  try {
    // First try to load from server
    const response = await $fetch(`/api/watch/progress/${id.value}`)
    if (response?.success && 'progress' in response) {
      // Handle both array and single object responses
      const progressData = Array.isArray(response.progress) ? response.progress : [response.progress]
      if (progressData.length > 0) {
        // Find progress for current episode
        const episodeProgress = progressData.find((p: any) =>
          p.season === season.value && p.episode === episodeNum.value
        )
        if (episodeProgress && !(episodeProgress as any).completed) {
          savedProgress.value = {
            currentTime: (episodeProgress as any).currentTime,
            duration: (episodeProgress as any).duration
          }
          return
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load progress from server, trying localStorage:', error)
  }

  // Fallback to localStorage
  try {
    const progressKey = `progress_${id.value}_${season.value}_${episodeNum.value}`
    const stored = localStorage.getItem(progressKey)
    
    if (stored) {
      const progressData = JSON.parse(stored)
      
      // Check if data is recent (within 30 days)
      const isRecent = progressData.timestamp && (Date.now() - progressData.timestamp) < (30 * 24 * 60 * 60 * 1000)
      
      if (isRecent && progressData.currentTime && progressData.duration) {
        savedProgress.value = {
          currentTime: progressData.currentTime,
          duration: progressData.duration
        }
        return
      } else {
        // Clean up expired data
        localStorage.removeItem(progressKey)
      }
    }
  } catch (localStorageError) {
    console.warn('Failed to load progress from localStorage:', localStorageError)
  }
}

async function saveProgress(currentTime: number, duration: number) {
  // Don't save if duration is 0 or very short
  if (duration < 10) return

  // Don't save too frequently (throttle to every 5 seconds)
  const now = Date.now()
  if (now - lastSavedTime.value < 5000) return

  try {
    // Try to save to server first (if authenticated)
    const response = await $fetch(`/api/watch/progress/${id.value}`, {
      method: 'POST',
      body: {
        season: season.value,
        episode: episodeNum.value,
        currentTime,
        duration
      }
    })
    
    if (response?.success) {
      lastSavedTime.value = now
      return
    }
  } catch (error) {
    console.warn('Failed to save progress to server, falling back to localStorage:', error)
    
    // Fallback to localStorage if server save fails
    try {
      const progressKey = `progress_${id.value}_${season.value}_${episodeNum.value}`
      const progressData = {
        currentTime,
        duration,
        timestamp: now,
        animeId: id.value,
        season: season.value,
        episode: episodeNum.value
      }
      
      localStorage.setItem(progressKey, JSON.stringify(progressData))
      lastSavedTime.value = now
    } catch (localStorageError) {
      console.warn('Failed to save progress to localStorage:', localStorageError)
    }
  }
}

function startProgressSaving() {
  if (progressSaveInterval.value) {
    clearInterval(progressSaveInterval.value)
  }

  // Save progress every 30 seconds while playing
  progressSaveInterval.value = setInterval(() => {
    if (isPlaying.value && duration.value > 0) {
      saveProgress(currentTime.value, duration.value)
    }
  }, 30000)
}

function stopProgressSaving() {
  if (progressSaveInterval.value) {
    clearInterval(progressSaveInterval.value)
    progressSaveInterval.value = null
  }
}


// Computed progress values to avoid recalculating in template
const progressPercent = computed(() => {
  return duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
})

const bufferedPercent = computed(() => {
  return duration.value > 0 ? (buffered.value / duration.value) * 100 : 0
})

let player: any = null

function isM3U8(url: string) { return /\.m3u8(\?.*)?$/i.test(url) }

let hlsLoadTimeout: ReturnType<typeof setTimeout> | null = null

function destroyPlayer() {
  try {
    if (player) {
      // Clear any pending timeouts
      if (hlsLoadTimeout) {
        clearTimeout(hlsLoadTimeout)
        hlsLoadTimeout = null
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }
      player.dispose()
    }
  } catch (e) {
    console.warn('Error destroying player:', e)
  }
  player = null
  stopProgressUpdates() // Stop smooth progress updates
  // Also remove video event listeners
  removeVideoEventListeners(videoRef.value)
}

// Custom controls functions
function togglePlay() {
  if (player) {
    if (isPlaying.value) {
      player.pause()
    } else {
      player.play().catch((e: any) => {
      })
    }
  } else {
    const el = videoRef.value
    if (!el) return

    if (isPlaying.value) {
      el.pause()
    } else {
      el.play().catch(e => {
      })
    }
  }
  showControlsTemporarily()
}

function handleVideoClick(event: MouseEvent) {
  // Just toggle play, don't interfere with episodes panel
  togglePlay()
}

function handleVideoDoubleClick() {
  // Double tap to seek forward 10 seconds (like YouTube)
  seekBy(10)
  showSeekFeedback('forward', 10)
}

function showSeekFeedback(direction: 'forward' | 'backward', seconds: number) {
  touchSeekOverlay.value = true
  touchSeekTime.value = seconds
  setTimeout(() => {
    touchSeekOverlay.value = false
  }, 1000)
}

// Screenshot functionality


function seek(time: number) {
  // Prevent rapid seeking that can cause audio desynchronization
  if (isSeeking.value) {
    return
  }
  
  if (player) {
    player.currentTime(time)
    currentTime.value = time
  } else {
    const el = videoRef.value
    if (!el) return
    el.currentTime = time
    currentTime.value = time
  }
}

function seekBy(seconds: number) {
  // Prevent rapid seeking that can cause audio desynchronization
  if (isSeeking.value) {
    return
  }
  
  if (player) {
    const newTime = Math.max(0, Math.min(player.duration(), player.currentTime() + seconds))
    player.currentTime(newTime)
    currentTime.value = newTime
  } else {
    const el = videoRef.value
    if (!el) return
    const newTime = Math.max(0, Math.min(el.duration, el.currentTime + seconds))
    el.currentTime = newTime
    currentTime.value = newTime
  }
}

function toggleMute() {
  if (player) {
    player.muted(!player.muted())
    isMuted.value = player.muted()
  } else {
    const el = videoRef.value
    if (!el) return
    el.muted = !el.muted
    isMuted.value = el.muted
  }
  saveVolumeSettings()
}

function setVolume(newVolume: number) {
  const clampedVolume = Math.max(0, Math.min(1, newVolume))

  if (player) {
    player.volume(clampedVolume)
    volume.value = player.volume()
    if (player.volume() > 0) {
      player.muted(false)
      isMuted.value = false
    }
  } else {
    const el = videoRef.value
    if (!el) return
    el.volume = clampedVolume
    volume.value = el.volume
    if (el.volume > 0) {
      el.muted = false
      isMuted.value = false
    }
  }
  saveVolumeSettings()
}

// Playback speed functions
const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]

function setPlaybackSpeed(speed: number) {
  playbackSpeed.value = speed
  if (player) {
    player.playbackRate(speed)
  } else {
    const el = videoRef.value
    if (el) {
      el.playbackRate = speed
    }
  }
  showControlsTemporarily()
}

function cyclePlaybackSpeed() {
  const currentIndex = speedOptions.indexOf(playbackSpeed.value)
  const nextIndex = (currentIndex + 1) % speedOptions.length
  setPlaybackSpeed(speedOptions[nextIndex]!)
}

function toggleSpeedDropdown() {
  showSpeedDropdown.value = !showSpeedDropdown.value
}

function closeSpeedDropdown() {
  showSpeedDropdown.value = false
}

// Picture-in-Picture functions
function togglePictureInPicture() {
  if (typeof document === 'undefined' || !document.pictureInPictureEnabled) {
    console.warn('Picture-in-Picture not supported')
    return
  }

  const videoElement = player ? player.el() : videoRef.value
  if (!videoElement) return

  if (document.pictureInPictureElement) {
    document.exitPictureInPicture()
  } else {
    videoElement.requestPictureInPicture().catch((err: any) => {
      console.error('Failed to enter Picture-in-Picture:', err)
    })
  }
  showControlsTemporarily()
}

function handlePictureInPictureChange() {
  if (typeof document !== 'undefined') {
    isPictureInPicture.value = !!document.pictureInPictureElement
  }
}



// Quality selector functions
function toggleQualityDropdown() {
  showQualityDropdown.value = !showQualityDropdown.value
}

function closeQualityDropdown() {
  showQualityDropdown.value = false
}

function selectQuality(source: { type: string; url: string; proxiedUrl: string; quality?: string }) {
  switchToSource(source)
  showQualityDropdown.value = false
  showControlsTemporarily()
}

// Auto-play next episode functions
function startNextEpisodeCountdown() {
  if (!autoPlayNext.value) return

  // Check if there's a next episode
  const currentEpisodeIndex = episodesList.value.findIndex(ep => ep.episode === episodeNum.value)
  if (currentEpisodeIndex === -1 || currentEpisodeIndex >= episodesList.value.length - 1) return

  showNextEpisodeOverlay.value = true
  nextEpisodeCountdown.value = 10

  nextEpisodeTimeout.value = setInterval(() => {
    nextEpisodeCountdown.value--
    if (nextEpisodeCountdown.value <= 0) {
      playNextEpisode()
    }
  }, 1000)
}

function cancelNextEpisodeCountdown() {
  if (nextEpisodeTimeout.value) {
    clearInterval(nextEpisodeTimeout.value)
    nextEpisodeTimeout.value = null
  }
  showNextEpisodeOverlay.value = false
  nextEpisodeCountdown.value = 10
}

function playNextEpisode() {
  cancelNextEpisodeCountdown()
  const currentEpisodeIndex = episodesList.value.findIndex(ep => ep.episode === episodeNum.value)
  if (currentEpisodeIndex !== -1 && currentEpisodeIndex < episodesList.value.length - 1) {
    const nextEpisode = episodesList.value[currentEpisodeIndex + 1]
    if (nextEpisode) {
      selectEpisode(nextEpisode.episode)
    }
  }
}

function toggleAutoPlayNext() {
  autoPlayNext.value = !autoPlayNext.value
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
  updateCursorVisibility()
  if (controlsTimeout.value) {
    clearTimeout(controlsTimeout.value)
  }
  controlsTimeout.value = setTimeout(() => {
    if (isPlaying.value && !isDragging.value) {
      showControls.value = false
      updateCursorVisibility()
    }
  }, 3000)
}

function updateCursorVisibility() {
  const playerContainer = document.querySelector('.fixed.inset-0.bg-black.z-50') as HTMLElement
  const videoElement = videoRef.value as HTMLElement
  
  if (isFullscreen.value) {
    // In fullscreen, hide cursor when controls are hidden
    const cursorStyle = showControls.value ? 'default' : 'none'
    if (playerContainer) {
      playerContainer.style.cursor = cursorStyle
    }
    if (videoElement) {
      videoElement.style.cursor = cursorStyle
    }
    // Also set on body as fallback
    document.body.style.cursor = cursorStyle
  } else {
    // Outside fullscreen, always show cursor
    if (playerContainer) {
      playerContainer.style.cursor = 'default'
    }
    if (videoElement) {
      videoElement.style.cursor = 'pointer' // Restore pointer cursor for video element
    }
    document.body.style.cursor = 'default'
  }
}

function handleMouseMove() {
  showControlsTemporarily()
}

function handleProgressClick(event: MouseEvent) {
  // Prevent rapid seeking that can cause audio desynchronization
  if (isSeeking.value) {
    return
  }
  
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
     case '<':
     case ',':
       event.preventDefault()
       cyclePlaybackSpeed()
       break
     case '>':
     case '.':
       event.preventDefault()
       // Cycle backwards
       const currentIndex = speedOptions.indexOf(playbackSpeed.value)
       const prevIndex = currentIndex === 0 ? speedOptions.length - 1 : currentIndex - 1
       setPlaybackSpeed(speedOptions[prevIndex]!)
       break
     case 'p':
     case 'P':
       event.preventDefault()
       togglePictureInPicture()
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
  isPlaying.value = true
  isBuffering.value = false
  videoLoading.value = false // Clear loading when video actually starts
  if (videoError.value && videoError.value.includes('Cliquez')) {
    videoError.value = '' // Clear autoplay error when video starts
  }
  startProgressUpdates() // Start smooth progress updates
  startBufferUpdates() // Start buffer progress updates
  startProgressSaving() // Start automatic progress saving
  showControlsTemporarily()
  updateCursorVisibility()
}
function onVideoPause() {
  isPlaying.value = false
  stopProgressUpdates() // Stop smooth progress updates
  stopBufferUpdates() // Stop buffer progress updates
  stopProgressSaving() // Stop automatic progress saving
  // Save progress immediately when paused
  if (duration.value > 0) {
    saveProgress(currentTime.value, duration.value)
  }
  showControls.value = true
  updateCursorVisibility()
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
    })
  }
}
 function onVideoError(e: Event) {
  const videoEl = e.target as HTMLVideoElement
  const error = videoEl?.error
  videoError.value = 'Erreur de chargement vidéo'
  videoLoading.value = false
  handleVideoError(error, 'native')
}
 function onVideoEnded() {
   isPlaying.value = false
   showControls.value = true
   // Mark episode as completed when it actually ends
   if (duration.value > 0) {
     saveProgress(duration.value, duration.value) // This will mark it as completed
   }

   // Start auto-play countdown for next episode
   startNextEpisodeCountdown()
 }
// --- Stable handler references for Hls events ---
let hlsErrorHandler: ((event: string, data: any) => void) | null = null
let hlsManifestParsedHandler: (() => void) | null = null

// --- Stable handler references for global events ---
function handleFullscreenChange() {
  const wasFullscreen = isFullscreen.value
  isFullscreen.value = !!document.fullscreenElement

  // When exiting fullscreen, show controls temporarily
  if (wasFullscreen && !isFullscreen.value) {
    showControlsTemporarily()
  }

  updateCursorVisibility()
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
  el.removeEventListener('ended', onVideoEnded)
  el.removeEventListener('error', onVideoError)
}

function addVideoEventListeners(el: any) {
  if (!el) return
  // Use passive listeners for better performance where appropriate
  el.addEventListener('play', onVideoPlay, { passive: true })
  el.addEventListener('pause', onVideoPause, { passive: true })
  el.addEventListener('timeupdate', onVideoTimeUpdate, { passive: true })
  el.addEventListener('loadedmetadata', onVideoLoadedMetadata, { passive: true })
  el.addEventListener('volumechange', onVideoVolumeChange, { passive: true })
  el.addEventListener('seeking', onVideoSeeking, { passive: true })
  el.addEventListener('seeked', onVideoSeeked, { passive: true })
  el.addEventListener('ended', onVideoEnded, { passive: true })
  el.addEventListener('error', onVideoError, { passive: true })
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

  // Check if skip buttons should be shown
  checkSkipAvailability()
}

function handleLoadedMetadata() {
  if (player) {
    duration.value = player.duration()
    // Apply loaded volume settings to the player
    if (volume.value !== undefined) {
      player.volume(volume.value)
    }
    if (isMuted.value !== undefined) {
      player.muted(isMuted.value)
    }
    // Apply playback speed
    player.playbackRate(playbackSpeed.value)
    // Update reactive refs to match player state
    volume.value = player.volume()
    isMuted.value = player.muted()
    isPlaying.value = !player.paused()
  } else {
    const el = videoRef.value
    if (!el) return
    duration.value = el.duration
    // Apply loaded volume settings to the video element
    if (volume.value !== undefined) {
      el.volume = volume.value
    }
    if (isMuted.value !== undefined) {
      el.muted = isMuted.value
    }
    // Apply playback speed
    el.playbackRate = playbackSpeed.value
    // Update reactive refs to match element state
    volume.value = el.volume
    isMuted.value = el.muted
    isPlaying.value = !el.paused
  }

  // Load skip times now that we have the episode duration
  loadSkipTimes()

  // Resume from saved progress if available
  if (savedProgress.value && savedProgress.value.duration > 0) {
    const resumeTime = savedProgress.value.currentTime
    const currentPlaybackTime = player ? player.currentTime() : videoRef.value?.currentTime || 0

    // Always resume if coming from continue watching, or if we're at the beginning (within first 5 seconds)
    const shouldResume = isContinueWatching.value || currentPlaybackTime < 5

    if (shouldResume) {
      if (player) {
        player.currentTime(resumeTime)
      } else if (videoRef.value) {
        videoRef.value.currentTime = resumeTime
      }
      currentTime.value = resumeTime

      // Show a notice when resuming from continue watching
      if (isContinueWatching.value) {
        notice.value = `Repris à ${Math.floor(resumeTime / 60)}:${String(Math.floor(resumeTime % 60)).padStart(2, '0')}`
        // Clear the notice after 3 seconds
        setTimeout(() => {
          notice.value = ''
        }, 3000)

        // For continue watching, try to autoplay after seeking
        setTimeout(() => {
          if (player && !player.playing()) {
            player.play().catch((e: any) => {
            })
          } else if (videoRef.value && videoRef.value.paused) {
            videoRef.value.play().catch((e: any) => {
            })
          }
        }, 500) // Small delay to ensure seek is complete
      }
    }
  }
}

function handleVolumeChange() {
  if (player) {
    volume.value = player.volume()
    isMuted.value = player.muted()
  } else {
    const el = videoRef.value
    if (!el) return
    volume.value = el.volume
    isMuted.value = el.muted
  }
}

function handleEnded() {
  isPlaying.value = false
  showControls.value = true
}

// Skip functionality functions
async function loadSkipTimes() {
  try {
    const params = duration.value > 0 ? { episodeLength: duration.value } : {}
    const response = await $fetch(`/api/anime/${id.value}/skip/${episodeNum.value}`, { params })
    if (response?.skipTimes && Array.isArray(response.skipTimes)) {
      skipTimes.value = response.skipTimes
    } else {
      skipTimes.value = []
    }
  } catch (error) {
    console.warn('⏭️ [SKIP] Failed to load skip times:', error)
    skipTimes.value = []
  }
}

function skipToEnd(skipType: 'op' | 'ed') {
  const skipTime = skipTimes.value.find(s => s.type === skipType)
  if (skipTime && videoRef.value) {
    seek(skipTime.endTime)
    hideSkipButtons()
  } else {
    console.warn(`⏭️ [SKIP] Could not skip ${skipType.toUpperCase()} - skip time not found or video not ready`)
  }
}

function hideSkipButtons() {
  showSkipButtons.value = false
  const skipType = currentSkipType.value
  currentSkipType.value = null
  
  // Mark the current skip type as dismissed for this episode
  if (skipType) {
    dismissedSkips.value.add(skipType)
  }
  
  if (skipTimeout.value) {
    clearTimeout(skipTimeout.value)
    skipTimeout.value = null
  }
}

function checkSkipAvailability() {
  if (!skipEnabled.value || skipTimes.value.length === 0) return

  const currentVideoTime = currentTime.value
  let shouldShowButtons = false
  let activeSkipType: 'op' | 'ed' | null = null

  for (const skipTime of skipTimes.value) {
    // Skip if this skip type has already been dismissed for this episode
    if (dismissedSkips.value.has(skipTime.type)) {
      continue
    }

    const timeUntilStart = skipTime.startTime - currentVideoTime
    const timeUntilEnd = skipTime.endTime - currentVideoTime

    // Show skip button when we're within the skip period
    if (currentVideoTime >= skipTime.startTime && currentVideoTime < skipTime.endTime) {
      shouldShowButtons = true
      activeSkipType = skipTime.type
      break
    }

    // Also show a few seconds before the skip period starts
    if (timeUntilStart > 0 && timeUntilStart <= 3) {
      shouldShowButtons = true
      activeSkipType = skipTime.type
      break
    }
  }

  if (shouldShowButtons && !showSkipButtons.value) {
    showSkipButtons.value = true
    currentSkipType.value = activeSkipType
    // Auto-hide after 10 seconds if not interacted with
    skipTimeout.value = setTimeout(() => {
      hideSkipButtons()
    }, 10000)
  } else if (!shouldShowButtons && showSkipButtons.value) {
    hideSkipButtons()
  }
}

// Track setup attempts to prevent infinite loops
let setupAttempts = 0

// Retry system for video errors
let currentSourceRetries = 0
const MAX_RETRIES_PER_SOURCE = 2
let lastErrorType = ''
let retryTimeout: ReturnType<typeof setTimeout> | null = null

// Test direct URL access with timeout and error detection
async function testDirectUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const testVideo = document.createElement('video')
    testVideo.crossOrigin = 'anonymous'
    testVideo.preload = 'metadata'
    
    const timeout = setTimeout(() => {
      testVideo.remove()
      reject(new Error('Direct URL test timeout'))
    }, 3000)
    
    const cleanup = () => {
      clearTimeout(timeout)
      testVideo.remove()
    }
    
    testVideo.addEventListener('loadedmetadata', () => {
      cleanup()
      resolve()
    })
    
    testVideo.addEventListener('error', (e) => {
      cleanup()
      const error = testVideo.error
      reject(new Error(`Direct URL failed: ${error?.message || 'Unknown error'}`))
    })
    
    testVideo.addEventListener('abort', () => {
      cleanup()
      reject(new Error('Direct URL test aborted'))
    })
    
    testVideo.src = url
    document.body.appendChild(testVideo)
  })
}

async function setupVideo() {
  const el = videoRef.value
  if (!el || !playUrl.value) {
    console.warn('setupVideo: Missing video element or playUrl')
    return
  }

  // Reset setup attempts and retry counters for new episode
  setupAttempts = 0
  currentSourceRetries = 0
  lastErrorType = ''
  triedDirectUrl.value = false

  videoError.value = ''
  videoLoading.value = true
  isPlaying.value = false

  // Clear any existing player
  el.pause()
  destroyPlayer()
  el.removeAttribute('src')
  el.load()

  // Apply saved volume settings to video element before setting up player
  loadVolumeSettings()
  el.volume = volume.value
  el.muted = isMuted.value

  // Determine if we should try direct URL first
  const currentSource = resolvedList.value[currentSourceIndex.value]
  const shouldTryDirect = currentSource?.directUrl && !corsFailedSources.value.has(currentSource.url)
  
  try {
    if (isM3U8(playUrl.value)) {
      // For HLS streams, we need to check if direct access works
      if (shouldTryDirect && !triedDirectUrl.value) {
        console.log('🎯 Trying direct HLS URL first:', currentSource.directUrl)
        triedDirectUrl.value = true
        
        // Try direct URL with timeout
        const directTestPromise = testDirectUrl(currentSource.directUrl)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Direct URL timeout')), 3000)
        )
        
        try {
          await Promise.race([directTestPromise, timeoutPromise])
          console.log('✅ Direct HLS URL works, using it')
          playUrl.value = currentSource.directUrl
        } catch (directError) {
          console.log('❌ Direct HLS URL failed, falling back to proxy:', (directError as Error).message)
          corsFailedSources.value.add(currentSource.url)
          playUrl.value = currentSource.proxiedUrl
        }
      }

      // Use Video.js for HLS streams (direct or proxied)
      const VideoJS = await loadVideoJS()
      player = VideoJS(el, {
        controls: false, // We use custom controls
        autoplay: true, // Enable autoplay
        muted: false, // Don't mute by default
        preload: 'metadata',
        html5: {
          hls: {
            overrideNative: true, // Use video.js HLS plugin
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            // Better seeking configuration
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5,
            maxSeekHole: 2,
            seekHoleNudgeDuration: 0.1,
            // Retry settings
            levelLoadingMaxRetry: 4,
            levelLoadingMaxRetryTimeout: 4000,
            fragLoadingMaxRetry: 6,
            fragLoadingMaxRetryTimeout: 4000,
            // Performance
            enableWorker: true,
            startLevel: -1,
            debug: debug.value,
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
        },
        // Additional options for better performance
        liveui: false,
        responsive: true,
        fluid: true,
      })

      // Attach video element events BEFORE setting source
      handleVideoEvents()

       // Set up video.js event handlers
       player.on('error', (e: any) => {
          console.error('Video.js error:', e)
         const error = player.error()
         if (error) {
           videoError.value = `Erreur vidéo: ${error.message || 'Unknown error'}`
           videoLoading.value = false
           handleVideoError(error, 'videojs')
         }
       })

      player.on('loadedmetadata', () => {
        // Handle loaded metadata
        handleLoadedMetadata()
      })

      player.on('canplay', () => {
        videoLoading.value = false
      })

       player.on('waiting', () => {
         isBuffering.value = true
         videoLoading.value = true
       })

       player.on('playing', () => {
         isBuffering.value = false
         videoLoading.value = false
       })

       player.on('canplay', () => {
         isBuffering.value = false
         videoLoading.value = false
       })

      // Apply volume settings to Video.js player
      player.volume(volume.value)
      player.muted(isMuted.value)

      // Set the source
      player.src({
        src: playUrl.value,
        type: 'application/x-mpegURL'
      })

      // Load the video
      player.load()

      // Try to play with autoplay
      player.play().catch((e: any) => {
        videoLoading.value = false // Allow user interaction
        // Don't show error for autoplay prevention - it's expected
      })

      // Set timeout for loading
      hlsLoadTimeout = setTimeout(() => {
        console.warn('HLS loading timeout, trying next source')
        destroyPlayer()
        videoError.value = 'Timeout lors du chargement de la vidéo HLS'
        videoLoading.value = false
        setTimeout(() => {
          tryNextSource()
        }, 500)
      }, 10000)
    } else {
      // For MP4 and other direct video files, try direct access first
      if (shouldTryDirect && !triedDirectUrl.value) {
        console.log('🎯 Trying direct video URL first:', currentSource.directUrl)
        triedDirectUrl.value = true
        
        // Test direct URL access
        try {
          await testDirectUrl(currentSource.directUrl)
          console.log('✅ Direct video URL works, using it')
          playUrl.value = currentSource.directUrl
        } catch (directError) {
          console.log('❌ Direct video URL failed, falling back to proxy:', (directError as Error).message)
          corsFailedSources.value.add(currentSource.url)
          playUrl.value = currentSource.proxiedUrl
        }
      }

      // Use native video element for MP4
      el.src = playUrl.value
      el.autoplay = true // Enable autoplay for native video

      // Attach video element events
      handleVideoEvents()

      // Add specific event listeners for native video loading
      const onCanPlay = () => {
        videoLoading.value = false
        el.removeEventListener('canplay', onCanPlay)
      }
      const onLoadedData = () => {
        videoLoading.value = false
        el.removeEventListener('loadeddata', onLoadedData)
      }
      const onError = (e: Event) => {
        console.error('Native video error:', e)
        videoError.value = 'Erreur de chargement vidéo'
        videoLoading.value = false
        el.removeEventListener('error', onError)
      }

      el.addEventListener('canplay', onCanPlay)
      el.addEventListener('loadeddata', onLoadedData)
      el.addEventListener('error', onError)

      // Try to play
      el.play().catch(e => {
        videoLoading.value = false // Allow user interaction
      })

      // Add safety timeout for native video
      const safetyTimeout = setTimeout(() => {
        if (videoLoading.value) {
          console.warn('Safety timeout: clearing loading state after 10 seconds (native)')
          videoLoading.value = false
        }
      }, 10000)

      // Remove the aggressive timeout for native video - let it load naturally
      // Large MP4 files may take time to buffer
    }

  } catch (error) {
    console.error('Setup video error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    videoError.value = `Erreur lors de la configuration vidéo: ${errorMessage}`
    videoLoading.value = false
  }
}

// Smart retry system that considers error types
function isRecoverableError(error: any): boolean {
  if (!error) return false

  // Get error code/message
  const errorCode = error.code || error.status || 0
  const errorMessage = (error.message || '').toLowerCase()

  // Network errors are recoverable
  if (errorCode >= 500 || errorMessage.includes('network') || errorMessage.includes('timeout') ||
      errorMessage.includes('connection') || errorMessage.includes('fetch')) {
    return true
  }

  // HLS specific recoverable errors
  if (errorMessage.includes('frag') || errorMessage.includes('segment') ||
      errorMessage.includes('buffer') || errorMessage.includes('manifest')) {
    return true
  }

  // CORS or temporary server issues
  if (errorCode === 0 || errorMessage.includes('cors') || errorMessage.includes('blocked')) {
    return true
  }

  return false
}

function handleVideoError(error: any, errorType: string = 'unknown') {
  console.error(`Video error (${errorType}):`, error)

  // Clear any pending retry
  if (retryTimeout) {
    clearTimeout(retryTimeout)
    retryTimeout = null
  }

  // Determine if this is a new error type
  const isNewErrorType = lastErrorType !== errorType
  if (isNewErrorType) {
    lastErrorType = errorType
    currentSourceRetries = 0
  }

  const recoverable = isRecoverableError(error)

  if (recoverable && currentSourceRetries < MAX_RETRIES_PER_SOURCE) {
    // Retry the same source
    currentSourceRetries++

    videoError.value = `Nouvelle tentative ${currentSourceRetries}/${MAX_RETRIES_PER_SOURCE}...`
    videoLoading.value = true

    retryTimeout = setTimeout(() => {
      setupVideo()
    }, 2000 * currentSourceRetries) // Exponential backoff

  } else {
    // Either not recoverable or max retries reached - try next source
    tryNextSource()
  }
}

function tryNextSource() {
  if (resolvedList.value.length <= 1) {
    videoError.value = 'Aucune source alternative disponible'
    return
  }

  // Track how many sources we've tried to avoid infinite loops
  const startIndex = currentSourceIndex.value
  currentSourceIndex.value = (currentSourceIndex.value + 1) % resolvedList.value.length

  // If we've cycled through all sources, stop trying
  if (currentSourceIndex.value === startIndex) {
    videoError.value = 'Toutes les sources vidéo ont échoué'
    return
  }

  const nextSource = resolvedList.value[currentSourceIndex.value]

  if (!nextSource) return

  // Reset retry counters when switching sources
  setupAttempts = 0
  currentSourceRetries = 0
  lastErrorType = ''

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
  // Reset attempts and retry counters when switching sources
  setupAttempts = 0
  currentSourceRetries = 0
  lastErrorType = ''
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
    const response = await $fetch(url) as any
    episodesList.value = (response?.episodes || []) as Array<{ episode: number; title?: string; url: string; urls?: string[] }>

    // Update current episode title
    const currentEp = episodesList.value.find(ep => ep.episode === episodeNum.value)
    currentEpisodeTitle.value = currentEp?.title || formattedEpisodeDisplay.value

    // Scroll will be handled by the watcher below
  } catch (error) {
    console.error('Failed to load episodes:', error)
    episodesList.value = []
    currentEpisodeTitle.value = formattedEpisodeDisplay.value
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

function scrollToCurrentEpisode() {
  if (!episodesScrollContainer.value) return
  
  // Find the current episode element
  const currentEpisodeElement = episodesScrollContainer.value.querySelector(`[data-episode="${episodeNum.value}"]`) as HTMLElement
  if (currentEpisodeElement) {
    // Scroll the element into view with smooth behavior
    currentEpisodeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}

function toggleEpisodesPanel() {
  showEpisodes.value = !showEpisodes.value
  if (showEpisodes.value && episodesList.value.length === 0 && !loadingEpisodes.value) {
    loadEpisodesList()
  } else if (showEpisodes.value && episodesList.value.length > 0) {
    // Episodes already loaded, scroll immediately after DOM update
    nextTick(() => {
      scrollToCurrentEpisode()
    })
  }
}



onBeforeUnmount(() => {
  destroyPlayer()
  stopProgressUpdates() // Ensure animation frame is stopped
  removeVideoEventListeners(videoRef.value)

  // Clear any pending timeouts
  if (resolveTimeout) {
    clearTimeout(resolveTimeout)
    resolveTimeout = null
  }
  if (retryTimeout) {
    clearTimeout(retryTimeout)
    retryTimeout = null
  }

  // Clear skip timeout
  if (skipTimeout.value) {
    clearTimeout(skipTimeout.value)
    skipTimeout.value = null
  }

  // Reset cursor visibility
  const playerContainer = document.querySelector('.fixed.inset-0.bg-black.z-50') as HTMLElement
  const videoElement = videoRef.value as HTMLElement
  if (playerContainer) {
    playerContainer.style.cursor = 'default'
  }
  if (videoElement) {
    videoElement.style.cursor = 'pointer'
  }
  document.body.style.cursor = 'default'

  // Remove global event listeners to prevent memory leaks
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', handleKeyPress)
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('enterpictureinpicture', handlePictureInPictureChange)
    document.removeEventListener('leavepictureinpicture', handlePictureInPictureChange)
  }
})

async function fetchEpisodesFor(targetLang: 'vostfr' | 'vf' | 'va' | 'var' | 'vkr' | 'vcn' | 'vqc' | 'vf1' | 'vf2' | 'vj', maxRetries: number = 2): Promise<Array<{ episode: number; title?: string; url: string; urls?: string[] }>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await $fetch(`/api/anime/episodes/${id.value}/${season.value}/${targetLang}`) as any
      const episodes = (response?.episodes || []) as Array<{ episode: number; title?: string; url: string; urls?: string[] }>

      // Validate that we got actual episodes with URLs
      if (episodes.length > 0 && episodes.some(ep => ep.urls && ep.urls.length > 0)) {
        return episodes
      } else {
        console.warn(`⚠️ Language ${targetLang} returned no valid episodes`)
        return [] // Return empty array instead of throwing
      }
    } catch (error: any) {
      console.warn(`Episode fetch attempt ${attempt}/${maxRetries} failed for ${targetLang}:`, error?.message || error)

      // If this is the last attempt, return empty array instead of throwing
      if (attempt === maxRetries) {
        console.warn(`❌ All attempts failed for ${targetLang}, marking as unavailable`)
        return []
      }

      // Wait before retrying (shorter delay for faster failure recovery)
      const delay = Math.min(500 * Math.pow(2, attempt - 1), 2000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but TypeScript needs it
  return []
}



// New clean language switching logic
async function switchLanguage(targetLang: string) {
  if (targetLang === lang.value) return // Already on this language

  console.log(`🔄 Switching language from ${lang.value} to ${targetLang}`)

  // Phase 1: Preparation - Check if target language is available
  const targetLangData = availableLanguages.value.find(l => l.code === targetLang)
  if (!targetLangData?.available) {
    console.warn(`❌ Language ${targetLang} not available for this episode`)
    notice.value = `Langue ${targetLang.toUpperCase()} indisponible pour cet épisode`
    return
  }

  // Phase 2: Pre-resolution - Check if sources are already resolved
  const cachedSources = resolvedSourcesByLanguage.value[targetLang]
  if (cachedSources && cachedSources.episode === episodeNum.value && cachedSources.season === season.value) {
    // Phase 3: Instant switching - Sources already available, navigate to update URL
    console.log(`✅ Sources already resolved for ${targetLang}, switching instantly`)
    await navigateTo({
      path: `/watch/${id.value}/${season.value}/${targetLang}/${episodeNum.value}`,
      replace: true,
    })
    notice.value = `Basculement en ${targetLang.toUpperCase()}`
    closeLanguageDropdown()
    return
  }

  // Phase 4: Fallback navigation - Navigate to new URL to trigger resolution
  console.log(`🔄 Navigating to ${targetLang} for fresh resolution`)
  await navigateTo({
    path: `/watch/${id.value}/${season.value}/${targetLang}/${episodeNum.value}`,
    replace: true,
  })
  closeLanguageDropdown()
}

function closeLanguageDropdown() {
  showLanguageDropdown.value = false
}

// Helper function to get human-readable language names
function getLanguageName(langCode: string): string {
  const names: Record<string, string> = {
    'vostfr': 'VOSTFR',
    'vf': 'VF',
    'va': 'VA',
    'var': 'VA+',
    'vkr': 'VKR',
    'vcn': 'VCN',
    'vqc': 'VQC',
    'vf1': 'VF1',
    'vf2': 'VF2',
    'vj': 'VJ'
  }
  return names[langCode] || langCode.toUpperCase()
}
async function resolveSourcesForLanguage(targetLang: string, candidateUrls: string[]): Promise<{ type: string; url: string; directUrl: string; proxiedUrl: string; quality?: string }[]> {
  let candidates = candidateUrls
  if (!candidates.length) return []
  
  // Sort candidates by provider reliability (best first) for faster success
  candidates = candidates.sort((a, b) => {
    const getReliability = (url: string) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase()
        if (hostname.includes('sibnet')) return 10
        if (hostname.includes('streamtape')) return 8
        if (hostname.includes('vidmoly')) return 7
        if (hostname.includes('uqload')) return 5
        if (hostname.includes('doodstream')) return 4
        if (hostname.includes('myvi')) return 3
        if (hostname.includes('sendvid')) return 1
        return 0
      } catch {
        return 0
      }
    }
    return getReliability(b) - getReliability(a)
  })
  
  // Try candidates sequentially for better reliability (less server load)
  let resolvedUrls: any[] = []
  let lastError = ''

  // Process candidates sequentially to avoid overwhelming servers
  for (let i = 0; i < Math.min(candidates.length, 3); i++) {
    const targetUrl = candidates[i]
    if (!targetUrl) continue

    try {
      // Resolve the provider URL to actual video stream
      const encoder = new TextEncoder()
      const data = encoder.encode(targetUrl)
      const base64 = btoa(String.fromCharCode(...data))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      let referer: string | undefined
      try {
        const u = new URL(targetUrl)
        referer = u.origin + "/"
      } catch {}

      try {
        const resolveResponse = await $fetch<any>("/api/player/resolve", {
          params: {
            u64: base64,
            referer,
            ...(debug.value ? { debug: "1" } : {}),
          },
          timeout: 4000, // Reduced to 4s for faster failure detection
        })

        if (resolveResponse?.ok && resolveResponse?.urls?.length > 0) {
          resolvedUrls = resolveResponse.urls
          break // Use the first successful result
        } else {
          const error = resolveResponse?.message || "No URLs found"
          console.warn(`❌ Candidate ${i + 1} failed for ${targetLang}: ${error}`)
          lastError = error
        }
      } catch (resolveError: any) {
        const errorMsg = resolveError?.message || 'Network error during resolution'
        console.warn(`❌ Candidate ${i + 1} resolution error for ${targetLang}: ${errorMsg}`)
        lastError = errorMsg
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Network error'
      console.warn(`❌ Candidate ${i + 1} error for ${targetLang}: ${errorMsg}`)
      lastError = errorMsg
    }
  }
  
  if (resolvedUrls.length === 0) {
    throw new Error(lastError || "Toutes les sources ont échoué")
  }
  
  return resolvedUrls
}

async function resolveEpisode() {
  resolving.value = true
  resolveError.value = ''
  notice.value = ''
  playUrl.value = ''
  resolvedList.value = []

  // Reset setup attempts and retry counters for new episode
  setupAttempts = 0
  currentSourceRetries = 0
  lastErrorType = ''


  try {
    // Check all languages for the current episode availability
    const allLanguages: ('vostfr' | 'vf' | 'va' | 'var' | 'vkr' | 'vcn' | 'vqc' | 'vf1' | 'vf2' | 'vj')[] = 
      ['vostfr', 'vf', 'va', 'var', 'vkr', 'vcn', 'vqc', 'vf1', 'vf2', 'vj']
    
    // Start fetching for all languages to check episode availability
    const languagePromises = allLanguages.map(langCode => 
      fetchEpisodesFor(langCode, 1).then(episodes => ({ 
        lang: langCode, 
        episodes,
        hasCurrentEpisode: episodes.some(ep => Number(ep.episode) === episodeNum.value)
      })).catch(() => ({ lang: langCode, episodes: [], hasCurrentEpisode: false }))
    )
    
    const languageResults = await Promise.all(languagePromises)
    
    // Update available languages based on whether they have the current episode
    availableLanguages.value = languageResults.map(({ lang, hasCurrentEpisode }) => ({
      code: lang,
      name: getLanguageName(lang),
      available: hasCurrentEpisode
    }))
    
    // Try requested language first
    const currentLangResult = languageResults.find(r => r.lang === lang.value)
    let ep = currentLangResult?.episodes.find(e => Number(e.episode) === episodeNum.value)

    // If not found in requested language, check other available languages
    if (!ep) {
      const availableLangResults = languageResults.filter(r => r.hasCurrentEpisode && r.lang !== lang.value)
      
      for (const { lang: altLang, episodes: altEpisodes } of availableLangResults) {
        const altEp = altEpisodes.find((e: any) => Number(e.episode) === episodeNum.value)
        if (altEp) {
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

    if (!ep) {
      resolveError.value = `Épisode ${episodeNum.value.toString().padStart(2, '0')} introuvable pour ${lang.value.toUpperCase()}`
      return
    }
    
    // Resolve sources for the current language first (for immediate playback)
    const epUrls = ep?.urls?.length ? ep.urls : ep?.url ? [ep.url] : []
    if (!epUrls.length) { 
      resolveError.value = 'Aucun lien pour cet épisode'
      return
    }
    
    const currentLangSources = await resolveSourcesForLanguage(lang.value, epUrls)
    resolvedList.value = currentLangSources
    resolvedSourcesByLanguage.value[lang.value] = {
      sources: currentLangSources,
      resolvedAt: Date.now(),
      episode: episodeNum.value,
      season: season.value
    }
    
    // Pre-resolve sources for other available languages in background
    const availableLangs = languageResults.filter(r => r.hasCurrentEpisode && r.lang !== lang.value)
    for (const { lang: otherLang, episodes: otherEpisodes } of availableLangs) {
      const otherEp = otherEpisodes.find((e: any) => Number(e.episode) === episodeNum.value)
      if (otherEp?.urls?.length) {
        // Mark as resolving
        resolvingLanguages.value.add(otherLang)
        
        // Resolve in background without awaiting
        resolveSourcesForLanguage(otherLang, otherEp.urls).then((sources: { type: string; url: string; directUrl: string; proxiedUrl: string; quality?: string }[]) => {
          resolvedSourcesByLanguage.value[otherLang] = {
            sources,
            resolvedAt: Date.now(),
            episode: episodeNum.value,
            season: season.value
          }
          resolvingLanguages.value.delete(otherLang)
        }).catch((error: any) => {
          console.warn(`Failed to pre-resolve sources for ${otherLang}:`, error)
          resolvingLanguages.value.delete(otherLang)
        })
      }
    }
    
    currentSourceIndex.value = 0
    const hlsFirst = resolvedList.value.find((u: any) => u.type === "hls") || resolvedList.value[0]
    if (hlsFirst) {
      playUrl.value = hlsFirst.proxiedUrl || hlsFirst.url
    } else {
      resolveError.value = "Aucune source vidéo trouvée"
      return
    }
  } catch (e: any) {
    resolveError.value = e?.message || 'Erreur de résolution'
  } finally {
    resolving.value = false
  }
}

watch([showPlayer, playUrl], async () => {
  if (!showPlayer.value) { destroyPlayer(); return }
  await nextTick();
  setupVideo()
})

// Preload next episode URLs for faster navigation
async function preloadNextEpisode() {
  try {
    const nextEpisodeNum = episodeNum.value + 1
    const nextEpisodeUrl = `/api/anime/episodes/${id.value}/${season.value}/${lang.value}`

    // Prefetch the episodes list for next episode
    const response = await $fetch(nextEpisodeUrl) as any
    const episodes = response?.episodes || []
    const nextEpisode = episodes.find((ep: any) => ep.episode === nextEpisodeNum)

    if (nextEpisode && nextEpisode.urls && nextEpisode.urls.length > 0) {
      // Pre-resolve the next episode URLs in background
      const firstUrl = nextEpisode.urls[0]

      // Start background resolution (don't await)
      resolveEpisodeInBackground(id.value, season.value, lang.value, nextEpisodeNum, nextEpisode.urls)
        .catch(error => console.debug('Background preload failed:', error))
    }
  } catch (error) {
    console.debug('Failed to preload next episode:', error)
  }
}

// Background episode resolution for preloading
async function resolveEpisodeInBackground(animeId: string, season: string, lang: string, episodeNum: number, candidateUrls: string[]) {

  // Sort candidates by provider reliability
  const candidates = candidateUrls.sort((a, b) => {
    const getReliability = (url: string) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase()
        if (hostname.includes('sibnet')) return 10
        if (hostname.includes('streamtape')) return 8
        if (hostname.includes('vidmoly')) return 7
        if (hostname.includes('uqload')) return 5
        if (hostname.includes('doodstream')) return 4
        if (hostname.includes('myvi')) return 3
        if (hostname.includes('sendvid')) return 1
        return 0
      } catch {
        return 0
      }
    }
    return getReliability(b) - getReliability(a)
  })

  // Try candidates in parallel (same logic as main resolveEpisode)
  const resolvePromises = candidates.slice(0, 3).map(async (targetUrl) => {
    if (!targetUrl) return null

    try {
      const encoder = new TextEncoder();
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
        },
        timeout: 8000, // Longer timeout for background loading
      });

      if (resolveResponse?.ok && resolveResponse?.urls?.length > 0) {
        return resolveResponse.urls
      }
    } catch (error) {
      // Silent fail for background loading
    }
    return null
  })

  try {
    const results = await Promise.allSettled(resolvePromises)
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        // Process URLs the same way as main resolution
        const extractedUrls = result.value
        const uniqueUrls = new Map<string, any>()
        for (const urlData of extractedUrls) {
          if (!uniqueUrls.has(urlData.url)) {
            const providerInfo = getProviderInfo(urlData.url)
            uniqueUrls.set(urlData.url, {
              type: urlData.type === 'hls' ? 'hls' : urlData.type === 'mp4' ? 'mp4' : 'unknown',
              url: urlData.url,
              proxiedUrl: `/api/proxy?url=${encodeURIComponent(urlData.url)}&rewrite=1`,
              quality: urlData.quality,
              provider: providerInfo ? {
                hostname: providerInfo.hostname,
                reliability: providerInfo.reliability,
                description: providerInfo.description
              } : null
            })
          }
        }

        const finalUrls = Array.from(uniqueUrls.values()).sort((a, b) => {
          const reliabilityA = a.provider?.reliability || 0
          const reliabilityB = b.provider?.reliability || 0
          return reliabilityB - reliabilityA
        })

        if (finalUrls.length > 0) {
        }
        break
      }
    }
  } catch (error) {
    console.debug('Background resolution failed:', error)
  }
}

  // Initial setup after component mounts
  onMounted(async () => {
    // Small delay to ensure route params are fully reactive
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // Start ALL API calls in parallel for maximum speed
    const [
      progressResult,
      metadataResult
    ] = await Promise.allSettled([
      loadSavedProgress().catch(() => null),
      loadAnimeMetadata().catch(() => null)
    ])

    // Start resolving episode immediately (most critical)
    const resolvePromise = resolveEpisode()

    // Wait only for episode resolution
    await resolvePromise

    // Preload next episode in background (non-blocking)
    preloadNextEpisode().catch(() => null)
  
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
  
  // Load saved volume settings
  loadVolumeSettings()
  
  // setupVideo() will be called automatically by the watch when playUrl is set
  
  // Global event listeners
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleKeyPress)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('enterpictureinpicture', handlePictureInPictureChange)
    document.addEventListener('leavepictureinpicture', handlePictureInPictureChange)
    document.addEventListener('click', () => {
      closeSpeedDropdown()
      closeQualityDropdown()
    })
  }
  
  // Save progress before unloading the page
  const handleBeforeUnload = () => {
    if (duration.value > 0) {
      saveProgress(currentTime.value, duration.value)
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  // Clean up on unmount
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })
})

// Re-resolve when params change (e.g., after fallback navigation) - debounced to prevent rapid calls
let resolveTimeout: ReturnType<typeof setTimeout> | null = null
let lastResolvedParams = ''
watch([season, lang, episodeNum], () => {
  if (resolveTimeout) clearTimeout(resolveTimeout)
  resolveTimeout = setTimeout(async () => {
    const currentParams = `${id.value}-${season.value}-${lang.value}-${episodeNum.value}`
    // Only re-resolve if params actually changed
    if (currentParams !== lastResolvedParams) {
      lastResolvedParams = currentParams
      
      // Reset dismissed skips when changing episodes
      dismissedSkips.value.clear()
      
      // Reload volume settings when navigating to new episode
      loadVolumeSettings()
      
      // When switching episodes or languages, we need to re-check language availability
      // for the new episode, so don't reset availableLanguages here - let resolveEpisode handle it
      resolveEpisode()
      // Skip times will be loaded automatically when video metadata loads
    }
  }, 100) // Small debounce to handle rapid param changes
})

// Update episode title when episode changes or episodes list loads - optimized to avoid unnecessary updates
watch([episodeNum, episodesList], () => {
  const currentEp = episodesList.value.find(ep => ep.episode === episodeNum.value)
  const newTitle = currentEp?.title || formattedEpisodeDisplay.value
  if (newTitle !== currentEpisodeTitle.value) {
    currentEpisodeTitle.value = newTitle
  }
}, { immediate: true })

// Watch for when both panel is visible and episodes are loaded to scroll to current episode
watch([showEpisodes, episodesList, loadingEpisodes], () => {
  if (showEpisodes.value && episodesList.value.length > 0 && !loadingEpisodes.value) {
    // Both panel is visible and episodes are loaded, scroll to current episode
    nextTick(() => {
      scrollToCurrentEpisode()
    })
  }
}, { immediate: true })
</script>

<template>
  <!-- Full viewport video player like Netflix with custom controls -->
  <div
    class="fixed inset-0 bg-black z-50 flex flex-col h-screen overflow-hidden"
    @mousemove="handleMouseMove"
  >
    <!-- Top navigation overlay -->
    <div
      class="absolute top-0 left-0 right-0 z-20 transition-opacity duration-200"
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
                {{ currentEpisodeTitle || formattedEpisodeDisplay }} • {{ formattedSeasonDisplay }} • {{ lang.toUpperCase() }}
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
          <div class="w-16 h-16 border-2 border-white/20 border-t-violet-500 rounded-full animate-spin mb-4 mx-auto"></div>
          <p class="text-lg font-medium text-center">Recherche de sources vidéo...</p>
          <p class="text-sm text-zinc-400 mt-2">Cela peut prendre quelques secondes</p>
        </div>
      </div>
      
      <!-- Error state -->
      <div v-else-if="resolveError" class="absolute inset-0 flex items-center justify-center text-white">
        <div class="text-center max-w-md px-6">
          <Icon name="heroicons:exclamation-triangle" class="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h3 class="text-xl font-semibold mb-2">Épisode non disponible</h3>
          <p class="text-zinc-300 mb-4">Impossible de trouver des sources pour cet épisode.</p>
          <div class="text-sm text-zinc-400 mb-6">
            <p>Solutions possibles :</p>
            <ul class="text-left mt-2 space-y-1">
              <li>• Essayer une autre langue</li>
              <li>• Vérifier plus tard (sources peuvent être ajoutées)</li>
              <li>• Vérifier votre connexion internet</li>
            </ul>
          </div>
          <div class="flex flex-wrap gap-2 justify-center">
            <button @click="resolveEpisode" class="bg-violet-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-violet-700 transition-colors">
              Réessayer
            </button>
          </div>
        </div>
      </div>
      
      <!-- Video player -->
      <div v-else class="w-full h-full relative" @click="showEpisodes = false">
        <!-- Video loading overlay -->
        <div v-if="videoLoading" class="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-30">
          <div class="flex flex-col items-center justify-center text-white">
            <!-- Buffering indicator -->
            <div v-if="isBuffering" class="mb-4">
              <div class="w-16 h-16 border-4 border-violet-600/30 border-t-violet-600 rounded-full animate-spin mb-4 mx-auto"></div>
              <div class="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  class="h-full bg-violet-600 transition-all duration-300"
                  :style="{ width: bufferProgress + '%' }"
                ></div>
              </div>
            </div>
            <!-- Regular loading -->
            <div v-else class="w-16 h-16 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4 mx-auto"></div>
            <!-- Loading text -->
            <p class="text-lg font-medium text-center">
              {{ isBuffering ? 'Chargement en cours...' : 'Préparation de la vidéo...' }}
            </p>
            <p v-if="isBuffering" class="text-sm text-zinc-400 mt-2">
              {{ Math.round(bufferProgress) }}% mis en buffer
            </p>
            <p v-else class="text-sm text-zinc-400 mt-2">
              Connexion à la source vidéo...
            </p>
          </div>
        </div>
        
        <!-- Video element - no native controls -->
        <video
          ref="videoRef"
          class="w-full h-full object-contain cursor-pointer"
          preload="metadata"
          autoplay
          crossorigin="anonymous"
          @click="handleVideoClick"
          @dblclick="handleVideoDoubleClick"
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
              <p class="text-zinc-400 text-sm">{{ formattedSeasonDisplay }} • {{ lang.toUpperCase() }}</p>
            </div>
            <button @click="showEpisodes = false" class="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded">
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Episodes List -->
          <div ref="episodesScrollContainer" class="max-h-80 overflow-y-auto custom-scrollbar">
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
                :data-episode="ep.episode"
                @click="selectEpisode(ep.episode)"
                class="w-full p-4 text-left hover:bg-zinc-800/50 transition-all duration-200 flex items-center gap-4 group relative"
                :class="ep.episode === episodeNum ? 'bg-violet-600/10 border-l-4 border-violet-500' : 'hover:border-l-4 hover:border-zinc-600'"
              >
                <!-- Episode thumbnail/number -->
                <div class="flex-shrink-0 w-20 h-12 bg-zinc-800 rounded-md overflow-hidden flex items-center justify-center relative group-hover:bg-zinc-700 transition-colors">
                  <span class="text-white font-bold text-lg">{{ ep.episode.toString().padStart(2, '0') }}</span>
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
                      {{ ep.title || `Épisode ${ep.episode.toString().padStart(2, '0')}` }}
                    </h4>
                  </div>
                  <p class="text-zinc-400 text-sm">
                    {{ ep.episode === episodeNum ? 'Vous regardez actuellement cet épisode' : (ep.title ? `Épisode ${ep.episode.toString().padStart(2, '0')} • ${season}` : `Épisode ${ep.episode.toString().padStart(2, '0')} de la saison ${season}`) }}
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
          class="absolute bottom-0 left-0 right-0 transition-opacity duration-200 pointer-events-none z-20"
          :class="showControls ? 'opacity-100' : 'opacity-0'"
          @click.stop
          @mouseenter="showControlsTemporarily"
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
              <div class="flex items-center gap-2 md:gap-3">
                <!-- Play/Pause -->
                <button @click="togglePlay" class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation">
                  <Icon :name="isPlaying ? 'heroicons:pause' : 'heroicons:play'" class="w-6 h-6 md:w-6 md:h-6" />
                </button>

                <!-- Skip back/forward -->
                <button @click="seekBy(-10)" class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation" title="Reculer 10s">
                  <Icon name="heroicons:backward" class="w-5 h-5 md:w-5 md:h-5" />
                </button>
                <button @click="seekBy(10)" class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation" title="Avancer 10s">
                  <Icon name="heroicons:forward" class="w-5 h-5 md:w-5 md:h-5" />
                </button>

                <!-- Volume control -->
                <button @click="toggleMute" class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation">
                  <Icon
                    :name="isMuted ? 'heroicons:speaker-x-mark' : 'heroicons:speaker-wave'"
                    class="w-5 h-5 md:w-5 md:h-5"
                  />
                </button>
                <div class="w-16 md:w-16 h-2 md:h-1 bg-white/20 rounded-full relative group">
                  <div class="h-full bg-violet-600 rounded-full" :style="{ width: (volume * 100) + '%' }"></div>
                  <!-- Volume handle dot -->
                  <div
                    class="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-3 md:h-3 bg-violet-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 border border-white/50"
                    :style="{ left: (volume * 100) + '%', marginLeft: '-8px md:-6px' }"
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
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
              
              <div class="flex items-center gap-1 md:gap-2">
                <!-- Playback speed -->
                <div class="relative">
                  <button
                    @click="toggleSpeedDropdown"
                    class="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-sm font-medium"
                    :title="'Vitesse de lecture'"
                  >
                    <span>{{ playbackSpeed }}x</span>
                    <Icon name="heroicons:chevron-down" class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showSpeedDropdown }" />
                  </button>

                  <!-- Speed dropdown menu -->
                  <div
                    v-if="showSpeedDropdown"
                    class="absolute bottom-full right-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 w-24 overflow-hidden"
                    @click.stop
                  >
                    <div class="py-1">
                      <button
                        v-for="speed in speedOptions"
                        :key="speed"
                        @click="setPlaybackSpeed(speed)"
                        :disabled="speed === playbackSpeed"
                        class="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors"
                        :class="{ 'bg-zinc-700 text-white': speed === playbackSpeed, 'text-zinc-300': speed !== playbackSpeed }"
                      >
                        {{ speed }}x
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Skip toggle -->
                <button
                  @click="skipEnabled = !skipEnabled"
                  :class="skipEnabled ? 'text-violet-400' : 'text-zinc-400'"
                  class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation"
                  :title="skipEnabled ? 'Désactiver le saut automatique' : 'Activer le saut automatique'"
                >
                  <Icon name="heroicons:forward" class="w-5 h-5 md:w-5 md:h-5" />
                </button>

                <!-- Quality selector -->
                <div v-if="resolvedList.length > 1" class="relative">
                  <button
                    @click="toggleQualityDropdown"
                    class="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-sm font-medium"
                    title="Qualité"
                  >
                    <Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
                    <Icon name="heroicons:chevron-down" class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showQualityDropdown }" />
                  </button>

                  <!-- Quality dropdown menu -->
                  <div
                    v-if="showQualityDropdown"
                    class="absolute bottom-full right-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 w-48 overflow-hidden"
                    @click.stop
                  >
                    <div class="py-1">
                      <button
                        v-for="(source, index) in resolvedList"
                        :key="index"
                        @click="selectQuality(source)"
                        :disabled="source.proxiedUrl === playUrl"
                        class="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                        :class="{ 'bg-zinc-700 text-white': source.proxiedUrl === playUrl, 'text-zinc-300': source.proxiedUrl !== playUrl }"
                      >
                        <Icon name="heroicons:play" class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate flex-1">{{ source.quality || source.type.toUpperCase() }}</span>
                        <span class="text-xs opacity-75">{{ source.type }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- Episodes -->
                <button @click="toggleEpisodesPanel" class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation" title="Épisodes">
                  <Icon name="heroicons:list-bullet" class="w-5 h-5 md:w-5 md:h-5" />
                </button>

                <!-- Language selector -->
                <div v-if="languageOptions.length > 1" class="relative">
                  <button
                    @click="showLanguageDropdown = !showLanguageDropdown"
                    class="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-sm font-medium"
                    title="Changer de langue"
                  >
                    <span>{{ currentLanguageDisplay.name }}</span>
                    <Icon name="heroicons:chevron-down" class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showLanguageDropdown }" />
                  </button>

                  <!-- Language dropdown menu -->
                  <div
                    v-if="showLanguageDropdown"
                    class="absolute bottom-full right-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 w-32 overflow-hidden"
                    @click.stop
                  >
                    <div class="py-1">
                      <button
                        v-for="langOption in languageOptions"
                        :key="langOption.code"
                        @click="switchLanguage(langOption.code)"
                        :disabled="langOption.code === lang"
                        class="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                        :class="{ 'bg-zinc-700 text-white': langOption.code === lang, 'text-zinc-300': langOption.code !== lang }"
                      >
                        <Icon name="heroicons:language" class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate flex-1">{{ langOption.name }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Picture-in-Picture -->
                <button
                  v-if="pictureInPictureEnabled"
                  @click="togglePictureInPicture"
                  class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation"
                  :title="isPictureInPicture ? 'Quitter Picture-in-Picture' : 'Picture-in-Picture'"
                >
                  <Icon :name="isPictureInPicture ? 'heroicons:arrows-pointing-in' : 'heroicons:rectangle-stack'" class="w-5 h-5 md:w-5 md:h-5" />
                </button>

                <!-- Fullscreen -->
                <button @click="toggleFullscreen" class="p-3 md:p-2 hover:bg-white/10 rounded-full transition-colors touch-manipulation">
                  <Icon :name="isFullscreen ? 'heroicons:arrows-pointing-in' : 'heroicons:arrows-pointing-out'" class="w-5 h-5 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Video error overlay -->
        <div v-if="videoError" class="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div class="text-center text-white max-w-md px-6">
            <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 mx-auto mb-3 text-red-400" />
            <h4 class="text-lg font-medium mb-2">Problème de lecture</h4>
            <p class="text-zinc-300 mb-4">La vidéo ne peut pas être lue correctement.</p>
            <div class="flex flex-wrap gap-2 justify-center">
              <button @click="setupVideo" class="bg-violet-600 text-white px-4 py-2 rounded font-medium hover:bg-violet-700 transition-colors">
                Recharger la vidéo
              </button>
              <button v-if="resolvedList.length > 1" @click="tryNextSource" class="bg-zinc-700 text-white px-4 py-2 rounded font-medium hover:bg-zinc-600 transition-colors">
                Essayer une autre source
              </button>
            </div>
            <div class="mt-4 text-xs text-zinc-500">
              Si le problème continue, la source peut être temporairement indisponible.
            </div>
          </div>
        </div>
        

        <!-- Touch seek overlay -->
        <div
          v-if="touchSeekOverlay"
          class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 bg-black/80 rounded-lg p-4 text-white text-center"
        >
          <Icon name="heroicons:forward" class="w-8 h-8 mx-auto mb-2" />
          <p class="text-sm">{{ touchSeekTime }}s</p>
        </div>

        <!-- Next episode auto-play overlay -->
        <div
          v-if="showNextEpisodeOverlay"
          class="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-40"
        >
          <div class="text-center text-white max-w-md px-6">
            <div class="mb-4">
              <Icon name="heroicons:play-circle" class="w-16 h-16 mx-auto mb-4 text-violet-400" />
              <h3 class="text-xl font-semibold mb-2">Épisode suivant</h3>
              <p class="text-zinc-300 mb-4">
                {{ episodesList.find(ep => ep.episode === episodeNum + 1)?.title || `Épisode ${episodeNum + 1}` }}
              </p>
              <div class="w-16 h-16 mx-auto mb-4 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-sm text-zinc-400">Lecture automatique dans {{ nextEpisodeCountdown }}s</p>
            </div>
            <div class="flex gap-3 justify-center">
              <button
                @click="playNextEpisode"
                class="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Icon name="heroicons:play" class="w-5 h-5" />
                <span>Lire maintenant</span>
              </button>
              <button
                @click="cancelNextEpisodeCountdown"
                class="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Annuler
              </button>
            </div>
            <div class="mt-4">
              <label class="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="autoPlayNext"
                  @change="toggleAutoPlayNext"
                  class="rounded border-zinc-600 text-violet-600 focus:ring-violet-500"
                />
                <span>Lecture automatique activée</span>
              </label>
             </div>
           </div>
         </div>
       </div>

         <!-- Skip buttons overlay -->
        <div
          v-if="showSkipButtons && currentSkipType"
          class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 transition-opacity duration-300"
        >
          <div class="bg-black/80 backdrop-blur-sm rounded-lg p-4 text-center text-white">
            <div class="text-sm text-zinc-300 mb-2">
              {{ currentSkipType === 'op' ? 'Générique de début' : 'Générique de fin' }}
        </div>
            <button
              @click="skipToEnd(currentSkipType)"
              class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 mx-auto"
            >
              <Icon name="heroicons:forward" class="w-4 h-4" />
              <span>Sauter</span>
            </button>
            <button
              @click="hideSkipButtons"
              class="text-xs text-zinc-400 hover:text-zinc-300 mt-2 block mx-auto transition-colors"
            >
              Masquer
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