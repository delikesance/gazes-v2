// Video provider handlers
import { scanForUrls, deobfuscateJavaScript } from './videoResolver'

export interface VideoProvider {
  name: string
  hostPatterns: RegExp[]
  extract(html: string, debug?: boolean): Set<string>
}

/**
 * Mivalyo video provider
 */
export class MivalyoProvider implements VideoProvider {
  name = 'mivalyo'
  hostPatterns = [/(^|\.)mivalyo\./i]

  extract(html: string, debug = false): Set<string> {
    const urls = new Set<string>()
    
    if (debug) console.info('[resolve] Mivalyo: starting specialized extraction')

    // First, scan for direct URLs
    const directUrls = scanForUrls(html, 'mivalyo raw HTML', debug)
    directUrls.forEach(url => urls.add(url))

    // Look for obfuscated eval function (safe, no ReDoS)
    const evalBlock = extractObfuscatedEval(html, debug)
    if (evalBlock) {
      if (debug) console.info('[resolve] Mivalyo: found eval function, length:', evalBlock.length)
      const deobfuscated = deobfuscateJavaScript(evalBlock, debug)
      if (deobfuscated) {
        if (debug) console.info('[resolve] Mivalyo: deobfuscated successfully')
        const deobfuscatedUrls = scanForUrls(deobfuscated, 'mivalyo deobfuscated', debug)
        deobfuscatedUrls.forEach(url => urls.add(url))
        
        // Look for specific source patterns
        this.extractSourcePatterns(deobfuscated, urls, debug)
      }
    } else {
      if (debug) console.info('[resolve] Mivalyo: no eval function found, trying fallback patterns')
      this.extractFallbackPatterns(html, urls, debug)
    }

    if (debug) console.info(`[resolve] Mivalyo: total URLs found: ${urls.size}`)
    return urls
  }

  private extractSourcePatterns(deobfuscated: string, urls: Set<string>, debug: boolean) {
    const sourcePatterns = [
      /var\s+o\s*=\s*\{[^}]*(?:"1e"|"1b"|"1c"|hls4|hls3|hls2)[^}]*\}/gi,
      /sources\s*:\s*\[[^\]]*file\s*:[^\]]*\]/gi,
      /file\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
    ]
    
    for (const pattern of sourcePatterns) {
      let match: RegExpExecArray | null
      let iterationCount = 0
      const maxIterations = 1000
      while ((match = pattern.exec(deobfuscated)) !== null) {
        if (++iterationCount > maxIterations) {
          if (debug) console.warn('[resolve] Mivalyo: max iterations reached, breaking loop')
          break
        }
        if (debug) console.info('[resolve] Mivalyo: found source pattern')
        const urlMatches = match[0].match(/"(https?:\/\/[^"]*\.(?:m3u8|mp4)[^"]*)"/g)
        if (urlMatches) {
          urlMatches.forEach(urlMatch => {
            const cleanUrl = urlMatch.replace(/"/g, '')
            urls.add(cleanUrl)
            if (debug) console.info('[resolve] Mivalyo: extracted URL:', cleanUrl)
          })
        }
      }
    }
  }

  private extractFallbackPatterns(html: string, urls: Set<string>, debug: boolean) {
    const fallbackPatterns = [
      /var\s+\w+\s*=\s*"[^"]*\.(?:m3u8|mp4)[^"]*"/gi,
      /['"]https?:\/\/[^'"]*\.(?:m3u8|mp4)[^'"]*['"]/gi,
      /source:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
      /src:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
      /file:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
      /url:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
    ]
    
    for (const pattern of fallbackPatterns) {
      const matches = html.match(pattern)
      if (matches) {
        if (debug) console.info(`[resolve] Mivalyo: found ${matches.length} potential URLs with fallback pattern`)
        matches.forEach(match => {
          const urlMatch = match.match(/https?:\/\/[^'"]*\.(?:m3u8|mp4)[^'"]*/)
          if (urlMatch) {
            urls.add(urlMatch[0])
            if (debug) console.info('[resolve] Mivalyo: extracted URL from fallback:', urlMatch[0])
          }
        })
      }
    }

    // Analyze script tags
    // Safer script tag extraction: truncate input, use non-greedy pattern
    // For production, consider using a real HTML parser like cheerio for reliability
    const safeHtml = html.length > 100000 ? html.slice(0, 100000) : html
    const scriptTagPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi
    const scriptTags = Array.from(safeHtml.matchAll(scriptTagPattern))
    if (scriptTags.length > 0) {
      if (debug) console.info(`[resolve] Mivalyo: analyzing ${scriptTags.length} script tags`)
      scriptTags.forEach((match, index) => {
        const script = match[1] || ''
        if (script.includes('.m3u8') || script.includes('.mp4')) {
          if (debug) console.info(`[resolve] Mivalyo: script tag ${index} contains video references`)
          const scriptUrls = scanForUrls(script, `mivalyo script tag ${index}`, debug)
          scriptUrls.forEach(url => urls.add(url))
        }
      })
    }
  }
}

/**
 * Vidmoly video provider
 */
export class VidmolyProvider implements VideoProvider {
  name = 'vidmoly'
  hostPatterns = [/(^|\.)vidmoly\./i]

  extract(html: string, debug = false): Set<string> {
    const urls = new Set<string>()
    
    if (debug) console.info('[resolve] Vidmoly: starting extraction')
    
    // Vidmoly-specific patterns
    const patterns = [
      /file:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
      /source:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
      /src:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
    ]
    
    for (const pattern of patterns) {
      // Use matchAll for safe iteration (avoids zero-length match infinite loop)
      const matches = Array.from(html.matchAll(pattern))
      for (const match of matches) {
        if (match[1]) {
          urls.add(match[1])
          if (debug) console.info('[resolve] Vidmoly: found URL:', match[1])
        }
      }
    }
    
    // Also scan for general URLs
    const generalUrls = scanForUrls(html, 'vidmoly general', debug)
    generalUrls.forEach(url => urls.add(url))
    
    return urls
  }
}

/**
 * Generic video provider for unknown hosts
 */
export class GenericProvider implements VideoProvider {
  name = 'generic'
  hostPatterns = [/.*/]

  extract(html: string, debug = false): Set<string> {
    if (debug) console.info('[resolve] Generic: using general extraction')
    return scanForUrls(html, 'generic extraction', debug)
  }
}

/**
 * Provider factory
 */
export class ProviderFactory {
  private static providers: VideoProvider[] = [
    new MivalyoProvider(),
    new VidmolyProvider(),
    new GenericProvider(), // Keep as last fallback
  ]

  static getProvider(html: string, hostname: string): VideoProvider {
    // Check content-based detection first
    if (html.includes('mivalyo') || html.includes('vidhide')) {
      return this.providers.find(p => p.name === 'mivalyo') || new GenericProvider()
    }
    
    // Check hostname-based detection
    for (const provider of this.providers) {
      for (const pattern of provider.hostPatterns) {
        if (pattern.test(hostname)) {
          return provider
        }
      }
    }
    
    return new GenericProvider()
  }
}

// Safer regex for obfuscated eval extraction (avoids .*)
function extractObfuscatedEval(html: string, debug = false, maxLen = 100000): string | null {
  if (html.length > maxLen) {
    if (debug) console.warn(`[resolve] Mivalyo: HTML too large (${html.length}), truncating to ${maxLen}`)
    html = html.slice(0, maxLen)
  }
  // This pattern avoids .*, matches function body with [^}]+ and up to closing )) with [^)]*
  const pattern = /eval\(function\(p,a,c,k,e,d\)\{[^}]+\}[^)]*\)\)/s
  const match = html.match(pattern)
  return match ? match[0] : null
}