#!/usr/bin/env node

// Script pour tester les vrais providers de Death Parade Épisode 1
// Usage: node test-real-death-parade.js

import https from 'https'
import http from 'http'

// Configuration pour Death Parade
const ANIME_ID = 'death-parade' // Sera mis à jour dynamiquement
const SEASON = '1'
const EPISODE = '1'
const LANG = 'vostfr'

// Fonction pour mesurer le temps de réponse d'une URL
function measureResponseTime(url, timeout = 15000) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const protocol = url.startsWith('https:') ? https : http

    const req = protocol.get(url, {
      timeout,
      rejectUnauthorized: false, // Ignorer les certificats auto-signés pour les tests
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://179.43.149.218/'
      }
    }, (res) => {
      const responseTime = Date.now() - startTime
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
        // Limiter la collecte pour éviter les gros téléchargements
        if (data.length > 50000) {
          req.destroy()
          resolve({
            url,
            statusCode: res.statusCode,
            responseTime,
            contentLength: data.length,
            success: res.statusCode >= 200 && res.statusCode < 300,
            contentType: res.headers['content-type'],
            truncated: true
          })
          return
        }
      })

      res.on('end', () => {
        resolve({
          url,
          statusCode: res.statusCode,
          responseTime,
          contentLength: data.length,
          success: res.statusCode >= 200 && res.statusCode < 300,
          contentType: res.headers['content-type']
        })
      })
    })

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime
      resolve({
        url,
        error: error.message,
        responseTime,
        success: false
      })
    })

    req.on('timeout', () => {
      req.destroy()
      const responseTime = Date.now() - startTime
      resolve({
        url,
        error: 'Timeout',
        responseTime,
        success: false
      })
    })
  })
}

// Fonction pour obtenir l'ID de Death Parade
async function getAnimeId() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      search: 'death parade'
    })

    const options = {
      hostname: '179.43.149.218',
      path: '/template-php/defaut/fetch.php',
      method: 'POST',
      rejectUnauthorized: false, // Ignorer les certificats auto-signés
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      console.log(`📡 Status de la réponse: ${res.statusCode}`)
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          console.log('🔍 Réponse brute reçue:', data.substring(0, 200) + '...')
          const result = JSON.parse(data)
          if (result.animes && result.animes.length > 0) {
            resolve(result.animes[0])
          } else {
            reject(new Error('Anime non trouvé'))
          }
        } catch (error) {
          console.error('❌ Erreur de parsing JSON:', error.message)
          console.error('📄 Données reçues:', data)
          reject(error)
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

// Fonction pour obtenir les URLs des épisodes
async function getEpisodeUrls(animeId) {
  const episodeUrl = `https://179.43.149.218/anime/${animeId}/1/vostfr`

  return new Promise((resolve, reject) => {
    https.get(episodeUrl, {
      rejectUnauthorized: false, // Ignorer les certificats auto-signés
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://179.43.149.218/'
      }
    }, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.episodes && result.episodes.length > 0) {
            const episode = result.episodes.find(ep => ep.episode === 1)
            if (episode) {
              const urls = episode.urls || [episode.url]
              resolve(urls)
            } else {
              reject(new Error('Épisode 1 non trouvé'))
            }
          } else {
            reject(new Error('Aucun épisode trouvé'))
          }
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

// Fonction pour identifier le provider d'une URL
function identifyProvider(url) {
  const hostname = url.toLowerCase()
  if (hostname.includes('sibnet')) return 'SibNet'
  if (hostname.includes('streamtape')) return 'StreamTape'
  if (hostname.includes('vidmoly')) return 'VidMoly'
  if (hostname.includes('uqload')) return 'UqLoad'
  if (hostname.includes('doodstream')) return 'DoodStream'
  if (hostname.includes('myvi')) return 'MyVi'
  if (hostname.includes('sendvid')) return 'SendVid'
  if (hostname.includes('videobin')) return 'VideoBin'
  if (hostname.includes('vidoza')) return 'Vidoza'
  return 'Inconnu'
}

// Fonction principale
async function main() {
  console.log('🚀 Test des vrais providers pour Death Parade Épisode 1\n')

  try {
    // 1. Obtenir l'ID de l'anime
    console.log('📺 Recherche de Death Parade...')
    const anime = await getAnimeId()
    console.log(`✅ Anime trouvé: ${anime.title || anime.name}`)
    console.log(`🆔 ID: ${anime.id}\n`)

    // 2. Obtenir les URLs des épisodes
    console.log('📡 Récupération des URLs d\'épisode...')
    const episodeUrls = await getEpisodeUrls(anime.id)
    console.log(`✅ Trouvé ${episodeUrls.length} URL(s) d'épisode\n`)

    // 3. Tester chaque URL d'épisode
    const results = []

    for (let i = 0; i < episodeUrls.length; i++) {
      const episodeUrl = episodeUrls[i]
      const provider = identifyProvider(episodeUrl)

      console.log(`🔍 Test du provider ${provider} (${i + 1}/${episodeUrls.length}):`)
      console.log(`   URL: ${episodeUrl.substring(0, 80)}...`)

      const result = await measureResponseTime(episodeUrl, 20000)
      results.push({
        provider,
        episodeUrl: episodeUrl.substring(0, 80) + '...',
        fullUrl: episodeUrl,
        ...result
      })

      if (result.success) {
        console.log(`  ✅ ${result.responseTime}ms - Status: ${result.statusCode} - Taille: ${result.contentLength} bytes`)
      } else {
        console.log(`  ❌ ${result.responseTime}ms - Erreur: ${result.error || 'Inconnue'}`)
      }

      // Pause plus longue entre les tests pour éviter de surcharger les serveurs
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // 4. Analyser les résultats
    console.log('\n📊 RÉSULTATS POUR DEATH PARADE ÉPISODE 1:\n')

    const successfulResults = results.filter(r => r.success).sort((a, b) => a.responseTime - b.responseTime)

    if (successfulResults.length > 0) {
      console.log('🏆 Classement par vitesse de réponse:')
      successfulResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.provider} - ${result.responseTime}ms`)
        console.log(`     Status: ${result.statusCode}, Taille: ${result.contentLength} bytes`)
      })

      const fastest = successfulResults[0]
      console.log(`\n🎯 Provider le plus rapide: ${fastest.provider}`)
      console.log(`   Temps de réponse: ${fastest.responseTime}ms`)
      console.log(`   URL: ${fastest.fullUrl}`)

      // Analyse des providers
      const providerStats = {}
      successfulResults.forEach(result => {
        if (!providerStats[result.provider]) {
          providerStats[result.provider] = []
        }
        providerStats[result.provider].push(result.responseTime)
      })

      console.log('\n📈 STATISTIQUES PAR PROVIDER:')
      Object.entries(providerStats).forEach(([provider, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        const min = Math.min(...times)
        const max = Math.max(...times)
        console.log(`   ${provider}: ${times.length} test(s) - Moy: ${Math.round(avg)}ms - Min: ${min}ms - Max: ${max}ms`)
      })

    } else {
      console.log('❌ Aucun provider n\'a répondu avec succès')
    }

    // Statistiques générales
    console.log('\n📈 STATISTIQUES GÉNÉRALES:')
    console.log(`   Total de providers testés: ${results.length}`)
    console.log(`   Providers fonctionnels: ${successfulResults.length}`)
    console.log(`   Providers défaillants: ${results.length - successfulResults.length}`)

    if (successfulResults.length > 0) {
      const avgTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length
      console.log(`   Temps de réponse moyen: ${Math.round(avgTime)}ms`)
      console.log(`   Temps de réponse minimum: ${successfulResults[0].responseTime}ms`)
      console.log(`   Temps de réponse maximum: ${successfulResults[successfulResults.length - 1].responseTime}ms`)
    }

    // Recommandation
    if (successfulResults.length > 0) {
      console.log('\n💡 RECOMMANDATION:')
      console.log(`   Utilisez ${fastest.provider} pour la meilleure expérience de lecture.`)
      console.log(`   Temps d'attente estimé avant le début de la lecture: ${fastest.responseTime}ms`)
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message)
  }
}

// Lancer le script
main().catch(console.error)