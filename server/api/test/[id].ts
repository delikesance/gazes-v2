import axios from 'axios'
import https from 'https'

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
})

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id || typeof id !== 'string')
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing or invalid id parameter'
        })

    // Test flag scraping directly
    const seasonUrl = `https://179.43.149.218/catalogue/${id}/saison1/vostfr/`


    try {
        const seasonResponse = await axiosInstance.get(seasonUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            },
        })


        if (seasonResponse.status >= 200 && seasonResponse.status < 300) {
            const seasonHtml = seasonResponse.data

            const flags = parseLanguageFlags(seasonHtml)

            return { flags, htmlLength: seasonHtml.length }
        } else {
            return { error: 'Season page not found', status: seasonResponse.status }
        }
    } catch (error) {
        console.error('Error:', error)
        return { error: String(error) }
    }
})

// Function to parse language flags from season page HTML
function parseLanguageFlags(html: string): Record<string, string> {
    const flags: Record<string, string> = {}

    // Map flag filenames to emoji codes
    const flagMap: Record<string, string> = {
        'flag_cn.png': '🇨🇳', // China
        'flag_jp.png': '🇯🇵', // Japan
        'flag_kr.png': '🇰🇷', // Korea
        'flag_fr.png': '🇫🇷', // France
        'flag_en.png': '🇺🇸', // English (USA)
        'flag_qc.png': '🇨🇦', // Quebec/Canada
        'flag_sa.png': '🇸🇦', // Saudi Arabia (Arabic)
    }

    // Extract flag mappings from the HTML
    const flagRegex = /<a href="\.\.\/([^"]+)"[^>]*id="switch[^"]*"[^>]*>[\s\S]*?<img[^>]*src="[^"]*flag_([^"]+)\.png"[^>]*alt="[^"]*"[^>]*>[\s\S]*?<\/a>/gi
    let match
    let count = 0

    while ((match = flagRegex.exec(html)) !== null) {
        count++
        const langCode = match[1] // e.g., 'vostfr', 'vf', 'va', 'vj'
        const flagCode = match[2] // e.g., 'cn', 'jp', 'fr', 'en'


        const emoji = flagMap[`flag_${flagCode}.png`]
        if (emoji && langCode) {
            flags[langCode] = emoji
        }
    }

    return flags
}