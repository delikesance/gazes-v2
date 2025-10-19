#!/usr/bin/env node

// Script pour tester les providers de Death Parade Épisode 1 avec URLs connues
// Usage: node test-death-parade-known.js

import https from 'https'
import http from 'http'

// URLs connues de providers pour Death Parade Épisode 1 (exemples basés sur des patterns courants)
const KNOWN_DEATH_PARADE_URLS = [
  // Exemples de patterns de providers courants
  'https://video.sibnet.ru/shell.php?videoid=123456', // SibNet (remplacer par ID réel)
  'https://streamtape.com/v/abc123/def456', // StreamTape
  'https://vidmoly.to/embed-abc123.html', // VidMoly
  'https://uqload.com/embed-abc123.html', // UqLoad
  'https://doodstream.com/e/abc123', // DoodStream
  'https://myvi.top/embed/abc123', // MyVi
  'https://sendvid.com/embed/abc123', // SendVid
  // URLs de test pour démonstration
  'https://httpbin.org/delay/1',
  'https://httpbin.org/delay/2',
  'https://httpbin.org/delay/0.5',
  'https://httpbin.org/status/200'
]

// Fonction pour mesurer le temps de réponse d'une URL
function measureResponseTime(url, timeout = 15000) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const protocol = url.startsWith('https:') ? https : http

    const req = protocol.get(url, {
      timeout,
      rejectUnauthorized: false, // Pour les tests
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
  if (hostname.includes('httpbin')) return 'Test (httpbin)'
  return 'Inconnu'
}

// Fonction principale
async function main() {
  console.log('🚀 Test des providers pour Death Parade Épisode 1')
  console.log('📝 Note: Test avec URLs de démonstration car l\'API externe ne répond pas\n')

  const results = []

  for (let i = 0; i < KNOWN_DEATH_PARADE_URLS.length; i++) {
    const url = KNOWN_DEATH_PARADE_URLS[i]
    const provider = identifyProvider(url)

    console.log(`🔍 Test ${i + 1}/${KNOWN_DEATH_PARADE_URLS.length} - ${provider}:`)
    console.log(`   URL: ${url}`)

    const result = await measureResponseTime(url, 20000)
    results.push({
      provider,
      url,
      ...result
    })

    if (result.success) {
      console.log(`  ✅ ${result.responseTime}ms - Status: ${result.statusCode} - Taille: ${result.contentLength} bytes`)
    } else {
      console.log(`  ❌ ${result.responseTime}ms - Erreur: ${result.error || 'Inconnue'}`)
    }

    // Pause entre les tests
    await new Promise(resolve => setTimeout(resolve, 1500))
  }

  // Analyser les résultats
  console.log('\n📊 RÉSULTATS DU TEST:\n')

  const successfulResults = results.filter(r => r.success).sort((a, b) => a.responseTime - b.responseTime)

  if (successfulResults.length > 0) {
    console.log('🏆 Classement par vitesse de réponse:')
    successfulResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.provider} - ${result.responseTime}ms`)
    })

    const fastest = successfulResults[0]
    console.log(`\n🎯 Provider le plus rapide: ${fastest.provider}`)
    console.log(`   Temps de réponse: ${fastest.responseTime}ms`)

    // Statistiques par provider
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
      console.log(`   ${provider}: ${times.length} test(s) - Moyenne: ${Math.round(avg)}ms`)
    })

  } else {
    console.log('❌ Aucun provider n\'a répondu avec succès')
  }

  // Statistiques générales
  console.log('\n📈 STATISTIQUES GÉNÉRALES:')
  console.log(`   Total testé: ${results.length}`)
  console.log(`   Réussis: ${successfulResults.length}`)
  console.log(`   Échoués: ${results.length - successfulResults.length}`)

  if (successfulResults.length > 0) {
    const avgTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length
    console.log(`   Temps moyen: ${Math.round(avgTime)}ms`)
    console.log(`   Plus rapide: ${successfulResults[0].responseTime}ms`)
    console.log(`   Plus lent: ${successfulResults[successfulResults.length - 1].responseTime}ms`)
  }

  // Analyse des problèmes potentiels
  console.log('\n🔧 ANALYSE DES PERFORMANCES:')
  console.log('   Problèmes identifiés pour Death Parade Épisode 1:')
  console.log('   • L\'API externe (179.43.149.218) ne répond pas actuellement')
  console.log('   • Les providers peuvent être surchargés ou indisponibles')
  console.log('   • Certains providers nécessitent des résolutions supplémentaires')

  if (successfulResults.length > 0) {
    console.log('\n💡 RECOMMANDATIONS:')
    const fastest = successfulResults[0]
    console.log(`   • Prioriser ${fastest.provider} pour de meilleures performances`)
    console.log('   • Implémenter un système de cache pour éviter les requêtes répétées')
    console.log('   • Ajouter des timeouts plus courts pour détecter les pannes rapidement')
    console.log('   • Tester plusieurs providers en parallèle pour la redondance')
  }
}

// Lancer le script
main().catch(console.error)